import { VoteEntry, RoomVotes, UserVotes } from './kv';
import { NG_SCORE } from './vote_constants';

export type VoteStats = {
    sum: number;
    count: number;
    lastScore: number;
    ng: boolean;
};

export function normalizeVote(entry: VoteEntry | undefined): VoteStats | null {
    if (entry === undefined) return null;
    if (typeof entry === 'number') {
        return {
            sum: entry === NG_SCORE ? 0 : entry,
            count: entry === NG_SCORE ? 0 : 1,
            lastScore: entry,
            ng: entry === NG_SCORE
        };
    }
    return {
        sum: entry.sum || 0,
        count: entry.count || 0,
        lastScore: entry.lastScore ?? 0,
        ng: !!entry.ng
    };
}

export function isNgVote(entry: VoteEntry | undefined): boolean {
    const stats = normalizeVote(entry);
    return !!stats?.ng;
}

export function getUserVotes(votes: RoomVotes, userId: string): UserVotes {
    return votes[userId] || {};
}
