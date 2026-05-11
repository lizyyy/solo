from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict
from enum import Enum


class CallStatus(str, Enum):
    PENDING = "pending"
    SAMPLED = "sampled"
    QC_PASS = "qc_pass"
    QC_FAIL = "qc_fail"


@dataclass
class Agent:
    agent_id: str
    name: str
    team: str
    risk_score: float = 50.0
    historical_avg_score: float = 85.0
    total_qc_calls: int = 0
    last_updated: str = ""


@dataclass
class Call:
    call_id: str
    agent_id: str
    call_time: str
    duration_sec: int
    business_type: str
    is_complaint: bool
    status: CallStatus = CallStatus.PENDING
    sampled_at: Optional[str] = None
    qc_assigned_to: Optional[str] = None
    qc_score: Optional[float] = None
    qc_notes: str = ""
    sampling_reason: str = ""


@dataclass
class QCTask:
    task_id: str
    call_id: str
    agent_id: str
    business_type: str
    is_complaint: bool
    qc_assigned_to: str
    sampling_reason: str
    created_at: str
    completed_at: Optional[str] = None
    score: Optional[float] = None
    result: Optional[str] = None


@dataclass
class QCInspector:
    inspector_id: str
    name: str
    active: bool = True
    current_task_count: int = 0
