# Saathi Exit Path

For a worker abroad whose visit visa is ending (or has ended), who has no passport, or who wants to go home. Saathi guides; it does not fix. It cannot buy a ticket, pay a fine, or promise a return date.

## How it works
`POST /tools/exit-path` (needs `x-saathi-secret`) is a rules engine in `server/exit/engine.ts`, not a language model. The Bolna agent passes what it knows (empty string for the rest) and the tool returns either the next question or the plan.

1. Danger first: distress words, a stranger pickup or the safety phrase skip everything and give the embassy line (status `escalate`).
2. Questions in order: country, visa type, expiry date (read back digit by digit), passport, problem, stay or go home. One question per call.
3. Plan: steps in short spoken Telugu (`parts`), each tagged with the fact, its status and its source.
4. If there is a case id or caller phone the case is created or updated: a missing passport raises the risk level, and the plan is stored as a note for the caseworker.

## Facts policy (`server/data/exit_rules.json`)
Every figure has a source URL, the date it was read, and a status:

| status | meaning | spoken? |
|---|---|---|
| `confirmed` | the official page was opened and the figure read on it | yes, with "according to the official website, check with the embassy" |
| `official_headline` | only the headline of an official page was read | only the headline claim; never a total |
| `official_snippet` | an official page was found by search but not opened | only helpline numbers already in our research data |
| unverified | listed under `not_verified` | never |

Confirmed on 22 Nov 2026 (pages opened): UAE overstay fine AED 50 a day, extension AED 100 + 500 (max 120 days in total), departure permit AED 200 + 100 and leave within 7 days with fines paid first (ICP); Emergency Certificate AED 60 and documents (Consulate General of India, Dubai); Saudi labour ministry contact centre 19911 is a general contact centre, Sunday to Thursday 8 AM to 5 PM, not a confirmed complaint line.
Not confirmed, so never spoken: ICWF cover, PBBY insurance, Telangana ex-gratia amount, flight prices, Saudi huroob 60 days, who files a UAE extension and by when, the AED 87 emergency-certificate total, any Saudi per-day fine or prison term.
Two claims in the draft research were not what the official pages say: the ICP pages state no grace period (so Saathi never mentions one), and AED 87 is not on the embassy page (AED 60 is).

## Add or change a fact
Edit `exit_rules.json`: put the number, the URL, `status`, and a note. A test fails if an entry has no source or an unknown status. Re-check every entry before launch and again after any law change.

## Bolna
`bolna/exit_path_tool.json` is the tool for the Helpline agent (replace `<YOUR SAATHI_SECRET>`). Bolna's API here cannot add a tool to an existing agent, so paste it in the dashboard (Agent, Tools, add). The prompt section is in `bolna/agents.ts` (`EXIT`). Apply it to the live agent after the tool exists.

## What it must never do
Promise a return date or that the embassy will pay; claim an amnesty or grace period; quote a total Saudi fine; advise working on a visit visa or leaving without clearing fines; tell the worker to hide.

## Not done
Telugu wording needs a native-speaker read. Other countries (Kuwait, Qatar, Bahrain, Oman) get the embassy line and no figures until their rules are confirmed. A held-out test with real workers has not been run.
