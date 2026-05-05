from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime


@dataclass
class TimingMeasurement:
    """校表单次测量记录"""
    id: str
    position: str  # 方位：如"12上"、"3上"、"6上"、"9上"、"面上"、"面下"
    rate: float  # 日差（秒/日）
    amplitude: float  # 摆幅（度）
    beat_error: float  # 偏振（毫秒）
    temperature: Optional[float] = None  # 测试温度
    measurement_time: Optional[datetime] = None  # 测量时间
    notes: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'position': self.position,
            'rate': self.rate,
            'amplitude': self.amplitude,
            'beat_error': self.beat_error,
            'temperature': self.temperature,
            'measurement_time': self.measurement_time.isoformat() if self.measurement_time else None,
            'notes': self.notes
        }


@dataclass
class TimingLog:
    """校表仪日志"""
    id: str
    work_order_id: str
    test_date: datetime
    instrument_model: Optional[str] = None  # 校表仪型号
    measurements: List[TimingMeasurement] = field(default_factory=list)
    notes: Optional[str] = None
    
    def get_measurement_by_position(self, position: str) -> Optional[TimingMeasurement]:
        """根据方位获取测量记录"""
        for m in self.measurements:
            if m.position == position:
                return m
        return None
    
    def get_positions(self) -> List[str]:
        """获取所有测试方位"""
        return [m.position for m in self.measurements]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'work_order_id': self.work_order_id,
            'test_date': self.test_date.isoformat() if self.test_date else None,
            'instrument_model': self.instrument_model,
            'measurements': [m.to_dict() for m in self.measurements],
            'notes': self.notes
        }


@dataclass
class ServiceStep:
    """拆洗步骤记录"""
    id: str
    work_order_id: str
    step_number: int  # 步骤序号
    step_name: str  # 步骤名称
    technician: str  # 操作师傅
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: Optional[float] = None  # 耗时（分钟）
    status: str = "pending"  # pending, in_progress, completed, skipped
    notes: Optional[str] = None
    issues_found: List[str] = field(default_factory=list)  # 发现的问题
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'work_order_id': self.work_order_id,
            'step_number': self.step_number,
            'step_name': self.step_name,
            'technician': self.technician,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'duration_minutes': self.duration_minutes,
            'status': self.status,
            'notes': self.notes,
            'issues_found': self.issues_found
        }


@dataclass
class PartReplacement:
    """零件更换记录"""
    id: str
    work_order_id: str
    part_number: str  # 零件编号
    part_name: str  # 零件名称
    quantity: int = 1
    reason: str = ""  # 更换原因
    old_part_condition: Optional[str] = None  # 旧零件状态
    new_part_serial: Optional[str] = None  # 新零件序列号
    replacement_date: Optional[datetime] = None
    technician: Optional[str] = None
    cost: Optional[float] = None  # 零件成本
    notes: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'work_order_id': self.work_order_id,
            'part_number': self.part_number,
            'part_name': self.part_name,
            'quantity': self.quantity,
            'reason': self.reason,
            'old_part_condition': self.old_part_condition,
            'new_part_serial': self.new_part_serial,
            'replacement_date': self.replacement_date.isoformat() if self.replacement_date else None,
            'technician': self.technician,
            'cost': self.cost,
            'notes': self.notes
        }


@dataclass
class WaterproofTest:
    """防水测试记录"""
    id: str
    work_order_id: str
    test_date: datetime
    test_type: str  # 测试类型：dry, wet, pressure
    result: str  # 结果：pass, fail, conditional
    pressure_bar: Optional[float] = None  # 测试压力（巴）
    duration_minutes: Optional[int] = None  # 测试时长（分钟）
    leak_detected: bool = False
    leak_location: Optional[str] = None  # 泄漏位置
    technician: Optional[str] = None
    equipment_model: Optional[str] = None  # 测试设备型号
    notes: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'work_order_id': self.work_order_id,
            'test_date': self.test_date.isoformat() if self.test_date else None,
            'test_type': self.test_type,
            'pressure_bar': self.pressure_bar,
            'duration_minutes': self.duration_minutes,
            'result': self.result,
            'leak_detected': self.leak_detected,
            'leak_location': self.leak_location,
            'technician': self.technician,
            'equipment_model': self.equipment_model,
            'notes': self.notes
        }


@dataclass
class WatchReviewConclusion:
    """钟表维修人工复核结论"""
    id: str
    work_order_id: str
    reviewer: str  # 复核人
    review_date: datetime
    overall_status: str  # 整体状态：excellent, good, fair, poor
    rate_assessment: str  # 日差评估：normal, slightly_fast, slightly_slow, significant_issue
    amplitude_assessment: str  # 摆幅评估：normal, low, very_low, inconsistent
    position_variation_assessment: str  # 位差评估：normal, moderate, significant
    waterproof_assessment: str  # 防水评估：pass, fail, not_tested
    root_causes: List[str] = field(default_factory=list)  # 根本原因
    recommendations: List[str] = field(default_factory=list)  # 建议
    rework_needed: bool = False
    rework_reason: Optional[str] = None
    estimated_return_days: Optional[int] = None  # 预计返修天数
    notes: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'work_order_id': self.work_order_id,
            'reviewer': self.reviewer,
            'review_date': self.review_date.isoformat() if self.review_date else None,
            'overall_status': self.overall_status,
            'rate_assessment': self.rate_assessment,
            'amplitude_assessment': self.amplitude_assessment,
            'position_variation_assessment': self.position_variation_assessment,
            'waterproof_assessment': self.waterproof_assessment,
            'root_causes': self.root_causes,
            'recommendations': self.recommendations,
            'rework_needed': self.rework_needed,
            'rework_reason': self.rework_reason,
            'estimated_return_days': self.estimated_return_days,
            'notes': self.notes
        }


@dataclass
class RateDriftAnalysis:
    """日差漂移分析"""
    id: str
    work_order_id: str
    position: str
    initial_rate: float  # 初始日差
    final_rate: float  # 最终日差
    drift_amount: float  # 漂移量
    drift_direction: str  # 漂移方向：positive, negative, stable
    drift_severity: str  # 漂移严重程度：normal, mild, moderate, severe
    drift_rate_per_hour: Optional[float] = None  # 每小时漂移率
    time_elapsed_hours: Optional[float] = None  # 经过时间（小时）
    is_concerning: bool = False
    possible_causes: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'work_order_id': self.work_order_id,
            'position': self.position,
            'initial_rate': self.initial_rate,
            'final_rate': self.final_rate,
            'drift_amount': self.drift_amount,
            'drift_direction': self.drift_direction,
            'drift_severity': self.drift_severity,
            'drift_rate_per_hour': self.drift_rate_per_hour,
            'time_elapsed_hours': self.time_elapsed_hours,
            'is_concerning': self.is_concerning,
            'possible_causes': self.possible_causes
        }


@dataclass
class AmplitudeAnomaly:
    """摆幅异常"""
    id: str
    work_order_id: str
    position: str
    measured_amplitude: float
    expected_min: float
    expected_max: float
    deviation: float
    deviation_percent: float
    anomaly_type: str  # 异常类型：too_low, too_high, inconsistent
    severity: str  # 严重程度：mild, moderate, severe
    is_concerning: bool = True
    possible_causes: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'work_order_id': self.work_order_id,
            'position': self.position,
            'measured_amplitude': self.measured_amplitude,
            'expected_min': self.expected_min,
            'expected_max': self.expected_max,
            'deviation': self.deviation,
            'deviation_percent': self.deviation_percent,
            'anomaly_type': self.anomaly_type,
            'severity': self.severity,
            'is_concerning': self.is_concerning,
            'possible_causes': self.possible_causes,
            'recommendations': self.recommendations
        }


@dataclass
class PositionVariation:
    """位差波动分析"""
    id: str
    work_order_id: str
    metric_type: str  # 指标类型：rate, amplitude, beat_error
    positions: List[str] = field(default_factory=list)
    values: Dict[str, float] = field(default_factory=dict)
    min_value: float = 0.0
    max_value: float = 0.0
    range_value: float = 0.0  # 极差
    average_value: float = 0.0
    standard_deviation: float = 0.0
    variation_severity: str = "normal"  # normal, mild, moderate, severe
    is_concerning: bool = False
    worst_position: Optional[str] = None
    best_position: Optional[str] = None
    possible_causes: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'work_order_id': self.work_order_id,
            'metric_type': self.metric_type,
            'positions': self.positions,
            'values': self.values,
            'min_value': self.min_value,
            'max_value': self.max_value,
            'range_value': self.range_value,
            'average_value': self.average_value,
            'standard_deviation': self.standard_deviation,
            'variation_severity': self.variation_severity,
            'is_concerning': self.is_concerning,
            'worst_position': self.worst_position,
            'best_position': self.best_position,
            'possible_causes': self.possible_causes
        }


@dataclass
class ReworkRiskAssessment:
    """返修风险评估"""
    id: str
    work_order_id: str
    overall_risk_level: str  # low, medium, high, critical
    risk_score: float  # 风险分数 0-100
    probability_of_rework: float  # 返修概率 0-1
    risk_factors: List[Dict[str, Any]] = field(default_factory=list)
    contributing_issues: List[str] = field(default_factory=list)
    estimated_rework_cost: Optional[float] = None
    estimated_rework_hours: Optional[float] = None
    recommended_actions: List[str] = field(default_factory=list)
    priority_level: str = "normal"  # low, normal, high, urgent
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'work_order_id': self.work_order_id,
            'overall_risk_level': self.overall_risk_level,
            'risk_score': self.risk_score,
            'risk_factors': self.risk_factors,
            'contributing_issues': self.contributing_issues,
            'probability_of_rework': self.probability_of_rework,
            'estimated_rework_cost': self.estimated_rework_cost,
            'estimated_rework_hours': self.estimated_rework_hours,
            'recommended_actions': self.recommended_actions,
            'priority_level': self.priority_level
        }


@dataclass
class WatchAnalysisResult:
    """钟表维修综合分析结果"""
    work_order_id: str
    
    rate_drifts: List[RateDriftAnalysis] = field(default_factory=list)
    amplitude_anomalies: List[AmplitudeAnomaly] = field(default_factory=list)
    position_variations: List[PositionVariation] = field(default_factory=list)
    rework_risk: Optional[ReworkRiskAssessment] = None
    
    summary: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'work_order_id': self.work_order_id,
            'rate_drifts': [rd.to_dict() for rd in self.rate_drifts],
            'amplitude_anomalies': [aa.to_dict() for aa in self.amplitude_anomalies],
            'position_variations': [pv.to_dict() for pv in self.position_variations],
            'rework_risk': self.rework_risk.to_dict() if self.rework_risk else None,
            'summary': self.summary
        }


@dataclass
class WorkOrder:
    """工单信息"""
    id: str
    work_order_number: str  # 工单号
    customer_name: str
    watch_brand: str
    watch_model: str
    movement_type: str  # 机芯类型：mechanical, quartz, automatic
    received_date: datetime
    movement_model: Optional[str] = None  # 机芯型号
    serial_number: Optional[str] = None
    due_date: Optional[datetime] = None  # 客户取表期限
    status: str = "received"  # received, in_service, testing, ready, delivered
    
    timing_logs: List[TimingLog] = field(default_factory=list)
    service_steps: List[ServiceStep] = field(default_factory=list)
    part_replacements: List[PartReplacement] = field(default_factory=list)
    waterproof_tests: List[WaterproofTest] = field(default_factory=list)
    review_conclusions: List[WatchReviewConclusion] = field(default_factory=list)
    analysis_results: List[WatchAnalysisResult] = field(default_factory=list)
    
    service_type: Optional[str] = None  # 服务类型：full_service, partial_service, repair_only
    initial_complaints: List[str] = field(default_factory=list)  # 客户初始投诉
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    notes: Optional[str] = None
    
    def get_latest_timing_log(self) -> Optional[TimingLog]:
        """获取最新的校表仪日志"""
        if not self.timing_logs:
            return None
        return max(self.timing_logs, key=lambda x: x.test_date)
    
    def get_completed_steps(self) -> List[ServiceStep]:
        """获取已完成的步骤"""
        return [s for s in self.service_steps if s.status == "completed"]
    
    def get_replacements_by_part(self, part_number: str) -> List[PartReplacement]:
        """根据零件编号获取更换记录"""
        return [p for p in self.part_replacements if p.part_number == part_number]
    
    def get_latest_waterproof_test(self) -> Optional[WaterproofTest]:
        """获取最新的防水测试"""
        if not self.waterproof_tests:
            return None
        return max(self.waterproof_tests, key=lambda x: x.test_date)
    
    def get_latest_review(self) -> Optional[WatchReviewConclusion]:
        """获取最新的复核结论"""
        if not self.review_conclusions:
            return None
        return max(self.review_conclusions, key=lambda x: x.review_date)
    
    def is_overdue(self) -> bool:
        """检查是否逾期"""
        if not self.due_date:
            return False
        return datetime.now() > self.due_date
    
    def days_until_due(self) -> Optional[int]:
        """距离到期日的天数"""
        if not self.due_date:
            return None
        delta = self.due_date - datetime.now()
        return max(0, delta.days)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'work_order_number': self.work_order_number,
            'customer_name': self.customer_name,
            'watch_brand': self.watch_brand,
            'watch_model': self.watch_model,
            'movement_type': self.movement_type,
            'movement_model': self.movement_model,
            'serial_number': self.serial_number,
            'received_date': self.received_date.isoformat() if self.received_date else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'status': self.status,
            'timing_logs': [tl.to_dict() for tl in self.timing_logs],
            'service_steps': [ss.to_dict() for ss in self.service_steps],
            'part_replacements': [pr.to_dict() for pr in self.part_replacements],
            'waterproof_tests': [wt.to_dict() for wt in self.waterproof_tests],
            'review_conclusions': [rc.to_dict() for rc in self.review_conclusions],
            'analysis_results': [ar.to_dict() for ar in self.analysis_results],
            'service_type': self.service_type,
            'initial_complaints': self.initial_complaints,
            'estimated_cost': self.estimated_cost,
            'actual_cost': self.actual_cost,
            'notes': self.notes
        }
