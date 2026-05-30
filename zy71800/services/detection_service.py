import json
from datetime import datetime
from sqlalchemy.orm import Session
from models import CreditLedger, CreditAlert, OccupationWriteoff


def detect_duplicate_credit(db: Session, customer_id: str, credit_type: str, exclude_id=None):
    query = db.query(CreditLedger).filter(
        CreditLedger.customer_id == customer_id,
        CreditLedger.credit_type == credit_type,
        CreditLedger.status == "active",
    )
    if exclude_id:
        query = query.filter(CreditLedger.id != exclude_id)
    duplicates = query.all()
    if len(duplicates) > 1:
        for c in duplicates:
            existing = db.query(CreditAlert).filter(
                CreditAlert.credit_id == c.id,
                CreditAlert.alert_type == "duplicate_credit",
                CreditAlert.status == "active",
            ).first()
            if not existing:
                alert = CreditAlert(
                    credit_id=c.id,
                    alert_type="duplicate_credit",
                    alert_detail=f"客户{customer_id}存在{len(duplicates)}条相同类型({credit_type})的活跃授信记录",
                    status="active",
                )
                db.add(alert)
        db.commit()
    return duplicates


def detect_frozen_not_released(db: Session):
    results = []
    credits = db.query(CreditLedger).filter(
        CreditLedger.frozen_amount > 0,
        CreditLedger.status == "active",
    ).all()
    for c in credits:
        if c.expiry_date:
            try:
                exp = datetime.strptime(c.expiry_date, "%Y-%m-%d")
                if exp < datetime.utcnow():
                    existing = db.query(CreditAlert).filter(
                        CreditAlert.credit_id == c.id,
                        CreditAlert.alert_type == "frozen_not_released",
                        CreditAlert.status == "active",
                    ).first()
                    if not existing:
                        alert = CreditAlert(
                            credit_id=c.id,
                            alert_type="frozen_not_released",
                            alert_detail=f"客户{c.customer_name}({c.customer_id})授信已过期{c.expiry_date}，冻结额度{c.frozen_amount}未释放",
                            status="active",
                        )
                        db.add(alert)
                        db.commit()
                    results.append(c)
            except ValueError:
                pass
    return results


def detect_manual_overwrite(db: Session, writeoff_id: int, old_conclusion: str, new_conclusion: str):
    if old_conclusion and new_conclusion and old_conclusion.strip() != new_conclusion.strip():
        writeoff = db.query(OccupationWriteoff).filter(OccupationWriteoff.id == writeoff_id).first()
        if writeoff:
            existing_alert = db.query(CreditAlert).filter(
                CreditAlert.credit_id == writeoff.credit_id,
                CreditAlert.alert_type == "manual_overwrite",
                CreditAlert.status == "active",
            ).first()
            if not existing_alert:
                alert = CreditAlert(
                    credit_id=writeoff.credit_id,
                    alert_type="manual_overwrite",
                    alert_detail=f"冲销记录#{writeoff_id}的人工备注/结论被覆盖: 原结论=\"{old_conclusion[:100]}\" → 新结论=\"{new_conclusion[:100]}\"",
                    status="active",
                )
                db.add(alert)
                db.commit()
        return True
    return False


def run_all_detections(db: Session):
    all_alerts = []
    active_credits = db.query(CreditLedger).filter(CreditLedger.status == "active").all()
    seen = set()
    for c in active_credits:
        key = (c.customer_id, c.credit_type)
        if key not in seen:
            seen.add(key)
            dups = detect_duplicate_credit(db, c.customer_id, c.credit_type)
            if len(dups) > 1:
                all_alerts.append({
                    "type": "duplicate_credit",
                    "customer_id": c.customer_id,
                    "detail": f"发现{len(dups)}条重复授信",
                })

    frozen = detect_frozen_not_released(db)
    for c in frozen:
        all_alerts.append({
            "type": "frozen_not_released",
            "customer_id": c.customer_id,
            "detail": f"冻结额度{c.frozen_amount}未释放",
        })

    overwrite_alerts = db.query(CreditAlert).filter(
        CreditAlert.alert_type == "manual_overwrite",
        CreditAlert.status == "active",
    ).all()
    for a in overwrite_alerts:
        all_alerts.append({
            "type": "manual_overwrite",
            "credit_id": a.credit_id,
            "detail": a.alert_detail,
        })

    return all_alerts
