// State income tax on wages. Ten states use exact 2026 schedules (states-exact.ts);
// the rest use statewage.com's single-rate estimate and say so.
import { Filing, TaxYear, InputError, cents } from "./federal.js";
import { STATE_ROWS, StateRow } from "./state-table.js";
import { EXACT, ExactState } from "./states-exact.js";

export type Method = "exact" | "estimate" | "no_wage_income_tax";

export interface StateResult {
  state: string; method: Method; rules_year: number; taxable_income: number; tax: number;
  marginal_rate: number | null; steps: string[]; notes: string[]; source: string;
}

export interface StateInput { gross: number; k401: number; hsa: number; filing: Filing; year: TaxYear }

const BY_ABBR = new Map(STATE_ROWS.map((r) => [r.abbr, r]));
const ALIASES = new Map<string, string>();
for (const r of STATE_ROWS) {
  ALIASES.set(r.abbr.toLowerCase(), r.abbr);
  ALIASES.set(r.name.toLowerCase(), r.abbr);
  ALIASES.set(r.slug, r.abbr);
}
ALIASES.set("washington dc", "DC"); ALIASES.set("d.c.", "DC"); ALIASES.set("washington, dc", "DC");

export const STATE_CODES = STATE_ROWS.map((r) => r.abbr);
export const EXACT_STATES = Object.keys(EXACT).filter((k) => !EXACT[k].unverified);
export const SCHEDULE_ESTIMATE_STATES = Object.keys(EXACT).filter((k) => EXACT[k].unverified);

export function findState(s: string): StateRow {
  const abbr = ALIASES.get(String(s ?? "").trim().toLowerCase());
  if (!abbr) throw new InputError(`Unknown state "${s}". Use a two-letter code (CA), a name (California) or DC.`);
  return BY_ABBR.get(abbr)!;
}

/** Apply a schedule given as [over, rate] rows. Returns tax and marginal rate. */
export function schedule(taxable: number, rows: Array<[number, number]>): { tax: number; marginal: number } {
  let tax = 0, marginal = rows[0][1];
  for (let i = 0; i < rows.length; i++) {
    const [over, rate] = rows[i];
    if (taxable <= over) break;
    const top = i + 1 < rows.length ? Math.min(taxable, rows[i + 1][0]) : taxable;
    tax += (top - over) * rate;
    marginal = rate;
  }
  return { tax, marginal };
}

const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function estimate(row: StateRow, inp: StateInput): StateResult {
  const base = Math.max(0, inp.gross - inp.k401 - inp.hsa);
  const tax = cents(base * row.rate);
  return {
    state: row.abbr, method: "estimate", rules_year: 2026, taxable_income: cents(base), tax, marginal_rate: null,
    steps: [`Estimate: ${money(base)} wages after pre-tax 401(k) and HSA x ${(row.rate * 100).toFixed(2)}% = ${money(tax)}.`],
    notes: [
      row.kind === "flat"
        ? `${row.name} has a flat rate, but this estimate ignores its deductions, exemptions and credits, so it runs a little high.`
        : `${row.name} uses graduated brackets. This is a single effective-rate estimate at typical incomes, not the bracket calculation.`,
      row.note,
    ],
    source: `https://statewage.com/states/${row.slug}/`,
  };
}

export function stateTax(abbr: string, inp: StateInput): StateResult {
  const row = BY_ABBR.get(abbr);
  if (!row) throw new InputError(`Unknown state ${abbr}.`);
  if (row.kind === "none") {
    return {
      state: abbr, method: "no_wage_income_tax", rules_year: 2026, taxable_income: 0, tax: 0, marginal_rate: 0,
      steps: [`${row.name} does not tax wage income.`], notes: [row.note], source: `https://statewage.com/states/${row.slug}/`,
    };
  }
  const ex: ExactState | undefined = EXACT[abbr];
  if (!ex) return estimate(row, inp);
  const r = ex.compute(inp);
  const notes = [...ex.notes];
  let method: Method = "exact";
  if (ex.unverified) {
    method = "estimate";
    notes.unshift(ex.unverified);
  }
  if (inp.year !== 2026) {
    method = "estimate";
    notes.unshift(`Tax year ${inp.year} requested, but only ${row.name}'s 2026 schedule is loaded, so this figure is an estimate for ${inp.year}.`);
  }
  return { state: abbr, method, rules_year: 2026, taxable_income: cents(r.taxable), tax: cents(r.tax), marginal_rate: r.marginal, steps: r.steps, notes, source: ex.source };
}
