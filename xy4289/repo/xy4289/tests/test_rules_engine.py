import pytest
import os
import sys
import tempfile
import pandas as pd
from datetime import datetime, date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_parser import DataParser
from metrics_calculator import MetricsCalculator
from rules_engine import RulesEngine, RiskLevel, RiskAlert
import config


class TestRulesEngine:
    @pytest.fixture
    def setup_engine(self):
        parser = DataParser()
        metrics = MetricsCalculator(parser)
        engine = RulesEngine(metrics, parser)
        return engine, metrics, parser

    def test_risk_level_enum(self):
        assert RiskLevel.CRITICAL.value == 'critical'
        assert RiskLevel.HIGH.value == 'high'
        assert RiskLevel.MEDIUM.value == 'medium'
        assert RiskLevel.LOW.value == 'low'

    def test_risk_alert_creation(self):
        alert = RiskAlert(
            alert_id='ALERT-001',
            risk_level=RiskLevel.HIGH,
            category='test',
            description='测试预警',
            recommendation='测试建议'
        )
        
        assert alert.alert_id == 'ALERT-001'
        assert alert.risk_level == RiskLevel.HIGH
        assert alert.category == 'test'

    def test_high_load_detection(self, setup_engine):
        engine, metrics, parser = setup_engine
        
        parser.machine_records = pd.DataFrame([
            {
                'machine_id': 'M-001',
                'start_time': datetime(2026, 5, 1, 8, 0),
                'end_time': datetime(2026, 5, 1, 22, 0),
                'duration_hours': 14.0,
                'date': date(2026, 5, 1)
            }
        ])
        
        metrics.calculate_machine_load()
        
        alerts = engine.check_high_load()
        
        assert len(alerts) > 0
        
        high_load_alerts = [a for a in alerts if a.category == 'high_load']
        assert len(high_load_alerts) > 0
        assert high_load_alerts[0].risk_level == RiskLevel.HIGH
        assert 'M-001' in high_load_alerts[0].description

    def test_consecutive_overuse_detection(self, setup_engine):
        engine, metrics, parser = setup_engine
        
        records = []
        for day in range(5):
            records.append({
                'machine_id': 'M-001',
                'start_time': datetime(2026, 5, 1 + day, 8, 0),
                'end_time': datetime(2026, 5, 1 + day, 12, 0),
                'duration_hours': 4.0,
                'date': date(2026, 5, 1 + day)
            })
        
        parser.machine_records = pd.DataFrame(records)
        
        metrics.calculate_machine_load()
        
        alerts = engine.check_high_load()
        
        consecutive_alerts = [a for a in alerts if a.category == 'consecutive_overuse']
        assert len(consecutive_alerts) > 0
        assert consecutive_alerts[0].risk_level == RiskLevel.CRITICAL

    def test_water_quality_anomaly_detection(self, setup_engine):
        engine, metrics, parser = setup_engine
        
        parser.water_quality = pd.DataFrame([
            {
                'test_time': datetime(2026, 5, 1, 8, 0),
                'conductivity': 0.15,
                'bacteria_count': 150,
                'endotoxin': 0.05,
                'date': date(2026, 5, 1)
            }
        ])
        
        metrics.calculate_water_quality_status()
        
        alerts = engine.check_water_quality_risk()
        
        assert len(alerts) > 0
        
        water_alerts = [a for a in alerts if a.category == 'water_quality_anomaly']
        assert len(water_alerts) > 0

    def test_maintenance_conflict_detection(self, setup_engine):
        engine, metrics, parser = setup_engine
        
        parser.maintenance_records = pd.DataFrame([
            {
                'maintenance_id': 'M001',
                'machine_id': 'M-001',
                'fault_time': datetime(2026, 5, 1, 10, 0),
                'repair_time': datetime(2026, 5, 1, 12, 0),
                'resolved_time': pd.NaT,
                'fault_type': '血泵故障',
                'downtime_hours': 0
            }
        ])
        
        parser.machine_records = pd.DataFrame([
            {
                'machine_id': 'M-001',
                'start_time': datetime(2026, 5, 1, 14, 0),
                'end_time': datetime(2026, 5, 1, 18, 0),
                'duration_hours': 4.0,
                'date': date(2026, 5, 1),
                'patient_id': 'P001'
            }
        ])
        
        alerts = engine.check_maintenance_conflicts()
        
        assert len(alerts) > 0
        
        unresolved_alerts = [a for a in alerts if a.category == 'unresolved_maintenance']
        assert len(unresolved_alerts) > 0
        
        conflict_alerts = [a for a in alerts if a.category == 'session_during_unresolved_fault']
        assert len(conflict_alerts) > 0

    def test_run_all_checks(self, setup_engine):
        engine, metrics, parser = setup_engine
        
        parser.machine_records = pd.DataFrame([
            {
                'machine_id': 'M-001',
                'start_time': datetime(2026, 5, 1, 8, 0),
                'end_time': datetime(2026, 5, 1, 22, 0),
                'duration_hours': 14.0,
                'date': date(2026, 5, 1)
            }
        ])
        
        parser.water_quality = pd.DataFrame([
            {
                'test_time': datetime(2026, 5, 1, 8, 0),
                'conductivity': 0.15,
                'bacteria_count': 150,
                'endotoxin': 0.05,
                'date': date(2026, 5, 1)
            }
        ])
        
        metrics.calculate_machine_load()
        metrics.calculate_water_quality_status()
        
        result = engine.run_all_checks()
        
        assert 'alerts' in result
        assert 'recommendations' in result
        assert 'risk_counts' in result
        assert 'total_alerts' in result
        
        assert result['total_alerts'] > 0
        assert len(result['recommendations']) > 0

    def test_generate_recommendations(self, setup_engine):
        engine, metrics, parser = setup_engine
        
        engine.alerts = [
            RiskAlert(
                alert_id='ALERT-001',
                risk_level=RiskLevel.CRITICAL,
                category='test',
                machine_id='M-001',
                description='测试问题',
                recommendation='测试建议',
                affected_time=datetime(2026, 5, 1, 8, 0)
            )
        ]
        
        recommendations = engine.generate_recommendations()
        
        assert len(recommendations) == 1
        assert recommendations[0]['alert_id'] == 'ALERT-001'
        assert recommendations[0]['risk_level'] == 'critical'
        assert recommendations[0]['priority'] == 4

    def test_priority_scores(self, setup_engine):
        engine, _, _ = setup_engine
        
        assert engine._get_priority_score(RiskLevel.CRITICAL) == 4
        assert engine._get_priority_score(RiskLevel.HIGH) == 3
        assert engine._get_priority_score(RiskLevel.MEDIUM) == 2
        assert engine._get_priority_score(RiskLevel.LOW) == 1
