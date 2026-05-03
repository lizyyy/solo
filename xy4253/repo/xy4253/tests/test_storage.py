"""测试存储模块"""
import pytest
import tempfile
import json
from datetime import datetime, timedelta
from pathlib import Path

from eeg_aligner.storage import ProjectStore
from eeg_aligner.models import (
    ProjectData,
    EEGChannelSummary,
    StimulusEvent,
    SleepStageEpoch,
    ClockCalibration,
    AlignmentResult,
    CheckResult,
    EventType,
    SleepStage,
    IssueSeverity,
)


class TestProjectStore:
    """测试项目存储"""
    
    def create_test_project(self) -> ProjectData:
        """创建测试项目数据"""
        now = datetime(2024, 1, 1, 22, 0, 0)
        
        project = ProjectData(
            project_id="test_001",
            created_at=now,
            updated_at=now,
        )
        
        project.eeg_summaries = [
            EEGChannelSummary(
                channel_name="F3-M2",
                sampling_rate=256.0,
                start_time=now,
                end_time=now + timedelta(hours=8),
                total_samples=256 * 8 * 3600,
                valid_samples=int(256 * 8 * 3600 * 0.95),
                artifact_percentage=5.0,
                quality_metrics={"impedance": 5.2},
            )
        ]
        
        project.events = [
            StimulusEvent(
                event_id="evt_001",
                event_code=1,
                event_type=EventType.STIMULUS,
                timestamp=now + timedelta(minutes=5),
                eeg_timestamp=now + timedelta(minutes=5, milliseconds=100),
                aligned_timestamp=now + timedelta(minutes=5),
                duration_ms=100.0,
                description="测试事件",
                is_valid=True,
            )
        ]
        
        project.sleep_stages = [
            SleepStageEpoch(
                epoch_number=1,
                stage=SleepStage.WAKE,
                start_time=now,
                end_time=now + timedelta(seconds=30),
                duration_seconds=30.0,
                confidence=1.0,
                is_manual=True,
            )
        ]
        
        project.clock_calibrations = [
            ClockCalibration(
                calibration_id="cal_001",
                calibration_time=now,
                eeg_clock_time=now,
                stimulus_clock_time=now + timedelta(milliseconds=100),
                drift_ms=100.0,
                sync_event_code=255,
            )
        ]
        
        project.alignment_result = AlignmentResult(
            drift_estimate_ms=100.0,
            drift_confidence=0.95,
            alignment_method="linear",
            aligned_events_count=1,
            sync_points=[{"time": now.isoformat(), "drift": 100.0}],
        )
        
        project.check_result = CheckResult(
            total_events=1,
            valid_events=1,
            total_epochs=1,
            critical_issue_count=0,
            warning_issue_count=0,
            info_issue_count=0,
        )
        
        project.metadata = {
            "subject_id": "S001",
            "experiment_date": "2024-01-01",
            "notes": "测试项目",
        }
        
        return project
    
    def test_initialization(self):
        """测试初始化"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            store = ProjectStore(temp_path)
            
            assert store.project_dir == temp_path
            assert not temp_path.exists()
    
    def test_save_and_load(self):
        """测试保存和加载"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            store = ProjectStore(temp_path)
            
            original_project = self.create_test_project()
            
            store.save(original_project)
            
            assert temp_path.exists()
            assert (temp_path / "project.json").exists()
            
            loaded_project = store.load()
            
            assert loaded_project.project_id == original_project.project_id
            assert loaded_project.created_at == original_project.created_at
            assert len(loaded_project.eeg_summaries) == len(original_project.eeg_summaries)
            assert len(loaded_project.events) == len(original_project.events)
            assert len(loaded_project.sleep_stages) == len(original_project.sleep_stages)
            assert len(loaded_project.clock_calibrations) == len(original_project.clock_calibrations)
    
    def test_load_nonexistent(self):
        """测试加载不存在的项目"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            store = ProjectStore(temp_path)
            
            with pytest.raises(FileNotFoundError):
                store.load()
    
    def test_get_project_info_not_exists(self):
        """测试获取不存在的项目信息"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            store = ProjectStore(temp_path)
            
            info = store.get_project_info()
            
            assert info.get("exists") is False
    
    def test_get_project_info_exists(self):
        """测试获取存在的项目信息"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            store = ProjectStore(temp_path)
            
            project = self.create_test_project()
            store.save(project)
            
            info = store.get_project_info()
            
            assert info.get("exists") is True
            assert "project_id" in info
            assert "created_at" in info
            assert "updated_at" in info
    
    def test_save_events_jsonl(self):
        """测试保存事件为JSONL"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            store = ProjectStore(temp_path)
            
            project = self.create_test_project()
            store.save(project)
            
            events_path = temp_path / "events.jsonl"
            assert events_path.exists()
            
            with open(events_path, 'r') as f:
                lines = f.readlines()
                assert len(lines) == len(project.events)
                
                import json
                for line in lines:
                    event_data = json.loads(line)
                    assert "event_id" in event_data
                    assert "event_code" in event_data
    
    def test_data_types_preserved(self):
        """测试数据类型保存"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            store = ProjectStore(temp_path)
            
            original_project = self.create_test_project()
            store.save(original_project)
            
            loaded_project = store.load()
            
            assert loaded_project.eeg_summaries[0].sampling_rate == 256.0
            assert isinstance(loaded_project.eeg_summaries[0].sampling_rate, float)
            
            assert loaded_project.events[0].event_code == 1
            assert isinstance(loaded_project.events[0].event_code, int)
            
            assert loaded_project.clock_calibrations[0].drift_ms == 100.0
            assert isinstance(loaded_project.clock_calibrations[0].drift_ms, float)
    
    def test_alignment_result_preserved(self):
        """测试对齐结果保存"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            store = ProjectStore(temp_path)
            
            original_project = self.create_test_project()
            store.save(original_project)
            
            loaded_project = store.load()
            
            assert loaded_project.alignment_result is not None
            assert loaded_project.alignment_result.drift_estimate_ms == 100.0
            assert loaded_project.alignment_result.alignment_method == "linear"
            assert loaded_project.alignment_result.drift_confidence == 0.95
    
    def test_check_result_preserved(self):
        """测试检查结果保存"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            store = ProjectStore(temp_path)
            
            original_project = self.create_test_project()
            store.save(original_project)
            
            loaded_project = store.load()
            
            assert loaded_project.check_result is not None
            assert loaded_project.check_result.total_events == 1
            assert loaded_project.check_result.valid_events == 1
            assert loaded_project.check_result.critical_issue_count == 0
    
    def test_metadata_preserved(self):
        """测试元数据保存"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            store = ProjectStore(temp_path)
            
            original_project = self.create_test_project()
            store.save(original_project)
            
            loaded_project = store.load()
            
            assert loaded_project.metadata["subject_id"] == "S001"
            assert loaded_project.metadata["experiment_date"] == "2024-01-01"
    
    def test_update_timestamps(self):
        """测试更新时间戳"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            store = ProjectStore(temp_path)
            
            original_project = self.create_test_project()
            first_save_time = original_project.updated_at
            
            store.save(original_project)
            
            loaded_project = store.load()
            
            loaded_project.events.append(
                StimulusEvent(
                    event_id="evt_002",
                    event_code=2,
                    event_type=EventType.STIMULUS,
                    timestamp=datetime.now(),
                )
            )
            
            store.save(loaded_project)
            
            reloaded_project = store.load()
            
            assert reloaded_project.updated_at >= first_save_time
    
    def test_save_empty_project(self):
        """测试保存空项目"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            store = ProjectStore(temp_path)
            
            now = datetime.now()
            empty_project = ProjectData(
                project_id="empty_001",
                created_at=now,
                updated_at=now,
            )
            
            store.save(empty_project)
            
            assert temp_path.exists()
            assert (temp_path / "project.json").exists()
            
            loaded = store.load()
            
            assert loaded.project_id == "empty_001"
            assert len(loaded.eeg_summaries) == 0
            assert len(loaded.events) == 0
            assert len(loaded.sleep_stages) == 0
            assert len(loaded.clock_calibrations) == 0
