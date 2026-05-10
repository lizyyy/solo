from typing import Dict, List, Optional

from models import InsertionApproval, ApprovalStatus


class ApprovalRepository:
    def __init__(self):
        self._approvals: Dict[str, InsertionApproval] = {}

    def save(self, approval: InsertionApproval) -> None:
        self._approvals[approval.id] = approval

    def get_by_id(self, approval_id: str) -> Optional[InsertionApproval]:
        return self._approvals.get(approval_id)

    def get_by_plan(self, plan_id: str) -> List[InsertionApproval]:
        return [a for a in self._approvals.values() if a.payment_plan_id == plan_id]

    def get_by_status(self, status: ApprovalStatus) -> List[InsertionApproval]:
        return [a for a in self._approvals.values() if a.status == status]

    def get_pending(self) -> List[InsertionApproval]:
        return self.get_by_status(ApprovalStatus.PENDING)

    def get_all(self) -> List[InsertionApproval]:
        return list(self._approvals.values())

    def delete(self, approval_id: str) -> bool:
        if approval_id in self._approvals:
            del self._approvals[approval_id]
            return True
        return False
