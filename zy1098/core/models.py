from dataclasses import dataclass, field
from datetime import date, datetime
from typing import List, Dict, Optional, Any
from enum import Enum


class ConfidenceLevel(Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class Essay:
    student_name: str
    title: str
    essay_type: str
    score: float
    max_score: float
    date: date
    content: Optional[str] = None
    id: Optional[str] = None
    source_file: Optional[str] = None

    @property
    def score_percentage(self) -> float:
        return (self.score / self.max_score) * 100 if self.max_score > 0 else 0.0


@dataclass
class Feedback:
    student_name: str
    essay_title: Optional[str] = None
    essay_type: Optional[str] = None
    date: Optional[date] = None
    teacher_comment: str = ""
    student_revision: str = ""
    cause_description: str = ""
    score: Optional[float] = None
    id: Optional[str] = None
    source_file: Optional[str] = None


@dataclass
class Mistake:
    student_name: str
    mistake_type: str
    description: str
    location: Optional[str] = None
    essay_title: Optional[str] = None
    essay_type: Optional[str] = None
    date: Optional[date] = None
    severity: str = "medium"
    correction: str = ""
    id: Optional[str] = None
    source_file: Optional[str] = None


@dataclass
class LabeledItem:
    item_id: str
    item_type: str
    student_name: str
    text: str
    labels: List[str] = field(default_factory=list)
    confidence: Dict[str, float] = field(default_factory=dict)
    evidence: List[Dict[str, Any]] = field(default_factory=list)
    explanation: str = ""
    original_item: Any = None


@dataclass
class Cluster:
    cluster_id: str
    label: str
    representative_text: str
    items: List[LabeledItem] = field(default_factory=list)
    similarity_scores: Dict[str, float] = field(default_factory=dict)
    avg_similarity: float = 0.0
    explanation: str = ""


@dataclass
class WeaknessPoint:
    label: str
    student_name: str
    frequency: int
    avg_confidence: float
    impact_score: float
    recent_date: Optional[date]
    priority: int
    evidence: List[Dict[str, Any]] = field(default_factory=list)
    suggestion: str = ""


@dataclass
class Task:
    task_id: str
    student_name: str
    weakness_label: str
    priority: int
    task_description: str
    estimated_time: str
    difficulty: str
    evidence: List[Dict[str, Any]] = field(default_factory=list)
    status: str = "pending"
    deadline: Optional[date] = None


@dataclass
class Report:
    generated_at: datetime
    student_name: Optional[str]
    filters_applied: Dict[str, Any]
    essays_count: int
    feedback_count: int
    mistakes_count: int
    labeled_items: List[LabeledItem]
    clusters: List[Cluster]
    weakness_points: List[WeaknessPoint]
    tasks: List[Task]
    summary: Dict[str, Any] = field(default_factory=dict)
