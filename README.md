# paycheck-calculator-mcp

A paycheck calculator MCP server: take-home pay for tax years 2025 and 2026 with the IRS bracket tables, the One Big Beautiful Bill Act standard deduction, the Social Security wage base, Additional Medicare tax and state income tax for all 50 states and DC.

Hosted endpoint, no sign-in and no token:

```
https://paycheck-calculator-mcp.lipmichal.workers.dev/mcp
```

## Tools

| Tool | What it does |
|---|---|
| `calculate_take_home_pay` | Net pay per period and per year from annual or per-period gross pay, pay frequency, filing status, state and tax year. Returns federal income tax, Social Security (with the wage base), Medicare plus the 0.9% Additional Medicare tax, state income tax and the method used for it. Handles pre-tax 401(k) and payroll HSA contributions. |
| `compare_states_take_home` | The same pay in 2 to 10 states, ranked by take-home pay, with each state's tax and method. |
| `salary_to_hourly` | Annual salary to hourly, weekly, biweekly, semimonthly and monthly gross pay. |
| `hourly_to_salary` | Hourly wage, with optional overtime hours and multiplier, to weekly, monthly and annual gross pay. |
| `get_federal_tax_brackets` | Exact federal brackets and standard deduction for 2025 or 2026 and a filing status, plus the Social Security wage base and Medicare thresholds. |

Every result has structured JSON, a plain-English summary, `as_of`, `source` (the irs.gov or state revenue document) and `more` (the matching calculator page on statewage.com).

## What it knows that your model does not

- The 2025 standard deduction changed mid-year. P.L. 119-21 (signed July 4, 2025) raised it to $15,750 single, $31,500 joint and $23,625 head of household, replacing the $15,000 / $30,000 / $22,500 in Rev. Proc. 2024-40.
- The 2026 brackets and standard deduction ($16,100 / $32,200 / $24,150) from Rev. Proc. 2025-32.
- The Social Security wage base: $176,100 for 2025 and $184,500 for 2026.
- Additional Medicare tax is owed over $200,000 single, $250,000 joint and $125,000 separate, but employers withhold it over $200,000 for everyone. The tool returns both.
- A 401(k) deferral lowers income tax but not Social Security or Medicare. A payroll HSA contribution lowers all three.
- Exact 2026 state schedules for California, New York, New Jersey, Illinois, Pennsylvania, Georgia and North Carolina, including each state's deductions or exemptions and its treatment of 401(k) and HSA money (Pennsylvania taxes 401(k) deferrals; California and New Jersey tax HSA contributions). New York's 2026 rate cuts and its tax-benefit recapture over $107,650 are included.
- Michigan, Virginia and Ohio run through their own schedules and exemptions, but are labeled `method: "estimate"` until their 2026 sources are re-checked (see Limitations).
- Every other state's figure is a single-rate estimate and is labeled `method: "estimate"`. States with no wage income tax are labeled `no_wage_income_tax`.

## Install

### Claude.ai custom connector or ChatGPT developer mode

Add a custom connector and paste the URL. No token is needed.

```
https://paycheck-calculator-mcp.lipmichal.workers.dev/mcp
```

### Claude Code

```
claude mcp add --transport http paycheck-calculator https://paycheck-calculator-mcp.lipmichal.workers.dev/mcp
```

Or run it locally:

```
claude mcp add paycheck-calculator -- npx -y github:theluckystrike/paycheck-calculator-mcp
```

### Claude Desktop

Add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "paycheck-calculator": {
      "command": "npx",
      "args": ["-y", "github:theluckystrike/paycheck-calculator-mcp"]
    }
  }
}
```

### Cursor

Add this to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "paycheck-calculator": {
      "url": "https://paycheck-calculator-mcp.lipmichal.workers.dev/mcp"
    }
  }
}
```

### VS Code

Add this to `.vscode/mcp.json`:

```json
{
  "servers": {
    "paycheck-calculator": {
      "type": "http",
      "url": "https://paycheck-calculator-mcp.lipmichal.workers.dev/mcp"
    }
  }
}
```

Node 20 or newer is needed for the local `npx` version.

## Example prompts

- "I make $85,000 a year in California, single, paid biweekly. What is my take-home pay per paycheck in 2026?"
- "Compare my take-home on a $120,000 salary in Texas, New York, New Jersey and Washington. We file jointly."
- "If I put 6% into my 401(k) and $3,000 into an HSA, how much does my paycheck drop in Pennsylvania?"
- "What are the 2025 federal tax brackets for head of household, and what is the standard deduction?"
- "I earn $32 an hour with 5 hours of overtime a week. What is that as a salary?"

## Data sources

Federal numbers come from irs.gov documents fetched on 2026-10-30: Rev. Proc. 2024-40, Rev. Proc. 2025-32, Publication 15 (2025 and 2026), Topic 751, the Form 8959 instructions and Publication 15-B. State schedules come from each state's revenue department. See [DATA_SOURCES.md](DATA_SOURCES.md) for each item and URL.

## Limitations

- Results are estimates of the annual tax on wages, not tax advice. They are not your employer's W-4 withholding.
- The pay is treated as the household's only income, with the standard deduction and no credits.
- Local income taxes are out of scope: New York City, Yonkers, Ohio city and school district taxes, Pennsylvania local earned income tax, Maryland and Indiana county taxes, Michigan city taxes and others.
- State payroll taxes such as California SDI and New Jersey SUI, DI and FLI are not included.
- State figures outside the seven exact states are estimates. Michigan and Virginia use their published schedules, but the state sites could not be fetched to confirm them. Ohio's 2026 statute and its 2026 forms disagree; the statute is used. For 2025 requests, the exact states use their 2026 schedule and are labeled estimates.

## More

Paycheck calculators for every state: [statewage.com](https://statewage.com/?utm_source=mcp&utm_medium=paycheck-calculator-mcp).

Part of the Zovo MCP collection: https://mcp.zovo.one

## Development

```
npm install
npm run build
npm test
```

`src/core.ts` holds the paycheck logic and has no I/O. `src/federal.ts` holds the IRS tables, `src/states-exact.ts` the exact state schedules and `src/state-table.ts` the estimates. `src/stdio.ts` is the local entry and `src/worker.ts` is the Cloudflare Worker entry. Both use the same tool registry in `src/tools.ts`.

## License

MIT

<!-- data-servers:start -->
## More data servers from the same author

Each one is free, needs no API key and has a hosted URL you can paste into Claude or ChatGPT.

| server | tools | hosted URL |
|---|---|---|
| [cups-to-grams-mcp](https://github.com/theluckystrike/cups-to-grams-mcp) | convert_ingredient, search_ingredients, scale_recipe, convert_oven_temperature | `https://cups-to-grams-mcp.lipmichal.workers.dev/mcp` |
| [dscr-loan-calculator-mcp](https://github.com/theluckystrike/dscr-loan-calculator-mcp) | calculate_dscr, max_loan_for_target_dscr, rent_needed_for_target_dscr, compare_scenarios, amortization_summary | `https://dscr-loan-calculator-mcp.lipmichal.workers.dev/mcp` |
| [gold-price-per-gram-mcp](https://github.com/theluckystrike/gold-price-per-gram-mcp) | get_gold_price_per_gram, get_metal_prices, calculate_jewelry_value, convert_gold_units | `https://gold-price-per-gram-mcp.lipmichal.workers.dev/mcp` |
| [lake-level-mcp](https://github.com/theluckystrike/lake-level-mcp) | search_lakes, get_lake_level, get_lake_history, compare_lakes | `https://lake-level-mcp.lipmichal.workers.dev/mcp` |
| [minimum-wage-mcp](https://github.com/theluckystrike/minimum-wage-mcp) | get_minimum_wage, list_upcoming_increases, compare_states, annual_income_at_minimum_wage | `https://minimum-wage-mcp.lipmichal.workers.dev/mcp` |
| [no-tax-on-overtime-mcp](https://github.com/theluckystrike/no-tax-on-overtime-mcp) | calculate_overtime_deduction, calculate_tips_deduction, calculate_senior_deduction, estimate_tax_savings, explain_eligibility | `https://no-tax-on-overtime-mcp.lipmichal.workers.dev/mcp` |
| [uk-income-tax-salary-mcp](https://github.com/theluckystrike/uk-income-tax-salary-mcp) | calculate_uk_take_home, get_uk_tax_bands, compare_salaries, marginal_rate_at_income | `https://uk-income-tax-salary-mcp.lipmichal.workers.dev/mcp` |
| [us-federal-holidays-business-days-mcp](https://github.com/theluckystrike/us-federal-holidays-business-days-mcp) | list_federal_holidays, is_business_day, add_business_days, count_business_days, invoice_due_date | `https://us-federal-holidays-business-days-mcp.lipmichal.workers.dev/mcp` |

The paid back-office collection (invoices, VAT, PDFs, spreadsheets) is at https://mcp.zovo.one
<!-- data-servers:end -->
