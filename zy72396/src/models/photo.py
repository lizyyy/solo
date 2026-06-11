from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from .enums import ProcessingStatus, TemperatureUnit
from .base import ChangeRecord


class PhotoSnapshot(BaseModel):
    version: int
    temperature_value: Optional[float] = None
    temperature_unit: TemperatureUnit = TemperatureUnit.UNKNOWN
    has_mixed_units: bool = False
    error_status: ProcessingStatus = ProcessingStatus.IMPORTED
    handwritten_remark: Optional[str] = None
    operator_remark: Optional[str] = None
    report_content: Optional[str] = None
    balance_wheel_error: Optional[float] = None


class WorkingConditionPhoto(BaseModel):
    photo_id: str
    original_row_number: int
    batch_id: str
    file_name: str
    source_file: str = ""
    captured_at: Optional[datetime] = None
    imported_at: datetime = Field(default_factory=datetime.now)

    temperature_raw: Optional[str] = None
    temperature_value: Optional[float] = None
    temperature_unit: TemperatureUnit = TemperatureUnit.UNKNOWN
    has_mixed_units: bool = False

    balance_wheel_error: Optional[float] = None
    error_status: ProcessingStatus = ProcessingStatus.IMPORTED

    handwritten_remark: Optional[str] = None
    operator_remark: Optional[str] = None
    report_content: Optional[str] = None

    change_history: List[ChangeRecord] = Field(default_factory=list)
    snapshots: List[PhotoSnapshot] = Field(default_factory=list)

    is_rollbacked: bool = False
    rollback_to_version: Optional[int] = None

    @property
    def version(self) -> int:
        return len(self.change_history)

    def _take_snapshot(self) -> PhotoSnapshot:
        return PhotoSnapshot(
            version=self.version,
            temperature_value=self.temperature_value,
            temperature_unit=self.temperature_unit,
            has_mixed_units=self.has_mixed_units,
            error_status=self.error_status,
            handwritten_remark=self.handwritten_remark,
            operator_remark=self.operator_remark,
            report_content=self.report_content,
            balance_wheel_error=self.balance_wheel_error,
        )

    def add_change(self, change: ChangeRecord) -> None:
        self.change_history.append(change)
        self.snapshots.append(self._take_snapshot())

    def initialize_snapshot(self) -> None:
        if not self.snapshots and self.change_history:
            self.snapshots.append(self._take_snapshot())

    def get_change_at_version(self, version: int) -> Optional[ChangeRecord]:
        if 0 <= version < len(self.change_history):
            return self.change_history[version]
        return None

    def get_snapshot_at_version(self, version: int) -> Optional[PhotoSnapshot]:
        if 0 <= version < len(self.snapshots):
            return self.snapshots[version]
        return None

    def rollback_to(self, target_version: int) -> bool:
        if target_version < 0 or target_version >= len(self.snapshots):
            return False

        snapshot = self.snapshots[target_version]
        self.temperature_value = snapshot.temperature_value
        self.temperature_unit = snapshot.temperature_unit
        self.has_mixed_units = snapshot.has_mixed_units
        self.error_status = snapshot.error_status
        self.handwritten_remark = snapshot.handwritten_remark
        self.operator_remark = snapshot.operator_remark
        self.report_content = snapshot.report_content
        self.balance_wheel_error = snapshot.balance_wheel_error
        self.is_rollbacked = True
        self.rollback_to_version = target_version
        return True

    def get_field_diff(self, v1: int, v2: int) -> Optional[Dict[str, Dict[str, Any]]]:
        s1 = self.get_snapshot_at_version(v1)
        s2 = self.get_snapshot_at_version(v2)
        if not s1 or not s2:
            return None

        diff = {}
        fields = [
            "temperature_value", "temperature_unit", "has_mixed_units",
            "error_status", "handwritten_remark", "operator_remark",
            "report_content", "balance_wheel_error",
        ]
        for field in fields:
            val1 = getattr(s1, field)
            val2 = getattr(s2, field)
            if val1 != val2:
                diff[field] = {"old": val1, "new": val2}
        return diff
