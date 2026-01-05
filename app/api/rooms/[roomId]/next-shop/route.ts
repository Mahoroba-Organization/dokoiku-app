import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/app/lib/kv';
import { CANDIDATE_POOL_SIZE, selectPairByGenreBias, Shop } from '@/app/lib/genre_selection';
import { filterShopsByBudgetRange, getBudgetCodesForRange, normalizeBudgetRange } from '@/app/lib/budget';

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
        const usableFetched = filteredFetched.length >= 2 ? filteredFetched : fetchedShops;

        const existingShops: Shop[] = Array.isArray(room.shops) ? room.shops : [];
        const shopById = new Map(existingShops.map(shop => [shop.id, shop]));
        usableFetched.forEach(shop => {
            if (!shopById.has(shop.id)) {
                shopById.set(shop.id, shop);
            }
        });

        const mergedShops = Array.from(shopById.values());
        const userVotes = room.votes[userId] || {};
        const unevaluated = mergedShops.filter(shop => userVotes[shop.id] === undefined);

        const nextPair = selectPairByGenreBias(userId, unevaluated, room.votes, mergedShops);

        if (mergedShops.length !== existingShops.length) {
            room.shops = mergedShops;
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
