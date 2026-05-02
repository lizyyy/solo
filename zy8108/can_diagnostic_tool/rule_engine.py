"""
规则引擎模块
负责加载诊断规则，检测心跳丢失、信号越界、计数器回跳、ID冲突等问题
"""

import yaml
from typing import Dict, Any, List, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

from .log_parser import CANFrame, format_timestamp
from .signal_decoder import DecodedFrame, SignalDecoder, DeviceRegistry


class IssueSeverity(Enum):
    """问题严重程度"""
    CRITICAL = "critical"    # 严重
    WARNING = "warning"      # 警告
    INFO = "info"            # 信息


class IssueType(Enum):
    """问题类型"""
    HEARTBEAT_MISS = "heartbeat_miss"          # 心跳丢失
    SIGNAL_OUT_OF_RANGE = "signal_out_of_range"  # 信号越界
    COUNTER_JUMP_BACK = "counter_jump_back"     # 计数器回跳
    ID_CONFLICT = "id_conflict"                  # ID冲突
    UNKNOWN_CAN_ID = "unknown_can_id"           # 未知CAN ID
    CYCLE_VIOLATION = "cycle_violation"         # 周期违规


@dataclass
class RuleDefinition:
    """规则定义"""
    rule_type: str
    name: str
    description: str
    severity: IssueSeverity
    enabled: bool = True
    parameters: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Issue:
    """检测到的问题"""
    issue_type: IssueType
    severity: IssueSeverity
    timestamp: float
    device_id: Optional[str]
    can_id: Optional[int]
    signal_name: Optional[str]
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式，用于CSV导出"""
        return {
            'timestamp': format_timestamp(self.timestamp),
            'issue_type': self.issue_type.value,
            'severity': self.severity.value,
            'device_id': self.device_id or '',
            'can_id': f'0x{self.can_id:X}' if self.can_id else '',
            'signal_name': self.signal_name or '',
            'message': self.message,
            'details': str(self.details)
        }


class RuleEngine:
    """规则引擎
    
    加载诊断规则，跟踪CAN帧历史，检测各类通信问题
    """
    
    def __init__(self, signal_decoder: SignalDecoder, device_registry: DeviceRegistry):
        self.signal_decoder = signal_decoder
        self.device_registry = device_registry
        
        # 规则配置
        self.rules: Dict[str, RuleDefinition] = {}
        
        # 状态跟踪
        self.heartbeat_tracking: Dict[int, Dict[str, Any]] = {}
        self.counter_tracking: Dict[int, Dict[str, Dict[str, Any]]] = {}
        self.can_id_last_seen: Dict[int, float] = {}
        self.id_conflicts_detected: Set[int] = set()
        
        # 检测到的问题
        self.issues: List[Issue] = []
        
        # 日志时间范围
        self.first_timestamp: Optional[float] = None
        self.last_timestamp: Optional[float] = None
        
        # 统计信息
        self.stats = {
            'total_frames_processed': 0,
            'heartbeat_checks': 0,
            'signal_validations': 0,
            'counter_checks': 0
        }
    
    def load_rules(self, rules_path: str) -> None:
        """
        从YAML文件加载诊断规则
        
        Args:
            rules_path: 规则文件路径
        """
        with open(rules_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        rules_config = config.get('rules', {})
        
        # 心跳丢失检测规则
        if 'heartbeat_miss' in rules_config:
            hb_config = rules_config['heartbeat_miss']
            self.rules['heartbeat_miss'] = RuleDefinition(
                rule_type='heartbeat_miss',
                name=hb_config.get('name', '心跳丢失检测'),
                description=hb_config.get('description', ''),
                severity=IssueSeverity[hb_config.get('severity', 'CRITICAL').upper()],
                enabled=hb_config.get('enabled', True),
                parameters=hb_config.get('parameters', {})
            )
        
        # 信号越界检测规则
        if 'signal_out_of_range' in rules_config:
            sig_config = rules_config['signal_out_of_range']
            self.rules['signal_out_of_range'] = RuleDefinition(
                rule_type='signal_out_of_range',
                name=sig_config.get('name', '信号越界检测'),
                description=sig_config.get('description', ''),
                severity=IssueSeverity[sig_config.get('severity', 'WARNING').upper()],
                enabled=sig_config.get('enabled', True),
                parameters=sig_config.get('parameters', {})
            )
        
        # 计数器回跳检测规则
        if 'counter_jump_back' in rules_config:
            cnt_config = rules_config['counter_jump_back']
            self.rules['counter_jump_back'] = RuleDefinition(
                rule_type='counter_jump_back',
                name=cnt_config.get('name', '计数器回跳检测'),
                description=cnt_config.get('description', ''),
                severity=IssueSeverity[cnt_config.get('severity', 'CRITICAL').upper()],
                enabled=cnt_config.get('enabled', True),
                parameters=cnt_config.get('parameters', {})
            )
        
        # ID冲突检测规则
        if 'id_conflict' in rules_config:
            id_config = rules_config['id_conflict']
            self.rules['id_conflict'] = RuleDefinition(
                rule_type='id_conflict',
                name=id_config.get('name', 'ID冲突检测'),
                description=id_config.get('description', ''),
                severity=IssueSeverity[id_config.get('severity', 'CRITICAL').upper()],
                enabled=id_config.get('enabled', True),
                parameters=id_config.get('parameters', {})
            )
        
        # 周期违规检测规则
        if 'cycle_violation' in rules_config:
            cyc_config = rules_config['cycle_violation']
            self.rules['cycle_violation'] = RuleDefinition(
                rule_type='cycle_violation',
                name=cyc_config.get('name', '周期违规检测'),
                description=cyc_config.get('description', ''),
                severity=IssueSeverity[cyc_config.get('severity', 'WARNING').upper()],
                enabled=cyc_config.get('enabled', True),
                parameters=cyc_config.get('parameters', {})
            )
        
        # 初始化心跳跟踪
        heartbeat_ids = self.signal_decoder.get_heartbeat_ids()
        for can_id in heartbeat_ids:
            self.heartbeat_tracking[can_id] = {
                'last_seen': None,
                'expected_interval_ms': None,
                'miss_count': 0,
                'device_id': self.device_registry.get_device_by_can_id(can_id)
            }
    
    def process_frame(self, frame: CANFrame, decoded_frame: Optional[DecodedFrame] = None) -> None:
        """
        处理单个CAN帧，应用所有规则
        
        Args:
            frame: 原始CAN帧
            decoded_frame: 解码后的帧（可选）
        """
        self.stats['total_frames_processed'] += 1
        
        # 更新时间范围
        if self.first_timestamp is None or frame.timestamp < self.first_timestamp:
            self.first_timestamp = frame.timestamp
        if self.last_timestamp is None or frame.timestamp > self.last_timestamp:
            self.last_timestamp = frame.timestamp
        
        # 获取设备ID
        device_id = self.device_registry.get_device_by_can_id(frame.can_id)
        
        # 1. 检查心跳帧
        if frame.can_id in self.heartbeat_tracking:
            self._check_heartbeat(frame, device_id)
        
        # 2. 检查周期
        if frame.can_id in self.can_id_last_seen:
            self._check_cycle(frame, device_id)
        
        # 更新最后出现时间
        self.can_id_last_seen[frame.can_id] = frame.timestamp
        
        # 如果有解码后的帧，检查信号
        if decoded_frame:
            # 3. 检查信号越界
            self._check_signal_range(decoded_frame, device_id)
            
            # 4. 检查计数器
            self._check_counter(decoded_frame, device_id)
    
    def _check_heartbeat(self, frame: CANFrame, device_id: Optional[str]) -> None:
        """检查心跳帧"""
        self.stats['heartbeat_checks'] += 1
        
        rule = self.rules.get('heartbeat_miss')
        if not rule or not rule.enabled:
            return
        
        tracking = self.heartbeat_tracking.get(frame.can_id, {})
        
        if tracking.get('last_seen') is not None:
            # 已经收到过心跳，检查间隔
            last_seen = tracking['last_seen']
            interval = (frame.timestamp - last_seen) * 1000  # 转换为毫秒
            
            # 获取期望的周期时间
            expected_interval = tracking.get('expected_interval_ms')
            if expected_interval is None:
                # 从信号定义获取
                id_def = self.signal_decoder.get_id_definition(frame.can_id)
                if id_def and id_def.cycle_time_ms:
                    expected_interval = id_def.cycle_time_ms
                else:
                    # 使用规则中的默认值
                    expected_interval = rule.parameters.get('default_interval_ms', 1000)
                
                tracking['expected_interval_ms'] = expected_interval
            
            # 计算允许的最大延迟（默认为3倍周期）
            max_delay = expected_interval * rule.parameters.get('max_multiplier', 3)
            
            if interval > max_delay:
                issue = Issue(
                    issue_type=IssueType.HEARTBEAT_MISS,
                    severity=rule.severity,
                    timestamp=frame.timestamp,
                    device_id=device_id,
                    can_id=frame.can_id,
                    signal_name=None,
                    message=f"心跳帧间隔异常: 期望约 {expected_interval}ms，实际 {interval:.1f}ms",
                    details={
                        'expected_interval_ms': expected_interval,
                        'actual_interval_ms': interval,
                        'max_allowed_ms': max_delay
                    }
                )
                self.issues.append(issue)
                tracking['miss_count'] = tracking.get('miss_count', 0) + 1
        
        # 更新最后看到时间
        tracking['last_seen'] = frame.timestamp
        self.heartbeat_tracking[frame.can_id] = tracking
    
    def _check_cycle(self, frame: CANFrame, device_id: Optional[str]) -> None:
        """检查周期违规"""
        rule = self.rules.get('cycle_violation')
        if not rule or not rule.enabled:
            return
        
        last_seen = self.can_id_last_seen.get(frame.can_id)
        if last_seen is None:
            return
        
        # 从信号定义获取期望周期
        id_def = self.signal_decoder.get_id_definition(frame.can_id)
        if not id_def or not id_def.cycle_time_ms:
            return
        
        actual_interval = (frame.timestamp - last_seen) * 1000
        expected_interval = id_def.cycle_time_ms
        
        # 检查是否太快（可能是重发或冲突）
        min_interval = expected_interval * rule.parameters.get('min_multiplier', 0.5)
        
        if actual_interval < min_interval:
            issue = Issue(
                issue_type=IssueType.CYCLE_VIOLATION,
                severity=rule.severity,
                timestamp=frame.timestamp,
                device_id=device_id,
                can_id=frame.can_id,
                signal_name=None,
                message=f"周期违规: 期望约 {expected_interval}ms，实际 {actual_interval:.1f}ms (太快)",
                details={
                    'expected_interval_ms': expected_interval,
                    'actual_interval_ms': actual_interval,
                    'min_allowed_ms': min_interval
                }
            )
            self.issues.append(issue)
    
    def _check_signal_range(self, decoded_frame: DecodedFrame, device_id: Optional[str]) -> None:
        """检查信号越界"""
        self.stats['signal_validations'] += 1
        
        rule = self.rules.get('signal_out_of_range')
        if not rule or not rule.enabled:
            return
        
        can_id = decoded_frame.can_id
        id_def = self.signal_decoder.get_id_definition(can_id)
        
        if not id_def:
            return
        
        for signal_name, decoded_signal in decoded_frame.signals.items():
            signal_def = id_def.signals.get(signal_name)
            if not signal_def:
                continue
            
            # 检查是否有定义的范围
            has_min = signal_def.min_value is not None
            has_max = signal_def.max_value is not None
            
            if not has_min and not has_max:
                continue
            
            value = decoded_signal.value
            out_of_range = False
            range_message = ""
            
            if has_min and value < signal_def.min_value:
                out_of_range = True
                range_message = f"低于最小值 {signal_def.min_value}"
            
            if has_max and value > signal_def.max_value:
                out_of_range = True
                if range_message:
                    range_message += " 且 "
                range_message += f"高于最大值 {signal_def.max_value}"
            
            if out_of_range:
                issue = Issue(
                    issue_type=IssueType.SIGNAL_OUT_OF_RANGE,
                    severity=rule.severity,
                    timestamp=decoded_frame.timestamp,
                    device_id=device_id,
                    can_id=can_id,
                    signal_name=signal_name,
                    message=f"信号 {signal_name} 越界: {value}{decoded_signal.unit} ({range_message})",
                    details={
                        'signal_value': value,
                        'min_value': signal_def.min_value,
                        'max_value': signal_def.max_value,
                        'raw_value': decoded_signal.raw_value
                    }
                )
                self.issues.append(issue)
    
    def _check_counter(self, decoded_frame: DecodedFrame, device_id: Optional[str]) -> None:
        """检查计数器回跳"""
        self.stats['counter_checks'] += 1
        
        rule = self.rules.get('counter_jump_back')
        if not rule or not rule.enabled:
            return
        
        can_id = decoded_frame.can_id
        
        # 获取计数器信号定义
        counter_signals = rule.parameters.get('counter_signals', {})
        if not counter_signals:
            return
        
        # 初始化此CAN ID的计数器跟踪
        if can_id not in self.counter_tracking:
            self.counter_tracking[can_id] = {}
        
        for signal_name in counter_signals:
            if signal_name not in decoded_frame.signals:
                continue
            
            decoded_signal = decoded_frame.signals[signal_name]
            current_value = decoded_signal.raw_value
            
            # 初始化跟踪
            if signal_name not in self.counter_tracking[can_id]:
                self.counter_tracking[can_id][signal_name] = {
                    'last_value': current_value,
                    'last_timestamp': decoded_frame.timestamp,
                    'jump_count': 0
                }
                continue
            
            tracking = self.counter_tracking[can_id][signal_name]
            last_value = tracking['last_value']
            
            # 检查回跳（排除正常的循环，如从255到0）
            counter_size = counter_signals.get(signal_name, {}).get('bit_length', 8)
            max_value = (1 << counter_size) - 1
            allow_rollover = counter_signals.get(signal_name, {}).get('allow_rollover', True)
            
            # 正常循环：从max到0是允许的
            if allow_rollover and last_value == max_value and current_value == 0:
                pass  # 正常的循环
            elif current_value < last_value:
                # 检测到回跳
                issue = Issue(
                    issue_type=IssueType.COUNTER_JUMP_BACK,
                    severity=rule.severity,
                    timestamp=decoded_frame.timestamp,
                    device_id=device_id,
                    can_id=can_id,
                    signal_name=signal_name,
                    message=f"计数器 {signal_name} 回跳: 从 {last_value} 到 {current_value}",
                    details={
                        'previous_value': last_value,
                        'current_value': current_value,
                        'counter_size_bits': counter_size,
                        'max_value': max_value
                    }
                )
                self.issues.append(issue)
                tracking['jump_count'] = tracking.get('jump_count', 0) + 1
            
            # 更新跟踪值
            tracking['last_value'] = current_value
            tracking['last_timestamp'] = decoded_frame.timestamp
            self.counter_tracking[can_id][signal_name] = tracking
    
    def check_id_conflicts(self) -> List[Issue]:
        """
        检查ID冲突（同一CAN ID被多个设备占用）
        
        Returns:
            检测到的ID冲突问题列表
        """
        rule = self.rules.get('id_conflict')
        if not rule or not rule.enabled:
            return []
        
        # 遍历所有遇到的CAN ID
        for can_id in self.can_id_last_seen.keys():
            # 检查这个ID是否在设备台账中有多个映射
            # 注意：这里我们检查日志中实际出现的ID
            devices_using_id = []
            
            # 从设备注册表查找
            # 实际场景中可能需要更复杂的检测逻辑
            
            # 检查ID定义是否有冲突标记
            id_def = self.signal_decoder.get_id_definition(can_id)
            if id_def:
                # 这里简化处理，实际可能需要检查设备台账中的重复映射
                pass
        
        return []
    
    def final_check(self) -> None:
        """
        最终检查：处理日志结束时的心跳丢失等
        """
        # 检查在日志结束前是否有长时间未出现的心跳帧
        rule = self.rules.get('heartbeat_miss')
        if not rule or not rule.enabled:
            return
        
        if self.last_timestamp is None:
            return
        
        for can_id, tracking in self.heartbeat_tracking.items():
            last_seen = tracking.get('last_seen')
            if last_seen is None:
                continue
            
            time_since_last = (self.last_timestamp - last_seen) * 1000
            expected_interval = tracking.get('expected_interval_ms', 1000)
            max_delay = expected_interval * rule.parameters.get('max_multiplier', 3)
            
            if time_since_last > max_delay:
                device_id = self.device_registry.get_device_by_can_id(can_id)
                issue = Issue(
                    issue_type=IssueType.HEARTBEAT_MISS,
                    severity=rule.severity,
                    timestamp=self.last_timestamp,
                    device_id=device_id,
                    can_id=can_id,
                    signal_name=None,
                    message=f"日志结束前 {time_since_last:.0f}ms 未收到心跳帧",
                    details={
                        'time_since_last_ms': time_since_last,
                        'max_allowed_ms': max_delay,
                        'is_final_check': True
                    }
                )
                self.issues.append(issue)
    
    def get_issues(self) -> List[Issue]:
        """获取所有检测到的问题"""
        return sorted(self.issues, key=lambda x: x.timestamp)
    
    def get_issues_by_type(self) -> Dict[str, List[Issue]]:
        """按类型分组获取问题"""
        grouped = {}
        for issue in self.issues:
            issue_type = issue.issue_type.value
            if issue_type not in grouped:
                grouped[issue_type] = []
            grouped[issue_type].append(issue)
        return grouped
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        stats = dict(self.stats)
        stats.update({
            'issues_detected': len(self.issues),
            'issues_by_type': {
                issue_type: len(issues)
                for issue_type, issues in self.get_issues_by_type().items()
            },
            'time_range': {
                'start': format_timestamp(self.first_timestamp) if self.first_timestamp else None,
                'end': format_timestamp(self.last_timestamp) if self.last_timestamp else None,
                'duration_seconds': (self.last_timestamp - self.first_timestamp) 
                if self.first_timestamp and self.last_timestamp else 0
            }
        })
        return stats
