"""Run: python3 -m pytest python/ (or python3 python/test_harness.py)"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gulf_saathi_harness import to_latin, normalize, safety_net  # noqa: E402


def test_translit():
    assert to_latin('ఒక లక్ష యాభై వేలు') == 'oka laksha yaabhai velu'
    assert to_latin('आया मैं खतर में हूं') == 'aayaa main khatar men hoon'


def test_money():
    assert normalize('agent ki oka laksha yaabhai velu ichanu')['fee_inr'] == 150000
    assert normalize('పదిహేను లక్షలు ఇచ్చినాము')['fee_inr'] == 1500000
    assert normalize('నేను ఒక రెండు లక్షల రూపాయలు ఇచ్చాను')['fee_inr'] == 200000
    assert normalize('salary 1200 dirhams')['salary'] == {'amount': 1200, 'currency': 'AED'}
    assert 'fee_inr' not in normalize('వండ పని అని చెప్పారు')


def test_phone():
    assert normalize('98 48 జీరో వన్ టూ త్రీ ఫోర్ ఫైవ్')['phones'] == ['+91 98480 12345']
    assert normalize('9 8 4 4 జూలై ఎయిట్ 1 2 3 4')['phones'] == ['+91 98440 81234']


def test_visa_and_distress():
    assert normalize('విజిట్ విజయ్ మీద పోయి')['visa_type'] == 'visit'
    assert 'visa_type' not in normalize('విజిట్ విజయ్ మీద పోయి', repair=False)
    f = normalize('అనా కొడుతున్నారు కాపాడండి పాస్పోర్ట్ తీసుకున్నారు')
    assert f['passport_held'] and set(f['distress']) >= {'violence', 'help'}
    assert normalize('ఏజెంట్ మోసం చేసిండు')['cheated_by_agent']


def test_safety_net_on_bolna_transcript():
    t = ('assistant: మిమ్మల్ని ఎవరు తీసుకెళ్లారు? AI NOOR CLEANING వాళ్లేనా?\nuser: లేదు వేరే వాళ్ళు.\n'
         'assistant: ఈ నెల జీతం వచ్చిందా?\nuser: రాలేదండి\nassistant: మీ పాస్‌పోర్ట్ మీ దగ్గరే ఉందా?\nuser: లేదు.')
    r = safety_net(t)
    assert r['escalate'] and 'wrong_pickup' in r['critical_reasons']
    assert set(r['high_reasons']) == {'passport_taken', 'unpaid'}
    assert safety_net('user: అంతా బాగుంది అమ్మ బాగుందా', code_phrase='అమ్మ బాగుందా')['critical_reasons'] == ['code_phrase']
    assert not safety_net('assistant: ఈ నెల జీతం వచ్చిందా?\nuser: వచ్చింది')['escalate']



def test_example_app():
    try:
        from fastapi.testclient import TestClient
    except ImportError:
        return
    from example_app import app
    c = TestClient(app)
    r = c.post('/check-fee', json={'payments': '100000', 'caller_said': 'oka laksha yaabhai velu ichanu'}).json()
    assert r['total'] == 150000 and r['mismatch']['llm'] == 100000
    r = c.post('/tools/report-problem', json={'caller_said': 'నన్ను కొడుతున్నారు, పాస్పోర్ట్ తీసుకున్నారు'}).json()
    assert r['fields'] == {'threatened': 'yes', 'passport_with_worker': 'no', 'taken_by_stranger': ''}
    r = c.post('/webhooks/bolna', json={'id': 'x', 'transcript': 'user: నన్ను కిడ్నాప్ చేశారు', 'context_details': {'recipient_data': {}}}).json()
    assert r['escalate']


def test_confirm_list():
    from gulf_saathi_harness import confirm_list
    assert any('digits' in c['why'] for c in confirm_list('nine eight four eight five two one zero'))
    assert any('corrected' in c['why'] for c in confirm_list('oka laksha kadu kadu oka laksha yaabhai velu ichanu'))
    assert any('distress' in c['why'] for c in confirm_list('నన్ను ఓనర్ కోరుతున్నాడు'))
    assert confirm_list('salary 1200 dirhams') == []


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith('test_'):
            fn(); print('ok', name)
