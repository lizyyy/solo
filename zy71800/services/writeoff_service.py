import json
from datetime import datetime
from sqlalchemy.orm import Session
from models import OccupationWriteoff, WriteoffChangeLog, CreditAlert
from services.detection_service import detect_duplicate_credit, detect_manual_overwrite
from services.change_tracker import log_change, compare_and_alert_supplementary


def create_writeoff(db: Session, data: dict) -> OccupationWriteoff:
    risk_tags = []
    evidence = {}

    if data.get("credit_id"):
        dups = detect_duplicate_credit(
            db, data["customer_id"], data.get("occupation_type", ""), exclude_id=data.get("credit_id")
        )
        if len(dups) > 1:
            risk_tags.append("duplicate_credit")
            evidence["duplicate_credit_ids"] = [d.id for d in dups]

    if data.get("occupation_amount", 0) > 0 and data.get("writeoff_amount", 0) >= data["occupation_amount"]:
        risk_tags.append("writeoff_exceeds_occupation")

    status = "pending_confirmation" if risk_tags else "pending_review"

    writeoff = OccupationWriteoff(
        customer_id=data["customer_id"],
        customer_name=data["customer_name"],
        occupation_amount=data["occupation_amount"],
        writeoff_amount=data.get("writeoff_amount", 0.0),
        occupation_type=data.get("occupation_type"),
        status=status,
        credit_id=data.get("credit_id"),
        conclusion=data.get("conclusion"),
        remarks=data.get("remarks"),
    )
    writeoff.set_transaction_ids(data.get("transaction_ids", []))
    writeoff.set_evidence_refs(evidence)
    writeoff.set_risk_tags(risk_tags)

    db.add(writeoff)
    db.commit()
    db.refresh(writeoff)

    log_change(
        db,
        writeoff.id,
        change_type="new",
        new_value=json.dumps(data, ensure_ascii=False),
        change_description=f"新建冲销记录，状态: {status}" + (f"，风险标记: {','.join(risk_tags)}" if risk_tags else ""),
        alert_level="warning" if risk_tags else "info",
    )

    return writeoff


def review_writeoff(db: Session, writeoff_id: int, data: dict) -> OccupationWriteoff:
    writeoff = db.query(OccupationWriteoff).filter(OccupationWriteoff.id == writeoff_id).first()
    if not writeoff:
        return None

    old_status = writeoff.status
    old_conclusion = writeoff.conclusion or ""

    if data.get("conclusion"):
        detect_manual_overwrite(db, writeoff_id, old_conclusion, data["conclusion"])

    writeoff.status = data["status"]
    if data.get("conclusion"):
        writeoff.conclusion = data["conclusion"]
    if data.get("remarks"):
        writeoff.remarks = data["remarks"]
    if data.get("reviewer"):
        writeoff.reviewer = data["reviewer"]
    writeoff.review_date = datetime.utcnow()

    risk_tags = writeoff.get_risk_tags()
    if "manual_overwrite" not in risk_tags and old_conclusion and data.get("conclusion") and old_conclusion.strip() != data["conclusion"].strip():
        risk_tags.append("manual_overwrite")
        writeoff.set_risk_tags(risk_tags)

    log_change(
        db,
        writeoff.id,
        change_type="review",
        old_value=json.dumps({"status": old_status, "conclusion": old_conclusion}, ensure_ascii=False),
        new_value=json.dumps(data, ensure_ascii=False),
        change_description=f"复核: {old_status} → {data['status']}" + (f"，结论已更新" if data.get("conclusion") and old_conclusion != data["conclusion"] else ""),
        alert_level="warning" if data["status"] == "pending_confirmation" else "info",
        operator=data.get("reviewer"),
    )

    db.commit()
    db.refresh(writeoff)
    return writeoff


def correct_writeoff(db: Session, writeoff_id: int, data: dict) -> OccupationWriteoff:
    writeoff = db.query(OccupationWriteoff).filter(OccupationWriteoff.id == writeoff_id).first()
    if not writeoff:
        return None

    old_values = {}
    changed_fields = []

    for field in ["occupation_amount", "writeoff_amount", "occupation_type", "conclusion", "remarks"]:
        if data.get(field) is not None:
            old_val = getattr(writeoff, field)
            new_val = data[field]
            if old_val != new_val:
                old_values[field] = old_val
                changed_fields.append(field)
                setattr(writeoff, field, new_val)

    if data.get("risk_tags") is not None:
        old_tags = writeoff.get_risk_tags()
        if old_tags != data["risk_tags"]:
            old_values["risk_tags"] = old_tags
            changed_fields.append("risk_tags")
            writeoff.set_risk_tags(data["risk_tags"])

    if changed_fields:
        if "conclusion" in changed_fields:
            detect_manual_overwrite(db, writeoff_id, old_values.get("conclusion", ""), data["conclusion"])
            risk_tags = writeoff.get_risk_tags()
            if "manual_overwrite" not in risk_tags:
                risk_tags.append("manual_overwrite")
                writeoff.set_risk_tags(risk_tags)

        writeoff.status = "pending_confirmation"
        writeoff.version += 1

        log_change(
            db,
            writeoff.id,
            change_type="modify",
            old_value=json.dumps(old_values, ensure_ascii=False),
            new_value=json.dumps({f: data[f] for f in changed_fields if f in data}, ensure_ascii=False),
            change_description=f"修正字段: {','.join(changed_fields)}，状态重置为待确认",
            alert_level="warning",
            operator=data.get("operator"),
        )

    db.commit()
    db.refresh(writeoff)
    return writeoff


def supplement_writeoff_transactions(db: Session, writeoff_id: int, new_transaction_ids: list):
    writeoff = db.query(OccupationWriteoff).filter(OccupationWriteoff.id == writeoff_id).first()
    if not writeoff:
        return None, []

    alerts = compare_and_alert_supplementary(db, writeoff, new_transaction_ids)
    return writeoff, alerts
