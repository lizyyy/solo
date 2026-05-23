from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import User, UserRole, DataSource, Batch
from app.schemas.schemas import (
    RequisitionCreate,
    RequisitionResponse,
    PurchaseArrivalCreate,
    PurchaseArrivalResponse,
    TeacherSignCreate,
    TeacherSignResponse,
    ImportResult,
    FailedRecordResponse
)
from app.utils.security import get_current_active_user, require_role
from app.services.import_service import IdempotentImportService

router = APIRouter(prefix="/import", tags=["数据导入"])


@router.post("/requisitions", response_model=RequisitionResponse)
async def import_requisition(
    data: RequisitionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY, UserRole.TEACHER]))
):
    if current_user.role == UserRole.COLLEGE_SECRETARY and data.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权导入其他学院的数据")

    if data.batch_id:
        batch = db.query(Batch).filter(Batch.id == data.batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="批次不存在")
        if batch.is_frozen:
            raise HTTPException(status_code=400, detail="批次已冻结，无法导入数据")

    record, updated = IdempotentImportService.import_requisition(db, data)
    if not record:
        raise HTTPException(status_code=500, detail="导入失败，请查看失败记录")

    db.commit()
    db.refresh(record)
    return record


@router.post("/purchase-arrivals", response_model=PurchaseArrivalResponse)
async def import_purchase_arrival(
    data: PurchaseArrivalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY, UserRole.SUPPLIER]))
):
    if current_user.role == UserRole.COLLEGE_SECRETARY and data.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权导入其他学院的数据")

    if data.batch_id:
        batch = db.query(Batch).filter(Batch.id == data.batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="批次不存在")
        if batch.is_frozen:
            raise HTTPException(status_code=400, detail="批次已冻结，无法导入数据")

    record, updated = IdempotentImportService.import_purchase_arrival(db, data)
    if not record:
        raise HTTPException(status_code=500, detail="导入失败，请查看失败记录")

    db.commit()
    db.refresh(record)
    return record


@router.post("/teacher-signs", response_model=TeacherSignResponse)
async def import_teacher_sign(
    data: TeacherSignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY, UserRole.TEACHER]))
):
    if current_user.role == UserRole.COLLEGE_SECRETARY and data.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权导入其他学院的数据")

    if data.batch_id:
        batch = db.query(Batch).filter(Batch.id == data.batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="批次不存在")
        if batch.is_frozen:
            raise HTTPException(status_code=400, detail="批次已冻结，无法导入数据")

    record, updated = IdempotentImportService.import_teacher_sign(db, data)
    if not record:
        raise HTTPException(status_code=500, detail="导入失败，请查看失败记录")

    db.commit()
    db.refresh(record)
    return record


@router.post("/requisitions/batch", response_model=ImportResult)
async def batch_import_requisitions(
    items: List[RequisitionCreate],
    batch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY]))
):
    if batch_id:
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="批次不存在")
        if batch.is_frozen:
            raise HTTPException(status_code=400, detail="批次已冻结，无法导入数据")

    success_count = 0
    failed_count = 0
    updated_count = 0

    for item in items:
        if current_user.role == UserRole.COLLEGE_SECRETARY and item.college != current_user.college:
            failed_count += 1
            continue

        record, updated = IdempotentImportService.import_requisition(db, item, batch_id)
        if record:
            success_count += 1
            if updated:
                updated_count += 1
        else:
            failed_count += 1

    db.commit()

    failed_records = IdempotentImportService.get_failed_records(
        db, source_type=DataSource.REQUISITION, batch_id=batch_id, resolved=False, limit=failed_count
    )

    return ImportResult(
        success_count=success_count,
        failed_count=failed_count,
        updated_count=updated_count,
        failed_records=[FailedRecordResponse.model_validate(r) for r in failed_records]
    )


@router.get("/failed-records", response_model=List[FailedRecordResponse])
async def list_failed_records(
    source_type: Optional[DataSource] = None,
    batch_id: Optional[int] = None,
    resolved: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY]))
):
    records = IdempotentImportService.get_failed_records(
        db, source_type=source_type, batch_id=batch_id, resolved=resolved, skip=skip, limit=limit
    )
    return records
