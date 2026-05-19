from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import Field
from .base import IdempotentEntity
from .enums import ApplicationStatus, ExceptionType


class ApplicationItem(IdempotentEntity):
    application_id: str
    reagent_id: str
    reagent_name: str
    specification: str
    quantity: float
    unit: str
    danger_level: str
    approved_quantity: Optional[float] = None
    actual_quantity: Optional[float] = None
    remark: Optional[str] = None


class Application(IdempotentEntity):
    applicant_id: str
    applicant_name: str
    department: Optional[str] = None
    purpose: str
    status: ApplicationStatus = ApplicationStatus.DRAFT
    items: List[ApplicationItem] = Field(default_factory=list)
    current_approval_index: int = 0
    approval_records: List[str] = Field(default_factory=list)
    rejection_reason: Optional[str] = None
    resubmit_count: int = 0
    parent_application_id: Optional[str] = None
    exception_type: ExceptionType = ExceptionType.NONE
    exception_message: Optional[str] = None
    completed_at: Optional[datetime] = None

    def add_item(self, item: ApplicationItem):
        item.application_id = self.id
        self.items.append(item)
        self.update_timestamp()

    def remove_item(self, item_id: str):
        self.items = [item for item in self.items if item.id != item_id]
        self.update_timestamp()

    def submit(self):
        if not self.items:
            raise ValueError("申请单不能为空")
        self.status = ApplicationStatus.PENDING
        self.update_timestamp()

    def approve(self, approval_record_id: str):
        self.approval_records.append(approval_record_id)
        self.current_approval_index += 1
        self.update_timestamp()

    def reject(self, reason: str):
        self.status = ApplicationStatus.REJECTED
        self.rejection_reason = reason
        self.update_timestamp()

    def resubmit(self):
        if self.status != ApplicationStatus.REJECTED:
            raise ValueError("只有被驳回的申请才能重新提交")
        self.resubmit_count += 1
        self.status = ApplicationStatus.PENDING
        self.rejection_reason = None
        self.approval_records = []
        self.current_approval_index = 0
        self.exception_type = ExceptionType.REJECTED_RESUBMIT
        self.update_timestamp()

    def cancel(self):
        if self.status in [ApplicationStatus.COMPLETED, ApplicationStatus.CANCELLED]:
            raise ValueError("申请已完成或已取消，不能再次取消")
        self.status = ApplicationStatus.CANCELLED
        self.update_timestamp()

    def complete(self):
        self.status = ApplicationStatus.COMPLETED
        self.completed_at = datetime.now()
        self.update_timestamp()

    @property
    def contains_dangerous_goods(self) -> bool:
        from .enums import DangerLevel
        for item in self.items:
            if item.danger_level in [DangerLevel.HIGH.value, DangerLevel.EXTREME.value]:
                return True
        return False

    @property
    def requires_double_approval(self) -> bool:
        from .enums import DangerLevel
        for item in self.items:
            if item.danger_level == DangerLevel.EXTREME.value:
                return True
        return False
