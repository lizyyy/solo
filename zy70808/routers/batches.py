from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas
import services

router = APIRouter(tags=["批次管理"])


@router.post("", response_model=schemas.BatchResponse)
def create_batch(batch: schemas.BatchCreate, db: Session = Depends(get_db)):
    return services.create_batch(db, batch)


@router.get("", response_model=List[schemas.BatchResponse])
def get_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    batches = db.query(models.Batch).order_by(models.Batch.created_at.desc())\
        .offset(skip).limit(limit).all()
    return batches


@router.get("/{batch_id}", response_model=schemas.BatchResponse)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@router.get("/{batch_id}/records", response_model=schemas.PaginatedResponse)
def get_batch_records(
    batch_id: int,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db)
):
    params = schemas.QueryParams(
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


@router.post("/{batch_id}/generate-records")
def generate_records_from_batch(
    batch_id: int,
    created_by: str,
    db: Session = Depends(get_db)
):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    equipments = db.query(models.Equipment).all()
    created_count = 0

    for eq in equipments:
        record_data = schemas.MaintenanceRecordBase(
            equipment_code=eq.equipment_code,
            equipment_name=eq.name,
            floor=eq.floor,
            area=eq.area,
            maintenance_person=eq.maintenance_person,
            inspection_date=eq.last_inspection_date,
            next_inspection_date=eq.next_inspection_date
        )
        services.create_maintenance_record(db, batch_id, record_data)
        created_count += 1

    return {
        "message": f"成功生成 {created_count} 条维保记录",
        "created_count": created_count
    }
