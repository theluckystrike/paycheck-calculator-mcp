# Data sources

Every federal rate, threshold and amount in `src/federal.ts` was copied from the irs.gov documents below, fetched on 2026-10-30. State schedules in `src/states-exact.ts` were copied from each state's revenue department on 2026-10-30. Estimates for the other states come from statewage.com (`src/lib/tax.ts`), which cites its own sources.

## Federal

| Item | Value used | Source |
|---|---|---|
| 2025 tax rate tables | Rev. Proc. 2024-40 section 2.01, Tables 1-4 (e.g. single: 10% to $11,925, 12% to $48,475, 22% to $103,350, 24% to $197,300, 32% to $250,525, 35% to $626,350, 37% above) | https://www.irs.gov/pub/irs-drop/rp-24-40.pdf |
| 2025 standard deduction | $15,750 single and separate, $31,500 joint, $23,625 head of household (IRC 63(c)(7) as amended by P.L. 119-21; Rev. Proc. 2025-32 section 3.01 removes section 2.15(1) of Rev. Proc. 2024-40) | https://www.irs.gov/pub/irs-drop/rp-25-32.pdf |
| 2026 tax rate tables | Rev. Proc. 2025-32 section 4.01, Tables 1-4 (e.g. single: 10% to $12,400, 12% to $50,400, 22% to $105,700, 24% to $201,775, 32% to $256,225, 35% to $640,600, 37% above; separate top bracket over $384,350) | https://www.irs.gov/pub/irs-drop/rp-25-32.pdf |
| 2026 standard deduction | $16,100 single and separate, $32,200 joint, $24,150 head of household (section 4.14) | https://www.irs.gov/pub/irs-drop/rp-25-32.pdf |
| Social Security 2025 | 6.2% employee, wage base $176,100 ("The social security wage base limit is $176,100.") | https://www.irs.gov/pub/irs-prior/p15--2025.pdf |
| Social Security 2026 | 6.2% employee, wage base $184,500 (Pub. 15 2026 What's New; Topic 751: "For earnings in 2026, this base limit is $184,500.") | https://www.irs.gov/pub/irs-pdf/p15.pdf , https://www.irs.gov/taxtopics/tc751 |
| Medicare | 1.45% employee, no wage base | Pub. 15 (2025, 2026) |
| Additional Medicare | 0.9% over $250,000 joint, $125,000 separate, $200,000 single / head of household / surviving spouse; "aren't indexed for inflation" | https://www.irs.gov/pub/irs-pdf/i8959.pdf |
| Additional Medicare withholding | Employer withholds on wages over $200,000 "without regard to filing status" | https://www.irs.gov/taxtopics/tc751 |
| 401(k) deferrals | Exempt from income tax withholding, taxable for Social Security and Medicare (Pub. 15 section 15 table, "Elective employee contributions and deferrals to a plan containing a qualified cash or deferred compensation arrangement (401(k))") | https://www.irs.gov/pub/irs-pdf/p15.pdf |
| HSA via payroll | Exempt from income tax withholding, Social Security and Medicare "for qualified individuals up to the HSA contribution limits" (Pub. 15-B Table 2-1) | https://www.irs.gov/pub/irs-pdf/p15b.pdf |

The task asked for the wage base from ssa.gov. Every ssa.gov URL (oact/cola/cbb.html, the 2026 COLA fact sheet and others) returned HTTP 403 from this network on 2026-10-30, so the wage base is taken from the IRS publications above, which state the same figures.

## States with exact 2026 schedules

| State | Values used | Source |
|---|---|---|
| California | 2026 Schedules X, Y, Z (1% to 12.3%; single first bracket to $11,456); standard deduction $5,900 single and separate, $11,800 joint and head of household; exemption credit $158 ($316 joint) | FTB Tax News October 2026, "2026 Indexing": https://www.ftb.ca.gov/about-ftb/newsroom/tax-news/2026/10.html |
| California | Exemption credit phase-out: $6 per $2,500 ($1,250 separate) of AGI over $252,203 / $504,411 / $378,310 (2025 thresholds; 2026 not yet published) | https://www.ftb.ca.gov/forms/2025/2025-540-booklet.html |
| California | HSA not recognized: employer HSA contributions (W-2 box 12 code W) are added back | https://www.ftb.ca.gov/forms/2025/2025-540-ca-instructions.html |
| California | Behavioral Health Services Tax 1% of taxable income over $1,000,000 | https://www.ftb.ca.gov/forms/2026/2026-540-es-instructions.html |
| New York | 2026 rate schedules (3.90% to 10.9%, cut by Chapter 59 of the Laws of 2025, Part A); standard deduction $8,000 / $16,050 / $11,200; recapture worksheets for NY AGI over $107,650 | IT-2105-I (2026): https://www.tax.ny.gov/pdf/current_forms/it/it2105i.pdf ; NYS-50-T-NYS (1/26): https://www.tax.ny.gov/pdf/publications/withholding/nys50_t_nys.pdf |
| New York | Starts from federal AGI; only 414(h) contributions are added back, not 401(k) | https://www.tax.ny.gov/pdf/current_forms/it/it201i.pdf |
| New Jersey | 2026 Table A (single, separate) and Table B (joint, head of household), 1.4% to 10.75%; $1,000 exemption per filer; no standard deduction | 2026 NJ-1040-ES: https://www.nj.gov/treasury/taxation/pdf/current/1040esi.pdf |
| New Jersey | 401(k) excluded up to the federal limit; only Archer MSA (not HSA) contributions excluded | NJ-WT: https://www.nj.gov/treasury/taxation/pdf/current/njwt.pdf |
| Illinois | 4.95%; 2026 exemption $2,925 per person; no exemption above $250,000 AGI ($500,000 joint) | IL-700-T: https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/withholding/documents/currentyear/il-700-t.pdf ; https://tax.illinois.gov/questionsandanswers/answer.851.html ; Bulletin FY 2026-15 |
| Pennsylvania | 3.07%; no standard deduction or exemption; 401(k) contributions "are not excludable from Pennsylvania-taxable compensation"; HSA follows federal rules | https://www.pa.gov/agencies/revenue/resources/tax-rates ; PA PIT Guide gross compensation chapter ; 2025 PA-40 instructions |
| Georgia | Flat 4.99% for 2026 (HB 463); standard deduction $15,000 single, head of household and separate, $30,000 joint | 2026 Employer's Tax Guide (June 2026): https://dor.georgia.gov/document/document/2026-employers-tax-guide-updated-june-2026/download ; HB 463: https://gov.georgia.gov/document/2026-signed-legislation/hb-463/download |
| North Carolina | 3.99% "For Taxable Years after 2025"; standard deduction $12,750 single, $19,125 head of household (NC-30 2026), $25,500 joint and $12,750 separate (ncdor.gov standard deduction page) | https://www.ncdor.gov/taxes-forms/individual-income-tax/tax-rate-schedules ; NC-30 (2026) |

## States with schedules labeled as estimates

| State | Values used | Why it is labeled an estimate |
|---|---|---|
| Michigan | 4.25%, $5,900 exemption per filer (Treasury news 2026-04-15; Form 446 2026) | michigan.gov returned 403 to direct fetch on 2026-10-30; values come from search excerpts of those pages |
| Virginia | 2% / 3% / 5% / 5.75% (2025 table, no 2026 change found); standard deduction $8,750 / $17,500 for 2026; $930 exemption (2026 Form 760ES) | tax.virginia.gov refused the connection on 2026-10-30 |
| Ohio | $332 plus 2.75% over $26,050 (R.C. 5747.02 as amended by H.B. 96); exemptions $2,400 / $2,150 / $1,900 by income, none at $500,000+ | The Department's 2026 IT 1040ES still prints the 2025 two-rate schedule; codes.ohio.gov refused the connection |

## Other states

All other state figures are the single-rate estimates from statewage.com `src/lib/tax.ts` (commit 4e2fe39, 2026-10-29), labeled `method: "estimate"` in every result.
