// Exact 2026 state income tax on wages for ten states, copied from each state's revenue
// department on 2026-10-30. See DATA_SOURCES.md for every URL and quote.
// Rows are [over, rate]: income over `over` (up to the next row) is taxed at `rate`.
import type { Filing, TaxYear } from "./federal.js";

export interface ExactInput { gross: number; k401: number; hsa: number; filing: Filing; year: TaxYear }
export interface ExactOut { taxable: number; tax: number; marginal: number; steps: string[] }
export interface ExactState {
  source: string; notes: string[]; compute: (i: ExactInput) => ExactOut;
  /** Set when the schedule could not be confirmed from a document fetched this session: the result is labeled an estimate. */
  unverified?: string;
}

type Rows = Array<[number, number]>;
const m = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const p = (r: number) => `${+(r * 100).toFixed(3)}%`;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function sched(taxable: number, rows: Rows): { tax: number; marginal: number } {
  let tax = 0, marginal = rows[0][1];
  for (let i = 0; i < rows.length; i++) {
    const [over, rate] = rows[i];
    if (taxable <= over) break;
    const top = i + 1 < rows.length ? Math.min(taxable, rows[i + 1][0]) : taxable;
    tax += (top - over) * rate;
    marginal = rate;
  }
  return { tax: r2(tax), marginal };
}

const joint = (f: Filing) => f === "married_filing_jointly";

// ---------------- California: FTB Tax News Oct 2026 "2026 Indexing" ----------------
const CA_X: Rows = [[0, 0.01], [11456, 0.02], [27157, 0.04], [42861, 0.06], [59498, 0.08], [75197, 0.093], [384109, 0.103], [460927, 0.113], [768213, 0.123]];
const CA_Y: Rows = [[0, 0.01], [22912, 0.02], [54314, 0.04], [85722, 0.06], [118996, 0.08], [150394, 0.093], [768218, 0.103], [921854, 0.113], [1536426, 0.123]];
const CA_Z: Rows = [[0, 0.01], [22927, 0.02], [54316, 0.04], [70018, 0.06], [86654, 0.08], [102356, 0.093], [522385, 0.103], [626864, 0.113], [1044771, 0.123]];
// 2026 phase-out thresholds are not published yet (FTB: "late December"); 2025 Form 540 values are used.
const CA_PHASEOUT: Record<Filing, number> = { single: 252203, married_filing_separately: 252203, married_filing_jointly: 504411, head_of_household: 378310 };

function california(i: ExactInput): ExactOut {
  const agi = Math.max(0, i.gross - i.k401); // HSA is not excluded in California
  const std = joint(i.filing) || i.filing === "head_of_household" ? 11800 : 5900;
  const taxable = Math.max(0, agi - std);
  const rows = joint(i.filing) ? CA_Y : i.filing === "head_of_household" ? CA_Z : CA_X;
  const t = sched(taxable, rows);
  const credits = joint(i.filing) ? 2 : 1;
  const step = i.filing === "married_filing_separately" ? 1250 : 2500;
  const over = agi - CA_PHASEOUT[i.filing];
  const cut = over > 0 ? Math.ceil(over / step) * 6 : 0;
  const credit = Math.max(0, 158 - cut) * credits;
  const bhst = taxable > 1_000_000 ? r2((taxable - 1_000_000) * 0.01) : 0;
  const tax = r2(Math.max(0, t.tax - credit) + bhst);
  return {
    taxable, tax, marginal: t.marginal + (bhst > 0 ? 0.01 : 0),
    steps: [
      `CA AGI ${m(agi)} = wages minus 401(k); California does not exclude HSA contributions.`,
      `Taxable ${m(taxable)} after the ${m(std)} standard deduction; 2026 schedule tax ${m(t.tax)}.`,
      `Minus personal exemption credit ${m(credit)} (${credits} x $158${cut ? `, less $${cut} phase-out` : ""}).`,
      ...(bhst ? [`Plus 1% Behavioral Health Services Tax on taxable income over $1,000,000: ${m(bhst)}.`] : []),
    ],
  };
}

// ---------------- New York: IT-2105-I (2026) rate schedules and recapture worksheets ----------------
// NY prints whole-dollar base amounts ("$332 plus 4.40% of the excess over $8,500"), so the
// schedule is applied in that base-plus-rate form: [over, rate, base].
type BRows = Array<[number, number, number]>;
const NY_S: BRows = [[0, 0.039, 0], [8500, 0.044, 332], [11700, 0.0515, 473], [13900, 0.054, 586], [80650, 0.059, 4191], [215400, 0.0685, 12141], [1077550, 0.0965, 71198], [5e6, 0.103, 449714], [25e6, 0.109, 2509714]];
const NY_J: BRows = [[0, 0.039, 0], [17150, 0.044, 669], [23600, 0.0515, 953], [27900, 0.054, 1174], [161550, 0.059, 8391], [323200, 0.0685, 17928], [2155350, 0.0965, 143430], [5e6, 0.103, 417939], [25e6, 0.109, 2477939]];
const NY_H: BRows = [[0, 0.039, 0], [12800, 0.044, 499], [17650, 0.0515, 712], [20900, 0.054, 879], [107650, 0.059, 5564], [269300, 0.0685, 15101], [1616450, 0.0965, 107381], [5e6, 0.103, 433894], [25e6, 0.109, 2493894]];
function bsched(taxable: number, rows: BRows): { tax: number; marginal: number } {
  if (!(taxable > 0)) return { tax: 0, marginal: rows[0][1] };
  let row = rows[0];
  for (const r of rows) if (taxable > r[0]) row = r;
  return { tax: r2(row[2] + row[1] * (taxable - row[0])), marginal: row[1] };
}
// [threshold, recapture base, incremental benefit]
const NY_RECAP: Record<"s" | "j" | "h", Array<[number, number, number]>> = {
  s: [[215400, 567, 2047], [1077550, 2614, 30172], [5e6, 32786, 32500]],
  j: [[161550, 333, 807], [323200, 1140, 3071], [2155350, 4211, 60350], [5e6, 64561, 32500]],
  h: [[269300, 787, 2559], [1616450, 3346, 45260], [5e6, 48606, 32500]],
};
const NY_STD: Record<Filing, number> = { single: 8000, married_filing_separately: 8000, married_filing_jointly: 16050, head_of_household: 11200 };

function newYork(i: ExactInput): ExactOut {
  const agi = Math.max(0, i.gross - i.k401 - i.hsa);
  const taxable = Math.max(0, agi - NY_STD[i.filing]);
  const k = joint(i.filing) ? "j" : i.filing === "head_of_household" ? "h" : "s";
  const rows = k === "j" ? NY_J : k === "h" ? NY_H : NY_S;
  const t = bsched(taxable, rows);
  const steps = [`NY AGI ${m(agi)} = wages minus 401(k) and HSA; taxable ${m(taxable)} after the ${m(NY_STD[i.filing])} standard deduction; rate-schedule tax ${m(t.tax)}.`];
  let tax = t.tax;
  if (agi > 25e6) {
    tax = r2(taxable * 0.109);
    steps.push(`NY AGI over $25,000,000: all taxable income at 10.9% = ${m(tax)}.`);
  } else if (agi > 107650) {
    const recap = NY_RECAP[k];
    if (taxable <= recap[0][0]) {
      const flatRate = k === "j" ? 0.054 : 0.059;
      const flat = r2(taxable * flatRate);
      if (agi >= 157650) tax = flat;
      else tax = r2(t.tax + (flat - t.tax) * round4((agi - 107650) / 50000));
      steps.push(`NY AGI over $107,650: tax-benefit recapture phases toward ${p(flatRate)} of all taxable income (${m(flat)}); tax ${m(tax)}.`);
    } else {
      let row = recap[0];
      for (const r of recap) if (taxable > r[0]) row = r;
      const add = row[1] + row[2] * round4(Math.min(agi - row[0], 50000) / 50000);
      tax = r2(t.tax + add);
      steps.push(`Supplemental tax (recapture) above ${m(row[0])}: ${m(row[1])} base + ${m(row[2])} incremental benefit, prorated = ${m(r2(add))}; tax ${m(tax)}.`);
    }
  }
  return { taxable, tax, marginal: t.marginal, steps };
}

// ---------------- New Jersey: 2026 NJ-1040-ES, Tables A and B ----------------
const NJ_A: Rows = [[0, 0.014], [20000, 0.0175], [35000, 0.035], [40000, 0.05525], [75000, 0.0637], [500000, 0.0897], [1e6, 0.1075]];
const NJ_B: Rows = [[0, 0.014], [20000, 0.0175], [50000, 0.0245], [70000, 0.035], [80000, 0.05525], [150000, 0.0637], [500000, 0.0897], [1e6, 0.1075]];

function newJersey(i: ExactInput): ExactOut {
  const income = Math.max(0, i.gross - i.k401); // NJ excludes 401(k) up to the federal limit; HSA payroll money stays taxable
  const ex = joint(i.filing) ? 2000 : 1000;
  const taxable = Math.max(0, income - ex);
  const tableB = joint(i.filing) || i.filing === "head_of_household";
  const t = sched(taxable, tableB ? NJ_B : NJ_A);
  return {
    taxable, tax: t.tax, marginal: t.marginal,
    steps: [`NJ gross income ${m(income)} = wages minus 401(k) (HSA not excluded). Minus ${m(ex)} personal exemption(s) = ${m(taxable)}. Table ${tableB ? "B" : "A"} tax ${m(t.tax)}.`],
  };
}

// ---------------- Illinois: IL-700-T (2026), Bulletin FY 2026-15 ----------------
function illinois(i: ExactInput): ExactOut {
  const agi = Math.max(0, i.gross - i.k401 - i.hsa);
  const n = joint(i.filing) ? 2 : 1;
  const cliff = joint(i.filing) ? 500000 : 250000;
  const ex = agi > cliff ? 0 : 2925 * n;
  const taxable = Math.max(0, agi - ex);
  const tax = r2(taxable * 0.0495);
  return {
    taxable, tax, marginal: 0.0495,
    steps: [`IL base ${m(agi)} (federal AGI: wages minus 401(k) and HSA) minus ${ex ? `${n} x $2,925 exemption` : `no exemption (AGI over ${m(cliff)})`} = ${m(taxable)} x 4.95% = ${m(tax)}.`],
  };
}

// ---------------- Pennsylvania: 3.07%, no deductions, 401(k) taxable ----------------
function pennsylvania(i: ExactInput): ExactOut {
  const taxable = Math.max(0, i.gross - i.hsa);
  const tax = r2(taxable * 0.0307);
  return { taxable, tax, marginal: 0.0307, steps: [`PA compensation ${m(taxable)} (401(k) deferrals stay taxable; HSA follows federal rules) x 3.07% = ${m(tax)}.`] };
}


// ---------------- Georgia: 2026 Employer's Tax Guide (June 2026), HB 463 ----------------
function flatAfter(name: string, rate: number, std: number, exempt: number, i: ExactInput, why: string): ExactOut {
  const agi = Math.max(0, i.gross - i.k401 - i.hsa);
  const taxable = Math.max(0, agi - std - exempt);
  const tax = r2(taxable * rate);
  return {
    taxable, tax, marginal: rate,
    steps: [`${name} base ${m(agi)} (federal AGI: wages minus 401(k) and HSA) minus ${why} = ${m(taxable)} x ${p(rate)} = ${m(tax)}.`],
  };
}
function georgia(i: ExactInput): ExactOut {
  const std = joint(i.filing) ? 30000 : 15000;
  return flatAfter("GA", 0.0499, std, 0, i, `the ${m(std)} standard deduction`);
}

// ---------------- North Carolina: NC-30 (2026), ncdor.gov tax rate schedules ----------------
const NC_STD: Record<Filing, number> = { single: 12750, married_filing_separately: 12750, married_filing_jointly: 25500, head_of_household: 19125 };
function northCarolina(i: ExactInput): ExactOut {
  return flatAfter("NC", 0.0399, NC_STD[i.filing], 0, i, `the ${m(NC_STD[i.filing])} standard deduction`);
}

// ---------------- Michigan: 4.25%, $5,900 exemption (Form 446, 2026) ----------------
function michigan(i: ExactInput): ExactOut {
  const n = joint(i.filing) ? 2 : 1;
  return flatAfter("MI", 0.0425, 0, 5900 * n, i, `${n} x $5,900 personal exemption`);
}

// ---------------- Virginia: 2% / 3% / 5% / 5.75%, std ded $8,750 / $17,500, $930 exemption ----------------
const VA: Rows = [[0, 0.02], [3000, 0.03], [5000, 0.05], [17000, 0.0575]];
function virginia(i: ExactInput): ExactOut {
  const agi = Math.max(0, i.gross - i.k401 - i.hsa);
  const n = joint(i.filing) ? 2 : 1;
  const std = joint(i.filing) ? 17500 : 8750;
  const taxable = Math.max(0, agi - std - 930 * n);
  const t = sched(taxable, VA);
  return { taxable, tax: t.tax, marginal: t.marginal, steps: [`VA AGI ${m(agi)} minus ${m(std)} standard deduction and ${n} x $930 exemption = ${m(taxable)}; tax ${m(t.tax)}.`] };
}

// ---------------- Ohio: R.C. 5747.02 as amended by H.B. 96 (2026: $332 + 2.75% over $26,050) ----------------
function ohio(i: ExactInput): ExactOut {
  const agi = Math.max(0, i.gross - i.k401 - i.hsa);
  const n = joint(i.filing) ? 2 : 1;
  const per = agi >= 500000 ? 0 : agi <= 40000 ? 2400 : agi <= 80000 ? 2150 : 1900;
  const taxable = Math.max(0, agi - per * n);
  const tax = taxable <= 26050 ? 0 : r2(332 + 0.0275 * (taxable - 26050));
  return { taxable, tax, marginal: taxable <= 26050 ? 0 : 0.0275, steps: [`OH AGI ${m(agi)} minus ${n} x ${m(per)} exemption = ${m(taxable)}; ${taxable <= 26050 ? "no tax at or below $26,050" : `$332 + 2.75% of the excess over $26,050 = ${m(tax)}`}. Joint filing and $20 exemption credits not applied.`] };
}

export const EXACT: Record<string, ExactState> = {
  CA: {
    compute: california,
    source: "https://www.ftb.ca.gov/about-ftb/newsroom/tax-news/2026/10.html",
    notes: [
      "2026 rate schedules X, Y and Z, standard deduction ($5,900 / $11,800) and exemption credit ($158 / $316) from FTB's 2026 indexing notice.",
      "The exemption credit phase-out uses the 2025 Form 540 thresholds; FTB publishes the 2026 ones in late December.",
      "California does not recognize HSAs, so payroll HSA money is taxed. SDI (1.3% of wages) is a payroll tax and is not included.",
      "Dependent credits ($491 each) and other credits are not included.",
    ],
  },
  NY: {
    compute: newYork,
    source: "https://www.tax.ny.gov/pdf/current_forms/it/it2105i.pdf",
    notes: [
      "2026 rates cut by Chapter 59 of the Laws of 2025 (first five brackets 3.9% to 5.9%), with the tax-benefit recapture worksheets for NY AGI over $107,650.",
      "New York City and Yonkers income taxes are local and are not included.",
      "No personal exemption for yourself or a spouse; $1,000 per dependent is not included.",
    ],
  },
  NJ: {
    compute: newJersey,
    source: "https://www.nj.gov/treasury/taxation/pdf/current/1040esi.pdf",
    notes: [
      "2026 Table A (single, separate) or Table B (joint, head of household) and the $1,000 personal exemption per filer. New Jersey has no standard deduction.",
      "401(k) deferrals are excluded up to the federal limit (NJ-WT). HSA payroll contributions are treated as taxable: New Jersey excludes only Archer MSA contributions. This HSA point is inferred, not stated by the Division of Taxation.",
      "Employee SUI, DI and FLI payroll contributions are not included.",
    ],
  },
  IL: {
    compute: illinois,
    source: "https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/withholding/documents/currentyear/il-700-t.pdf",
    notes: [
      "Flat 4.95% after the 2026 exemption of $2,925 per person. The exemption is lost entirely above $250,000 AGI ($500,000 joint).",
      "Illinois starts from federal AGI, so 401(k) and HSA payroll contributions reduce the base.",
    ],
  },
  PA: {
    compute: pennsylvania,
    source: "https://www.pa.gov/agencies/revenue/resources/tax-rates",
    notes: [
      "Flat 3.07% with no standard deduction or personal exemption.",
      "Pennsylvania taxes 401(k) deferrals as compensation. HSA contributions follow federal rules.",
      "Local earned income tax (often 1% to 3.9%) is not included.",
    ],
  },
  GA: {
    compute: georgia,
    source: "https://dor.georgia.gov/document/document/2026-employers-tax-guide-updated-june-2026/download",
    notes: [
      "Flat 4.99% for 2026 (HB 463), after the $15,000 standard deduction ($30,000 joint). Georgia has no personal exemption for the filer; $5,000 per dependent is not included.",
      "Georgia's own 2026-2028 exclusions of up to $1,750 of overtime and $1,750 of tips are not applied.",
    ],
  },
  NC: {
    compute: northCarolina,
    source: "https://www.ncdor.gov/taxes-forms/individual-income-tax/tax-rate-schedules",
    notes: [
      "Flat 3.99% for tax years after 2025, after the standard deduction ($12,750 single and separate, $25,500 joint, $19,125 head of household; NC-30 2026).",
      "Married filing separately gets $0 standard deduction if the spouse itemizes; that case is not modeled.",
    ],
  },
  MI: {
    compute: michigan,
    unverified: "Michigan's 4.25% rate and $5,900 exemption come from michigan.gov Treasury and Form 446 (2026), but michigan.gov refused direct download on 2026-10-30, so this figure is labeled an estimate until re-verified.",
    source: "https://www.michigan.gov/treasury/news/2026/04/15/state-individual-income-tax-rate-for-2026-tax-year-determined",
    notes: ["Flat 4.25% after a $5,900 personal exemption per filer. City income taxes (Detroit and others) are not included."],
  },
  VA: {
    compute: virginia,
    unverified: "Virginia's brackets (2025 table, unchanged for 2026), $8,750 / $17,500 standard deduction and $930 exemption come from tax.virginia.gov, which refused the connection on 2026-10-30, so this figure is labeled an estimate until re-verified.",
    source: "https://www.tax.virginia.gov/deductions",
    notes: ["2% to 5.75% after the standard deduction and $930 per filer. Head of household uses the single amount."],
  },
  OH: {
    compute: ohio,
    unverified: "Ohio's 2026 schedule is in conflict: R.C. 5747.02 as amended by H.B. 96 sets $332 plus 2.75% over $26,050, while the Department's 2026 IT 1040ES still prints 2.75% / 3.125%. The statute version is used; exemption tiers are the 2025 amounts (indexing suspended for 2026). Labeled an estimate.",
    source: "https://dam.assets.ohio.gov/image/upload/v1768492829/tax.ohio.gov/forms/ohio_individual/individual/2026/ites-oupc.pdf",
    notes: ["City and school district income taxes are not included."],
  },
};
