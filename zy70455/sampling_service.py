import random
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from database import DutyRecord, SamplingRule, ProcessingBatch, OperationLog, CleanupCandidate
from schemas import DutyRecordCreate, SamplingRuleCreate, ProcessingBatchCreate, CleanupCandidateCreate


def generate_batch_id(department: str, date_str: str) -> str:
    date_part = date_str.replace("-", "")
    random_str = str(uuid.uuid4())[:8].upper()
    return f"{department.upper()}-{date_part}-{random_str}"


def create_sampling_rule(db: Session, rule_data: SamplingRuleCreate) -> SamplingRule:
    db.query(SamplingRule).filter(
        SamplingRule.department == rule_data.department,
        SamplingRule.is_active == True
    ).update({"is_active": False})
    
    rule = SamplingRule(
        version=rule_data.version,
        name=rule_data.name,
        description=rule_data.description,
        department=rule_data.department,
        sampling_rate=rule_data.sampling_rate,
        min_incidents=rule_data.min_incidents,
        include_departments=rule_data.include_departments,
        exclude_departments=rule_data.exclude_departments,
        receipt_timeout_hours=rule_data.receipt_timeout_hours,
        created_by=rule_data.created_by
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    
    log_operation(db, "create_rule", None, None, rule_data.created_by, {
        "rule_version": rule_data.version,
        "rule_name": rule_data.name
    })
    return rule


def get_active_rule(db: Session, department: str) -> SamplingRule:
    rule = db.query(SamplingRule).filter(
        SamplingRule.department == department,
        SamplingRule.is_active == True
    ).first()
    if not rule:
        rule = db.query(SamplingRule).filter(
            SamplingRule.department == "总部",
            SamplingRule.is_active == True
        ).first()
    return rule


def get_rule_by_version(db: Session, version: str) -> SamplingRule:
    return db.query(SamplingRule).filter(SamplingRule.version == version).first()


def create_duty_record(db: Session, record_data: DutyRecordCreate) -> DutyRecord:
    record = DutyRecord(
        batch_id=record_data.batch_id,
        duty_date=record_data.duty_date,
        department=record_data.department,
        duty_person=record_data.duty_person,
        phone=record_data.phone,
        incident_count=record_data.incident_count,
        incidents=record_data.incidents,
        external_receipt_status=record_data.external_receipt_status,
        raw_input=record_data.raw_input
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def batch_create_duty_records(db: Session, records: List[DutyRecordCreate]) -> List[DutyRecord]:
    created_records = []
    for record_data in records:
        record = DutyRecord(
            batch_id=record_data.batch_id,
            duty_date=record_data.duty_date,
            department=record_data.department,
            duty_person=record_data.duty_person,
            phone=record_data.phone,
            incident_count=record_data.incident_count,
            incidents=record_data.incidents,
            external_receipt_status=record_data.external_receipt_status,
            raw_input=record_data.raw_input
        )
        db.add(record)
        created_records.append(record)
    db.commit()
    for record in created_records:
        db.refresh(record)
    return created_records


def sample_call_chain(db: Session, batch_id: str, rule_version: str = None) -> Tuple[List[DutyRecord], Dict[str, Any]]:
    batch = db.query(ProcessingBatch).filter(ProcessingBatch.batch_id == batch_id).first()
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")
    
    if rule_version:
        rule = get_rule_by_version(db, rule_version)
    else:
        rule = get_active_rule(db, batch.department)
    
    if not rule:
        raise ValueError(f"No sampling rule found for department {batch.department}")
    
    all_records = db.query(DutyRecord).filter(DutyRecord.batch_id == batch_id).all()
    
    sampled_records = []
    late_receipt_count = 0
    
    for record in all_records:
        if record.department in rule.exclude_departments:
            continue
        
        if record.department not in rule.include_departments and "*" not in rule.include_departments:
            continue
        
        if record.external_receipt_status == "late":
            late_receipt_count += 1
        
        if record.incident_count >= rule.min_incidents:
            sampled_records.append(record)
            continue
        
        if random.random() < rule.sampling_rate:
            sampled_records.append(record)
    
    summary = {
        "total_records": len(all_records),
        "sampled_count": len(sampled_records),
        "sampling_rate_used": rule.sampling_rate,
        "min_incidents_threshold": rule.min_incidents,
        "late_receipt_count": late_receipt_count,
        "receipt_timeout_hours": rule.receipt_timeout_hours,
        "rule_version": rule.version,
        "rule_name": rule.name
    }
    
    batch.rule_snapshot = {
        "version": rule.version,
        "name": rule.name,
        "description": rule.description,
        "sampling_rate": rule.sampling_rate,
        "min_incidents": rule.min_incidents,
        "include_departments": rule.include_departments,
        "exclude_departments": rule.exclude_departments,
        "receipt_timeout_hours": rule.receipt_timeout_hours
    }
    batch.total_records = len(all_records)
    batch.sampled_count = len(sampled_records)
    batch.summary = summary
    batch.status = "completed"
    batch.completed_at = datetime.utcnow()
    db.commit()
    
    log_operation(db, "sampling", batch_id, None, "system", summary)
    
    return sampled_records, summary


def log_operation(db: Session, operation_type: str, batch_id: str = None, 
                  record_id: int = None, operator: str = "system", 
                  details: Dict[str, Any] = None, status: str = "success",
                  error_message: str = None):
    log = OperationLog(
        operation_type=operation_type,
        batch_id=batch_id,
        record_id=record_id,
        operator=operator,
        details=details or {},
        status=status,
        error_message=error_message
    )
    db.add(log)
    db.commit()


def create_cleanup_candidate(db: Session, candidate_data: CleanupCandidateCreate, 
                             operator: str) -> CleanupCandidate:
    candidate_id = f"CLEAN-{str(uuid.uuid4())[:8].upper()}"
    
    summary = {
        "affected_batches": len(candidate_data.batch_ids),
        "affected_records": len(candidate_data.record_ids),
        "operation_type": candidate_data.operation_type
    }
    
    if candidate_data.batch_ids:
        batch_details = []
        for batch_id in candidate_data.batch_ids:
            batch = db.query(ProcessingBatch).filter(ProcessingBatch.batch_id == batch_id).first()
            if batch:
                batch_details.append({
                    "batch_id": batch_id,
                    "department": batch.department,
                    "date_range": f"{batch.start_date} to {batch.end_date}",
                    "total_records": batch.total_records
                })
        summary["batch_details"] = batch_details
    
    candidate = CleanupCandidate(
        candidate_id=candidate_id,
        operation_type=candidate_data.operation_type,
        batch_ids=candidate_data.batch_ids,
        record_ids=candidate_data.record_ids,
        reason=candidate_data.reason,
        summary=summary,
        status="pending"
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    
    log_operation(db, "create_cleanup_candidate", None, None, operator, {
        "candidate_id": candidate_id,
        "operation_type": candidate_data.operation_type,
        "reason": candidate_data.reason
    })
    
    return candidate


def approve_cleanup_candidate(db: Session, candidate_id: str, approver: str) -> CleanupCandidate:
    candidate = db.query(CleanupCandidate).filter(CleanupCandidate.candidate_id == candidate_id).first()
    if not candidate:
        raise ValueError(f"Candidate {candidate_id} not found")
    
    candidate.status = "approved"
    candidate.approved_by = approver
    candidate.approved_at = datetime.utcnow()
    db.commit()
    
    log_operation(db, "approve_cleanup", None, None, approver, {
        "candidate_id": candidate_id
    })
    
    return candidate


def execute_cleanup(db: Session, candidate_id: str, executor: str) -> Dict[str, Any]:
    candidate = db.query(CleanupCandidate).filter(CleanupCandidate.candidate_id == candidate_id).first()
    if not candidate:
        raise ValueError(f"Candidate {candidate_id} not found")
    
    if candidate.status != "approved":
        raise ValueError(f"Candidate {candidate_id} is not approved")
    
    results = {
        "deleted_batches": 0,
        "deleted_records": 0,
        "deleted_logs": 0
    }
    
    if candidate.batch_ids:
        for batch_id in candidate.batch_ids:
            db.query(DutyRecord).filter(DutyRecord.batch_id == batch_id).delete()
            db.query(ProcessingBatch).filter(ProcessingBatch.batch_id == batch_id).delete()
            results["deleted_batches"] += 1
    
    if candidate.record_ids:
        results["deleted_records"] = db.query(DutyRecord).filter(
            DutyRecord.id.in_(candidate.record_ids)
        ).delete()
    
    candidate.status = "executed"
    candidate.executed_by = executor
    candidate.executed_at = datetime.utcnow()
    db.commit()
    
    log_operation(db, "execute_cleanup", None, None, executor, {
        "candidate_id": candidate_id,
        "results": results
    })
    
    return results


def get_operation_logs_by_time(db: Session, start_time: datetime, end_time: datetime, 
                               operation_type: str = None) -> List[OperationLog]:
    query = db.query(OperationLog).filter(
        OperationLog.operation_time >= start_time,
        OperationLog.operation_time <= end_time
    )
    if operation_type:
        query = query.filter(OperationLog.operation_type == operation_type)
    return query.order_by(OperationLog.operation_time.desc()).all()


def get_batch_raw_records(db: Session, batch_id: str) -> List[DutyRecord]:
    return db.query(DutyRecord).filter(DutyRecord.batch_id == batch_id).all()
