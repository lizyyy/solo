from dataclasses import dataclass, field, asdict
from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum


class RunIntensity(str, Enum):
    EASY = "EASY"
    MODERATE = "MODERATE"
    THRESHOLD = "THRESHOLD"
    INTERVAL = "INTERVAL"
    RACE = "RACE"


class PainLocation(str, Enum):
    NONE = "NONE"
    KNEE_LEFT = "KNEE_LEFT"
    KNEE_RIGHT = "KNEE_RIGHT"
    ANKLE_LEFT = "ANKLE_LEFT"
    ANKLE_RIGHT = "ANKLE_RIGHT"
    HIP_LEFT = "HIP_LEFT"
    HIP_RIGHT = "HIP_RIGHT"
    CALF_LEFT = "CALF_LEFT"
    CALF_RIGHT = "CALF_RIGHT"
    SHIN = "SHIN"
    LOWER_BACK = "LOWER_BACK"
    OTHER = "OTHER"


DATA_SOURCE_NAMES = {
    "GARMIN": "佳明 (Garmin)",
    "KEEP": "Keep",
    "MANUAL": "手动录入",
    "UNKNOWN": "未知来源"
}

INTENSITY_LABELS = {
    RunIntensity.EASY: "轻松跑",
    RunIntensity.MODERATE: "马拉松配速/节奏跑",
    RunIntensity.THRESHOLD: "阈值跑",
    RunIntensity.INTERVAL: "间歇跑",
    RunIntensity.RACE: "比赛"
}

PAIN_LOCATION_LABELS = {
    PainLocation.NONE: "无",
    PainLocation.KNEE_LEFT: "左膝",
    PainLocation.KNEE_RIGHT: "右膝",
    PainLocation.ANKLE_LEFT: "左脚踝",
    PainLocation.ANKLE_RIGHT: "右脚踝",
    PainLocation.HIP_LEFT: "左髋",
    PainLocation.HIP_RIGHT: "右髋",
    PainLocation.CALF_LEFT: "左小腿",
    PainLocation.CALF_RIGHT: "右小腿",
    PainLocation.SHIN: "胫骨/小腿前侧",
    PainLocation.LOWER_BACK: "下背部",
    PainLocation.OTHER: "其他"
}


@dataclass
class RunRecord:
    record_id: str
    date: date
    distance_km: float
    duration_min: float
    avg_hr: Optional[int] = None
    pace_min_per_km: Optional[float] = None
    elevation_m: float = 0.0
    rpe: Optional[int] = None
    pain_location: PainLocation = PainLocation.NONE
    pain_severity: Optional[int] = None
    tags: List[str] = field(default_factory=list)
    notes: str = ""
    data_source: str = "UNKNOWN"
    original_data: Dict[str, Any] = field(default_factory=dict)

    @property
    def intensity_category(self) -> RunIntensity:
        if self.avg_hr:
            if self.avg_hr >= 175:
                return RunIntensity.RACE
            elif self.avg_hr >= 165:
                return RunIntensity.INTERVAL
            elif self.avg_hr >= 155:
                return RunIntensity.THRESHOLD
            elif self.avg_hr >= 145:
                return RunIntensity.MODERATE
            else:
                return RunIntensity.EASY
        if self.pace_min_per_km:
            if self.pace_min_per_km <= 3.5:
                return RunIntensity.RACE
            elif self.pace_min_per_km <= 4.0:
                return RunIntensity.INTERVAL
            elif self.pace_min_per_km <= 4.5:
                return RunIntensity.THRESHOLD
            elif self.pace_min_per_km <= 5.5:
                return RunIntensity.MODERATE
            else:
                return RunIntensity.EASY
        if self.rpe:
            if self.rpe >= 9:
                return RunIntensity.RACE
            elif self.rpe >= 8:
                return RunIntensity.INTERVAL
            elif self.rpe >= 7:
                return RunIntensity.THRESHOLD
            elif self.rpe >= 5:
                return RunIntensity.MODERATE
            else:
                return RunIntensity.EASY
        return RunIntensity.MODERATE

    @property
    def training_load(self) -> float:
        base = self.distance_km * (self.duration_min / 60.0)
        intensity_multiplier = {
            RunIntensity.EASY: 1.0,
            RunIntensity.MODERATE: 1.4,
            RunIntensity.THRESHOLD: 2.0,
            RunIntensity.INTERVAL: 2.8,
            RunIntensity.RACE: 3.2
        }
        multiplier = intensity_multiplier.get(self.intensity_category, 1.0)
        rpe_factor = (self.rpe / 10.0) if self.rpe else 0.7
        if self.rpe:
            return base * multiplier * rpe_factor
        return base * multiplier * 0.7

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d['date'] = self.date.isoformat()
        d['pain_location'] = self.pain_location.value
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'RunRecord':
        data = data.copy()
        data['date'] = date.fromisoformat(data['date'])
        data['pain_location'] = PainLocation(data.get('pain_location', 'NONE'))
        return cls(**data)


@dataclass
class PlannedRun:
    plan_id: str
    date: date
    planned_distance_km: Optional[float] = None
    planned_duration_min: Optional[float] = None
    planned_pace_min_per_km: Optional[float] = None
    planned_intensity: Optional[RunIntensity] = None
    description: str = ""
    tags: List[str] = field(default_factory=list)

    @property
    def estimated_load(self) -> float:
        if self.planned_distance_km and self.planned_duration_min:
            base = self.planned_distance_km * (self.planned_duration_min / 60.0)
        elif self.planned_distance_km:
            base = self.planned_distance_km * 0.8
        elif self.planned_duration_min:
            base = (self.planned_duration_min / 60.0) * 5.0
        else:
            return 0.0

        intensity_multiplier = {
            RunIntensity.EASY: 1.0,
            RunIntensity.MODERATE: 1.4,
            RunIntensity.THRESHOLD: 2.0,
            RunIntensity.INTERVAL: 2.8,
            RunIntensity.RACE: 3.2
        }
        multiplier = intensity_multiplier.get(self.planned_intensity or RunIntensity.MODERATE, 1.0)
        return base * multiplier * 0.7

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d['date'] = self.date.isoformat()
        d['planned_intensity'] = self.planned_intensity.value if self.planned_intensity else None
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PlannedRun':
        data = data.copy()
        data['date'] = date.fromisoformat(data['date'])
        if data.get('planned_intensity'):
            data['planned_intensity'] = RunIntensity(data['planned_intensity'])
        else:
            data['planned_intensity'] = None
        return cls(**data)


@dataclass
class RiskAlert:
    risk_type: str
    severity: str
    message: str
    related_dates: List[date]
    related_record_ids: List[str]
    details: Dict[str, Any] = field(default_factory=dict)

    SEVERITY_LABELS = {
        "high": "高风险",
        "medium": "中风险",
        "low": "低风险"
    }

    RISK_TYPE_LABELS = {
        "sudden_volume_increase": "突然加量",
        "consecutive_high_intensity": "连续高强度",
        "insufficient_rest": "休息不足",
        "pain_while_running": "带伤跑步",
        "load_spike_7d": "7天负荷突增",
        "load_spike_28d": "28天负荷突增",
        "plan_overload": "计划超量",
        "plan_rest_conflict": "计划与休息冲突"
    }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "risk_type": self.risk_type,
            "severity": self.severity,
            "message": self.message,
            "related_dates": [d.isoformat() for d in self.related_dates],
            "related_record_ids": self.related_record_ids,
            "details": self.details
        }


@dataclass
class Project:
    project_name: str
    created_at: datetime
    updated_at: datetime
    records: List[RunRecord] = field(default_factory=list)
    planned_runs: List[PlannedRun] = field(default_factory=list)
    tags_definition: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "project_name": self.project_name,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "records": [r.to_dict() for r in self.records],
            "planned_runs": [p.to_dict() for p in self.planned_runs],
            "tags_definition": self.tags_definition
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Project':
        records = [RunRecord.from_dict(r) for r in data.get('records', [])]
        planned_runs = [PlannedRun.from_dict(p) for p in data.get('planned_runs', [])]
        return cls(
            project_name=data['project_name'],
            created_at=datetime.fromisoformat(data['created_at']),
            updated_at=datetime.fromisoformat(data['updated_at']),
            records=records,
            planned_runs=planned_runs,
            tags_definition=data.get('tags_definition', {})
        )

    def sorted_records(self) -> List[RunRecord]:
        return sorted(self.records, key=lambda r: r.date, reverse=True)

    def sorted_plans(self) -> List[PlannedRun]:
        return sorted(self.planned_runs, key=lambda p: p.date)
