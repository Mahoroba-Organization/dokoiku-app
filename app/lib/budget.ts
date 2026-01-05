export type BudgetRange = { min: number; max: number };

const MAX_BUDGET = Number.MAX_SAFE_INTEGER;

const BUDGET_CODE_RANGES: Array<{ code: string; min: number; max: number }> = [
    { code: 'B001', min: 0, max: 500 },
    { code: 'B002', min: 501, max: 1000 },
    { code: 'B003', min: 1001, max: 1500 },
    { code: 'B004', min: 1501, max: 2000 },
    { code: 'B005', min: 2001, max: 3000 },
    { code: 'B006', min: 3001, max: 4000 },
    { code: 'B007', min: 4001, max: 5000 },
    { code: 'B008', min: 5001, max: 7000 },
    { code: 'B009', min: 7001, max: 10000 },
    { code: 'B010', min: 10001, max: 15000 }
];

export function normalizeBudgetRange(
    minBudget?: number,
    maxBudget?: number
): BudgetRange | null {
    if (typeof minBudget !== 'number' && typeof maxBudget !== 'number') return null;
    const min = typeof minBudget === 'number' ? minBudget : 0;
    const max = typeof maxBudget === 'number' ? maxBudget : MAX_BUDGET;
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    if (min > max) return { min: max, max: min };
    return { min, max };
}

export function getBudgetCodesForRange(range: BudgetRange | null): string[] {
    if (!range) return [];
    return BUDGET_CODE_RANGES.filter(codeRange =>
        codeRange.max >= range.min && codeRange.min <= range.max
    ).map(codeRange => codeRange.code);
}

function parseBudgetRange(name: string): BudgetRange | null {
    const normalized = name.replace(/,/g, '').replace(/\s/g, '');
    const numbers = normalized.match(/\d+/g)?.map(Number) ?? [];
    if (numbers.length === 0) return null;

    const hasRange = /[～〜~]/.test(normalized);
    if (numbers.length >= 2) {
        return { min: numbers[0], max: numbers[1] };
    }

    if (hasRange) {
        if (normalized.startsWith('～') || normalized.startsWith('〜') || normalized.startsWith('~')) {
            return { min: 0, max: numbers[0] };
        }
        if (normalized.endsWith('～') || normalized.endsWith('〜') || normalized.endsWith('~')) {
            return { min: numbers[0], max: MAX_BUDGET };
        }
    }

    return { min: numbers[0], max: numbers[0] };
}

export function filterShopsByBudgetRange<T extends { budget?: { name?: string } }>(
    shops: T[],
    range: BudgetRange | null
): T[] {
    if (!range) return shops;
    return shops.filter(shop => {
        const name = shop.budget?.name;
        if (!name) return true;
        const parsed = parseBudgetRange(name);
        if (!parsed) return true;
        return parsed.max >= range.min && parsed.min <= range.max;
    });
}
