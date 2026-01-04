import { NextResponse } from 'next/server';
import { addVote, getRoom, saveRoom } from '@/app/lib/kv';
import { calculateRanking, checkAutoDecision, getParticipantCount, getMinCommon, CONSECUTIVE_ROUNDS } from '@/app/lib/explore_exploit';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ roomId: string }> }
) {
    const { roomId } = await params;
    const body = await request.json();
    const { userId, shopId, score } = body;

    try {
        // 投票を保存
        await addVote(roomId, userId, shopId, score);

        // 最新のルームデータを取得
        const room = await getRoom(roomId);
        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // ランキング計算
        const participantCount = getParticipantCount(room.votes);
        const minCommon = getMinCommon(participantCount);
        const ranking = calculateRanking(room.shops, room.votes, minCommon);

        // 順位履歴を更新
        if (!room.rankHistory) {
            room.rankHistory = [];
        }

        if (ranking.length >= 2) {
            const top1 = ranking[0];
            const top2 = ranking[1];

            room.rankHistory.push({
                timestamp: Date.now(),
                top1ShopId: top1.shop.id,
                top2ShopId: top2.shop.id,
                scoreDiff: top1.avgScore - top2.avgScore
            });

            // 最大R件まで保持
            if (room.rankHistory.length > CONSECUTIVE_ROUNDS) {
                room.rankHistory = room.rankHistory.slice(-CONSECUTIVE_ROUNDS);
            }
        }

        // 自動決定チェック
        const decision = checkAutoDecision(room.rankHistory, ranking);
        if (decision.decided) {
            room.isDecided = true;
            room.decidedShopId = decision.shopId;
        }

        // ルームデータを保存
        await saveRoom(roomId, room);

        return NextResponse.json({
            success: true,
            isDecided: room.isDecided,
            decidedShopId: room.decidedShopId
        });
    } catch (error) {
        console.error('Vote failed:', error);
        return NextResponse.json({ error: 'Failed to vote' }, { status: 500 });
    }
}

