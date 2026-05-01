"""时间线归并和去重规则模块"""

import re
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import pytz

from .config import Event, EventSource, EventType, ProjectConfig, Timeline


class Reconciler:
    """时间线归并器
    
    负责将导入的事件统一归并成一条可信的时间线：
    - 修正时区和时钟偏移
    - 合并重复告警
    - 识别事件类型
    - 处理冲突事件
    """
    
    def __init__(self, config: ProjectConfig):
        self.config = config
        self.deduplication_window = timedelta(seconds=config.deduplication_window_seconds)
        self.clock_offset = timedelta(seconds=config.clock_offset_seconds)
    
    def reconcile(self, events: List[Event]) -> Timeline:
        """归并事件列表为时间线
        
        Args:
            events: 原始事件列表
            
        Returns:
            归并后的时间线
        """
        timeline = Timeline(
            id=str(uuid.uuid4())[:8],
            title="归并后的时间线",
        )
        
        processed_events = []
        quarantined_events = []
        
        for event in events:
            if event.is_quarantined:
                quarantined_events.append(event)
                continue
            
            processed_event = self._process_event(event)
            if processed_event:
                processed_events.append(processed_event)
        
        duplicates_removed = self._deduplicate_events(processed_events)
        
        timeline.events = processed_events
        timeline.quarantined_events = quarantined_events
        timeline.sort_events()
        
        self._classify_event_types(timeline)
        self._detect_conflicts(timeline)
        
        return timeline
    
    def _process_event(self, event: Event) -> Event:
        """处理单个事件：修正时间戳、应用时钟偏移"""
        if self.clock_offset.total_seconds() != 0:
            event.timestamp = event.timestamp - self.clock_offset
        
        return event
    
    def _deduplicate_events(self, events: List[Event]) -> int:
        """检测并标记重复事件
        
        重复事件判定规则：
        1. 同一来源的相同告警（相同标题+时间窗口内）
        2. 不同来源的相同事件（需要冲突解决）
        
        Returns:
            检测到的重复事件数量
        """
        if not events:
            return 0
        
        events.sort(key=lambda e: e.timestamp)
        
        duplicate_count = 0
        event_groups: Dict[str, List[Event]] = {}
        
        for event in events:
            key = self._get_duplicate_key(event)
            
            if key not in event_groups:
                event_groups[key] = []
            
            event_groups[key].append(event)
        
        for key, group in event_groups.items():
            if len(group) <= 1:
                continue
            
            group.sort(key=lambda e: e.timestamp)
            first_event = group[0]
            
            i = 1
            while i < len(group):
                current_event = group[i]
                time_diff = current_event.timestamp - first_event.timestamp
                
                if time_diff <= self.deduplication_window:
                    current_event.is_duplicate = True
                    current_event.duplicate_of = first_event.id
                    duplicate_count += 1
                else:
                    first_event = current_event
                
                i += 1
        
        return duplicate_count
    
    def _get_duplicate_key(self, event: Event) -> str:
        """生成用于去重的键值"""
        parts = [
            event.source,
            event.event_type,
            event.title[:100] if event.title else '',
        ]
        
        if event.service:
            parts.append(event.service)
        if event.severity:
            parts.append(event.severity)
        
        return '|'.join(str(p) for p in parts)
    
    def _classify_event_types(self, timeline: Timeline) -> None:
        """进一步分类事件类型，基于时间线上下文"""
        events = timeline.events
        
        alert_triggers = [e for e in events if e.event_type == EventType.ALERT_TRIGGER]
        
        for event in events:
            if event.event_type == EventType.UNKNOWN:
                classified = self._classify_unknown_event(event, alert_triggers)
                if classified:
                    event.event_type = classified
    
    def _classify_unknown_event(self, event: Event, alert_triggers: List[Event]) -> Optional[str]:
        """尝试分类未知类型的事件"""
        if not event.description:
            return None
        
        description_lower = event.description.lower()
        
        for trigger in alert_triggers:
            time_diff = abs((event.timestamp - trigger.timestamp).total_seconds())
            
            if time_diff < 300:
                trigger_title = trigger.title.lower() if trigger.title else ''
                
                if any(kw in description_lower for kw in ['确认', 'ack', 'acknowledge', '收到', '看到']):
                    if trigger_title in description_lower or any(t in description_lower for t in trigger_title.split()):
                        return EventType.HUMAN_CONFIRM
        
        if any(kw in description_lower for kw in ['回滚', 'rollback', '重启', 'restart', '发布', 'deploy', '配置', 'config']):
            return EventType.CHANGE_OPERATION
        
        if any(kw in description_lower for kw in ['恢复', 'recovery', '正常', 'resolved', 'fixed']):
            return EventType.RECOVERY_VERIFY
        
        if any(kw in description_lower for kw in ['待办', 'todo', '需要', 'should', '建议', 'suggest']):
            return EventType.TODO_ITEM
        
        return None
    
    def _detect_conflicts(self, timeline: Timeline) -> None:
        """检测时间线中的冲突事件
        
        冲突类型：
        1. 同一时间点的冲突描述
        2. 时间戳顺序矛盾
        3. 敏感字段无法脱敏
        """
        events = [e for e in timeline.events if not e.is_duplicate]
        
        time_groups: Dict[datetime, List[Event]] = {}
        for event in events:
            key = event.timestamp.replace(second=0, microsecond=0)
            if key not in time_groups:
                time_groups[key] = []
            time_groups[key].append(event)
        
        for time_key, group in time_groups.items():
            if len(group) <= 1:
                continue
            
            titles = set(e.title for e in group)
            if len(titles) > 1:
                for event in group:
                    event.metadata['conflict'] = {
                        'type': 'title_conflict',
                        'group_size': len(group),
                        'other_titles': [e.title for e in group if e.id != event.id]
                    }
        
        for i in range(1, len(events)):
            prev_event = events[i-1]
            curr_event = events[i]
            
            if curr_event.timestamp < prev_event.timestamp:
                curr_event.metadata['time_order_issue'] = {
                    'prev_event': prev_event.id,
                    'prev_timestamp': prev_event.timestamp.isoformat(),
                    'issue': 'current_event_earlier_than_previous'
                }


class ConflictResolver:
    """冲突解决器
    
    处理时间线中的冲突事件：
    - 同一事件不同来源的冲突
    - 时间戳缺失
    - 日志格式不匹配
    """
    
    @staticmethod
    def resolve_source_conflict(events: List[Event]) -> Tuple[Event, List[Event]]:
        """解决同一事件不同来源的冲突
        
        优先级规则：
        1. 人工确认 > 监控告警 > 日志
        2. 有明确时间戳 > 推断时间戳
        3. 更多细节 > 更少细节
        
        Returns:
            (主事件, 其他事件列表)
        """
        if not events:
            raise ValueError("Empty event list")
        
        if len(events) == 1:
            return events[0], []
        
        source_priority = {
            EventSource.MANUAL: 0,
            EventSource.CHAT_MARKDOWN: 1,
            EventSource.CHAT_JSON: 1,
            EventSource.ALERTS_CSV: 2,
            EventSource.LOGS: 3,
        }
        
        def get_priority(event: Event) -> int:
            return source_priority.get(event.source, 99)
        
        sorted_events = sorted(events, key=get_priority)
        
        primary = sorted_events[0]
        others = sorted_events[1:]
        
        for other in others:
            other.is_duplicate = True
            other.duplicate_of = primary.id
            
            if other.description and not primary.description:
                primary.description = other.description
            
            if other.raw_content and not primary.raw_content:
                primary.raw_content = other.raw_content
            
            primary.tags.extend([t for t in other.tags if t not in primary.tags])
            primary.metadata['merged_from'] = primary.metadata.get('merged_from', []) + [other.id]
        
        return primary, others
