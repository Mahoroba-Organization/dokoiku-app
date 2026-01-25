import { RoomVotes } from './kv';
import { normalizeVote } from './vote_stats';

export type Shop = {
    id: string;
    genre?: { name?: string };
    budget?: { name?: string };
    [key: string]: any;
};

export const CANDIDATE_POOL_SIZE = 50;
export const NEGATIVE_SCORE_THRESHOLD = 30;
export const POSITIVE_SCORE_THRESHOLD = 70;
export const USER_NEG_WEIGHT = 0.35;
export const USER_POS_WEIGHT = 0.15;
export const GLOBAL_POS_WEIGHT = 0.1;
export const MIN_GENRE_WEIGHT = 0.25;
export const MAX_GENRE_WEIGHT = 1.6;

type GenreStats = {
    total: number;
    neg: number;
    pos: number;
};

type UserGenreStats = Record<string, Record<string, GenreStats>>;
type GlobalGenreStats = Record<string, GenreStats>;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function ensureStats(stats: Record<string, GenreStats>, genre: string): GenreStats {
    if (!stats[genre]) {
        stats[genre] = { total: 0, neg: 0, pos: 0 };
    }
    return stats[genre];
}

function buildGenreStats(shops: Shop[], votes: RoomVotes): { user: UserGenreStats; global: GlobalGenreStats } {
    const shopById = new Map<string, Shop>();
    shops.forEach(shop => shopById.set(shop.id, shop));

    const userStats: UserGenreStats = {};
    const globalStats: GlobalGenreStats = {};

    Object.entries(votes).forEach(([userId, userVotes]) => {
        if (!userStats[userId]) userStats[userId] = {};
        Object.entries(userVotes).forEach(([shopId, entry]) => {
            const shop = shopById.get(shopId);
            const genre = shop?.genre?.name;
            if (!genre) return;

            const stats = normalizeVote(entry);
            if (!stats || stats.ng || stats.count === 0) return;
            const avg = stats.sum / stats.count;

            const uStats = ensureStats(userStats[userId], genre);
            const gStats = ensureStats(globalStats, genre);

            uStats.total += 1;
            gStats.total += 1;

            if (avg <= NEGATIVE_SCORE_THRESHOLD) {
                uStats.neg += 1;
                gStats.neg += 1;
            }
            if (avg >= POSITIVE_SCORE_THRESHOLD) {
                uStats.pos += 1;
                gStats.pos += 1;
            }
        });
    });

    return { user: userStats, global: globalStats };
}

function getWeightForGenre(
    userId: string,
    genre: string,
    stats: { user: UserGenreStats; global: GlobalGenreStats }
): number {
    const u = stats.user[userId]?.[genre];
    const g = stats.global[genre];

    const negRate = u && u.total > 0 ? u.neg / u.total : 0;
    const posRate = u && u.total > 0 ? u.pos / u.total : 0;
    const globalPosRate = g && g.total > 0 ? g.pos / g.total : 0;

    const userWeight = 1 - USER_NEG_WEIGHT * negRate + USER_POS_WEIGHT * posRate;
    const globalWeight = 1 + GLOBAL_POS_WEIGHT * globalPosRate;

    return clamp(userWeight * globalWeight, MIN_GENRE_WEIGHT, MAX_GENRE_WEIGHT);
}

export function pickWeighted<T>(items: T[], weights: number[]): T | null {
    if (items.length === 0) return null;
    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total <= 0) {
        const fallbackIndex = Math.floor(Math.random() * items.length);
        return items[fallbackIndex] || null;
    }

    let r = Math.random() * total;
    for (let i = 0; i < items.length; i += 1) {
        r -= weights[i];
        if (r <= 0) {
            return items[i];
        }
    }

    return items[items.length - 1] || null;
}

export function selectPairByGenreBias(
    userId: string,
    candidateShops: Shop[],
    votes: RoomVotes,
    allShops: Shop[] = candidateShops
): [Shop, Shop] | null {
    if (candidateShops.length < 2) return null;
    const stats = buildGenreStats(allShops, votes);

    const weights = candidateShops.map(shop => {
        const genre = shop.genre?.name;
        if (!genre) return 1;
        return getWeightForGenre(userId, genre, stats);
    });

    const first = pickWeighted(candidateShops, weights);
    if (!first) return null;

    const remaining: Shop[] = [];
    const remainingWeights: number[] = [];
    candidateShops.forEach((shop, index) => {
        if (shop.id !== first.id) {
            remaining.push(shop);
            remainingWeights.push(weights[index]);
        }
    });

    const second = pickWeighted(remaining, remainingWeights);
    if (!second) return null;

    return [first, second];
}

export function selectSingleByGenreBias(
    userId: string,
    candidateShops: Shop[],
    votes: RoomVotes,
    allShops: Shop[] = candidateShops
): Shop | null {
    if (candidateShops.length === 0) return null;
    const stats = buildGenreStats(allShops, votes);
    const weights = candidateShops.map(shop => {
        const genre = shop.genre?.name;
        if (!genre) return 1;
        return getWeightForGenre(userId, genre, stats);
    });
    return pickWeighted(candidateShops, weights);
}
