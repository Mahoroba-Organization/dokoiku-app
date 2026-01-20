import {
    computeEloRatings,
    getTopKShopIds,
    getBoundaryDelta,
    TOP_BOUNDARY_DELTA,
    TOP_TARGET_COUNT,
    TOP_MISSING_PAIR_LIMIT,
    getMissingTopPairs,
    TOP_FOCUS_COUNT,
    ELO_K
} from './app/lib/elo';

interface Shop {
    id: string;
    name: string;
    trueRating: number;
}

interface Comparison {
    a: string;
    b: string;
    result: 'a' | 'b' | 'tie';
}

const SHOP_COUNT = 30;
const TOP_K = TOP_TARGET_COUNT;
const FOCUS_K = TOP_FOCUS_COUNT;

function generateShops(count: number): Shop[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `shop-${i}`,
        name: `Shop ${i}`,
        trueRating: 1200 - i * 10
    }));
}

function simulate3WayComparison(shopA: Shop, shopB: Shop, shopC: Shop): Comparison[] {
    const items = [shopA, shopB, shopC].sort((a, b) => b.trueRating - a.trueRating);
    const comparisons: Comparison[] = [];
    for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
            comparisons.push({
                a: items[i].id,
                b: items[j].id,
                result: 'a'
            });
        }
    }
    return comparisons;
}

function runSimulation() {
    console.log(`--- [K=${ELO_K}] Updated 3-Shop Evaluation Simulation Start ---`);
    console.log(`Shops: ${SHOP_COUNT}, Top-K: ${TOP_K}, Focus-K: ${FOCUS_K}`);
    console.log(`Target Boundary Delta: ${TOP_BOUNDARY_DELTA}`);

    const shops = generateShops(SHOP_COUNT);
    const shopIds = shops.map(s => s.id);
    const comparisons: Comparison[] = [];
    const excludedIds = new Set<string>();

    let rounds = 0;
    let stable = false;

    // Phase 1: Initial pass (Unseen shops)
    const unseen = [...shopIds];
    while (unseen.length >= 3) {
        const idA = unseen.shift()!;
        const idB = unseen.shift()!;
        const idC = unseen.shift()!;
        comparisons.push(...simulate3WayComparison(
            shops.find(s => s.id === idA)!,
            shops.find(s => s.id === idB)!,
            shops.find(s => s.id === idC)!
        ));
        rounds++;
    }

    // Phase 2: Refinement pass focusing on Top-10
    while (rounds < 1000 && !stable) {
        const ratings = computeEloRatings(shopIds, comparisons, excludedIds);
        const topIds = getTopKShopIds(ratings, TOP_K);
        const focusIds = getTopKShopIds(ratings, FOCUS_K);
        const missingTopPairs = getMissingTopPairs(topIds, comparisons);
        const boundaryDelta = getBoundaryDelta(ratings, TOP_K);

        const hasMissingPairs = missingTopPairs.length > TOP_MISSING_PAIR_LIMIT;
        const deltaStable = boundaryDelta !== null && boundaryDelta >= TOP_BOUNDARY_DELTA;

        if (!hasMissingPairs && deltaStable) {
            stable = true;
            break;
        }

        let nextAId: string, nextBId: string;
        if (hasMissingPairs) {
            const pair = missingTopPairs[0];
            nextAId = pair.a;
            nextBId = pair.b;
        } else {
            const sorted = Array.from(ratings.entries()).sort((a, b) => b[1] - a[1]);
            nextAId = sorted[TOP_K - 1][0];
            nextBId = sorted[TOP_K][0];
        }

        const others = focusIds.filter(id => id !== nextAId && id !== nextBId);
        let nextCId: string;
        if (others.length > 0) {
            nextCId = others[Math.floor(Math.random() * others.length)];
        } else {
            const fallback = shopIds.filter(id => id !== nextAId && id !== nextBId);
            nextCId = fallback[Math.floor(Math.random() * fallback.length)];
        }

        comparisons.push(...simulate3WayComparison(
            shops.find(s => s.id === nextAId)!,
            shops.find(s => s.id === nextBId)!,
            shops.find(s => s.id === nextCId)!
        ));
        rounds++;
    }

    const finalRatings = computeEloRatings(shopIds, comparisons, excludedIds);
    const finalTopIds = getTopKShopIds(finalRatings, TOP_K);
    const finalDelta = getBoundaryDelta(finalRatings, TOP_K);

    console.log(`\n--- Results (K=${ELO_K}) ---`);
    console.log(`Total Rounds (3-shop evaluation sets): ${rounds}`);
    console.log(`Total Pairwise Comparisons recorded: ${comparisons.length}`);
    console.log(`Final Boundary Delta: ${finalDelta?.toFixed(2)}`);
    console.log(`Final Top-5: ${finalTopIds.join(', ')}`);

    const trueTop5 = shops.slice(0, 5).map(s => s.id);
    const correctCount = finalTopIds.filter(id => trueTop5.includes(id)).length;
    console.log(`Accuracy (True Top-5 Match): ${correctCount}/5`);
}

runSimulation();
