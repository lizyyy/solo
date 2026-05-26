from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Batch, RawMaterial, ProcessingDetail
from app.schemas import BatchCreate, BatchResponse, MaterialsUpload, MaterialResponse
from app.classifier import classify_material

router = APIRouter(prefix="/api/batches", tags=["批次管理"])


@router.post("", response_model=BatchResponse, status_code=201)
def create_batch(payload: BatchCreate, db: Session = Depends(get_db)):
    existing = db.query(Batch).filter(Batch.batch_no == payload.batch_no).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"批次号 {payload.batch_no} 已存在")
    batch = Batch(
        batch_no=payload.batch_no,
        submitter=payload.submitter,
        department=payload.department,
        source_type=payload.source_type,
        status="created",
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@router.get("", response_model=List[BatchResponse])
def list_batches(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Batch).order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{batch_id}", response_model=BatchResponse)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@router.post("/{batch_id}/materials", response_model=List[MaterialResponse], status_code=201)
def upload_materials(batch_id: int, payload: MaterialsUpload, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    line_nos = [item.line_no for item in payload.items]
    if len(line_nos) != len(set(line_nos)):
        raise HTTPException(status_code=400, detail="上传数据中存在重复行号")

    existing = db.query(RawMaterial).filter(RawMaterial.batch_id == batch_id).all()
    existing_lines = {m.line_no for m in existing}
    for ln in line_nos:
        if ln in existing_lines:
            raise HTTPException(status_code=400, detail=f"行号 {ln} 在批次中已存在")

    materials = []
    for item in payload.items:
        m = RawMaterial(
            batch_id=batch_id,
            line_no=item.line_no,
            artifact_no=item.artifact_no,
            artifact_name=item.artifact_name,
            borrower=item.borrower,
            lender=item.lender,
            loan_start=item.loan_start,
            loan_end=item.loan_end,
            insurance_value=item.insurance_value,
            insurance_type=item.insurance_type,
            condition=item.condition,
            location=item.location,
            remark=item.remark,
            raw_payload=item.model_dump(),
        )
        db.add(m)
        materials.append(m)
    db.flush()

    for m in materials:
        classify_material(db, batch_id, m)

    batch.status = "processing"
    db.commit()
    for m in materials:
        db.refresh(m)
    return materials


@router.get("/{batch_id}/materials", response_model=List[MaterialResponse])
def list_materials(batch_id: int, db: Session = Depends(get_db)):
    return db.query(RawMaterial).filter(RawMaterial.batch_id == batch_id).order_by(RawMaterial.line_no.asc()).all()


@router.get("/{batch_id}/details", response_model=List[dict])
def list_details(batch_id: int, category: str = None, db: Session = Depends(get_db)):
    q = db.query(ProcessingDetail).filter(ProcessingDetail.batch_id == batch_id)
    if category:
        q = q.filter(ProcessingDetail.category == category)
    details = q.order_by(ProcessingDetail.id.asc()).all()
    return [
        {
            "id": d.id,
            "raw_material_id": d.raw_material_id,
            "category": d.category,
            "reason_code": d.reason_code,
            "reason_detail": d.reason_detail,
            "next_action": d.next_action,
            "review_status": d.review_status,
            "reviewed_by": d.reviewed_by,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in details
    ]
