"""测试解析器模块"""
import pytest
import tempfile
import json
from datetime import datetime, timedelta
from pathlib import Path
import csv

from eeg_aligner.parsers import (
    EEGCSVParser,
    EventsJSONLParser,
    SleepStagesParser,
    ClockCalibrationParser,
    DataValidator,
)
from eeg_aligner.models import (
    EventType,
    SleepStage,
    IssueSeverity,
)


class TestEEGCSVParser:
    """测试EEG CSV解析器"""
    
    def test_parse_valid_csv(self):
        """测试解析有效的CSV"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            writer = csv.DictWriter(f, fieldnames=[
                'channel_name', 'sampling_rate', 'start_time', 'end_time',
                'total_samples', 'valid_samples', 'artifact_percentage'
            ])
            writer.writeheader()
            writer.writerow({
                'channel_name': 'F3-M2',
                'sampling_rate': '256.0',
                'start_time': '2024-01-01 22:00:00',
                'end_time': '2024-01-02 06:00:00',
                'total_samples': str(256 * 8 * 3600),
                'valid_samples': str(int(256 * 8 * 3600 * 0.95)),
                'artifact_percentage': '5.0',
            })
            temp_path = Path(f.name)
        
        try:
            parser = EEGCSVParser()
            summaries = parser.parse(temp_path)
            
            assert len(summaries) == 1
            assert summaries[0].channel_name == 'F3-M2'
            assert summaries[0].sampling_rate == 256.0
        finally:
            temp_path.unlink()
    
    def test_parse_with_quality_metrics(self):
        """测试解析包含质量指标的CSV"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            writer = csv.DictWriter(f, fieldnames=[
                'channel_name', 'sampling_rate', 'start_time', 'end_time',
                'total_samples', 'valid_samples', 'artifact_percentage',
                'impedance_kohm', 'snr_db'
            ])
            writer.writeheader()
            writer.writerow({
                'channel_name': 'C3-M2',
                'sampling_rate': '512.0',
                'start_time': '2024-01-01 22:00:00',
                'end_time': '2024-01-02 06:00:00',
                'total_samples': str(512 * 8 * 3600),
                'valid_samples': str(int(512 * 8 * 3600 * 0.98)),
                'artifact_percentage': '2.0',
                'impedance_kohm': '5.2',
                'snr_db': '25.5',
            })
            temp_path = Path(f.name)
        
        try:
            parser = EEGCSVParser()
            summaries = parser.parse(temp_path)
            
            assert len(summaries) == 1
            assert 'impedance_kohm' in summaries[0].quality_metrics
            assert summaries[0].quality_metrics['impedance_kohm'] == 5.2
        finally:
            temp_path.unlink()


class TestEventsJSONLParser:
    """测试事件JSONL解析器"""
    
    def test_parse_valid_jsonl(self):
        """测试解析有效的JSONL"""
        lines = [
            {
                "event_id": "evt_001",
                "event_code": 1,
                "event_type": "stimulus",
                "timestamp": "2024-01-01T22:00:05.123",
                "duration_ms": 100.0,
                "description": "声音刺激"
            },
            {
                "event_id": "evt_002",
                "event_code": 2,
                "event_type": "response",
                "timestamp": "2024-01-01T22:00:06.456",
                "duration_ms": 50.0,
                "description": "按钮反应"
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
            for line in lines:
                f.write(json.dumps(line) + '\n')
            temp_path = Path(f.name)
        
        try:
            parser = EventsJSONLParser()
            events = parser.parse(temp_path)
            
            assert len(events) == 2
            assert events[0].event_code == 1
            assert events[0].event_type == EventType.STIMULUS
            assert events[1].event_code == 2
            assert events[1].event_type == EventType.RESPONSE
        finally:
            temp_path.unlink()
    
    def test_parse_sync_event(self):
        """测试解析同步事件"""
        line = {
            "event_id": "sync_001",
            "event_code": 255,
            "event_type": "sync",
            "timestamp": "2024-01-01T22:00:00.000",
            "description": "同步脉冲"
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
            f.write(json.dumps(line) + '\n')
            temp_path = Path(f.name)
        
        try:
            parser = EventsJSONLParser()
            events = parser.parse(temp_path)
            
            assert len(events) == 1
            assert events[0].event_type == EventType.SYNC
            assert events[0].event_code == 255
        finally:
            temp_path.unlink()
    
    def test_parse_artifact_event(self):
        """测试解析伪迹事件"""
        line = {
            "event_id": "art_001",
            "event_code": 99,
            "event_type": "artifact",
            "timestamp": "2024-01-01T22:05:00.000",
            "is_artifact": True,
            "description": "肌电伪迹"
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
            f.write(json.dumps(line) + '\n')
            temp_path = Path(f.name)
        
        try:
            parser = EventsJSONLParser()
            events = parser.parse(temp_path)
            
            assert len(events) == 1
            assert events[0].event_type == EventType.ARTIFACT
            assert events[0].is_artifact is True
        finally:
            temp_path.unlink()


class TestSleepStagesParser:
    """测试睡眠分期解析器"""
    
    def test_parse_csv_format(self):
        """测试解析CSV格式分期"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            writer = csv.DictWriter(f, fieldnames=[
                'epoch_number', 'stage', 'start_time', 'end_time', 'duration_seconds'
            ])
            writer.writeheader()
            writer.writerow({
                'epoch_number': '1',
                'stage': 'W',
                'start_time': '2024-01-01 22:00:00',
                'end_time': '2024-01-01 22:00:30',
                'duration_seconds': '30.0',
            })
            writer.writerow({
                'epoch_number': '2',
                'stage': 'N1',
                'start_time': '2024-01-01 22:00:30',
                'end_time': '2024-01-01 22:01:00',
                'duration_seconds': '30.0',
            })
            temp_path = Path(f.name)
        
        try:
            parser = SleepStagesParser()
            stages = parser.parse(temp_path)
            
            assert len(stages) == 2
            assert stages[0].stage == SleepStage.WAKE
            assert stages[1].stage == SleepStage.N1
        finally:
            temp_path.unlink()
    
    def test_parse_legacy_format(self):
        """测试解析传统格式分期"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("""# 睡眠分期记录
# Epoch,Stage,Time
1,W,22:00:00
2,N1,22:00:30
3,N2,22:01:00
4,R,22:30:00
""")
            temp_path = Path(f.name)
        
        try:
            parser = SleepStagesParser()
            stages = parser.parse(temp_path)
            
            assert len(stages) == 4
            assert stages[0].stage == SleepStage.WAKE
            assert stages[3].stage == SleepStage.REM
        finally:
            temp_path.unlink()


class TestClockCalibrationParser:
    """测试时钟校准解析器"""
    
    def test_parse_csv_format(self):
        """测试解析CSV格式校准"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            writer = csv.DictWriter(f, fieldnames=[
                'calibration_id', 'calibration_time', 'eeg_clock_time',
                'stimulus_clock_time', 'drift_ms', 'sync_event_code'
            ])
            writer.writeheader()
            writer.writerow({
                'calibration_id': 'cal_001',
                'calibration_time': '2024-01-01 22:00:00',
                'eeg_clock_time': '2024-01-01 22:00:00.000',
                'stimulus_clock_time': '2024-01-01 22:00:00.250',
                'drift_ms': '250.0',
                'sync_event_code': '255',
            })
            temp_path = Path(f.name)
        
        try:
            parser = ClockCalibrationParser()
            calibrations = parser.parse(temp_path)
            
            assert len(calibrations) == 1
            assert calibrations[0].drift_ms == 250.0
            assert calibrations[0].sync_event_code == 255
        finally:
            temp_path.unlink()
    
    def test_parse_jsonl_format(self):
        """测试解析JSONL格式校准"""
        line = {
            "calibration_id": "cal_002",
            "calibration_time": "2024-01-01T22:00:00",
            "eeg_clock_time": "2024-01-01T22:00:00.000",
            "stimulus_clock_time": "2024-01-01T22:00:00.500",
            "drift_ms": 500.0,
            "sync_event_code": 254,
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
            f.write(json.dumps(line) + '\n')
            temp_path = Path(f.name)
        
        try:
            parser = ClockCalibrationParser()
            calibrations = parser.parse(temp_path)
            
            assert len(calibrations) == 1
            assert calibrations[0].drift_ms == 500.0
        finally:
            temp_path.unlink()


class TestDataValidator:
    """测试数据校验器"""
    
    def test_validate_empty_data(self):
        """测试校验空数据"""
        validator = DataValidator()
        is_valid = validator.validate_all([], [], [], [])
        
        assert is_valid is True
        assert len(validator.get_issues()) == 0
    
    def test_validate_timeline_consistency(self):
        """测试校验时间线一致性"""
        from eeg_aligner.models import (
            EEGChannelSummary,
            StimulusEvent,
            SleepStageEpoch,
            EventType,
            SleepStage,
        )
        
        now = datetime(2024, 1, 1, 22, 0, 0)
        
        summaries = [
            EEGChannelSummary(
                channel_name="F3-M2",
                sampling_rate=256.0,
                start_time=now,
                end_time=now + timedelta(hours=8),
                total_samples=256 * 8 * 3600,
                valid_samples=int(256 * 8 * 3600 * 0.95),
                artifact_percentage=5.0,
            )
        ]
        
        events = [
            StimulusEvent(
                event_id="evt_001",
                event_code=1,
                event_type=EventType.STIMULUS,
                timestamp=now + timedelta(hours=9),
            )
        ]
        
        stages = [
            SleepStageEpoch(
                epoch_number=1,
                stage=SleepStage.WAKE,
                start_time=now,
                end_time=now + timedelta(seconds=30),
            )
        ]
        
        validator = DataValidator()
        is_valid = validator.validate_all(summaries, events, stages, [])
        
        issues = validator.get_issues()
        
        assert len(issues) > 0
    
    def test_issues_by_severity(self):
        """测试按严重程度获取问题"""
        validator = DataValidator()
        is_valid = validator.validate_all([], [], [], [])
        
        issues_by_severity = validator.get_issues_by_severity()
        
        assert IssueSeverity.CRITICAL in issues_by_severity
        assert IssueSeverity.WARNING in issues_by_severity
        assert IssueSeverity.INFO in issues_by_severity
