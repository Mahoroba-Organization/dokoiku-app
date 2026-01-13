import { NextResponse } from 'next/server';
import { addVote, addVotes, getRoom, saveRoom } from '@/app/lib/kv';
import { calculateRanking, checkAutoDecision, getParticipantCount, getMinCommon, CONSECUTIVE_ROUNDS } from '@/app/lib/explore_exploit';
import { Comparison } from '@/app/lib/elo';
import { NG_SCORE } from '@/app/lib/vote_constants';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ roomId: string }> }
) {
    const { roomId } = await params;
    const body = await request.json();
    const { userId, shopId, score, votes } = body;

    if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const voteItems: Array<{ shopId: string; score: number }> = Array.isArray(votes)
        ? votes
        : (shopId ? [{ shopId, score }] : []);

    if (voteItems.length === 0) {
        return NextResponse.json({ error: 'votes are required' }, { status: 400 });
    }

    const buildComparisons = (items: Array<{ shopId: string; score: number }>): Comparison[] => {
        const comparisons: Comparison[] = [];
        if (items.length < 2) return comparisons;
        for (let i = 0; i < items.length; i += 1) {
            for (let j = i + 1; j < items.length; j += 1) {
                const first = items[i];
                const second = items[j];
                if (first.score === NG_SCORE && second.score === NG_SCORE) {
                    comparisons.push({ a: first.shopId, b: second.shopId, result: 'tie' });
                } else if (first.score === NG_SCORE) {
                    comparisons.push({ a: first.shopId, b: second.shopId, result: 'b' });
                } else if (second.score === NG_SCORE) {
                    comparisons.push({ a: first.shopId, b: second.shopId, result: 'a' });
                } else if (first.score === second.score) {
                    comparisons.push({ a: first.shopId, b: second.shopId, result: 'tie' });
                } else {
                    comparisons.push(
                        first.score > second.score
                            ? { a: first.shopId, b: second.shopId, result: 'a' }
                            : { a: first.shopId, b: second.shopId, result: 'b' }
                    );
                }
            }
        }
        return comparisons;
    };

    try {
        // 投票を保存
        if (voteItems.length === 1) {
            await addVote(roomId, userId, voteItems[0].shopId, voteItems[0].score);
        } else {
            await addVotes(roomId, userId, voteItems);
        }

        // 最新のルームデータを取得
        const room = await getRoom(roomId);
        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // 比較履歴を保存
        const comparisons = buildComparisons(voteItems);
        if (comparisons.length > 0) {
            if (!room.comparisons) room.comparisons = {};
            if (!room.comparisons[userId]) room.comparisons[userId] = [];
            room.comparisons[userId].push(...comparisons);
        }

        // ランキング計算
        const participantCount = getParticipantCount(room.votes);
        const minCommon = getMinCommon(participantCount);
        const ranking = calculateRanking(room.shops, room.votes, room.comparisons, minCommon);

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
