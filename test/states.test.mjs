// State fixtures. Expected values are hand-computed from the base-plus-rate rows each state
// prints (FTB 2026 indexing, IT-2105-I 2026, NJ-1040-ES 2026, IL-700-T 2026), not from the code's tables.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateTakeHome } from "../dist/core.js";

const st = (state, filing_status, gross_annual, extra = {}) =>
  calculateTakeHome({ state, filing_status, tax_year: 2026, gross_annual, ...extra }).state_tax;

test("S01 CA single $85,000: TI 79,100 -> 3,310.88 + 9.3% x 3,903 = 3,673.86, minus $158 credit = 3,515.86", () => {
  const s = st("CA", "single", 85000);
  assert.equal(s.method, "exact");
  assert.equal(s.tax, 3515.86);
});

test("S02 CA ignores HSA: same CA tax with a $3,000 payroll HSA", () => {
  assert.equal(st("CA", "single", 85000, { hsa_annual: 3000 }).tax, 3515.86);
});

test("S03 CA joint $150,000 with $10,000 401(k): TI 128,200 -> 4,109.92 + 8% x 9,204 - 316 = 4,530.24", () => {
  assert.equal(st("CA", "married_filing_jointly", 150000, { pretax_401k_annual: 10000 }).tax, 4530.24);
});

test("S04 CA single $1,200,000: 74,675.27 + 12.3% x 425,887 = 127,059.37, credit phased out, +1% BHST 1,941 = 129,000.37", () => {
  assert.equal(st("CA", "single", 1200000).tax, 129000.37);
});

test("S05 NY single $60,000: TI 52,000 -> $586 + 5.40% x 38,100 = 2,643.40 (2026 cut rates)", () => {
  assert.equal(st("NY", "single", 60000).tax, 2643.4);
});

test("S06 NY single $120,000: recapture phase-in 6,040.65 + (6,608 - 6,040.65) x 0.247 = 6,180.79", () => {
  assert.equal(st("NY", "single", 120000).tax, 6180.79);
});

test("S07 NY single $180,000: NY AGI >= $157,650 -> 5.9% x 172,000 = 10,148", () => {
  assert.equal(st("NY", "single", 180000).tax, 10148);
});

test("S08 NY joint $400,000: 17,928 + 6.85% x 60,750 = 22,089.375 plus recapture 1,140 + 3,071 = 26,300.38", () => {
  assert.equal(st("NY", "married_filing_jointly", 400000).tax, 26300.38);
});

test("S09 NJ single $90,000: 89,000 x 6.37% - 2,126.25 = 3,543.05", () => {
  assert.equal(st("NJ", "single", 90000).tax, 3543.05);
});

test("S10 NJ joint $120,000, $10,000 401(k), $2,000 HSA: 108,000 x 5.525% - 2,775 = 3,192 (HSA not excluded)", () => {
  assert.equal(st("NJ", "married_filing_jointly", 120000, { pretax_401k_annual: 10000, hsa_annual: 2000 }).tax, 3192);
});

test("S11 IL single $75,000: (75,000 - 2,925) x 4.95% = 3,567.71; over $250,000 the exemption is lost", () => {
  assert.equal(st("IL", "single", 75000).tax, 3567.71);
  assert.equal(st("IL", "single", 300000).tax, 14850);
});

test("S12 PA taxes 401(k): $75,000 with $5,000 401(k) still 75,000 x 3.07% = 2,302.50", () => {
  assert.equal(st("PA", "single", 75000, { pretax_401k_annual: 5000 }).tax, 2302.5);
});

test("S13 a 2025 request in an exact state is labeled an estimate", () => {
  const s = calculateTakeHome({ state: "NY", filing_status: "single", tax_year: 2025, gross_annual: 60000 }).state_tax;
  assert.equal(s.method, "estimate");
});

test("S14 GA single $75,000: (75,000 - 15,000) x 4.99% = 2,994; NC joint $100,000: (100,000 - 25,500) x 3.99% = 2,972.55", () => {
  assert.equal(st("GA", "single", 75000).tax, 2994);
  assert.equal(st("NC", "married_filing_jointly", 100000).tax, 2972.55);
  assert.equal(st("NC", "married_filing_jointly", 100000).method, "exact");
});

test("S15 MI, VA, OH use their schedules but stay labeled estimates (sources not confirmed this session)", () => {
  const mi = st("MI", "single", 75000), va = st("VA", "single", 75000);
  assert.equal(mi.tax, 2936.75); // (75,000 - 5,900) x 4.25%
  assert.equal(va.tax, 3498.4); // 720 + 5.75% x (65,320 - 17,000)
  for (const s of ["MI", "VA", "OH"]) assert.equal(st(s, "single", 75000).method, "estimate");
});
