from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.models import get_db, ProcessingStatus
from app.schemas import (
    BatchCreate,
    Batch as BatchSchema,
    BatchPreviewResult,
    BatchQueryFilter,
    EvidenceRecord as EvidenceRecordSchema,
    EvidenceRecordUpdate,
)
from app.services.evidence_service import BatchService

router = APIRouter(prefix="/batches", tags=["batches"])


@router.post("/preview", response_model=BatchPreviewResult)
def preview_batch(batch_data: BatchCreate, db: Session = Depends(get_db)):
    return BatchService.preview_batch(db, batch_data)


@router.post("/", response_model=BatchSchema)
def create_batch(batch_data: BatchCreate, db: Session = Depends(get_db)):
    try:
        batch, reused = BatchService.create_batch(db, batch_data)
        return batch
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/", response_model=List[BatchSchema])
def list_batches(
    batch_no: Optional[str] = None,
    operator: Optional[str] = None,
    risk_type: Optional[str] = None,
    environment_name: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    filter_params = BatchQueryFilter(
        batch_no=batch_no,
        operator=operator,
        risk_type=risk_type,
        environment_name=environment_name,
        status=status,
    )
    return BatchService.list_batches(db, filter_params, skip, limit)


@router.get("/{batch_id}", response_model=BatchSchema)
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    batch = BatchService.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次未找到")
    return batch


@router.get("/{batch_id}/records", response_model=List[EvidenceRecordSchema])
def get_evidence_records(batch_id: str, db: Session = Depends(get_db)):
    batch = BatchService.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次未找到")
    return BatchService.get_evidence_records(db, batch_id)


@router.patch("/records/{record_id}", response_model=EvidenceRecordSchema)
def update_evidence_record(
    record_id: str,
    update_data: EvidenceRecordUpdate,
    db: Session = Depends(get_db),
):
    record = BatchService.update_evidence_record(
        db,
        record_id,
        update_data.status,
        update_data.error_message,
    )
    if not record:
        raise HTTPException(status_code=404, detail="取证记录未找到")
    return record
