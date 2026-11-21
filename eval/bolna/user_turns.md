# Caller turns as heard by the base STT (Sarvam saaras:v3, language=hi)

Format: execution id · date · duration · hangup. Then the caller lines exactly as transcribed. Then **What broke**.

---

## 839cab12 · 18 Oct · 301 s · carrier call limit
- ok
- నేను తెలుగులో మాట్లాడతాను.
- నా పేరు యాదయ్యా.
- పోమని కోరుతున్నాను.
- కత కత కత
- ఆ మై చెన్ పేరు.
- సీది కవిత ఏజెంట్ పేరు.
- ఆ.
- బల్లేశం పేరు ఉంది.
- మల్లేశం పేరు ఉందా? ఏజెంట్ పేరు?
- చెల్లా మల్లేశ్వరం.
- population జగతి అల్లు పేరు ఉందండి. నెక్స్ట్ చూడండి.
- డబ్బు కాదు మా ఏజెంట్.
- విజన్ పేరు చిల్లా మల్లేష్ అంజే దేకి త్యాగు.
- ఏజెంట్ పేరేంటి?
- అతని పేరు.
- ఆమె గారు. సరే.
- చెల్లా మల్లేశం జగిత్యాల్
- ఆయన ముప్పై వేలు అడిగిండు
- నాకు వర్క్ వీసా అన్నాడు వర్గ. వర్క్ చేద్దాం.
- అను సరే అయిపోయా.
- తర్వాత ఏం చేయాలి?
- నన్ను ఎప్పుడు పంపిస్తారు ఓ మా కి?
- నన్ను ఎప్పుడు పంపిస్తారు? ఇస్తారు.
- ఇప్పుడు ఏజెంట్ ఓకేనా?
- అప్పుడు ఆయన మంచోడేనా?
- ఎందుకంటే కొందోళ్ళు మంచోళ్ళు కాదు.
- लक्ष लागेल ना.
- తెలుగులో మాట్లాడండి.
- నా పేరు నార.
- నా పేరు నరసయ్య, నేను దుబాయ్ పోతున్నాను.
- చెల్లా మలేషియన్ బైక్ గా ఉంది.

**What broke:**
- **Agent name mangled 6 different ways.** The intended name was probably "Chella Mallesham, Jagtial": బల్లేశం / మల్లేశం / చెల్లా మల్లేశ్వరం / చిల్లా మల్లేష్ / చెల్లా మలేషియన్ బైక్ / "జగతి అల్లు".
- **The bot picked the wrong agency.** It matched "Vision Tours And Travels, Hyderabad" from "విజన్ పేరు చిల్లా మల్లేష్…" and called the agent "safe".
- **Country lost.** "పోమని" and "ఓ మా కి" (Oman?) and "కత కత కత" (Qatar?) were never resolved.
- **Language switching.** The last line came out in Marathi/Hindi script ("लक्ष लागेल ना"), and the bot re-ran its Telugu greeting mid-call.
- **Users interrupted the agent 13 times.**

## 825a05db · 18 Oct · 251 s · inactivity timeout
- hello
- తెలుగులో మాట్లాడుతారు.
- దువా కించుకున్నాను.
- నేను.
- నా పేరు నా ఏజెంట్ పేరు రమేష్
- నాప్.
- నా పేరు రమేష్, నా ఏజెంట్ నెంబర్ తెలియదు.
- మా ఏజెంట్ పేరు. మల్లేష్.
- నాకు ముందు పది వేలు ఇవ్వమన్నాడు.
- మూడు లక్షలు ఇవ్వమన్నాడు.
- కానీ నాకు తను ఇంట్లో ఇవ్వమంటున్నాడు.
- నాకు
- Telanganaలో Jagityalaలో ఉండే License గారు నాకు
- ఏజెంట్ పేరు కవిత చెక్ చేయగలుగుతారా?
- ఆ 30,000.
- ఆ నన్ను ఫస్ట్ టూరిస్ట్
- తర్వాత ఉద్యోగం అయిపోయింది. తానారు.
- ఒక ఏజెంట్ ఉన్నాడు.
- బొండె గంగా నరసయ్య
- బొల్లె గంగా నరసయ్య

**What broke:**
- **"దువా కించుకున్నాను"** is probably "Dubai ki velthunnanu" (I'm going to Dubai). The country was lost.
- **Two people mixed up.** "నా పేరు నా ఏజెంట్ పేరు రమేష్" merged the worker's name and the agent's name. The bot then called the worker "Ramesh".
- **Fee kept changing** (10k advance, then 3 lakh, then 30,000). The bot finally said "30,000 is within the limit". The real ask was 3 lakh, so a self-correction or multi-amount case was resolved wrongly.
- **Tourist-visa-then-job pattern** was caught (good), but cut off mid-sentence.
- **Agent surname heard two ways:** బొండె / బొల్లె గంగా నరసయ్య.

## d2d1c8ee · 20 Oct · 231 s · caller hung up
- sorry
- तेलुगू
- మీరు తెలుగు అయినా
- ఆ పేరు నరుష్ మత్తే గారు.
- నా గుర్తు. గురుత్వలే.
- రామయ్య.
- వాలిద రెకరెన్సీ లా చూశారు.
- మ్యూజిక్.
- చెప్పిన రామయ్య వాళ్ళిద్దరూ ఏ దేశం?
- ఈ శప్త ఈ ప్రదేశం నుంచి వచ్చారు.
- లేదు, మా ఏజెంట్ ఎక్కడ ఉన్నాడో వెళ్ళేడు. అతని అల్ట్రా స్పాట్.
- రామయ్య.
- అడ్రస్ చెప్తారు మీరు.
- రామయ్య కరీంనగర్.
- ఆ ఫ్రెండ్ తెలియదు పేరు తెలుసు అంతే.
- అక్కడ నేను ఇచ్చిన ఐదు లక్షలు ఇచ్చిన.
- ఐదు లక్షలు ఇచ్చినారు.
- కానీ ఇప్పుడు ఎట్లా రావాలి?
- ఏమి తీసుకోలేదు, డైరెక్ట్ గా ఇంటికి అమ్మమన్నాడు.
- ఏం లేదు ఇంటికి రమ్మన్నాడు.
- ఆ నా పైసలు.
- చేసిన తర్వాత పని చేసుకుందాం. చేసుకోండి.
- పని చేపిస్తా అన్నాడు.
- ఈ ప్రశీద్ ఈ లెహ్నా.
- చెప్పారైనా పో రైజన్ నెంబర్

**What broke:**
- **Wrong agent offered.** "Ramaiah" matched agents in Ernakulam and Thane; the district (Karimnagar) only came later.
- **Many nonsense turns:** "వాలిద రెకరెన్సీ", "మ్యూజిక్", "అల్ట్రా స్పాట్", "ఈ ప్రశీద్ ఈ లెహ్నా" (probably "ee raseedu ee ledu", meaning "no receipt").
- **Meaning flip:** "ఇంటికి అమ్మమన్నాడు" ("told me to *sell* at home") vs "ఇంటికి రమ్మన్నాడు" ("told me to *come* home").
- **₹5 lakh paid, with no receipt.**

## 7f58b4f5 · 20 Oct · 224 s · caller hung up
- నా పేరు. ਕੀ ਆ ਬੇਜਾ।
- खेल ज्यादा है यार।
- हाँ भैया।
- నా పేరు యాదయ్య
- నేను. కాతారు పో.
- నాకేం తెలియదు బట్.
- జిల్లా నిజామాబాద్ ఏజెంట్ పేరు.
- ఏం లేదు ఒకటే పేరు రాజు.
- 1 2
- ఏజెన్సీ పేరు ఏం తెలియదు ఏం తెలియదు నాకే ఏజెన్సీ పేరు
- ఏదో కన్సల్టెన్సీ అని చెప్పారు నా దగ్గర.
- Nizamabad Manpower Consultancy
- నేను ఇచ్చిన నాలుగు లక్షలు నాకు చెప్పలేదు.
- ఐదు లక్షలు
- నేను ఏం తీసుకోవాలి ఇప్పుడు ఎట్లా?
- వర్క్ రీజన్ అది.
- ఇప్పుడు నాకు పైసలు ఎట్లా?
- సరే.

**What broke:**
- **Wrong scripts in the first three turns:** Punjabi (Gurmukhi) and Hindi. The caller was speaking Telugu.
- **Country:** "కాతారు పో" is probably "Qatar ki po…". The bot never confirmed it.
- **Two amounts, not resolved:** 4 lakh, then 5 lakh.
- **Visa type guessed:** "వర్క్ రీజన్ అది" was treated as "work visa".

## 6bb7d5c6 · 20 Oct · 300 s · carrier call limit
- नहीं तो ना गल के। की।
- ఏజెంట్ పేరు రమేష్. జిల్లా జగిరి. జగితి అవుతా.
- అవును.
- మూడు లక్షలు అడిగింది.
- నాలుగు లక్షలు.
- తీసుకోవాలి.
- సుందర్. సందవ్ సింగ. బస్ నా వీడు రా.
- టూరిస్ట్ వీజా
- లేదు.
- నాకు ఇంకో కోడ్ ఉంది.
- నేను ఇప్పుడు
- నేను ఎయిర్పోర్ట్ లో రిపోర్ట్ లో ఉన్నాను.
- అన్ని ఉన్నాయి.
- నేను Oman పోతున్నాను
- నన్ను కాపాడండి మా యజమాని నాకు
- నాకు పైసలు ఇవ్వడం లేదు నా పాస్. ఆ స్పష్టీ స్పష్టీ. తీసుకున్నాడు.
- నాకు సహాయం చేయండి నేను ఇప్పుడు.
- నేను ఇప్పుడు Omanలో ఉన్నానండి. మా.
- యాజమాని ఇంట్లో ఉన్నాను వాళ్ళు నాకు.
- తిండి పెట్టడం లేదని పాస్పోర్ట్ తీసుకున్నారు.
- నాకేం తెలియదు మీరే హెల్ప్ చేయండి
- ఓనర్ కొడుతున్నాడు.
- నన్ను ఓనర్ కోరుతున్నాడు, నేను ఓమన్లో ఉన్నాను.
- ఒమన్. ఖతర్.
- కదర్ కదర్ లో ఉన్నాను.
- నాకు నగరం తెలియదు, నన్ను ఇక్కడ వేరే వీసా మీద తీసుకొచ్చిరు, నాకు వేరే పని చెప్పిరు.
- పాస్పోర్ట్ తీసుకున్నారు నాకు ఇవ్వరు లేదు.
- ఏం తెలియదు ఇప్పుడు ఏం చేయాలి నన్ను కొడుతున్నారు నాకు. నాకు పైసలు ఇయ్యటం లేదు.
- నాకు ఇక్కడ ఎవ్వలు తెలియదు.
- ఏ నాకేం తెలీదు నాకు. నాకు

**What broke** (this is the key demo call):
- **Place:** "జగిరి / జగితి" is Jagtial, misheard.
- **Wrong agent confirmed.** The bot matched "RAMESH S, Operational Energy Group, Chennai", and the caller said "అవును" to a district they never said.
- **Visa:** "సుందర్. సందవ్ సింగ" is probably "sandarshana visa" (visit visa).
- **Distress, kill/kiss type:** "ఓనర్ కొడుతున్నాడు" (owner is beating me) was heard right once, then as "ఓనర్ **కోరుతున్నాడు**" (owner *wants*). This is a one-letter meaning flip.
- **Passport:** "నా పాస్. ఆ స్పష్టీ స్పష్టీ. తీసుకున్నాడు" means passport taken, but heard as garbage the first time.
- **Country:** Oman, then Qatar, then "కదర్". Wrong visa, wrong job, no food, beaten, no pay.
- **The bot never escalated to a human.** It kept giving generic advice ("contact the embassy, MADAD") and asking "which city?". It was interrupted 10 times, and the call was cut by the carrier at 300 s.

## 22b72629 · 20 Oct · 182 s · caller hung up
- ऐं टी ऐं टी।
- ఏంటిది ఏంటిది ఈ మాట అంటే?
- నా పేరు Ellareddy నేను.
- యూకే వెళ్ళాలనుకుంటున్నాను. అనుకుంటున్నాను.
- లైసెన్స్ నెంబర్ లేదు.
- వ్యక్తి తెలుసా అని చెప్పాలి.
- కరీంనగర్.
- ఏజెన్సీ ఏం పేరు లేదు.
- ఏజెన్సీ పేరు ఏం లేదు.
- మనిషే తెలుసు మాకు. ఇంటి పేరు దల.
- లేదు.
- ఐదు లక్షలు అడిగారు కానీ ఏమి ఇవ్వలేదు.
- గుండె ఇడ
- ఉద్యోగ విధి కోసం.
- ఇవ్వలేరు.

**What broke:**
- **First turn in Devanagari** ("ऐं टी ऐं टी" = "enti enti"), from the `language: hi` setting.
- **Country "యూకే"** is unclear: UK? Kuwait? It was never confirmed. The surname was lost ("ఇంటి పేరు దల").
- **Ambiguous negation:** "ఇవ్వలేరు" ("they can't give") was the answer to "you haven't given your passport, right?". The bot treated it as safe.
- **Good:** the ₹5 lakh ask (nothing paid yet) was caught as illegal.

## 12e3c302 · 20 Oct · 127 s · caller hung up
- आया मैं खतर में हूं।
- పాస్పోర్ట్ తీసుకున్నారు, నేను ఇప్పుడు ఎండ్లో ఎట్లా రావాలి?
- నన్ను నా ఏజెంట్.
- 5 లక్షలు తీసుకొని మోసం చేసిండు.
- ఆ నన్ను ఐదు లక్షలు తీసుకోండి. తీసుకోండి.
- నన్ను ఐ లెక్కలు తీసుకొని నన్ను
- ఇక్కడికి పంపించిండు ఇక్కడ నన్ను.
- నన్ను ఏజెంట్
- నేను చెప్పే వరకు వినండి.
- నన్ను ఏజెంట్ పంపించిండు వర్క్ వీసా అని చెప్పి
- అని చెప్పి ప్లీజ్ అప్లై చేయండి.
- ఆ మీరు ఆగండి.
- నా దగ్గర ఐదు లక్షలు. టైప్ షైలు తీసుకోండి. తీసుకొని
- నన్ను మోసం చేసిండు దాని తర్వాత నన్ను

**What broke:**
- **"आया मैं खतर में हूं"** is Hindi script. It could be "I'm in danger" (khatre) or "I'm in **Qatar**" (Telugu "Qatar lo unnanu"). One word changes meaning, location and severity.
- **The bot made up actions:** "మేము మీ కుటుంబానికి చెప్పాము… ఫిర్యాదు సిద్ధం చేసాము" (we informed your family and prepared a complaint). Nothing was done. This is the most dangerous failure in the logs.
- **"ఐ లెక్కలు"** = "aidu lakshalu" (5 lakh), misheard.
- **The caller said "నేను చెప్పే వరకు వినండి"** ("listen until I finish"). The bot cut them off 7 times. This is turn-taking, the trust problem.

## bc44db4c · 20 Oct · 175 s · caller hung up
- नमस्कार।
- नमस्कार, मैं मैं याद है।
- నా పేరు యాలయ.
- అయితే నన్ను ఏజెంట్ మోసం చేసిండు పది లక్షలు తీసుకుని తీసుకొని. నన్ను
- నన్ను ఎయిర్పోర్ట్ లో వేరే వాళ్ళు పిలిచి
- నాకు సహాయం కావాలి, నేను దుబాయ్లో ఉన్నాను.
- నేను.
- నాకు చెప్పింది ఆ
- క్లీనింగ్ బల్ ని నీడా
- అవును.
- 9XX XX   *(family number, redacted)*
- నైన్ డబల్ ఫోర్ … ఎయిట్   *(English digit words with "double", redacted)*
- జీరో … సిక్స్టీ పేరు. లత   *("sixty" = tens word; redacted)*
- అయితే నా పాస్పోర్ట్ తీసుకున్నారు, ఇప్పుడు నాకు పైసలు ఇవ్వలేదు, 3 నెలలు అయింది.
- నేను బుర్జ్ ఖలిఫా దగ్గర ఉన్నాను
- నాకు.
- వండ పని అని చెప్పారు. సరే కానీ నేను. ఆ.
- నేను ఇక్కడ ఫామ్ లో ఉన్నాను నాకు. నాకు.
- 9XX
- 9XXXX జిల్లాకి X.X, X.X   *(digits partly heard as "జిల్లాకి" and decimals; redacted)*
- *(10 Telugu digit words — తొమ్మిది … రెండు — redacted)*
- నా.
- నాకు పాస్పోర్ట్ ఇవ్వలేదని కూడా నేను కొడుకుతున్నాను. కొడుతున్నారు.
- బుర్జ్ ఖలీఫా దుబాయ్
- ఇక్కడ నేను పశువులతోని పని చేస్తున్నాను. చేస్తున్నాను.

**What broke:**
- **The Goat Life pattern, on a real call:**
  - Picked up at the airport by other people ("ఎయిర్పోర్ట్ లో వేరే వాళ్ళు పిలిచి").
  - Promised cleaning or cooking work ("వండ పని"), but working on a farm with cattle.
  - Passport taken, no pay for 3 months, beaten.
- **Phone number took 4 attempts:**
  - "9XX XX" → "నైన్ డబల్ ఫోర్ … ఎయిట్" + "జీరో … సిక్స్టీ" → "9XXXX **జిల్లాకి X.X, X.X**" → finally Telugu digits.
  - The harness phone decoder handles exactly this.
- **Distress word garbled:** "నేను కొడుకుతున్నాను" (garbled) before "కొడుతున్నారు" (they are beating me). The bot said "don't be scared, which city?" and **never escalated**.

## 3d12bcdc · 20 Oct · 218 s · ended by LLM error
- తెలుగు.
- అయ్యా, నా పేరు మల్లయ్య.
- నన్ను నా ఏజెంట్ ఇట్లా మోసం చేసిండు.
- నాకు తెలియదయ్యా మన ఏజెంట్ మోసం చేసి నేను దుబాయ్ లో ఉన్నాను. ఇప్పుడు.
- నేను ఇప్పుడు దుబాయ్లో ఉన్నాను.
- నన్ను మోసం చేసిండ్రు ఆ లక్షలు ఇస్తాడు. తీసుకొని
- అయ్యా నాకు వీసా అని చెప్పేసి నాకు అప్లై చేసిరు నాకు ఇది
- అని చెప్పిర్రు బట్ నన్ను ఇక్కడ వేరే దగ్గర
- సందర్శక వీజా.
- అయ్యా నన్ను పని చేపించుకుంటురు అయ్యా ఇక్కడ.
- ఇక్కడ ఆరు నెలలు ఉన్నాయి.
- ఓన్లీ
- ఓన్లీ రెండు నెలలు అందింది మిగతా ఏమి అందలేదు
- తెలీదు.
- జగిత్యాల జగిత్యాల పావిలాక్షల్
- పదిహేను లక్షలు ఇచ్చినాము.
- అయ్యో ఇప్పుడు నేను బయట
- ఇప్పుడు నేను బయట ఎట్లా వాడాలి ఇప్పుడు నేను
- ఇప్పుడు నాకు ఇండియా రావాలి నాకు
- Dubai అని చెప్పినా కదయ్యా
- 9XXXX
- 9XXXX జూలై ఎయిట్ XXXX   *("zero" heard as "జూలై"; redacted)*
- అదే అదే నెంబర్
- నేను ఇప్పుడు.
- పంట చేస్తున్నాను.
- నేను ఇక్కడ ఒక రూమ్ లో ఉన్నాను.
- అవును.
- జగీత్యాలయ

**What broke:**
- **"zero" became "జూలై" (July).** "9XXXX జూలై ఎయిట్ XXXX" lost a digit. The bot read back a 9-digit number (9 digits), the caller said "అదే అదే", and the bot saved a **wrong family number**.
- **Same question repeated:** asked "which city?" 3 times. The caller: "Dubai అని చెప్పినా కదయ్యా" ("I already said Dubai").
- **Jagtial spelled 3 ways:** జగిత్యాల / జగిత్యాలయ / జగీత్యాలయ. Plus "పావిలాక్షల్", unclear (a "pavu laksha" amount?).
- **Bolna's post-call extraction got this call right:** visit visa, 4 months unpaid, wants to return, threatened = not said.

## d5acc09e · 20 Oct · 182 s · caller hung up
- తెలుగు.
- Rajesh
- ఏమో నా ఎడ్యున్ పేరు రాజేష్ కరేం నాన్న, నన్ను ఇప్పుడు నేను.
- ఓమన్ ఎయిర్పోర్ట్ లో ఉన్నాను. నేను వేరే. ఒకతను వచ్చి తీసుకెళ్ళిండు.
- అవునండి, ఇప్పుడు నన్ను వేరే అతను తీసుకెళ్తున్నాడు నాకు.
- ఇప్పుడు కంప్యూటర్ అని చెప్పిరి. పీరీకరణను గొర్రె మందులు వేశారండి.
- తిండి పెట్టలేదు అని కొడుతున్నారు.
- నా నెంబర్ తెలియదండి, మీరే సహాయం చేయండి, నన్ను ఇండియా పంపించండి.
- ఒమన్.
- మా ఇంట్లో మా ఇంట్లో వాళ్ళకి చెప్పండి నాకు సహాయం కావాలి.
- సరే చేస్తా.

**What broke:**
- **Words mangled:**
  - "నా ఎడ్యున్ పేరు రాజేష్ కరేం నాన్న" is probably "naa agent peru Rajesh, Karimnagar…". "Agent" became "ఎడ్యున్" and Karimnagar was lost.
  - "కంప్యూటర్ అని చెప్పిరి. పీరీకరణను గొర్రె మందులు వేశారండి" is probably "told me computer (job), but put me with **sheep herds** (గొర్రె మందలు)". That's the **Goat Life job switch**, in garbled text.
- **The airport-stranger pattern, on a real call:** "ఒకతను వచ్చి తీసుకెళ్ళిండు".
- **The bot made up actions:** it said "మీ కుటుంబానికి సమాచారం ఇచ్చాం" (we informed your family) twice, and gave a case number. Bolna's post-call extraction did set threatened = yes.

## 2d3958cc · 21 Oct · 122 s · caller hung up
- తెలుగు మాటలు. ಮಾತಾಡೋಣ.
- నా. నేను వాహ్ వాహ్ వాహ్. దుబాయ్ వెళ్ళాను.
- అక్కడ పోయిన తర్వాత నా పాస్పోర్ట్ పోయింది.
- స్పాన్సర్ ఇదివర విజయ ఇచ్చిన అతను.
- తీసుకునే వెళ్ళాడు ఆయన దొరుకుతాడు. దొరుకుతారు ఏడు.
- ఇప్పుడు నేను ఇండియాకి రావాలంటే ఏం చేయాలి?
- అంటే వివరాలు చెప్పాలా?
- దేరా Dubai

**What broke:**
- **Kannada script appeared** ("ಮಾತಾಡೋಣ").
- **"visa" heard as "విజయ"** (Vijaya, a name) in "స్పాన్సర్ ఇదివర విజయ ఇచ్చిన అతను". The likely meaning was "the sponsor who gave the visa took it".
- **Passport "పోయింది" (lost) vs taken by the sponsor** is ambiguous. That's a meaning flip with legal weight.
- The bot's own reply contained **Gujarati and Tamil words** ("અન્ય", "எண்ணுக்கு", "தொடர்பு கொள்ள"), so the TTS/LLM side also drifts.

## d09a4337 · 21 Oct · 275 s · caller hung up
- ఇది బాగుంది.
- నేను.
- Nizamabadలో ఒక Agentని కలిశాను శాం
- అది తెలియదండి మనిషి అవకాశం. పేరు అంటే
- పేరు ఆయన పేరు Ramesh.
- ఇస్తలేడు డబ్బులు ఇమ్మంటాడు నీకు విజయ్. ఇస్తా
- ఇప్పుడు లక్ష రూపాయలు కట్టాలి. కట్టా అండి.
- అలా ఏం లేదు.
- ఆ డబ్బుకు ఏమన్నా ఉంది.
- ఇక్కడ కే టికా ఉంది కదా ఇది. అయితా ఉంది.
- అతను ఏమంటున్నాడంటే టూరిస్ట్ వీసా మీద
- తీసుకెళ్లి అక్కడ వర్క్ పర్మిట్ ఇస్తానంటే
- అంటే ఎందుకండీ అంటే విజిట్లో వెళ్ళే అక్కడ వర్క్ వర్క్ పర్మిట్ చేసుకోరా?
- అంటే మా బ్రదర్ ఏమన్నాడు.
- తలానే వెళ్ళాడు విజిట్లో వెళ్లి
- ఆ విజిట్ విజయ్ మీద పోయి ఆ సరే. ఆ.
- స్పాన్సర్ విజిట్ చేంజ్ చేసుకున్నారు.
- పనికి వెళ్లడం లేదని వర్క్ వీసా కొరకు వెయిట్ చేస్తున్నాం.
- ఇది నా పేరు.
- ఏజెంట్ ఆయనే తెలిసిన ఆయన పంపిస్తారు. పంపిస్తాను. అనంటుండు. వెళ్ళాలా వద్దా?
- ఒక ఇద్దరి పేర్లు చెప్పాలి.
- చెప్పండి నిజాంబాద్ ఏజెంట్ లో
- మాకు నిజామాబాద్ నిజామాబాద్ లో ఒక మంచి ఇద్దరు ఏజెంట్ల పేరు చెప్పండి లైసెన్స్ హోల్డర్లు
- అంటే ఇప్పుడు అక్కడ ఎవరు ఉన్నారు అన్నది తెలియదా?
- సరే థాంక్యూ.
- ఓకే.

**What broke:**
- **"visa" became "విజయ్" again**, three times: "నీకు విజయ్", "విజిట్ విజయ్ మీద". This is a systematic error, so it belongs in the harness lexicon.
- **"టికెట్" became "టికా".**
- **Good:** the bot handled the "tourist visa → work permit later" trap well, and refused to invent agent names.

## 94aa6eac · 22 Oct · 182 s · caller hung up
- తెలుగు.
- పైసలు అడుగుతున్నాడు.
- పదిహేను లక్షలు
- అవును
- నాకు నెంబర్ తెలుసు కావాలా?
- అది.
- అవును నెంబర్ చప్పలా
- 98 48 జీరో వన్ టూ త్రీ ఫోర్ ఫైవ్   *(test number)*
- అంటే ఏజెంట్ మోసం వేసిందా?
- నన్ను ఎప్పుడూ నమ్మట్లేదు. అమ్మ చాలే అంటే అవును బా
- సరే ఇవ్వా. ఇవ్వను.
- సరే అన్న థ్యాంక్ యూ
- ఓకే అన్న.

**What broke:**
- **The cleanest call.** The phone number came through as mixed digits and English words, and the harness phone decoder turns that into +91 98480 12345.
- **Self-correction:** "సరే ఇవ్వా. ఇవ్వను." means "ok I'll give… I won't give". The final intent is **won't pay**, which is what L3 resolves.

## 9915de46 · 20 Oct · 26 s · inactivity timeout
- *(no caller speech transcribed)*

**What broke:** the caller's speech was not picked up at all. The bot asked "are you still on the line?" **in Hindi** and hung up.

## 9eb5cf51 · 27 Oct · 42 s · caller hung up
- హలో తెలుగు నా పేరు రమేష్
- నా పేరు రమేష్, నాకు ఒక ఏజెంట్ మోసం చేశాడు, నేను ఒక రెండు లక్షల రూపాయలు ఇచ్చాను.

**What broke:** nothing in the transcript. This is a clean, short scripted test, and "రెండు లక్షల" was correctly turned into ₹2,00,000.

## 2c0afbb9 · 27 Oct · 40 s · caller hung up
- తెలుగు నా పేరు రమేష్
- నన్ను ఒక ఏజెంట్ మోసం చేశాడు, నేను ఇప్పుడు దుబాయ్లో ఉన్నాను.
- నాకు ఎవ్వరూ తెలీదు ఏం చేయాలి

**What broke:** the transcript was clean. But the bot again claimed the "case is registered urgently" and read out a case number. Whether a real case exists depends on your webhook backend; check this.

## 470ffc46 · 3 Nov · 51 s · caller hung up
- తెలుగు.
- నా పేరు రమేష్, నేను ఇక్కడ ఎయిర్పోర్ట్లో నన్ను వేరే వాళ్ళు వచ్చి తీసుకెళ్లారు, బట్ నేను ఇక్కడ చాలా కష్టాల్లో ఉన్నాను.
- నాకు వెంటనే హెల్ప్ చేయండి.

**What broke:**
- **Airport-stranger pattern, heard clean.** Bolna's extraction set `taken_by_stranger = yes`.
- **The bot reused the same case number "GS-W9HWSY"** it had given in other calls on other days, and said "your case has been open 13 days". All test calls come from one phone number, so the backend merges them. Fine for testing, but it would mislead a real caller.

---
# Saathi Check-in agent (4ec8d84e)

Context the agent received for every call (the **promise record**, harness L0):
- case GS-W9HWSY, worker మల్లయ్య, Dubai, UAE
- employer "AI NOOR CLEANING", promised job: cleaner
- **code phrase "అమ్మ బాగుందా"**
- call kinds: briefing / arrival / weekly

## 9fdec4d2 · 21 Oct · 167 s · arrival · caller hung up
- नमस्कार।
- తెలుగు
- నేను తెలుగులో మాట్లాడతాను.
- నాకు.
- నాకు హిందీ రాదు తెలుగులో మాట్లాడండి.
- नाही.
- ఓకే.
- తెలుగు
- చేరుకున్నాను.
- ఆ వాళ్ళే తీసుకుంటారు. తీసుకున్నారు.
- తెలియదు.
- క్లీనింగ్
- అవును.
- హలో.
- నేను.
- దుబాయ్లో ఉన్నాను.
- నన్ను వేరే వాళ్ళు తీసుకు. తీసుకెళ్ళారు.
- నేను వెయ్యి
- నా కంపెనీ వాళ్ళు కాకుండా వేరే వాళ్ళు తీసుకుంటారు. తీసుకెళ్లారు.
- అర్థం కాలేదు.
- నన్ను కిడ్నాప్ చేశారు.

**What broke:**
- **The bot spoke Hindi for 5 turns** after the caller asked for Telugu 4 times, including "నాకు హిందీ రాదు" ("I don't know Hindi").
- **"नाही"** (Marathi/Hindi "no") was taken as "not reached Dubai". Seconds later the caller said "చేరుకున్నాను" ("I reached"). That's a meaning flip caused by a wrong-language transcript.
- **The caller self-corrected:** "ఆ వాళ్ళే తీసుకుంటారు. తీసుకున్నారు" (yes, they took me) became "వేరే వాళ్ళు తీసుకెళ్ళారు" (OTHER people took me). The final truth is a **pickup mismatch**, which L3 self-correction should catch.
- **"నన్ను కిడ్నాప్ చేశారు"** ("I was kidnapped") got the reply "అర్థమైంది. మీరు ఒంటరి కాదు" ("understood, you are not alone"), repeated 4 times. **No escalation, no follow-up question.** This is the clearest example of why the L4 gate must be code, not prompt.

## 60e0c7b3 · 21 Oct · 63 s · arrival · caller hung up
- తెలుగులో మాట్లాడతారా?
- ఆ చేరుకున్నాను.
- లేదు వేరే వాళ్ళు.
- నన్ను వాళ్ళు తీసుకెళ్ళలేదు. కొత్త వాళ్ళు తీసుకెళ్లారు.
- సరే.

**What broke:**
- The transcript is clean, and the **pickup mismatch was stated clearly**: "not them, new people took me".
- The bot answered "you are not alone, take care, bye", so the **risk was heard but not acted on**. Bolna's extraction set `taken_by_stranger = yes`.

## 96d83759 · 21 Oct · 59 s · weekly · caller hung up
- చెప్పండి.
- రాలేదండి ఇంకా. నా ఇవ్వలేదు.
- అవునవును.
- 3 నెలలు.
- లేదు.

**What broke:**
- The transcript is clean: salary not paid for 3 months, passport NOT with him.
- **Negation handled right by STT** ("రాలేదండి", "ఇవ్వలేదు"). But again the bot said "you are not alone, take care", with no escalation.

## 106017a4 · 21 Oct · 109 s · briefing · caller hung up
- చెప్పండి।
- తెలుగు మాట్లాడతాను.
- మాట్లాడండి.
- మీరు హిందీలో మాట్లాడుతున్నారు.
- నాకేంది రాదు.
- నై.
- एक ही काम नहीं आता।
- हाँ। अच्छा। सही है।
- తెలుగులో చెప్తా.
- సరే.

**What broke:**
- **The whole briefing was in Hindi** despite 4 requests for Telugu ("మీరు హిందీలో మాట్లాడుతున్నారు" = "you're speaking Hindi").
- **"నై" ("no", the job is NOT cleaning)** was overridden: the bot re-asked until the caller said "हाँ… सही है". The promise record was **confirmed under pressure, in a language the caller said they don't know**.

## 26166a1b · 21 Oct · 107 s · arrival · caller hung up
- చెప్పండి।
- తెలుగులో మాట్లాడండి.
- నాకు తెలుగులో మాట్లాడండి.
- అవును.
- నేను ఎయిర్పోర్ట్ బయట ఉన్నాను. దుబాయ్లో
- లేదు వేరే వాళ్ళు
- సరే.
- నన్ను వేరే వాళ్ళు తీసుకెళ్ళారు.
- అదేం చేయాలి? నా దగ్గర. డగర్ పాస్ పాస్పోర్ట్ లేదు.

**What broke:**
- **Template bug:** the greeting said "నమస్కారం **{worker_name}** గారు". The context variable was not filled.
- **The bot refused Telugu at first:** "माफ़ कीजिए, इस कॉल में मैं हिंदी में ही बात करूँगा" ("sorry, I'll speak only Hindi on this call").
- **Pickup mismatch plus no passport.** The bot said "you are not alone, take care, **goodbye**" while the caller was still asking "what should I do?".

## 2354dfd3 · 21 Oct · 117 s · arrival · caller hung up
- मैं दुबई से बोलता हूँ।
- నేను Dubai నుండి మాట్లాడుతున్నాను.
- తెలుగు తెలుగు
- తెలుగు తెలుగు నేను తెలుగులో మాట్లాడతాను.
- నేను తెలుగులో మాట్లాడతాను.
- తెలుగు తెలుగు మే బత్ బాత్ కో. ఏ రోజు నా?
- వేరే కంపెనీ వాళ్ళు.
- పని మంచిగా ఉందని చెప్పండి. అని చెప్పాను. తెలిసిన వాళ్ళు తీసుకెళ్లారు. హలో
- ఉంటది కాదంటే ఎలా? హలో.

**What broke:**
- **The same Telugu sentence was transcribed twice:** first in Hindi ("मैं दुबई से बोलता हूँ"), then in Telugu.
- **The caller asked for Telugu 4 times** before the bot switched.
- **Possible coercion signal:** "పని మంచిగా ఉందని చెప్పండి. అని చెప్పాను." could be "**they told me to say the work is good**, so I said it". That's the case the code phrase is for, and nothing caught it. Bolna's own summary turned it into "the work was good and conducted by known people", a **meaning flip in the summary**.

## 4eff712a · 21 Oct · 57 s · weekly · caller hung up
- చెప్పండి.
- రాలేదండి. రెండు నెలలు అయింది.
- మా దగ్గర లేదండి అయ్యా. అది. తీసుకున్నాడు ఆ. Arabat అందింది చేసుకున్నాడు.
- ఉమ్.

**What broke:**
- **"Arabat" is "arbab"** (the boss), misheard. The harness Gulf glossary has arbab; add "arabat" as an ASR variant.
- **The bot claimed "మీ ఫిర్యాదును సిద్ధం చేశాం"** (we prepared your complaint). Check whether the backend actually did.

## 59dc411a · 21 Oct · 123 s · arrival · caller hung up
- जब पहले।
- తెలుగులో చెప్పండి.
- తెలుగు తెలుగు బాల్ అవుతుంది. తెలుగు మాట్లాడాలి.
- ఆ.
- చేరుకున్నాను వేరే వాళ్ళు తీసుకెళ్లారు.
- నెంబర్ ఎట్లా దొరకాలి?
- ఓకే. వేరే. జై గాయ్ జీ
- ఇప్పుడు నేను ఏం చేయాలి వీసా కాక వేరే వాళ్ళు తీసుకుని పోయారు. ఆ.
- వారు ఒక రూమ్లో తీసుకుపోయించారు. పాస్పోర్ట్ తీసుకున్నారు. నాకు సమాధానం ఏమి ఇస్తలేరు.

**What broke:**
- **Goat Life sequence:** taken by strangers, put in a room, passport taken, no answers.
- **The bot could not give an embassy number:** "నా దగ్గర ఫోన్ నంబర్ లేదు… వెతికి…" ("I don't have the number… search for it"). That's a missing knowledge-base fact, not an STT error.
- **The reply had a Kannada letter** ("ಅರ್ಥమైంది").

## 4825cf9a · 21 Oct · 74 s · arrival (scheduled) · caller hung up
- చెప్పండి.
- చేరుకున్నాను.
- అవును.
- దుబాయ్.
- క్లీనింగ్
- ఆ. అవును.

**What broke:** nothing. This is the **happy path**, and it's a useful control clip: no risks, so the harness must flag nothing (it checks false alarms).

## 8b9f0a31 · 21 Oct · 6 s
- *(not fetched. A 6-second call, no conversation.)*
