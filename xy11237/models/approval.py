from datetime import datetime
from typing import Optional
from pydantic import Field
from .base import IdempotentEntity
from .enums import ApprovalResult


class ApprovalRecord(IdempotentEntity):
    application_id: str
    approver_id: str
    approver_name: str
    approval_level: int
    result: ApprovalResult = ApprovalResult.PENDING
    comment: Optional[str] = None
    approved_at: Optional[datetime] = None
    is_final_approval: bool = False

    def approve(self, comment: Optional[str] = None):
        self.result = ApprovalResult.APPROVED
        self.comment = comment
        self.approved_at = datetime.now()
        self.update_timestamp()

    def reject(self, comment: str):
        if not comment:
            raise ValueError("驳回必须提供原因")
        self.result = ApprovalResult.REJECTED
        self.comment = comment
        self.approved_at = datetime.now()
        self.update_timestamp()
