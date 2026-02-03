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
} from './app/lib/elo.ts';

interface Shop {
    id: string;
    name: string;
    trueRatings: number[]; // Index 0: Voter 1, Index 1: Voter 2, Index 2: Voter 3
}

interface Comparison {
    a: string;
    b: string;
    result: 'a' | 'b' | 'tie';
    voterId: number;
}

const SHOP_COUNT = 30;
const TOP_K = TOP_TARGET_COUNT;
const FOCUS_K = TOP_FOCUS_COUNT;
const VOTER_COUNT = 3;

function generateShops(count: number): Shop[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `shop-${i}`,
        name: `Shop ${i}`,
        // Give each voter a different preference profile
        // Voter 0: Prefers lower index
        // Voter 1: Prefers higher index (reverse)
        // Voter 2: Prefers middle index
        trueRatings: [
            1200 - i * 10,
            1200 - (count - i) * 10,
            1200 - Math.abs(i - count / 2) * 20
        ]
    }));
}

function simulate3WayComparison(shopsInSet: Shop[], voterId: number): Comparison[] {
    const items = [...shopsInSet].sort((a, b) => b.trueRatings[voterId] - a.trueRatings[voterId]);
    const comparisons: Comparison[] = [];
    for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
            comparisons.push({
                a: items[i].id,
                b: items[j].id,
                result: 'a',
                voterId
            });
        }
    }
    return comparisons;
}

function runSimulation() {
    console.log(`--- [3-Voter Simulation] Start ---`);
    console.log(`Shops: ${SHOP_COUNT}, Voters: ${VOTER_COUNT}, Top-K: ${TOP_K}`);

    const shops = generateShops(SHOP_COUNT);
    const shopIds = shops.map(s => s.id);
    const comparisons: Comparison[] = [];
    const excludedIds = new Set<string>();

    let rounds = 0;
    let stable = false;

    // Phases: Round-robin voters
    const unseen = [...shopIds];
    let voterPtr = 0;

    // Phase 1: Initial pass
    while (unseen.length >= 3) {
        const set = [unseen.shift()!, unseen.shift()!, unseen.shift()!];
        const shopsInSet = set.map(id => shops.find(s => s.id === id)!);
        comparisons.push(...simulate3WayComparison(shopsInSet, voterPtr));
        voterPtr = (voterPtr + 1) % VOTER_COUNT;
        rounds++;
    }

    // Phase 2: Refinement
    while (rounds < 2000 && !stable) {
        const ratings = computeEloRatings(shopIds, comparisons, excludedIds);
        const topIds = getTopKShopIds(ratings, TOP_K);
        const focusIds = getTopKShopIds(ratings, FOCUS_K);
        const missingTopPairs = getMissingTopPairs(topIds, comparisons);
        const boundaryDelta = getBoundaryDelta(ratings, TOP_K);

        const hasMissingPairs = missingTopPairs.length > TOP_MISSING_PAIR_LIMIT;
        const deltaStable = boundaryDelta !== null && boundaryDelta >= TOP_BOUNDARY_DELTA;

        if (!hasMissingPairs && deltaStable && rounds > 50) { // Require some minimum rounds for group consensus
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
            nextAId = sorted[Math.min(TOP_K - 1, sorted.length - 1)][0];
            nextBId = sorted[Math.min(TOP_K, sorted.length - 1)][0];
        }

        const others = focusIds.filter(id => id !== nextAId && id !== nextBId);
        let nextCId: string;
        if (others.length > 0) {
            nextCId = others[Math.floor(Math.random() * others.length)];
        } else {
            const fallback = shopIds.filter(id => id !== nextAId && id !== nextBId);
            nextCId = fallback[Math.floor(Math.random() * fallback.length)];
        }

        const set = [nextAId, nextBId, nextCId].map(id => shops.find(s => s.id === id)!);
        comparisons.push(...simulate3WayComparison(set, voterPtr));
        voterPtr = (voterPtr + 1) % VOTER_COUNT;
        rounds++;

        if (rounds % 100 === 0) {
            console.log(`Round ${rounds}: Boundary Delta = ${boundaryDelta?.toFixed(2)}`);
        }
    }

    const finalRatings = computeEloRatings(shopIds, comparisons, excludedIds);
    const finalTopIds = getTopKShopIds(finalRatings, TOP_K);
    const finalDelta = getBoundaryDelta(finalRatings, TOP_K);

    console.log(`\n--- Results ---`);
    console.log(`Total Rounds (Group sessions): ${rounds}`);
    console.log(`Total Rounds per Voter: ${Math.floor(rounds / VOTER_COUNT)}`);
    console.log(`Total Pairwise Comparisons: ${comparisons.length}`);
    console.log(`Final Boundary Delta: ${finalDelta?.toFixed(2)}`);
    console.log(`Final Top-5: ${finalTopIds.join(', ')}`);

    // Check if the result is a reasonable consensus
    // (In this case, since preferences are very different, "consensus" might be messy)
}

runSimulation();
