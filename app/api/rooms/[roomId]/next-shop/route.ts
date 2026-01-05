import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/app/lib/kv';
import { getNextPair } from '@/app/lib/explore_exploit';

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

        // 次の店舗ペアを取得
        const nextPair = getNextPair(userId, room.shops, room.votes);

        const userVotes = room.votes[userId] || {};
        const evaluatedCount = Object.keys(userVotes).length;

        return NextResponse.json({
            pair: nextPair,
            progress: {
                evaluated: evaluatedCount,
                total: room.shops.length,
                isDecided: false
            }
        });
    } catch (error) {
        console.error('Error fetching next shop:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
