import Redis from 'ioredis';
import { NG_SCORE } from './vote_constants';

// Type definitions (reused from store/logic)
export type VoteType = number;
export type VoteEntry = VoteType | { sum: number; count: number; lastScore: number; ng?: boolean };
export type UserVotes = Record<string, VoteEntry>; // shopId -> vote stats or score
export type RoomVotes = Record<string, UserVotes>; // userId -> UserVotes

export type RoomData = {
    id: string;
    conditions: { area: string; budget?: string; budgetMin?: number; budgetMax?: number };
    shops: any[];
    votes: RoomVotes;
    participants: string[];
    fetchMeta?: {
        fetchedCount: number;
        filteredCount: number;
        candidatePoolCount: number;
        budgetCodes: string[];
        budgetFilterUsed: boolean;
        fallbackUsed: boolean;
        range?: { min: number; max: number } | null;
    };
    // Explore-Exploit Algorithm Fields
    rankHistory?: Array<{
        timestamp: number;
        top1ShopId: string;
        top2ShopId: string;
        scoreDiff: number;
    }>;
    pairHistory?: Record<string, Array<{ a: string; b: string }>>;
    comparisons?: Record<string, Array<{ a: string; b: string; result: 'a' | 'b' | 'tie' }>>;
    isDecided?: boolean;
    decidedShopId?: string;
};

const ROOM_TTL = 60 * 60 * 24; // 24 hours

// Initialize Redis client
let redis: Redis | null = null;

if (process.env.REDIS_URL) {
    // Some Vercel KV URLs are 'redis://' but require TLS.
    // We force TLS if the URL contains 'vercel-storage' or if we are in production.
    const isVercelKV = process.env.REDIS_URL.includes('vercel-storage') || process.env.REDIS_URL.includes('upstash');

    if (isVercelKV || process.env.REDIS_URL.startsWith('rediss://')) {
        redis = new Redis(process.env.REDIS_URL, {
            tls: {
                rejectUnauthorized: false
            },
            maxRetriesPerRequest: null // Disable this to prevent the specific error user is seeing
        });
    } else {
        redis = new Redis(process.env.REDIS_URL);
    }
} else {
    if (process.env.NODE_ENV === 'production') {
        console.error('REDIS_URL is not defined in production environment.');
    }
}

export async function saveRoom(roomId: string, data: RoomData): Promise<void> {
    if (!redis) {
        if (process.env.NODE_ENV === 'development') {
            console.warn('Redis not configured. Using in-memory store fallback.');
            const { rooms } = await import('./store');
            rooms[roomId] = data;
            return;
        }
        throw new Error('Redis not configured');
    }

    await redis.set(`room:${roomId}`, JSON.stringify(data), 'EX', ROOM_TTL);
}

export async function getRoom(roomId: string): Promise<RoomData | null> {
    if (!redis) {
        if (process.env.NODE_ENV === 'development') {
            const { rooms } = await import('./store');
            return rooms[roomId] || null;
        }
        throw new Error('Redis not configured');
    }

    const data = await redis.get(`room:${roomId}`);
    return data ? JSON.parse(data) as RoomData : null;
}

export async function addVote(roomId: string, userId: string, shopId: string, voteType: VoteType): Promise<void> {
    const room = await getRoom(roomId);
    if (!room) throw new Error('Room not found');

    if (!room.votes) room.votes = {};
    if (!room.votes[userId]) room.votes[userId] = {};

    room.votes[userId][shopId] = updateVoteEntry(room.votes[userId][shopId], voteType);

    await saveRoom(roomId, room);
}

export async function addVotes(
    roomId: string,
    userId: string,
    votes: Array<{ shopId: string; score: VoteType }>
): Promise<void> {
    const room = await getRoom(roomId);
    if (!room) throw new Error('Room not found');

    if (!room.votes) room.votes = {};
    if (!room.votes[userId]) room.votes[userId] = {};

    votes.forEach(vote => {
        room.votes[userId][vote.shopId] = updateVoteEntry(room.votes[userId][vote.shopId], vote.score);
    });

    await saveRoom(roomId, room);
}

export function updateVoteEntry(existing: VoteEntry | undefined, score: VoteType): VoteEntry {
    if (score === NG_SCORE) {
        return { sum: 0, count: 0, lastScore: score, ng: true };
    }

    if (typeof existing === 'number') {
        if (existing === NG_SCORE) {
            return { sum: score, count: 1, lastScore: score, ng: false };
        }
        return { sum: existing + score, count: 2, lastScore: score, ng: false };
    }

    if (!existing || existing.ng) {
        return { sum: score, count: 1, lastScore: score, ng: false };
    }

    return {
        sum: (existing.sum || 0) + score,
        count: (existing.count || 0) + 1,
        lastScore: score,
        ng: false
    };
}
