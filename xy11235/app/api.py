from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from .database import get_db
from .models import RecordStatus, ExceptionType, User, Reagent
from .schemas import (
    UserCreate, User as UserSchema,
    ReagentCreate, Reagent as ReagentSchema, ReagentUpdate,
    ReagentRecordCreate, ReagentRecordBatchCreate, ReagentRecord as RecordSchema,
    ReagentRecordApprove, ReagentRecordBatchApprove,
    BatchOperationResult, PaginatedResponse
)
from .services import (
    create_reagent_record, create_batch_records, retry_failed_batch_records,
    approve_record, batch_approve_records, dispense_record, query_records
)
from .export import export_records_to_excel

router = APIRouter()


@router.post("/users/", response_model=UserSchema)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.employee_id == user.employee_id).first()
    if db_user:
        raise HTTPException(status_code=400, detail="工号已存在")
    db_user = User(**user.model_dump())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("/users/", response_model=list[UserSchema])
def get_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.post("/reagents/", response_model=ReagentSchema)
def create_reagent(reagent: ReagentCreate, db: Session = Depends(get_db)):
    db_reagent = Reagent(**reagent.model_dump())
    db.add(db_reagent)
    db.commit()
    db.refresh(db_reagent)
    return db_reagent


@router.get("/reagents/", response_model=list[ReagentSchema])
def get_reagents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    reagents = db.query(Reagent).offset(skip).limit(limit).all()
    return reagents


@router.get("/reagents/{reagent_id}", response_model=ReagentSchema)
def get_reagent(reagent_id: int, db: Session = Depends(get_db)):
    reagent = db.query(Reagent).filter(Reagent.id == reagent_id).first()
    if not reagent:
        raise HTTPException(status_code=404, detail="试剂不存在")
    return reagent


@router.put("/reagents/{reagent_id}", response_model=ReagentSchema)
def update_reagent(reagent_id: int, reagent_update: ReagentUpdate, db: Session = Depends(get_db)):
    db_reagent = db.query(Reagent).filter(Reagent.id == reagent_id).first()
    if not db_reagent:
        raise HTTPException(status_code=404, detail="试剂不存在")
    update_data = reagent_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_reagent, key, value)
    db.commit()
    db.refresh(db_reagent)
    return db_reagent


@router.post("/records/", response_model=RecordSchema)
def create_record(record: ReagentRecordCreate, db: Session = Depends(get_db)):
    db_record = create_reagent_record(db, record)
    db.commit()
    db.refresh(db_record)
    return db_record


@router.post("/records/batch/", response_model=BatchOperationResult)
def create_records_batch(batch_data: ReagentRecordBatchCreate, db: Session = Depends(get_db)):
    return create_batch_records(db, batch_data)


@router.post("/records/batch/{batch_id}/retry", response_model=dict)
def retry_batch_records(batch_id: str, db: Session = Depends(get_db)):
    try:
        return retry_failed_batch_records(db, batch_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/records/{record_id}/approve", response_model=RecordSchema)
def approve_single_record(record_id: int, approve_data: ReagentRecordApprove, db: Session = Depends(get_db)):
    try:
        return approve_record(db, record_id, approve_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/records/batch/approve", response_model=BatchOperationResult)
def approve_records_batch(batch_approve_data: ReagentRecordBatchApprove, db: Session = Depends(get_db)):
    return batch_approve_records(db, batch_approve_data)


@router.put("/records/{record_id}/dispense", response_model=RecordSchema)
def dispense_single_record(record_id: int, dispensed_by_id: int = Query(..., description="发放人ID"), db: Session = Depends(get_db)):
    try:
        return dispense_record(db, record_id, dispensed_by_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/records/", response_model=PaginatedResponse)
def get_records(
    recipient_id: Optional[int] = None,
    created_by_id: Optional[int] = None,
    approved_by_id: Optional[int] = None,
    status: Optional[RecordStatus] = None,
    exception_type: Optional[ExceptionType] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    total, records = query_records(
        db, recipient_id, created_by_id, approved_by_id,
        status, exception_type, start_date, end_date, page, page_size
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": records
    }


@router.get("/records/export")
def export_records(
    recipient_id: Optional[int] = None,
    created_by_id: Optional[int] = None,
    approved_by_id: Optional[int] = None,
    status: Optional[RecordStatus] = None,
    exception_type: Optional[ExceptionType] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    output = export_records_to_excel(
        db, recipient_id, created_by_id, approved_by_id,
        status, exception_type, start_date, end_date
    )
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"reagent_records_{timestamp}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/records/{record_id}", response_model=RecordSchema)
def get_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(Reagent).filter(Reagent.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record
