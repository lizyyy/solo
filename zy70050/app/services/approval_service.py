from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
import uuid

from app.models.approval import ApprovalRequest, ApprovalType, ApprovalStatus
from app.models.instrument import Instrument, InstrumentStatus
from app.models.user import User
from app.schemas.approval import ApprovalCreate, ApprovalProcess
from app.services.history_service import HistoryService


class ApprovalService:
    @staticmethod
    def _generate_request_no() -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        suffix = uuid.uuid4().hex[:6].upper()
        return f"APR-{timestamp}-{suffix}"

    @staticmethod
    def create(
        db: Session,
        data: ApprovalCreate,
        requester: User,
    ) -> ApprovalRequest:
        instrument = db.query(Instrument).filter(Instrument.id == data.instrument_id).first()
        if not instrument:
            raise ValueError("器具不存在")
        
        if data.approval_type == ApprovalType.SEAL:
            if instrument.status == InstrumentStatus.SEALED:
                raise ValueError("器具已封存")
            if instrument.status == InstrumentStatus.DISCARDED:
                raise ValueError("器具已报废")
        elif data.approval_type == ApprovalType.UNSEAL:
            if instrument.status != InstrumentStatus.SEALED:
                raise ValueError("器具未封存，无法启封")
        
        pending_approval = (
            db.query(ApprovalRequest)
            .filter(
                ApprovalRequest.instrument_id == data.instrument_id,
                ApprovalRequest.status == ApprovalStatus.PENDING,
                ApprovalRequest.approval_type == data.approval_type,
            )
            .first()
        )
        if pending_approval:
            raise ValueError("该器具已存在同类型待审批申请")
        
        request = ApprovalRequest(
            request_no=ApprovalService._generate_request_no(),
            approval_type=data.approval_type,
            instrument_id=data.instrument_id,
            reason=data.reason,
            expected_action_date=data.expected_action_date,
            requester_id=requester.id,
            requester_name=requester.full_name,
            status=ApprovalStatus.PENDING,
        )
        
        db.add(request)
        db.flush()
        
        HistoryService.create_history(
            db=db,
            instrument=instrument,
            action="update",
            action_description=f"提交审批申请：{data.approval_type.value}，单号：{request.request_no}",
            created_by=requester,
        )
        
        db.commit()
        db.refresh(request)
        return request

    @staticmethod
    def get_by_id(db: Session, approval_id: int) -> Optional[ApprovalRequest]:
        return db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()

    @staticmethod
    def get_by_request_no(db: Session, request_no: str) -> Optional[ApprovalRequest]:
        return db.query(ApprovalRequest).filter(ApprovalRequest.request_no == request_no).first()

    @staticmethod
    def list(
        db: Session,
        status: Optional[ApprovalStatus] = None,
        approval_type: Optional[ApprovalType] = None,
        instrument_id: Optional[int] = None,
        requester_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[ApprovalRequest]:
        query = db.query(ApprovalRequest)
        
        if status:
            query = query.filter(ApprovalRequest.status == status)
        if approval_type:
            query = query.filter(ApprovalRequest.approval_type == approval_type)
        if instrument_id:
            query = query.filter(ApprovalRequest.instrument_id == instrument_id)
        if requester_id:
            query = query.filter(ApprovalRequest.requester_id == requester_id)
        
        return query.order_by(ApprovalRequest.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def process(
        db: Session,
        approval_id: int,
        process_data: ApprovalProcess,
        approver: User,
    ) -> ApprovalRequest:
        request = ApprovalService.get_by_id(db, approval_id)
        if not request:
            raise ValueError("审批申请不存在")
        
        if request.status != ApprovalStatus.PENDING:
            raise ValueError(f"审批状态为 {request.status.value}，无法处理")
        
        instrument = db.query(Instrument).filter(Instrument.id == request.instrument_id).first()
        
        request.status = process_data.status
        request.approval_remark = process_data.approval_remark
        request.approver_id = approver.id
        request.approver_name = approver.full_name
        request.approval_date = datetime.utcnow()
        
        if process_data.status == ApprovalStatus.APPROVED:
            if request.approval_type == ApprovalType.SEAL and instrument:
                if instrument.status in [InstrumentStatus.BORROWED, InstrumentStatus.CALIBRATING]:
                    raise ValueError(f"器具当前状态为 {instrument.status.value}，无法封存")
                old_values = {"status": instrument.status.value}
                instrument.status = InstrumentStatus.SEALED
                HistoryService.record_seal(
                    db=db,
                    instrument=instrument,
                    reason=request.reason,
                    approval_no=request.request_no,
                    created_by=approver,
                )
            elif request.approval_type == ApprovalType.UNSEAL and instrument:
                old_values = {"status": instrument.status.value}
                instrument.status = InstrumentStatus.IN_STOCK
                HistoryService.record_unseal(
                    db=db,
                    instrument=instrument,
                    approval_no=request.request_no,
                    created_by=approver,
                )
        else:
            HistoryService.create_history(
                db=db,
                instrument=instrument,
                action="reject",
                action_description=f"审批被拒绝：{request.request_no}，原因：{process_data.approval_remark or '未说明'}",
                created_by=approver,
            )
        
        db.commit()
        db.refresh(request)
        return request

    @staticmethod
    def cancel(
        db: Session,
        approval_id: int,
        requester: User,
        reason: str = "",
    ) -> ApprovalRequest:
        request = ApprovalService.get_by_id(db, approval_id)
        if not request:
            raise ValueError("审批申请不存在")
        
        if request.status != ApprovalStatus.PENDING:
            raise ValueError(f"审批状态为 {request.status.value}，无法取消")
        
        if request.requester_id != requester.id:
            raise ValueError("只有申请人可以取消申请")
        
        request.status = ApprovalStatus.CANCELLED
        
        instrument = db.query(Instrument).filter(Instrument.id == request.instrument_id).first()
        HistoryService.record_withdraw(
            db=db,
            instrument=instrument,
            old_values={"status": instrument.status.value if instrument and instrument.status else None},
            reason=f"撤回审批申请：{reason}",
            created_by=requester,
        )
        
        db.commit()
        db.refresh(request)
        return request
