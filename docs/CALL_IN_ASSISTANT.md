# Saathi call-in assistant (any phone, no internet)

The idea: a worker on a basic phone calls one number and talks in Telugu. The assistant acts like a trusted broker who knows everything: where to eat, which bus, who to call. It can also speak Arabic for him, and it files his complaint. The intended payer is the government (Telangana / MEA), so the worker calls for free.

## `POST /api/assistant { text, recipient_data? }`

The flow is: speech-to-text → harness → intent → answer in Telugu.

| Intent | What it does | Honest limits |
|---|---|---|
| emergency | The gate runs **first**. Distress, a stranger pickup or the safety phrase → escalate to a human, plus official helplines. | — |
| find_place | Indian hotel, hospital, bus station, embassy, police, mosque, temple, pharmacy or ATM near the landmark he names ("Burj Khalifa daggara"). | **Never guesses his location.** If he names no landmark, it asks for one. Live search needs `GOOGLE_MAPS_API_KEY` (Places API); without it, it says so and promises a human callback. |
| bus_route / directions | Asks for the bus number and stop; transit steps come from the Directions API. | Without a bus number it cannot know where a bus goes, and says so. It offers to ask the driver in Arabic. Transit coverage in Dubai and Riyadh is unverified. |
| speak_for_me | Short Arabic lines for him to play to the other person: no Arabic, food, help, embassy, salary, passport, hospital, bus. | Fixed, confirmed sentences only. Police and legal matters go to a human. **Have a native speaker check the Arabic before use.** |
| complaint | Builds a case file from what he said (risks, words heard, who to contact). | — |
| helpline | Official numbers for his country from `server/data/research/helplines.json`. | Re-check every few months. |

## What this is not yet
- **Not live:** the phone line itself. Plug it into Bolna by sending each caller turn to `/api/assistant` and speaking back `sayTe`.
- **Not decided:** who pays for calls (toll-free / call-back). That needs a telecom and government partnership.
- **Not available:** network-based caller location. It isn't open to us, and under UAE law location is personal data.
- **Not built:** free-form Arabic translation in both directions. It's possible with an LLM, but deliberately left out until there's a human check.
