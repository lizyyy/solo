import pytest
from datetime import datetime, timedelta
from src.models import Sample, Fridge, Rack, HandoverRecord, AlertType, SampleType, HandoverStatus
from src.rules import TimeoutRule, TemperatureRule, RackConflictRule, MissingSignatureRule, RuleEngine, create_default_engine


class TestTimeoutRule:
    
    def test_timeout_detection(self):
        rule = TimeoutRule(timeout_minutes=30.0)
        
        now = datetime.now()
        
        sample1 = Sample(
            sample_id="BL001",
            sample_type=SampleType.BLOOD,
            rack_id="RACK01",
            position="A01",
            scan_time=now,
            out_fridge_time=now - timedelta(minutes=45),
            in_fridge_time=now
        )
        
        sample2 = Sample(
            sample_id="BL002",
            sample_type=SampleType.BLOOD,
            rack_id="RACK01",
            position="A02",
            scan_time=now,
            out_fridge_time=now - timedelta(minutes=15),
            in_fridge_time=now
        )
        
        context = {
            "samples": [sample1, sample2],
            "current_time": now
        }
        
        alerts = rule.check(context)
        assert len(alerts) == 1
        assert alerts[0].alert_type == AlertType.TIMEOUT
        assert "45" in alerts[0].message
    
    def test_currently_out_timeout(self):
        rule = TimeoutRule(timeout_minutes=30.0)
        
        now = datetime.now()
        
        sample = Sample(
            sample_id="BL003",
            sample_type=SampleType.BLOOD,
            rack_id="RACK01",
            position="A03",
            scan_time=now,
            out_fridge_time=now - timedelta(minutes=60),
            status="离柜"
        )
        
        context = {
            "samples": [sample],
            "current_time": now
        }
        
        alerts = rule.check(context)
        assert len(alerts) == 1
        assert alerts[0].alert_type == AlertType.TIMEOUT


class TestTemperatureRule:
    
    def test_temp_exceed_detection(self):
        rule = TemperatureRule()
        
        fridge1 = Fridge(
            fridge_id="FRIDGE01",
            name="测试冰箱",
            min_temp=2.0,
            max_temp=8.0,
            current_temp=9.5
        )
        
        fridge2 = Fridge(
            fridge_id="FRIDGE02",
            name="正常冰箱",
            min_temp=2.0,
            max_temp=8.0,
            current_temp=5.0
        )
        
        context = {
            "fridges": [fridge1, fridge2],
            "temperature_records": []
        }
        
        alerts = rule.check(context)
        assert len(alerts) == 1
        assert alerts[0].alert_type == AlertType.TEMP_EXCEED
        assert "9.5" in alerts[0].message
    
    def test_temp_records_detection(self):
        rule = TemperatureRule()
        
        fridge = Fridge(
            fridge_id="FRIDGE01",
            name="测试冰箱",
            min_temp=2.0,
            max_temp=8.0
        )
        
        temp_records = [
            {"fridge_id": "FRIDGE01", "temperature": 1.0, "timestamp": datetime.now()
        ]
        
        context = {
            "fridges": [fridge],
            "temperature_records": temp_records
        }
        
        alerts = rule.check(context)
        assert len(alerts) == 1


class TestRackConflictRule:
    
    def test_rack_conflict_detection(self):
        rule = RackConflictRule()
        
        now = datetime.now()
        
        sample1 = Sample(
            sample_id="BL001",
            sample_type=SampleType.BLOOD,
            rack_id="RACK01",
            position="A01",
            scan_time=now,
            status="在柜"
        )
        
        sample2 = Sample(
            sample_id="BL002",
            sample_type=SampleType.BLOOD,
            rack_id="RACK01",
            position="A01",
            scan_time=now,
            status="在柜"
        )
        
        sample3 = Sample(
            sample_id="BL003",
            sample_type=SampleType.BLOOD,
            rack_id="RACK01",
            position="A02",
            scan_time=now,
            status="在柜"
        )
        
        context = {
            "samples": [sample1, sample2, sample3],
            "racks": []
        }
        
        alerts = rule.check(context)
        assert len(alerts) == 1
        assert alerts[0].alert_type == AlertType.RACK_CONFLICT
        assert "BL001" in alerts[0].message
        assert "BL002" in alerts[0].message


class TestMissingSignatureRule:
    
    def test_missing_signature_detection(self):
        rule = MissingSignatureRule()
        
        now = datetime.now()
        
        record1 = HandoverRecord(
            record_id="HO001",
            sample_id="BL001",
            from_operator="张医生",
            to_operator="李医生",
            handover_time=now - timedelta(hours=30),
            status=HandoverStatus.PENDING
        )
        
        record2 = HandoverRecord(
            record_id="HO002",
            sample_id="BL002",
            from_operator="张医生",
            to_operator="李医生",
            handover_time=now - timedelta(hours=5),
            status=HandoverStatus.PENDING
        )
        
        record3 = HandoverRecord(
            record_id="HO003",
            sample_id="BL003",
            from_operator="张医生",
            to_operator="李医生",
            handover_time=now - timedelta(hours=48),
            status=HandoverStatus.COMPLETED
        )
        
        context = {
            "handover_records": [record1, record2, record3],
            "current_time": now
        }
        
        alerts = rule.check(context)
        assert len(alerts) == 1
        assert alerts[0].alert_type == AlertType.MISSING_SIGNATURE


class TestRuleEngine:
    
    def test_engine_registration(self):
        engine = RuleEngine()
        timeout_rule = TimeoutRule()
        engine.register_rule(timeout_rule)
        
        assert "超时离柜检测" in engine.rules
    
    def test_run_all_rules(self):
        engine = create_default_engine()
        
        now = datetime.now()
        
        sample = Sample(
            sample_id="BL001",
            sample_type=SampleType.BLOOD,
            rack_id="RACK01",
            position="A01",
            scan_time=now,
            out_fridge_time=now - timedelta(minutes=60),
            status="离柜"
        )
        
        fridge = Fridge(
            fridge_id="FRIDGE01",
            name="测试冰箱",
            min_temp=2.0,
            max_temp=8.0,
            current_temp=10.0
        )
        
        context = {
            "samples": [sample],
            "fridges": [fridge],
            "racks": [],
            "handover_records": [],
            "temperature_records": [],
            "current_time": now
        }
        
        results = engine.run_all(context)
        assert "超时离柜检测" in results
        assert "温度越界检测" in results
        
        all_alerts = engine.get_all_alerts(context)
        assert len(all_alerts) >= 2
