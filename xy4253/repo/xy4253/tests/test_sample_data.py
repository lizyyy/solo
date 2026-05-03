"""测试示例数据生成器"""
import pytest
import tempfile
from pathlib import Path
from datetime import datetime, timedelta

from eeg_aligner.sample_data import SampleDataGenerator


class TestSampleDataGenerator:
    """测试示例数据生成器"""
    
    def test_creation_with_seed(self):
        """测试使用随机种子创建"""
        generator1 = SampleDataGenerator(seed=42)
        generator2 = SampleDataGenerator(seed=42)
        
        assert generator1.seed == 42
        assert generator2.seed == 42
    
    def test_generate_eeg_summary(self):
        """测试生成EEG摘要"""
        generator = SampleDataGenerator(seed=42)
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        summaries = generator._generate_eeg_summary(base_time)
        
        assert len(summaries) > 0
        
        for summary in summaries:
            assert summary.channel_name
            assert summary.sampling_rate > 0
            assert summary.start_time == base_time
            assert summary.end_time > summary.start_time
            assert summary.total_samples > 0
            assert summary.valid_samples <= summary.total_samples
            assert 0 <= summary.artifact_percentage <= 100
    
    def test_generate_events(self):
        """测试生成事件"""
        generator = SampleDataGenerator(seed=42)
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        events = generator._generate_events(base_time, drift_rate_ms_per_hour=100.0)
        
        assert len(events) > 0
        
        for event in events:
            assert event.event_id
            assert event.event_code >= 0
            assert event.timestamp >= base_time
            assert event.eeg_timestamp is not None
    
    def test_generate_sleep_stages(self):
        """测试生成睡眠分期"""
        generator = SampleDataGenerator(seed=42)
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        stages = generator._generate_sleep_stages(base_time, duration_hours=1)
        
        assert len(stages) == 120
        
        for i, stage in enumerate(stages):
            assert stage.epoch_number == i + 1
            assert stage.start_time == base_time + timedelta(seconds=i * 30)
            assert stage.end_time == stage.start_time + timedelta(seconds=30)
            assert stage.duration_seconds == 30.0
    
    def test_generate_calibrations(self):
        """测试生成校准记录"""
        generator = SampleDataGenerator(seed=42)
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        calibrations = generator._generate_calibrations(base_time, duration_hours=8)
        
        assert len(calibrations) >= 2
        
        for calib in calibrations:
            assert calib.calibration_id
            assert calib.eeg_clock_time >= base_time
            assert calib.stimulus_clock_time is not None
            assert calib.sync_event_code is not None
    
    def test_generate_all(self):
        """测试生成所有数据"""
        generator = SampleDataGenerator(seed=42)
        
        data = generator.generate_sample_data(
            duration_hours=2,
            drift_rate_ms_per_hour=50.0,
        )
        
        assert "eeg_summaries" in data
        assert "events" in data
        assert "sleep_stages" in data
        assert "clock_calibrations" in data
        
        assert len(data["eeg_summaries"]) > 0
        assert len(data["events"]) > 0
        assert len(data["sleep_stages"]) > 0
        assert len(data["clock_calibrations"]) >= 2
    
    def test_save_sample_data(self):
        """测试保存示例数据"""
        generator = SampleDataGenerator(seed=42)
        
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            files = generator.save_sample_data(temp_path)
            
            assert len(files) == 4
            
            assert "eeg_summary" in files
            assert "events" in files
            assert "sleep_stages" in files
            assert "clock_calibration" in files
            
            for name, path in files.items():
                assert path.exists()
    
    def test_csv_files_format(self):
        """测试CSV文件格式"""
        generator = SampleDataGenerator(seed=42)
        
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            files = generator.save_sample_data(temp_path)
            
            eeg_path = files.get("eeg_summary")
            assert eeg_path is not None
            assert eeg_path.suffix == ".csv"
            
            stages_path = files.get("sleep_stages")
            assert stages_path is not None
            assert stages_path.suffix == ".csv"
            
            calib_path = files.get("clock_calibration")
            assert calib_path is not None
            assert calib_path.suffix == ".csv"
    
    def test_jsonl_file_format(self):
        """测试JSONL文件格式"""
        generator = SampleDataGenerator(seed=42)
        
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            files = generator.save_sample_data(temp_path)
            
            events_path = files.get("events")
            assert events_path is not None
            assert events_path.suffix == ".jsonl"
            
            with open(events_path, 'r') as f:
                lines = f.readlines()
                assert len(lines) > 0
                import json
                for line in lines:
                    data = json.loads(line)
                    assert "event_id" in data
                    assert "event_code" in data
                    assert "timestamp" in data
    
    def test_drift_simulation(self):
        """测试漂移模拟"""
        generator = SampleDataGenerator(seed=42)
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        events_high_drift = generator._generate_events(
            base_time, drift_rate_ms_per_hour=500.0
        )
        
        events_low_drift = generator._generate_events(
            base_time, drift_rate_ms_per_hour=10.0
        )
        
        max_high_drift = 0
        max_low_drift = 0
        
        for event in events_high_drift:
            if event.eeg_timestamp and event.timestamp:
                drift = abs((event.timestamp - event.eeg_timestamp).total_seconds() * 1000)
                max_high_drift = max(max_high_drift, drift)
        
        for event in events_low_drift:
            if event.eeg_timestamp and event.timestamp:
                drift = abs((event.timestamp - event.eeg_timestamp).total_seconds() * 1000)
                max_low_drift = max(max_low_drift, drift)
        
        assert max_high_drift >= max_low_drift
    
    def test_consistency_with_same_seed(self):
        """测试相同种子生成一致性"""
        generator1 = SampleDataGenerator(seed=123)
        generator2 = SampleDataGenerator(seed=123)
        
        data1 = generator1.generate_sample_data(duration_hours=1)
        data2 = generator2.generate_sample_data(duration_hours=1)
        
        assert len(data1["events"]) == len(data2["events"])
        assert len(data1["sleep_stages"]) == len(data2["sleep_stages"])
    
    def test_artifact_events_generation(self):
        """测试伪迹事件生成"""
        generator = SampleDataGenerator(seed=42)
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        events = generator._generate_events(base_time, drift_rate_ms_per_hour=100.0)
        
        artifact_count = sum(1 for e in events if e.is_artifact)
        
        assert artifact_count > 0
