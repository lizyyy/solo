from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import PracticeRecord, ConfirmationRecord, AuditLog
from schemas import ConfirmationCreate, ConfirmationOut

router = APIRouter(prefix="/api/confirmations", tags=["confirmations"])


@router.post("", response_model=ConfirmationOut)
def create_confirmation(data: ConfirmationCreate, db: Session = Depends(get_db)):
    record = (
        db.query(PracticeRecord)
        .filter(PracticeRecord.id == data.practice_record_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="练习记录不存在")

    previous_status = record.confirmation_status

    if data.action == "confirm":
        new_status = "confirmed"
    elif data.action == "reject":
        new_status = "rejected"
    else:
        raise HTTPException(status_code=400, detail="action 必须是 confirm 或 reject")

    if previous_status == new_status:
        raise HTTPException(
            status_code=400,
            detail=f"记录已经是 {new_status} 状态，无需重复操作",
        )

    before_state = {
        "record_id": record.id,
        "confirmation_status": previous_status,
        "confirmed_by": record.confirmed_by,
        "confirmed_at": record.confirmed_at.isoformat() if record.confirmed_at else None,
        "mean_deviation_ms": record.mean_deviation_ms,
        "weak_beat_misjudgment_flagged": record.weak_beat_misjudgment_flagged,
        "missing_segment_flagged": record.missing_segment_flagged,
    }

    record.confirmation_status = new_status
    record.confirmed_by = data.operator
    record.confirmed_at = datetime.utcnow()
    db.commit()
    db.refresh(record)

    after_state = {
        "record_id": record.id,
        "confirmation_status": new_status,
        "confirmed_by": data.operator,
        "confirmed_at": record.confirmed_at.isoformat(),
        "mean_deviation_ms": record.mean_deviation_ms,
        "weak_beat_misjudgment_flagged": record.weak_beat_misjudgment_flagged,
        "missing_segment_flagged": record.missing_segment_flagged,
    }

    confirmation = ConfirmationRecord(
        practice_record_id=data.practice_record_id,
        action=data.action,
        previous_status=previous_status,
        new_status=new_status,
        operator=data.operator,
        note=data.note,
    )
    db.add(confirmation)
    db.commit()
    db.refresh(confirmation)

    audit = AuditLog(
        entity_type="practice_record",
        entity_id=record.id,
        action=f"confirm_{data.action}",
        before_state=before_state,
        after_state=after_state,
        operator=data.operator,
    )
    db.add(audit)
    db.commit()

    return confirmation


@router.get("/history/{record_id}")
def get_confirmation_history(record_id: int, db: Session = Depends(get_db)):
    record = (
        db.query(PracticeRecord).filter(PracticeRecord.id == record_id).first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="练习记录不存在")

    confirmations = (
        db.query(ConfirmationRecord)
        .filter(ConfirmationRecord.practice_record_id == record_id)
        .order_by(ConfirmationRecord.created_at)
        .all()
    )

    audits = (
        db.query(AuditLog)
        .filter(
            AuditLog.entity_type == "practice_record",
            AuditLog.entity_id == record_id,
            AuditLog.action.like("confirm_%"),
        )
        .order_by(AuditLog.created_at)
        .all()
    )

    return {
        "record_id": record_id,
        "current_status": record.confirmation_status,
        "confirmed_by": record.confirmed_by,
        "confirmed_at": record.confirmed_at.isoformat() if record.confirmed_at else None,
        "confirmation_records": [
            {
                "id": c.id,
                "action": c.action,
                "previous_status": c.previous_status,
                "new_status": c.new_status,
                "operator": c.operator,
                "note": c.note,
                "created_at": c.created_at.isoformat(),
            }
            for c in confirmations
        ],
        "audit_trail": [
            {
                "id": a.id,
                "action": a.action,
                "before_state": a.before_state,
                "after_state": a.after_state,
                "operator": a.operator,
                "created_at": a.created_at.isoformat(),
            }
            for a in audits
        ],
    }
