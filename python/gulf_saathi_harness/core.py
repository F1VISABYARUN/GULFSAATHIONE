"""Core of the Python harness. Pure standard library, deterministic."""
from __future__ import annotations

import json
import re
from pathlib import Path

LEX = json.loads((Path(__file__).parent / "lexicon.json").read_text(encoding="utf-8"))

# ---------------------------------------------------------------- script -> Roman (rule based)
_TE = dict(
    vowels={'అ': 'a', 'ఆ': 'aa', 'ఇ': 'i', 'ఈ': 'ee', 'ఉ': 'u', 'ఊ': 'oo', 'ఋ': 'ru', 'ఎ': 'e', 'ఏ': 'e', 'ఐ': 'ai', 'ఒ': 'o', 'ఓ': 'o', 'ఔ': 'au'},
    matras={'ా': 'aa', 'ి': 'i', 'ీ': 'ee', 'ు': 'u', 'ూ': 'oo', 'ృ': 'ru', 'ె': 'e', 'ే': 'e', 'ై': 'ai', 'ొ': 'o', 'ో': 'o', 'ౌ': 'au'},
    cons={'క': 'k', 'ఖ': 'kh', 'గ': 'g', 'ఘ': 'gh', 'ఙ': 'n', 'చ': 'ch', 'ఛ': 'chh', 'జ': 'j', 'ఝ': 'jh', 'ఞ': 'ny', 'ట': 't', 'ఠ': 'th', 'డ': 'd', 'ఢ': 'dh', 'ణ': 'n',
          'త': 't', 'థ': 'th', 'ద': 'd', 'ధ': 'dh', 'న': 'n', 'ప': 'p', 'ఫ': 'ph', 'బ': 'b', 'భ': 'bh', 'మ': 'm', 'య': 'y', 'ర': 'r', 'ఱ': 'r', 'ల': 'l', 'ళ': 'l',
          'వ': 'v', 'శ': 'sh', 'ష': 'sh', 'స': 's', 'హ': 'h'},
    virama='్', anusvara='ంఁ', visarga='ః', digits='౦౧౨౩౪౫౬౭౮౯', drop_final_a=False, end_anusvara='m')
_HI = dict(
    vowels={'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ऍ': 'e'},
    matras={'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e'},
    cons={'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny', 'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
          'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n', 'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v',
          'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h'},
    virama='्', anusvara='ंँ', visarga='ः', digits='०१२३४५६७८९', drop_final_a=True, end_anusvara='n')
_LABIAL = {'p', 'ph', 'b', 'bh', 'm', 'v'}


def _table(ch: str):
    c = ord(ch)
    if 0x0C00 <= c <= 0x0C7F:
        return _TE
    if 0x0900 <= c <= 0x097F:
        return _HI
    return None


def to_latin(text: str) -> str:
    s = re.sub('[‌‍]', '', text).replace('।', '.').replace('॥', '.')
    out, i = [], 0
    while i < len(s):
        ch, t = s[i], _table(s[i])
        if not t:
            out.append(ch); i += 1; continue
        if ch in t['digits']:
            out.append(str(t['digits'].index(ch))); i += 1; continue
        if ch in t['vowels']:
            out.append(t['vowels'][ch]); i += 1; continue
        if ch in t['anusvara']:
            nxt = t['cons'].get(s[i + 1]) if i + 1 < len(s) else None
            out.append(t['end_anusvara'] if nxt is None else ('m' if nxt in _LABIAL else 'n')); i += 1; continue
        if ch == t['visarga']:
            out.append('h'); i += 1; continue
        base = t['cons'].get(ch)
        if base is None:
            i += 1; continue  # stray matra / virama / nukta
        nxt = s[i + 1] if i + 1 < len(s) else ''
        if nxt == '़':
            i += 1; nxt = s[i + 1] if i + 1 < len(s) else ''
        if nxt == t['virama']:
            out.append(base); i += 2; continue
        if nxt in t['matras']:
            out.append(base + t['matras'][nxt]); i += 2; continue
        at_end = not nxt or _table(nxt) is None
        out.append(base + ('' if at_end and t['drop_final_a'] else 'a')); i += 1
    return ''.join(out)


def _norm(w: str) -> str:
    w = to_latin(w).lower()
    w = re.sub(r'(\d),(?=\d)', r'\1', w)
    w = re.sub(r"^[^\w]+|[^\w]+$", '', w)
    return w.replace('-', '').replace("'", '')


def tokenize(text: str) -> list[str]:
    text = text.replace('₹', ' rs ')
    text = re.sub(r'(\d)\s*k\b', r'\1k', text, flags=re.I)
    return [n for n in (_norm(p) for p in re.split(r'[\s।॥]+', text)) if n]

# ---------------------------------------------------------------- phonetic similarity


def phonetic_key(s: str) -> str:
    s = re.sub('[^a-z]', '', s.lower())
    for a, b in [('ch', 'C'), ('sh', 's'), ('ph', 'f'), ('bh', 'b'), ('dh', 'd'), ('th', 't'), ('kh', 'k'), ('gh', 'g'), ('jh', 'j'), ('zh', 'j'),
                 ('ck', 'k'), ('q', 'k'), ('x', 'ks'), ('c', 'k'), ('C', 'c'), ('w', 'v'), ('z', 'j'), ('y', 'i'),
                 ('ee', 'i'), ('oo', 'u'), ('aa', 'a'), ('ou', 'u'), ('ea', 'i'), ('h', '')]:
        s = s.replace(a, b)
    return re.sub(r'(.)\1+', r'\1', s)


def _lev(a: str, b: str) -> int:
    dp = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        prev, dp[0] = dp[0], i
        for j in range(1, len(b) + 1):
            prev, dp[j] = dp[j], min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
    return dp[-1]


def similarity(a: str, b: str) -> float:
    ka, kb = phonetic_key(a), phonetic_key(b)
    return 0.0 if not ka or not kb else 1 - _lev(ka, kb) / max(len(ka), len(kb))

# ---------------------------------------------------------------- phones


def _classify_phone(d: str) -> dict:
    if len(d) == 12 and d[:3] in ('971', '966'):
        return {'digits': d, 'e164': '+' + d, 'valid': d[3] == '5'}
    if len(d) == 12 and d.startswith('91'):
        d = d[2:]
    if len(d) == 11 and d.startswith('0') and d[1] in '6789':
        d = d[1:]
    if len(d) == 10 and d[0] in '6789':
        return {'digits': d, 'e164': f'+91 {d[:5]} {d[5:]}', 'valid': True}
    if (len(d) == 10 and d.startswith('05')) or (len(d) == 9 and d.startswith('5')):
        return {'digits': d, 'valid': True, 'issue': 'Gulf mobile, country not stated'}
    if len(d) == 12:
        return {'digits': d, 'valid': False, 'kind': 'id12', 'issue': '12 digits, not a phone number'}
    return {'digits': d, 'valid': False, 'kind': 'long', 'issue': f'{len(d)} digits heard, an Indian mobile needs 10'}


_REPAIR_DIGITS = {'joolai': 0, 'july': 0, 'jeero': 0, 'zeero': 0}


def find_phones(tokens: list[str], repair: bool = True) -> list[tuple[int, int, dict]]:
    D, T, R, F = LEX['digits'], LEX['tens'], LEX['repeat'], set(LEX['fillers'])
    one = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9}
    out, i = [], 0
    while i < len(tokens):
        t = tokens[i]
        if not (t in D or t in T or (t.isdigit() and len(t) <= 18) or (t in R and i + 1 < len(tokens))):
            i += 1; continue
        j, digits, last = i, '', i
        while j < len(tokens):
            t = tokens[j]
            if t in F and digits:
                j += 1; continue
            if t in R and j + 1 < len(tokens):
                nx = tokens[j + 1]
                v = int(nx) if nx.isdigit() and len(nx) == 1 else D.get(nx)
                if v is None:
                    break
                digits += str(v) * R[t]; j += 2; last = j; continue
            if t.isdigit() and len(t) <= 18:
                digits += t; j += 1; last = j; continue
            if t in T:
                u = one.get(tokens[j + 1]) if j + 1 < len(tokens) else None
                digits += f'{T[t]}{u}' if u else f'{T[t]}0'; j += 2 if u else 1; last = j; continue
            v = D.get(t, _REPAIR_DIGITS.get(t) if (repair and digits) else None)
            if v is not None:
                digits += str(v); j += 1; last = j; continue
            break
        if len(digits) >= 7:
            info = _classify_phone(digits)
            cue = next((LEX['id_cues'][tokens[k]] for k in range(i - 1, max(-1, i - 5), -1) if tokens[k] in LEX['id_cues']), None)
            if cue or info.get('kind') == 'id12':
                info = {'digits': digits, 'valid': True, 'kind': 'id', 'id_kind': cue or 'ID'}   # an identifier, never a phone number
            out.append((i, last, info)); i = last
        else:
            i += 1
    return out

# ---------------------------------------------------------------- money


def _num(t: str):
    if re.fullmatch(r'\d+(\.\d+)?', t):
        return ('unit', float(t), True)
    m = re.fullmatch(r'(\d+(?:\.\d+)?)k', t)
    if m:
        return ('kilo', float(m.group(1)) * 1000, True)
    if t in LEX['units']:
        return ('unit', LEX['units'][t], False)
    if t in LEX['hundred']:
        return ('hundred', 100, False)
    if t in LEX['mult']:
        return ('mult', LEX['mult'][t], False)
    if t in LEX['frac']:
        return ('frac', LEX['frac'][t], False)
    if t in LEX['mods']:
        return ('mod', LEX['mods'][t], False)
    if t == 'and':
        return ('and', 0, False)
    return None


def _evaluate(words):
    total = cur = mod = 0.0
    scale = digit = any_ = prev_single = False
    for w in words:
        k, v, isd = _num(w)
        single = k == 'unit' and v < 10
        if k == 'unit':
            cur = v if (single and prev_single) else cur + v; any_ = True; digit |= isd
        elif k == 'frac':
            cur += v; any_ = True
        elif k == 'mod':
            mod = v
        elif k == 'hundred':
            cur = (cur or 1) * 100; scale = any_ = True
        elif k == 'mult':
            total += ((cur or 1) + mod) * v; cur = mod = 0; scale = any_ = True
        elif k == 'kilo':
            total += v; scale = digit = any_ = True
        prev_single = single and not isd
    return (total + cur + (mod if cur else 0), scale, digit) if any_ else None


def find_money(tokens: list[str], consumed: set[int] | None = None) -> list[dict]:
    consumed = consumed or set()
    C, out, i = LEX['currency'], [], 0
    while i < len(tokens):
        n = _num(tokens[i]) if i not in consumed else None
        if not n or n[0] == 'and':
            i += 1; continue
        j = i
        while j < len(tokens) and j not in consumed and _num(tokens[j]):
            j += 1
        while j > i and tokens[j - 1] == 'and':
            j -= 1
        ev = _evaluate(tokens[i:j])
        cur = C.get(tokens[i - 1]) if i > 0 else None
        if not cur:
            for k in range(j, min(j + 2, len(tokens))):
                if tokens[k] in C:
                    cur = C[tokens[k]]; break
        lone_hundred = j - i == 1 and tokens[i] in LEX['hundred'] and not cur
        single = tokens[i] if j - i == 1 else ''
        year_like = bool(re.fullmatch(r'\d{4}', single)) and ev is not None and 1900 <= ev[0] <= 2100
        tw = set(LEX['time_words'])
        near_time = (j < len(tokens) and tokens[j] in tw) or (i > 0 and tokens[i - 1] in tw)
        cues = set(LEX['fee_words']) | set(LEX['salary_words']) | set(LEX['money_cues'])
        cue = any(tokens[k] in cues for k in range(max(0, i - 6), min(len(tokens), j + 6)) if not (i <= k < j))
        long_digits = any(re.fullmatch(r'\d{8,}', t) for t in tokens[i:j])
        bare_digit_money = bool(ev and ev[2] and ev[0] >= 100 and cue and not long_digits and not (year_like and near_time))
        if ev and not lone_hundred and (ev[1] or cur or bare_digit_money):
            out.append({'start': i, 'end': j, 'amount': ev[0], 'currency': cur or 'INR'})
        i = max(j, i + 1)
    return out

# ---------------------------------------------------------------- phrases


def _phrase_hits(tokens: list[str], phrase: str, fuzzy: bool) -> bool:
    words = phrase.split()
    for i in range(len(tokens) - len(words) + 1):
        cand = tokens[i:i + len(words)]
        if cand == words:
            return True
        if fuzzy:
            a, b = phonetic_key(''.join(cand)), phonetic_key(''.join(words))
            if len(a) >= 6 and 1 - _lev(a, b) / max(len(a), len(b)) >= (0.8 if len(a) >= 14 else 0.84):
                return True
    return False

# ---------------------------------------------------------------- Q/A layer + Bolna transcript

_NEG = re.compile(r'(లేదు|లేదండి|రాలేదు|రాలేదండి|ఇవ్వలేదు|నై\b|नहीं|\bno\b|\bledu\b|\bledandi\b)', re.I)


def parse_bolna_transcript(transcript: str) -> list[dict]:
    turns, last = [], ''
    for line in transcript.split('\n'):
        m = re.match(r'^(assistant|user):\s*(.*)$', line)
        if not m:
            continue
        if m.group(1) == 'assistant':
            last = m.group(2).strip()
        elif m.group(2).strip():
            turns.append({'text': m.group(2).strip(), 'q': last if last.rstrip().endswith('?') else None})
    return turns


def _with_questions(turns: list[dict]) -> str:
    parts = []
    for t in turns:
        a, q = t['text'], t.get('q') or ''
        if q and _NEG.search(a):
            if re.search('జీతం|salary', q, re.I):
                a += ' [జీతం రాలేదు]'
            elif re.search('పాస్‌?పోర్ట్|passport', q, re.I):
                a += ' [పాస్పోర్ట్ లేదు]'
            elif re.search('తీసుకెళ్ల|వాళ్లేనా', q) and re.search('వేరే|కొత్త', a):
                a += ' [వేరే వాళ్ళు తీసుకెళ్లారు]'
        parts.append(a)
    return ' . '.join(parts)

# ---------------------------------------------------------------- public API

_NEG_WORD = re.compile(r'(ledu|ledhu|ledandi|ledani|aledu|atledu|tledu|nahi|not|never)$')
_PAID = {'ichhadu', 'ichadu', 'ichharu', 'icharu', 'ichindi', 'vachindi', 'paid', 'mili', 'diya', 'padindi', 'credited'}


def normalize(text: str = '', turns: list[dict] | None = None, code_phrase: str | None = None, repair: bool = True) -> dict:
    """Lock the facts in one utterance or a whole call (turns = [{'text','q'}])."""
    if turns:
        text = _with_questions(turns)
    toks = tokenize(text)
    phones = find_phones(toks, repair)
    consumed = {k for s, e, _ in phones for k in range(s, e)}
    money = find_money(toks, consumed)
    facts: dict = {}
    real = [p for _, _, p in phones if p.get('kind') != 'id']
    ids = [{'kind': p['id_kind'], 'digits': p['digits']} for _, _, p in phones if p.get('kind') == 'id']
    if real:
        facts['phones'] = [p.get('e164') or p['digits'] for p in real]
        if any(not p['valid'] for p in real):
            facts['phone_incomplete'] = True
    if ids:
        facts['id_numbers'] = ids
    sal, fee = set(LEX['salary_words']), set(LEX['fee_words'])
    for m in money:
        best = None  # nearest cue word decides fee vs salary (same as the TS harness)
        for k in range(max(0, m['start'] - 6), min(len(toks), m['end'] + 6)):
            if m['start'] <= k < m['end']:
                continue
            d = m['start'] - k if k < m['start'] else k - m['end'] + 1
            cue = 'salary' if toks[k] in sal else 'fee' if toks[k] in fee else None
            if cue and (best is None or d < best[1]):
                best = (cue, d)
        kind = best[0] if best else ('salary' if m['currency'] != 'INR' else None)
        if kind == 'salary':
            facts['salary'] = {'amount': m['amount'], 'currency': m['currency']}
        elif kind == 'fee' and m['currency'] == 'INR':
            facts['fee_inr'] = m['amount']
    for g in LEX['gulf']:
        for v in g['variants'] + (g['asr'] if repair else []):
            if _phrase_hits(toks, v, False):
                if g['id'] == 'visit_visa':
                    facts['visa_type'] = 'visit'
                elif g['id'] == 'work_visa' and facts.get('visa_type') != 'visit':
                    facts['visa_type'] = 'work'
                elif g['id'] == 'huroob':
                    facts['huroob'] = True
                break
    kinds = [d['kind'] for d in LEX['distress'] if any(_phrase_hits(toks, p, repair) for p in d['phrases'])]
    if 'passport_held' in kinds:
        facts['passport_held'] = True
    if 'salary_unpaid' in kinds:
        facts['salary_paid'] = False
    if 'taken_by_stranger' in kinds:
        facts['taken_by_stranger'] = True
    if 'cheated' in kinds:
        facts['cheated_by_agent'] = True
    danger = [k for k in kinds if k in ('violence', 'threat', 'help', 'deprivation', 'confinement')]
    if danger:
        facts['distress'] = danger
    if 'salary_paid' not in facts:
        for i, w in enumerate(toks):
            if w in sal:
                win = toks[i + 1:i + 5]
                if any(_NEG_WORD.search(x) for x in win):
                    facts['salary_paid'] = False; break
                if any(x in _PAID for x in win):
                    facts['salary_paid'] = True
    if code_phrase:
        target = phonetic_key(''.join(tokenize(code_phrase)))
        n = len(tokenize(code_phrase))
        for size in (n, n + 1, max(1, n - 1)):
            for i in range(len(toks) - size + 1):
                c = phonetic_key(''.join(toks[i:i + size]))
                if len(c) >= 4 and 1 - _lev(c, target) / max(len(c), len(target)) >= 0.8:
                    facts['code_phrase'] = True
    places = []
    for alias, canon in LEX['place_aliases'].items():
        if _phrase_hits(toks, alias, False) or any(t.startswith(alias) and t[len(alias):] in ('lo', 'ki', 'nundi', 'loni') for t in toks):
            places.append(canon)
    for p in LEX['places']:
        if _phrase_hits(toks, p.lower(), False):
            places.append(p)
    if places:
        facts['places'] = sorted(set(places))
        gc = [LEX['gulf_country'][p] for p in places if p in LEX['gulf_country']]
        if gc:
            facts['country'] = gc[-1]
    return facts


_CORRECTION = {'kadu', 'kaadu', 'kadhu', 'sorry', 'ledu', 'nahi', 'actually', 'correction', 'wait'}


def confirm_list(text: str) -> list[dict]:
    """What the voice agent must read back before saving (Telugu line to say + why)."""
    toks = tokenize(text)
    out = []
    for s, e, p in find_phones(toks):
        if not p['valid']:
            out.append({'why': p.get('issue', 'phone incomplete'), 'say_te': f"నంబర్ మళ్ళీ చెప్పండి — {p['digits']} అని విన్నాను, ఇది పూర్తి కాదు."})
    money = find_money(toks)
    for a, b in zip(money, money[1:]):
        if any(t in _CORRECTION for t in toks[a['end']:b['start']]) and a['amount'] != b['amount']:
            out.append({'why': f"amount corrected {a['amount']:.0f} -> {b['amount']:.0f}", 'say_te': f"{b['amount']:,.0f} రూపాయలు — ఇది సరైనదేనా?"})
    for d in LEX['distress']:
        if d['kind'] not in ('violence', 'threat'):
            continue
        exact = any(_phrase_hits(toks, p, False) for p in d['phrases'])
        if not exact and any(_phrase_hits(toks, p, True) for p in d['phrases']):
            out.append({'why': f"possible distress word ({d['kind']})", 'say_te': 'మిమ్మల్ని ఎవరైనా కొడుతున్నారా లేదా బెదిరిస్తున్నారా? చెప్పండి.'})
    return out


def safety_net(transcript: str, code_phrase: str | None = None) -> dict:
    """Run on every finished call. If this says escalate, open the case even if the LLM never called a tool."""
    f = normalize(turns=parse_bolna_transcript(transcript), code_phrase=code_phrase)
    reasons = []
    if f.get('code_phrase'):
        reasons.append('code_phrase')
    if f.get('distress'):
        reasons.append('threatened_or_distress')
    if f.get('taken_by_stranger'):
        reasons.append('wrong_pickup')
    if f.get('huroob'):
        reasons.append('papers_problem')
    high = [r for r, k in (('passport_taken', 'passport_held'), ('unpaid', 'salary_paid')) if (f.get(k) is True if k == 'passport_held' else f.get(k) is False)]
    if f.get('visa_type') == 'visit':
        high.append('visit_visa')
    if f.get('fee_inr', 0) > 35400:  # Rs 30,000 + 18% GST
        high.append('fee_above_cap')
    if f.get('cheated_by_agent'):
        high.append('agent_fraud_reported')
    return {'escalate': bool(reasons), 'critical_reasons': reasons, 'high_reasons': high, 'facts': f}
