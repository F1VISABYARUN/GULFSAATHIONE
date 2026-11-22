# Prompt for Codex: build the Gulf Saathi pitch deck (5 slides)

Copy everything below the line into Codex. Images already in the repo are listed by path; new images to generate are described in section 5.

---

## 1. Your task
Build a **five-slide** deck (PowerPoint `.pptx` plus a PDF) for the Builders '26 judges, with speaker notes and source links. Audience: judges who read AI-agent-built projects and will also open the live site and phone line. Tone: plain, honest, specific. No hype, no invented numbers.

Your earlier draft treated Gulf Saathi as only "check a promise and report what changed". That is too narrow and leaves out half the product. Rebuild it around the full picture below.

## 2. What Gulf Saathi is (one sentence)
Gulf Saathi is a **migrant risk intelligence layer**, reached by a plain phone call in Telugu: it helps **before** a worker pays and flies, **during** a call abroad (including speaking Arabic for the worker), and **after** trouble starts (a case file a caseworker can act on). It is not only a translator.

## 3. The product, in four parts (use all four)
1. **Before: check the recruitment.** The worker says the agent's name, fee and visa. Saathi checks the agent against the government's active recruiting-agent list (MEA, 2,388 agents plus 16 state agents; read automatically from a PDF, so a missing name is not proof of anything), checks the fee against the legal limit (₹30,000 plus 18% GST in our rules file), and flags a visit visa offered for work. The promise is recorded: employer, job, salary, hours, fee.
2. **During: an AI interpreter on the same call.** One phone call, one number. The Telugu agent listens, **asks the worker first** ("I will tell him in Arabic: …, OK?"), and only after the worker says yes speaks Arabic to the other person, who first hears a short line that this is an AI speaking for the worker. It then tells the worker in Telugu what the other person said. It can also find the nearest police station, pharmacy, hospital or embassy from a landmark, give directions, and, if a visa is ending, give a plan that uses only fines and fees read on official pages.
3. **Risk layer.** Fixed rules, not the AI, decide the risk level. Numbers are read back before they are saved. Negations ("did not give") are kept. Danger words (passport taken, no food, beaten) escalate to a human and create a case. This is what "risk intelligence" means here.
4. **After: the case packet.** The system collects the facts the caller actually said into a case file: who, where, which agent, what was promised, what happened, the risk level and a timeline. A caseworker can acknowledge, add notes and close the case. It helps prepare the facts for a MADAD complaint; the worker or caseworker files it on madad.gov.in, Gulf Saathi does not file it. A Telugu message for the family can be sent only with consent (SMS is in dry-run until the provider is configured).

Also on the live site: a **data page** that explains each government dataset, why it is needed and its limits, and a **"Get a call"** form (direct call, no OTP, consent required, rate-limited).

## 4. Facts you may state (with sources) and things you must NOT claim
**May state:**
- 9.9 million Indians live in the six Gulf countries (MEA, Dec 2025) and about 15 lakh are from Telangana (The Hindu, Mar 2026): both were taken from the earlier site and not independently re-checked by us. Say "per MEA" / "per The Hindu".
- 72% of surveyed Telangana returnees borrowed money to migrate (IOM / CESS survey; we confirmed the sentence "around 72 per cent of the respondents affirmed that they raised loans" in the report).
- Speech test on **60 Telugu read Wikipedia sentences (FLEURS), not worker calls**: transcription word error rate **30.3% on clean audio, 32.7% at 8 kHz phone quality, 48.8% on noisy phone-band audio** (model gpt-4o-transcribe). Source: `docs/EVAL_REPORT_2026-11-22.md`. Always say "read sentences, not real calls".
- Verified on real test calls: the server answers, greets in Telugu, understands spoken Telugu, handles interruptions, finds a police station from a landmark, and after the worker says yes speaks Arabic with the AI-disclosure line.
- Field context: the team sat in at the Pravasi Prajavani desk at Praja Bhavan, Hyderabad (30 Oct 2026) and was told a pilot could start in Jagtial: these are the team's own statements, label them as such.

**Must NOT claim:**
- Not "all languages": today is **Telangana, Telugu with Arabic**. Roadmap: more worker languages and states, then any language, each opened only after native-speaker testing. Say "planned, not built".
- Arabic voice quality, an Arabic speaker's reply translated back, many callers at once, and outbound check-in calls end to end are **not yet verified**.
- Do not say Gulf Saathi files complaints, rescues people, promises return dates, or calls an agent safe or fraudulent.
- Do not call the project an "agent scam" detector. It checks recruitment details against official data.
- Do not use the old Vercel address. The live site is **https://d2kq7o4x2k0pos.cloudfront.net/** and the phone line is **+91 80659 52403**. The test-call recording is at `/#hear` on that site.
- Test call recordings and the demo video are from an earlier version that used a different voice provider; say "earlier version".

## 5. Slides (exact content)
**Slide 1: Gulf Saathi.** Title line: "When a worker reaches the Gulf, who remembers exactly what the agent promised?" Sub: "A migrant risk intelligence layer, on a phone call, in Telugu." Show the phone number and the live site. Image: `public/site/on-the-line.webp`.

**Slide 2: The problem.** Three sourced numbers (9.9M, 15 lakh, 72%) as large figures; one sentence: promises are spoken, the family takes on debt, and abroad a worker who does not speak Arabic cannot explain a lost passport or a wrong job. Image: `public/site/promise.webp`.

**Slide 3: Before, during, after.** A three-column journey: Before (agent, fee and visa check; the promise recorded), During (Telugu line, AI interpreter that asks first, places and directions, visa-ending plan), After (case packet: facts, risk level, timeline; caseworker desk; MADAD help; family message with consent). One example question per column. Image: `public/site/gs_family_sms.webp` and `public/site/gs_caseworker.webp`.

**Slide 4: The interpreter, in one call (the demo slide).** A simple flow diagram: Worker (Telugu) → Gulf Saathi (asks "OK?") → Other person (Arabic) → Gulf Saathi → Worker (Telugu). Four steps with the example "my passport is lost / أنا فقدت جوازي هنا": the agent proposes the Arabic, the worker says "సరే", the other person hears an AI notice then the sentence. Add a QR or link to the test call on the live site. Image: new image A (below).

**Slide 5: Proof, limits and what is next.** Left: the speech bar chart (30.3% clean, 32.7% phone, 48.8% noisy; caption "60 read Telugu sentences, not worker calls"). Middle: "Verified" and "Not yet verified" lists from section 4. Right: roadmap "Now Telangana + Arabic → Next more languages and states → Goal all languages, tested by native speakers" and the pilot plan: measure missed critical facts, time to first human contact, and case outcomes. Image: `public/site/gs_dashboard.webp` labelled "fictional demo case".

Speaker notes for every slide: 3 to 5 plain sentences, plus the source links used on that slide.

## 6. Images
**Use as they are (already in the repo, AI-generated illustrations; label them "AI-generated illustration"):**
- `public/site/on-the-line.webp` worker on a phone on a Gulf city street
- `public/site/promise.webp` family reviewing job papers
- `public/site/gs_family_sms.webp` mother reading a message on her phone
- `public/site/gs_caseworker.webp` caseworker with a headset
- `public/site/gs_prajavani.webp` and `gs_pitch_wide.webp` real photos from Pravasi Prajavani (do not alter them)
- `public/site/gs_dashboard.webp` screenshot of the caseworker desk with a made-up demo case

**Generate (style: warm flat illustration, paper background #f8f7f1, deep green #175445, orange accent #c3663d, no text inside the image, no real people or logos):**
- **A. Interpreter flow.** Three figures in a row: a South Asian worker holding a basic phone, a small friendly phone-shaped assistant in the middle with two speech bubbles (one Telugu-script squiggle, one Arabic-script squiggle), and a shopkeeper or doctor in a Gulf setting on the right. Soft arrows left to right and back. Bubbles must contain no readable text.
- **B. Risk layer.** An abstract shield over a phone call waveform, with three small icons around it: a document with a tick, a rupee coin against a bar (fee limit) and a passport. No text.
- **C. Case packet.** A tidy folder or file card with icons for: person, place, agent, promise, timeline and a flag. No readable text.
- **D. Language roadmap.** A map outline of India's south (Telangana highlighted) with arcs reaching toward a stylised Gulf coast, and small empty speech-bubble shapes along the arcs. No names of languages inside the image.

Alt text for every image. Do not add faces of real people.

## 7. Style
Fonts: DM Sans for body, Instrument Serif for titles, Noto Sans Telugu for any Telugu. Colours: paper #f8f7f1, ink #172f29, green #175445, orange #c3663d. Large type, at most 5 bullets or one diagram per slide, one idea per slide. Check that the Telugu renders correctly in the PDF.

## 8. Deliver
`Gulf-Saathi.pptx`, `Gulf-Saathi.pdf`, and a zip of the generated images with a caption file that marks each image as AI-generated or fictional. List every number in the deck with its source, and list anything you were unsure about.
