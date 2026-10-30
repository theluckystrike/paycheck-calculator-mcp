// Federal fixtures. Expected values are hand-computed from the "base plus rate of the excess"
// rows printed in Rev. Proc. 2024-40 / 2025-32 and the Pub. 15 wage bases, not from the code's tables.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateTakeHome, salaryToHourly, hourlyToSalary, getFederalBrackets, compareStates, InputError } from "../dist/core.js";

const S = "single", J = "married_filing_jointly", M = "married_filing_separately", H = "head_of_household";
const tx = (o) => calculateTakeHome({ state: "TX", ...o });

test("F01 2026 single $75,000 in Texas: taxable 58,900 -> 5,800 + 22% x 8,500 = 7,670; net 61,592.50", () => {
  const r = tx({ filing_status: S, tax_year: 2026, gross_annual: 75000 });
  assert.equal(r.federal.taxable_income, 58900);
  assert.equal(r.federal.income_tax, 7670);
  assert.equal(r.federal.social_security, 4650);
  assert.equal(r.federal.medicare, 1087.5);
  assert.equal(r.net.annual, 61592.5);
  assert.equal(r.net.per_period, 2368.94);
});

test("F02 2025 single $60,000: OBBBA std ded 15,750 -> taxable 44,250 -> 1,192.50 + 12% x 32,325 = 5,071.50", () => {
  const r = tx({ filing_status: S, tax_year: 2025, gross_annual: 60000 });
  assert.equal(r.federal.standard_deduction, 15750);
  assert.equal(r.federal.income_tax, 5071.5);
});

test("F03 2026 joint $150,000: taxable 117,800 -> 11,600 + 22% x 17,000 = 15,340", () => {
  assert.equal(tx({ filing_status: J, tax_year: 2026, gross_annual: 150000 }).federal.income_tax, 15340);
});

test("F04 2026 head of household $90,000: taxable 65,850 -> 1,770 + 12% x 48,150 = 7,548", () => {
  assert.equal(tx({ filing_status: H, tax_year: 2026, gross_annual: 90000 }).federal.income_tax, 7548);
});

test("F05 2026 single $250,000: SS capped at 184,500 x 6.2% = 11,439; Medicare 3,625; Additional 50,000 x 0.9% = 450", () => {
  const f = tx({ filing_status: S, tax_year: 2026, gross_annual: 250000 }).federal;
  assert.equal(f.social_security, 11439);
  assert.equal(f.medicare, 3625);
  assert.equal(f.additional_medicare, 450);
});

test("F06 2025 wage base: $200,000 -> SS 176,100 x 6.2% = 10,918.20", () => {
  assert.equal(tx({ filing_status: S, tax_year: 2025, gross_annual: 200000 }).federal.social_security, 10918.2);
});

test("F07 joint $300,000: Additional Medicare liability 450 over $250,000; employer withholds 900 over $200,000", () => {
  const f = tx({ filing_status: J, tax_year: 2026, gross_annual: 300000 }).federal;
  assert.equal(f.additional_medicare, 450);
  assert.equal(f.additional_medicare_employer_withholding, 900);
});

test("F08 married filing separately $150,000: Additional Medicare over $125,000 = 225", () => {
  assert.equal(tx({ filing_status: M, tax_year: 2026, gross_annual: 150000 }).federal.additional_medicare, 225);
});

test("F09 401(k) $7,500 lowers income tax (taxable 51,400 -> 6,020) but not FICA (SS stays 4,650)", () => {
  const r = tx({ filing_status: S, tax_year: 2026, gross_annual: 75000, pretax_401k_annual: 7500 });
  assert.equal(r.federal.income_tax, 6020);
  assert.equal(r.federal.social_security, 4650);
  assert.equal(r.net.annual, 75000 - 6020 - 4650 - 1087.5 - 7500);
});

test("F10 payroll HSA $3,000 lowers FICA: SS 72,000 x 6.2% = 4,464; Medicare 1,044; income tax 7,010", () => {
  const f = tx({ filing_status: S, tax_year: 2026, gross_annual: 75000, hsa_annual: 3000 }).federal;
  assert.equal(f.social_security, 4464);
  assert.equal(f.medicare, 1044);
  assert.equal(f.income_tax, 7010);
});

test("F11 2026 single $1,000,000: taxable 983,900 -> 192,979.25 + 37% x 343,300 = 320,000.25", () => {
  assert.equal(tx({ filing_status: S, tax_year: 2026, gross_annual: 1000000 }).federal.income_tax, 320000.25);
});

test("F12 per-period input: $2,500 biweekly = $65,000 a year; pay below std deduction owes no income tax", () => {
  assert.equal(tx({ filing_status: S, tax_year: 2026, gross_per_period: 2500, pay_frequency: "biweekly" }).gross.annual, 65000);
  assert.equal(tx({ filing_status: S, tax_year: 2026, gross_annual: 16000 }).federal.income_tax, 0);
});

test("F13 salary_to_hourly: $62,400 / 2,080 h = $30.00", () => {
  const r = salaryToHourly({ annual_salary: 62400 });
  assert.equal(r.hourly, 30);
  assert.equal(r.biweekly, 2400);
});

test("F14 hourly_to_salary: $25 x 40 h + 5 OT h at 1.5x = $1,187.50 a week, $61,750 a year", () => {
  const r = hourlyToSalary({ hourly_rate: 25, overtime_hours_per_week: 5 });
  assert.equal(r.weekly, 1187.5);
  assert.equal(r.annual_salary, 61750);
});

test("F15 get_federal_tax_brackets 2025 MFS: top bracket 37% over $375,800 with base $101,077.25; std ded 15,750", () => {
  const r = getFederalBrackets(2025, M);
  const top = r.brackets[r.brackets.length - 1];
  assert.equal(top.over, 375800);
  assert.equal(top.tax_on_lower_brackets, 101077.25);
  assert.equal(top.up_to, null);
  assert.equal(r.standard_deduction, 15750);
  assert.equal(getFederalBrackets(2026, J).brackets[1].over, 24800);
});

test("F16 table bases are consistent: 2026 single base at 640,600 equals the sum of lower slices", () => {
  const b = getFederalBrackets(2026, S).brackets;
  for (let i = 1; i < b.length; i++) {
    const expect = b[i - 1].tax_on_lower_brackets + b[i - 1].rate * (b[i].over - b[i - 1].over);
    assert.ok(Math.abs(expect - b[i].tax_on_lower_brackets) < 0.01, `row ${i}`);
  }
});

test("F17 input errors are helpful", () => {
  assert.throws(() => tx({ filing_status: S, tax_year: 2026 }), InputError);
  assert.throws(() => calculateTakeHome({ state: "ZZ", filing_status: S, tax_year: 2026, gross_annual: 1 }), /Unknown state/);
  assert.throws(() => tx({ filing_status: S, tax_year: 2026, gross_annual: 1000, pretax_401k_annual: 2000 }), InputError);
  assert.throws(() => compareStates({ states: ["TX"], filing_status: S, tax_year: 2026, gross_annual: 1 }), InputError);
});

test("F18 no-tax and estimate states are labeled; Texas ranks above Oregon", () => {
  const r = compareStates({ states: ["OR", "TX", "WA"], filing_status: S, tax_year: 2026, gross_annual: 80000 });
  const byState = Object.fromEntries(r.states.map((x) => [x.state, x]));
  assert.equal(byState.TX.method, "no_wage_income_tax");
  assert.equal(byState.OR.method, "estimate");
  assert.equal(byState.OR.state_income_tax, 6400);
  assert.equal(r.states[2].state, "OR");
});
