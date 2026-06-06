from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional
from .enums import ChangeType, UserRole


class ChangeRecord(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    operator: UserRole
    change_type: ChangeType
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    remark: Optional[str] = None


class BaseDataModel(BaseModel):
    def apply_change(self, change: ChangeRecord) -> None:
        pass
