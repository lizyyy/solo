"""测试核心数据模型"""
import pytest
from datetime import datetime, timedelta
from eeg_aligner.models import (
    SleepStage,
    EventType,
    IssueSeverity,
    IssueType,
    EEGChannelSummary,
    StimulusEvent,
    SleepStageEpoch,
    ClockCalibration,
    ValidationIssue,
    AlignmentResult,
    CheckResult,
    ProjectData,
)


class TestEnums:
    """测试枚举类型"""
    
    def test_sleep_stage_values(self):
        """测试睡眠阶段枚举值"""
        assert SleepStage.WAKE == "W"
        assert SleepStage.N1 == "N1"
        assert SleepStage.N2 == "N2"
        assert SleepStage.N3 == "N3"
        assert SleepStage.REM == "R"
        assert SleepStage.MOVEMENT == "M"
        assert SleepStage.UNKNOWN == "?"
    
    def test_event_type_values(self):
        """测试事件类型枚举值"""
        assert EventType.STIMULUS == "stimulus"
        assert EventType.RESPONSE == "response"
        assert EventType.ARTIFACT == "artifact"
        assert EventType.SYSTEM == "system"
        assert EventType.SYNC == "sync"
    
    def test_issue_severity_values(self):
        """测试问题严重程度枚举值"""
        assert IssueSeverity.CRITICAL == "critical"
        assert IssueSeverity.WARNING == "warning"
        assert IssueSeverity.INFO == "info"
    
    def test_issue_type_values(self):
        """测试问题类型枚举值"""
        assert IssueType.MISSING_CODE == "missing_code"
        assert IssueType.DUPLICATE_CODE == "duplicate_code"
        assert IssueType.STAGE_CONFLICT == "stage_conflict"
        assert IssueType.ARTIFACT_OVERLAP == "artifact_overlap"
        assert IssueType.CLOCK_DRIFT == "clock_drift"
        assert IssueType.INVALID_TIMESTAMP == "invalid_timestamp"


class TestEEGChannelSummary:
    """测试EEG通道摘要"""
    
    def test_creation(self):
        """测试创建通道摘要"""
        now = datetime.now()
        summary = EEGChannelSummary(
            channel_name="F3-M2",
            sampling_rate=256.0,
            start_time=now,
            end_time=now + timedelta(hours=8),
            total_samples=256 * 8 * 3600,
            valid_samples=256 * 8 * 3600 * 0.95,
            artifact_percentage=5.0,
            quality_metrics={"impedance": 5.2},
        )
        
        assert summary.channel_name == "F3-M2"
        assert summary.sampling_rate == 256.0
        assert summary.artifact_percentage == 5.0
        assert summary.quality_metrics["impedance"] == 5.2


class TestStimulusEvent:
    """测试刺激事件"""
    
    def test_creation(self):
        """测试创建事件"""
        now = datetime.now()
        event = StimulusEvent(
            event_id="evt_001",
            event_code=1,
            event_type=EventType.STIMULUS,
            timestamp=now,
            duration_ms=100.0,
            description="测试刺激",
        )
        
        assert event.event_id == "evt_001"
        assert event.event_code == 1
        assert event.event_type == EventType.STIMULUS
        assert event.is_valid is True
        assert event.is_artifact is False
    
    def test_artifact_event(self):
        """测试伪迹事件"""
        now = datetime.now()
        event = StimulusEvent(
            event_id="evt_002",
            event_code=99,
            event_type=EventType.ARTIFACT,
            timestamp=now,
            is_artifact=True,
        )
        
        assert event.is_artifact is True
        assert event.event_type == EventType.ARTIFACT
    
    def test_aligned_timestamp(self):
        """测试对齐时间戳"""
        original_time = datetime.now()
        aligned_time = original_time + timedelta(milliseconds=500)
        
        event = StimulusEvent(
            event_id="evt_003",
            event_code=2,
            event_type=EventType.STIMULUS,
            timestamp=original_time,
            aligned_timestamp=aligned_time,
        )
        
        assert event.aligned_timestamp == aligned_time
        assert (event.aligned_timestamp - event.timestamp).total_seconds() == 0.5


class TestSleepStageEpoch:
    """测试睡眠分期"""
    
    def test_creation(self):
        """测试创建分期"""
        now = datetime.now()
        epoch = SleepStageEpoch(
            epoch_number=1,
            stage=SleepStage.N2,
            start_time=now,
            end_time=now + timedelta(seconds=30),
            duration_seconds=30.0,
            confidence=0.95,
            is_manual=True,
        )
        
        assert epoch.epoch_number == 1
        assert epoch.stage == SleepStage.N2
        assert epoch.duration_seconds == 30.0
        assert epoch.is_manual is True


class TestClockCalibration:
    """测试时钟校准"""
    
    def test_creation(self):
        """测试创建校准记录"""
        now = datetime.now()
        eeg_time = now
        stim_time = now + timedelta(milliseconds=250)
        
        calibration = ClockCalibration(
            calibration_id="cal_001",
            calibration_time=now,
            eeg_clock_time=eeg_time,
            stimulus_clock_time=stim_time,
            drift_ms=250.0,
            sync_event_code=255,
        )
        
        assert calibration.drift_ms == 250.0
        assert calibration.sync_event_code == 255
        assert (calibration.stimulus_clock_time - calibration.eeg_clock_time).total_seconds() == 0.25


class TestValidationIssue:
    """测试验证问题"""
    
    def test_creation(self):
        """测试创建问题"""
        issue = ValidationIssue(
            issue_id="iss_001",
            issue_type=IssueType.MISSING_CODE,
            severity=IssueSeverity.CRITICAL,
            message="缺失事件码 5",
            related_event="evt_005",
            suggestion="检查实验日志确认是否漏发",
        )
        
        assert issue.issue_type == IssueType.MISSING_CODE
        assert issue.severity == IssueSeverity.CRITICAL
        assert "缺失" in issue.message
        assert "漏发" in issue.suggestion


class TestAlignmentResult:
    """测试对齐结果"""
    
    def test_creation(self):
        """测试创建对齐结果"""
        result = AlignmentResult(
            drift_estimate_ms=125.5,
            drift_confidence=0.92,
            alignment_method="linear",
            aligned_events_count=100,
            sync_points=[{"time": datetime.now(), "drift": 100}],
        )
        
        assert result.drift_estimate_ms == 125.5
        assert result.drift_confidence == 0.92
        assert result.alignment_method == "linear"
        assert result.aligned_events_count == 100


class TestCheckResult:
    """测试检查结果"""
    
    def test_creation(self):
        """测试创建检查结果"""
        result = CheckResult(
            total_events=100,
            valid_events=95,
            total_epochs=960,
            missing_codes=[5, 10],
            duplicate_codes=[3],
            critical_issue_count=2,
            warning_issue_count=3,
            info_issue_count=5,
        )
        
        assert result.total_events == 100
        assert result.valid_events == 95
        assert 5 in result.missing_codes
        assert 3 in result.duplicate_codes
        assert result.critical_issue_count == 2


class TestProjectData:
    """测试项目数据"""
    
    def test_creation(self):
        """测试创建项目数据"""
        now = datetime.now()
        project = ProjectData(
            project_id="test_001",
            created_at=now,
            updated_at=now,
        )
        
        assert project.project_id == "test_001"
        assert project.created_at == now
        assert len(project.eeg_summaries) == 0
        assert len(project.events) == 0
        assert len(project.sleep_stages) == 0
        assert len(project.clock_calibrations) == 0
    
    def test_add_events(self):
        """测试添加事件"""
        now = datetime.now()
        project = ProjectData(
            project_id="test_002",
            created_at=now,
            updated_at=now,
        )
        
        event = StimulusEvent(
            event_id="evt_001",
            event_code=1,
            event_type=EventType.STIMULUS,
            timestamp=now,
        )
        
        project.events.append(event)
        
        assert len(project.events) == 1
        assert project.events[0].event_code == 1
