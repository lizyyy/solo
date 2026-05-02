"""
状态聚合模块
负责重建每台设备的状态时间线，聚合信号值变化，准备报告数据
"""

from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict

from .log_parser import CANFrame, format_timestamp
from .signal_decoder import DecodedFrame, DecodedSignal, SignalDecoder, DeviceRegistry


@dataclass
class SignalSnapshot:
    """信号快照"""
    timestamp: float
    value: Any
    raw_value: int
    unit: str = ""
    enum_label: Optional[str] = None


@dataclass
class DeviceState:
    """设备状态"""
    device_id: str
    device_name: str
    signals: Dict[str, List[SignalSnapshot]] = field(default_factory=dict)
    can_ids_seen: List[int] = field(default_factory=list)
    first_seen: Optional[float] = None
    last_seen: Optional[float] = None
    frame_count: int = 0


@dataclass
class TimelineEvent:
    """时间线事件"""
    timestamp: float
    event_type: str
    device_id: Optional[str]
    can_id: Optional[int]
    signal_name: Optional[str]
    value: Any
    details: Dict[str, Any] = field(default_factory=dict)


class StateAggregator:
    """状态聚合器
    
    跟踪每台设备的信号值变化，重建状态时间线
    """
    
    def __init__(self, signal_decoder: SignalDecoder, device_registry: DeviceRegistry):
        self.signal_decoder = signal_decoder
        self.device_registry = device_registry
        
        # 设备状态
        self.device_states: Dict[str, DeviceState] = {}
        
        # 时间线事件
        self.timeline: List[TimelineEvent] = []
        
        # ID冲突检测
        self.id_usage_tracking: Dict[int, List[Dict[str, Any]]] = {}
        
        # 统计信息
        self.stats = {
            'total_frames_aggregated': 0,
            'devices_updated': set(),
            'signals_tracked': set()
        }
    
    def initialize_devices(self) -> None:
        """初始化所有已知设备的状态"""
        for device_id in self.device_registry.get_all_devices():
            device_info = self.device_registry.get_device_info(device_id)
            if device_info:
                self.device_states[device_id] = DeviceState(
                    device_id=device_id,
                    device_name=device_info.get('device_name', device_id)
                )
    
    def process_frame(self, frame: CANFrame, decoded_frame: Optional[DecodedFrame] = None) -> None:
        """
        处理单个CAN帧，更新设备状态
        
        Args:
            frame: 原始CAN帧
            decoded_frame: 解码后的帧（可选）
        """
        self.stats['total_frames_aggregated'] += 1
        
        # 获取设备ID
        device_id = self.device_registry.get_device_by_can_id(frame.can_id)
        
        # 跟踪ID使用情况（用于检测冲突）
        self._track_id_usage(frame.can_id, device_id, frame.timestamp)
        
        if device_id:
            # 初始化设备状态（如果不存在）
            if device_id not in self.device_states:
                device_info = self.device_registry.get_device_info(device_id)
                self.device_states[device_id] = DeviceState(
                    device_id=device_id,
                    device_name=device_info.get('device_name', device_id) if device_info else device_id
                )
            
            device_state = self.device_states[device_id]
            
            # 更新时间范围
            if device_state.first_seen is None or frame.timestamp < device_state.first_seen:
                device_state.first_seen = frame.timestamp
            if device_state.last_seen is None or frame.timestamp > device_state.last_seen:
                device_state.last_seen = frame.timestamp
            
            # 记录看到的CAN ID
            if frame.can_id not in device_state.can_ids_seen:
                device_state.can_ids_seen.append(frame.can_id)
            
            # 增加帧计数
            device_state.frame_count += 1
            
            # 标记设备已更新
            self.stats['devices_updated'].add(device_id)
        
        # 如果有解码后的帧，更新信号值
        if decoded_frame and device_id:
            self._update_signals(device_id, decoded_frame)
    
    def _track_id_usage(self, can_id: int, device_id: Optional[str], timestamp: float) -> None:
        """
        跟踪CAN ID的使用情况，用于检测ID冲突
        
        Args:
            can_id: CAN ID
            device_id: 设备ID（可能为None）
            timestamp: 时间戳
        """
        if can_id not in self.id_usage_tracking:
            self.id_usage_tracking[can_id] = []
        
        # 检查是否有新的设备使用这个ID
        usage_info = {
            'device_id': device_id,
            'first_seen': timestamp,
            'last_seen': timestamp,
            'frame_count': 1
        }
        
        # 查找是否已有相同设备的记录
        existing = None
        for entry in self.id_usage_tracking[can_id]:
            if entry['device_id'] == device_id:
                existing = entry
                break
        
        if existing:
            # 更新现有记录
            existing['last_seen'] = timestamp
            existing['frame_count'] += 1
        else:
            # 添加新记录
            self.id_usage_tracking[can_id].append(usage_info)
    
    def _update_signals(self, device_id: str, decoded_frame: DecodedFrame) -> None:
        """
        更新设备的信号值
        
        Args:
            device_id: 设备ID
            decoded_frame: 解码后的帧
        """
        if device_id not in self.device_states:
            return
        
        device_state = self.device_states[device_id]
        
        for signal_name, decoded_signal in decoded_frame.signals.items():
            # 创建信号快照
            snapshot = SignalSnapshot(
                timestamp=decoded_frame.timestamp,
                value=decoded_signal.value,
                raw_value=decoded_signal.raw_value,
                unit=decoded_signal.unit,
                enum_label=decoded_signal.enum_label
            )
            
            # 初始化信号列表
            if signal_name not in device_state.signals:
                device_state.signals[signal_name] = []
            
            # 检查是否与上一个值不同（只记录变化）
            signal_history = device_state.signals[signal_name]
            if signal_history:
                last_snapshot = signal_history[-1]
                if last_snapshot.value != decoded_signal.value:
                    # 值有变化，添加到时间线
                    self._add_timeline_event(
                        timestamp=decoded_frame.timestamp,
                        event_type='signal_change',
                        device_id=device_id,
                        can_id=decoded_frame.can_id,
                        signal_name=signal_name,
                        value=decoded_signal.value,
                        details={
                            'old_value': last_snapshot.value,
                            'new_value': decoded_signal.value,
                            'unit': decoded_signal.unit,
                            'enum_label': decoded_signal.enum_label
                        }
                    )
                    signal_history.append(snapshot)
            else:
                # 第一个值
                signal_history.append(snapshot)
                self._add_timeline_event(
                    timestamp=decoded_frame.timestamp,
                    event_type='signal_initial',
                    device_id=device_id,
                    can_id=decoded_frame.can_id,
                    signal_name=signal_name,
                    value=decoded_signal.value,
                    details={
                        'unit': decoded_signal.unit,
                        'enum_label': decoded_signal.enum_label
                    }
                )
            
            # 跟踪信号
            self.stats['signals_tracked'].add(signal_name)
    
    def _add_timeline_event(self, timestamp: float, event_type: str, 
                            device_id: Optional[str], can_id: Optional[int],
                            signal_name: Optional[str], value: Any,
                            details: Dict[str, Any] = None) -> None:
        """
        添加时间线事件
        
        Args:
            timestamp: 时间戳
            event_type: 事件类型
            device_id: 设备ID
            can_id: CAN ID
            signal_name: 信号名称
            value: 值
            details: 详细信息
        """
        event = TimelineEvent(
            timestamp=timestamp,
            event_type=event_type,
            device_id=device_id,
            can_id=can_id,
            signal_name=signal_name,
            value=value,
            details=details or {}
        )
        self.timeline.append(event)
    
    def get_id_conflicts(self) -> List[Dict[str, Any]]:
        """
        检测ID冲突
        
        Returns:
            ID冲突列表
        """
        conflicts = []
        
        for can_id, usage_list in self.id_usage_tracking.items():
            # 如果一个ID被多个不同的设备使用，就是冲突
            unique_devices = set()
            for usage in usage_list:
                if usage['device_id']:
                    unique_devices.add(usage['device_id'])
            
            if len(unique_devices) > 1:
                # 检测到ID冲突
                conflict = {
                    'can_id': can_id,
                    'can_id_hex': f'0x{can_id:X}',
                    'devices': list(unique_devices),
                    'usage_details': usage_list
                }
                conflicts.append(conflict)
        
        return conflicts
    
    def get_device_state(self, device_id: str) -> Optional[DeviceState]:
        """
        获取指定设备的状态
        
        Args:
            device_id: 设备ID
            
        Returns:
            设备状态
        """
        return self.device_states.get(device_id)
    
    def get_all_device_states(self) -> List[DeviceState]:
        """
        获取所有设备状态
        
        Returns:
            设备状态列表
        """
        return sorted(self.device_states.values(), key=lambda x: x.device_id)
    
    def get_timeline(self) -> List[TimelineEvent]:
        """
        获取时间线事件（按时间排序）
        
        Returns:
            时间线事件列表
        """
        return sorted(self.timeline, key=lambda x: x.timestamp)
    
    def get_signal_history(self, device_id: str, signal_name: str) -> List[SignalSnapshot]:
        """
        获取指定设备指定信号的历史
        
        Args:
            device_id: 设备ID
            signal_name: 信号名称
            
        Returns:
            信号快照列表
        """
        device_state = self.device_states.get(device_id)
        if device_state:
            return device_state.signals.get(signal_name, [])
        return []
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取统计信息
        
        Returns:
            统计信息字典
        """
        stats = {
            'total_frames_aggregated': self.stats['total_frames_aggregated'],
            'devices_tracked': len(self.device_states),
            'devices_with_data': len(self.stats['devices_updated']),
            'signals_tracked': len(self.stats['signals_tracked']),
            'timeline_events': len(self.timeline),
            'id_conflicts_detected': len(self.get_id_conflicts())
        }
        
        # 按设备统计
        device_stats = {}
        for device_id, device_state in self.device_states.items():
            device_stats[device_id] = {
                'name': device_state.device_name,
                'frame_count': device_state.frame_count,
                'signals_monitored': len(device_state.signals),
                'can_ids_seen': [f'0x{cid:X}' for cid in device_state.can_ids_seen],
                'first_seen': format_timestamp(device_state.first_seen) if device_state.first_seen else None,
                'last_seen': format_timestamp(device_state.last_seen) if device_state.last_seen else None
            }
        stats['device_statistics'] = device_stats
        
        return stats
    
    def get_unknown_ids(self, known_ids: set) -> List[int]:
        """
        获取未在设备台账中注册的CAN ID
        
        Args:
            known_ids: 已知的CAN ID集合
            
        Returns:
            未知ID列表
        """
        unknown = []
        for can_id in self.id_usage_tracking.keys():
            # 检查这个ID是否没有设备映射
            usages = self.id_usage_tracking[can_id]
            has_device = any(u['device_id'] is not None for u in usages)
            if not has_device:
                unknown.append(can_id)
        return unknown
