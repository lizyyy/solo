"""多臂老虎机预算分流 - 数据模型"""
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any
from datetime import datetime
import uuid


@dataclass
class RecallCandidate:
    """召回候选表条目"""
    candidate_id: str
    strategy_name: str
    arm_id: str
    impression: int
    click: int
    ctr: float
    cost: float
    budget_utilization: float
    time_window_start: str
    time_window_end: str
    metrics: Dict[str, Any] = field(default_factory=dict)
    is_anomaly: bool = False
    anomaly_tags: List[str] = field(default_factory=list)
    anomaly_notes: str = ""


@dataclass
class ParamsConfig:
    """参数YAML配置"""
    version: str
    time_window_size_hours: int
    min_impression_threshold: int
    ctr_significance_threshold: float
    cost_ceiling: float
    budget_allocation: Dict[str, float]
    anomaly_detection_rules: List[Dict[str, Any]]
    owner: str = "推荐策略老唐"


@dataclass
class AuditRecord:
    """复核记录"""
    record_id: str
    timestamp: str
    operator: str
    action: str
    target_type: str
    target_id: str
    change_summary: str
    reason: str
    impacted_results: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AnomalySample:
    """异常样本"""
    sample_id: str
    candidate_id: str
    candidate: Optional[RecallCandidate] = None
    detected_at: str = ""
    anomaly_type: str = ""
    severity: str = "medium"
    reason_description: str = ""
    missing_materials: List[str] = field(default_factory=list)
    next_step_owner: str = ""
    next_step_action: str = ""
    is_verified: bool = False
    verified_by: str = ""
    verified_at: str = ""
    correction_notes: str = ""
    correction_history: List[Dict[str, Any]] = field(default_factory=list)
    params_snapshot: Optional[Dict[str, Any]] = None


def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:8]}"


def current_timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
