from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import Approval, ApprovalStatus, SwitchRequest, SwitchStatus
from app.schemas import ApprovalCreate


class ApprovalService:
    def __init__(self, db: Session):
        self.db = db

    def create_approval(self, approval_data: ApprovalCreate) -> Optional[Approval]:
        switch_request = self.db.query(SwitchRequest).filter(
            SwitchRequest.id == approval_data.switch_request_id
        ).first()

        if not switch_request:
            return None

        existing_pending = self.db.query(Approval).filter(
            Approval.switch_request_id == approval_data.switch_request_id,
            Approval.status == ApprovalStatus.PENDING
        ).first()

        if existing_pending:
            return None

        approval = Approval(
            switch_request_id=approval_data.switch_request_id,
            approver=approval_data.approver,
            approver_department=approval_data.approver_department,
            approval_level=approval_data.approval_level,
            status=ApprovalStatus.PENDING,
            comment=approval_data.comment
        )
        self.db.add(approval)
        self.db.commit()
        self.db.refresh(approval)
        return approval

    def get_approval(self, approval_id: int) -> Optional[Approval]:
        return self.db.query(Approval).filter(Approval.id == approval_id).first()

    def get_approvals_by_request(self, switch_request_id: int) -> List[Approval]:
        return self.db.query(Approval).filter(
            Approval.switch_request_id == switch_request_id
        ).order_by(Approval.approval_level, Approval.created_at.desc()).all()

    def approve(
        self,
        approval_id: int,
        approver: str,
        comment: Optional[str] = None
    ) -> Optional[Approval]:
        approval = self.get_approval(approval_id)
        if not approval or approval.status != ApprovalStatus.PENDING:
            return None

        approval.status = ApprovalStatus.APPROVED
        approval.approved_at = datetime.utcnow()
        if comment:
            approval.comment = comment
        self.db.commit()
        self.db.refresh(approval)

        self._check_and_update_request_status(approval.switch_request_id)

        return approval

    def reject(
        self,
        approval_id: int,
        approver: str,
        comment: Optional[str] = None
    ) -> Optional[Approval]:
        approval = self.get_approval(approval_id)
        if not approval or approval.status != ApprovalStatus.PENDING:
            return None

        approval.status = ApprovalStatus.REJECTED
        approval.approved_at = datetime.utcnow()
        if comment:
            approval.comment = comment
        self.db.commit()
        self.db.refresh(approval)

        switch_request = self.db.query(SwitchRequest).filter(
            SwitchRequest.id == approval.switch_request_id
        ).first()
        if switch_request:
            switch_request.status = SwitchStatus.REJECTED
            self.db.commit()

        return approval

    def _check_and_update_request_status(self, switch_request_id: int):
        switch_request = self.db.query(SwitchRequest).filter(
            SwitchRequest.id == switch_request_id
        ).first()
        if not switch_request:
            return

        approvals = self.get_approvals_by_request(switch_request_id)
        if not approvals:
            return

        all_approved = all(a.status == ApprovalStatus.APPROVED for a in approvals)
        if all_approved:
            switch_request.status = SwitchStatus.APPROVED
            self.db.commit()

    def get_pending_approvals(self, approver: Optional[str] = None) -> List[Approval]:
        query = self.db.query(Approval).filter(Approval.status == ApprovalStatus.PENDING)
        if approver:
            query = query.filter(Approval.approver == approver)
        return query.order_by(Approval.created_at.desc()).all()

    def get_approval_history(self, switch_request_id: int) -> List[dict]:
        approvals = self.get_approvals_by_request(switch_request_id)
        history = []
        for approval in approvals:
            history.append({
                "approval_level": approval.approval_level,
                "approver": approval.approver,
                "status": approval.status,
                "comment": approval.comment,
                "approved_at": approval.approved_at,
                "created_at": approval.created_at
            })
        return history
