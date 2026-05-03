"""
规则引擎测试
"""

import pytest
from datetime import datetime

from dmx_protect.models import (
    Cue, Fixture, Modification, ChannelChange, Issue, TheaterConfig, ProjectData,
    TriggerType, FixtureType, IssueType, Severity, ReviewDecision
)
from dmx_protect.rules import RuleEngine


class TestRuleEngine:
    """规则引擎测试"""
    
    def _create_project(self, cues=None, fixtures=None, config=None):
        """创建测试项目"""
        if config is None:
            config = TheaterConfig(name="测试剧场")
        return ProjectData(
            config=config,
            cues=cues or [],
            fixtures=fixtures or [],
            modifications=[],
            issues=[]
        )
    
    def test_channel_conflict_detection(self):
        """测试通道冲突检测"""
        cue1 = Cue(
            cue_number="CUE_001",
            description="测试1",
            trigger_type=TriggerType.TIME,
            trigger_value=0.0,
            duration=5.0,
            channels={1: 100, 2: 200}
        )
        cue2 = Cue(
            cue_number="CUE_002",
            description="测试2",
            trigger_type=TriggerType.TIME,
            trigger_value=3.0,
            duration=3.0,
            channels={1: 150, 2: 200}
        )
        
        project = self._create_project(cues=[cue1, cue2])
        engine = RuleEngine(project)
        
        issues = engine.check_channel_conflict()
        
        assert len(issues) == 1
        issue = issues[0]
        assert issue.type == IssueType.CHANNEL_CONFLICT
        assert issue.severity == Severity.CRITICAL
        assert 1 in issue.affected_channels
        assert "CUE_001" in issue.affected_cues
        assert "CUE_002" in issue.affected_cues
    
    def test_no_channel_conflict_when_same_value(self):
        """测试相同通道值时不产生冲突"""
        cue1 = Cue(
            cue_number="CUE_001",
            description="测试1",
            trigger_type=TriggerType.TIME,
            trigger_value=0.0,
            duration=5.0,
            channels={1: 100}
        )
        cue2 = Cue(
            cue_number="CUE_002",
            description="测试2",
            trigger_type=TriggerType.TIME,
            trigger_value=3.0,
            duration=3.0,
            channels={1: 100}
        )
        
        project = self._create_project(cues=[cue1, cue2])
        engine = RuleEngine(project)
        
        issues = engine.check_channel_conflict()
        
        assert len(issues) == 0
    
    def test_no_channel_conflict_when_no_overlap(self):
        """测试时间不重叠时不产生冲突"""
        cue1 = Cue(
            cue_number="CUE_001",
            description="测试1",
            trigger_type=TriggerType.TIME,
            trigger_value=0.0,
            duration=2.0,
            channels={1: 100}
        )
        cue2 = Cue(
            cue_number="CUE_002",
            description="测试2",
            trigger_type=TriggerType.TIME,
            trigger_value=3.0,
            duration=2.0,
            channels={1: 200}
        )
        
        project = self._create_project(cues=[cue1, cue2])
        engine = RuleEngine(project)
        
        issues = engine.check_channel_conflict()
        
        assert len(issues) == 0
    
    def test_time_overlap_detection(self):
        """测试时间重叠检测"""
        cue1 = Cue(
            cue_number="CUE_001",
            description="测试1",
            trigger_type=TriggerType.TIME,
            trigger_value=0.0,
            duration=5.0,
            channels={}
        )
        cue2 = Cue(
            cue_number="CUE_002",
            description="测试2",
            trigger_type=TriggerType.TIME,
            trigger_value=3.0,
            duration=3.0,
            channels={}
        )
        
        project = self._create_project(cues=[cue1, cue2])
        engine = RuleEngine(project)
        
        issues = engine.check_time_overlap()
        
        assert len(issues) == 1
        issue = issues[0]
        assert issue.type == IssueType.TIME_OVERLAP
        assert issue.severity == Severity.WARNING
        assert "CUE_001" in issue.affected_cues
        assert "CUE_002" in issue.affected_cues
        assert issue.details["overlap_duration"] == 2.0
    
    def test_no_time_overlap(self):
        """测试无时间重叠"""
        cue1 = Cue(
            cue_number="CUE_001",
            description="测试1",
            trigger_type=TriggerType.TIME,
            trigger_value=0.0,
            duration=2.0,
            channels={}
        )
        cue2 = Cue(
            cue_number="CUE_002",
            description="测试2",
            trigger_type=TriggerType.TIME,
            trigger_value=2.0,
            duration=2.0,
            channels={}
        )
        
        project = self._create_project(cues=[cue1, cue2])
        engine = RuleEngine(project)
        
        issues = engine.check_time_overlap()
        
        assert len(issues) == 0
    
    def test_dangerous_jump_detection(self):
        """测试危险跳变检测"""
        cue1 = Cue(
            cue_number="CUE_001",
            description="测试1",
            trigger_type=TriggerType.TIME,
            trigger_value=0.0,
            duration=2.0,
            channels={1: 50}
        )
        cue2 = Cue(
            cue_number="CUE_002",
            description="测试2",
            trigger_type=TriggerType.TIME,
            trigger_value=2.0,
            duration=2.0,
            channels={1: 250}
        )
        
        config = TheaterConfig(name="测试", dangerous_jump_threshold=150)
        project = self._create_project(cues=[cue1, cue2], config=config)
        engine = RuleEngine(project)
        
        issues = engine.check_dangerous_jump()
        
        assert len(issues) == 1
        issue = issues[0]
        assert issue.type == IssueType.DANGEROUS_JUMP
        assert issue.severity == Severity.WARNING
        assert issue.details["diff"] == 200
    
    def test_no_dangerous_jump_small_diff(self):
        """测试小差值不触发危险跳变"""
        cue1 = Cue(
            cue_number="CUE_001",
            description="测试1",
            trigger_type=TriggerType.TIME,
            trigger_value=0.0,
            duration=2.0,
            channels={1: 100}
        )
        cue2 = Cue(
            cue_number="CUE_002",
            description="测试2",
            trigger_type=TriggerType.TIME,
            trigger_value=2.0,
            duration=2.0,
            channels={1: 150}
        )
        
        config = TheaterConfig(name="测试", dangerous_jump_threshold=150)
        project = self._create_project(cues=[cue1, cue2], config=config)
        engine = RuleEngine(project)
        
        issues = engine.check_dangerous_jump()
        
        assert len(issues) == 0
    
    def test_missing_confirmation_detection(self):
        """测试安全确认缺失检测"""
        cue = Cue(
            cue_number="CUE_001",
            description="烟机启动",
            trigger_type=TriggerType.TIME,
            trigger_value=0.0,
            duration=2.0,
            channels={10: 200}
        )
        
        hazer = Fixture(
            id="HAZER_001",
            name="烟机",
            type=FixtureType.HAZER,
            start_channel=10,
            channel_count=1,
            requires_confirmation=True
        )
        
        project = self._create_project(cues=[cue], fixtures=[hazer])
        engine = RuleEngine(project)
        
        issues = engine.check_missing_confirmation()
        
        assert len(issues) == 1
        issue = issues[0]
        assert issue.type == IssueType.MISSING_CONFIRMATION
        assert issue.severity == Severity.CRITICAL
        assert "CUE_001" in issue.affected_cues
    
    def test_no_missing_confirmation_when_zero_value(self):
        """测试通道值为 0 时不触发确认检测"""
        cue = Cue(
            cue_number="CUE_001",
            description="烟机关闭",
            trigger_type=TriggerType.TIME,
            trigger_value=0.0,
            duration=2.0,
            channels={10: 0}
        )
        
        hazer = Fixture(
            id="HAZER_001",
            name="烟机",
            type=FixtureType.HAZER,
            start_channel=10,
            channel_count=1,
            requires_confirmation=True
        )
        
        project = self._create_project(cues=[cue], fixtures=[hazer])
        engine = RuleEngine(project)
        
        issues = engine.check_missing_confirmation()
        
        assert len(issues) == 0
    
    def test_no_missing_confirmation_when_confirmed(self):
        """测试已确认时不触发确认检测"""
        cue = Cue(
            cue_number="CUE_001",
            description="烟机启动",
            trigger_type=TriggerType.TIME,
            trigger_value=0.0,
            duration=2.0,
            channels={10: 200}
        )
        
        hazer = Fixture(
            id="HAZER_001",
            name="烟机",
            type=FixtureType.HAZER,
            start_channel=10,
            channel_count=1,
            requires_confirmation=True
        )
        
        modification = Modification(
            id="MOD_001",
            cue_number="CUE_001",
            modified_at=datetime.now(),
            modified_by="测试",
            changes=[ChannelChange(channel=10, old_value=100, new_value=200, reason="测试")],
            confirmed=True
        )
        
        project = self._create_project(cues=[cue], fixtures=[hazer])
        project.modifications = [modification]
        
        engine = RuleEngine(project)
        issues = engine.check_missing_confirmation()
        
        assert len(issues) == 0
    
    def test_no_confirmation_needed_for_spot(self):
        """测试普通灯具不需要确认"""
        cue = Cue(
            cue_number="CUE_001",
            description="聚光灯",
            trigger_type=TriggerType.TIME,
            trigger_value=0.0,
            duration=2.0,
            channels={1: 200}
        )
        
        spot = Fixture(
            id="SPOT_001",
            name="聚光灯",
            type=FixtureType.SPOT,
            start_channel=1,
            channel_count=1,
            requires_confirmation=False
        )
        
        project = self._create_project(cues=[cue], fixtures=[spot])
        engine = RuleEngine(project)
        
        issues = engine.check_missing_confirmation()
        
        assert len(issues) == 0
    
    def test_run_all_checks(self):
        """测试运行所有检测"""
        cue1 = Cue(
            cue_number="CUE_001",
            description="测试1",
            trigger_type=TriggerType.TIME,
            trigger_value=0.0,
            duration=5.0,
            channels={1: 100, 10: 200}
        )
        cue2 = Cue(
            cue_number="CUE_002",
            description="测试2",
            trigger_type=TriggerType.TIME,
            trigger_value=3.0,
            duration=3.0,
            channels={1: 200}
        )
        
        hazer = Fixture(
            id="HAZER_001",
            name="烟机",
            type=FixtureType.HAZER,
            start_channel=10,
            channel_count=1,
            requires_confirmation=True
        )
        
        project = self._create_project(cues=[cue1, cue2], fixtures=[hazer])
        engine = RuleEngine(project)
        
        issues = engine.run_all_checks()
        
        assert len(issues) >= 3
        
        conflict_issues = [i for i in issues if i.type == IssueType.CHANNEL_CONFLICT]
        overlap_issues = [i for i in issues if i.type == IssueType.TIME_OVERLAP]
        confirm_issues = [i for i in issues if i.type == IssueType.MISSING_CONFIRMATION]
        
        assert len(conflict_issues) >= 1
        assert len(overlap_issues) >= 1
        assert len(confirm_issues) >= 1
