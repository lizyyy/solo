import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import tempfile
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.parser import DataParser
from utils.helpers import normalize_slot_id


class TestDataParser:
    @pytest.fixture
    def sample_power_data(self):
        return pd.DataFrame({
            '箱号': ['CONT001', 'CONT002', 'CONT001'],
            '插电时间': ['2024-01-01 08:00:00', '2024-01-01 09:00:00', '2024-01-02 10:00:00'],
            '断电时间': ['2024-01-01 18:00:00', '2024-01-02 09:00:00', ''],
            '插座编号': ['OUT-A01-01-01-1', 'OUT-A01-02-01-1', 'OUT-A02-01-01-1'],
            '堆位': ['A01-01-01-1', 'A01-02-01-1', 'A02-01-01-1'],
            '操作员': ['OP1001', 'OP1002', 'OP1001'],
        })
    
    @pytest.fixture
    def sample_movement_data(self):
        return pd.DataFrame({
            '箱号': ['CONT001', 'CONT002', 'CONT001'],
            '移动时间': ['2024-01-01 07:30:00', '2024-01-01 08:30:00', '2024-01-02 09:30:00'],
            '操作类型': ['进闸', '进闸', '移箱'],
            '来源堆位': ['闸口', '闸口', 'A01-01-01-1'],
            '目标堆位': ['A01-01-01-1', 'A01-02-01-1', 'A02-01-01-1'],
            '设备号': ['RTG1', 'RTG2', 'RTG1'],
            '操作员': ['OP1001', 'OP1002', 'OP1001'],
        })
    
    @pytest.fixture
    def sample_gate_data(self):
        return pd.DataFrame({
            '箱号': ['CONT001', 'CONT002', 'CONT003'],
            '进闸时间': ['2024-01-01 07:00:00', '2024-01-01 08:00:00', '2024-01-03 10:00:00'],
            '出闸时间': ['', '', '2024-01-04 15:00:00'],
            '运输方式': ['集卡', '集卡', '铁路'],
            '车牌号': ['沪A12345', '沪A67890', ''],
            '提单号': ['BL001', 'BL002', 'BL003'],
        })
    
    @pytest.fixture
    def sample_alarm_data(self):
        return pd.DataFrame({
            '箱号': ['CONT001', 'CONT002', 'CONT001'],
            '报警时间': ['2024-01-01 12:00:00', '2024-01-01 14:00:00', '2024-01-02 11:00:00'],
            '报警类型': ['温度异常', '断电报警', '电压异常'],
            '报警级别': ['紧急', '紧急', '重要'],
            '报警描述': ['温度超出正常范围', '检测到断电', '电压波动'],
            '堆位': ['A01-01-01-1', 'A01-02-01-1', 'A02-01-01-1'],
            '处理状态': ['已闭环', '未处理', '处理中'],
            '处理时间': ['2024-01-01 12:30:00', '', ''],
            '处理人': ['TECH01', '', ''],
        })
    
    def test_parse_power_records(self, sample_power_data):
        parser = DataParser()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            sample_power_data.to_csv(f, index=False)
            temp_path = f.name
        
        try:
            df = parser.parse_power_records(temp_path)
            
            assert len(df) == 3
            assert 'container_no' in df.columns
            assert 'plug_in_time' in df.columns
            assert 'unplug_time' in df.columns
            assert 'outlet_id' in df.columns
            assert 'slot_id' in df.columns
            assert 'record_id' in df.columns
            
            assert df['container_no'].tolist() == ['CONT001', 'CONT002', 'CONT001']
            
            assert df['is_active'].iloc[0] == False
            assert df['is_active'].iloc[2] == True
            
            assert df['duration_hours'].iloc[0] == 10.0
            
        finally:
            os.unlink(temp_path)
    
    def test_parse_movement_logs(self, sample_movement_data):
        parser = DataParser()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            sample_movement_data.to_csv(f, index=False)
            temp_path = f.name
        
        try:
            df = parser.parse_movement_logs(temp_path)
            
            assert len(df) == 3
            assert 'container_no' in df.columns
            assert 'move_time' in df.columns
            assert 'move_type' in df.columns
            assert 'from_slot' in df.columns
            assert 'to_slot' in df.columns
            assert 'record_id' in df.columns
            
            assert df['container_no'].tolist() == ['CONT001', 'CONT002', 'CONT001']
            assert df['move_type'].iloc[2] == '移箱'
            
        finally:
            os.unlink(temp_path)
    
    def test_parse_gate_records(self, sample_gate_data):
        parser = DataParser()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            sample_gate_data.to_csv(f, index=False)
            temp_path = f.name
        
        try:
            df = parser.parse_gate_records(temp_path)
            
            assert len(df) == 3
            assert 'container_no' in df.columns
            assert 'gate_in_time' in df.columns
            assert 'gate_out_time' in df.columns
            assert 'record_id' in df.columns
            
            assert df['is_in_yard'].iloc[0] == True
            assert df['is_in_yard'].iloc[2] == False
            
            assert df['stay_duration_hours'].iloc[2] == 29.0
            
        finally:
            os.unlink(temp_path)
    
    def test_parse_alarm_events(self, sample_alarm_data):
        parser = DataParser()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            sample_alarm_data.to_csv(f, index=False)
            temp_path = f.name
        
        try:
            df = parser.parse_alarm_events(temp_path)
            
            assert len(df) == 3
            assert 'container_no' in df.columns
            assert 'alarm_time' in df.columns
            assert 'alarm_type' in df.columns
            assert 'alarm_level' in df.columns
            assert 'status' in df.columns
            assert 'record_id' in df.columns
            
            assert df['is_resolved'].iloc[0] == True
            assert df['is_resolved'].iloc[1] == False
            
            assert df['resolution_duration_hours'].iloc[0] == 0.5
            
        finally:
            os.unlink(temp_path)
    
    def test_get_all_data(self, sample_power_data, sample_movement_data):
        parser = DataParser()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            sample_power_data.to_csv(f, index=False)
            power_path = f.name
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            sample_movement_data.to_csv(f, index=False)
            movement_path = f.name
        
        try:
            parser.parse_power_records(power_path)
            parser.parse_movement_logs(movement_path)
            
            all_data = parser.get_all_data()
            
            assert 'power_records' in all_data
            assert 'movement_logs' in all_data
            assert len(all_data['power_records']) == 3
            assert len(all_data['movement_logs']) == 3
            
        finally:
            os.unlink(power_path)
            os.unlink(movement_path)
    
    def test_get_container_list(self, sample_power_data, sample_movement_data):
        parser = DataParser()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            sample_power_data.to_csv(f, index=False)
            power_path = f.name
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            sample_movement_data.to_csv(f, index=False)
            movement_path = f.name
        
        try:
            parser.parse_power_records(power_path)
            parser.parse_movement_logs(movement_path)
            
            containers = parser.get_container_list()
            
            assert 'CONT001' in containers
            assert 'CONT002' in containers
            assert len(containers) == 2
            
        finally:
            os.unlink(power_path)
            os.unlink(movement_path)
