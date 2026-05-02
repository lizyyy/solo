import sys
sys.path.insert(0, '/Users/lzy/pro/solocoder/pro/zy8094/repo/zy8094')
from datetime import datetime, timezone
from chain_audit.state_machine import SampleChain
from chain_audit.rules import RuleEngine
from dataclasses import dataclass as dc

@dc
class MockEvent:
    event_id: str
    timestamp: datetime
    event_type: str
    details: dict

# Test 1: events already in correct chronological order
print("=== Test 1: events already sorted correctly ===")
chain1 = SampleChain(athlete_id='ATH001', sample_id='SMP001')
chain1.events = [
    MockEvent(
        event_id='E1',
        timestamp=datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc),
        event_type='collection',
        details={}
    ),
    MockEvent(
        event_id='E2',
        timestamp=datetime(2026, 5, 1, 11, 0, tzinfo=timezone.utc),
        event_type='handover',
        details={}
    ),
]
engine = RuleEngine()
issues1 = engine._check_time_order(chain1)
print(f'Sorted events:')
for e in chain1.sorted_events():
    print(f'  {e.event_id}: {e.event_type} at {e.timestamp}')
print(f'Issues: {len(issues1)}')

# Test 2: events in reversed order
print("\n=== Test 2: events in reversed order ===")
chain2 = SampleChain(athlete_id='ATH001', sample_id='SMP001')
chain2.events = [
    MockEvent(
        event_id='E2',
        timestamp=datetime(2026, 5, 1, 11, 0, tzinfo=timezone.utc),
        event_type='handover',
        details={}
    ),
    MockEvent(
        event_id='E1',
        timestamp=datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc),
        event_type='collection',
        details={}
    ),
]
issues2 = engine._check_time_order(chain2)
print(f'Sorted events:')
for e in chain2.sorted_events():
    print(f'  {e.event_id}: {e.event_type} at {e.timestamp}')
print(f'Issues: {len(issues2)}')
for issue in issues2:
    print(f'  {issue.issue_id}: {issue.description}')

# Test 3: test what the _check_time_order function actually compares
print("\n=== Test 3: Debug the actual comparison ===")
sorted_events = chain2.sorted_events()
for i in range(1, len(sorted_events)):
    prev = sorted_events[i - 1]
    curr = sorted_events[i]
    print(f'i={i}: prev={prev.event_id}({prev.timestamp}), curr={curr.event_id}({curr.timestamp})')
    print(f'  curr.timestamp < prev.timestamp: {curr.timestamp < prev.timestamp}')