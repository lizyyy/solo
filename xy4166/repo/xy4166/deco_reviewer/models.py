from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Dict, Optional


class GasType(Enum):
    AIR = "air"
    NITROX = "nitrox"
    TRIMIX = "trimix"


class ViolationType(Enum):
    NDL_EXCEEDED = "ndl_exceeded"
    ASCENT_RATE_TOO_FAST = "ascent_rate_too_fast"
    SAFETY_STOP_MISSED = "safety_stop_missed"
    REPEAT_DIVE_INTERVAL_TOO_SHORT = "repeat_dive_interval_too_short"
    CNS_EXCEEDED = "cns_exceeded"
    OTU_EXCEEDED = "otu_exceeded"


@dataclass
class DiveProfilePoint:
    time: int
    depth: float
    temperature: Optional[float] = None


@dataclass
class GasMix:
    gas_type: GasType
    o2_percent: float
    n2_percent: float
    he_percent: float = 0.0

    @property
    def p_o2(self) -> float:
        return self.o2_percent / 100.0

    @property
    def p_n2(self) -> float:
        return self.n2_percent / 100.0

    @property
    def p_he(self) -> float:
        return self.he_percent / 100.0


@dataclass
class SafetyStop:
    depth: float
    duration: int


@dataclass
class TissueCompartment:
    compartment_id: int
    n2_half_time: float
    n2_a: float
    n2_b: float
    he_half_time: float = 0.0
    he_a: float = 0.0
    he_b: float = 0.0
    current_p_n2: float = 0.79
    current_p_he: float = 0.0


@dataclass
class CalculationResult:
    tissue_compartments: List[TissueCompartment]
    current_ndl: Optional[int]
    max_ndl: int
    cns_percentage: float
    otu_value: float
    leading_compartment: int
    m_value_ratio: float


@dataclass
class Violation:
    violation_type: ViolationType
    severity: str
    message: str
    details: Dict = field(default_factory=dict)
    time_point: Optional[int] = None


@dataclass
class DiveLog:
    dive_id: str
    diver_name: str
    dive_date: datetime
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    profile: List[DiveProfilePoint] = field(default_factory=list)
    gas_mix: GasMix = field(default_factory=lambda: GasMix(GasType.AIR, 21.0, 79.0))
    safety_stops: List[SafetyStop] = field(default_factory=list)
    surface_interval_minutes: Optional[int] = None
    previous_dive: Optional["DiveLog"] = None


@dataclass
class DiveAnalysis:
    dive_log: DiveLog
    calculation_result: CalculationResult
    violations: List[Violation]
    summary: Dict
