import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import pytz
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.normalizer import DataNormalizer
from config.settings import Settings


class TestDataNormalizer:
    @pytest.fixture
    def sample_raw_data(self):
        tz = pytz.timezone(Settings.TIMEZONE)
        
        power_records = pd.DataFrame({
            'container_no': ['CONT001', 'CONT002', 'CONT001'],
            'plug_in_time': [
                tz.localize(datetime(2024, 1, 1, 8, 0, 0)),
                tz.localize(datetime(2024, 1, 1, 9, 0, 0)),
                tz.localize(datetime(2024, 1, 2, 10, 0, 0)),
            ],
            'unplug_time': [
                tz.localize(datetime(2024, 1, 1, 18, 0, 0)),
                tz.localize(datetime(2024, 1, 2, 9, 0, 0)),
                pd.NaT,
            ],
            'outlet_id': ['OUT-A01-01-01-1', 'OUT-A01-02-01-1', 'OUT-A02-01-01-1'],
            'slot_id': ['A01-01-01-1', 'A01-02-01-1', 'A02-01-01-1'],
            'operator': ['OP1001', 'OP1002', 'OP1001'],
            'source_type': 'power_record',
            'record_id': ['PR-000001', 'PR-000002', 'PR-000003'],
        })
        
        movement_logs = pd.DataFrame({
            'container_no': ['CONT001', 'CONT002', 'CONT001'],
            'move_time': [
                tz.localize(datetime(2024, 1, 1, 7, 30, 0)),
                tz.localize(datetime(2024, 1, 1, 8, 30, 0)),
                tz.localize(datetime(2024, 1, 2, 9, 30, 0)),
            ],
            'move_type': ['进闸', '进闸', '移箱'],
            'from_slot': ['闸口', '闸口', 'A01-01-01-1'],
            'to_slot': ['A01-01-01-1', 'A01-02-01-1', 'A02-01-01-1'],
            'equipment_id': ['RTG1', 'RTG2', 'RTG1'],
            'operator': ['OP1001', 'OP1002', 'OP1001'],
            'source_type': 'movement_log',
            'record_id': ['ML-000001', 'ML-000002', 'ML-000003'],
        })
        
        alarm_events = pd.DataFrame({
            'container_no': ['CONT001', 'CONT002'],
            'alarm_time': [
                tz.localize(datetime(2024, 1, 1, 12, 0, 0)),
                tz.localize(datetime(2024, 1, 1, 14, 0, 0)),
            ],
            'alarm_type': ['温度异常', '断电报警'],
            'alarm_level': ['紧急', '紧急'],
            'alarm_desc': ['温度超出正常范围', '检测到断电'],
            'slot_id': ['A01-01-01-1', 'A01-02-01-1'],
            'status': ['已闭环', '未处理'],
            'resolve_time': [
                tz.localize(datetime(2024, 1, 1, 12, 30, 0)),
                pd.NaT,
            ],
            'resolved_by': ['TECH01', ''],
            'source_type': 'alarm_event',
            'record_id': ['AE-000001', 'AE-000002'],
        })
        
        return {
            'power_records': power_records,
            'movement_logs': movement_logs,
            'alarm_events': alarm_events,
        }
    
    def test_normalize_all(self, sample_raw_data):
        normalizer = DataNormalizer(sample_raw_data)
        normalized = normalizer.normalize_all()
        
        assert 'power_records' in normalized
        assert 'movement_logs' in normalized
        assert 'alarm_events' in normalized
        
        assert not normalizer.timeline_events.empty
        assert len(normalizer.container_states) > 0
    
    def test_normalize_power_records(self, sample_raw_data):
        normalizer = DataNormalizer(sample_raw_data)
        normalizer.normalize_all()
        
        pr = normalizer.normalized_data['power_records']
        
        assert 'duration_hours' in pr.columns
        assert 'is_active' in pr.columns
        
        assert pr['duration_hours'].iloc[0] == 10.0
        assert pr['is_active'].iloc[0] == False
        assert pr['is_active'].iloc[2] == True
    
    def test_normalize_movement_logs(self, sample_raw_data):
        normalizer = DataNormalizer(sample_raw_data)
        normalizer.normalize_all()
        
        ml = normalizer.normalized_data['movement_logs']
        
        assert 'is_gate_movement' in ml.columns
        
        assert ml['is_gate_movement'].iloc[0] == True
        assert ml['is_gate_movement'].iloc[2] == False
    
    def test_normalize_alarm_events(self, sample_raw_data):
        normalizer = DataNormalizer(sample_raw_data)
        normalizer.normalize_all()
        
        ae = normalizer.normalized_data['alarm_events']
        
        assert 'is_resolved' in ae.columns
        assert 'resolution_duration_hours' in ae.columns
        
        assert ae['is_resolved'].iloc[0] == True
        assert ae['is_resolved'].iloc[1] == False
        assert ae['resolution_duration_hours'].iloc[0] == 0.5
    
    def test_build_timeline(self, sample_raw_data):
        normalizer = DataNormalizer(sample_raw_data)
        normalizer.normalize_all()
        
        timeline = normalizer.timeline_events
        
        assert len(timeline) > 0
        assert 'event_time' in timeline.columns
        assert 'event_type' in timeline.columns
        assert 'container_no' in timeline.columns
        
        event_types = timeline['event_type'].unique().tolist()
        assert '插电' in event_types
        assert '断电' in event_types
        assert '进闸' in event_types
        assert '移箱' in event_types
        assert '报警-紧急' in event_types
    
    def test_build_container_states(self, sample_raw_data):
        normalizer = DataNormalizer(sample_raw_data)
        normalizer.normalize_all()
        
        assert 'CONT001' in normalizer.container_states
        assert 'CONT002' in normalizer.container_states
        
        cont001_states = normalizer.container_states['CONT001']
        assert len(cont001_states) > 0
        
        event_types = cont001_states['type'].unique().tolist()
        assert 'plug_in' in event_types
        assert 'unplug' in event_types
        assert 'movement' in event_types
        assert 'alarm' in event_types
    
    def test_build_yard_inventory(self, sample_raw_data):
        normalizer = DataNormalizer(sample_raw_data)
        normalizer.normalize_all()
        
        inventory = normalizer.yard_inventory
        
        assert len(inventory) > 0
        assert 'container_no' in inventory.columns
        assert 'slot_id' in inventory.columns
        assert 'is_powered' in inventory.columns
        assert 'status' in inventory.columns
        
        powered = inventory[inventory['is_powered'] == True]
        assert len(powered) > 0
    
    def test_get_time_range(self, sample_raw_data):
        normalizer = DataNormalizer(sample_raw_data)
        normalizer.normalize_all()
        
        start_time, end_time = normalizer.get_time_range()
        
        assert start_time is not None
        assert end_time is not None
        assert start_time < end_time
    
    def test_get_container_timeline(self, sample_raw_data):
        normalizer = DataNormalizer(sample_raw_data)
        normalizer.normalize_all()
        
        timeline = normalizer.get_container_timeline('CONT001')
        
        assert not timeline.empty
        assert 'time' in timeline.columns
        assert 'type' in timeline.columns
        
        empty_timeline = normalizer.get_container_timeline('NONEXISTENT')
        assert empty_timeline.empty
    
    def test_get_all_normalized_data(self, sample_raw_data):
        normalizer = DataNormalizer(sample_raw_data)
        normalizer.normalize_all()
        
        all_data = normalizer.get_all_normalized_data()
        
        assert 'power_records' in all_data
        assert 'movement_logs' in all_data
        assert 'alarm_events' in all_data
        assert 'timeline' in all_data
        assert 'yard_inventory' in all_data
