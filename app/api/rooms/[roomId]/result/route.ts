import { NextResponse } from 'next/server';
import { getRoom } from '@/app/lib/kv';
import { calculateRanking, getParticipantCount, getMinCommon } from '@/app/lib/explore_exploit';
import { identifyA } from '@/app/lib/logic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ roomId: string }> }
) {
    const { roomId } = await params;
    const room = await getRoom(roomId);

    if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const votes = room.votes || {};
    const shops = room.shops || [];

    // A推定
    const aAnalysis = identifyA(votes);

    // 候補店舗のランキング計算
    const participantCount = getParticipantCount(votes);
    const minCommon = getMinCommon(participantCount);
    const ranking = calculateRanking(shops, votes, minCommon);

    // レスポンス用に整形
    const candidates = ranking.map(ranked => ({
        shop: ranked.shop,
        avgScore: ranked.avgScore,
        ratedCount: ranked.ratedCount,
        penaltyApplied: ranked.penaltyApplied
    }));

    return NextResponse.json({
        candidates,
        isDecided: room.isDecided || false,
        decidedShopId: room.decidedShopId,
        isVotingComplete: room.isVotingComplete || false,
        aAnalysis: {
            exists: !!aAnalysis.aUserId,
            maxAScore: aAnalysis.maxAScore,
        }
    });
}
