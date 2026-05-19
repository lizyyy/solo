from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas
import services

router = APIRouter(tags=["记录管理"])


@router.get("", response_model=schemas.PaginatedResponse)
def get_records(
    floor: str = None,
    area: str = None,
    maintenance_person: str = None,
    status: str = None,
    has_exception: bool = None,
    batch_id: int = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db)
):
    params = schemas.QueryParams(
        floor=floor,
        area=area,
        maintenance_person=maintenance_person,
        status=status,
        has_exception=has_exception,
        batch_id=batch_id,
        page=page,
        page_size=page_size
    )
    total, records = services.query_records(db, params)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": records
    }


@router.post("/query", response_model=schemas.PaginatedResponse)
def query_records_post(
    params: schemas.QueryParams,
    db: Session = Depends(get_db)
):
    total, records = services.query_records(db, params)
    return {
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "data": records
    }


@router.get("/{record_id}", response_model=schemas.RecordDetailResponse)
def get_record_detail(record_id: int, db: Session = Depends(get_db)):
    record = services.get_record_detail(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    equipment = db.query(models.Equipment).filter(
        models.Equipment.equipment_code == record.equipment_code
    ).first()

    contracts = db.query(models.Contract).filter(
        models.Contract.equipment_code == record.equipment_code
    ).all()

    photos = db.query(models.InspectionPhoto).filter(
        models.InspectionPhoto.equipment_code == record.equipment_code
    ).all()

    result = record.__dict__
    result["equipment"] = equipment
    result["contracts"] = contracts
    result["photos"] = photos

    return result


@router.post("/{record_id}/handle", response_model=schemas.MaintenanceRecordResponse)
def handle_record(
    record_id: int,
    request: schemas.HandleRecordRequest,
    db: Session = Depends(get_db)
):
    record = services.handle_record(db, record_id, request)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@router.get("/{record_id}/audit-logs", response_model=List[schemas.AuditLogResponse])
def get_record_audit_logs(record_id: int, db: Session = Depends(get_db)):
    return services.get_audit_logs_by_record(db, record_id)


@router.post("/{record_id}/add-record")
def add_single_record(
    batch_id: int,
    record_data: schemas.MaintenanceRecordBase,
    db: Session = Depends(get_db)
):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    record = services.create_maintenance_record(db, batch_id, record_data)
    return {"message": "记录创建成功", "record_number": record.record_number}
