"""
规则引擎模块 - 用于丢帧检测、延迟分析和异常检测
"""
from typing import Dict, List, Any, Optional, Callable, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import numpy as np


class AnomalySeverity(Enum):
    """异常严重程度"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AnomalyType(Enum):
    """异常类型"""
    FRAME_LOSS = "frame_loss"
    TIME_DRIFT = "time_drift"
    OUT_OF_ORDER = "out_of_order"
    LATENCY_ABNORMAL = "latency_abnormal"
    INVALID_DATA = "invalid_data"
    STATE_ABNORMAL = "state_abnormal"
    COMMAND_TIMEOUT = "command_timeout"


@dataclass
class Anomaly:
    """异常记录"""
    anomaly_id: str
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    timestamp: float
    description: str
    source: str
    data: Dict[str, Any] = field(default_factory=dict)
    related_frames: List[Any] = field(default_factory=list)


@dataclass
class LatencyInfo:
    """延迟信息"""
    source: str
    destination: str
    latency_seconds: float
    timestamp: float
    related_data: Dict[str, Any] = field(default_factory=dict)


class Rule:
    """规则基类"""
    
    def __init__(self, name: str, description: str = "", 
                 severity: AnomalySeverity = AnomalySeverity.MEDIUM):
        """
        初始化规则
        
        Args:
            name: 规则名称
            description: 规则描述
            severity: 异常严重程度
        """
        self.name = name
        self.description = description
        self.severity = severity
        
    def check(self, data: Dict[str, Any]) -> List[Anomaly]:
        """
        检查数据是否符合规则
        
        Args:
            data: 要检查的数据
            
        Returns:
            异常列表
        """
        raise NotImplementedError("子类必须实现check方法")


class FrameLossRule(Rule):
    """丢帧检测规则"""
    
    def __init__(self, expected_interval: float = 0.01, threshold_multiplier: float = 3.0):
        """
        初始化丢帧检测规则
        
        Args:
            expected_interval: 期望的帧间隔（秒）
            threshold_multiplier: 阈值倍数，超过此倍数的间隔被认为可能丢帧
        """
        super().__init__(
            name="frame_loss_detection",
            description="检测CAN帧丢失，基于时间间隔分析",
            severity=AnomalySeverity.HIGH
        )
        self.expected_interval = expected_interval
        self.threshold_multiplier = threshold_multiplier
        self.previous_frame: Optional[Any] = None
        self.frame_count = 0
        
    def check(self, data: Dict[str, Any]) -> List[Anomaly]:
        """
        检查帧间隔是否异常
        
        Args:
            data: 包含当前帧和上下文的数据字典
            
        Returns:
            异常列表
        """
        anomalies = []
        current_frame = data.get("current_frame")
        
        if current_frame is None:
            return anomalies
        
        self.frame_count += 1
        
        if self.previous_frame is not None:
            # 计算时间间隔
            interval = current_frame.timestamp - self.previous_frame.timestamp
            
            # 检查是否有异常大的间隔
            threshold = self.expected_interval * self.threshold_multiplier
            
            if interval > threshold:
                # 计算可能丢失的帧数
                estimated_lost = int(interval / self.expected_interval) - 1
                
                anomaly = Anomaly(
                    anomaly_id=f"frame_loss_{self.frame_count}",
                    anomaly_type=AnomalyType.FRAME_LOSS,
                    severity=AnomalySeverity.HIGH if estimated_lost > 5 else AnomalySeverity.MEDIUM,
                    timestamp=current_frame.timestamp,
                    description=f"检测到可能丢帧，时间间隔 {interval:.6f}秒，"
                               f"期望间隔 {self.expected_interval:.6f}秒，"
                               f"估计丢失 {estimated_lost} 帧",
                    source=f"CAN_ID_{current_frame.can_id}",
                    data={
                        "interval": interval,
                        "expected_interval": self.expected_interval,
                        "estimated_lost_frames": estimated_lost,
                        "previous_frame_timestamp": self.previous_frame.timestamp,
                        "current_frame_timestamp": current_frame.timestamp
                    },
                    related_frames=[self.previous_frame, current_frame]
                )
                anomalies.append(anomaly)
        
        self.previous_frame = current_frame
        return anomalies


class TimeDriftRule(Rule):
    """时间漂移检测规则"""
    
    def __init__(self, max_acceptable_drift: float = 0.1, drift_rate_threshold: float = 0.001):
        """
        初始化时间漂移检测规则
        
        Args:
            max_acceptable_drift: 最大可接受的绝对漂移（秒）
            drift_rate_threshold: 漂移率阈值（秒/秒）
        """
        super().__init__(
            name="time_drift_detection",
            description="检测时间漂移，基于参考时钟比较",
            severity=AnomalySeverity.MEDIUM
        )
        self.max_acceptable_drift = max_acceptable_drift
        self.drift_rate_threshold = drift_rate_threshold
        self.reference_timestamps: List[float] = []
        self.source_timestamps: Dict[str, List[float]] = defaultdict(list)
        
    def check(self, data: Dict[str, Any]) -> List[Anomaly]:
        """
        检查时间漂移
        
        Args:
            data: 包含时间戳和参考时钟的数据字典
            
        Returns:
            异常列表
        """
        anomalies = []
        
        source_name = data.get("source_name", "unknown")
        current_timestamp = data.get("current_timestamp")
        reference_timestamp = data.get("reference_timestamp")
        
        if current_timestamp is None or reference_timestamp is None:
            return anomalies
        
        # 记录时间戳
        self.source_timestamps[source_name].append(current_timestamp)
        self.reference_timestamps.append(reference_timestamp)
        
        # 需要至少两个点来计算漂移率
        if len(self.reference_timestamps) < 2:
            return anomalies
        
        # 计算当前漂移
        current_drift = current_timestamp - reference_timestamp
        
        # 检查绝对漂移
        if abs(current_drift) > self.max_acceptable_drift:
            severity = AnomalySeverity.CRITICAL if abs(current_drift) > self.max_acceptable_drift * 3 else AnomalySeverity.HIGH
            
            anomaly = Anomaly(
                anomaly_id=f"time_drift_{len(self.reference_timestamps)}",
                anomaly_type=AnomalyType.TIME_DRIFT,
                severity=severity,
                timestamp=reference_timestamp,
                description=f"检测到时间漂移，漂移值 {current_drift:.6f}秒，"
                           f"超过阈值 {self.max_acceptable_drift:.6f}秒",
                source=source_name,
                data={
                    "current_drift": current_drift,
                    "max_acceptable_drift": self.max_acceptable_drift,
                    "current_timestamp": current_timestamp,
                    "reference_timestamp": reference_timestamp
                }
            )
            anomalies.append(anomaly)
        
        # 计算漂移率
        if len(self.reference_timestamps) >= 2:
            ref_duration = self.reference_timestamps[-1] - self.reference_timestamps[0]
            if ref_duration > 0:
                initial_drift = self.source_timestamps[source_name][0] - self.reference_timestamps[0]
                current_drift_rate = (current_drift - initial_drift) / ref_duration
                
                if abs(current_drift_rate) > self.drift_rate_threshold:
                    anomaly = Anomaly(
                        anomaly_id=f"drift_rate_{len(self.reference_timestamps)}",
                        anomaly_type=AnomalyType.TIME_DRIFT,
                        severity=AnomalySeverity.MEDIUM,
                        timestamp=reference_timestamp,
                        description=f"检测到时间漂移率异常，漂移率 {current_drift_rate:.9f}秒/秒，"
                                   f"超过阈值 {self.drift_rate_threshold:.9f}秒/秒",
                        source=source_name,
                        data={
                            "drift_rate": current_drift_rate,
                            "drift_rate_threshold": self.drift_rate_threshold,
                            "time_duration": ref_duration
                        }
                    )
                    anomalies.append(anomaly)
        
        return anomalies


class OutOfOrderRule(Rule):
    """帧顺序检测规则"""
    
    def __init__(self):
        """初始化帧顺序检测规则"""
        super().__init__(
            name="out_of_order_detection",
            description="检测CAN帧顺序异常，时间戳递减",
            severity=AnomalySeverity.HIGH
        )
        self.previous_timestamp: Optional[float] = None
        self.frame_count = 0
        
    def check(self, data: Dict[str, Any]) -> List[Anomaly]:
        """
        检查帧顺序
        
        Args:
            data: 包含当前帧的数据字典
            
        Returns:
            异常列表
        """
        anomalies = []
        current_frame = data.get("current_frame")
        
        if current_frame is None:
            return anomalies
        
        self.frame_count += 1
        
        if self.previous_timestamp is not None:
            if current_frame.timestamp < self.previous_timestamp:
                anomaly = Anomaly(
                    anomaly_id=f"out_of_order_{self.frame_count}",
                    anomaly_type=AnomalyType.OUT_OF_ORDER,
                    severity=AnomalySeverity.HIGH,
                    timestamp=current_frame.timestamp,
                    description=f"检测到帧顺序异常，当前时间戳 {current_frame.timestamp:.6f}秒 "
                               f"小于前一帧时间戳 {self.previous_timestamp:.6f}秒",
                    source=f"CAN_ID_{current_frame.can_id}",
                    data={
                        "current_timestamp": current_frame.timestamp,
                        "previous_timestamp": self.previous_timestamp,
                        "time_diff": current_frame.timestamp - self.previous_timestamp
                    },
                    related_frames=[current_frame]
                )
                anomalies.append(anomaly)
        
        self.previous_timestamp = current_frame.timestamp
        return anomalies


class LatencyAnalysisRule(Rule):
    """延迟分析规则"""
    
    def __init__(self, expected_latency: float = 0.05, max_latency: float = 0.2,
                 latency_jitter_threshold: float = 0.02):
        """
        初始化延迟分析规则
        
        Args:
            expected_latency: 期望延迟（秒）
            max_latency: 最大可接受延迟（秒）
            latency_jitter_threshold: 延迟抖动阈值（秒）
        """
        super().__init__(
            name="latency_analysis",
            description="分析传感器与控制指令之间的延迟",
            severity=AnomalySeverity.MEDIUM
        )
        self.expected_latency = expected_latency
        self.max_latency = max_latency
        self.latency_jitter_threshold = latency_jitter_threshold
        self.latency_history: List[LatencyInfo] = []
        self.sensor_readings: Dict[str, List[Tuple[float, Any]]] = defaultdict(list)
        self.control_commands: Dict[str, List[Tuple[float, Any]]] = defaultdict(list)
        
    def check(self, data: Dict[str, Any]) -> List[Anomaly]:
        """
        检查延迟异常
        
        Args:
            data: 包含传感器读数或控制指令的数据字典
            
        Returns:
            异常列表
        """
        anomalies = []
        
        # 处理传感器读数
        sensor_data = data.get("sensor_data")
        if sensor_data:
            sensor_id = sensor_data.sensor_id
            self.sensor_readings[sensor_id].append(
                (sensor_data.timestamp, sensor_data)
            )
        
        # 处理控制指令
        command_data = data.get("command_data")
        if command_data:
            command_type = command_data.command_type
            self.control_commands[command_type].append(
                (command_data.timestamp, command_data)
            )
            
            # 尝试找到对应的传感器读数来计算延迟
            related_sensor = self._find_related_sensor(command_data)
            if related_sensor:
                latency = command_data.timestamp - related_sensor.timestamp
                self.latency_history.append(LatencyInfo(
                    source=related_sensor.sensor_id,
                    destination=command_data.command_id,
                    latency_seconds=latency,
                    timestamp=command_data.timestamp,
                    related_data={
                        "sensor_data": related_sensor.raw_data,
                        "command_data": command_data.parameters
                    }
                ))
                
                # 检查延迟是否异常
                if latency > self.max_latency:
                    severity = AnomalySeverity.CRITICAL if latency > self.max_latency * 2 else AnomalySeverity.HIGH
                    
                    anomaly = Anomaly(
                        anomaly_id=f"latency_high_{len(self.latency_history)}",
                        anomaly_type=AnomalyType.LATENCY_ABNORMAL,
                        severity=severity,
                        timestamp=command_data.timestamp,
                        description=f"检测到高延迟，延迟 {latency:.6f}秒，"
                                   f"超过最大阈值 {self.max_latency:.6f}秒",
                        source=f"{related_sensor.sensor_id} -> {command_data.command_id}",
                        data={
                            "latency": latency,
                            "max_latency": self.max_latency,
                            "expected_latency": self.expected_latency,
                            "sensor_timestamp": related_sensor.timestamp,
                            "command_timestamp": command_data.timestamp
                        }
                    )
                    anomalies.append(anomaly)
                
                # 检查延迟抖动
                if len(self.latency_history) > 1:
                    recent_latencies = [l.latency_seconds for l in self.latency_history[-5:]]
                    avg_latency = sum(recent_latencies) / len(recent_latencies)
                    jitter = max(recent_latencies) - min(recent_latencies)
                    
                    if jitter > self.latency_jitter_threshold:
                        anomaly = Anomaly(
                            anomaly_id=f"latency_jitter_{len(self.latency_history)}",
                            anomaly_type=AnomalyType.LATENCY_ABNORMAL,
                            severity=AnomalySeverity.MEDIUM,
                            timestamp=command_data.timestamp,
                            description=f"检测到延迟抖动，抖动值 {jitter:.6f}秒，"
                                       f"超过阈值 {self.latency_jitter_threshold:.6f}秒",
                            source=f"{related_sensor.sensor_id} -> {command_data.command_id}",
                            data={
                                "jitter": jitter,
                                "jitter_threshold": self.latency_jitter_threshold,
                                "average_latency": avg_latency,
                                "recent_latencies": recent_latencies
                            }
                        )
                        anomalies.append(anomaly)
        
        return anomalies
    
    def _find_related_sensor(self, command: Any) -> Optional[Any]:
        """
        查找与控制指令相关的最近传感器读数
        
        Args:
            command: 控制指令
            
        Returns:
            相关的传感器读数，如果没有找到则返回None
        """
        # 这是一个简化的匹配逻辑
        # 实际项目中应该根据具体的业务逻辑进行匹配
        
        # 查找在指令时间之前发生的传感器读数
        for sensor_id, readings in self.sensor_readings.items():
            for i in range(len(readings) - 1, -1, -1):
                reading_time, reading = readings[i]
                if reading_time <= command.timestamp:
                    # 检查时间差是否合理（例如，在1秒内）
                    if command.timestamp - reading_time < 1.0:
                        return reading
                    break
        
        return None


class RuleEngine:
    """规则引擎"""
    
    def __init__(self):
        """初始化规则引擎"""
        self.rules: Dict[str, Rule] = {}
        self.anomalies: List[Anomaly] = []
        
        # 默认注册一些常用规则
        self._register_default_rules()
        
    def _register_default_rules(self):
        """注册默认规则"""
        self.register_rule(FrameLossRule())
        self.register_rule(TimeDriftRule())
        self.register_rule(OutOfOrderRule())
        self.register_rule(LatencyAnalysisRule())
        
    def register_rule(self, rule: Rule):
        """
        注册规则
        
        Args:
            rule: 规则实例
        """
        self.rules[rule.name] = rule
        
    def unregister_rule(self, rule_name: str):
        """
        注销规则
        
        Args:
            rule_name: 规则名称
        """
        if rule_name in self.rules:
            del self.rules[rule_name]
            
    def process_data(self, data: Dict[str, Any]) -> List[Anomaly]:
        """
        处理数据，应用所有规则
        
        Args:
            data: 要处理的数据
            
        Returns:
            检测到的异常列表
        """
        new_anomalies = []
        
        for rule_name, rule in self.rules.items():
            try:
                anomalies = rule.check(data)
                new_anomalies.extend(anomalies)
            except Exception as e:
                print(f"规则 {rule_name} 执行出错: {e}")
        
        self.anomalies.extend(new_anomalies)
        return new_anomalies
    
    def get_anomalies_by_type(self, anomaly_type: AnomalyType) -> List[Anomaly]:
        """
        按类型获取异常
        
        Args:
            anomaly_type: 异常类型
            
        Returns:
            匹配的异常列表
        """
        return [a for a in self.anomalies if a.anomaly_type == anomaly_type]
    
    def get_anomalies_by_severity(self, severity: AnomalySeverity) -> List[Anomaly]:
        """
        按严重程度获取异常
        
        Args:
            severity: 严重程度
            
        Returns:
            匹配的异常列表
        """
        return [a for a in self.anomalies if a.severity == severity]
    
    def get_anomalies_in_time_range(self, start_time: float, end_time: float) -> List[Anomaly]:
        """
        获取指定时间范围内的异常
        
        Args:
            start_time: 开始时间
            end_time: 结束时间
            
        Returns:
            匹配的异常列表
        """
        return [
            a for a in self.anomalies
            if start_time <= a.timestamp <= end_time
        ]
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取规则引擎统计信息
        
        Returns:
            统计信息字典
        """
        if not self.anomalies:
            return {
                "total_anomalies": 0,
                "by_type": {},
                "by_severity": {},
                "time_range": None
            }
        
        # 按类型统计
        by_type = defaultdict(int)
        for anomaly in self.anomalies:
            by_type[anomaly.anomaly_type.value] += 1
        
        # 按严重程度统计
        by_severity = defaultdict(int)
        for anomaly in self.anomalies:
            by_severity[anomaly.severity.value] += 1
        
        # 时间范围
        timestamps = [a.timestamp for a in self.anomalies]
        
        return {
            "total_anomalies": len(self.anomalies),
            "by_type": dict(by_type),
            "by_severity": dict(by_severity),
            "time_range": {
                "start": min(timestamps),
                "end": max(timestamps),
                "duration": max(timestamps) - min(timestamps)
            }
        }
    
    def clear_anomalies(self):
        """清除所有异常记录"""
        self.anomalies.clear()
