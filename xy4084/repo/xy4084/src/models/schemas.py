from dataclasses import dataclass, field
from datetime import date, datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class Patient:
    patient_id: str
    name: str
    age: int
    gender: str
    primary_diagnosis: Optional[str] = None
    treatment_plan: Optional[str] = None
    admission_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class TrainingRecord:
    record_id: str
    patient_id: str
    date: date
    training_program: str
    is_completed: bool
    completion_percentage: float
    duration_minutes: int
    difficulty_level: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class PainRecord:
    record_id: str
    patient_id: str
    date: date
    pain_location: str
    pain_score: int
    pain_type: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class MovementRecord:
    record_id: str
    patient_id: str
    date: date
    movement_name: str
    completion_score: float
    form_quality: Optional[float] = None
    range_of_motion: Optional[float] = None
    symmetry_score: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class FollowUpRecord:
    record_id: str
    patient_id: str
    date: date
    therapist_name: str
    follow_up_type: str
    summary: str
    recommendations: Optional[str] = None
    next_follow_up_date: Optional[date] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class SummaryMetrics:
    patient_id: str
    period_start: date
    period_end: date
    total_training_days: int
    completed_training_days: int
    compliance_rate: float
    average_duration_minutes: float
    average_pain_score: float
    pain_score_change: float
    average_movement_score: float
    movement_volatility: float
    missed_days_count: int
    consecutive_missed_days: int
    training_programs: List[str] = field(default_factory=list)
    notes_history: List[Dict[str, Any]] = field(default_factory=list)
    calculated_at: datetime = field(default_factory=datetime.now)


@dataclass
class RiskAssessment:
    patient_id: str
    assessment_date: date
    risk_level: RiskLevel
    risk_factors: List[Dict[str, Any]]
    compliance_risk: bool
    compliance_risk_details: Optional[str] = None
    pain_risk: bool
    pain_risk_details: Optional[str] = None
    movement_risk: bool
    movement_risk_details: Optional[str] = None
    missed_days_risk: bool
    missed_days_risk_details: Optional[str] = None
    overall_score: float = 0.0
    recommendations: List[str] = field(default_factory=list)
    needs_urgent_follow_up: bool = False
    follow_up_priority: str = "normal"
    created_at: datetime = field(default_factory=datetime.now)
