from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid
from datetime import datetime


class AngleUnit(Enum):
    DEGREE = "degree"
    RADIAN = "radian"
    ARCMINUTE = "arcminute"


class SourceType(Enum):
    STUDENT_INPUT = "student_input"
    CALCULATED = "calculated"
    REFERENCE = "reference"
    MEASURED = "measured"


@dataclass
class Traceable:
    source_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source_type: SourceType = SourceType.STUDENT_INPUT
    created_at: datetime = field(default_factory=datetime.now)
    parent_ids: List[str] = field(default_factory=list)
    notes: str = ""

    def trace(self) -> Dict[str, Any]:
        return {
            "source_id": self.source_id,
            "source_type": self.source_type.value,
            "created_at": self.created_at.isoformat(),
            "parent_ids": self.parent_ids,
            "notes": self.notes,
        }


@dataclass
class GratingConstant(Traceable):
    value: float = 0.0
    unit: str = "m"
    uncertainty: float = 0.0

    def __post_init__(self):
        if self.source_type == SourceType.STUDENT_INPUT:
            self.notes = "学生提供的光栅常数（通常为1/N，N为每米刻痕数）"


@dataclass
class FringePosition(Traceable):
    order: int = 0
    side: str = "center"
    position: float = 0.0
    unit: str = "m"
    uncertainty: float = 0.0
    angle: Optional[float] = None
    angle_unit: AngleUnit = AngleUnit.DEGREE

    def __post_init__(self):
        if self.source_type == SourceType.STUDENT_INPUT:
            self.notes = f"学生记录的第{self.order}级条纹（{self.side}侧）位置"


@dataclass
class ScreenDistance(Traceable):
    value: float = 0.0
    unit: str = "m"
    uncertainty: float = 0.0

    def __post_init__(self):
        if self.source_type == SourceType.STUDENT_INPUT:
            self.notes = "学生测量的光栅到屏幕的距离"


@dataclass
class WavelengthResult(Traceable):
    value: float = 0.0
    unit: str = "m"
    uncertainty: float = 0.0
    order: int = 0
    fringe_id: str = ""

    def __post_init__(self):
        self.notes = f"由第{self.order}级条纹计算得到的波长"


@dataclass
class StudentRecord(Traceable):
    student_id: str = ""
    student_name: str = ""
    experiment_name: str = "光栅衍射测波长"
    grating_constant: Optional[GratingConstant] = None
    screen_distance: Optional[ScreenDistance] = None
    fringes: List[FringePosition] = field(default_factory=list)
    reference_wavelength: Optional[float] = None
    reference_wavelength_unit: str = "m"

    def add_fringe(self, fringe: FringePosition):
        fringe.parent_ids.append(self.source_id)
        self.fringes.append(fringe)


@dataclass
class AnalysisStep(Traceable):
    step_name: str = ""
    input_data: Dict[str, Any] = field(default_factory=dict)
    output_data: Dict[str, Any] = field(default_factory=dict)
    status: str = "pending"
    error_message: str = ""

    def execute(self, func):
        try:
            self.status = "running"
            self.output_data = func(self.input_data)
            self.status = "completed"
        except Exception as e:
            self.status = "failed"
            self.error_message = str(e)
        return self.output_data


@dataclass
class Anomaly(Traceable):
    anomaly_type: str = ""
    severity: str = "warning"
    description: str = ""
    affected_ids: List[str] = field(default_factory=list)
    suggestion: str = ""


@dataclass
class ExperimentReport(Traceable):
    student_record_id: str = ""
    steps: List[AnalysisStep] = field(default_factory=list)
    anomalies: List[Anomaly] = field(default_factory=list)
    wavelength_results: List[WavelengthResult] = field(default_factory=list)
    final_wavelength: Optional[float] = None
    final_uncertainty: Optional[float] = None
    relative_error: Optional[float] = None
    conclusion: str = ""
    chart_paths: Dict[str, str] = field(default_factory=dict)
