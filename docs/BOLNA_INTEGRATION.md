# Plugging the harness into your Bolna agents

I read this from your live config on 2026-11-21 and changed nothing. Everything below is a recommendation for you to apply.

## What the agents run today
| Setting | "Gulf Saathi" agent | Problem seen in your 27 calls |
|---|---|---|
| Transcriber | Sarvam `saaras:v3`, streaming, **`language: "hi"`**, `keywords: ""` | ~12/27 calls had Telugu speech written in Devanagari, Gurmukhi or Kannada; names and places mangled |
| `endpointing` | 200 ms | callers interrupted the bot 9–13 times per call; "నేను చెప్పే వరకు వినండి" |
| `number_of_words_for_interruption` | 3 | — |
| Tools | `check_agent`, `check_fee`, `check_contact`, `report_problem` on `gulf-saathi-psi.vercel.app` | the LLM decides when to call them; it skipped `report_problem` when the caller said "kidnapped" |
| Webhook | `https://gulf-saathi-psi.vercel.app/webhooks/bolna` | — |

## 1. Transcriber: stop forcing Hindi
- **Language.** Set the language to Telugu (`te-IN`), or to automatic detection if Sarvam's streaming mode supports it. Sarvam's docs say Saaras v3 also has a `codemix` mode that keeps English words in English. **Verify that streaming supports these options in the Bolna dashboard.**
- **Keywords.** Fill the transcriber keywords per call from the promise record. This server builds the list:
  ```bash
  curl 'http://<host>/api/hints?names=Mallaiah,AI%20NOOR%20CLEANING&districts=Jagtial'
  ```
  It returns the people, the mandals of the district, the Gulf terms (kafeel, iqama, huroob…) and Telugu money words.
- **Endpointing.** Raise `endpointing` and A/B test it against the turn-interruption counts that Bolna already logs (`interruption_stats`). I don't know Bolna's recommended value; measure it.

## 2. Mid-call gate: deterministic escalation
Add one more API tool. The LLM passes the caller's last words verbatim, and the gate decides in code whether to ESCALATE, CONFIRM, NOTE or CONTINUE.

```json
{
  "key": "custom_task",
  "name": "saathi_gate",
  "description": "Call after EVERY caller turn that mentions money, passport, salary, who picked them up, danger, being beaten, locked, kidnapped, or anything unusual. Pass the caller's exact words, not a summary. Follow the returned action: ESCALATE = keep the caller on the line, say say_te, ask only for location; CONFIRM = read back say_te and wait for yes/no; never tell the caller that family or embassy were informed unless a tool confirmed it.",
  "parameters": {
    "type": "object",
    "properties": {
      "caller_said": { "type": "string", "description": "The caller's last 1-3 utterances, copied exactly" },
      "case_id": { "type": "string" }
    },
    "required": ["caller_said"]
  }
}
```

The matching `tools_params` entry:
```json
"saathi_gate": { "method": "POST", "url": "https://<host>/api/gate", "param": { "text": "%(caller_said)s", "case_id": "%(case_id)s" } }
```

`POST /api/gate` also accepts:
- `recipient_data`: the same object you already send to the check-in agent (`worker_name`, `employer_name`, `promised_job`, `dest_city`, `code_phrase`)
- or a full `transcript` string

The gate catches:
- the safety phrase, silently
- the airport-stranger pattern
- passport taken, salary unpaid
- visit visa, fee above the cap
- fraud ("మోసం చేసిండు")
- near-miss distress words ("కోరుతున్నాడు" for "కొడుతున్నాడు")

## 3. Post-call: build the case file
Bolna allows one `webhook_url`, so keep your Vercel app as the receiver and forward the same JSON body:

```js
// inside your existing /webhooks/bolna handler
await fetch('https://<host>/webhooks/bolna', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(executionPayload) });
```

The harness server parses the transcript, adds the bot's questions as context (so a bare "లేదు" after "is your passport with you?" counts), and runs the risk engine. It then saves a case file, printable at `/cases/<id>` and listed at `/api/cases`. The response is `{ case_id, escalate, severity, risks }`, which your backend can use to page a human.

## 4. Prompt rules (from what broke in your calls)
- **Language lock.** Once the caller says "తెలుగు", every reply must be Telugu. In 5 of 11 check-in calls the agent kept speaking Hindi after "నాకు హిందీ రాదు".
- **Never claim an action that no tool confirmed.** "We informed your family / prepared an embassy complaint" appeared in about 6 calls.
- **On ESCALATE, don't end the call or say goodbye.** One call ended with "జాగ్రత్తగా ఉండండి, వీడ్కోలు" right after "no passport, other people took me".
- **Ask "which city?" once.** One caller said "Dubai అని చెప్పినా కదయ్యా" ("I already said Dubai") after being asked three times.
- **Template bug.** One check-in call greeted "నమస్కారం **{worker_name}** గారు" because the variable was empty. Check that `recipient_data` is always filled.

## 5. Embassy numbers for the agent's knowledge base
`server/data/research/helplines.json` has 59 entries, 47 copied from official mission or MEA pages and checked on 2026-11-21. In one call the bot said "I don't have the embassy number". Load the `status: "official"` entries into the agent's knowledge base. Officer mobile numbers change, so re-check them every few months.
