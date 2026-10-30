// Federal income tax and FICA for tax years 2025 and 2026.
// Every number below was copied from irs.gov on 2026-10-30. See DATA_SOURCES.md.
export const FILING_STATUSES = ["single", "married_filing_jointly", "married_filing_separately", "head_of_household"];
export const TAX_YEARS = [2025, 2026];
export class InputError extends Error {
}
export const IRS = {
    revProc2025: "https://www.irs.gov/pub/irs-drop/rp-24-40.pdf",
    revProc2026: "https://www.irs.gov/pub/irs-drop/rp-25-32.pdf",
    pub15_2025: "https://www.irs.gov/pub/irs-prior/p15--2025.pdf",
    pub15_2026: "https://www.irs.gov/pub/irs-pdf/p15.pdf",
    topic751: "https://www.irs.gov/taxtopics/tc751",
    form8959: "https://www.irs.gov/pub/irs-pdf/i8959.pdf",
    pub15b: "https://www.irs.gov/pub/irs-pdf/p15b.pdf",
};
const T = {
    // Rev. Proc. 2024-40 section 2.01, Tables 1-4 (2025). P.L. 119-21 kept these rates.
    2025: {
        married_filing_jointly: [[0, 0.10, 0], [23850, 0.12, 2385], [96950, 0.22, 11157], [206700, 0.24, 35302], [394600, 0.32, 80398], [501050, 0.35, 114462], [751600, 0.37, 202154.5]],
        head_of_household: [[0, 0.10, 0], [17000, 0.12, 1700], [64850, 0.22, 7442], [103350, 0.24, 15912], [197300, 0.32, 38460], [250500, 0.35, 55484], [626350, 0.37, 187031.5]],
        single: [[0, 0.10, 0], [11925, 0.12, 1192.5], [48475, 0.22, 5578.5], [103350, 0.24, 17651], [197300, 0.32, 40199], [250525, 0.35, 57231], [626350, 0.37, 188769.75]],
        married_filing_separately: [[0, 0.10, 0], [11925, 0.12, 1192.5], [48475, 0.22, 5578.5], [103350, 0.24, 17651], [197300, 0.32, 40199], [250525, 0.35, 57231], [375800, 0.37, 101077.25]],
    },
    // Rev. Proc. 2025-32 section 4.01, Tables 1-4 (2026).
    2026: {
        married_filing_jointly: [[0, 0.10, 0], [24800, 0.12, 2480], [100800, 0.22, 11600], [211400, 0.24, 35932], [403550, 0.32, 82048], [512450, 0.35, 116896], [768700, 0.37, 206583.5]],
        head_of_household: [[0, 0.10, 0], [17700, 0.12, 1770], [67450, 0.22, 7740], [105700, 0.24, 16155], [201750, 0.32, 39207], [256200, 0.35, 56631], [640600, 0.37, 191171]],
        single: [[0, 0.10, 0], [12400, 0.12, 1240], [50400, 0.22, 5800], [105700, 0.24, 17966], [201775, 0.32, 41024], [256225, 0.35, 58448], [640600, 0.37, 192979.25]],
        married_filing_separately: [[0, 0.10, 0], [12400, 0.12, 1240], [50400, 0.22, 5800], [105700, 0.24, 17966], [201775, 0.32, 41024], [256225, 0.35, 58448], [384350, 0.37, 103291.75]],
    },
};
// 2025: IRC 63(c)(7) as amended by P.L. 119-21, restated in Rev. Proc. 2025-32 section 3.01
// (it removes section 2.15(1) of Rev. Proc. 2024-40). 2026: Rev. Proc. 2025-32 section 4.14.
export const STANDARD_DEDUCTION = {
    2025: { single: 15750, married_filing_jointly: 31500, married_filing_separately: 15750, head_of_household: 23625 },
    2026: { single: 16100, married_filing_jointly: 32200, married_filing_separately: 16100, head_of_household: 24150 },
};
// Publication 15 (2025) and (2026), "What's New": 6.2% each, wage base $176,100 / $184,500;
// Medicare 1.45%, no wage base. Topic 751 repeats the 2026 base.
export const SS_WAGE_BASE = { 2025: 176100, 2026: 184500 };
export const SS_RATE = 0.062;
export const MEDICARE_RATE = 0.0145;
// Form 8959 instructions: 0.9%, thresholds not indexed. Employers withhold on wages over $200,000
// regardless of filing status (Topic 751).
export const ADDL_MEDICARE_RATE = 0.009;
export const ADDL_MEDICARE_THRESHOLD = {
    single: 200000, head_of_household: 200000, married_filing_jointly: 250000, married_filing_separately: 125000,
};
export const ADDL_MEDICARE_WITHHOLDING_THRESHOLD = 200000;
export const cents = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export function federalBrackets(year, filing) {
    const rows = T[year][filing];
    return rows.map(([over, rate, base], i) => ({ over, upTo: i + 1 < rows.length ? rows[i + 1][0] : null, rate, base }));
}
/** Tax from the Rev. Proc. table: base of the bracket plus rate on the excess. */
export function federalIncomeTax(taxable, year, filing) {
    if (!(taxable > 0))
        return { tax: 0, marginal_rate: 0.10 };
    const rows = T[year][filing];
    let row = rows[0];
    for (const r of rows)
        if (taxable > r[0])
            row = r;
    return { tax: cents(row[2] + row[1] * (taxable - row[0])), marginal_rate: row[1] };
}
/** Employee FICA. HSA payroll contributions (cafeteria plan) are exempt; 401(k) deferrals are not (Pub. 15-B, Pub. 15). */
export function fica(gross, hsa, year, filing) {
    const wages = Math.max(0, gross - hsa);
    const ssWages = Math.min(wages, SS_WAGE_BASE[year]);
    const threshold = ADDL_MEDICARE_THRESHOLD[filing];
    return {
        social_security: cents(ssWages * SS_RATE),
        social_security_wages: cents(ssWages),
        social_security_wage_base: SS_WAGE_BASE[year],
        medicare: cents(wages * MEDICARE_RATE),
        additional_medicare: cents(Math.max(0, wages - threshold) * ADDL_MEDICARE_RATE),
        medicare_wages: cents(wages),
        additional_medicare_threshold: threshold,
        additional_medicare_employer_withholding: cents(Math.max(0, wages - ADDL_MEDICARE_WITHHOLDING_THRESHOLD) * ADDL_MEDICARE_RATE),
    };
}
