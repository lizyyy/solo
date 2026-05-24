from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import (
    CompensationUploadRequest,
    CompensationResponse,
    ConfirmRequest,
    RejudgeRequest,
    OperationLogResponse,
    CompensationSuggestion
)
from app.services import CompensationService

router = APIRouter()


@router.post("/upload", response_model=CompensationResponse)
def upload_compensation(
    request: CompensationUploadRequest,
    resubmit: bool = Query(False, description="是否为撤回后重新提交"),
    db: Session = Depends(get_db)
):
    service = CompensationService(db)
    try:
        record, suggestion, is_duplicate = service.create_or_update_record(
            request, is_resubmit=resubmit
        )
        db.commit()
        db.refresh(record)

        response = CompensationResponse(
            id=record.id,
            batch_no=record.batch_no,
            case_no=record.case_no,
            user_id=record.user_id,
            pile_no=record.pile_no,
            order_no=record.order_no,
            fault_code=record.fault_code,
            fault_category=record.fault_category,
            description=record.description,
            status=record.status,
            conclusion=record.conclusion,
            suggestion=record.suggestion,
            compensation_amount=record.compensation_amount,
            is_duplicate=is_duplicate,
            operator=record.operator,
            verified_at=record.verified_at,
            confirmed_at=record.confirmed_at,
            closed_at=record.closed_at,
            created_at=record.created_at,
            updated_at=record.updated_at,
            suggestion_detail=suggestion
        )
        return response
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{case_no}", response_model=CompensationResponse)
def get_compensation(
    case_no: str,
    db: Session = Depends(get_db)
):
    service = CompensationService(db)
    record = service.get_record(case_no)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    suggestion_detail = None
    if record.suggestion:
        suggestion_detail = CompensationSuggestion(
            should_compensate=record.status in ["approved", "compensated"],
            reason=record.suggestion or "",
            suggested_amount=record.compensation_amount,
            fault_category=record.fault_category or "other",
            conclusion=record.conclusion or "other",
            risk_warnings=[]
        )

    return CompensationResponse(
        id=record.id,
        batch_no=record.batch_no,
        case_no=record.case_no,
        user_id=record.user_id,
        pile_no=record.pile_no,
        order_no=record.order_no,
        fault_code=record.fault_code,
        fault_category=record.fault_category,
        description=record.description,
        status=record.status,
        conclusion=record.conclusion,
        suggestion=record.suggestion,
        compensation_amount=record.compensation_amount,
        is_duplicate=record.is_duplicate,
        operator=record.operator,
        verified_at=record.verified_at,
        confirmed_at=record.confirmed_at,
        closed_at=record.closed_at,
        created_at=record.created_at,
        updated_at=record.updated_at,
        suggestion_detail=suggestion_detail
    )


@router.get("/", response_model=dict)
def query_compensations(
    case_no: Optional[str] = None,
    user_id: Optional[str] = None,
    pile_no: Optional[str] = None,
    order_no: Optional[str] = None,
    status: Optional[str] = None,
    batch_no: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    service = CompensationService(db)
    records, total = service.query_records(
        case_no=case_no,
        user_id=user_id,
        pile_no=pile_no,
        order_no=order_no,
        status=status,
        batch_no=batch_no,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size
    )

    items = []
    for record in records:
        items.append(CompensationResponse(
            id=record.id,
            batch_no=record.batch_no,
            case_no=record.case_no,
            user_id=record.user_id,
            pile_no=record.pile_no,
            order_no=record.order_no,
            fault_code=record.fault_code,
            fault_category=record.fault_category,
            description=record.description,
            status=record.status,
            conclusion=record.conclusion,
            suggestion=record.suggestion,
            compensation_amount=record.compensation_amount,
            is_duplicate=record.is_duplicate,
            operator=record.operator,
            verified_at=record.verified_at,
            confirmed_at=record.confirmed_at,
            closed_at=record.closed_at,
            created_at=record.created_at,
            updated_at=record.updated_at
        ))

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items
    }


@router.post("/{case_no}/confirm", response_model=CompensationResponse)
def confirm_compensation(
    case_no: str,
    request: ConfirmRequest,
    db: Session = Depends(get_db)
):
    service = CompensationService(db)
    record = service.confirm_record(
        case_no=case_no,
        operator=request.operator,
        approved=request.approved,
        conclusion=request.conclusion,
        compensation_amount=request.compensation_amount,
        remark=request.remark
    )
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    db.commit()
    db.refresh(record)

    return CompensationResponse(
        id=record.id,
        batch_no=record.batch_no,
        case_no=record.case_no,
        user_id=record.user_id,
        pile_no=record.pile_no,
        order_no=record.order_no,
        fault_code=record.fault_code,
        fault_category=record.fault_category,
        description=record.description,
        status=record.status,
        conclusion=record.conclusion,
        suggestion=record.suggestion,
        compensation_amount=record.compensation_amount,
        is_duplicate=record.is_duplicate,
        operator=record.operator,
        verified_at=record.verified_at,
        confirmed_at=record.confirmed_at,
        closed_at=record.closed_at,
        created_at=record.created_at,
        updated_at=record.updated_at
    )


@router.post("/{case_no}/cancel", response_model=CompensationResponse)
def cancel_compensation(
    case_no: str,
    operator: str,
    remark: str = "撤回申请",
    db: Session = Depends(get_db)
):
    service = CompensationService(db)
    record = service.cancel_record(case_no, operator, remark)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    db.commit()
    db.refresh(record)

    return CompensationResponse(
        id=record.id,
        batch_no=record.batch_no,
        case_no=record.case_no,
        user_id=record.user_id,
        pile_no=record.pile_no,
        order_no=record.order_no,
        fault_code=record.fault_code,
        fault_category=record.fault_category,
        description=record.description,
        status=record.status,
        conclusion=record.conclusion,
        suggestion=record.suggestion,
        compensation_amount=record.compensation_amount,
        is_duplicate=record.is_duplicate,
        operator=record.operator,
        verified_at=record.verified_at,
        confirmed_at=record.confirmed_at,
        closed_at=record.closed_at,
        created_at=record.created_at,
        updated_at=record.updated_at
    )


@router.post("/{case_no}/rejudge", response_model=CompensationResponse)
def rejudge_compensation(
    case_no: str,
    request: RejudgeRequest,
    db: Session = Depends(get_db)
):
    service = CompensationService(db)
    try:
        record = service.rejudge_record(
            case_no=case_no,
            operator=request.operator,
            new_status=request.new_status,
            conclusion=request.conclusion,
            compensation_amount=request.compensation_amount,
            remark=request.remark
        )
        if not record:
            raise HTTPException(status_code=404, detail="记录不存在")

        db.commit()
        db.refresh(record)

        return CompensationResponse(
            id=record.id,
            batch_no=record.batch_no,
            case_no=record.case_no,
            user_id=record.user_id,
            pile_no=record.pile_no,
            order_no=record.order_no,
            fault_code=record.fault_code,
            fault_category=record.fault_category,
            description=record.description,
            status=record.status,
            conclusion=record.conclusion,
            suggestion=record.suggestion,
            compensation_amount=record.compensation_amount,
            is_duplicate=record.is_duplicate,
            operator=record.operator,
            verified_at=record.verified_at,
            confirmed_at=record.confirmed_at,
            closed_at=record.closed_at,
            created_at=record.created_at,
            updated_at=record.updated_at
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{case_no}/logs", response_model=List[OperationLogResponse])
def get_operation_logs(
    case_no: str,
    db: Session = Depends(get_db)
):
    service = CompensationService(db)
    record = service.get_record(case_no)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    logs = service.get_operation_logs(record.id)
    return [OperationLogResponse(
        id=log.id,
        operation=log.operation,
        old_status=log.old_status,
        new_status=log.new_status,
        operator=log.operator,
        remark=log.remark,
        created_at=log.created_at
    ) for log in logs]
