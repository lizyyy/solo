from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/samples", tags=["samples"])


@router.get("/", response_model=List[schemas.Sample])
def list_samples(
    ticket_id: Optional[int] = None,
    status: Optional[str] = None,
    is_low_confidence: Optional[bool] = None,
    is_hidden_by_avg: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Sample)
    if ticket_id:
        query = query.filter(models.Sample.ticket_id == ticket_id)
    if status:
        query = query.filter(models.Sample.status == status)
    if is_low_confidence is not None:
        query = query.filter(models.Sample.is_low_confidence == is_low_confidence)
    if is_hidden_by_avg is not None:
        query = query.filter(models.Sample.is_hidden_by_avg == is_hidden_by_avg)
    return query.order_by(models.Sample.id).all()


@router.get("/{sample_id}", response_model=schemas.Sample)
def get_sample(sample_id: int, db: Session = Depends(get_db)):
    sample = db.query(models.Sample).filter(models.Sample.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="样本不存在")
    return sample


@router.put("/{sample_id}", response_model=schemas.Sample)
def update_sample(
    sample_id: int,
    data: schemas.SampleUpdate,
    operator: str = "system",
    db: Session = Depends(get_db)
):
    sample = db.query(models.Sample).filter(models.Sample.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="样本不存在")

    before = {
        "expected_rank": sample.expected_rank,
        "status": sample.status,
        "manual_note": sample.manual_note,
        "is_hidden_by_avg": sample.is_hidden_by_avg
    }

    if data.expected_rank is not None:
        sample.expected_rank = data.expected_rank
    if data.status is not None:
        sample.status = data.status
    if data.manual_note is not None:
        sample.manual_note = data.manual_note
    if data.is_hidden_by_avg is not None:
        sample.is_hidden_by_avg = data.is_hidden_by_avg

    after = {
        "expected_rank": sample.expected_rank,
        "status": sample.status,
        "manual_note": sample.manual_note,
        "is_hidden_by_avg": sample.is_hidden_by_avg
    }

    audit = models.AuditLog(
        ticket_id=sample.ticket_id,
        sample_id=sample.id,
        action="更新样本",
        operator=operator,
        before_value=before,
        after_value=after
    )
    db.add(audit)
    db.commit()
    db.refresh(sample)

    return sample


@router.post("/{sample_id}/versions", response_model=schemas.SampleVersion)
def add_sample_version(
    sample_id: int,
    data: schemas.SampleVersionCreate,
    db: Session = Depends(get_db)
):
    sample = db.query(models.Sample).filter(models.Sample.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="样本不存在")

    version = models.SampleVersion(
        sample_id=sample_id,
        model_version_id=data.model_version_id,
        rank=data.rank,
        score=data.score,
        is_manual_modified=data.is_manual_modified
    )
    db.add(version)
    db.commit()
    db.refresh(version)

    return version
