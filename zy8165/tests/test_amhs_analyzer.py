import unittest
from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import os
import json
import csv

from amhs_analyzer.topology import load_topology, Topology, Node, Edge
from amhs_analyzer.state_machine import (
    TransferStateMachine, TransferEvent, EventType,
    TransferStatus, build_state_machines
)
from amhs_analyzer.analysis import (
    BlockageAnalyzer, DowntimeWindow, TransferAnalysis,
    analyze_all
)


class TestTopology(unittest.TestCase):
    def setUp(self):
        self.test_yaml_content = """
nodes:
  - id: N1
    name: Node_1
    type: regular
    x: 0.0
    y: 0.0
  - id: N2
    name: Node_2
    type: equipment_port
    x: 100.0
    y: 0.0
    is_equipment: true
    equipment_id: EQ1

edges:
  - id: E1
    from: N1
    to: N2
    bidirectional: true
    distance: 100.0

equipments:
  - id: EQ1
    name: Equipment_1
    port_nodes:
      - N2
"""
    
    def test_load_topology(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            f.write(self.test_yaml_content)
            temp_path = Path(f.name)
        
        try:
            topology = load_topology(temp_path)
            
            self.assertEqual(len(topology.nodes), 2)
            self.assertEqual(len(topology.edges), 1)
            self.assertEqual(len(topology.equipments), 1)
            
            self.assertIn('N1', topology.nodes)
            self.assertIn('N2', topology.nodes)
            
            self.assertTrue(topology.nodes['N2'].is_equipment)
            self.assertEqual(topology.nodes['N2'].equipment_id, 'EQ1')
            
            neighbors = topology.get_neighbors('N1')
            self.assertEqual(neighbors, ['N2'])
        finally:
            os.unlink(temp_path)
    
    def test_is_equipment_port(self):
        topology = Topology()
        topology.nodes['N1'] = Node(id='N1', name='N1', node_type='regular')
        topology.nodes['N2'] = Node(id='N2', name='N2', node_type='equipment_port', is_equipment=True)
        
        self.assertFalse(topology.is_equipment_port('N1'))
        self.assertTrue(topology.is_equipment_port('N2'))


class TestStateMachine(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now()
    
    def _create_event(self, foup_id: str, event_type: EventType, timestamp: datetime, 
                     node_id: str = None, **kwargs) -> TransferEvent:
        return TransferEvent(
            foup_id=foup_id,
            event_type=event_type,
            timestamp=timestamp,
            node_id=node_id,
            raw_data={}
        )
    
    def test_normal_transfer_flow(self):
        machine = TransferStateMachine('TEST-001')
        ts = self.now
        
        machine.process_event(self._create_event('TEST-001', EventType.TASK_CREATED, ts, node_id='N1'))
        machine.process_event(self._create_event('TEST-001', EventType.ASSIGNED, ts + timedelta(seconds=5)))
        machine.process_event(self._create_event('TEST-001', EventType.DEPARTED, ts + timedelta(seconds=10), node_id='N1'))
        machine.process_event(self._create_event('TEST-001', EventType.ARRIVED, ts + timedelta(seconds=25), node_id='N2'))
        machine.process_event(self._create_event('TEST-001', EventType.COMPLETED, ts + timedelta(seconds=26)))
        
        self.assertEqual(machine.state.status, TransferStatus.COMPLETED)
        self.assertEqual(machine.state.current_node, 'N2')
        self.assertEqual(len(machine.state.events), 5)
    
    def test_queue_time_calculation(self):
        machine = TransferStateMachine('TEST-002')
        ts = self.now
        
        machine.process_event(self._create_event('TEST-002', EventType.DEPARTED, ts, node_id='N1'))
        machine.process_event(self._create_event('TEST-002', EventType.ARRIVED, ts + timedelta(seconds=10), node_id='N2'))
        machine.process_event(self._create_event('TEST-002', EventType.QUEUE_START, ts + timedelta(seconds=10), node_id='N2'))
        machine.process_event(self._create_event('TEST-002', EventType.QUEUE_END, ts + timedelta(seconds=30), node_id='N2'))
        machine.process_event(self._create_event('TEST-002', EventType.DEPARTED, ts + timedelta(seconds=31), node_id='N2'))
        machine.process_event(self._create_event('TEST-002', EventType.ARRIVED, ts + timedelta(seconds=34), node_id='N3'))
        machine.process_event(self._create_event('TEST-002', EventType.COMPLETED, ts + timedelta(seconds=35)))
        
        self.assertEqual(machine.state.total_queue_time_seconds, 20.0)
        self.assertGreater(len(machine.state.issues), 0)
        
        queue_issues = [i for i in machine.state.issues if i.get('issue_type') == 'node_queue']
        self.assertEqual(len(queue_issues), 1)
        self.assertEqual(queue_issues[0].get('duration_seconds'), 20.0)
    
    def test_out_of_order_event(self):
        machine = TransferStateMachine('TEST-003')
        ts = self.now
        
        machine.process_event(self._create_event('TEST-003', EventType.DEPARTED, ts + timedelta(seconds=20), node_id='N1'))
        machine.process_event(self._create_event('TEST-003', EventType.ARRIVED, ts + timedelta(seconds=10), node_id='N2'))
        
        has_anomaly = any('Out-of-order' in a for a in machine.state.anomalies)
        self.assertTrue(has_anomaly)
        
        self.assertEqual(len(machine.state.events), 2)
    
    def test_missing_arrival_event(self):
        machine = TransferStateMachine('TEST-004')
        ts = self.now
        
        machine.process_event(self._create_event('TEST-004', EventType.TASK_CREATED, ts, node_id='N1'))
        machine.process_event(self._create_event('TEST-004', EventType.DEPARTED, ts + timedelta(seconds=10), node_id='N1'))
        machine.process_event(self._create_event('TEST-004', EventType.COMPLETED, ts + timedelta(seconds=60)))
        
        missing_issues = [i for i in machine.state.issues if i.get('issue_type') == 'missing_arrival']
        self.assertGreater(len(missing_issues), 0)
        
        inferred_queue = [i for i in machine.state.issues if i.get('is_inferred', False)]
        self.assertGreater(len(inferred_queue), 0)
    
    def test_reroute_failure(self):
        machine = TransferStateMachine('TEST-005')
        ts = self.now
        
        machine.process_event(self._create_event('TEST-005', EventType.REROUTE, ts, node_id='N1'))
        machine.process_event(self._create_event('TEST-005', EventType.REROUTE_FAILED, ts + timedelta(seconds=5), 
                                                  node_id='N1', reason='no_alternative'))
        
        self.assertEqual(machine.state.reroute_attempts, 1)
        self.assertEqual(machine.state.failed_reroutes, 1)
        self.assertEqual(machine.state.status, TransferStatus.BLOCKED)
        
        reroute_issues = [i for i in machine.state.issues if i.get('issue_type') == 'reroute_failed']
        self.assertEqual(len(reroute_issues), 1)
    
    def test_long_equipment_occupation(self):
        machine = TransferStateMachine('TEST-006')
        ts = self.now
        
        machine.process_event(self._create_event('TEST-006', EventType.LOAD_START, ts, node_id='N1'))
        machine.process_event(self._create_event('TEST-006', EventType.LOAD_END, ts + timedelta(seconds=200), node_id='N1'))
        
        occ_issues = [i for i in machine.state.issues if i.get('issue_type') == 'equipment_occupation']
        self.assertEqual(len(occ_issues), 1)
        self.assertEqual(occ_issues[0].get('duration_seconds'), 200.0)


class TestAnalysis(unittest.TestCase):
    def setUp(self):
        self.topology = Topology()
        self.topology.nodes['N1'] = Node(id='N1', name='N1', node_type='regular')
        self.topology.nodes['N2'] = Node(id='N2', name='N2', node_type='regular')
        self.topology.nodes['EQ1_P1'] = Node(
            id='EQ1_P1', name='EQ1_Port1', node_type='equipment_port',
            is_equipment=True, equipment_id='EQ1'
        )
        self.topology.equipments['EQ1'] = type('Equipment', (), {
            'id': 'EQ1', 'name': 'Equipment_1', 'port_nodes': ['EQ1_P1']
        })()
        self.topology.equipments['EQ1'].port_nodes = ['EQ1_P1']
    
    def test_downtime_window(self):
        now = datetime.now()
        dt = DowntimeWindow(
            equipment_id='EQ1',
            start_time=now - timedelta(hours=1),
            end_time=now + timedelta(hours=1),
            reason='maintenance',
            affected_nodes=['EQ1_P1']
        )
        
        self.assertTrue(dt.is_active_at(now))
        self.assertFalse(dt.is_active_at(now - timedelta(hours=2)))
        self.assertFalse(dt.is_active_at(now + timedelta(hours=2)))
        
        overlap = dt.overlap_duration(now - timedelta(minutes=30), now + timedelta(minutes=30))
        self.assertEqual(overlap.total_seconds(), 3600.0)
    
    def test_analyzer_summary(self):
        now = datetime.now()
        
        events = [
            TransferEvent(
                foup_id='A001',
                event_type=EventType.TASK_CREATED,
                timestamp=now,
                node_id='N1'
            ),
            TransferEvent(
                foup_id='A001',
                event_type=EventType.DEPARTED,
                timestamp=now + timedelta(seconds=5),
                node_id='N1'
            ),
            TransferEvent(
                foup_id='A001',
                event_type=EventType.QUEUE_START,
                timestamp=now + timedelta(seconds=15),
                node_id='N2'
            ),
            TransferEvent(
                foup_id='A001',
                event_type=EventType.QUEUE_END,
                timestamp=now + timedelta(seconds=45),
                node_id='N2'
            ),
            TransferEvent(
                foup_id='A001',
                event_type=EventType.COMPLETED,
                timestamp=now + timedelta(seconds=50)
            ),
            TransferEvent(
                foup_id='A002',
                event_type=EventType.TASK_CREATED,
                timestamp=now + timedelta(minutes=5),
                node_id='N2'
            ),
            TransferEvent(
                foup_id='A002',
                event_type=EventType.COMPLETED,
                timestamp=now + timedelta(minutes=6)
            ),
        ]
        
        machines = build_state_machines(events)
        
        downtime_windows = []
        analyses, summary = analyze_all(self.topology, machines, downtime_windows)
        
        self.assertEqual(summary.total_transfers, 2)
        self.assertEqual(summary.completed_transfers, 2)
        self.assertGreater(summary.total_queue_time_seconds, 0)
        self.assertGreater(summary.node_queue_issues, 0)


class TestEventParsing(unittest.TestCase):
    def test_from_json_various_formats(self):
        test_cases = [
            {
                'data': {
                    'foup_id': 'F001',
                    'event_type': 'arrived',
                    'timestamp': '2026-05-03T08:00:00.000000',
                    'node_id': 'N1'
                },
                'expected_type': EventType.ARRIVED
            },
            {
                'data': {
                    'id': 'F002',
                    'type': 'queue-start',
                    'ts': '2026-05-03T09:00:00',
                    'node': 'N2'
                },
                'expected_type': EventType.QUEUE_START
            },
            {
                'data': {
                    'foup_id': 'F003',
                    'event_type': 'REROUTE_FAILED',
                    'timestamp': '2026-05-03T10:00:00'
                },
                'expected_type': EventType.REROUTE_FAILED
            },
        ]
        
        for case in test_cases:
            event = TransferEvent.from_json(case['data'])
            self.assertEqual(event.event_type, case['expected_type'])


if __name__ == '__main__':
    unittest.main()
