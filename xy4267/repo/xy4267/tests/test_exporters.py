import pytest
import tempfile
import os
from datetime import datetime, timedelta
from src.import_export import MarkdownExporter, CSVExporter
from src.models import Sample, Fridge, Rack, HandoverRecord, Alert, DutyNote, SampleType, AlertType, HandoverStatus


class TestMarkdownExporter:
    
    def test_generate_handover_report(self):
        exporter = MarkdownExporter()
        
        now = datetime.now()
        
        samples = [
            Sample(
                sample_id="BL001",
                sample_type=SampleType.BLOOD,
                rack_id="RACK01",
                position="A01",
                scan_time=now,
                status="在柜"
            )
        ]
        
        fridges = [
            Fridge(
                fridge_id="FRIDGE01",
                name="冷藏冰箱1号",
                min_temp=2.0,
                max_temp=8.0,
                current_temp=5.0
            )
        ]
        
        racks = [
            Rack(rack_id="RACK01", fridge_id="FRIDGE01", capacity=20)
        ]
        
        handovers = [
            HandoverRecord(
                record_id="HO001",
                sample_id="BL001",
                from_operator="张医生",
                to_operator="李医生",
                handover_time=now,
                status=HandoverStatus.COMPLETED
            )
        ]
        
        alerts = [
            Alert(
                alert_id="AL001",
                alert_type=AlertType.TIMEOUT,
                related_id="BL001",
                related_type="Sample",
                message="测试告警",
                timestamp=now,
                is_resolved=False
            )
        ]
        
        duty_notes = [
            DutyNote(
                note_id="NOTE001",
                shift_date=now,
                operator_name="张医生",
                content="测试备注",
                created_time=now
            )
        ]
        
        content = exporter.generate_handover_report(
            samples=samples,
            fridges=fridges,
            racks=racks,
            handovers=handovers,
            alerts=alerts,
            duty_notes=duty_notes,
            operator_name="张医生"
        )
        
        assert "# 冰箱样本温控交接单" in content
        assert "张医生" in content
        assert "BL001" in content
        assert "FRIDGE01" in content
    
    def test_export_to_file(self):
        exporter = MarkdownExporter()
        
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = os.path.join(temp_dir, "test.md")
            content = "# 测试报告\n\n测试内容"
            
            result = exporter.export_to_file(file_path, content)
            assert result == True
            
            with open(file_path, "r", encoding="utf-8") as f:
                saved_content = f.read()
            
            assert saved_content == content


class TestCSVExporter:
    
    def test_export_alerts(self):
        exporter = CSVExporter()
        
        now = datetime.now()
        
        alerts = [
            Alert(
                alert_id="AL001",
                alert_type=AlertType.TIMEOUT,
                related_id="BL001",
                related_type="Sample",
                message="超时离柜",
                timestamp=now,
                is_resolved=False
            ),
            Alert(
                alert_id="AL002",
                alert_type=AlertType.TEMP_EXCEED,
                related_id="FRIDGE01",
                related_type="Fridge",
                message="温度越界",
                timestamp=now - timedelta(hours=1),
                is_resolved=True,
                resolved_time=now
            )
        ]
        
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = os.path.join(temp_dir, "alerts.csv")
            
            result = exporter.export_alerts(alerts, file_path)
            assert result == True
            
            with open(file_path, "r", encoding="utf-8-sig") as f:
                lines = f.readlines()
            
            assert len(lines) == 3
            assert "告警ID" in lines[0]
            assert "AL001" in lines[1]
            assert "AL002" in lines[2]
    
    def test_export_samples(self):
        exporter = CSVExporter()
        
        now = datetime.now()
        
        samples = [
            Sample(
                sample_id="BL001",
                sample_type=SampleType.BLOOD,
                rack_id="RACK01",
                position="A01",
                scan_time=now,
                status="在柜"
            )
        ]
        
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = os.path.join(temp_dir, "samples.csv")
            
            result = exporter.export_samples(samples, file_path)
            assert result == True
    
    def test_export_risk_summary(self):
        exporter = CSVExporter()
        
        now = datetime.now()
        
        alerts = [
            Alert(
                alert_id="AL001",
                alert_type=AlertType.TIMEOUT,
                related_id="BL001",
                related_type="Sample",
                message="超时离柜测试",
                timestamp=now,
                is_resolved=False
            )
        ]
        
        samples = [
            Sample(
                sample_id="BL002",
                sample_type=SampleType.BLOOD,
                rack_id="RACK01",
                position="A01",
                scan_time=now,
                status="离柜"
            )
        ]
        
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = os.path.join(temp_dir, "risk.csv")
            
            result = exporter.export_risk_summary(alerts, samples, file_path)
            assert result == True
