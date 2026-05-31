"""数据模型定义。

定义实验记录、标定表、拟合结果等核心数据结构，
以及数据状态、来源、缺口类型等枚举。
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
import uuid


class DataStatus(str, Enum):
    """数据处理状态。

    用于标记每条记录的处理状态，便于在批改表中分类展示。
    """

    CONFIRMED = "confirmed"
    PENDING = "pending"
    MANUAL_CORRECTED = "manual_corrected"
    DUPLICATE = "duplicate"
    INVALID = "invalid"

    @property
    def display_name(self) -> str:
        return _STATUS_DISPLAY_NAMES[self]


_STATUS_DISPLAY_NAMES = {
    DataStatus.CONFIRMED: "已确认",
    DataStatus.PENDING: "待补",
    DataStatus.MANUAL_CORRECTED: "人工更正",
    DataStatus.DUPLICATE: "重复项",
    DataStatus.INVALID: "无效数据",
}


class RecordSource(str, Enum):
    """记录来源类型。

    用于区分数据是来自实验记录还是标定表，
    在缺口溯源时能准确指出缺口来源。
    """

    EXPERIMENT = "experiment"
    CALIBRATION = "calibration"
    LATE_ATTACHMENT = "late_attachment"
    MANUAL_ENTRY = "manual_entry"

    @property
    def display_name(self) -> str:
        return _SOURCE_DISPLAY_NAMES[self]


_SOURCE_DISPLAY_NAMES = {
    RecordSource.EXPERIMENT: "实验记录",
    RecordSource.CALIBRATION: "标定表",
    RecordSource.LATE_ATTACHMENT: "晚到附件",
    RecordSource.MANUAL_ENTRY: "人工录入",
}


class GapType(str, Enum):
    """采样缺口类型。

    用于分类不同原因导致的数据缺口。
    """

    MISSING_EXPERIMENT_DATA = "missing_experiment"
    MISSING_CALIBRATION_DATA = "missing_calibration"
    MASS_POINT_GAP = "mass_point_gap"
    ZERO_DRIFT = "zero_drift"

    @property
    def display_name(self) -> str:
        return _GAP_DISPLAY_NAMES[self]

    @property
    def responsible_person(self) -> str:
        return _GAP_RESPONSIBLE_PERSONS[self]


_GAP_DISPLAY_NAMES = {
    GapType.MISSING_EXPERIMENT_DATA: "实验记录缺失",
    GapType.MISSING_CALIBRATION_DATA: "标定表数据缺失",
    GapType.MASS_POINT_GAP: "质量点采样缺口",
    GapType.ZERO_DRIFT: "零点漂移",
}


_GAP_RESPONSIBLE_PERSONS = {
    GapType.MISSING_EXPERIMENT_DATA: "请联系实验课代表补充原始实验记录",
    GapType.MISSING_CALIBRATION_DATA: "请联系实验室管理员补充标定表数据",
    GapType.MASS_POINT_GAP: "请联系做实验的同学补充该质量点的测量数据",
    GapType.ZERO_DRIFT: "请检查实验装置是否归零，或联系助教确认基准位置",
}


@dataclass
class ExperimentRecord:
    """实验记录数据。

    包含弹簧振子实验的单次测量记录。
    """

    record_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str = ""
    student_name: str = ""
    experiment_date: Optional[datetime] = None
    mass_kg: float = 0.0
    period_s: float = 0.0
    amplitude_cm: float = 0.0
    spring_extension_mm: float = 0.0
    status: DataStatus = DataStatus.CONFIRMED
    source: RecordSource = RecordSource.EXPERIMENT
    notes: str = ""
    manual_correction_reason: str = ""
    original_values: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "student_id": self.student_id,
            "student_name": self.student_name,
            "experiment_date": self.experiment_date.isoformat() if self.experiment_date else None,
            "mass_kg": self.mass_kg,
            "period_s": self.period_s,
            "amplitude_cm": self.amplitude_cm,
            "spring_extension_mm": self.spring_extension_mm,
            "status": self.status.value,
            "status_display": self.status.display_name,
            "source": self.source.value,
            "source_display": self.source.display_name,
            "notes": self.notes,
            "manual_correction_reason": self.manual_correction_reason,
        }


@dataclass
class CalibrationRecord:
    """标定表记录。

    包含弹簧和砝码的标定信息。
    """

    record_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    spring_id: str = ""
    calibration_date: Optional[datetime] = None
    nominal_mass_kg: float = 0.0
    actual_mass_kg: float = 0.0
    spring_constant_nm: float = 0.0
    status: DataStatus = DataStatus.CONFIRMED
    source: RecordSource = RecordSource.CALIBRATION
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "spring_id": self.spring_id,
            "calibration_date": self.calibration_date.isoformat() if self.calibration_date else None,
            "nominal_mass_kg": self.nominal_mass_kg,
            "actual_mass_kg": self.actual_mass_kg,
            "spring_constant_nm": self.spring_constant_nm,
            "status": self.status.value,
            "status_display": self.status.display_name,
            "source": self.source.value,
            "source_display": self.source.display_name,
            "notes": self.notes,
        }


@dataclass
class FitResult:
    """弹簧振子拟合结果。

    包含周期-质量拟合得到的物理参数。
    """

    spring_constant_k: float = 0.0
    spring_constant_uncertainty: float = 0.0
    equivalent_mass_kg: float = 0.0
    equivalent_mass_uncertainty: float = 0.0
    r_squared: float = 0.0
    chi_squared: float = 0.0
    degrees_of_freedom: int = 0
    fit_method: str = ""
    used_records_count: int = 0
    mass_range_kg: tuple = (0.0, 0.0)
    period_range_s: tuple = (0.0, 0.0)
    formula: str = ""
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "spring_constant_k": round(self.spring_constant_k, 4),
            "spring_constant_uncertainty": round(self.spring_constant_uncertainty, 4),
            "equivalent_mass_kg": round(self.equivalent_mass_kg, 6),
            "equivalent_mass_uncertainty": round(self.equivalent_mass_uncertainty, 6),
            "r_squared": round(self.r_squared, 6),
            "chi_squared": round(self.chi_squared, 4),
            "degrees_of_freedom": self.degrees_of_freedom,
            "fit_method": self.fit_method,
            "used_records_count": self.used_records_count,
            "mass_range_kg": [round(x, 4) for x in self.mass_range_kg],
            "period_range_s": [round(x, 4) for x in self.period_range_s],
            "formula": self.formula,
            "notes": self.notes,
        }


@dataclass
class DataGap:
    """数据缺口信息。

    用于记录检测到的数据缺口及其溯源信息。
    """

    gap_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    gap_type: GapType = GapType.MASS_POINT_GAP
    source: RecordSource = RecordSource.EXPERIMENT
    description: str = ""
    affected_mass_points: List[float] = field(default_factory=list)
    missing_record_ids: List[str] = field(default_factory=list)
    responsible_person: str = ""
    next_step: str = ""
    severity: str = "warning"
    created_at: datetime = field(default_factory=datetime.now)

    def __post_init__(self):
        if not self.responsible_person:
            self.responsible_person = self.gap_type.responsible_person
        if not self.next_step:
            self.next_step = self._generate_next_step()

    def _generate_next_step(self) -> str:
        if self.affected_mass_points:
            mass_points = ", ".join([f"{m}kg" for m in sorted(self.affected_mass_points)])
            return f"请补充质量点 {mass_points} 的完整测量数据"
        return "请根据以上说明补充缺失数据"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "gap_id": self.gap_id,
            "gap_type": self.gap_type.value,
            "gap_type_display": self.gap_type.display_name,
            "source": self.source.value,
            "source_display": self.source.display_name,
            "description": self.description,
            "affected_mass_points": self.affected_mass_points,
            "missing_record_ids": self.missing_record_ids,
            "responsible_person": self.responsible_person,
            "next_step": self.next_step,
            "severity": self.severity,
        }


@dataclass
class ProcessingSummary:
    """数据处理摘要。

    汇总整个数据处理流程的统计信息。
    """

    total_records_imported: int = 0
    duplicate_records_removed: int = 0
    late_attachments_merged: int = 0
    manual_corrections_applied: int = 0
    invalid_records_dropped: int = 0
    confirmed_records: int = 0
    pending_records: int = 0
    data_gaps_found: int = 0
    records_used_for_fitting: int = 0
    processing_policy: str = ""
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_records_imported": self.total_records_imported,
            "duplicate_records_removed": self.duplicate_records_removed,
            "late_attachments_merged": self.late_attachments_merged,
            "manual_corrections_applied": self.manual_corrections_applied,
            "invalid_records_dropped": self.invalid_records_dropped,
            "confirmed_records": self.confirmed_records,
            "pending_records": self.pending_records,
            "data_gaps_found": self.data_gaps_found,
            "records_used_for_fitting": self.records_used_for_fitting,
            "processing_policy": self.processing_policy,
            "warnings": self.warnings,
            "errors": self.errors,
        }
