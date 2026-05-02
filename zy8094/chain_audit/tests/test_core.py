import os
import sys
import tempfile
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from chain_audit.parse import (
    parse_athletes,
    parse_jsonl,
    parse_handover_rules,
    parse_lab_receipts,
    parse_timestamp,
)
from chain_audit.state_machine import ChainBuilder, SampleChain
from chain_audit.rules import RuleEngine, run_audit


def test_parse_timestamp():
    ts = parse_timestamp("2026-05-01T10:00:00+08:00")
    assert ts.year == 2026
    assert ts.month == 5
    assert ts.day == 1
    assert ts.hour == 10
    assert ts.tzinfo is not None

    ts2 = parse_timestamp("2026-05-01T10:00:00")
    assert ts2.tzinfo == timezone.utc


def test_parse_athletes():
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write("athlete_id,name,sport,nationality\n")
        f.write("ATH001,张伟,田径,CHN\n")
        f.write("ATH002,李娜,游泳,CHN\n")
        f.flush()
        athletes = parse_athletes(f.name)
        os.unlink(f.name)

    assert len(athletes) == 2
    assert athletes[0]['athlete_id'] == 'ATH001'
    assert athletes[1]['name'] == '李娜'


def test_parse_jsonl():
    with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
        f.write('{"event_id": "EVT001", "timestamp": "2026-05-01T10:00:00+08:00", "event_type": "collection", "athlete_id": "ATH001", "sample_id": "SMP001", "details": {}}\n')
        f.write('{"event_id": "EVT002", "timestamp": "2026-05-01T10:05:00+08:00", "event_type": "sealing", "athlete_id": "ATH001", "sample_id": "SMP001", "details": {}}\n')
        f.flush()
        events = parse_jsonl(f.name)
        os.unlink(f.name)

    assert len(events) == 2
    assert events[0]['event_type'] == 'collection'


def test_parse_handover_rules():
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        f.write("required_signatures:\n  - collector\n  - athlete\n")
        f.write("time_windows:\n  collection_to_sealing_minutes: 5\n")
        f.flush()
        rules = parse_handover_rules(f.name)
        os.unlink(f.name)

    assert 'collector' in rules['required_signatures']
    assert rules['time_windows']['collection_to_sealing_minutes'] == 5


def test_chain_builder():
    builder = ChainBuilder()

    event1 = {
        'event_id': 'EVT001',
        'timestamp': '2026-05-01T10:00:00+08:00',
        'event_type': 'collection',
        'athlete_id': 'ATH001',
        'sample_id': 'SMP001',
        'details': {'venue': '主会场'}
    }

    ts1 = parse_timestamp(event1['timestamp'])
    builder.add_event(event1, ts1)

    event2 = {
        'event_id': 'EVT002',
        'timestamp': '2026-05-01T10:05:00+08:00',
        'event_type': 'sealing',
        'athlete_id': 'ATH001',
        'sample_id': 'SMP001',
        'details': {'bottle': 'A', 'seal_number': 'SEAL-A-001'}
    }

    ts2 = parse_timestamp(event2['timestamp'])
    builder.add_event(event2, ts2)

    chains = builder.build_all()
    assert len(chains) == 1
    assert len(chains[0].events) == 2
    assert chains[0].seal_a == 'SEAL-A-001'


def test_seal_consistency_pass():
    builder = ChainBuilder()

    for event_data, ts_str in [
        ({'event_id': 'E1', 'timestamp': '2026-05-01T10:00:00+08:00', 'event_type': 'collection', 'athlete_id': 'ATH001', 'sample_id': 'SMP001', 'details': {}}, '2026-05-01T10:00:00+08:00'),
        ({'event_id': 'E2', 'timestamp': '2026-05-01T10:05:00+08:00', 'event_type': 'sealing', 'athlete_id': 'ATH001', 'sample_id': 'SMP001', 'details': {'bottle': 'A', 'seal_number': 'SEAL-001'}}, '2026-05-01T10:05:00+08:00'),
        ({'event_id': 'E3', 'timestamp': '2026-05-01T10:06:00+08:00', 'event_type': 'sealing', 'athlete_id': 'ATH001', 'sample_id': 'SMP001', 'details': {'bottle': 'B', 'seal_number': 'SEAL-001'}}, '2026-05-01T10:06:00+08:00'),
    ]:
        builder.add_event(event_data, parse_timestamp(ts_str))

    engine = RuleEngine()
    issues = engine.validate_chain(builder.chains['ATH001_SMP001'])
    seal_issues = [i for i in issues if i.category == 'seal_mismatch']
    assert len(seal_issues) == 0


def test_seal_consistency_fail():
    from dataclasses import dataclass as dc

    @dc
    class MockEvent:
        event_id: str
        timestamp: datetime
        event_type: str
        details: dict

    chain = SampleChain(athlete_id='ATH001', sample_id='SMP001')
    chain.events = [
        MockEvent(
            event_id='E1',
            timestamp=datetime(2026, 5, 1, 10, 5, tzinfo=timezone.utc),
            event_type='sealing',
            details={'bottle': 'A', 'seal_number': 'SEAL-A-001'}
        ),
        MockEvent(
            event_id='E2',
            timestamp=datetime(2026, 5, 1, 10, 6, tzinfo=timezone.utc),
            event_type='sealing',
            details={'bottle': 'B', 'seal_number': 'SEAL-B-001'}
        ),
    ]

    engine = RuleEngine()
    issues = engine._check_seal_consistency(chain)

    assert len(issues) == 1
    assert issues[0].issue_id == 'SEAL_001'
    assert '不一致' in issues[0].description


def test_missing_signature():
    from dataclasses import dataclass as dc

    @dc
    class MockEvent:
        event_id: str
        timestamp: datetime
        event_type: str
        details: dict

    chain = SampleChain(athlete_id='ATH001', sample_id='SMP001')
    chain.events = [
        MockEvent(
            event_id='E1',
            timestamp=datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc),
            event_type='handover',
            details={'signatures': {'collector': 'DR_WANG'}}
        ),
    ]

    engine = RuleEngine({'required_signatures': ['collector', 'athlete', 'chaperone', 'receiver']})
    issues = engine._check_handover_signatures(chain)

    assert len(issues) == 1
    assert issues[0].issue_id == 'HAND_001'
    assert 'athlete' in issues[0].description


def test_time_reversal():
    from dataclasses import dataclass as dc

    @dc
    class MockEvent:
        event_id: str
        timestamp: datetime
        event_type: str
        details: dict

    chain = SampleChain(athlete_id='ATH001', sample_id='SMP001')
    chain.events = [
        MockEvent(
            event_id='E1',
            timestamp=datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc),
            event_type='collection',
            details={}
        ),
        MockEvent(
            event_id='E2',
            timestamp=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
            event_type='sealing',
            details={}
        ),
    ]

    engine = RuleEngine()
    issues = engine._check_time_order(chain)

    assert len(issues) == 1
    assert issues[0].issue_id == 'TIME_001'


def test_ab_split_incomplete():
    from dataclasses import dataclass as dc

    @dc
    class MockEvent:
        event_id: str
        timestamp: datetime
        event_type: str
        details: dict

    chain = SampleChain(athlete_id='ATH001', sample_id='SMP001')
    chain.events = [
        MockEvent(
            event_id='E1',
            timestamp=datetime(2026, 5, 1, 10, 5, tzinfo=timezone.utc),
            event_type='sealing',
            details={'bottle': 'A', 'seal_number': 'SEAL-A-001'}
        ),
    ]

    engine = RuleEngine()
    issues = engine._check_ab_split(chain)

    assert len(issues) == 1
    assert issues[0].issue_id == 'SPLIT_001'


def test_multiple_samples_same_athlete():
    builder = ChainBuilder()

    events = [
        {'event_id': 'E1', 'timestamp': '2026-05-01T10:00:00+08:00', 'event_type': 'collection', 'athlete_id': 'ATH001', 'sample_id': 'SMP001', 'details': {}},
        {'event_id': 'E2', 'timestamp': '2026-05-01T12:00:00+08:00', 'event_type': 'collection', 'athlete_id': 'ATH001', 'sample_id': 'SMP002', 'details': {}},
    ]

    for e in events:
        builder.add_event(e, parse_timestamp(e['timestamp']))

    chains = builder.get_chains_by_athlete('ATH001')
    assert len(chains) == 2


def test_cross_timezone():
    ts1 = parse_timestamp("2026-05-01T22:00:00+08:00")
    ts2 = parse_timestamp("2026-05-01T14:00:00+00:00")

    assert ts1.hour == 22
    assert ts2.hour == 14

    if ts1.tzinfo and ts2.tzinfo:
        ts1_utc = ts1.astimezone(timezone.utc)
        ts2_utc = ts2.astimezone(timezone.utc)
        assert ts1_utc.hour == ts2_utc.hour


if __name__ == '__main__':
    test_parse_timestamp()
    test_parse_athletes()
    test_parse_jsonl()
    test_parse_handover_rules()
    test_chain_builder()
    test_seal_consistency_pass()
    test_seal_consistency_fail()
    test_missing_signature()
    test_time_reversal()
    test_ab_split_incomplete()
    test_multiple_samples_same_athlete()
    test_cross_timezone()
    print("All tests passed!")
