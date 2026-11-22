# Interpreter line: audit, capacity and test script

Status key: **live** = seen working on a real call; **tests** = passes unit tests with fakes only; **unverified** = never run.

## What the call server does, and how sure we are
| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Plivo number -> our server answers, HTTPS via CloudFront | live | `answer`, `stream_start` lines in the log |
| 2 | Short Telugu greeting, then listens (no phone menu) | live | greeting heard on real calls |
| 3 | Hears Telugu (Sarvam + OpenAI), decides who spoke from either ear | live | `heard who=worker` lines |
| 4 | Interruption (barge-in) and playback events | live | `barge_in`, `clearedAudio`, `playedStream` |
| 5 | Tools: places, directions, agent check, fee check, Exit Path, problem report | live (places, agent check) / tests (others) | police station found; "Ramesh" checked |
| 6 | Answers "can you hear me?" in Telugu without speaking Arabic | live | `say to_worker` only |
| 7 | Never speaks Arabic until the worker says yes to that exact message | tests | `tests/phone-interpreter.test.ts` (confirmation tests) |
| 8 | AI notice to the other person once, with the first confirmed message | tests | same |
| 9 | Danger: records the case, says a Telugu line, then calls a person after the line finished | tests | new tests; before this change it transferred silently |
| 10 | Real Arabic speech from another person heard and reported in Telugu | **unverified** | no real Arabic speaker has been on a call yet |
| 11 | Arabic voice quality (OpenAI voice) | **unverified** | |
| 12 | Call records for the caseworker (transcript/case file for interpreter calls) | partial | only tool calls (`report_problem`, `exit_path`) create cases; plain conversation is not saved |
| 13 | Native-speaker review of Telugu/Arabic wording | **not done** | |

## If 10 people call the same number
- Each call opens its own connection and gets its **own independent session** (its own state, history and timers) inside the same program. It is **not** ten servers or ten copies: one Node process serves all calls.
- The call server (`t3.small`, one instance) holds audio and state in memory. It does little work itself; the heavy work happens at OpenAI, Sarvam and Cartesia. **We have never tested more than one call at a time**, so any number we give is a guess.
- Real limits to check: your OpenAI, Sarvam and Cartesia **concurrency/rate limits**; Plivo's **concurrent call limit** on your account; and the server's CPU and memory. Bolna's account limit was 2 simultaneous calls, which is separate.
- New: the server refuses calls beyond `INTERPRETER_MAX_CALLS` (default 20) with "all lines are busy", so existing calls are protected. Log lines `active` and `busy` show the load.
- One server is a single point of failure: if the container restarts, calls drop. Running more servers needs shared state (the call tickets are kept in memory).

## Test calls: what to say (Telugu), and what must happen
Set `INTERPRETER_TRANSFER=off` in `/root/interpreter.env` for testing so a danger phrase does not ring your own phone. Pause for each answer.

| Step | You say | Expected |
|---|---|---|
| 1 | (wait) | Short greeting: "నమస్కారం, నేను సాథి. చెప్పండి, ఏం కావాలి?" |
| 2 | "వినిపిస్తుందా?" | Telugu "వినిపిస్తోంది", nothing in Arabic |
| 3 | "సరే" | Silence |
| 4 | "నేను మెడికల్ షాప్ లో ఉన్నాను, నాకు అరబిక్ రాదు, నాకు జ్వరం మందులు కావాలి" | Asks YOU in Telugu "ఆయనకు ... చెప్పమంటారా?". No Arabic yet |
| 5 | "అవును" | The notice + the message in Arabic |
| 6 | "వద్దు" (after another question) | "సరే. ఏం చెప్పమంటారు?", nothing in Arabic |
| 7 | "నేను దుబాయ్ మాల్ దగ్గర ఉన్నాను, పోలీస్ స్టేషన్ ఎక్కడ ఉందో చూడండి" | Nearby police station read to you in Telugu |
| 8 | "నా వీసా 5 రోజుల్లో అయిపోతుంది, నేను యూఏఈ లో ఉన్నాను, విజిట్ వీసా" | Exit Path questions, then fines and the embassy line |
| 9 | "నన్ను ఎయిర్పోర్ట్ లో వేరే వాళ్ళు తీసుకెళ్ళారు, నా కంపెనీ వాళ్ళు రాలేదు" | Calm Telugu line (case recorded). With transfer off: "మనిషికి కలపలేకపోయాను..." and the call continues. **Not silence.** |
| 10 | Ask a person to say an Arabic sentence near the phone | It reports their words to you in Telugu (not yet verified) |

After the call run `docker logs interpreter --since 10m`. Look for: `heard`, `confirm_ask`, `confirmed` or `cancelled`, `say`, `emergency`, `handoff_failed`.
