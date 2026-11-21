# Telangana Mandal Gazetteer (Jagtial, Karimnagar, Rajanna Sircilla, Nizamabad, Kamareddy, Nirmal, Peddapalli, Mancherial)

Research date: 2026-11-21. Machine-readable output: `server/data/research/mandals.json` (has extra keys `district_aliases` and an optional per-mandal `note`. Aliases include auto-generated -palli/-pally/-palle and -pet/-peta variants).

## Current mandal list per district (with source date)

### Takeaway
Official NIC district sites were reachable for 7 of 8 districts (Mancherial failed). Counts used: Jagtial 20, Karimnagar 16, Rajanna Sircilla 13, Nizamabad 33, Kamareddy 25, Nirmal 22 confirmed plus 1 unconfirmed, Peddapalli 14, and Mancherial 18 (secondary source). Several official pages give a count in their text that does not match their own tables. The newest mandals come from the July/Sept 2022 notification of 13 mandals and from an October 2023 batch in Nirmal.

### Cited Findings
**Jagtial (20, official, page last updated 19.10.2026):** Beerpur, Buggaram, Dharmapuri, Gollapalli, Jagitial Urban, Jagitial Rural, Kodimial, Mallial, Pegadapalli, Raikal, Sarangapur, Velgatoor, Metpally, Ibrahimpatnam, Mallapur, Kathalapur, Korutla, Medipalli, Bheemaram, Endapalli — [Jagtial district site](https://jagtial.telangana.gov.in/village-and-panchayats/)
- There are 3 revenue divisions: Jagitial, Korutla and Metpalli — [Jagtial revenue divisions](https://jagtial.telangana.gov.in/administrative-setup/revenue-divisions/)
- The site's root URL returned HTTP 503 through WebFetch on the first try. Later curl requests to sub-pages succeeded.
- Endapalli and Bheemaram (Jagtial) were among the 13 new mandals declared in July 2022 — [Telangana Today, 23 Jul 2022](https://telanganatoday.com/telangana-govt-declares-13-new-mandals). Final district-wise notifications were issued 26 Sept 2022. Endapalli was carved from Velgatur (Jagtial) and Palakurthi (Peddapalli). Bheemaram was carved from Medipalle — per search summaries of [The News Minute](https://www.thenewsminute.com/article/telangana-forms-13-new-revenue-mandals-eight-districts-168334) and [Deccan Chronicle](https://www.deccanchronicle.com/nation/in-other-news/270922/telangana-to-create-14-new-revenue-mandals.html) (one DC report says 14 mandals, not 13).
- English Wikipedia's Jagtial page contradicts itself: it gives 18 in its list and 20 in its table — [Wikipedia](https://en.wikipedia.org/wiki/Jagtial_district)

**Karimnagar (16, official, last updated 15.06.2026):** Karimnagar division: Karimnagar, Kothapally, Karimnagar Rural, Manakondur, Thimmapur, Ganneruvaram, Gangadhara, Ramadugu, Choppadandi, Chigurumamidi. Huzurabad division: Huzurabad, Veenavanka, V. Saidapur, Jammikunta, Ellandakunta, Shankarapatnam — [Karimnagar district site](https://karimnagar.telangana.gov.in/about-district/administrative-setup/mandals-and-villages/)
- Wikipedia lists "Karimnagar (Rural-I)" and "Karimnagar (Rural-II)" instead of "Karimnagar Rural" and "Kothapally" — [Wikipedia list](https://en.wikipedia.org/wiki/List_of_mandals_in_Telangana)

**Rajanna Sircilla (13, official, undated homepage):** The directory lists 12: Boinpally, Chandurthy, Ellanthakunta, Gambhiraopet, Konaraopet, Mustabad, Rudrangi, Thangallapalli, Veernapalli, Vemulawada, Vemulawada Rural, Yellareddipet. The About text says there are 13 mandals with HQ in Sircilla mandal, so Sircilla was added as the 13th — [Rajanna Sircilla district site](https://rajannasircilla.telangana.gov.in/). Wikipedia confirms the same 13 — [Wikipedia list](https://en.wikipedia.org/wiki/List_of_mandals_in_Telangana)

**Nizamabad (33, official):** Nizamabad division (10): Makloor, Dichpally (site typo "Dichaplly"), Sirikonda, Nizamabad South, Nizamabad North, Nizamabad Rural, Dharpally, Mugpal, Indalwai, Navipet. Armoor division (13): Armoor, Balkonda, Nandipet, Vailpur, Bheemgal, Kammarpally, Morthad, Jakranpally, Yergatla, Mupkal, Mendora, Donkeshwar, Aloor. Bodhan division (10): Bodhan, Renjal, Yedapally, Varni, Kotagiri, Rudrur, Chandur, Mosra, Saloora, Pothangal — [Nizamabad Tahsildars page](https://nizamabad.telangana.gov.in/about-district/mandal-offices/)
- Aloor, Donkeshwar and Saloora were among the 2022 new mandals — [Telangana Today](https://telanganatoday.com/telangana-govt-declares-13-new-mandals)

**Kamareddy (25, official, last updated 12.09.2025):** Banswada division: Banswada, Birkoor, Bichkunda, Jukkal, Madnoor, Nizamsagar, Pitlam, Nasrullabad, Pedda Kodapgal, Dongli, Mohammad Nagar. Kamareddy division: Kamareddy, Bhiknoor, Rajampet, Domakonda, Machareddy, Ramareddy, Bibipet, Tadwai, Sadasivanagar, Palvancha. Yellareddy division: Yellareddy, Lingampet, Nagareddipet, Gandhari — [Kamareddy MRO page](https://kamareddy.telangana.gov.in/administrative-setup/mandal-revenue-offices/)
- The same page's text says "22 Mandals" but its table has 25 rows. The table is more current.
- Dongli was a 2022 new mandal carved from Madnoor — [Telangana Today](https://telanganatoday.com/telangana-govt-declares-13-new-mandals). Mohammad Nagar does not appear in the 2022 list. I could not find its creation date.
- English Wikipedia lists only 23 and omits Dongli and Mohammad Nagar — [Wikipedia](https://en.wikipedia.org/wiki/Kamareddy_district)

**Nirmal (22 confirmed + 1 unconfirmed; official list is dated):** The official mandal/GP list was last updated 07.10.2020 and has 18 rural mandals: Basar, Bhainsa, Dasturabad, Dilawarpur, Kaddam (Peddur), Khanapur, Kubeer, Kuntala, Laxmanchanda, Lokeswaram, Mamda, Mudhole, Narsapur G, Nirmal Rural, Pembi, Sarangapur, Soan, Tanur — [Nirmal district site](https://nirmal.telangana.gov.in/mandalspanchayats/)
- Malegaon (from Kubheer) and Beltharoda (from Thanur) were created in Oct 2023 — [Telangana Today, 6 Oct 2023](https://telanganatoday.com/two-more-mandals-carved-out-of-nirmal)
- Beeravelli (from Sarangapur plus Kalwa of Dilwarpur) was created in Oct 2023 — [Telangana Today, 8 Oct 2023](https://telanganatoday.com/one-more-mandal-created-in-nirmal)
- Nirmal Urban appears in the Wikipedia mandal list — [Wikipedia list](https://en.wikipedia.org/wiki/List_of_mandals_in_Telangana). The Wikipedia district table also lists Ponkal, Beeravalli, Malegaon and Beltaroda — [Wikipedia](https://en.wikipedia.org/wiki/Nirmal_district)
- Ponkal is UNCONFIRMED. The only news found describes a local demand and hunger strike for mandal status — [Telangana Today](https://telanganatoday.com/demand-for-new-mandals-get-louder-in-erstwhile-adilabad)

**Peddapalli (14, official):** Anthergoan, Kalvasrirampoor, Eligaid, Julapalli, Odela, Palakurthi, Peddapalli, Dharmaram, Sulthanabad, Ramagundam, Kamanpur, Manthani, Mutharam (Manthani), Ramagiri — [Peddapalli Tahsil offices](https://peddapalli.telangana.gov.in/subdivision-blocks/)

**Mancherial (18, SECONDARY):** Bheemaram, Chennur, Dandepally, Hajipur, Jaipur, Jannaram, Kotapally, Luxettipet, Mancherial, Mandamarri, Naspur, Bellampally, Bheemini, Kannepally, Kasipet, Nennel, Tandur, Vempally — [Wikipedia list](https://en.wikipedia.org/wiki/List_of_mandals_in_Telangana). The official site mancherial.telangana.gov.in failed (connection closed or 404) on every try.

### Inferences
- Karimnagar's "Kothapally" mandal is probably the former "Karimnagar Rural-II" renamed. The two sources list the same count with only this name swapped.
- Rajanna Sircilla's directory omitting Sircilla looks like a site defect, not a real change.
- Mohammad Nagar (Kamareddy) and Pothangal (Nizamabad) are post-2016 mandals that are not in the 2022 batch of 13. They were probably created in a separate 2022–23 order. A search hit exists for Pothangal ([Telangana Today](https://telanganatoday.com/pothangal-in-nizamabad-district-made-new-revenue-mandal)), but I did not read it.
- Several names repeat across districts, so the harness should ask for the district when one of these is heard: Sarangapur (Jagtial and Nirmal), Bheemaram (Jagtial and Mancherial), Ellandakunta (Karimnagar) vs Ellanthakunta (Sircilla), Palvancha (Kamareddy and Bhadradri), Tadwai, Tandur and Ibrahimpatnam.

### Gaps
- I did not retrieve the Telangana gazette or GO text, and did not check the LGD (lgdirectory.gov.in). I relied on district sites and news.
- I could not find creation dates for Mohammad Nagar, Pothangal, Rudrangi or Nirmal Urban.
- Mancherial has no official source, so mandals created after Wikipedia's list may be missing.
- Nirmal's official list is from 2020. Its 2023 additions and Nirmal Urban come from news and Wikipedia.

## Common alternate spellings

### Takeaway
Spellings vary a lot even between official pages (Jagitial/Jagtial, Metpally/Metpalli, Kathalapur/Kathlapur, Medipalli/Medipalle). The -palli/-pally/-palle and -pet/-peta suffix variants are systematic, so the JSON generates them automatically.

### Cited Findings
- The Jagtial official site itself uses "Jagitial" (villages page, RDO page) next to the site name "Jagtial". It uses "Metpally" on one page and "Metpalli" on another — [villages](https://jagtial.telangana.gov.in/village-and-panchayats/), [divisions](https://jagtial.telangana.gov.in/administrative-setup/revenue-divisions/)
- Wikipedia spellings that differ from the official ones: Medipalle, Kathlapur, Gollapalle, Pegadapalle (Jagtial); Armur, Mortad, Kotgiri, Ranjal, Sirkonda (Nizamabad); Birkur, Nasurullabad, Madnur, Naga Reddipet (Kamareddy); Dilwarpur, Mamada, Tanoor, Lokeshwaram (Nirmal); Gambhiraopeta, Yellareddypeta, Thangallapalle (Sircilla); Elgaid, Srirampur, Sultanabad (Peddapalli) — [Wikipedia list](https://en.wikipedia.org/wiki/List_of_mandals_in_Telangana)
- News variants: Saloora/"Salura", Jagtial/"Jagitial", Kubeer/"Kubheer", Tanur/"Thanur", Beeravelli/"Beeravalli" — [Telangana Today](https://telanganatoday.com/telangana-govt-declares-13-new-mandals); [Telangana Today Nirmal](https://telanganatoday.com/two-more-mandals-carved-out-of-nirmal)

### Inferences
- The aliases you gave (Kodimyal, Jagityal, Koratla, Siricilla/Sirisilla) are in the JSON. Other aliases come from common romanisations of the Telugu forms (e.g. Mallial/Malyal from మల్యాల, Kodimial/Kodimyal from కొడిమ్యాల్). These are reasonable but not sourced.
- Callers may say the town name rather than the mandal (e.g. "Godavarikhani" for Ramagundam). One such alias is included. Village-level matching needs village data.

### Gaps
- There is no authoritative list of colloquial spellings. Alias lists should be extended from real ASR transcripts.

## Telugu-script names

### Takeaway
District Telugu names were confirmed for Jagtial (జగిత్యాల), Karimnagar (కరీంనగర్) and Rajanna Sircilla (రాజన్న సిరిసిల్ల) from official site headers. Kamareddy (కామారెడ్డి) and Nirmal (నిర్మల్) come from Wikipedia interlanguage links. Mandal-level Telugu was only found for Jagtial, and it comes from Telugu Wikipedia (secondary). None of the official English pages list Telugu mandal names.

### Cited Findings
- Jagtial Telugu site header: జగిత్యాల — [jagtial.telangana.gov.in/te/](https://jagtial.telangana.gov.in/te/)
- Karimnagar header: కరీంనగర్ జిల్లా — [Karimnagar site](https://karimnagar.telangana.gov.in/about-district/administrative-setup/mandals-and-villages/)
- Rajanna Sircilla header: రాజన్న సిరిసిల్ల జిల్లా — [Sircilla site](https://rajannasircilla.telangana.gov.in/)
- Kamareddy కామారెడ్డి జిల్లా and Nirmal నిర్మల్ జిల్లా come from interlanguage links — [Wikipedia Kamareddy](https://en.wikipedia.org/wiki/Kamareddy_district), [Wikipedia Nirmal](https://en.wikipedia.org/wiki/Nirmal_district)
- Jagtial's 20 mandals in Telugu: జగిత్యాల, జగిత్యాల గ్రామీణ, రాయకల్, సారంగాపూర్, బీర్పూర్, ధర్మపురి, బుగ్గారం, పెగడపల్లి, గొల్లపల్లి, మల్యాల, కొడిమ్యాల్, వెల్గటూర్, కోరుట్ల, మెట్‌పల్లి, మల్లాపూర్, ఇబ్రహీంపట్నం, మేడిపల్లి, కత్లాపూర్, భీమారం, ఎండపల్లి — [Telugu Wikipedia](https://te.wikipedia.org/wiki/జగిత్యాల_జిల్లా)

### Inferences
- The Telugu versions of each district site (/te/) probably carry Telugu mandal tables. Only Jagtial's /te/ homepage was fetched, and its mandal sub-pages were not.

### Gaps
- Telugu district names for Nizamabad, Peddapalli and Mancherial were left null in the JSON because no source was fetched. The likely forms are నిజామాబాద్, పెద్దపల్లి and మంచిర్యాల, but they are unverified.
- Mandal-level Telugu names for the other 7 districts are missing. Next step: te.wikipedia district pages or the /te/ mandal pages on each district site.
