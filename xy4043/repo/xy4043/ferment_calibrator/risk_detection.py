"""
风险规则模块 - 检测污染、传感器失准、补料记录缺失等风险
"""
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class RiskType(Enum):
    """风险类型枚举"""
    CONTAMINATION = "contamination"
    SENSOR_MISALIGNMENT = "sensor_misalignment"
    FEED_MISSING = "feed_missing"
    ABNORMAL_PH = "abnormal_ph"
    ABNORMAL_TEMPERATURE = "abnormal_temperature"
    ABNORMAL_DO = "abnormal_do"
    RAPID_PH_CHANGE = "rapid_ph_change"


class RiskSeverity(Enum):
    """风险严重程度"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class RiskEvent:
    """风险事件"""
    risk_id: str
    risk_type: RiskType
    severity: RiskSeverity
    description: str
    detected_time: datetime
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    confidence: float = 1.0
    evidence: Optional[Dict[str, Any]] = None
    review_status: str = "pending"
    review_comment: Optional[str] = None


class RiskDetector:
    """风险检测器"""
    
    def __init__(self, config: Any = None):
        self.config = config
        self._load_thresholds()
    
    def _load_thresholds(self) -> None:
        """从配置加载阈值"""
        self.thresholds = {
            "contamination": {
                "ph_drop_threshold": 0.3,
                "od_spike_multiplier": 2.0,
                "temperature_spike_threshold": 1.5
            },
            "sensor_misalignment": {
                "drift_exceeds_threshold": 0.5,
                "constant_reading_duration_hours": 4.0
            },
            "feed_missing": {
                "expected_feed_interval_hours": 4.0,
                "tolerance_hours": 1.0
            },
            "anomaly": {
                "ph_max_change_per_minute": 0.1,
                "temp_max_change_per_minute": 2.0,
                "do_max_change_per_minute": 10.0
            }
        }
        
        if self.config:
            try:
                risk_config = self.config.get_risk_rules("contamination")
                if risk_config:
                    self.thresholds["contamination"].update(risk_config)
                
                sensor_config = self.config.get_risk_rules("sensor_misalignment")
                if sensor_config:
                    self.thresholds["sensor_misalignment"].update(sensor_config)
                
                feed_config = self.config.get_risk_rules("feed_missing")
                if feed_config:
                    self.thresholds["feed_missing"].update(feed_config)
            except Exception:
                pass
    
    def detect_all_risks(
        self,
        merged_data: List[Dict[str, Any]],
        feed_events: List[Dict[str, Any]],
        phase_segments: List[Dict[str, Any]],
        metrics: Dict[str, Any]
    ) -> List[RiskEvent]:
        """
        检测所有风险
        
        Args:
            merged_data: 合并后的校准数据
            feed_events: 补料事件列表
            phase_segments: 阶段切分结果
            metrics: 计算的指标
            
        Returns:
            风险事件列表
        """
        risks: List[RiskEvent] = []
        
        risks.extend(self._detect_contamination(merged_data, metrics))
        
        risks.extend(self._detect_sensor_misalignment(merged_data))
        
        risks.extend(self._detect_feed_missing(merged_data, feed_events))
        
        risks.extend(self._detect_rapid_ph_change(merged_data))
        
        risks.extend(self._detect_abnormal_do(merged_data))
        
        risks.extend(self._detect_abnormal_temperature(merged_data))
        
        return risks
    
    def _detect_contamination(
        self,
        merged_data: List[Dict[str, Any]],
        metrics: Dict[str, Any]
    ) -> List[RiskEvent]:
        """
        检测污染风险
        
        污染迹象：
        1. 快速的pH下降（产酸菌污染）
        2. 异常的OD增长
        3. 温度异常升高
        
        Args:
            merged_data: 合并后的数据
            metrics: 指标数据
            
        Returns:
            风险事件列表
        """
        risks: List[RiskEvent] = []
        
        thresholds = self.thresholds["contamination"]
        ph_drop_threshold = thresholds.get("ph_drop_threshold", 0.3)
        
        ph_data = [
            (p["datetime"], p["ph"])
            for p in merged_data
            if p.get("ph") is not None
        ]
        
        if len(ph_data) >= 2:
            for i in range(1, len(ph_data)):
                time_prev, ph_prev = ph_data[i-1]
                time_curr, ph_curr = ph_data[i]
                
                dt_hours = (time_curr - time_prev).total_seconds() / 3600
                
                if dt_hours > 0:
                    ph_drop = ph_prev - ph_curr
                    drop_rate = ph_drop / dt_hours
                    
                    if ph_drop >= ph_drop_threshold and drop_rate > 0.1:
                        confidence = min(1.0, ph_drop / (ph_drop_threshold * 2))
                        
                        severity = RiskSeverity.MEDIUM
                        if ph_drop >= ph_drop_threshold * 2:
                            severity = RiskSeverity.HIGH
                        if ph_drop >= ph_drop_threshold * 3:
                            severity = RiskSeverity.CRITICAL
                        
                        risk = RiskEvent(
                            risk_id=f"contam_ph_{time_curr.strftime('%Y%m%d%H%M%S')}",
                            risk_type=RiskType.CONTAMINATION,
                            severity=severity,
                            description=f"检测到快速pH下降：{ph_prev:.2f} -> {ph_curr:.2f}，下降速率: {drop_rate:.3f}/小时",
                            detected_time=datetime.now(),
                            start_time=time_prev,
                            end_time=time_curr,
                            confidence=confidence,
                            evidence={
                                "ph_before": ph_prev,
                                "ph_after": ph_curr,
                                "ph_drop": ph_drop,
                                "drop_rate_per_hour": drop_rate,
                                "duration_hours": dt_hours
                            }
                        )
                        risks.append(risk)
        
        od_data = [
            (p["datetime"], p["od600"])
            for p in merged_data
            if p.get("od600") is not None and p["od600"] > 0
        ]
        
        od_spike_multiplier = thresholds.get("od_spike_multiplier", 2.0)
        
        if len(od_data) >= 3:
            for i in range(2, len(od_data)):
                od_prev_prev = od_data[i-2][1]
                od_prev = od_data[i-1][1]
                od_curr = od_data[i][1]
                
                expected_growth = (od_prev - od_prev_prev) * 1.5
                actual_growth = od_curr - od_prev
                
                if actual_growth > od_spike_multiplier * expected_growth and actual_growth > 0.5:
                    time_curr = od_data[i][0]
                    
                    risk = RiskEvent(
                        risk_id=f"contam_od_{time_curr.strftime('%Y%m%d%H%M%S')}",
                        risk_type=RiskType.CONTAMINATION,
                        severity=RiskSeverity.HIGH,
                        description=f"检测到异常OD增长：{od_prev:.2f} -> {od_curr:.2f}，增长异常快速",
                        detected_time=datetime.now(),
                        start_time=od_data[i-1][0],
                        end_time=time_curr,
                        confidence=0.8,
                        evidence={
                            "od_before": od_prev,
                            "od_after": od_curr,
                            "od_growth": actual_growth,
                            "expected_growth": expected_growth
                        }
                    )
                    risks.append(risk)
        
        temp_spike_threshold = thresholds.get("temperature_spike_threshold", 1.5)
        temp_data = [
            (p["datetime"], p["temperature"])
            for p in merged_data
            if p.get("temperature") is not None
        ]
        
        if len(temp_data) >= 2:
            for i in range(1, len(temp_data)):
                time_prev, temp_prev = temp_data[i-1]
                time_curr, temp_curr = temp_data[i]
                
                dt_hours = (time_curr - time_prev).total_seconds() / 3600
                
                if dt_hours > 0:
                    temp_rise = temp_curr - temp_prev
                    
                    if temp_rise >= temp_spike_threshold:
                        severity = RiskSeverity.MEDIUM
                        if temp_rise >= temp_spike_threshold * 1.5:
                            severity = RiskSeverity.HIGH
                        
                        risk = RiskEvent(
                            risk_id=f"contam_temp_{time_curr.strftime('%Y%m%d%H%M%S')}",
                            risk_type=RiskType.CONTAMINATION,
                            severity=severity,
                            description=f"检测到异常温度升高：{temp_prev:.1f} -> {temp_curr:.1f}°C",
                            detected_time=datetime.now(),
                            start_time=time_prev,
                            end_time=time_curr,
                            confidence=0.7,
                            evidence={
                                "temp_before": temp_prev,
                                "temp_after": temp_curr,
                                "temp_rise": temp_rise,
                                "duration_hours": dt_hours
                            }
                        )
                        risks.append(risk)
        
        return risks
    
    def _detect_sensor_misalignment(
        self,
        merged_data: List[Dict[str, Any]]
    ) -> List[RiskEvent]:
        """
        检测传感器失准风险
        
        失准迹象：
        1. 长时间恒定读数（传感器卡住）
        2. 超出正常范围的读数
        3. 异常的漂移
        
        Args:
            merged_data: 合并后的数据
            
        Returns:
            风险事件列表
        """
        risks: List[RiskEvent] = []
        
        thresholds = self.thresholds["sensor_misalignment"]
        constant_duration_threshold = thresholds.get("constant_reading_duration_hours", 4.0)
        
        for sensor_name, field_name in [
            ("pH", "ph"),
            ("温度", "temperature"),
            ("溶氧", "dissolved_oxygen")
        ]:
            sensor_data = [
                (p["datetime"], p[field_name])
                for p in merged_data
                if p.get(field_name) is not None
            ]
            
            if len(sensor_data) < 3:
                continue
            
            i = 0
            while i < len(sensor_data) - 1:
                start_time, start_value = sensor_data[i]
                j = i + 1
                
                while j < len(sensor_data):
                    _, curr_value = sensor_data[j]
                    
                    if abs(curr_value - start_value) > 0.01:
                        break
                    j += 1
                
                if j > i + 1:
                    end_time, end_value = sensor_data[j - 1]
                    duration_hours = (end_time - start_time).total_seconds() / 3600
                    
                    if duration_hours >= constant_duration_threshold:
                        severity = RiskSeverity.MEDIUM
                        if duration_hours >= constant_duration_threshold * 2:
                            severity = RiskSeverity.HIGH
                        
                        risk = RiskEvent(
                            risk_id=f"sensor_{field_name}_{start_time.strftime('%Y%m%d%H%M%S')}",
                            risk_type=RiskType.SENSOR_MISALIGNMENT,
                            severity=severity,
                            description=f"{sensor_name}传感器读数恒定{duration_hours:.1f}小时，可能存在传感器卡住或失准",
                            detected_time=datetime.now(),
                            start_time=start_time,
                            end_time=end_time,
                            confidence=0.9,
                            evidence={
                                "sensor_type": sensor_name,
                                "constant_value": start_value,
                                "duration_hours": duration_hours
                            }
                        )
                        risks.append(risk)
                
                i = j
        
        return risks
    
    def _detect_feed_missing(
        self,
        merged_data: List[Dict[str, Any]],
        feed_events: List[Dict[str, Any]]
    ) -> List[RiskEvent]:
        """
        检测补料记录缺失风险
        
        Args:
            merged_data: 合并后的数据
            feed_events: 补料事件列表
            
        Returns:
            风险事件列表
        """
        risks: List[RiskEvent] = []
        
        if not merged_data:
            return risks
        
        thresholds = self.thresholds["feed_missing"]
        expected_interval = thresholds.get("expected_feed_interval_hours", 4.0)
        tolerance = thresholds.get("tolerance_hours", 1.0)
        
        if not feed_events:
            start_time = merged_data[0]["datetime"]
            end_time = merged_data[-1]["datetime"]
            duration_hours = (end_time - start_time).total_seconds() / 3600
            
            if duration_hours > expected_interval + tolerance:
                risk = RiskEvent(
                    risk_id=f"feed_missing_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    risk_type=RiskType.FEED_MISSING,
                    severity=RiskSeverity.HIGH,
                    description=f"实验持续{duration_hours:.1f}小时，但未检测到任何补料记录",
                    detected_time=datetime.now(),
                    start_time=start_time,
                    end_time=end_time,
                    confidence=0.8,
                    evidence={
                        "experiment_duration_hours": duration_hours,
                        "expected_feed_interval_hours": expected_interval,
                        "feed_events_count": 0
                    }
                )
                risks.append(risk)
            
            return risks
        
        feed_times = [
            datetime.fromisoformat(feed["time"])
            for feed in feed_events
        ]
        feed_times.sort()
        
        start_time = merged_data[0]["datetime"]
        first_feed_time = feed_times[0]
        
        time_to_first_feed = (first_feed_time - start_time).total_seconds() / 3600
        
        if time_to_first_feed > expected_interval * 1.5 + tolerance:
            risk = RiskEvent(
                risk_id=f"feed_missing_first_{first_feed_time.strftime('%Y%m%d%H%M%S')}",
                risk_type=RiskType.FEED_MISSING,
                severity=RiskSeverity.MEDIUM,
                description=f"首次补料延迟：实验开始后{time_to_first_feed:.1f}小时才进行首次补料",
                detected_time=datetime.now(),
                start_time=start_time,
                end_time=first_feed_time,
                confidence=0.7,
                evidence={
                    "time_to_first_feed_hours": time_to_first_feed,
                    "expected_interval_hours": expected_interval
                }
            )
            risks.append(risk)
        
        for i in range(1, len(feed_times)):
            interval = (feed_times[i] - feed_times[i-1]).total_seconds() / 3600
            
            if interval > expected_interval + tolerance:
                severity = RiskSeverity.MEDIUM
                if interval > expected_interval * 2:
                    severity = RiskSeverity.HIGH
                
                risk = RiskEvent(
                    risk_id=f"feed_missing_interval_{feed_times[i].strftime('%Y%m%d%H%M%S')}",
                    risk_type=RiskType.FEED_MISSING,
                    severity=severity,
                    description=f"补料间隔异常：{interval:.1f}小时，预期约{expected_interval}小时",
                    detected_time=datetime.now(),
                    start_time=feed_times[i-1],
                    end_time=feed_times[i],
                    confidence=0.8,
                    evidence={
                        "actual_interval_hours": interval,
                        "expected_interval_hours": expected_interval
                    }
                )
                risks.append(risk)
        
        last_feed_time = feed_times[-1]
        end_time = merged_data[-1]["datetime"]
        time_since_last_feed = (end_time - last_feed_time).total_seconds() / 3600
        
        if time_since_last_feed > expected_interval + tolerance:
            risk = RiskEvent(
                risk_id=f"feed_missing_end_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                risk_type=RiskType.FEED_MISSING,
                severity=RiskSeverity.MEDIUM,
                description=f"最后一次补料后{time_since_last_feed:.1f}小时实验结束，可能存在补料记录缺失",
                detected_time=datetime.now(),
                start_time=last_feed_time,
                end_time=end_time,
                confidence=0.6,
                evidence={
                    "time_since_last_feed_hours": time_since_last_feed,
                    "expected_interval_hours": expected_interval
                }
            )
            risks.append(risk)
        
        return risks
    
    def _detect_rapid_ph_change(
        self,
        merged_data: List[Dict[str, Any]]
    ) -> List[RiskEvent]:
        """
        检测快速pH变化
        
        Args:
            merged_data: 合并后的数据
            
        Returns:
            风险事件列表
        """
        risks: List[RiskEvent] = []
        
        thresholds = self.thresholds["anomaly"]
        max_change_per_minute = thresholds.get("ph_max_change_per_minute", 0.1)
        
        ph_data = [
            (p["datetime"], p["ph"])
            for p in merged_data
            if p.get("ph") is not None
        ]
        
        if len(ph_data) < 2:
            return risks
        
        for i in range(1, len(ph_data)):
            time_prev, ph_prev = ph_data[i-1]
            time_curr, ph_curr = ph_data[i]
            
            dt_minutes = (time_curr - time_prev).total_seconds() / 60
            
            if dt_minutes > 0:
                change = abs(ph_curr - ph_prev)
                change_per_minute = change / dt_minutes
                
                if change_per_minute > max_change_per_minute:
                    severity = RiskSeverity.LOW
                    if change_per_minute > max_change_per_minute * 2:
                        severity = RiskSeverity.MEDIUM
                    if change_per_minute > max_change_per_minute * 5:
                        severity = RiskSeverity.HIGH
                    
                    risk = RiskEvent(
                        risk_id=f"ph_rapid_{time_curr.strftime('%Y%m%d%H%M%S')}",
                        risk_type=RiskType.RAPID_PH_CHANGE,
                        severity=severity,
                        description=f"检测到快速pH变化：变化率{change_per_minute:.3f}/分钟，超过阈值{max_change_per_minute}",
                        detected_time=datetime.now(),
                        start_time=time_prev,
                        end_time=time_curr,
                        confidence=0.9,
                        evidence={
                            "ph_before": ph_prev,
                            "ph_after": ph_curr,
                            "ph_change": change,
                            "change_per_minute": change_per_minute,
                            "duration_minutes": dt_minutes
                        }
                    )
                    risks.append(risk)
        
        return risks
    
    def _detect_abnormal_do(
        self,
        merged_data: List[Dict[str, Any]]
    ) -> List[RiskEvent]:
        """
        检测异常溶氧
        
        Args:
            merged_data: 合并后的数据
            
        Returns:
            风险事件列表
        """
        risks: List[RiskEvent] = []
        
        do_data = [
            (p["datetime"], p["dissolved_oxygen"])
            for p in merged_data
            if p.get("dissolved_oxygen") is not None
        ]
        
        if not do_data:
            return risks
        
        do_values = [do for _, do in do_data]
        mean_do = np.mean(do_values)
        std_do = np.std(do_values)
        
        if mean_do < 10:
            risk = RiskEvent(
                risk_id=f"do_low_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                risk_type=RiskType.ABNORMAL_DO,
                severity=RiskSeverity.MEDIUM,
                description=f"整体溶氧偏低：平均{mean_do:.1f}%",
                detected_time=datetime.now(),
                confidence=0.7,
                evidence={
                    "mean_do": mean_do,
                    "std_do": std_do
                }
            )
            risks.append(risk)
        
        if std_do > 30:
            risk = RiskEvent(
                risk_id=f"do_variable_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                risk_type=RiskType.ABNORMAL_DO,
                severity=RiskSeverity.MEDIUM,
                description=f"溶氧波动较大：标准差{std_do:.1f}%",
                detected_time=datetime.now(),
                confidence=0.6,
                evidence={
                    "mean_do": mean_do,
                    "std_do": std_do
                }
            )
            risks.append(risk)
        
        return risks
    
    def _detect_abnormal_temperature(
        self,
        merged_data: List[Dict[str, Any]]
    ) -> List[RiskEvent]:
        """
        检测异常温度
        
        Args:
            merged_data: 合并后的数据
            
        Returns:
            风险事件列表
        """
        risks: List[RiskEvent] = []
        
        temp_data = [
            (p["datetime"], p["temperature"])
            for p in merged_data
            if p.get("temperature") is not None
        ]
        
        if not temp_data:
            return risks
        
        temp_values = [temp for _, temp in temp_data]
        mean_temp = np.mean(temp_values)
        std_temp = np.std(temp_values)
        min_temp = min(temp_values)
        max_temp = max(temp_values)
        
        if std_temp > 1.0:
            severity = RiskSeverity.LOW
            if std_temp > 2.0:
                severity = RiskSeverity.MEDIUM
            if std_temp > 3.0:
                severity = RiskSeverity.HIGH
            
            risk = RiskEvent(
                risk_id=f"temp_variable_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                risk_type=RiskType.ABNORMAL_TEMPERATURE,
                severity=severity,
                description=f"温度波动较大：范围{min_temp:.1f}-{max_temp:.1f}°C，标准差{std_temp:.2f}°C",
                detected_time=datetime.now(),
                confidence=0.8,
                evidence={
                    "mean_temp": mean_temp,
                    "min_temp": min_temp,
                    "max_temp": max_temp,
                    "std_temp": std_temp
                }
            )
            risks.append(risk)
        
        return risks


def detect_risks(
    calibration_result: Dict[str, Any],
    phase_result: Dict[str, Any],
    metrics_result: Dict[str, Any],
    config: Any = None
) -> Dict[str, Any]:
    """
    风险检测的主函数
    
    Args:
        calibration_result: 校准结果
        phase_result: 阶段切分结果
        metrics_result: 指标计算结果
        config: 配置对象
        
    Returns:
        包含风险检测结果的字典
    """
    if "error" in calibration_result:
        return calibration_result
    
    merged_data = calibration_result.get("merged_data", [])
    feed_events = calibration_result.get("feed_events", [])
    phase_segments = phase_result.get("segments", [])
    
    if not merged_data:
        return {"error": "没有数据进行风险检测"}
    
    detector = RiskDetector(config)
    risks = detector.detect_all_risks(merged_data, feed_events, phase_segments, metrics_result)
    
    risks_by_type: Dict[str, List[Dict[str, Any]]] = {}
    risks_by_severity: Dict[str, List[Dict[str, Any]]] = {}
    
    for risk in risks:
        risk_dict = {
            "risk_id": risk.risk_id,
            "risk_type": risk.risk_type.value,
            "severity": risk.severity.value,
            "description": risk.description,
            "detected_time": risk.detected_time.isoformat(),
            "start_time": risk.start_time.isoformat() if risk.start_time else None,
            "end_time": risk.end_time.isoformat() if risk.end_time else None,
            "confidence": risk.confidence,
            "evidence": risk.evidence,
            "review_status": risk.review_status,
            "review_comment": risk.review_comment
        }
        
        risk_type = risk.risk_type.value
        if risk_type not in risks_by_type:
            risks_by_type[risk_type] = []
        risks_by_type[risk_type].append(risk_dict)
        
        severity = risk.severity.value
        if severity not in risks_by_severity:
            risks_by_severity[severity] = []
        risks_by_severity[severity].append(risk_dict)
    
    return {
        "risks": [
            {
                "risk_id": r.risk_id,
                "risk_type": r.risk_type.value,
                "severity": r.severity.value,
                "description": r.description,
                "detected_time": r.detected_time.isoformat(),
                "start_time": r.start_time.isoformat() if r.start_time else None,
                "end_time": r.end_time.isoformat() if r.end_time else None,
                "confidence": r.confidence,
                "evidence": r.evidence,
                "review_status": r.review_status,
                "review_comment": r.review_comment
            }
            for r in risks
        ],
        "summary": {
            "total_risks": len(risks),
            "by_type": {k: len(v) for k, v in risks_by_type.items()},
            "by_severity": {k: len(v) for k, v in risks_by_severity.items()}
        },
        "risks_by_type": risks_by_type,
        "risks_by_severity": risks_by_severity
    }
