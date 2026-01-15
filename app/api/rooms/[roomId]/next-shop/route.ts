import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/app/lib/kv';
import { CANDIDATE_POOL_SIZE, selectPairByGenreBias, selectSingleByGenreBias, Shop } from '@/app/lib/genre_selection';
import { filterShopsByBudgetRange, getBudgetCodesForRange, normalizeBudgetRange } from '@/app/lib/budget';
import { getUserVotes, isNgVote } from '@/app/lib/vote_stats';
import { computeEloRatings, getBoundaryDelta, getBoundaryPairs, getMissingTopPairs, getTopKShopIds, TOP_BOUNDARY_DELTA, TOP_FOCUS_COUNT, TOP_MISSING_PAIR_LIMIT, TOP_TARGET_COUNT } from '@/app/lib/elo';

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
        const toPairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
        const pairHistoryKeys = new Set(pairHistory.map(pair => toPairKey(pair.a, pair.b)));
        const excludedShopIds = new Set<string>();
        Object.entries(userVotes).forEach(([shopId, entry]) => {
            if (isNgVote(entry)) {
                excludedShopIds.add(shopId);
            }
        });

        const unseen = candidatePool.filter(shop => userVotes[shop.id] === undefined);
        let nextSet: [Shop, Shop, Shop] | null = null;

        const pickPairAvoidingHistory = (candidates: Shop[]): [Shop, Shop] | null => {
            if (candidates.length < 2) return null;
            for (let i = 0; i < 10; i += 1) {
                const pair = selectPairByGenreBias(userId, candidates, room.votes, candidatePool);
                if (!pair) return null;
                const key = toPairKey(pair[0].id, pair[1].id);
                if (!pairHistoryKeys.has(key)) return pair;
            }
            return selectPairByGenreBias(userId, candidates, room.votes, candidatePool);
        };

        const pickThird = (first: Shop, second: Shop, candidates: Shop[]): Shop | null => {
            const eligible = candidates.filter(shop => {
                const key1 = toPairKey(first.id, shop.id);
                const key2 = toPairKey(second.id, shop.id);
                return !pairHistoryKeys.has(key1) && !pairHistoryKeys.has(key2);
            });
            return selectSingleByGenreBias(
                userId,
                eligible.length > 0 ? eligible : candidates,
                room.votes,
                candidatePool
            );
        };

        const getPriorityCandidates = (excludeIds: Set<string>): Shop[] => {
            const comparisons = room.comparisons?.[userId] || [];
            const candidateIds = candidatePool.map(shop => shop.id);
            const ratings = computeEloRatings(candidateIds, comparisons, excludedShopIds);
            const topIds = getTopKShopIds(ratings, TOP_TARGET_COUNT);
            const focusIds = getTopKShopIds(ratings, TOP_FOCUS_COUNT);
            const topSet = new Set(topIds);
            const boundaryIds = focusIds.filter(id => !topSet.has(id));
            const priorityIds = new Set([...topIds, ...boundaryIds]);
            return candidatePool.filter(shop => priorityIds.has(shop.id) && !excludeIds.has(shop.id) && !excludedShopIds.has(shop.id));
        };

        if (unseen.length >= 3) {
            const basePair = pickPairAvoidingHistory(unseen);
            if (basePair) {
                const remaining = unseen.filter(shop => shop.id !== basePair[0].id && shop.id !== basePair[1].id);
                const third = pickThird(basePair[0], basePair[1], remaining);
                nextSet = third ? [basePair[0], basePair[1], third] : null;
            }
        } else if (unseen.length === 2) {
            const [first, second] = unseen;
            const excludeIds = new Set([first.id, second.id]);
            const priorityCandidates = getPriorityCandidates(excludeIds);
            const fallbackCandidates = candidatePool.filter(
                shop => shop.id !== first.id && shop.id !== second.id && !excludedShopIds.has(shop.id)
            );
            const third = pickThird(
                first,
                second,
                priorityCandidates.length > 0 ? priorityCandidates : fallbackCandidates
            );
            nextSet = third ? [first, second, third] : null;
        } else if (unseen.length === 1) {
            const first = unseen[0];
            const excludeIds = new Set([first.id]);
            const priorityCandidates = getPriorityCandidates(excludeIds);
            const fallbackCandidates = candidatePool.filter(
                shop => shop.id !== first.id && !excludedShopIds.has(shop.id)
            );
            const second = selectSingleByGenreBias(
                userId,
                priorityCandidates.length > 0 ? priorityCandidates : fallbackCandidates,
                room.votes,
                candidatePool
            );
            if (second) {
                const remaining = (priorityCandidates.length > 0 ? priorityCandidates : fallbackCandidates)
                    .filter(shop => shop.id !== second.id);
                const third = pickThird(first, second, remaining);
                nextSet = third ? [first, second, third] : null;
            }
        } else {
            const comparisons = room.comparisons?.[userId] || [];
            const candidateIds = candidatePool.map(shop => shop.id);
            const ratings = computeEloRatings(candidateIds, comparisons, excludedShopIds);
            const topIds = getTopKShopIds(ratings, TOP_TARGET_COUNT);
            const focusIds = getTopKShopIds(ratings, TOP_FOCUS_COUNT);
            const focusCandidates = candidatePool.filter(
                shop => focusIds.includes(shop.id) && !excludedShopIds.has(shop.id)
            );
            const missingTopPairs = getMissingTopPairs(topIds, comparisons);
            const boundaryDelta = getBoundaryDelta(ratings, TOP_TARGET_COUNT);

            if (missingTopPairs.length > TOP_MISSING_PAIR_LIMIT) {
                const target = missingTopPairs[Math.floor(Math.random() * missingTopPairs.length)];
                const shopA = candidatePool.find(shop => shop.id === target.a);
                const shopB = candidatePool.find(shop => shop.id === target.b);
                if (shopA && shopB) {
                    const remaining = focusCandidates.filter(
                        shop => shop.id !== shopA.id && shop.id !== shopB.id
                    );
                    const third = pickThird(shopA, shopB, remaining);
                    nextSet = third ? [shopA, shopB, third] : null;
                }
            }

            if (!nextSet && boundaryDelta !== null && boundaryDelta < TOP_BOUNDARY_DELTA) {
                const topSet = new Set(topIds);
                const boundaryIds = focusIds.filter(id => !topSet.has(id));
                const boundaryPairs = getBoundaryPairs(topIds, boundaryIds, comparisons);
                if (boundaryPairs.length > 0) {
                    const target = boundaryPairs[Math.floor(Math.random() * boundaryPairs.length)];
                    const shopA = candidatePool.find(shop => shop.id === target.a);
                    const shopB = candidatePool.find(shop => shop.id === target.b);
                    if (shopA && shopB) {
                        const remaining = focusCandidates.filter(
                            shop => shop.id !== shopA.id && shop.id !== shopB.id
                        );
                        const third = pickThird(shopA, shopB, remaining);
                        nextSet = third ? [shopA, shopB, third] : null;
                    }
                }
            }

            if (!nextSet) {
                const basePair = pickPairAvoidingHistory(focusCandidates);
                if (basePair) {
                    const remaining = focusCandidates.filter(
                        shop => shop.id !== basePair[0].id && shop.id !== basePair[1].id
                    );
                    const third = pickThird(basePair[0], basePair[1], remaining);
                    nextSet = third ? [basePair[0], basePair[1], third] : null;
                }
            }
        }

        if (nextSet) {
            const [a, b, c] = nextSet;
            const pairs = [
                { a: a.id, b: b.id },
                { a: a.id, b: c.id },
                { a: b.id, b: c.id }
            ];
            pairs.forEach(pair => {
                const ordered = pair.a < pair.b ? pair : { a: pair.b, b: pair.a };
                pairHistory.push(ordered);
            });
            if (pairHistory.length > 20) {
                room.pairHistory[userId] = pairHistory.slice(-20);
            }
            await saveRoom(roomId, room);
        }
        const evaluatedCount = Object.keys(userVotes).length;

        return NextResponse.json({
            pair: nextSet,
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
