import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/app/lib/kv';
import { CANDIDATE_POOL_SIZE, selectPairByGenreBias, selectSingleByGenreBias, Shop } from '@/app/lib/genre_selection';
import { filterShopsByBudgetRange, getBudgetCodesForRange, normalizeBudgetRange } from '@/app/lib/budget';
import { getUserVotes, isNgVote } from '@/app/lib/vote_stats';

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
        const excludedShopIds = new Set<string>();
        Object.entries(userVotes).forEach(([shopId, entry]) => {
            if (isNgVote(entry)) {
                excludedShopIds.add(shopId);
            }
        });

        const unseen = candidatePool.filter(shop => userVotes[shop.id] === undefined);
        let nextPair: [Shop, Shop] | null = null;

        if (unseen.length >= 2) {
            nextPair = selectPairByGenreBias(userId, unseen, room.votes, candidatePool);
        } else if (unseen.length === 1) {
            const first = unseen[0];
            const seenCandidates = candidatePool.filter(
                shop => shop.id !== first.id && !excludedShopIds.has(shop.id)
            );
            const second = selectSingleByGenreBias(userId, seenCandidates, room.votes, candidatePool);
            nextPair = second ? [first, second] : null;
        } else {
            const seenCandidates = candidatePool.filter(shop => !excludedShopIds.has(shop.id));
            nextPair = selectPairByGenreBias(userId, seenCandidates, room.votes, candidatePool);
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
