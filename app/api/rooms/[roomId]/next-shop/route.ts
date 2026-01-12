import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/app/lib/kv';
import { CANDIDATE_POOL_SIZE, selectPairByGenreBias, selectSingleByGenreBias, Shop } from '@/app/lib/genre_selection';
import { filterShopsByBudgetRange, getBudgetCodesForRange, normalizeBudgetRange } from '@/app/lib/budget';
import { getUserVotes, isNgVote } from '@/app/lib/vote_stats';
import { computeEloRatings, getTopKShopIds, getMissingTopPairs } from '@/app/lib/elo';
import { USER_TOP_K } from '@/app/lib/explore_exploit';

const HOTPEPPER_API_ENDPOINT = 'http://webservice.recruit.co.jp/hotpepper/gourmet/v1/';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ roomId: string }> }
) {
    const { roomId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    try {
        const room = await getRoom(roomId);
        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // 自動決定済みの場合
        if (room.isDecided) {
            return NextResponse.json({
                pair: null,
                progress: {
                    evaluated: Object.keys(room.votes[userId] || {}).length,
                    total: room.shops.length,
                    isDecided: true,
                    decidedShopId: room.decidedShopId
                }
            });
        }

        const existingShops: Shop[] = Array.isArray(room.shops) ? room.shops : [];
        let candidatePool = existingShops;

        if (existingShops.length === 0) {
            const apiKey = process.env.HOTPEPPER_API_KEY;
            if (!apiKey) {
                return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
            }

            const range = normalizeBudgetRange(room.conditions?.budgetMin, room.conditions?.budgetMax);
            const budgetCodes = getBudgetCodesForRange(range);

            const params = new URLSearchParams({
                key: apiKey,
                keyword: room.conditions?.area || '',
                format: 'json',
                count: String(CANDIDATE_POOL_SIZE),
            });
            if (budgetCodes.length > 0) {
                params.set('budget', budgetCodes.join(','));
            }

            const fetchShops = async (query: URLSearchParams): Promise<Shop[]> => {
                const response = await fetch(`${HOTPEPPER_API_ENDPOINT}?${query.toString()}`);
                const data = await response.json();
                return data?.results?.shop || [];
            };

            let fetchedShops = await fetchShops(params);
            if (budgetCodes.length > 0 && fetchedShops.length === 0) {
                params.delete('budget');
                fetchedShops = await fetchShops(params);
            }

            const filteredFetched = filterShopsByBudgetRange(fetchedShops, range);
            candidatePool = filteredFetched.length >= 2 ? filteredFetched : fetchedShops;
            room.shops = candidatePool;
            await saveRoom(roomId, room);
        }

        const userVotes = getUserVotes(room.votes, userId);
        if (!room.pairHistory) room.pairHistory = {};
        if (!room.pairHistory[userId]) room.pairHistory[userId] = [];
        const pairHistory = room.pairHistory[userId];
        const pairHistoryKeys = new Set(
            pairHistory.map(pair => (pair.a < pair.b ? `${pair.a}|${pair.b}` : `${pair.b}|${pair.a}`))
        );
        const excludedShopIds = new Set<string>();
        Object.entries(userVotes).forEach(([shopId, entry]) => {
            if (isNgVote(entry)) {
                excludedShopIds.add(shopId);
            }
        });

        const unseen = candidatePool.filter(shop => userVotes[shop.id] === undefined);
        let nextPair: [Shop, Shop] | null = null;

        const pickPairAvoidingHistory = (candidates: Shop[]): [Shop, Shop] | null => {
            if (candidates.length < 2) return null;
            for (let i = 0; i < 10; i += 1) {
                const pair = selectPairByGenreBias(userId, candidates, room.votes, candidatePool);
                if (!pair) return null;
                const key = pair[0].id < pair[1].id ? `${pair[0].id}|${pair[1].id}` : `${pair[1].id}|${pair[0].id}`;
                if (!pairHistoryKeys.has(key)) return pair;
            }
            return selectPairByGenreBias(userId, candidates, room.votes, candidatePool);
        };

        if (unseen.length >= 2) {
            nextPair = pickPairAvoidingHistory(unseen);
        } else if (unseen.length === 1) {
            const first = unseen[0];
            const seenCandidates = candidatePool.filter(
                shop => shop.id !== first.id && !excludedShopIds.has(shop.id)
            );
            const eligibleSeconds = seenCandidates.filter(shop => {
                const key = first.id < shop.id ? `${first.id}|${shop.id}` : `${shop.id}|${first.id}`;
                return !pairHistoryKeys.has(key);
            });
            const second = selectSingleByGenreBias(
                userId,
                eligibleSeconds.length > 0 ? eligibleSeconds : seenCandidates,
                room.votes,
                candidatePool
            );
            nextPair = second ? [first, second] : null;
        } else {
            const comparisons = room.comparisons?.[userId] || [];
            const candidateIds = candidatePool.map(shop => shop.id);
            const ratings = computeEloRatings(candidateIds, comparisons, excludedShopIds);
            const topIds = getTopKShopIds(ratings, USER_TOP_K);
            const missingPairs = getMissingTopPairs(topIds, comparisons);

            if (missingPairs.length > 0) {
                const target = missingPairs[Math.floor(Math.random() * missingPairs.length)];
                const shopA = candidatePool.find(shop => shop.id === target.a);
                const shopB = candidatePool.find(shop => shop.id === target.b);
                if (shopA && shopB) {
                    nextPair = [shopA, shopB];
                }
            }

            if (!nextPair) {
                const seenCandidates = candidatePool.filter(shop => !excludedShopIds.has(shop.id));
                nextPair = pickPairAvoidingHistory(seenCandidates);
            }
        }

        if (nextPair) {
            const key = nextPair[0].id < nextPair[1].id
                ? { a: nextPair[0].id, b: nextPair[1].id }
                : { a: nextPair[1].id, b: nextPair[0].id };
            pairHistory.push(key);
            if (pairHistory.length > 20) {
                room.pairHistory[userId] = pairHistory.slice(-20);
            }
            await saveRoom(roomId, room);
        }
        const evaluatedCount = Object.keys(userVotes).length;

        return NextResponse.json({
            pair: nextPair,
            progress: {
                evaluated: evaluatedCount,
                total: (room.shops || []).length,
                isDecided: false
            }
        });
    } catch (error) {
        console.error('Error fetching next shop:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
