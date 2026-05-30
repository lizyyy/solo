import json
from datetime import datetime
from sqlalchemy.orm import Session
from models import OccupationWriteoff, WriteoffChangeLog


def log_change(
    db: Session,
    writeoff_id: int,
    change_type: str,
    old_value: str = None,
    new_value: str = None,
    change_description: str = None,
    alert_level: str = "info",
    operator: str = None,
):
    log = WriteoffChangeLog(
        writeoff_id=writeoff_id,
        change_type=change_type,
        old_value=old_value,
        new_value=new_value,
        change_description=change_description,
        alert_level=alert_level,
        operator=operator,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def compare_and_alert_supplementary(
    db: Session,
    writeoff: OccupationWriteoff,
    new_transaction_ids: list,
    new_occupation_amount: float = None,
    new_writeoff_amount: float = None,
):
    alerts = []
    old_tx_ids = writeoff.get_transaction_ids()
    added_ids = [tid for tid in new_transaction_ids if tid not in old_tx_ids]

    if added_ids:
        old_occ = writeoff.occupation_amount
        old_wo = writeoff.writeoff_amount

        evidence = writeoff.get_evidence_refs()
        evidence["supplementary_transactions"] = added_ids
        evidence["previous_occupation_amount"] = old_occ
        evidence["previous_writeoff_amount"] = old_wo
        writeoff.set_evidence_refs(evidence)

        if new_occupation_amount is not None and new_occupation_amount != old_occ:
            alerts.append({
                "field": "occupation_amount",
                "old": old_occ,
                "new": new_occupation_amount,
                "alert_level": "warning",
            })
            writeoff.occupation_amount = new_occupation_amount

        if new_writeoff_amount is not None and new_writeoff_amount != old_wo:
            alerts.append({
                "field": "writeoff_amount",
                "old": old_wo,
                "new": new_writeoff_amount,
                "alert_level": "warning",
            })
            writeoff.writeoff_amount = new_writeoff_amount

        writeoff.set_transaction_ids(new_transaction_ids)
        writeoff.version += 1

        max_level = "info"
        for a in alerts:
            if a["alert_level"] == "critical":
                max_level = "critical"
                break
            if a["alert_level"] == "warning":
                max_level = "warning"

        change_desc = f"补传交易流水{len(added_ids)}条"
        if alerts:
            fields = ", ".join(a["field"] for a in alerts)
            change_desc += f"，以下字段发生变化: {fields}"

        if max_level in ("warning", "critical"):
            writeoff.status = "pending_confirmation"
            change_desc += "。状态已重置为待确认，请复核"

        log_change(
            db,
            writeoff.id,
            change_type="supplement",
            old_value=json.dumps(
                {"transaction_ids": old_tx_ids, "occupation_amount": old_occ, "writeoff_amount": old_wo},
                ensure_ascii=False,
            ),
            new_value=json.dumps(
                {"transaction_ids": new_transaction_ids, "occupation_amount": writeoff.occupation_amount, "writeoff_amount": writeoff.writeoff_amount},
                ensure_ascii=False,
            ),
            change_description=change_desc,
            alert_level=max_level,
        )

        db.commit()

    return alerts
