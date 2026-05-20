import json
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models import (
    ImportBatch,
    BorrowRecord,
    ImportResult,
    Case,
    Person,
    AuditLog,
)


def get_batch_list(db: Session, skip: int = 0, limit: int = 100) -> Dict[str, Any]:
    query = db.query(ImportBatch).order_by(desc(ImportBatch.import_time))
    total = query.count()
    batches = query.offset(skip).limit(limit).all()

    result = []
    for batch in batches:
        result.append({
            "batch_id": batch.batch_id,
            "filename": batch.filename,
            "import_type": batch.import_type,
            "import_time": batch.import_time,
            "total_records": batch.total_records,
            "success_count": batch.success_count,
            "confirm_count": batch.confirm_count,
            "fail_count": batch.fail_count,
            "status": batch.status,
        })

    return {"batches": result, "total": total}


def get_batch_report(db: Session, batch_id: str) -> Optional[Dict[str, Any]]:
    batch = db.query(ImportBatch).filter(ImportBatch.batch_id == batch_id).first()
    if not batch:
        return None

    records = db.query(BorrowRecord).filter(BorrowRecord.batch_id == batch.id).all()
    results = db.query(ImportResult).filter(ImportResult.batch_id == batch.id).all()

    result_map = {}
    for r in results:
        if r.record_id not in result_map:
            result_map[r.record_id] = []
        result_map[r.record_id].append({
            "result_type": r.result_type,
            "rule_code": r.rule_code,
            "rule_name": r.rule_name,
            "message": r.message,
            "suggestion": r.suggestion,
        })

    records_data = []
    for rec in records:
        record_data = {
            "record_no": rec.record_no,
            "case_no": rec.case_no,
            "person_id": rec.person_id,
            "person_name": rec.person_name,
            "borrow_date": rec.borrow_date,
            "due_date": rec.due_date,
            "return_date": rec.return_date,
            "renew_count": rec.renew_count,
            "action_type": rec.action_type,
            "status": rec.status,
            "is_overdue": rec.is_overdue,
            "check_results": result_map.get(rec.id, []),
        }
        records_data.append(record_data)

    return {
        "batch_id": batch.batch_id,
        "import_time": batch.import_time,
        "filename": batch.filename,
        "import_type": batch.import_type,
        "total_records": batch.total_records,
        "success_count": batch.success_count,
        "confirm_count": batch.confirm_count,
        "fail_count": batch.fail_count,
        "status": batch.status,
        "records": records_data,
    }


def get_record_trace(db: Session, record_no: str) -> Optional[Dict[str, Any]]:
    borrow_record = db.query(BorrowRecord).filter(
        BorrowRecord.record_no == record_no
    ).first()

    if not borrow_record:
        return None

    batch = db.query(ImportBatch).filter(ImportBatch.id == borrow_record.batch_id).first()
    case = db.query(Case).filter(Case.case_no == borrow_record.case_no).first()
    person = db.query(Person).filter(Person.person_id == borrow_record.person_id).first()

    check_results = db.query(ImportResult).filter(
        ImportResult.record_id == borrow_record.id
    ).all()

    borrow_data = {
        "record_no": borrow_record.record_no,
        "case_no": borrow_record.case_no,
        "person_id": borrow_record.person_id,
        "person_name": borrow_record.person_name,
        "borrow_date": borrow_record.borrow_date,
        "due_date": borrow_record.due_date,
        "return_date": borrow_record.return_date,
        "renew_count": borrow_record.renew_count,
        "action_type": borrow_record.action_type,
        "status": borrow_record.status,
        "is_overdue": borrow_record.is_overdue,
        "create_time": borrow_record.create_time,
    }

    case_info = None
    if case:
        case_info = {
            "case_no": case.case_no,
            "case_name": case.case_name,
            "case_type": case.case_type,
            "is_secret": case.is_secret,
            "secret_level": case.secret_level,
        }

    person_info = None
    if person:
        person_info = {
            "person_id": person.person_id,
            "name": person.name,
            "department": person.department,
            "position": person.position,
            "permission_level": person.permission_level,
            "can_access_secret": person.can_access_secret,
        }

    results_data = []
    suggestions = []
    for r in check_results:
        results_data.append({
            "result_type": r.result_type,
            "rule_code": r.rule_code,
            "rule_name": r.rule_name,
            "message": r.message,
            "suggestion": r.suggestion,
        })
        if r.suggestion:
            suggestions.append(r.suggestion)

    return {
        "record_no": borrow_record.record_no,
        "batch_id": batch.batch_id if batch else None,
        "borrow_record": borrow_data,
        "case_info": case_info,
        "person_info": person_info,
        "check_results": results_data,
        "suggestions": suggestions,
    }


def search_records(
    db: Session,
    case_no: str = None,
    person_id: str = None,
    person_name: str = None,
    status: str = None,
    skip: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    query = db.query(BorrowRecord)

    if case_no:
        query = query.filter(BorrowRecord.case_no.contains(case_no))
    if person_id:
        query = query.filter(BorrowRecord.person_id.contains(person_id))
    if person_name:
        query = query.filter(BorrowRecord.person_name.contains(person_name))
    if status:
        query = query.filter(BorrowRecord.status == status)

    query = query.order_by(desc(BorrowRecord.create_time))
    total = query.count()
    records = query.offset(skip).limit(limit).all()

    result = []
    for rec in records:
        result.append({
            "id": rec.id,
            "record_no": rec.record_no,
            "case_no": rec.case_no,
            "person_id": rec.person_id,
            "person_name": rec.person_name,
            "borrow_date": rec.borrow_date,
            "due_date": rec.due_date,
            "return_date": rec.return_date,
            "renew_count": rec.renew_count,
            "action_type": rec.action_type,
            "status": rec.status,
            "is_overdue": rec.is_overdue,
        })

    return {"records": result, "total": total}


def get_statistics(db: Session) -> Dict[str, Any]:
    total_batches = db.query(ImportBatch).count()
    total_records = db.query(BorrowRecord).count()
    total_cases = db.query(Case).count()
    total_persons = db.query(Person).count()

    overdue_records = db.query(BorrowRecord).filter(
        BorrowRecord.is_overdue == True,
        BorrowRecord.return_date.is_(None),
    ).count()

    secret_cases = db.query(Case).filter(Case.is_secret == True).count()

    return {
        "total_batches": total_batches,
        "total_records": total_records,
        "total_cases": total_cases,
        "total_persons": total_persons,
        "overdue_records": overdue_records,
        "secret_cases": secret_cases,
    }