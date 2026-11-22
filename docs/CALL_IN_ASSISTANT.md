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
- The existing phone line can use the tools documented below once its operator configures them in Bolna.
- **Not decided:** who pays for calls (toll-free / call-back). That needs a telecom and government partnership.
- **Not available:** network-based caller location. It isn't open to us, and under UAE law location is personal data.
- Native-speaker review of live relay output is still a human task.

## Live voice tools

Configure `SAATHI_SECRET` on the server and bind its value to the private `x-saathi-secret` header in Bolna. Use the deployed HTTPS host. Supply the registered case ID from trusted call metadata when available. Keep credentials out of prompts and transcripts.

**Relay.** `POST /api/translate` accepts `{"text":"…","from":"te","to":"ar","mode":"relay"}`. Supported language codes are `te`, `en`, `ar` (Gulf Arabic), `hi`, `ur`, and `ml`. Set `OPENAI_API_KEY` and select the model with `OPENAI_TEXT_MODEL`. On outbound turns the server checks the translation against the Telugu harness entities and requests a separate Telugu readback. The response contains `say_to_other`, `say_to_worker`, `back_translation`, `confidence`, and `locked_ok`. On inbound turns the worker hears the Telugu translation directly. Confidence is a model assessment, without statistical calibration. Generated speech carries the label “unchecked by native speaker”. A lock mismatch withholds the translation. When the provider is unavailable or unsure, an exact match from the fixed Arabic phrasebook may be offered for confirmation.

**Places and directions.** Enable Places API (New) and Routes API for `GOOGLE_MAPS_API_KEY`. Search starts from the caller's spoken landmark. Distances are approximate straight-line metres from that landmark. The Telugu pronunciation is approximate. Official Indian mission results come from `server/data/missions.json`; each contact has an official source and service scope. Street addresses awaiting verification are empty. A mission result with `distance_m: null` has no verified distance. Transit coverage depends on Google. The tools keep the spoken landmark and route in request memory only. Check the retention settings of your telephony and maps providers separately.

**Place SMS.** Configure an approved MSG91 template with variables `place_name` and `maps_link`, set `MSG91_PLACE_TEMPLATE_ID` and `MSG91_AUTH_KEY`. The tool resolves the selected ID and uses the registered worker or family phone. It requires recorded worker consent and the caller's explicit confirmation of the place and recipient. Missing SMS credentials produce `dry-run`. An `accepted` response means the provider accepted the request. Delivery requires a separate receipt.

### Helpline agent prompt

1. Send every speaker turn verbatim to the emergency gate with the trusted recipient context first. On danger or a safety phrase, stop the relay or maps flow, use the returned Telugu safety line, and invoke the configured human handoff. Keep the safety phrase private. Claim an alert only after the handoff confirms it.
2. For translation, send exactly one speaker per call. Use an empty string for the silent party. Read the Telugu back-translation and get the worker's approval before playing `say_to_other` to the other speaker. For the reply, fill `other_said` and speak `say_to_worker`. On `needs_confirm`, ask the returned question. Play a returned fixed phrase only after explicit approval. On `escalate_human`, speak the returned Telugu line and invoke human handoff.
3. For a place request, use the caller's own landmark and city. Ask for a landmark when missing or ambiguous. Read the options aloud and retain the chosen place ID for this call. For directions use the caller's stated origin, destination and travel mode. If `more_steps` is true, explain that these are the first four steps. When transit information is unavailable, offer to read `taxi_ar` to a driver.
4. Offer a place SMS only after the caller selects a result. Confirm the place and whether to send it to the worker or family, then use the returned ID. Report the tool's actual status.

### Bolna custom tools and HTTP bindings

Place the definitions under the agent's API tools configuration. Replace the host and the private credential placeholders in the dashboard. For anonymous calls pass an empty case ID and omit SMS.

```json
{
  "tools": [
    {
      "key": "custom_task",
      "name": "translate",
      "description": "Relay one turn. For the other speaker use other_said and leave caller_said empty.",
      "parameters": {
        "type": "object",
        "properties": {
          "caller_said": {
            "type": "string",
            "description": "Exact worker utterance, including any spoken landmark. Empty only for an inbound translation."
          },
          "case_id": {
            "type": "string",
            "description": "Registered case ID from trusted call metadata or empty."
          },
          "target_lang": {
            "type": "string",
            "enum": [
              "te",
              "en",
              "ar",
              "hi",
              "ur",
              "ml"
            ]
          },
          "other_said": {
            "type": "string",
            "description": "Exact other-party utterance, or empty for an outbound turn."
          }
        },
        "required": [
          "caller_said",
          "case_id",
          "target_lang",
          "other_said"
        ]
      }
    },
    {
      "key": "custom_task",
      "name": "find_place",
      "description": "Find places near a spoken landmark.",
      "parameters": {
        "type": "object",
        "properties": {
          "caller_said": {
            "type": "string",
            "description": "Exact worker utterance, including any spoken landmark. Empty only for an inbound translation."
          },
          "case_id": {
            "type": "string",
            "description": "Registered case ID from trusted call metadata or empty."
          },
          "city": {
            "type": "string",
            "description": "City explicitly stated by the worker, or empty."
          },
          "what": {
            "type": "string",
            "enum": [
              "hospital",
              "police",
              "embassy",
              "Indian restaurant",
              "bus stop",
              "pharmacy",
              "ATM",
              "temple",
              "mosque"
            ]
          }
        },
        "required": [
          "caller_said",
          "case_id",
          "city",
          "what"
        ]
      }
    },
    {
      "key": "custom_task",
      "name": "directions",
      "description": "Get up to four spoken route steps from the stated landmark.",
      "parameters": {
        "type": "object",
        "properties": {
          "caller_said": {
            "type": "string",
            "description": "Exact worker utterance, including any spoken landmark. Empty only for an inbound translation."
          },
          "case_id": {
            "type": "string",
            "description": "Registered case ID from trusted call metadata or empty."
          },
          "city": {
            "type": "string",
            "description": "City explicitly stated by the worker, or empty."
          },
          "destination": {
            "type": "string",
            "description": "Destination chosen by the worker."
          },
          "mode": {
            "type": "string",
            "enum": [
              "walking",
              "transit"
            ]
          }
        },
        "required": [
          "caller_said",
          "case_id",
          "city",
          "destination",
          "mode"
        ]
      }
    },
    {
      "key": "custom_task",
      "name": "send_place_sms",
      "description": "Send a selected place to the confirmed registered contact.",
      "parameters": {
        "type": "object",
        "properties": {
          "caller_said": {
            "type": "string",
            "description": "Exact worker utterance, including any spoken landmark. Empty only for an inbound translation."
          },
          "case_id": {
            "type": "string",
            "description": "Registered case ID from trusted call metadata or empty."
          },
          "place_id": {
            "type": "string",
            "description": "Copy the selected place_id returned by find_place."
          },
          "recipient": {
            "type": "string",
            "enum": [
              "worker",
              "family"
            ]
          },
          "confirmed": {
            "type": "boolean",
            "description": "True only after explicit confirmation of place and recipient."
          }
        },
        "required": [
          "caller_said",
          "case_id",
          "place_id",
          "recipient",
          "confirmed"
        ]
      }
    }
  ],
  "tools_params": {
    "translate": {
      "method": "POST",
      "url": "https://YOUR-HOST/tools/translate",
      "headers": {
        "x-saathi-secret": "YOUR-PRIVATE-HEADER-VALUE"
      },
      "param": {
        "caller_said": "%(caller_said)s",
        "case_id": "%(case_id)s",
        "target_lang": "%(target_lang)s",
        "other_said": "%(other_said)s"
      }
    },
    "find_place": {
      "method": "POST",
      "url": "https://YOUR-HOST/tools/find-place",
      "headers": {
        "x-saathi-secret": "YOUR-PRIVATE-HEADER-VALUE"
      },
      "param": {
        "caller_said": "%(caller_said)s",
        "case_id": "%(case_id)s",
        "city": "%(city)s",
        "what": "%(what)s"
      }
    },
    "directions": {
      "method": "POST",
      "url": "https://YOUR-HOST/tools/directions",
      "headers": {
        "x-saathi-secret": "YOUR-PRIVATE-HEADER-VALUE"
      },
      "param": {
        "caller_said": "%(caller_said)s",
        "case_id": "%(case_id)s",
        "city": "%(city)s",
        "destination": "%(destination)s",
        "mode": "%(mode)s"
      }
    },
    "send_place_sms": {
      "method": "POST",
      "url": "https://YOUR-HOST/tools/send-place-sms",
      "headers": {
        "x-saathi-secret": "YOUR-PRIVATE-HEADER-VALUE"
      },
      "param": {
        "caller_said": "%(caller_said)s",
        "case_id": "%(case_id)s",
        "place_id": "%(place_id)s",
        "recipient": "%(recipient)s",
        "confirmed": "%(confirmed)s"
      }
    }
  }
}
```

### Spoken landmark and source verification

On a fragment such as “బుర్ష్ కార్”, ask for the complete building name or a nearby street. For a single Google candidate that differs from the spoken name, read the suggested name and ask the caller to repeat the full name or give a different landmark. Send the caller’s next utterance to the same tool. Only a unique matching origin can produce place distances. Walking and transit requests specify Telugu for Google’s instructions.

The Dubai consulate welfare line also covers Sharjah, Ajman, Umm Al Quwain, Ras Al Khaimah and Fujairah. Its official response identifies Dubai as the consulate city and leaves the distance unknown. [Indian mission hotline scope](https://www.indembassyuae.gov.in/page/hotlines-24x7/)

The eight mission entries still lack verified street addresses. On 22 November 2026 the build environment could not retrieve the official mission pages or the eMigrate register. A human-reviewed official notified-agents snapshot is still needed. Agent checks return notified-register coverage separately from active licence status: unavailable, district needed, exact match, or no exact match. An explicit RC/RA number must match the bundled register before Saathi reports a registration.
