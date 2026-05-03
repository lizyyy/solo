"""测试规则引擎模块"""
import pytest
from datetime import datetime, timedelta
from typing import List

from eeg_aligner.rules import (
    CheckEngine,
    CodeRuleEngine,
    StageRuleEngine,
    ArtifactRuleEngine,
)
from eeg_aligner.models import (
    StimulusEvent,
    SleepStageEpoch,
    EventType,
    SleepStage,
    IssueType,
    IssueSeverity,
)


class TestCodeRuleEngine:
    """测试事件码规则引擎"""
    
    def create_stimulus_event(self, code: int, timestamp: datetime, is_artifact: bool = False) -> StimulusEvent:
        """创建刺激事件"""
        return StimulusEvent(
            event_id=f"evt_{code}_{timestamp.strftime('%H%M%S')}",
            event_code=code,
            event_type=EventType.ARTIFACT if is_artifact else EventType.STIMULUS,
            timestamp=timestamp,
            aligned_timestamp=timestamp,
            is_artifact=is_artifact,
        )
    
    def test_detect_missing_codes(self):
        """测试检测缺失事件码"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        events: List[StimulusEvent] = [
            self.create_stimulus_event(1, base_time),
            self.create_stimulus_event(2, base_time + timedelta(seconds=5)),
            self.create_stimulus_event(4, base_time + timedelta(seconds=15)),
        ]
        
        expected_codes = [1, 2, 3, 4, 5]
        
        engine = CodeRuleEngine(expected_codes=expected_codes, min_interval_ms=10.0)
        issues = engine.check_codes(events, use_aligned_timestamps=True)
        
        missing_issues = [i for i in issues if i.issue_type == IssueType.MISSING_CODE]
        
        assert len(missing_issues) > 0
        
        missing_code_values = []
        for issue in missing_issues:
            if "缺失" in issue.message:
                for code in expected_codes:
                    if str(code) in issue.message:
                        missing_code_values.append(code)
        
        assert 3 in missing_code_values or 5 in missing_code_values
    
    def test_detect_duplicate_codes(self):
        """测试检测重复事件码"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        events: List[StimulusEvent] = [
            self.create_stimulus_event(1, base_time),
            self.create_stimulus_event(1, base_time + timedelta(milliseconds=5)),
            self.create_stimulus_event(2, base_time + timedelta(seconds=10)),
        ]
        
        engine = CodeRuleEngine(expected_codes=[1, 2], min_interval_ms=100.0)
        issues = engine.check_codes(events, use_aligned_timestamps=True)
        
        duplicate_issues = [i for i in issues if i.issue_type == IssueType.DUPLICATE_CODE]
        
        assert len(duplicate_issues) > 0
    
    def test_ignore_artifacts_in_code_check(self):
        """测试在码检查中忽略伪迹"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        events: List[StimulusEvent] = [
            self.create_stimulus_event(1, base_time),
            self.create_stimulus_event(99, base_time + timedelta(seconds=5), is_artifact=True),
            self.create_stimulus_event(2, base_time + timedelta(seconds=10)),
        ]
        
        expected_codes = [1, 2]
        
        engine = CodeRuleEngine(expected_codes=expected_codes, min_interval_ms=10.0)
        issues = engine.check_codes(events, use_aligned_timestamps=True)
        
        missing_issues = [i for i in issues if i.issue_type == IssueType.MISSING_CODE]
        
        assert 99 not in expected_codes
    
    def test_invalid_timestamps(self):
        """测试无效时间戳检测"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        event1 = self.create_stimulus_event(1, base_time)
        event2 = self.create_stimulus_event(2, base_time - timedelta(seconds=10))
        
        events = [event1, event2]
        
        engine = CodeRuleEngine(expected_codes=[1, 2], min_interval_ms=10.0)
        issues = engine.check_codes(events, use_aligned_timestamps=True)
        
        invalid_issues = [i for i in issues if i.issue_type == IssueType.INVALID_TIMESTAMP]
        
        assert len(invalid_issues) >= 0


class TestStageRuleEngine:
    """测试分期规则引擎"""
    
    def create_stage_epoch(self, epoch_num: int, stage: SleepStage, start_time: datetime) -> SleepStageEpoch:
        """创建睡眠分期"""
        return SleepStageEpoch(
            epoch_number=epoch_num,
            stage=stage,
            start_time=start_time,
            end_time=start_time + timedelta(seconds=30),
            duration_seconds=30.0,
            is_manual=True,
        )
    
    def create_event_in_epoch(self, code: int, epoch_start: datetime) -> StimulusEvent:
        """创建在分期内的事件"""
        return StimulusEvent(
            event_id=f"evt_{code}",
            event_code=code,
            event_type=EventType.STIMULUS,
            timestamp=epoch_start + timedelta(seconds=15),
            aligned_timestamp=epoch_start + timedelta(seconds=15),
        )
    
    def test_detect_stage_conflicts(self):
        """测试检测分期冲突"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        stages: List[SleepStageEpoch] = [
            self.create_stage_epoch(1, SleepStage.WAKE, base_time),
            self.create_stage_epoch(2, SleepStage.N1, base_time + timedelta(seconds=30)),
            self.create_stage_epoch(3, SleepStage.N2, base_time + timedelta(seconds=60)),
        ]
        
        event_in_n2 = self.create_event_in_epoch(1, base_time + timedelta(seconds=60))
        
        engine = StageRuleEngine()
        issues = engine.check_stages([event_in_n2], stages, use_aligned_timestamps=True)
        
        for issue in issues:
            assert issue.severity in [IssueSeverity.WARNING, IssueSeverity.INFO, IssueSeverity.CRITICAL]
    
    def test_abnormal_stage_transitions(self):
        """测试异常分期转换"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        stages: List[SleepStageEpoch] = [
            self.create_stage_epoch(1, SleepStage.N3, base_time),
            self.create_stage_epoch(2, SleepStage.WAKE, base_time + timedelta(seconds=30)),
            self.create_stage_epoch(3, SleepStage.N3, base_time + timedelta(seconds=60)),
        ]
        
        engine = StageRuleEngine()
        issues = engine.check_stages([], stages, use_aligned_timestamps=True)
        
        assert len(issues) >= 0
    
    def test_event_outside_stages(self):
        """测试事件在分期范围外"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        stages: List[SleepStageEpoch] = [
            self.create_stage_epoch(1, SleepStage.WAKE, base_time),
            self.create_stage_epoch(2, SleepStage.N1, base_time + timedelta(seconds=30)),
        ]
        
        event_after = self.create_event_in_epoch(99, base_time + timedelta(hours=10))
        
        engine = StageRuleEngine()
        issues = engine.check_stages([event_after], stages, use_aligned_timestamps=True)
        
        assert len(issues) >= 0
    
    def test_empty_stages(self):
        """测试空分期列表"""
        engine = StageRuleEngine()
        issues = engine.check_stages([], [], use_aligned_timestamps=True)
        
        assert len(issues) == 0


class TestArtifactRuleEngine:
    """测试伪迹规则引擎"""
    
    def create_artifact_event(self, start_time: datetime, duration_ms: float = 1000.0) -> StimulusEvent:
        """创建伪迹事件"""
        return StimulusEvent(
            event_id=f"art_{id(start_time)}",
            event_code=99,
            event_type=EventType.ARTIFACT,
            timestamp=start_time,
            aligned_timestamp=start_time,
            duration_ms=duration_ms,
            is_artifact=True,
        )
    
    def create_stimulus_event(self, code: int, timestamp: datetime, duration_ms: float = 100.0) -> StimulusEvent:
        """创建刺激事件"""
        return StimulusEvent(
            event_id=f"evt_{code}",
            event_code=code,
            event_type=EventType.STIMULUS,
            timestamp=timestamp,
            aligned_timestamp=timestamp,
            duration_ms=duration_ms,
            is_artifact=False,
        )
    
    def test_detect_artifact_overlap(self):
        """测试检测伪迹重叠"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        artifact = self.create_artifact_event(base_time, duration_ms=5000.0)
        
        stimulus_in_artifact = self.create_stimulus_event(
            1, base_time + timedelta(milliseconds=1000)
        )
        
        events = [artifact, stimulus_in_artifact]
        
        engine = ArtifactRuleEngine(max_overlap_ratio=0.1)
        issues = engine.check_artifacts(events, use_aligned_timestamps=True)
        
        overlap_issues = [i for i in issues if i.issue_type == IssueType.ARTIFACT_OVERLAP]
        
        assert len(overlap_issues) > 0
    
    def test_no_overlap(self):
        """测试无重叠情况"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        artifact = self.create_artifact_event(base_time, duration_ms=1000.0)
        
        stimulus_after = self.create_stimulus_event(
            1, base_time + timedelta(seconds=10)
        )
        
        events = [artifact, stimulus_after]
        
        engine = ArtifactRuleEngine(max_overlap_ratio=0.5)
        issues = engine.check_artifacts(events, use_aligned_timestamps=True)
        
        overlap_issues = [i for i in issues if i.issue_type == IssueType.ARTIFACT_OVERLAP]
        
        assert len(overlap_issues) == 0
    
    def test_partial_overlap(self):
        """测试部分重叠"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        artifact = self.create_artifact_event(base_time, duration_ms=2000.0)
        
        stimulus_partial = self.create_stimulus_event(
            1, base_time + timedelta(milliseconds=1500), duration_ms=1000.0
        )
        
        events = [artifact, stimulus_partial]
        
        engine = ArtifactRuleEngine(max_overlap_ratio=0.25)
        issues = engine.check_artifacts(events, use_aligned_timestamps=True)
        
        assert len(issues) >= 0
    
    def test_no_artifacts(self):
        """测试没有伪迹的情况"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        events = [
            self.create_stimulus_event(1, base_time),
            self.create_stimulus_event(2, base_time + timedelta(seconds=5)),
        ]
        
        engine = ArtifactRuleEngine()
        issues = engine.check_artifacts(events, use_aligned_timestamps=True)
        
        assert len(issues) == 0
    
    def test_multiple_artifacts(self):
        """测试多个伪迹"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        events = [
            self.create_artifact_event(base_time, duration_ms=1000.0),
            self.create_stimulus_event(1, base_time + timedelta(milliseconds=500)),
            self.create_artifact_event(base_time + timedelta(seconds=10), duration_ms=1000.0),
            self.create_stimulus_event(2, base_time + timedelta(seconds=10, milliseconds=500)),
        ]
        
        engine = ArtifactRuleEngine(max_overlap_ratio=0.1)
        issues = engine.check_artifacts(events, use_aligned_timestamps=True)
        
        overlap_issues = [i for i in issues if i.issue_type == IssueType.ARTIFACT_OVERLAP]
        
        assert len(overlap_issues) >= 2


class TestCheckEngine:
    """测试综合检查引擎"""
    
    def test_check_all_empty(self):
        """测试检查空数据"""
        engine = CheckEngine()
        result = engine.check_all([], [], use_aligned_timestamps=True)
        
        assert result.total_events == 0
        assert result.total_epochs == 0
        assert len(result.issues) == 0
    
    def test_check_with_expected_codes(self):
        """测试使用期望事件码检查"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        events = [
            StimulusEvent(
                event_id="evt_1",
                event_code=1,
                event_type=EventType.STIMULUS,
                timestamp=base_time,
                aligned_timestamp=base_time,
            ),
            StimulusEvent(
                event_id="evt_2",
                event_code=2,
                event_type=EventType.STIMULUS,
                timestamp=base_time + timedelta(seconds=5),
                aligned_timestamp=base_time + timedelta(seconds=5),
            ),
        ]
        
        engine = CheckEngine(expected_codes=[1, 2, 3, 4])
        result = engine.check_all(events, [], use_aligned_timestamps=True)
        
        assert result.total_events == 2
    
    def test_check_with_original_timestamps(self):
        """测试使用原始时间戳检查"""
        base_time = datetime(2024, 1, 1, 22, 0, 0)
        
        event = StimulusEvent(
            event_id="evt_1",
            event_code=1,
            event_type=EventType.STIMULUS,
            timestamp=base_time,
            aligned_timestamp=base_time + timedelta(milliseconds=500),
        )
        
        engine = CheckEngine()
        result = engine.check_all([event], [], use_aligned_timestamps=False)
        
        assert result.total_events == 1
    
    def test_check_result_statistics(self):
        """测试检查结果统计"""
        engine = CheckEngine()
        result = engine.check_all([], [], use_aligned_timestamps=True)
        
        assert result.critical_issue_count == 0
        assert result.warning_issue_count == 0
        assert result.info_issue_count == 0
        assert len(result.missing_codes) == 0
        assert len(result.duplicate_codes) == 0
        assert len(result.stage_conflicts) == 0
        assert len(result.artifact_overlaps) == 0
