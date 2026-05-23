import uuid
from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.enums import WorkOrderStatus, OperationType
from app.models.database import WorkOrder, StatusTransition, Attachment
from app.services.state_machine import WorkOrderStateMachine, StateTransitionError
from app.services.audit import AuditService


class WorkOrderService:
    def __init__(self, db: Session):
        self.db = db
        self.audit_service = AuditService(db)

    def get_work_order_by_id(self, work_order_id: str) -> Optional[WorkOrder]:
        return self.db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()

    def get_work_order_by_no(self, order_no: str) -> Optional[WorkOrder]:
        return self.db.query(WorkOrder).filter(WorkOrder.order_no == order_no).first()

    def list_work_orders(
        self,
        skip: int = 0,
        limit: int = 100,
        area: str = None,
        status: str = None,
        source: str = None,
        pile_no: str = None,
    ):
        query = self.db.query(WorkOrder)
        if area:
            query = query.filter(WorkOrder.area == area)
        if status:
            query = query.filter(WorkOrder.status == status)
        if source:
            query = query.filter(WorkOrder.source == source)
        if pile_no:
            query = query.filter(WorkOrder.pile_no == pile_no)
        return query.order_by(WorkOrder.created_at.desc()).offset(skip).limit(limit).all()

    def count_work_orders(
        self,
        area: str = None,
        status: str = None,
        source: str = None,
        pile_no: str = None,
    ) -> int:
        query = self.db.query(WorkOrder)
        if area:
            query = query.filter(WorkOrder.area == area)
        if status:
            query = query.filter(WorkOrder.status == status)
        if source:
            query = query.filter(WorkOrder.source == source)
        if pile_no:
            query = query.filter(WorkOrder.pile_no == pile_no)
        return query.count()

    def get_work_order_detail(self, work_order_id: str) -> dict:
        wo = self.get_work_order_by_id(work_order_id)
        if not wo:
            return None

        transitions = self.db.query(StatusTransition).filter(
            StatusTransition.work_order_id == work_order_id
        ).order_by(StatusTransition.transition_time.desc()).all()

        attachments = self.db.query(Attachment).filter(
            Attachment.work_order_id == work_order_id
        ).order_by(Attachment.uploaded_at.desc()).all()

        audit_logs = self.audit_service.get_work_order_history(work_order_id)

        return {
            "work_order": wo,
            "status_transitions": [
                {
                    "from_status": t.from_status,
                    "to_status": t.to_status,
                    "transition_time": t.transition_time,
                    "operator": t.operator,
                    "reason": t.reason,
                    "remark": t.remark,
                }
                for t in transitions
            ],
            "attachments": [
                {
                    "id": a.id,
                    "file_name": a.file_name,
                    "file_type": a.file_type,
                    "file_size": a.file_size,
                    "uploaded_by": a.uploaded_by,
                    "uploaded_at": a.uploaded_at,
                }
                for a in attachments
            ],
            "audit_logs": [
                {
                    "operation_type": log.operation_type,
                    "operator": log.operator,
                    "operation_time": log.operation_time,
                    "remark": log.remark,
                    "before_data": log.before_data,
                    "after_data": log.after_data,
                }
                for log in audit_logs
            ],
        }

    def change_status(
        self,
        work_order_id: str,
        target_status: WorkOrderStatus,
        operator: str,
        reason: str = None,
    ) -> Tuple[bool, str]:
        wo = self.get_work_order_by_id(work_order_id)
        if not wo:
            return False, "工单不存在"

        try:
            fsm = WorkOrderStateMachine(self.db, wo)
            success, msg = fsm.transition(target_status, operator, reason)
            return success, msg
        except StateTransitionError as e:
            return False, str(e)

    def review(
        self,
        work_order_id: str,
        operator: str,
        approved: bool,
        reason: str,
        manual_reason: str = None,
    ) -> Tuple[bool, str]:
        wo = self.get_work_order_by_id(work_order_id)
        if not wo:
            return False, "工单不存在"

        try:
            fsm = WorkOrderStateMachine(self.db, wo)
            success, msg = fsm.review(operator, approved, reason, manual_reason)
            return success, msg
        except StateTransitionError as e:
            return False, str(e)

    def freeze(self, work_order_id: str, operator: str, reason: str) -> Tuple[bool, str]:
        wo = self.get_work_order_by_id(work_order_id)
        if not wo:
            return False, "工单不存在"

        try:
            fsm = WorkOrderStateMachine(self.db, wo)
            success, msg = fsm.freeze(operator, reason)
            return success, msg
        except StateTransitionError as e:
            return False, str(e)

    def unfreeze(self, work_order_id: str, operator: str, reason: str) -> Tuple[bool, str]:
        wo = self.get_work_order_by_id(work_order_id)
        if not wo:
            return False, "工单不存在"

        try:
            fsm = WorkOrderStateMachine(self.db, wo)
            success, msg = fsm.unfreeze(operator, reason)
            return success, msg
        except StateTransitionError as e:
            return False, str(e)

    def withdraw(self, work_order_id: str, operator: str, reason: str) -> Tuple[bool, str]:
        wo = self.get_work_order_by_id(work_order_id)
        if not wo:
            return False, "工单不存在"

        try:
            fsm = WorkOrderStateMachine(self.db, wo)
            success, msg = fsm.withdraw(operator, reason)
            return success, msg
        except StateTransitionError as e:
            return False, str(e)

    def archive(self, work_order_id: str, operator: str, reason: str = None) -> Tuple[bool, str]:
        wo = self.get_work_order_by_id(work_order_id)
        if not wo:
            return False, "工单不存在"

        try:
            fsm = WorkOrderStateMachine(self.db, wo)
            success, msg = fsm.archive(operator, reason)
            return success, msg
        except StateTransitionError as e:
            return False, str(e)

    def handle_offline_recovery(
        self,
        work_order_id: str,
        operator: str,
        actual_fault_duration: float,
    ) -> Tuple[bool, str]:
        wo = self.get_work_order_by_id(work_order_id)
        if not wo:
            return False, "工单不存在"

        try:
            fsm = WorkOrderStateMachine(self.db, wo)
            success, msg = fsm.handle_offline_recovery(operator, actual_fault_duration)
            return success, msg
        except StateTransitionError as e:
            return False, str(e)

    def add_attachment(
        self,
        work_order_id: str,
        file_name: str,
        file_path: str,
        file_type: str,
        file_size: int,
        uploaded_by: str,
        remark: str = None,
    ) -> Attachment:
        attachment = Attachment(
            id=str(uuid.uuid4()),
            work_order_id=work_order_id,
            file_name=file_name,
            file_path=file_path,
            file_type=file_type,
            file_size=file_size,
            uploaded_by=uploaded_by,
            uploaded_at=datetime.utcnow(),
            remark=remark,
        )
        self.db.add(attachment)

        self.audit_service.log(
            operation_type=OperationType.ATTACHMENT_UPLOAD,
            operator=uploaded_by,
            work_order_id=work_order_id,
            after_data={
                "file_name": file_name,
                "file_type": file_type,
                "file_size": file_size,
            },
            remark=f"上传附件: {file_name}",
        )

        self.db.commit()
        self.db.refresh(attachment)
        return attachment
