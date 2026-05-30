from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import IssueType, ProofreadRecord, RecordStatus, VALID_TRANSITIONS
from ..schemas import ProofreadRecordRead, StatusTransition

router = APIRouter(prefix="/records", tags=["records"])


@router.get("", response_model=list[ProofreadRecordRead])
def list_records(
    status: Optional[RecordStatus] = Query(None),
    issue_type: Optional[IssueType] = Query(None),
    full_score_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(ProofreadRecord)
    if status is not None:
        q = q.filter(ProofreadRecord.status == status)
    if issue_type is not None:
        q = q.filter(ProofreadRecord.issue_type == issue_type)
    if full_score_id is not None:
        q = q.filter(ProofreadRecord.full_score_id == full_score_id)
    return q.order_by(ProofreadRecord.id.desc()).all()


@router.get("/{record_id}", response_model=ProofreadRecordRead)
def get_record(record_id: int, db: Session = Depends(get_db)):
    row = db.query(ProofreadRecord).filter(ProofreadRecord.id == record_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail=f"校对记录 id={record_id} 不存在")
    return row


@router.patch("/{record_id}/status", response_model=ProofreadRecordRead)
def transition_status(
    record_id: int,
    body: StatusTransition,
    db: Session = Depends(get_db),
):
    row = db.query(ProofreadRecord).filter(ProofreadRecord.id == record_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail=f"校对记录 id={record_id} 不存在")

    allowed = VALID_TRANSITIONS.get(row.status, set())
    if body.target_status not in allowed:
        raise HTTPException(
            status_code=409,
            detail=(
                f"记录当前状态为「{row.status.value}」，"
                f"不允许直接变更为「{body.target_status.value}」。"
                f"允许的目标状态：{[s.value for s in allowed]}。"
            ),
        )

    row.status = body.target_status
    db.commit()
    db.refresh(row)
    return row


@router.get("/summary/by-status", response_model=dict)
def summary_by_status(db: Session = Depends(get_db)):
    from sqlalchemy import func

    rows = (
        db.query(ProofreadRecord.status, func.count(ProofreadRecord.id))
        .group_by(ProofreadRecord.status)
        .all()
    )
    return {status.value: count for status, count in rows}


@router.get("/summary/by-issue-type", response_model=dict)
def summary_by_issue_type(db: Session = Depends(get_db)):
    from sqlalchemy import func

    rows = (
        db.query(ProofreadRecord.issue_type, func.count(ProofreadRecord.id))
        .group_by(ProofreadRecord.issue_type)
        .all()
    )
    return {itype.value: count for itype, count in rows}
