export type ComparisonResult = 'a' | 'b' | 'tie';

export type Comparison = {
    a: string;
    b: string;
    result: ComparisonResult;
};

export const ELO_BASE = 1000;
export const ELO_K = 48;
export const TOP_TARGET_COUNT = 5;
export const TOP_FOCUS_COUNT = 10;
export const TOP_BOUNDARY_DELTA = 50;
export const TOP_MISSING_PAIR_LIMIT = 0;

function expectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function computeEloRatings(
    shopIds: string[],
    comparisons: Comparison[],
    excludedIds: Set<string>
): Map<string, number> {
    const ratings = new Map<string, number>();
    shopIds.forEach(id => {
        if (!excludedIds.has(id)) ratings.set(id, ELO_BASE);
    });

    comparisons.forEach(comp => {
        if (excludedIds.has(comp.a) || excludedIds.has(comp.b)) return;
        const ratingA = ratings.get(comp.a);
        const ratingB = ratings.get(comp.b);
        if (ratingA === undefined || ratingB === undefined) return;

        const expectedA = expectedScore(ratingA, ratingB);
        const expectedB = expectedScore(ratingB, ratingA);

        const scoreA = comp.result === 'a' ? 1 : comp.result === 'b' ? 0 : 0.5;
        const scoreB = 1 - scoreA;

        ratings.set(comp.a, ratingA + ELO_K * (scoreA - expectedA));
        ratings.set(comp.b, ratingB + ELO_K * (scoreB - expectedB));
    });

    return ratings;
}

export function getTopKShopIds(ratings: Map<string, number>, k: number): string[] {
    return Array.from(ratings.entries())
        .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return a[0].localeCompare(b[0]);
        })
        .slice(0, k)
        .map(([id]) => id);
}

export function getBoundaryDelta(ratings: Map<string, number>, topCount: number): number | null {
    const sorted = Array.from(ratings.entries()).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
    });
    if (sorted.length <= topCount) return null;
    return sorted[topCount - 1][1] - sorted[topCount][1];
}

export function getMissingTopPairs(topIds: string[], comparisons: Comparison[]): Array<{ a: string; b: string }> {
    const existing = new Set(
        comparisons.map(comp => (comp.a < comp.b ? `${comp.a}|${comp.b}` : `${comp.b}|${comp.a}`))
    );
    const missing: Array<{ a: string; b: string }> = [];
    for (let i = 0; i < topIds.length; i += 1) {
        for (let j = i + 1; j < topIds.length; j += 1) {
            const a = topIds[i];
            const b = topIds[j];
            const key = a < b ? `${a}|${b}` : `${b}|${a}`;
            if (!existing.has(key)) {
                missing.push({ a, b });
            }
        }
    }
    return missing;
}

export function getBoundaryPairs(
    topIds: string[],
    nextIds: string[],
    comparisons: Comparison[]
): Array<{ a: string; b: string }> {
    const existing = new Set(
        comparisons.map(comp => (comp.a < comp.b ? `${comp.a}|${comp.b}` : `${comp.b}|${comp.a}`))
    );
    const pairs: Array<{ a: string; b: string }> = [];
    topIds.forEach(a => {
        nextIds.forEach(b => {
            const key = a < b ? `${a}|${b}` : `${b}|${a}`;
            if (!existing.has(key)) {
                pairs.push({ a, b });
            }
        });
    });
    return pairs;
}
