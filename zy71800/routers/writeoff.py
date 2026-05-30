import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from models import OccupationWriteoff, WriteoffChangeLog, CreditLedger, TransactionFlow
from schemas import (
    WriteoffCreate, WriteoffReview, WriteoffCorrect, WriteoffOut,
    WriteoffTraceOut, ChangeLogOut, SupplementaryAlert,
)
from services.writeoff_service import create_writeoff, review_writeoff, correct_writeoff, supplement_writeoff_transactions

router = APIRouter(prefix="/api/writeoff", tags=["备用金占用冲销"])


@router.post("/", response_model=WriteoffOut)
def create(data: WriteoffCreate, db: Session = Depends(get_db)):
    writeoff = create_writeoff(db, data.model_dump())
    return _serialize_writeoff(writeoff)


@router.get("/", response_model=List[WriteoffOut])
def list_writeoffs(
    customer_id: Optional[str] = None,
    status: Optional[str] = None,
    risk_tag: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(OccupationWriteoff)
    if customer_id:
        query = query.filter(OccupationWriteoff.customer_id == customer_id)
    if status:
        query = query.filter(OccupationWriteoff.status == status)
    results = query.offset(skip).limit(limit).all()
    if risk_tag:
        results = [w for w in results if risk_tag in w.get_risk_tags()]
    return [_serialize_writeoff(w) for w in results]


@router.get("/pending", response_model=List[WriteoffOut])
def list_pending(db: Session = Depends(get_db)):
    results = db.query(OccupationWriteoff).filter(
        OccupationWriteoff.status.in_(["pending_confirmation", "pending_review"])
    ).order_by(OccupationWriteoff.updated_at.desc()).all()
    return [_serialize_writeoff(w) for w in results]


@router.get("/{writeoff_id}", response_model=WriteoffOut)
def get_writeoff(writeoff_id: int, db: Session = Depends(get_db)):
    w = db.query(OccupationWriteoff).filter(OccupationWriteoff.id == writeoff_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="冲销记录不存在")
    return _serialize_writeoff(w)


@router.get("/{writeoff_id}/trace", response_model=WriteoffTraceOut)
def trace_writeoff(writeoff_id: int, db: Session = Depends(get_db)):
    w = db.query(OccupationWriteoff).filter(OccupationWriteoff.id == writeoff_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="冲销记录不存在")

    credit = None
    if w.credit_id:
        credit = db.query(CreditLedger).filter(CreditLedger.id == w.credit_id).first()

    tx_ids = w.get_transaction_ids()
    transactions = db.query(TransactionFlow).filter(TransactionFlow.id.in_(tx_ids)).all() if tx_ids else []

    change_logs = db.query(WriteoffChangeLog).filter(
        WriteoffChangeLog.writeoff_id == writeoff_id
    ).order_by(WriteoffChangeLog.created_at.desc()).all()

    return WriteoffTraceOut(
        writeoff=_serialize_writeoff(w),
        credit=credit,
        transactions=transactions,
        change_logs=change_logs,
    )


@router.put("/{writeoff_id}/review", response_model=WriteoffOut)
def review(writeoff_id: int, data: WriteoffReview, db: Session = Depends(get_db)):
    w = review_writeoff(db, writeoff_id, data.model_dump())
    if not w:
        raise HTTPException(status_code=404, detail="冲销记录不存在")
    return _serialize_writeoff(w)


@router.put("/{writeoff_id}/correct", response_model=WriteoffOut)
def correct(writeoff_id: int, data: WriteoffCorrect, db: Session = Depends(get_db)):
    w = correct_writeoff(db, writeoff_id, data.model_dump(exclude_none=True))
    if not w:
        raise HTTPException(status_code=404, detail="冲销记录不存在")
    return _serialize_writeoff(w)


@router.post("/{writeoff_id}/supplement", response_model=WriteoffOut)
def supplement_transactions(writeoff_id: int, new_transaction_ids: List[int], db: Session = Depends(get_db)):
    w, alerts = supplement_writeoff_transactions(db, writeoff_id, new_transaction_ids)
    if not w:
        raise HTTPException(status_code=404, detail="冲销记录不存在")
    return _serialize_writeoff(w)


@router.get("/{writeoff_id}/supplement-alerts", response_model=List[SupplementaryAlert])
def get_supplement_alerts(writeoff_id: int, db: Session = Depends(get_db)):
    logs = db.query(WriteoffChangeLog).filter(
        WriteoffChangeLog.writeoff_id == writeoff_id,
        WriteoffChangeLog.change_type == "supplement",
    ).order_by(WriteoffChangeLog.created_at.desc()).all()

    alerts = []
    for log in logs:
        old = json.loads(log.old_value) if log.old_value else {}
        new = json.loads(log.new_value) if log.new_value else {}
        changed = [k for k in new if k in old and new[k] != old[k]]
        if log.alert_level in ("warning", "critical"):
            alerts.append(SupplementaryAlert(
                writeoff_id=writeoff_id,
                customer_id="",
                changed_fields=changed,
                old_values=old,
                new_values=new,
                alert_level=log.alert_level,
                description=log.change_description or "",
            ))
    return alerts


@router.get("/history/{customer_id}", response_model=List[WriteoffOut])
def customer_history(customer_id: str, db: Session = Depends(get_db)):
    results = db.query(OccupationWriteoff).filter(
        OccupationWriteoff.customer_id == customer_id
    ).order_by(OccupationWriteoff.created_at.desc()).all()
    return [_serialize_writeoff(w) for w in results]


@router.get("/export/csv")
def export_csv(
    customer_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    import io, csv
    query = db.query(OccupationWriteoff)
    if customer_id:
        query = query.filter(OccupationWriteoff.customer_id == customer_id)
    if status:
        query = query.filter(OccupationWriteoff.status == status)
    results = query.order_by(OccupationWriteoff.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "客户ID", "客户名称", "占用金额", "冲销金额", "占用类型",
        "状态", "风险标记", "结论", "备注", "复核人", "复核日期", "版本", "创建时间", "更新时间"
    ])
    for w in results:
        writer.writerow([
            w.id, w.customer_id, w.customer_name, w.occupation_amount,
            w.writeoff_amount, w.occupation_type, w.status,
            ",".join(w.get_risk_tags()), w.conclusion, w.remarks,
            w.reviewer, str(w.review_date or ""), w.version,
            str(w.created_at or ""), str(w.updated_at or "")
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=writeoff_export.csv"},
    )


def _serialize_writeoff(w: OccupationWriteoff) -> WriteoffOut:
    return WriteoffOut(
        id=w.id,
        customer_id=w.customer_id,
        customer_name=w.customer_name,
        occupation_amount=w.occupation_amount,
        writeoff_amount=w.writeoff_amount,
        occupation_type=w.occupation_type,
        status=w.status,
        credit_id=w.credit_id,
        transaction_ids=w.get_transaction_ids(),
        conclusion=w.conclusion,
        evidence_refs=w.get_evidence_refs(),
        risk_tags=w.get_risk_tags(),
        remarks=w.remarks,
        reviewer=w.reviewer,
        review_date=w.review_date,
        version=w.version,
        created_at=w.created_at,
        updated_at=w.updated_at,
    )
