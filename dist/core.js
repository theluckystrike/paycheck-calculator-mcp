// Pure paycheck engine. No I/O. Federal from federal.ts, state from states.ts.
import { InputError, IRS, cents, federalIncomeTax, federalBrackets, fica, STANDARD_DEDUCTION, SS_WAGE_BASE, ADDL_MEDICARE_RATE, ADDL_MEDICARE_THRESHOLD, ADDL_MEDICARE_WITHHOLDING_THRESHOLD, } from "./federal.js";
import { stateTax, findState } from "./states.js";
export { InputError, FILING_STATUSES, TAX_YEARS } from "./federal.js";
export { findState, STATE_CODES, EXACT_STATES } from "./states.js";
export const AS_OF = "2026-10-30";
export const MONEY_SITE = "https://statewage.com";
export const UTM = "utm_source=mcp&utm_medium=paycheck-calculator-mcp";
export const DISCLAIMER = "Estimate of annual tax on wages, not tax advice and not your employer's W-4 withholding. Uses the standard deduction and no credits. Local taxes (NYC, Yonkers, Ohio cities, Pennsylvania EIT, Maryland and Indiana counties) and state payroll taxes such as CA SDI are not included.";
export function moreUrl(path) {
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${MONEY_SITE}${p}?${UTM}`;
}
export const stateMore = (slug) => moreUrl(`/states/${slug}/`);
export const PAY_FREQUENCIES = ["weekly", "biweekly", "semimonthly", "monthly", "quarterly", "annual"];
export const PERIODS = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, quarterly: 4, annual: 1 };
const MAX_PAY = 100_000_000;
function num(v, name) {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0)
        throw new InputError(`${name} must be a number of 0 or more.`);
    return v;
}
export function resolveGross(inp) {
    const frequency = inp.pay_frequency ?? "biweekly";
    const periods = PERIODS[frequency];
    if (!periods)
        throw new InputError(`pay_frequency must be one of ${PAY_FREQUENCIES.join(", ")}.`);
    const hasA = inp.gross_annual !== undefined, hasP = inp.gross_per_period !== undefined;
    if (hasA === hasP)
        throw new InputError("Give exactly one of gross_annual or gross_per_period.");
    const gross = hasA ? num(inp.gross_annual, "gross_annual") : num(inp.gross_per_period, "gross_per_period") * periods;
    if (gross > MAX_PAY)
        throw new InputError("Gross pay above $100,000,000 a year is not supported.");
    return { gross: cents(gross), frequency, periods };
}
export function calculateTakeHome(inp) {
    const st = findState(inp.state);
    const { gross, frequency, periods } = resolveGross(inp);
    const year = inp.tax_year, filing = inp.filing_status;
    if (inp.pretax_401k_annual !== undefined && inp.pretax_401k_percent !== undefined)
        throw new InputError("Give pretax_401k_annual or pretax_401k_percent, not both.");
    let k401 = inp.pretax_401k_percent !== undefined ? gross * num(inp.pretax_401k_percent, "pretax_401k_percent") / 100 : num(inp.pretax_401k_annual ?? 0, "pretax_401k_annual");
    const hsa = num(inp.hsa_annual ?? 0, "hsa_annual");
    k401 = cents(k401);
    if (k401 + hsa > gross)
        throw new InputError(`Pre-tax 401(k) plus HSA (${k401 + hsa}) cannot exceed gross pay (${gross}).`);
    const std = STANDARD_DEDUCTION[year][filing];
    const taxable = cents(Math.max(0, gross - k401 - hsa - std));
    const fit = federalIncomeTax(taxable, year, filing);
    const f = fica(gross, hsa, year, filing);
    const s = stateTax(st.abbr, { gross, k401, hsa, filing, year });
    const total = cents(fit.tax + f.social_security + f.medicare + f.additional_medicare + s.tax);
    const netAnnual = cents(gross - total - k401 - hsa);
    const pp = (n) => cents(n / periods);
    const assumptions = [
        `Annual liability for tax year ${year}, spread evenly over ${periods} pay periods. Your employer's withholding (IRS Pub. 15-T, W-4) can differ.`,
        "This pay is treated as the household's only income, with the standard deduction and no credits or other adjustments.",
        "401(k) is a traditional pre-tax deferral: it lowers income tax but not Social Security or Medicare. HSA is a payroll (cafeteria plan) contribution: it lowers income tax, Social Security and Medicare (IRS Pub. 15-B).",
        `Additional Medicare tax uses the ${filing.replace(/_/g, " ")} threshold of $${ADDL_MEDICARE_THRESHOLD[filing].toLocaleString("en-US")}. Employers withhold it on wages over $${ADDL_MEDICARE_WITHHOLDING_THRESHOLD.toLocaleString("en-US")} regardless of filing status; the difference settles on Form 8959.`,
        "Income tax is computed from the rate schedules. The IRS Tax Table (taxable income under $100,000) and New York's tax table (under $65,000) use $50 bands, so a filed return can differ by a few dollars.",
        "Local income taxes are out of scope.",
    ];
    return {
        state: st.abbr, state_name: st.name, filing_status: filing, tax_year: year,
        pay_frequency: frequency, periods_per_year: periods,
        gross: { annual: gross, per_period: pp(gross) },
        pretax: { k401_annual: k401, hsa_annual: hsa },
        federal: {
            taxable_income: taxable, standard_deduction: std, income_tax: fit.tax, marginal_rate: fit.marginal_rate,
            social_security: f.social_security, social_security_wages: f.social_security_wages, social_security_wage_base: f.social_security_wage_base,
            medicare: f.medicare, additional_medicare: f.additional_medicare, additional_medicare_threshold: f.additional_medicare_threshold,
            additional_medicare_employer_withholding: f.additional_medicare_employer_withholding, method: "exact",
        },
        state_tax: s,
        totals: { total_tax_annual: total, effective_tax_rate: gross > 0 ? Math.round((total / gross) * 10000) / 10000 : 0 },
        net: { annual: netAnnual, per_period: pp(netAnnual) },
        per_period: {
            federal_income_tax: pp(fit.tax), social_security: pp(f.social_security), medicare: pp(f.medicare + f.additional_medicare),
            state_income_tax: pp(s.tax), k401: pp(k401), hsa: pp(hsa), net: pp(netAnnual),
        },
        assumptions,
    };
}
export function compareStates(inp) {
    const codes = [...new Set(inp.states.map((s) => findState(s).abbr))];
    if (codes.length < 2 || codes.length > 10)
        throw new InputError("Give 2 to 10 different states.");
    const rows = codes.map((c) => calculateTakeHome({ ...inp, state: c }));
    rows.sort((a, b) => b.net.annual - a.net.annual);
    const best = rows[0].net.annual;
    return {
        tax_year: inp.tax_year, filing_status: inp.filing_status, pay_frequency: rows[0].pay_frequency,
        gross_annual: rows[0].gross.annual,
        federal_income_tax: rows[0].federal.income_tax,
        fica: cents(rows[0].federal.social_security + rows[0].federal.medicare + rows[0].federal.additional_medicare),
        states: rows.map((r, i) => ({
            rank: i + 1, state: r.state, state_name: r.state_name, state_income_tax: r.state_tax.tax, method: r.state_tax.method,
            net_annual: r.net.annual, net_per_period: r.net.per_period, behind_best_annual: cents(best - r.net.annual),
            more: stateMore(findState(r.state).slug),
        })),
    };
}
export function salaryToHourly(a) {
    const salary = num(a.annual_salary, "annual_salary");
    const hpw = a.hours_per_week ?? 40, wpy = a.weeks_per_year ?? 52;
    if (!(hpw > 0 && hpw <= 168))
        throw new InputError("hours_per_week must be above 0 and at most 168.");
    if (!(wpy > 0 && wpy <= 53))
        throw new InputError("weeks_per_year must be above 0 and at most 53.");
    const hours = hpw * wpy;
    return {
        annual_salary: salary, hours_per_week: hpw, weeks_per_year: wpy, hours_per_year: hours,
        hourly: cents(salary / hours), weekly: cents(salary / wpy), biweekly: cents(salary / 26), semimonthly: cents(salary / 24), monthly: cents(salary / 12),
    };
}
export function hourlyToSalary(a) {
    const rate = num(a.hourly_rate, "hourly_rate");
    const hpw = a.hours_per_week ?? 40, wpy = a.weeks_per_year ?? 52;
    const ot = a.overtime_hours_per_week ?? 0, mult = a.overtime_multiplier ?? 1.5;
    if (!(hpw > 0 && hpw <= 168))
        throw new InputError("hours_per_week must be above 0 and at most 168.");
    if (!(wpy > 0 && wpy <= 53))
        throw new InputError("weeks_per_year must be above 0 and at most 53.");
    if (ot < 0 || hpw + ot > 168)
        throw new InputError("overtime_hours_per_week must be 0 or more, and total hours at most 168.");
    const weekly = cents(rate * hpw + rate * mult * ot);
    return {
        hourly_rate: rate, hours_per_week: hpw, overtime_hours_per_week: ot, overtime_multiplier: mult, weeks_per_year: wpy,
        weekly, annual_salary: cents(weekly * wpy), monthly: cents((weekly * wpy) / 12),
    };
}
export function getFederalBrackets(year, filing) {
    return {
        tax_year: year, filing_status: filing,
        brackets: federalBrackets(year, filing).map((b) => ({ rate: b.rate, over: b.over, up_to: b.upTo, tax_on_lower_brackets: b.base })),
        standard_deduction: STANDARD_DEDUCTION[year][filing],
        social_security: { rate: 0.062, wage_base: SS_WAGE_BASE[year] },
        medicare: { rate: 0.0145, additional_rate: ADDL_MEDICARE_RATE, additional_threshold: ADDL_MEDICARE_THRESHOLD[filing], employer_withholding_threshold: ADDL_MEDICARE_WITHHOLDING_THRESHOLD },
        legal_basis: year === 2025
            ? "Rev. Proc. 2024-40 Tables 1-4; standard deduction from IRC 63(c)(7) as amended by P.L. 119-21 (One Big Beautiful Bill Act), restated in Rev. Proc. 2025-32 section 3.01."
            : "Rev. Proc. 2025-32 section 4.01 Tables 1-4 and section 4.14 (reflects P.L. 119-21).",
        source: year === 2025 ? `${IRS.revProc2025} ; ${IRS.revProc2026}` : IRS.revProc2026,
    };
}
export { IRS };
