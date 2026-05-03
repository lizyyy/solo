"""
数据模型测试
"""

import pytest
from datetime import datetime

from dmx_protect.models import (
    Cue, Fixture, Modification, ChannelChange, Issue, TheaterConfig, ProjectData,
    TriggerType, FixtureType, IssueType, Severity, ReviewDecision
)


class TestCue:
    """Cue 模型测试"""
    
    def test_create_valid_cue(self):
        """测试创建有效的 CUE"""
        cue = Cue(
            cue_number="CUE_001",
            description="测试 CUE",
            trigger_type=TriggerType.TIME,
            trigger_value=0.0,
            duration=5.0,
            channels={1: 100, 2: 200}
        )
        
        assert cue.cue_number == "CUE_001"
        assert cue.description == "测试 CUE"
        assert cue.trigger_type == TriggerType.TIME
        assert cue.start_time == 0.0
        assert cue.end_time == 5.0
        assert cue.channels == {1: 100, 2: 200}
    
    def test_cue_start_end_time(self):
        """测试 CUE 开始和结束时间计算"""
        cue = Cue(
            cue_number="CUE_001",
            description="测试",
            trigger_type=TriggerType.TIME,
            trigger_value=10.5,
            duration=3.0,
            channels={}
        )
        
        assert cue.start_time == 10.5
        assert cue.end_time == 13.5
    
    def test_invalid_channel_number(self):
        """测试无效通道号"""
        with pytest.raises(ValueError):
            Cue(
                cue_number="CUE_001",
                description="测试",
                trigger_type=TriggerType.TIME,
                trigger_value=0.0,
                duration=1.0,
                channels={0: 100}
            )
        
        with pytest.raises(ValueError):
            Cue(
                cue_number="CUE_001",
                description="测试",
                trigger_type=TriggerType.TIME,
                trigger_value=0.0,
                duration=1.0,
                channels={513: 100}
            )
    
    def test_invalid_channel_value(self):
        """测试无效通道值"""
        with pytest.raises(ValueError):
            Cue(
                cue_number="CUE_001",
                description="测试",
                trigger_type=TriggerType.TIME,
                trigger_value=0.0,
                duration=1.0,
                channels={1: -1}
            )
        
        with pytest.raises(ValueError):
            Cue(
                cue_number="CUE_001",
                description="测试",
                trigger_type=TriggerType.TIME,
                trigger_value=0.0,
                duration=1.0,
                channels={1: 256}
            )
    
    def test_cue_to_dict(self):
        """测试 CUE 转字典"""
        cue = Cue(
            cue_number="CUE_001",
            description="测试 CUE",
            trigger_type=TriggerType.AUTO,
            trigger_value=5.0,
            duration=2.0,
            channels={1: 255}
        )
        
        data = cue.to_dict()
        
        assert data["cue_number"] == "CUE_001"
        assert data["trigger_type"] == "auto"
        assert data["start_time"] == 5.0
        assert data["channels"] == {1: 255}


class TestFixture:
    """Fixture 模型测试"""
    
    def test_create_valid_fixture(self):
        """测试创建有效的灯具"""
        fixture = Fixture(
            id="SPOT_001",
            name="聚光灯1",
            type=FixtureType.SPOT,
            start_channel=1,
            channel_count=3,
            channels={"dimmer": 1, "pan": 2, "tilt": 3},
            requires_confirmation=False
        )
        
        assert fixture.id == "SPOT_001"
        assert fixture.name == "聚光灯1"
        assert fixture.type == FixtureType.SPOT
        assert fixture.start_channel == 1
        assert fixture.channel_count == 3
        assert fixture.end_channel == 3
    
    def test_fixture_end_channel(self):
        """测试灯具结束通道计算"""
        fixture = Fixture(
            id="TEST",
            name="测试",
            type=FixtureType.OTHER,
            start_channel=10,
            channel_count=5
        )
        
        assert fixture.end_channel == 14
        assert fixture.get_affected_channels() == [10, 11, 12, 13, 14]
    
    def test_fixture_has_channel(self):
        """测试灯具通道检查"""
        fixture = Fixture(
            id="TEST",
            name="测试",
            type=FixtureType.OTHER,
            start_channel=5,
            channel_count=3
        )
        
        assert fixture.has_channel(5) is True
        assert fixture.has_channel(7) is True
        assert fixture.has_channel(4) is False
        assert fixture.has_channel(8) is False
    
    def test_safety_device_detection(self):
        """测试安全设备检测"""
        hazer = Fixture(
            id="HAZER_001",
            name="烟机",
            type=FixtureType.HAZER,
            start_channel=1,
            channel_count=1
        )
        assert hazer.is_safety_device() is True
        
        lift = Fixture(
            id="LIFT_001",
            name="升降台",
            type=FixtureType.LIFT,
            start_channel=1,
            channel_count=1
        )
        assert lift.is_safety_device() is True
        
        spot = Fixture(
            id="SPOT_001",
            name="聚光灯",
            type=FixtureType.SPOT,
            start_channel=1,
            channel_count=1
        )
        assert spot.is_safety_device() is False
        
        custom_safety = Fixture(
            id="CUSTOM",
            name="自定义安全设备",
            type=FixtureType.OTHER,
            start_channel=1,
            channel_count=1,
            requires_confirmation=True
        )
        assert custom_safety.is_safety_device() is True
    
    def test_invalid_start_channel(self):
        """测试无效起始通道"""
        with pytest.raises(ValueError):
            Fixture(
                id="TEST",
                name="测试",
                type=FixtureType.OTHER,
                start_channel=0,
                channel_count=1
            )
        
        with pytest.raises(ValueError):
            Fixture(
                id="TEST",
                name="测试",
                type=FixtureType.OTHER,
                start_channel=513,
                channel_count=1
            )
    
    def test_channel_out_of_range(self):
        """测试通道超出范围"""
        with pytest.raises(ValueError):
            Fixture(
                id="TEST",
                name="测试",
                type=FixtureType.OTHER,
                start_channel=510,
                channel_count=5
            )


class TestIssue:
    """Issue 模型测试"""
    
    def test_create_issue(self):
        """测试创建问题"""
        issue = Issue(
            id="ISSUE_001",
            type=IssueType.CHANNEL_CONFLICT,
            severity=Severity.CRITICAL,
            title="通道冲突",
            description="通道 1 被两个 CUE 同时设置不同值",
            affected_cues=["CUE_001", "CUE_002"],
            affected_channels=[1]
        )
        
        assert issue.id == "ISSUE_001"
        assert issue.type == IssueType.CHANNEL_CONFLICT
        assert issue.severity == Severity.CRITICAL
        assert issue.is_resolved is False
    
    def test_issue_resolved_status(self):
        """测试问题已解决状态"""
        issue = Issue(
            id="ISSUE_001",
            type=IssueType.TIME_OVERLAP,
            severity=Severity.WARNING,
            title="时间重叠",
            description="测试",
            affected_cues=[],
            affected_channels=[],
            review_decision=ReviewDecision.ACCEPT
        )
        
        assert issue.is_resolved is True
    
    def test_issue_to_dict(self):
        """测试问题转字典"""
        issue = Issue(
            id="ISSUE_001",
            type=IssueType.DANGEROUS_JUMP,
            severity=Severity.WARNING,
            title="危险跳变",
            description="亮度变化过大",
            affected_cues=["CUE_001", "CUE_002"],
            affected_channels=[1],
            details={"diff": 200, "threshold": 150}
        )
        
        data = issue.to_dict()
        
        assert data["id"] == "ISSUE_001"
        assert data["type"] == "dangerous_jump"
        assert data["severity"] == "warning"
        assert data["details"]["diff"] == 200
        assert data["is_resolved"] is False


class TestTheaterConfig:
    """TheaterConfig 模型测试"""
    
    def test_create_config(self):
        """测试创建剧场配置"""
        config = TheaterConfig(
            name="测试剧场",
            total_channels=512,
            dangerous_jump_threshold=150
        )
        
        assert config.name == "测试剧场"
        assert config.total_channels == 512
        assert config.dangerous_jump_threshold == 150
    
    def test_config_to_dict_and_from_dict(self):
        """测试配置序列化和反序列化"""
        config = TheaterConfig(
            name="测试剧场",
            total_channels=1024,
            dangerous_jump_threshold=200
        )
        
        data = config.to_dict()
        assert data["name"] == "测试剧场"
        assert data["total_channels"] == 1024
        
        restored = TheaterConfig.from_dict(data)
        assert restored.name == config.name
        assert restored.total_channels == config.total_channels
        assert restored.dangerous_jump_threshold == config.dangerous_jump_threshold


class TestProjectData:
    """ProjectData 模型测试"""
    
    def test_create_project_data(self):
        """测试创建项目数据"""
        config = TheaterConfig(name="测试剧场")
        project = ProjectData(config=config)
        
        assert project.config.name == "测试剧场"
        assert len(project.cues) == 0
        assert len(project.fixtures) == 0
        assert len(project.issues) == 0
    
    def test_get_cue_by_number(self):
        """测试按编号获取 CUE"""
        config = TheaterConfig(name="测试")
        project = ProjectData(config=config)
        
        cue1 = Cue(
            cue_number="CUE_001",
            description="测试1",
            trigger_type=TriggerType.TIME,
            trigger_value=0.0,
            duration=1.0,
            channels={}
        )
        cue2 = Cue(
            cue_number="CUE_002",
            description="测试2",
            trigger_type=TriggerType.TIME,
            trigger_value=2.0,
            duration=1.0,
            channels={}
        )
        
        project.cues = [cue1, cue2]
        
        assert project.get_cue_by_number("CUE_001") == cue1
        assert project.get_cue_by_number("CUE_002") == cue2
        assert project.get_cue_by_number("CUE_003") is None
    
    def test_get_issue_by_id(self):
        """测试按 ID 获取问题"""
        config = TheaterConfig(name="测试")
        project = ProjectData(config=config)
        
        issue = Issue(
            id="ISSUE_001",
            type=IssueType.TIME_OVERLAP,
            severity=Severity.WARNING,
            title="测试",
            description="测试",
            affected_cues=[],
            affected_channels=[]
        )
        
        project.issues = [issue]
        
        assert project.get_issue_by_id("ISSUE_001") == issue
        assert project.get_issue_by_id("ISSUE_002") is None
