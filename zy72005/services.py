import re
import json
import hashlib
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from dateutil import parser as date_parser
from sqlalchemy.orm import Session
from models import Batch, PolicyRecord, AuditLog, SourceAttachment


AGENT_NICKNAME_MAP = {
    "阿强": "王志强",
    "小李": "李明华",
    "张姐": "张丽娟",
    "老王": "王德发",
    "阿梅": "刘梅芳",
}


CURRENCY_MAP = {
    "¥": "CNY",
    "￥": "CNY",
    "CNY": "CNY",
    "RMB": "CNY",
    "人民币": "CNY",
    "$": "USD",
    "USD": "USD",
    "美元": "USD",
    "HK$": "HKD",
    "HKD": "HKD",
    "港币": "HKD",
}


def parse_date(raw_date: str) -> Optional[datetime]:
    if not raw_date or not str(raw_date).strip():
        return None
    raw = str(raw_date).strip()
    raw = raw.replace("年", "-").replace("月", "-").replace("日", "")
    raw = raw.replace("/", "-").replace(".", "-")
    raw = re.sub(r"\s+", "", raw)
    try:
        return date_parser.parse(raw, dayfirst=False)
    except Exception:
        for fmt in ["%Y-%m-%d", "%Y%m%d", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d"]:
            try:
                return datetime.strptime(raw, fmt)
            except Exception:
                continue
    return None


def parse_amount(raw_amount: str) -> Tuple[Optional[float], str]:
    if not raw_amount or not str(raw_amount).strip():
        return None, "CNY"
    raw = str(raw_amount).strip()
    currency = "CNY"
    for symbol, curr in CURRENCY_MAP.items():
        if symbol in raw:
            currency = curr
            raw = raw.replace(symbol, "")
            break
    raw = raw.replace(",", "").replace("，", "").strip()
    match = re.search(r"-?\d+\.?\d*", raw)
    if match:
        try:
            return float(match.group()), currency
        except Exception:
            pass
    return None, currency


def map_agent_nickname(nickname: str) -> Optional[str]:
    if not nickname:
        return None
    return AGENT_NICKNAME_MAP.get(nickname.strip(), nickname.strip())


def create_batch(
    db: Session,
    batch_no: str,
    name: str,
    source: str,
    created_by: str,
) -> Batch:
    batch = Batch(
        batch_no=batch_no,
        name=name,
        source=source,
        created_by=created_by,
        status="processing",
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    _log_audit(
        db=db,
        batch_id=batch.id,
        action="batch_created",
        operator=created_by,
        notes=f"创建批次: {name}",
    )
    return batch


def add_source_attachment(
    db: Session,
    source_type: str,
    reference_no: str,
    title: str = None,
    received_date: datetime = None,
    original_filename: str = None,
    content: str = None,
    notes: str = None,
) -> SourceAttachment:
    content_hash = None
    if content:
        content_hash = hashlib.md5(content.encode("utf-8")).hexdigest()
    attachment = SourceAttachment(
        source_type=source_type,
        reference_no=reference_no,
        title=title,
        received_date=received_date,
        original_filename=original_filename,
        content_hash=content_hash,
        notes=notes,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


def add_policy_record(
    db: Session,
    batch_id: int,
    policy_no: str,
    policy_holder: str = None,
    agent_nickname: str = None,
    raw_effective_date: str = None,
    raw_cash_value: str = None,
    surrender_date: datetime = None,
    surrender_amount: float = None,
    source_type: str = "excel_import",
    source_reference: str = None,
    source_attachment_id: int = None,
    raw_data: dict = None,
) -> PolicyRecord:
    effective_date = parse_date(raw_effective_date)
    cash_value, currency = parse_amount(raw_cash_value)
    agent_real_name = map_agent_nickname(agent_nickname)

    record = PolicyRecord(
        batch_id=batch_id,
        policy_no=policy_no,
        policy_holder=policy_holder,
        agent_nickname=agent_nickname,
        agent_real_name=agent_real_name,
        raw_effective_date=raw_effective_date,
        effective_date=effective_date,
        raw_cash_value=raw_cash_value,
        cash_value=cash_value,
        currency=currency,
        surrender_date=surrender_date,
        surrender_amount=surrender_amount,
        source_type=source_type,
        source_reference=source_reference,
        source_attachment_id=source_attachment_id,
        status="pending",
        is_suspended=False,
        raw_data=json.dumps(raw_data, ensure_ascii=False) if raw_data else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    _log_audit(
        db=db,
        batch_id=batch_id,
        record_id=record.id,
        action="record_created",
        operator="system",
        notes=f"导入保单记录: {policy_no}",
    )
    _auto_suspend_if_missing_evidence(db, record)
    return record


def _auto_suspend_if_missing_evidence(db: Session, record: PolicyRecord):
    issues = []
    if record.cash_value is None:
        issues.append("现金价值解析失败")
    if record.effective_date is None:
        issues.append("生效日期解析失败")
    if not record.source_attachment_id and not record.source_reference:
        issues.append("缺少来源凭证关联")

    if issues:
        record.is_suspended = True
        record.status = "suspended"
        record.suspension_reason = "; ".join(issues)
        db.commit()
        _log_audit(
            db=db,
            batch_id=record.batch_id,
            record_id=record.id,
            action="auto_suspend",
            operator="system",
            notes=f"自动挂起: {record.suspension_reason}",
        )


def confirm_record(
    db: Session,
    record_id: int,
    operator: str,
    notes: str = None,
    decision_reasoning: str = None,
    overridden_cash_value: float = None,
    overridden_effective_date: datetime = None,
) -> PolicyRecord:
    record = db.query(PolicyRecord).filter(PolicyRecord.id == record_id).first()
    if not record:
        raise ValueError(f"Record {record_id} not found")

    old_status = record.status
    old_cash = record.cash_value
    old_date = record.effective_date
    old_notes = record.confirmation_notes

    if overridden_cash_value is not None:
        record.cash_value = overridden_cash_value
    if overridden_effective_date is not None:
        record.effective_date = overridden_effective_date

    record.status = "confirmed"
    record.is_suspended = False
    record.confirmed_by = operator
    record.confirmed_at = datetime.now()
    if notes:
        record.confirmation_notes = (record.confirmation_notes or "") + \
            (f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {operator}: {notes}" if record.confirmation_notes
             else f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {operator}: {notes}")

    db.commit()
    db.refresh(record)

    changes = []
    if old_status != record.status:
        changes.append(f"状态: {old_status} -> {record.status}")
    if old_cash != record.cash_value:
        changes.append(f"现金价值: {old_cash} -> {record.cash_value}")
    if old_date != record.effective_date:
        changes.append(f"生效日期: {old_date} -> {record.effective_date}")

    _log_audit(
        db=db,
        batch_id=record.batch_id,
        record_id=record.id,
        action="record_confirmed",
        operator=operator,
        old_value=json.dumps({
            "status": old_status,
            "cash_value": old_cash,
            "effective_date": str(old_date) if old_date else None,
            "notes": old_notes,
        }, ensure_ascii=False),
        new_value=json.dumps({
            "status": record.status,
            "cash_value": record.cash_value,
            "effective_date": str(record.effective_date) if record.effective_date else None,
            "notes": record.confirmation_notes,
        }, ensure_ascii=False),
        notes="; ".join(changes),
        decision_reasoning=decision_reasoning,
    )
    return record


def suspend_record(
    db: Session,
    record_id: int,
    operator: str,
    reason: str,
    decision_reasoning: str = None,
) -> PolicyRecord:
    record = db.query(PolicyRecord).filter(PolicyRecord.id == record_id).first()
    if not record:
        raise ValueError(f"Record {record_id} not found")

    old_status = record.status
    record.status = "suspended"
    record.is_suspended = True
    record.suspension_reason = reason

    db.commit()
    db.refresh(record)

    _log_audit(
        db=db,
        batch_id=record.batch_id,
        record_id=record.id,
        action="record_suspended",
        operator=operator,
        old_value=old_status,
        new_value="suspended",
        notes=reason,
        decision_reasoning=decision_reasoning,
    )
    return record


def add_manual_note(
    db: Session,
    record_id: int,
    operator: str,
    note: str,
    decision_reasoning: str = None,
) -> PolicyRecord:
    record = db.query(PolicyRecord).filter(PolicyRecord.id == record_id).first()
    if not record:
        raise ValueError(f"Record {record_id} not found")

    old_notes = record.confirmation_notes or ""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_note = f"[{timestamp}] {operator}: {note}"

    if record.confirmation_notes:
        record.confirmation_notes = old_notes + "\n" + new_note
    else:
        record.confirmation_notes = new_note

    db.commit()
    db.refresh(record)

    _log_audit(
        db=db,
        batch_id=record.batch_id,
        record_id=record.id,
        action="note_added",
        operator=operator,
        old_value=old_notes,
        new_value=record.confirmation_notes,
        notes="补充备注",
        decision_reasoning=decision_reasoning,
    )
    return record


def _log_audit(
    db: Session,
    action: str,
    operator: str,
    batch_id: int = None,
    record_id: int = None,
    old_value: str = None,
    new_value: str = None,
    notes: str = None,
    decision_reasoning: str = None,
):
    log = AuditLog(
        batch_id=batch_id,
        record_id=record_id,
        action=action,
        operator=operator,
        old_value=old_value,
        new_value=new_value,
        notes=notes,
        decision_reasoning=decision_reasoning,
    )
    db.add(log)
    db.commit()


def get_record_trace(db: Session, record_id: int) -> Dict:
    record = db.query(PolicyRecord).filter(PolicyRecord.id == record_id).first()
    if not record:
        raise ValueError(f"Record {record_id} not found")

    logs = db.query(AuditLog).filter(
        AuditLog.record_id == record_id
    ).order_by(AuditLog.created_at).all()

    source = None
    if record.source_attachment_id:
        attachment = db.query(SourceAttachment).filter(
            SourceAttachment.id == record.source_attachment_id
        ).first()
        if attachment:
            source = {
                "type": attachment.source_type,
                "reference_no": attachment.reference_no,
                "title": attachment.title,
                "received_date": attachment.received_date,
            }

    return {
        "record": {
            "id": record.id,
            "policy_no": record.policy_no,
            "status": record.status,
            "is_suspended": record.is_suspended,
            "suspension_reason": record.suspension_reason,
            "cash_value": record.cash_value,
            "currency": record.currency,
            "effective_date": record.effective_date,
            "source_type": record.source_type,
            "source_reference": record.source_reference,
        },
        "source": source,
        "audit_trail": [
            {
                "time": log.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "action": log.action,
                "operator": log.operator,
                "notes": log.notes,
                "decision_reasoning": log.decision_reasoning,
                "changes": f"{log.old_value} -> {log.new_value}" if log.old_value or log.new_value else None,
            }
            for log in logs
        ],
    }


def get_batch_summary(db: Session, batch_id: int) -> Dict:
    records = db.query(PolicyRecord).filter(PolicyRecord.batch_id == batch_id).all()
    total = len(records)
    confirmed = [r for r in records if r.status == "confirmed"]
    suspended = [r for r in records if r.status == "suspended"]
    pending = [r for r in records if r.status == "pending"]

    confirmed_total = sum(r.cash_value for r in confirmed if r.cash_value)
    suspended_total = sum(r.cash_value for r in suspended if r.cash_value)

    return {
        "batch_id": batch_id,
        "total_records": total,
        "confirmed_count": len(confirmed),
        "suspended_count": len(suspended),
        "pending_count": len(pending),
        "confirmed_total_amount": confirmed_total,
        "suspended_total_amount": suspended_total,
        "net_confirmed_amount": confirmed_total,
    }
