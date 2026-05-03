from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum


class EventType(Enum):
    PROTECTION_START = "保护启动"
    PROTECTION_ACTION = "保护动作"
    BREAKER_TRIP = "断路器跳闸"
    BUS_TIE_TRIP = "母联联跳"
    PROTECTION_RETURN = "保护返回"
    UNKNOWN = "未知"


@dataclass
class Event:
    id: str
    timestamp: datetime
    event_type: EventType
    device_name: str
    phase: str = ""
    action_value: float = 0.0
    setting_value: float = 0.0
    raw_data: Dict[str, Any] = field(default_factory=dict)
    source: str = ""
    notes: str = ""
    is_valid: bool = True
    out_of_order: bool = False


class EventChainBuilder:
    """
    事件链构建器
    处理：
    1. 动作顺序乱序
    2. 时间排序和关联
    3. 事件类型识别
    """
    
    def __init__(self, time_tolerance_ms: int = 100):
        self.time_tolerance_ms = time_tolerance_ms
        self.events: List[Event] = []
    
    def add_protection_actions(self, actions: List[Dict[str, Any]]) -> None:
        """
        添加保护动作记录
        """
        for action in actions:
            event = self._action_to_event(action)
            self.events.append(event)
    
    def _action_to_event(self, action: Dict[str, Any]) -> Event:
        """
        将保护动作记录转换为事件
        """
        action_type = action.get('action_type', '动作').lower()
        status = action.get('status', '').lower()
        
        event_type = EventType.UNKNOWN
        
        if '启动' in action_type or 'start' in action_type:
            event_type = EventType.PROTECTION_START
        elif '返回' in action_type or 'return' in action_type:
            event_type = EventType.PROTECTION_RETURN
        elif '跳闸' in action_type or 'trip' in action_type or '动作' in action_type:
            protection_type = action.get('protection_type', '').lower()
            if '母联' in protection_type or 'bus' in protection_type or 'tie' in protection_type:
                event_type = EventType.BUS_TIE_TRIP
            else:
                event_type = EventType.PROTECTION_ACTION
        
        return Event(
            id=action.get('id', f"evt-{len(self.events)}"),
            timestamp=action.get('timestamp'),
            event_type=event_type,
            device_name=action.get('device_name', ''),
            phase=action.get('phase', ''),
            action_value=action.get('action_value', 0.0),
            setting_value=action.get('setting_value', 0.0),
            raw_data=action.get('raw_data', {}),
            source=action.get('source', 'protection'),
        )
    
    def build_event_chain(self) -> List[Event]:
        """
        构建事件链
        1. 按时间排序
        2. 检测乱序事件
        3. 关联相关事件
        """
        if not self.events:
            return []
        
        sorted_events = sorted(self.events, key=lambda e: e.timestamp)
        
        for i, event in enumerate(sorted_events):
            if i == 0:
                continue
            
            prev_event = sorted_events[i - 1]
            if event.timestamp < prev_event.timestamp:
                event.out_of_order = True
                event.notes += f"检测到时间乱序: 前一事件时间 {prev_event.timestamp}, 当前事件时间 {event.timestamp}"
        
        self._associate_related_events(sorted_events)
        
        return sorted_events
    
    def _associate_related_events(self, events: List[Event]) -> None:
        """
        关联相关事件（同一设备的启动-动作-跳闸序列）
        """
        tolerance = timedelta(milliseconds=self.time_tolerance_ms)
        
        device_events: Dict[str, List[Event]] = {}
        for event in events:
            if event.device_name not in device_events:
                device_events[event.device_name] = []
            device_events[event.device_name].append(event)
        
        for device_name, dev_events in device_events.items():
            starts = [e for e in dev_events if e.event_type == EventType.PROTECTION_START]
            actions = [e for e in dev_events if e.event_type == EventType.PROTECTION_ACTION]
            
            for action in actions:
                for start in starts:
                    if start.timestamp <= action.timestamp <= start.timestamp + tolerance:
                        action.notes += f" 关联保护启动事件: {start.id}"
                        break
    
    def get_event_summary(self) -> Dict[str, Any]:
        """
        获取事件摘要信息
        """
        if not self.events:
            return {
                'total_events': 0,
                'start_time': None,
                'end_time': None,
                'event_types': {},
                'devices': [],
                'out_of_order_count': 0,
            }
        
        sorted_events = sorted(self.events, key=lambda e: e.timestamp)
        
        event_types = {}
        devices = set()
        out_of_order_count = 0
        
        for event in sorted_events:
            event_type_name = event.event_type.value
            if event_type_name not in event_types:
                event_types[event_type_name] = 0
            event_types[event_type_name] += 1
            
            if event.device_name:
                devices.add(event.device_name)
            
            if event.out_of_order:
                out_of_order_count += 1
        
        return {
            'total_events': len(self.events),
            'start_time': sorted_events[0].timestamp,
            'end_time': sorted_events[-1].timestamp,
            'event_types': event_types,
            'devices': sorted(list(devices)),
            'out_of_order_count': out_of_order_count,
        }
