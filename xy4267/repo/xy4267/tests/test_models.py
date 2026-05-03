import pytest
from datetime import datetime, timedelta
from src.models import Sample, Fridge, Rack, HandoverRecord, Alert, DutyNote, SampleType, AlertType, HandoverStatus


class TestSample:
    
    def test_sample_creation(self):
        sample = Sample(
            sample_id="BL001",
            sample_type=SampleType.BLOOD,
            rack_id="RACK01",
            position="A01",
            scan_time=datetime.now()
        )
        assert sample.sample_id == "BL001"
        assert sample.sample_type == SampleType.BLOOD
        assert sample.rack_id == "RACK01"
        assert sample.position == "A01"
        assert sample.status == "在柜"
    
    def test_sample_duration_out(self):
        now = datetime.now()
        sample = Sample(
            sample_id="BL002",
            sample_type=SampleType.BLOOD,
            rack_id="RACK01",
            position="A02",
            scan_time=now,
            out_fridge_time=now - timedelta(minutes=45),
            in_fridge_time=now
        )
        assert sample.duration_out == 45.0
    
    def test_sample_no_duration(self):
        sample = Sample(
            sample_id="BL003",
            sample_type=SampleType.BLOOD,
            rack_id="RACK01",
            position="A03",
            scan_time=datetime.now()
        )
        assert sample.duration_out == 0.0


class TestFridge:
    
    def test_fridge_creation(self):
        fridge = Fridge(
            fridge_id="FRIDGE01",
            name="冷藏冰箱1号",
            min_temp=2.0,
            max_temp=8.0
        )
        assert fridge.fridge_id == "FRIDGE01"
        assert fridge.name == "冷藏冰箱1号"
        assert fridge.min_temp == 2.0
        assert fridge.max_temp == 8.0
    
    def test_fridge_temp_normal(self):
        fridge = Fridge(
            fridge_id="FRIDGE02",
            name="测试冰箱",
            min_temp=2.0,
            max_temp=8.0
        )
        assert fridge.is_temp_normal(5.0) == True
        assert fridge.is_temp_normal(1.0) == False
        assert fridge.is_temp_normal(9.0) == False
        assert fridge.is_temp_normal(2.0) == True
        assert fridge.is_temp_normal(8.0) == True


class TestRack:
    
    def test_rack_creation(self):
        rack = Rack(
            rack_id="RACK01",
            fridge_id="FRIDGE01",
            capacity=20
        )
        assert rack.rack_id == "RACK01"
        assert rack.fridge_id == "FRIDGE01"
        assert rack.capacity == 20
        assert len(rack.occupied_positions) == 0
    
    def test_rack_occupied_positions(self):
        rack = Rack(
            rack_id="RACK02",
            fridge_id="FRIDGE01"
        )
        rack.occupied_positions["A01"] = "BL001"
        rack.occupied_positions["A02"] = "BL002"
        
        assert rack.is_position_occupied("A01") == True
        assert rack.is_position_occupied("A03") == False
        assert "BL001" in rack.get_occupied_samples()
        assert len(rack.get_occupied_samples()) == 2


class TestHandoverRecord:
    
    def test_handover_creation(self):
        record = HandoverRecord(
            record_id="HO001",
            sample_id="BL001",
            from_operator="张医生",
            to_operator="李医生",
            handover_time=datetime.now()
        )
        assert record.record_id == "HO001"
        assert record.sample_id == "BL001"
        assert record.from_operator == "张医生"
        assert record.to_operator == "李医生"
        assert record.status == HandoverStatus.PENDING


class TestAlert:
    
    def test_alert_creation(self):
        alert = Alert(
            alert_id="AL001",
            alert_type=AlertType.TIMEOUT,
            related_id="BL001",
            related_type="Sample",
            message="样本超时离柜",
            timestamp=datetime.now()
        )
        assert alert.alert_id == "AL001"
        assert alert.alert_type == AlertType.TIMEOUT
        assert alert.related_id == "BL001"
        assert alert.is_resolved == False
    
    def test_alert_resolve(self):
        alert = Alert(
            alert_id="AL002",
            alert_type=AlertType.TEMP_EXCEED,
            related_id="FRIDGE01",
            related_type="Fridge",
            message="温度越界",
            timestamp=datetime.now()
        )
        alert.is_resolved = True
        alert.resolved_time = datetime.now()
        alert.resolver = "李医生"
        
        assert alert.is_resolved == True
        assert alert.resolver == "李医生"


class TestDutyNote:
    
    def test_duty_note_creation(self):
        now = datetime.now()
        note = DutyNote(
            note_id="NOTE001",
            shift_date=now,
            operator_name="张医生",
            content="夜班值班备注",
            created_time=now,
            is_important=True
        )
        assert note.note_id == "NOTE001"
        assert note.operator_name == "张医生"
        assert note.content == "夜班值班备注"
        assert note.is_important == True
