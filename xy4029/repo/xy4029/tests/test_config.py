"""配置模型测试"""

import pytest
from datetime import datetime
from pathlib import Path
import tempfile

from postmortem_puzzle.config import (
    Event, EventType, EventSource, LogTimeFormat, 
    ProjectConfig, SensitivityRule, Timeline
)


class TestProjectConfig:
    """ProjectConfig 测试"""
    
    def test_default_creation(self):
        """测试默认创建配置"""
        config = ProjectConfig(project_name="Test Project")
        assert config.project_name == "Test Project"
        assert config.default_timezone == "Asia/Shanghai"
        assert config.deduplication_window_seconds == 300
        assert config.clock_offset_seconds == 0
    
    def test_custom_services(self):
        """测试自定义服务列表"""
        config = ProjectConfig(
            project_name="Test Project",
            services=["api-gateway", "order-service", "user-service"]
        )
        assert len(config.services) == 3
        assert "api-gateway" in config.services
    
    def test_timezone_validation(self):
        """测试时区验证"""
        with pytest.raises(ValueError):
            ProjectConfig(project_name="Test", default_timezone="Invalid/Timezone")
    
    def test_deduplication_window_validation(self):
        """测试去重窗口验证"""
        with pytest.raises(ValueError):
            ProjectConfig(project_name="Test", deduplication_window_seconds=-1)
    
    def test_save_and_load(self):
        """测试配置保存和加载"""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = Path(tmpdir) / "config.json"
            
            config = ProjectConfig(
                project_name="Test Project",
                services=["service1", "service2"],
                deduplication_window_seconds=600,
            )
            config.save(config_path)
            
            loaded_config = ProjectConfig.load(config_path)
            
            assert loaded_config.project_name == "Test Project"
            assert loaded_config.services == ["service1", "service2"]
            assert loaded_config.deduplication_window_seconds == 600


class TestEvent:
    """Event 测试"""
    
    def test_event_creation(self):
        """测试事件创建"""
        import pytz
        
        event = Event(
            id="test-id-123",
            timestamp=datetime(2024, 1, 15, 10, 30, 0, tzinfo=pytz.UTC),
            event_type=EventType.ALERT_TRIGGER,
            source=EventSource.ALERTS_CSV,
            title="Test Alert",
            severity="critical",
        )
        
        assert event.id == "test-id-123"
        assert event.event_type == EventType.ALERT_TRIGGER
        assert event.source == EventSource.ALERTS_CSV
        assert event.title == "Test Alert"
        assert event.severity == "critical"
    
    def test_event_to_dict(self):
        """测试事件序列化为字典"""
        import pytz
        
        event = Event(
            id="test-id",
            timestamp=datetime(2024, 1, 15, 10, 30, 0, tzinfo=pytz.UTC),
            event_type=EventType.HUMAN_CONFIRM,
            source=EventSource.CHAT_MARKDOWN,
            title="Test Message",
        )
        
        data = event.to_dict()
        
        assert data["id"] == "test-id"
        assert data["event_type"] == EventType.HUMAN_CONFIRM
        assert "timestamp" in data
    
    def test_event_from_dict(self):
        """测试从字典创建事件"""
        import pytz
        
        data = {
            "id": "test-id",
            "timestamp": "2024-01-15T10:30:00+00:00",
            "event_type": EventType.CHANGE_OPERATION,
            "source": EventSource.LOGS,
            "title": "Test Event",
            "created_at": "2024-01-15T10:30:00+00:00",
        }
        
        event = Event.from_dict(data)
        
        assert event.id == "test-id"
        assert event.event_type == EventType.CHANGE_OPERATION
        assert event.title == "Test Event"


class TestTimeline:
    """Timeline 测试"""
    
    def test_timeline_creation(self):
        """测试时间线创建"""
        timeline = Timeline(
            id="tl-123",
            title="Test Timeline",
        )
        
        assert timeline.id == "tl-123"
        assert timeline.title == "Test Timeline"
        assert len(timeline.events) == 0
        assert len(timeline.quarantined_events) == 0
    
    def test_sort_events(self):
        """测试事件排序"""
        import pytz
        
        timeline = Timeline(id="tl-1", title="Test")
        
        event1 = Event(
            id="e1",
            timestamp=datetime(2024, 1, 15, 10, 35, 0, tzinfo=pytz.UTC),
            event_type=EventType.ALERT_TRIGGER,
            source=EventSource.ALERTS_CSV,
            title="Later Event",
        )
        
        event2 = Event(
            id="e2",
            timestamp=datetime(2024, 1, 15, 10, 30, 0, tzinfo=pytz.UTC),
            event_type=EventType.ALERT_TRIGGER,
            source=EventSource.ALERTS_CSV,
            title="Earlier Event",
        )
        
        timeline.events = [event1, event2]
        timeline.sort_events()
        
        assert timeline.events[0].id == "e2"
        assert timeline.events[1].id == "e1"
        assert timeline.start_time == event2.timestamp
        assert timeline.end_time == event1.timestamp


class TestLogTimeFormat:
    """LogTimeFormat 测试"""
    
    def test_creation(self):
        """测试日志时间格式创建"""
        fmt = LogTimeFormat(
            name="CustomFormat",
            format="%Y/%m/%d %H:%M:%S",
        )
        
        assert fmt.name == "CustomFormat"
        assert fmt.format == "%Y/%m/%d %H:%M:%S"


class TestSensitivityRule:
    """SensitivityRule 测试"""
    
    def test_creation(self):
        """测试脱敏规则创建"""
        rule = SensitivityRule(
            name="custom_token",
            pattern=r'token=["\']?([^"\'\s,]+)["\']?',
            replacement='token: "***"',
        )
        
        assert rule.name == "custom_token"
        assert rule.pattern == r'token=["\']?([^"\'\s,]+)["\']?'
    
    def test_with_field_names(self):
        """测试带字段名限制的规则"""
        rule = SensitivityRule(
            name="password_only",
            pattern=r'password["\s:=]+["\']?[^\s"\',}]+["\']?',
            replacement='password: "***"',
            field_names=["description", "raw_content"],
        )
        
        assert rule.field_names == ["description", "raw_content"]


class TestEventType:
    """EventType 常量测试"""
    
    def test_all_types_defined(self):
        """测试所有事件类型都已定义"""
        expected_types = [
            "alert_trigger",
            "alert_recover",
            "human_confirm",
            "change_operation",
            "error_surge",
            "recovery_verify",
            "todo_item",
            "unknown",
        ]
        
        for event_type in expected_types:
            assert hasattr(EventType, event_type.upper())


class TestEventSource:
    """EventSource 常量测试"""
    
    def test_all_sources_defined(self):
        """测试所有事件来源都已定义"""
        expected_sources = [
            "alerts_csv",
            "chat_markdown",
            "chat_json",
            "logs",
            "manual",
        ]
        
        for source in expected_sources:
            assert hasattr(EventSource, source.upper())
