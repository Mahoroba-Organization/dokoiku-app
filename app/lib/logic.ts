
import { VoteEntry } from './kv';
import { normalizeVote } from './vote_stats';

export type VoteScore = number; // 0 to 100

export type UserVotes = Record<string, VoteEntry>; // shopId -> score or stats
export type RoomVotes = Record<string, UserVotes>; // userId -> UserVotes

// Configuration
export const MIN_VOTES_FOR_A = 3;
export const A_THRESHOLD = 0.7; // Kept for logic if needed, but logic below changes
export const A_PENALTY = 50.0; // Penalty score for A's dislike
export const NEGATIVE_SCORE_THRESHOLD = 25; // Scores <= this are considered "No"

export interface AAnalysisResult {
    aUserId: string | null;
    maxAScore: number;
    details: Record<string, { negRate: number; avgScore: number; aScore: number; voteCount: number }>;
}

export function identifyA(votes: RoomVotes): AAnalysisResult {
    let maxAScore = -1;
    let aUserId: string | null = null;
    const details: Record<string, any> = {};

    Object.entries(votes).forEach(([userId, userVotes]) => {
        const voteCount = Object.keys(userVotes).length;

        let badCount = 0;
        let totalScore = 0;

        Object.values(userVotes).forEach(entry => {
            const stats = normalizeVote(entry);
            if (!stats || stats.ng) return;
            const avg = stats.count > 0 ? stats.sum / stats.count : 0;
            if (avg <= NEGATIVE_SCORE_THRESHOLD) badCount++;
            totalScore += avg;
        });

        const negRate = voteCount > 0 ? badCount / voteCount : 0;
        const avgScore = voteCount > 0 ? totalScore / voteCount : 0;

        // A-score calculation
        // High Negative Rate = High A Score
        // Low Average Score = High A Score
        // A_score = 0.7 * negRate + 0.3 * (1 - avgScore/100)
        const aScore = (0.7 * negRate) + (0.3 * (1 - avgScore / 100));

        details[userId] = { negRate, avgScore, aScore, voteCount };

        if (voteCount >= MIN_VOTES_FOR_A) {
            if (aScore > maxAScore) {
                maxAScore = aScore;
                aUserId = userId;
            }
        }
    });

    // Check threshold (e.g., must have > 0.4 A-score to be considered A)
    // Adjusting roughly based on previous logic
    if (maxAScore < 0.4) {
        aUserId = null;
    }

    return { aUserId, maxAScore, details };
}

export interface ShopScore {
    shopId: string;
    baseScore: number; // Average score
    finalScore: number; // After penalty
    penaltyApplied: boolean;
    voteCount: number;
}

export function calculateShopScores(shops: any[], votes: RoomVotes, aUserId: string | null): ShopScore[] {
    return shops.map(shop => {
        let totalScore = 0;
        let count = 0;
        let aVotedNo = false;

        Object.entries(votes).forEach(([userId, userVotes]) => {
            const entry = userVotes[shop.id];
            const stats = normalizeVote(entry);
            if (!stats || stats.ng) return;
            const avg = stats.count > 0 ? stats.sum / stats.count : 0;
            totalScore += avg;
            count++;

            if (userId === aUserId && avg <= NEGATIVE_SCORE_THRESHOLD) {
                aVotedNo = true;
            }
        });

        const baseScore = count > 0 ? totalScore / count : 0;
        let finalScore = baseScore;

        if (aVotedNo) {
            finalScore -= A_PENALTY;
        }

        return {
            shopId: shop.id,
            baseScore,
            finalScore,
            penaltyApplied: aVotedNo,
            voteCount: count
        };
    });
}

export function sortShops(scores: ShopScore[]): ShopScore[] {
    return [...scores].sort((a, b) => {
        // 1. Final Score (Descending)
        if (Math.abs(b.finalScore - a.finalScore) > 0.001) {
            return b.finalScore - a.finalScore;
        }

        // 2. Tie-breaker: Random (Deterministic based on ID for stability in this demo)
        return a.shopId.localeCompare(b.shopId);
    });
}
