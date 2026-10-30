// GET / page for the hosted Worker.
const TOOLS: Array<[string, string]> = [
  ["calculate_take_home_pay", "Net pay per period and per year: federal income tax (IRS 2025/2026 tables), Social Security with the wage base, Medicare plus 0.9% Additional Medicare, and state income tax. Handles pre-tax 401(k) and HSA."],
  ["compare_states_take_home", "The same pay in 2 to 10 states, ranked by take-home pay."],
  ["salary_to_hourly", "Annual salary to hourly, weekly, biweekly, semimonthly and monthly gross pay."],
  ["hourly_to_salary", "Hourly wage, with optional overtime, to weekly, monthly and annual gross pay."],
  ["get_federal_tax_brackets", "Exact 2025 or 2026 federal brackets and standard deduction for a filing status, with the One Big Beautiful Bill Act changes."],
];

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function landingPage(origin: string): string {
  const mcp = `${origin}/mcp`;
  const rows = TOOLS.map(([n, d]) => `<tr><td><code>${n}</code></td><td>${esc(d)}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Paycheck Calculator MCP</title>
<meta name="description" content="Paycheck calculator MCP server: 2025-2026 take-home pay with IRS brackets, the Social Security wage base and state income tax for 50 states and DC.">
<style>:root{--bg:#fff;--fg:#1a1a1a;--muted:#555;--line:#ddd;--code:#f4f4f4}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#eee;--muted:#aaa;--line:#333;--code:#222}}
body{background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:24px 16px}
code,pre{background:var(--code);border-radius:4px;font-size:14px}pre{padding:10px;overflow-x:auto}code{padding:1px 4px}
table{border-collapse:collapse;width:100%}td{border-top:1px solid var(--line);padding:8px 6px;vertical-align:top}p.small{color:var(--muted);font-size:14px}a{color:inherit}</style></head>
<body><h1>Paycheck Calculator MCP server</h1>
<p>Gives an AI assistant a take-home pay calculator for tax years 2025 and 2026: IRS bracket tables and standard deductions after the One Big Beautiful Bill Act, the Social Security wage base, Additional Medicare tax, and state income tax for all 50 states and DC. Seven states (CA, NY, NJ, IL, PA, GA, NC) use exact 2026 schedules; every other figure is labeled an estimate.</p>
<h2>Connect</h2>
<p>Hosted endpoint (Streamable HTTP, no sign-in, no token). Paste it into Claude.ai custom connectors or ChatGPT developer mode.</p>
<pre>${esc(mcp)}</pre>
<p>Claude Code</p><pre>claude mcp add --transport http paycheck-calculator ${esc(mcp)}</pre>
<p>Local (stdio)</p><pre>npx -y github:theluckystrike/paycheck-calculator-mcp</pre>
<h2>Tools</h2><table>${rows}</table>
<p>Paycheck calculators for every state: <a href="https://statewage.com/?utm_source=mcp&amp;utm_medium=paycheck-calculator-mcp">statewage.com</a>.
Source: <a href="https://github.com/theluckystrike/paycheck-calculator-mcp">github.com/theluckystrike/paycheck-calculator-mcp</a>.</p>
<p class="small">Results are estimates, not tax advice. Local taxes are not included. Part of the Zovo MCP collection: <a href="https://mcp.zovo.one">mcp.zovo.one</a>.</p>
</body></html>`;
}
