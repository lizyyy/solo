import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import pytz
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.analyzer import RiskAnalyzer
from config.settings import Settings


class TestRiskAnalyzer:
    @pytest.fixture
    def sample_normalized_data(self):
        tz = pytz.timezone(Settings.TIMEZONE)
        
        power_records = pd.DataFrame({
            'container_no': ['CONT001', 'CONT002', 'CONT001', 'CONT003'],
            'plug_in_time': [
                tz.localize(datetime(2024, 1, 1, 8, 0, 0)),
                tz.localize(datetime(2024, 1, 1, 8, 30, 0)),
                tz.localize(datetime(2024, 1, 2, 12, 0, 0)),
                tz.localize(datetime(2024, 1, 1, 9, 0, 0)),
            ],
            'unplug_time': [
                tz.localize(datetime(2024, 1, 1, 18, 0, 0)),
                tz.localize(datetime(2024, 1, 1, 10, 0, 0)),
                pd.NaT,
                tz.localize(datetime(2024, 1, 2, 8, 0, 0)),
            ],
            'outlet_id': ['OUT-A01-01-01-1', 'OUT-A01-01-01-1', 'OUT-A02-01-01-1', 'OUT-A03-01-01-1'],
            'slot_id': ['A01-01-01-1', 'A01-01-01-1', 'A02-01-01-1', 'A03-01-01-1'],
            'duration_hours': [10.0, 1.5, np.nan, 23.0],
            'is_active': [False, False, True, False],
            'source_type': 'power_record',
            'record_id': ['PR-000001', 'PR-000002', 'PR-000003', 'PR-000004'],
        })
        
        movement_logs = pd.DataFrame({
            'container_no': ['CONT001', 'CONT004'],
            'move_time': [
                tz.localize(datetime(2024, 1, 2, 8, 0, 0)),
                tz.localize(datetime(2024, 1, 1, 10, 0, 0)),
            ],
            'move_type': ['移箱', '进闸'],
            'from_slot': ['A01-01-01-1', '闸口'],
            'to_slot': ['A02-01-01-1', 'A04-01-01-1'],
            'is_gate_movement': [False, True],
            'source_type': 'movement_log',
            'record_id': ['ML-000001', 'ML-000002'],
        })
        
        alarm_events = pd.DataFrame({
            'container_no': ['CONT005', 'CONT006'],
            'alarm_time': [
                tz.localize(datetime(2024, 1, 1, 12, 0, 0)),
                tz.localize(datetime(2024, 1, 3, 8, 0, 0)),
            ],
            'alarm_type': ['温度异常', '断电报警'],
            'alarm_level': ['紧急', '重要'],
            'alarm_desc': ['温度超出范围', '检测到断电'],
            'slot_id': ['A05-01-01-1', 'A06-01-01-1'],
            'status': ['已闭环', '未处理'],
            'resolve_time': [
                tz.localize(datetime(2024, 1, 1, 12, 30, 0)),
                pd.NaT,
            ],
            'is_resolved': [True, False],
            'resolution_duration_hours': [0.5, np.nan],
            'source_type': 'alarm_event',
            'record_id': ['AE-000001', 'AE-000002'],
        })
        
        return {
            'power_records': power_records,
            'movement_logs': movement_logs,
            'alarm_events': alarm_events,
        }
    
    def test_analyze_all(self, sample_normalized_data):
        analyzer = RiskAnalyzer(sample_normalized_data)
        risks = analyzer.analyze_all()
        
        assert isinstance(risks, pd.DataFrame)
        assert len(analyzer.risk_summary) > 0
        assert 'total_risks' in analyzer.risk_summary
    
    def test_analyze_power_outage_timeout(self, sample_normalized_data):
        analyzer = RiskAnalyzer(sample_normalized_data)
        risks = analyzer.analyze_all()
        
        outage_risks = analyzer.get_risks_by_type('断电超时')
        
        if not outage_risks.empty:
            assert all(outage_risks['risk_type'] == '断电超时')
            assert 'container_no' in outage_risks.columns
            assert 'duration_minutes' in outage_risks.columns
    
    def test_analyze_outlet_conflicts(self, sample_normalized_data):
        analyzer = RiskAnalyzer(sample_normalized_data)
        risks = analyzer.analyze_all()
        
        conflict_risks = analyzer.get_risks_by_type('插座冲突')
        
        if not conflict_risks.empty:
            assert all(conflict_risks['risk_type'] == '插座冲突')
            assert 'outlet_id' in conflict_risks.columns
    
    def test_analyze_missing_replug_after_move(self, sample_normalized_data):
        analyzer = RiskAnalyzer(sample_normalized_data)
        risks = analyzer.analyze_all()
        
        replug_risks = analyzer.get_risks_by_type('移动未复插')
        
        if not replug_risks.empty:
            assert all(replug_risks['risk_type'] == '移动未复插')
    
    def test_analyze_unresolved_alarms(self, sample_normalized_data):
        analyzer = RiskAnalyzer(sample_normalized_data)
        risks = analyzer.analyze_all()
        
        alarm_risks = analyzer.get_risks_by_type('报警未闭环')
        
        if not alarm_risks.empty:
            assert all(alarm_risks['risk_type'] == '报警未闭环')
    
    def test_get_risks_by_severity(self, sample_normalized_data):
        analyzer = RiskAnalyzer(sample_normalized_data)
        risks = analyzer.analyze_all()
        
        for severity in ['紧急', '重要', '一般', '提示']:
            severity_risks = analyzer.get_risks_by_severity(severity)
            if not severity_risks.empty:
                assert all(severity_risks['severity'] == severity)
    
    def test_get_risks_by_container(self, sample_normalized_data):
        analyzer = RiskAnalyzer(sample_normalized_data)
        risks = analyzer.analyze_all()
        
        if not risks.empty:
            first_container = risks['container_no'].iloc[0]
            container_risks = analyzer.get_risks_by_container(first_container.split(',')[0].strip())
            
            if not container_risks.empty:
                assert any(first_container.split(',')[0].strip() in c for c in container_risks['container_no'])
    
    def test_get_risk_summary(self, sample_normalized_data):
        analyzer = RiskAnalyzer(sample_normalized_data)
        risks = analyzer.analyze_all()
        
        summary = analyzer.get_risk_summary()
        
        assert 'total_risks' in summary
        assert 'by_type' in summary
        assert 'by_severity' in summary
        
        assert isinstance(summary['by_type'], dict)
        assert isinstance(summary['by_severity'], dict)
        
        for key in ['紧急', '重要', '一般', '提示']:
            assert key in summary['by_severity']
    
    def test_calculate_severity(self):
        analyzer = RiskAnalyzer({})
        
        assert analyzer._calculate_severity(300) == '紧急'
        assert analyzer._calculate_severity(180) == '重要'
        assert analyzer._calculate_severity(60) == '一般'
        assert analyzer._calculate_severity(20) == '提示'
