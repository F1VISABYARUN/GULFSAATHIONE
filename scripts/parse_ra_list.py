"""Parse MEA's 'District and State wise list of Active RA' PDF (pdftotext -layout output) into JSON.
Usage: python3 -I scripts/parse_ra_list.py active.txt state.txt out.json
Source: https://www.mea.gov.in/images/pdf/03-Active-RA-List-21-04-2026.pdf (as on 08-04-2026)
Keeps agency name, state, district, RC number, status, website. Drops signatory names (personal data)."""
import json, re, sys

ANCHOR = re.compile(r'^\s*(\d+)\s+(RA\d+)\b')
STATES = ['ANDHRA PRADESH','TELANGANA','KERALA','TAMIL NADU','KARNATAKA','MAHARASHTRA','DELHI','UTTAR PRADESH','BIHAR','RAJASTHAN',
  'PUNJAB','GUJARAT','WEST BENGAL','GOA','HARYANA','MADHYA PRADESH','ODISHA','JHARKHAND','ASSAM','CHANDIGARH','JAMMU AND KASHMIR',
  'HIMACHAL PRADESH','UTTARAKHAND','PUDUCHERRY','CHHATTISGARH','MANIPUR','MEGHALAYA','MIZORAM','NAGALAND','TRIPURA','SIKKIM',
  'ARUNACHAL PRADESH','LAKSHADWEEP','LADAKH','THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU','ANDAMAN AND NICOBAR ISLANDS']
STATE_RE = re.compile(r'\b(' + '|'.join(re.escape(s) for s in sorted(STATES, key=len, reverse=True)) + r')\b')

def parse(path):
    lines = open(path, encoding='utf-8', errors='replace').read().split('\n')
    anchors = [i for i, l in enumerate(lines) if ANCHOR.match(l)]
    out = []
    for n, a in enumerate(anchors):
        prev = anchors[n-1] if n else max(0, a-6)
        nxt = anchors[n+1] if n+1 < len(anchors) else min(len(lines), a+8)
        lo = (prev + a) // 2 + 1 if n else max(0, a-5)
        hi = (a + nxt) // 2 + 1
        block = lines[lo:hi]
        al = lines[a]
        m = ANCHOR.match(al)
        sm = STATE_RE.search(al)
        if not sm:
            continue
        name_lo, name_hi = m.end(2), sm.start()
        name_parts = []
        for l in block:
            seg = l[name_lo:name_hi] if len(l) > name_lo else ''
            # skip column spillover from long rows
            name_parts.append(seg.strip())
        name = ' '.join(p for p in name_parts if p)
        name = re.split(r'AUTH-\s*SIGN|AUTH-|;', name)[0].strip(' ;,')
        name = re.sub(r'\s+', ' ', name)
        # page headers leak into the first row of a page
        name = re.sub(r'^.*?SIGNATORY\s*\)?\s*', '', name) if 'SIGNATORY' in name else name
        name = re.sub(r'^(?:[A-Z]{1,2}\)?\s+)+(?=[A-Z][A-Za-z&./]{2,})', '', name).strip()
        text = ' '.join(block)
        rc = re.search(r'\b[A-Z]-\d{3,4}/[A-Z0-9/+\-]+', text)
        rest = al[sm.end():]
        district = re.split(r'\s{2,}', rest.strip())[0] if rest.strip() else ''
        district = re.split(r'[,;]|\bOpposite\b|\bReddy Nagar\b', district)[0].strip()
        if district in ('Active', 'RC Expired') or district.upper().startswith(('OPP', 'D.NO', 'H.NO')): district = ''
        status = 'Active' if 'Active' in al else ('RC Expired' if 'Expired' in text else '')
        web = re.search(r'https?://\S+', al)
        out.append({'raId': m.group(2), 'name': name, 'state': sm.group(1).title(), 'district': district.title(),
                    'rc': rc.group(0) if rc else None, 'status': status, 'website': web.group(0) if web else None})
    return out

active = parse(sys.argv[1])
state = parse(sys.argv[2]) if len(sys.argv) > 3 else []
json.dump({'source': 'MEA, District and State wise list of Active RA (as on 08-04-2026)',
           'source_url': 'https://www.mea.gov.in/images/pdf/03-Active-RA-List-21-04-2026.pdf',
           'state_source_url': 'https://www.mea.gov.in/images/pdf/03-State-RA-List-Report-21-04-2026.pdf',
           'retrieved_on': '2026-11-21', 'note': 'Parsed automatically from PDF; names may contain parsing errors. Verify on emigrate.gov.in.',
           'agents': active, 'state_agents': state}, open(sys.argv[-1], 'w'), indent=1, ensure_ascii=False)
print(len(active), 'active;', sum(1 for r in active if r['state'] == 'Telangana'), 'Telangana;', len(state), 'state RAs')
