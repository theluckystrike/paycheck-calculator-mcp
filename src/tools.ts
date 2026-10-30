// One tool registry shared by the stdio and Cloudflare Worker entries.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  AS_OF, DISCLAIMER, FILING_STATUSES, PAY_FREQUENCIES, InputError, IRS, EXACT_STATES,
  calculateTakeHome, compareStates, salaryToHourly, hourlyToSalary, getFederalBrackets, moreUrl, stateMore, findState,
} from "./core.js";

export const SERVER_NAME = "paycheck-calculator-mcp";
export const SERVER_VERSION = "1.0.0";

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${(n * 100).toFixed(2).replace(/\.?0+$/, "")}%`;

const filingStatus = z.enum(FILING_STATUSES).describe("Federal filing status. Qualifying surviving spouse uses married_filing_jointly.");
const taxYear = z.union([z.literal(2025), z.literal(2026)]).describe("Tax year: 2025 or 2026.");
const state = z.string().min(2).max(40).describe("US state or DC: two-letter code (CA), name (California) or slug (new-york).");
const payFrequency = z.enum(PAY_FREQUENCIES).optional().describe("Pay frequency: weekly (52), biweekly (26, default), semimonthly (24), monthly (12), quarterly (4) or annual (1).");
const usd = (d: string) => z.number().min(0).max(1e8).optional().describe(d);
const payFields = {
  filing_status: filingStatus,
  tax_year: taxYear,
  gross_annual: usd("Gross annual pay in USD before any deduction. Give this OR gross_per_period."),
  gross_per_period: usd("Gross pay for one pay period in USD. Multiplied by the periods in pay_frequency."),
  pay_frequency: payFrequency,
  pretax_401k_annual: usd("Traditional (pre-tax) 401(k) deferral for the year in USD. Lowers income tax, not FICA. Leave out for Roth."),
  pretax_401k_percent: z.number().min(0).max(100).optional().describe("Traditional 401(k) deferral as a percent of gross (e.g. 6). Use instead of pretax_401k_annual."),
  hsa_annual: usd("HSA contribution through payroll (cafeteria plan) for the year in USD. Lowers income tax, Social Security and Medicare."),
};

type Payload = Record<string, unknown>;
function reply(summary: string, data: Payload, source: string, more: string) {
  const body = { ...data, summary, as_of: AS_OF, source, more, disclaimer: DISCLAIMER };
  return {
    content: [
      { type: "text" as const, text: `${summary}\n\n${DISCLAIMER}` },
      { type: "text" as const, text: JSON.stringify(body, null, 2) },
    ],
    structuredContent: body,
  };
}

function run(fn: () => ReturnType<typeof reply>) {
  try {
    return fn();
  } catch (e) {
    const msg = e instanceof InputError ? e.message : `Unexpected error: ${(e as Error).message}`;
    return { isError: true, content: [{ type: "text" as const, text: msg }] };
  }
}

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const FED_SOURCES = (y: number) => `${y === 2025 ? IRS.revProc2025 + " ; " : ""}${IRS.revProc2026} ; ${y === 2025 ? IRS.pub15_2025 : IRS.pub15_2026} ; ${IRS.form8959}`;
const methodWord = (m: string) => (m === "exact" ? "exact 2026 schedule" : m === "estimate" ? "ESTIMATE, not the bracket calculation" : "no wage income tax");
const exactList = EXACT_STATES.join(", ");

export function registerTools(server: McpServer): void {
  server.registerTool(
    "calculate_take_home_pay",
    {
      title: "Paycheck calculator: take-home pay",
      description:
        `Calculates take-home (net) pay for a US employee in any of the 50 states or DC for tax year 2025 or 2026: federal income tax from the IRS Rev. Proc. 2024-40 / 2025-32 bracket tables with the One Big Beautiful Bill Act standard deduction ($15,750 single for 2025, $16,100 for 2026), Social Security with the wage base ($176,100 in 2025, $184,500 in 2026), Medicare plus the 0.9% Additional Medicare tax, and state income tax. State tax is exact from each state's 2026 schedule for ${exactList}; other states return a labeled effective-rate estimate (method: "estimate"). Handles pre-tax 401(k) (not FICA-exempt) and payroll HSA (FICA-exempt), and Pennsylvania/New Jersey rules that tax 401(k) or HSA money. Returns per-period and annual figures. Local taxes (NYC etc.) are out of scope. Figures copied from irs.gov and state revenue sites in Oct 2026.`,
      inputSchema: { state, ...payFields },
      annotations: { ...RO, title: "Paycheck calculator: take-home pay" },
    },
    async (a) => run(() => {
      const r = calculateTakeHome(a);
      const f = r.federal;
      const s = `${r.state_name}, ${r.filing_status.replace(/_/g, " ")}, ${r.tax_year}: gross ${money(r.gross.annual)} a year (${money(r.gross.per_period)} ${r.pay_frequency}). Federal income tax ${money(f.income_tax)} on taxable income ${money(f.taxable_income)} after the ${money(f.standard_deduction)} standard deduction (marginal ${pct(f.marginal_rate)}). Social Security ${money(f.social_security)} (6.2% up to the ${money(f.social_security_wage_base)} wage base), Medicare ${money(f.medicare)}${f.additional_medicare > 0 ? ` plus ${money(f.additional_medicare)} Additional Medicare` : ""}. State income tax ${money(r.state_tax.tax)} (${methodWord(r.state_tax.method)}). Take-home ${money(r.net.annual)} a year, ${money(r.net.per_period)} per ${r.pay_frequency} paycheck; effective tax rate ${pct(r.totals.effective_tax_rate)}.`;
      return reply(s, r as unknown as Payload, `${FED_SOURCES(r.tax_year)} ; ${r.state_tax.source}`, stateMore(findState(r.state).slug));
    }),
  );

  server.registerTool(
    "compare_states_take_home",
    {
      title: "Compare take-home pay across states",
      description:
        `Runs the same gross pay through 2 to 10 states (or DC) and ranks them by annual take-home pay for tax year 2025 or 2026, showing state income tax, the method for each state (exact 2026 schedule for ${exactList}; labeled estimate elsewhere; no wage income tax in AK, FL, NV, NH, SD, TN, TX, WA, WY) and how far each trails the best. Federal tax and FICA use the IRS 2025/2026 tables and wage base. Use it for relocation and remote-work offers.`,
      inputSchema: { states: z.array(state).min(2).max(10).describe("2 to 10 states, e.g. [\"CA\", \"TX\", \"NY\"]."), ...payFields },
      annotations: { ...RO, title: "Compare take-home pay across states" },
    },
    async (a) => run(() => {
      const r = compareStates(a);
      const top = r.states[0], last = r.states[r.states.length - 1];
      const s = `On ${money(r.gross_annual)} a year (${r.filing_status.replace(/_/g, " ")}, ${r.tax_year}), federal income tax is ${money(r.federal_income_tax)} and FICA ${money(r.fica)} in every state. Highest take-home: ${top.state_name} at ${money(top.net_annual)} (state tax ${money(top.state_income_tax)}). Lowest: ${last.state_name} at ${money(last.net_annual)}, ${money(last.behind_best_annual)} less a year. ${r.states.filter((x) => x.method === "estimate").length} of ${r.states.length} state figures are estimates; check the method field.`;
      return reply(s, r as unknown as Payload, `${FED_SOURCES(r.tax_year)} ; https://statewage.com/states/`, moreUrl("/states/"));
    }),
  );

  server.registerTool(
    "salary_to_hourly",
    {
      title: "Salary to hourly rate",
      description: "Converts an annual salary to an hourly rate and to weekly, biweekly (26), semimonthly (24) and monthly gross pay. Defaults: 40 hours a week, 52 weeks (2,080 hours). Gross pay only; use calculate_take_home_pay for net.",
      inputSchema: {
        annual_salary: z.number().min(0).max(1e8).describe("Gross annual salary in USD."),
        hours_per_week: z.number().gt(0).max(168).optional().describe("Paid hours per week (default 40)."),
        weeks_per_year: z.number().gt(0).max(53).optional().describe("Paid weeks per year (default 52; paid vacation still counts)."),
      },
      annotations: { ...RO, title: "Salary to hourly rate" },
    },
    async (a) => run(() => {
      const r = salaryToHourly(a);
      const s = `${money(r.annual_salary)} a year over ${r.hours_per_year.toLocaleString("en-US")} hours (${r.hours_per_week} h x ${r.weeks_per_year} weeks) is ${money(r.hourly)} an hour: ${money(r.weekly)} a week, ${money(r.biweekly)} biweekly, ${money(r.semimonthly)} semimonthly, ${money(r.monthly)} a month, before tax.`;
      return reply(s, r, "https://statewage.com/salary-to-hourly/", moreUrl("/salary-to-hourly/"));
    }),
  );

  server.registerTool(
    "hourly_to_salary",
    {
      title: "Hourly rate to annual salary",
      description: "Converts an hourly wage to weekly, monthly and annual gross pay, with optional weekly overtime hours at a multiplier (1.5 by default). Defaults: 40 hours a week, 52 weeks. Gross pay only; use calculate_take_home_pay for net.",
      inputSchema: {
        hourly_rate: z.number().min(0).max(1e6).describe("Hourly wage in USD."),
        hours_per_week: z.number().gt(0).max(168).optional().describe("Regular hours per week (default 40)."),
        weeks_per_year: z.number().gt(0).max(53).optional().describe("Paid weeks per year (default 52)."),
        overtime_hours_per_week: z.number().min(0).max(128).optional().describe("Overtime hours per week (default 0)."),
        overtime_multiplier: z.number().min(1).max(5).optional().describe("Overtime pay multiplier (default 1.5)."),
      },
      annotations: { ...RO, title: "Hourly rate to annual salary" },
    },
    async (a) => run(() => {
      const r = hourlyToSalary(a);
      const s = `${money(r.hourly_rate)} an hour for ${r.hours_per_week} h a week${r.overtime_hours_per_week ? ` plus ${r.overtime_hours_per_week} overtime hours at ${r.overtime_multiplier}x` : ""} is ${money(r.weekly)} a week, ${money(r.monthly)} a month and ${money(r.annual_salary)} a year over ${r.weeks_per_year} weeks, before tax.`;
      return reply(s, r, "https://statewage.com/salary-to-hourly/", moreUrl("/salary-to-hourly/"));
    }),
  );

  server.registerTool(
    "get_federal_tax_brackets",
    {
      title: "Federal income tax brackets and standard deduction",
      description:
        "Returns the exact federal income tax brackets (rate, lower and upper bound, tax on lower brackets) and standard deduction for tax year 2025 or 2026 and a filing status, from IRS Rev. Proc. 2024-40 and Rev. Proc. 2025-32, including the One Big Beautiful Bill Act (P.L. 119-21) standard deduction increase for 2025 ($15,750 / $31,500 / $23,625). Also returns the Social Security wage base and Medicare thresholds for that year.",
      inputSchema: { tax_year: taxYear, filing_status: filingStatus },
      annotations: { ...RO, title: "Federal income tax brackets and standard deduction" },
    },
    async (a) => run(() => {
      const r = getFederalBrackets(a.tax_year, a.filing_status);
      const rows = r.brackets.map((b) => `${pct(b.rate)} over ${money(b.over)}`).join(", ");
      const s = `${r.tax_year} federal brackets for ${r.filing_status.replace(/_/g, " ")}: ${rows}. Standard deduction ${money(r.standard_deduction)}. Social Security wage base ${money(r.social_security.wage_base)}. ${r.legal_basis}`;
      return reply(s, r, r.source, moreUrl("/tax-bracket-calculator/"));
    }),
  );
}

export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerTools(server);
  return server;
}
