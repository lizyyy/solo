import hashlib
import json
import uuid
import traceback
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from jose import jwt

from app.models import (
    Batch, Token, ProcessingRecord, FailedItem, ApprovalItem,
    CandidateList, Report, ProcessingStatus, TokenStatus, RiskType
)
from app.schemas import BatchCreate, CandidateListCreate

SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"


def generate_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=24)

    to_encode = {"sub": subject, "exp": expire, "jti": str(uuid.uuid4())}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def calculate_content_hash(items: List[Dict[str, Any]]) -> str:
    sorted_items = sorted(items, key=lambda x: json.dumps(x, sort_keys=True))
    content_str = json.dumps(sorted_items, sort_keys=True)
    return hashlib.sha256(content_str.encode()).hexdigest()


def check_duplicate_submission(db: Session, content_hash: str) -> Optional[Batch]:
    return db.query(Batch).filter(Batch.content_hash == content_hash).first()


def create_failed_item(
    db: Session,
    batch_id: int,
    item_key: str,
    content: Dict[str, Any],
    error_type: str,
    error_message: str,
    stack_trace: Optional[str] = None
) -> FailedItem:
    failed_item = FailedItem(
        batch_id=batch_id,
        item_key=item_key,
        content=content,
        error_type=error_type,
        error_message=error_message,
        stack_trace=stack_trace
    )
    db.add(failed_item)
    db.commit()
    db.refresh(failed_item)
    return failed_item


def create_processing_record(
    db: Session,
    batch_id: int,
    record_type: str,
    content_before: Optional[Dict[str, Any]],
    content_after: Optional[Dict[str, Any]],
    status: str,
    operator: str,
    execution_time_ms: int,
    remarks: Optional[str] = None
) -> ProcessingRecord:
    record = ProcessingRecord(
        batch_id=batch_id,
        record_type=record_type,
        content_before=content_before,
        content_after=content_after,
        status=status,
        operator=operator,
        execution_time_ms=execution_time_ms,
        remarks=remarks
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def process_batch(db: Session, batch_create: BatchCreate) -> Tuple[Batch, str]:
    start_time = datetime.utcnow()

    content_hash = calculate_content_hash(batch_create.items)

    existing_batch = check_duplicate_submission(db, content_hash)
    if existing_batch:
        return existing_batch, "reused"

    batch = Batch(
        batch_no=batch_create.batch_no,
        operator=batch_create.operator,
        description=batch_create.description,
        risk_type=batch_create.risk_type,
        content_hash=content_hash,
        total_count=len(batch_create.items),
        status=ProcessingStatus.PROCESSING
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    success_count = 0
    failed_count = 0

    for idx, item in enumerate(batch_create.items):
        try:
            subject = item.get("subject", f"item_{idx}")
            expires_days = item.get("expires_days", 7)
            expires_at = datetime.utcnow() + timedelta(days=expires_days)

            token_value = generate_token(subject, timedelta(days=expires_days))

            token = Token(
                token_value=token_value,
                batch_id=batch.id,
                subject=subject,
                risk_type=batch_create.risk_type,
                expires_at=expires_at,
                issued_by=batch_create.operator,
                token_metadata=item.get("token_metadata", {})
            )
            db.add(token)
            success_count += 1

        except Exception as e:
            failed_count += 1
            create_failed_item(
                db=db,
                batch_id=batch.id,
                item_key=item.get("key", f"item_{idx}"),
                content=item,
                error_type=type(e).__name__,
                error_message=str(e),
                stack_trace=traceback.format_exc()
            )

    execution_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

    batch.status = ProcessingStatus.SUCCESS if failed_count == 0 else ProcessingStatus.PARTIAL
    batch.success_count = success_count
    batch.failed_count = failed_count
    batch.end_time = datetime.utcnow()
    db.commit()

    create_processing_record(
        db=db,
        batch_id=batch.id,
        record_type="batch_processing",
        content_before={"total_items": len(batch_create.items)},
        content_after={"success_count": success_count, "failed_count": failed_count},
        status=batch.status,
        operator=batch_create.operator,
        execution_time_ms=execution_time,
        remarks=f"Batch processing completed with {success_count} success, {failed_count} failed"
    )

    return batch, "new"


def create_candidate_list(
    db: Session,
    candidate_create: CandidateListCreate,
    created_by: str
) -> CandidateList:
    candidate_list = CandidateList(
        batch_id=candidate_create.batch_id,
        list_type=candidate_create.list_type,
        name=candidate_create.name,
        description=candidate_create.description,
        items=candidate_create.items,
        created_by=created_by
    )
    db.add(candidate_list)
    db.commit()
    db.refresh(candidate_list)
    return candidate_list


def approve_candidate_list(
    db: Session,
    candidate_id: int,
    approved_by: str
) -> Optional[CandidateList]:
    candidate = db.query(CandidateList).filter(CandidateList.id == candidate_id).first()
    if candidate:
        candidate.approved = True
        candidate.approved_by = approved_by
        candidate.approved_at = datetime.utcnow()
        db.commit()
        db.refresh(candidate)
    return candidate


def execute_candidate_list(
    db: Session,
    candidate_id: int,
    executed_by: str
) -> Optional[CandidateList]:
    candidate = db.query(CandidateList).filter(CandidateList.id == candidate_id).first()
    if candidate and candidate.approved:
        candidate.executed = True
        candidate.executed_at = datetime.utcnow()

        if candidate.list_type == "rollback":
            batch = db.query(Batch).filter(Batch.id == candidate.batch_id).first()
            if batch:
                batch.status = ProcessingStatus.ROLLBACK
                for token in batch.tokens:
                    token.status = TokenStatus.REVOKED

        db.commit()
        db.refresh(candidate)
    return candidate


def query_batches(
    db: Session,
    batch_no: Optional[str] = None,
    operator: Optional[str] = None,
    risk_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> List[Batch]:
    query = db.query(Batch)

    if batch_no:
        query = query.filter(Batch.batch_no.contains(batch_no))
    if operator:
        query = query.filter(Batch.operator == operator)
    if risk_type:
        query = query.filter(Batch.risk_type == risk_type)
    if status:
        query = query.filter(Batch.status == status)
    if start_date:
        query = query.filter(Batch.created_at >= start_date)
    if end_date:
        query = query.filter(Batch.created_at <= end_date)

    return query.order_by(Batch.created_at.desc()).all()


def create_approval_item(
    db: Session,
    batch_id: int,
    item_key: str,
    title: str,
    content: Dict[str, Any],
    assignee: str,
    priority: str = "normal",
    due_days: int = 3
) -> ApprovalItem:
    approval = ApprovalItem(
        batch_id=batch_id,
        item_key=item_key,
        title=title,
        content=content,
        assignee=assignee,
        priority=priority,
        due_date=datetime.utcnow() + timedelta(days=due_days)
    )
    db.add(approval)
    db.commit()
    db.refresh(approval)
    return approval


def send_reminder(db: Session, approval_id: int) -> Optional[ApprovalItem]:
    approval = db.query(ApprovalItem).filter(ApprovalItem.id == approval_id).first()
    if approval:
        approval.reminders_count += 1
        approval.last_reminder_at = datetime.utcnow()
        db.commit()
        db.refresh(approval)
    return approval


def generate_report(
    db: Session,
    batch_id: int,
    generated_by: str
) -> Report:
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")

    tokens = db.query(Token).filter(Token.batch_id == batch_id).all()
    failed_items = db.query(FailedItem).filter(FailedItem.batch_id == batch_id).all()
    processing_records = db.query(ProcessingRecord).filter(ProcessingRecord.batch_id == batch_id).all()

    total_execution_time = sum(r.execution_time_ms for r in processing_records)
    avg_execution_time = total_execution_time / len(processing_records) if processing_records else 0

    comparison_data = {
        "before": {
            "total_count": batch.total_count,
            "status": "pending"
        },
        "after": {
            "total_count": batch.total_count,
            "success_count": batch.success_count,
            "failed_count": batch.failed_count,
            "success_rate": f"{(batch.success_count / batch.total_count * 100):.2f}%" if batch.total_count > 0 else "0%",
            "status": batch.status
        }
    }

    execution_stats = {
        "total_execution_time_ms": total_execution_time,
        "avg_execution_time_ms": avg_execution_time,
        "start_time": batch.start_time.isoformat() if batch.start_time else None,
        "end_time": batch.end_time.isoformat() if batch.end_time else None,
        "processing_records_count": len(processing_records)
    }

    next_steps = []
    if batch.failed_count > 0:
        next_steps.append({
            "priority": "high",
            "action": "review_failed_items",
            "description": f"Review {batch.failed_count} failed items and retry processing",
            "link": f"/api/failed-items?batch_id={batch_id}"
        })

    active_tokens = [t for t in tokens if t.status == TokenStatus.ACTIVE]
    if active_tokens:
        next_steps.append({
            "priority": "medium",
            "action": "monitor_active_tokens",
            "description": f"Monitor {len(active_tokens)} active tokens until expiration",
            "link": f"/api/tokens?batch_id={batch_id}&status=active"
        })

    next_steps.append({
        "priority": "low",
        "action": "generate_full_report",
        "description": "Generate comprehensive audit report for compliance review",
        "link": f"/api/reports/{batch_id}/full"
    })

    summary = (
        f"Batch {batch.batch_no} processing completed. "
        f"Success: {batch.success_count}, Failed: {batch.failed_count}. "
        f"Total execution time: {total_execution_time}ms. "
        f"Risk type: {batch.risk_type}"
    )

    report = Report(
        batch_id=batch_id,
        report_type="processing_summary",
        title=f"Processing Report - {batch.batch_no}",
        summary=summary,
        comparison_data=comparison_data,
        execution_stats=execution_stats,
        next_steps=next_steps,
        generated_by=generated_by
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def get_batch_review_data(db: Session, batch_id: int) -> Dict[str, Any]:
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")

    processing_records = db.query(ProcessingRecord).filter(
        ProcessingRecord.batch_id == batch_id
    ).order_by(ProcessingRecord.created_at).all()

    approval_items = db.query(ApprovalItem).filter(
        ApprovalItem.batch_id == batch_id
    ).order_by(ApprovalItem.created_at).all()

    status_changes = []

    status_changes.append({
        "status_change": "batch_created",
        "from_status": "none",
        "to_status": ProcessingStatus.PENDING,
        "change_time": batch.created_at,
        "operator": batch.operator,
        "remarks": "Batch created and pending processing"
    })

    status_changes.append({
        "status_change": "processing_started",
        "from_status": ProcessingStatus.PENDING,
        "to_status": ProcessingStatus.PROCESSING,
        "change_time": batch.start_time,
        "operator": batch.operator,
        "remarks": "Batch processing started"
    })

    for record in processing_records:
        status_changes.append({
            "status_change": record.record_type,
            "from_status": record.content_before.get("status", "unknown"),
            "to_status": record.content_after.get("status", "unknown"),
            "change_time": record.created_at,
            "operator": record.operator,
            "remarks": record.remarks
        })

    for approval in approval_items:
        if approval.last_reminder_at:
            status_changes.append({
                "status_change": "reminder_sent",
                "from_status": approval.status,
                "to_status": approval.status,
                "change_time": approval.last_reminder_at,
                "operator": "system",
                "approval_item": approval,
                "remarks": f"Reminder #{approval.reminders_count} sent for approval item '{approval.title}'"
            })

    status_changes.sort(key=lambda x: x["change_time"])

    summary_parts = [
        f"Batch {batch.batch_no} has {len(status_changes)} status changes recorded.",
        f"There are {len(approval_items)} approval items pending review.",
        f"Final status: {batch.status}."
    ]

    return {
        "batch_id": batch.id,
        "batch_no": batch.batch_no,
        "status_changes": status_changes,
        "approval_items": approval_items,
        "summary": " ".join(summary_parts)
    }
