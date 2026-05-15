from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from ..database import get_db
from ..models import (
    Inspection, InspectionRecord, InspectionItem, Store,
    InspectionStatus, Rectification, RectificationStatus, PhotoType,
    PhotoEvidence, RectificationEvent
)
from ..schemas import (
    InspectionCreate, InspectionResponse,
    InspectionRecordCreate, InspectionRecordResponse,
    RectificationCreate, RectificationResponse,
    RectificationSubmit, RectificationRecheck,
    PhotoEvidenceResponse, EventResponse
)
from ..services import (
    BusinessRuleError, ConflictError,
    start_rectification, submit_rectification,
    start_recheck, complete_recheck,
    retry_rectification, cancel_rectification,
    check_overdue, get_rectification_trace
)

router = APIRouter(prefix="/api/inspections", tags=["巡检与整改"])


@router.post("", response_model=InspectionResponse, status_code=201)
def create_inspection(data: InspectionCreate, db: Session = Depends(get_db)):
    store = db.query(Store).filter(Store.id == data.store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="门店不存在")
    if not store.is_active:
        raise HTTPException(status_code=400, detail="门店已停用")

    inspection = Inspection(**data.dict())
    db.add(inspection)
    db.commit()
    db.refresh(inspection)

    result = InspectionResponse(
        id=inspection.id,
        store_id=inspection.store_id,
        store_name=store.name,
        inspector=inspection.inspector,
        inspection_date=inspection.inspection_date,
        status=inspection.status,
        remark=inspection.remark,
        created_at=inspection.created_at,
        updated_at=inspection.updated_at
    )
    return result


@router.get("", response_model=List[InspectionResponse])
def list_inspections(
    store_id: Optional[int] = None,
    status: Optional[InspectionStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Inspection, Store).join(Store)
    if store_id:
        query = query.filter(Inspection.store_id == store_id)
    if status:
        query = query.filter(Inspection.status == status)

    results = query.offset(skip).limit(limit).all()
    return [
        InspectionResponse(
            id=inspection.id,
            store_id=inspection.store_id,
            store_name=store.name,
            inspector=inspection.inspector,
            inspection_date=inspection.inspection_date,
            status=inspection.status,
            remark=inspection.remark,
            created_at=inspection.created_at,
            updated_at=inspection.updated_at
        )
        for inspection, store in results
    ]


@router.post("/{inspection_id}/records", response_model=InspectionRecordResponse, status_code=201)
def add_inspection_record(
    inspection_id: int,
    data: InspectionRecordCreate,
    db: Session = Depends(get_db)
):
    inspection = db.query(Inspection).filter(
        Inspection.id == inspection_id
    ).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="巡检不存在")
    if inspection.status not in [InspectionStatus.PENDING, InspectionStatus.IN_PROGRESS]:
        raise HTTPException(
            status_code=400,
            detail=f"巡检状态 {inspection.status.value} 不允许添加记录"
        )

    item = db.query(InspectionItem).filter(
        InspectionItem.id == data.item_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="巡检项不存在")

    if inspection.status == InspectionStatus.PENDING:
        inspection.status = InspectionStatus.IN_PROGRESS

    score = item.base_score if data.is_pass else 0.0
    deduction = 0.0 if data.is_pass else item.base_score

    record = InspectionRecord(
        inspection_id=inspection_id,
        item_id=data.item_id,
        is_pass=data.is_pass,
        score=score,
        deduction=deduction,
        deduction_reason=data.deduction_reason,
        remark=data.remark
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return InspectionRecordResponse(
        id=record.id,
        inspection_id=record.inspection_id,
        item_id=record.item_id,
        item_name=item.name,
        item_category=item.category,
        is_pass=record.is_pass,
        score=record.score,
        deduction=record.deduction,
        deduction_reason=record.deduction_reason,
        remark=record.remark,
        created_at=record.created_at,
        updated_at=record.updated_at
    )


@router.get("/{inspection_id}/records", response_model=List[InspectionRecordResponse])
def list_inspection_records(inspection_id: int, db: Session = Depends(get_db)):
    records = db.query(InspectionRecord, InspectionItem).join(InspectionItem).filter(
        InspectionRecord.inspection_id == inspection_id
    ).all()
    return [
        InspectionRecordResponse(
            id=record.id,
            inspection_id=record.inspection_id,
            item_id=record.item_id,
            item_name=item.name,
            item_category=item.category,
            is_pass=record.is_pass,
            score=record.score,
            deduction=record.deduction,
            deduction_reason=record.deduction_reason,
            remark=record.remark,
            created_at=record.created_at,
            updated_at=record.updated_at
        )
        for record, item in records
    ]


@router.post("/{inspection_id}/complete")
def complete_inspection(inspection_id: int, db: Session = Depends(get_db)):
    inspection = db.query(Inspection).filter(
        Inspection.id == inspection_id
    ).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="巡检不存在")

    if inspection.status == InspectionStatus.COMPLETED:
        return {"message": "巡检已完成", "inspection_id": inspection_id}

    if inspection.status != InspectionStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail=f"巡检状态 {inspection.status.value} 不允许完成"
        )

    inspection.status = InspectionStatus.COMPLETED
    db.commit()
    return {"message": "巡检已完成", "inspection_id": inspection_id}


@router.post("/rectifications", response_model=RectificationResponse, status_code=201)
def create_rectification(data: RectificationCreate, db: Session = Depends(get_db)):
    record = db.query(InspectionRecord).filter(
        InspectionRecord.id == data.record_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="巡检记录不存在")
    if record.is_pass:
        raise HTTPException(status_code=400, detail="该巡检项已通过，无需整改")

    existing = db.query(Rectification).filter(
        Rectification.record_id == data.record_id,
        Rectification.status.in_([
            RectificationStatus.ASSIGNED,
            RectificationStatus.RECTIFYING,
            RectificationStatus.SUBMITTED,
            RectificationStatus.RECHECKING,
            RectificationStatus.REJECTED
        ])
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"该记录已有进行中的整改任务 #{existing.id}"
        )

    rect = Rectification(
        record_id=data.record_id,
        assignee=data.assignee,
        deadline=data.deadline
    )
    db.add(rect)
    db.commit()
    db.refresh(rect)

    return RectificationResponse(
        id=rect.id,
        record_id=rect.record_id,
        assignee=rect.assignee,
        status=rect.status,
        deadline=rect.deadline,
        retry_count=rect.retry_count,
        created_at=rect.created_at,
        updated_at=rect.updated_at
    )


@router.get("/rectifications", response_model=List[RectificationResponse])
def list_rectifications(
    assignee: Optional[str] = None,
    status: Optional[RectificationStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Rectification)
    if assignee:
        query = query.filter(Rectification.assignee == assignee)
    if status:
        query = query.filter(Rectification.status == status)
    return query.offset(skip).limit(limit).all()


@router.get("/rectifications/{rect_id}", response_model=RectificationResponse)
def get_rectification(rect_id: int, db: Session = Depends(get_db)):
    rect = db.query(Rectification).filter(Rectification.id == rect_id).first()
    if not rect:
        raise HTTPException(status_code=404, detail="整改任务不存在")

    check_overdue(db, rect)
    db.commit()
    return rect


@router.post("/rectifications/{rect_id}/start")
def start_rect(
    rect_id: int,
    data: dict = Body(default_factory=dict),
    db: Session = Depends(get_db)
):
    try:
        actor = data.get("actor")
        rect = start_rectification(db, rect_id, actor)
        db.commit()
        return {
            "message": "开始整改",
            "rectification_id": rect_id,
            "status": rect.status.value
        }
    except ConflictError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=e.message)
    except BusinessRuleError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/rectifications/{rect_id}/submit")
def submit_rect(
    rect_id: int,
    data: RectificationSubmit,
    db: Session = Depends(get_db)
):
    try:
        rect = submit_rectification(
            db, rect_id, data.rectification_description,
            None, None
        )
        db.commit()
        return {
            "message": "整改已提交",
            "rectification_id": rect_id,
            "status": rect.status.value
        }
    except ConflictError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=e.message)
    except BusinessRuleError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/rectifications/{rect_id}/start-recheck")
def start_rect_recheck(
    rect_id: int,
    data: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        rechecker = data.get("rechecker")
        if not rechecker:
            raise HTTPException(status_code=400, detail="rechecker 不能为空")
        rect = start_recheck(db, rect_id, rechecker)
        db.commit()
        return {
            "message": "开始复查",
            "rectification_id": rect_id,
            "status": rect.status.value,
            "rechecker": rect.rechecker
        }
    except ConflictError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=e.message)
    except BusinessRuleError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/rectifications/{rect_id}/complete-recheck")
def complete_rect_recheck(
    rect_id: int,
    data: RectificationRecheck,
    level: int = 1,
    db: Session = Depends(get_db)
):
    try:
        passed = data.recheck_result.lower() == "通过" or data.recheck_result.lower() == "pass"
        rect = complete_recheck(
            db, rect_id, passed, data.recheck_result,
            data.recheck_remark, None, level
        )
        db.commit()
        return {
            "message": "复查完成",
            "rectification_id": rect_id,
            "status": rect.status.value,
            "final_score": rect.final_score,
            "final_deduction": rect.final_deduction
        }
    except ConflictError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=e.message)
    except BusinessRuleError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/rectifications/{rect_id}/retry", response_model=RectificationResponse)
def retry_rect(
    rect_id: int,
    data: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        new_deadline_str = data.get("new_deadline")
        new_assignee = data.get("new_assignee")
        actor = data.get("actor")

        if not new_deadline_str:
            raise HTTPException(status_code=400, detail="new_deadline 不能为空")

        if isinstance(new_deadline_str, str):
            new_deadline = datetime.fromisoformat(new_deadline_str.replace('Z', '+00:00'))
        else:
            new_deadline = new_deadline_str

        new_rect = retry_rectification(
            db, rect_id, new_deadline, new_assignee, actor
        )
        db.commit()
        db.refresh(new_rect)
        return new_rect
    except BusinessRuleError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/rectifications/{rect_id}/cancel")
def cancel_rect(
    rect_id: int,
    data: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        reason = data.get("reason")
        actor = data.get("actor")
        if not reason:
            raise HTTPException(status_code=400, detail="reason 不能为空")

        rect = cancel_rectification(db, rect_id, reason, actor)
        db.commit()
        return {
            "message": "整改已撤销",
            "rectification_id": rect_id,
            "status": rect.status.value
        }
    except BusinessRuleError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/rectifications/{rect_id}/trace")
def get_rect_trace(rect_id: int, db: Session = Depends(get_db)):
    trace = get_rectification_trace(db, rect_id)
    if not trace:
        raise HTTPException(status_code=404, detail="整改任务不存在")

    rect = trace["rectification"]
    check_overdue(db, rect)
    db.commit()

    return {
        "rectification": {
            "id": rect.id,
            "status": rect.status.value,
            "assignee": rect.assignee,
            "deadline": rect.deadline,
            "retry_count": rect.retry_count,
            "final_score": rect.final_score,
            "final_deduction": rect.final_deduction
        },
        "retry_chain": trace["retry_chain"],
        "events": [
            {
                "time": e.created_at,
                "type": e.event_type,
                "from": e.from_status.value if e.from_status else None,
                "to": e.to_status.value,
                "actor": e.actor,
                "description": e.description
            }
            for e in trace["events"]
        ],
        "photos": [
            {
                "id": p.id,
                "type": p.photo_type.value,
                "file_name": p.file_name,
                "uploaded_by": p.uploaded_by,
                "upload_time": p.upload_time
            }
            for p in trace["photos"]
        ]
    }


@router.get("/rectifications/{rect_id}/events", response_model=List[EventResponse])
def list_rect_events(rect_id: int, db: Session = Depends(get_db)):
    events = db.query(RectificationEvent).filter(
        RectificationEvent.rectification_id == rect_id
    ).order_by(RectificationEvent.created_at).all()
    return events
