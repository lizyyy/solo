from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List
from .enums import ProcessingStatus, TemperatureUnit
from .base import ChangeRecord


class WorkingConditionPhoto(BaseModel):
    photo_id: str
    original_row_number: int
    batch_id: str
    file_name: str
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
    is_rollbacked: bool = False
    rollback_to_version: Optional[int] = None

    @property
    def version(self) -> int:
        return len(self.change_history)

    def add_change(self, change: ChangeRecord) -> None:
        self.change_history.append(change)

    def get_change_at_version(self, version: int) -> Optional[ChangeRecord]:
        if 0 <= version < len(self.change_history):
            return self.change_history[version]
        return None
