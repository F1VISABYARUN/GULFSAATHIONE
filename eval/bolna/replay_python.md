# Python safety net replayed on 25 real Bolna calls

Escalated: **9** calls. Expected risks come from the fact sheet; "unverified" means Claude's guess, not checked by listening.

| Call | Agent | Safety net | Reasons | Expected risks (fact sheet) |
|---|---|---|---|---|
| 839cab12 | saathi | — | — | — (unverified) |
| 825a05db | saathi | — | visit_visa | VISIT_VISA, FEE_ABOVE_CAP (unverified) |
| d2d1c8ee | saathi | — | fee_above_cap | FEE_ABOVE_CAP (unverified) |
| 7f58b4f5 | saathi | — | fee_above_cap | FEE_ABOVE_CAP (unverified) |
| 6bb7d5c6 | saathi | **ESCALATE** | threatened_or_distress, passport_taken, unpaid, visit_visa, fee_above_cap | DISTRESS, VISIT_VISA, FEE_ABOVE_CAP, PASSPORT_HELD, SALARY_UNPAID (unverified) |
| 22b72629 | saathi | — | fee_above_cap | FEE_ABOVE_CAP (unverified) |
| 12e3c302 | saathi | — | passport_taken, fee_above_cap, agent_fraud_reported | FEE_ABOVE_CAP, PASSPORT_HELD (unverified) |
| bc44db4c | saathi | **ESCALATE** | threatened_or_distress, wrong_pickup, passport_taken, unpaid, fee_above_cap, agent_fraud_reported | DISTRESS, TAKEN_BY_STRANGER, PASSPORT_HELD, SALARY_UNPAID, FEE_ABOVE_CAP (unverified) |
| 3d12bcdc | saathi | — | unpaid, visit_visa, fee_above_cap, agent_fraud_reported | VISIT_VISA, SALARY_UNPAID, FEE_ABOVE_CAP (unverified) |
| d5acc09e | saathi | **ESCALATE** | threatened_or_distress, wrong_pickup | DISTRESS, TAKEN_BY_STRANGER (unverified) |
| 2d3958cc | saathi | — | passport_taken | PASSPORT_HELD (unverified) |
| d09a4337 | saathi | — | visit_visa, fee_above_cap | FEE_ABOVE_CAP, VISIT_VISA (unverified) |
| 94aa6eac | saathi | — | fee_above_cap | FEE_ABOVE_CAP (unverified) |
| 9eb5cf51 | saathi | — | fee_above_cap, agent_fraud_reported | FEE_ABOVE_CAP (unverified) |
| 2c0afbb9 | saathi | — | agent_fraud_reported | — (unverified) |
| 470ffc46 | saathi | **ESCALATE** | threatened_or_distress, wrong_pickup | TAKEN_BY_STRANGER (unverified) |
| 9fdec4d2 | checkin | **ESCALATE** | threatened_or_distress, wrong_pickup | TAKEN_BY_STRANGER, DISTRESS (unverified) |
| 60e0c7b3 | checkin | **ESCALATE** | wrong_pickup | TAKEN_BY_STRANGER (unverified) |
| 96d83759 | checkin | — | passport_taken, unpaid | SALARY_UNPAID, PASSPORT_HELD (unverified) |
| 106017a4 | checkin | — | — | — (unverified) |
| 26166a1b | checkin | **ESCALATE** | wrong_pickup, passport_taken | TAKEN_BY_STRANGER, PASSPORT_HELD (unverified) |
| 2354dfd3 | checkin | **ESCALATE** | wrong_pickup | TAKEN_BY_STRANGER (unverified) |
| 4eff712a | checkin | — | passport_taken, unpaid | SALARY_UNPAID, PASSPORT_HELD (unverified) |
| 59dc411a | checkin | **ESCALATE** | threatened_or_distress, wrong_pickup, passport_taken | TAKEN_BY_STRANGER, PASSPORT_HELD, DISTRESS (unverified) |
| 4825cf9a | checkin | — | — | — (unverified) |
