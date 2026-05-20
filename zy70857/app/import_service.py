import hashlib
import json
import uuid
from datetime import datetime
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session

from app.models import Case, Person, BorrowRecord, ImportBatch, ImportResult
from app.rules_engine import RuleEngine, ResultType, RuleResult
from app.data_parser import (
    parse_borrow_records,
    parse_cases_from_json,
    parse_persons_from_json,
    get_file_type,
)


def generate_batch_id() -> str:
    return f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"


def generate_record_hash(record: Dict[str, Any]) -> str:
    keys = ["case_no", "person_id", "borrow_date"]
    hash_data = {k: str(record.get(k, "")) for k in keys}
    hash_str = json.dumps(hash_data, sort_keys=True, ensure_ascii=False)
    return hashlib.md5(hash_str.encode("utf-8")).hexdigest()


def check_duplicate_record(db: Session, record: Dict[str, Any], exclude_batch_id: int = None) -> bool:
    record_hash = generate_record_hash(record)
    query = db.query(BorrowRecord).filter(
        BorrowRecord.record_no == record.get("record_no"),
        BorrowRecord.case_no == record.get("case_no"),
        BorrowRecord.person_id == record.get("person_id"),
    )
    if exclude_batch_id:
        query = query.filter(BorrowRecord.batch_id != exclude_batch_id)
    return query.first() is not None


def import_cases(db: Session, content: bytes) -> Tuple[int, int]:
    cases = parse_cases_from_json(content)
    added = 0
    updated = 0

    for case_data in cases:
        existing = db.query(Case).filter(Case.case_no == case_data["case_no"]).first()
        if existing:
            for key, value in case_data.items():
                setattr(existing, key, value)
            updated += 1
        else:
            case = Case(**case_data)
            db.add(case)
            added += 1

    db.commit()
    return added, updated


def import_persons(db: Session, content: bytes) -> Tuple[int, int]:
    persons = parse_persons_from_json(content)
    added = 0
    updated = 0

    for person_data in persons:
        existing = db.query(Person).filter(Person.person_id == person_data["person_id"]).first()
        if existing:
            for key, value in person_data.items():
                setattr(existing, key, value)
            updated += 1
        else:
            person = Person(**person_data)
            db.add(person)
            added += 1

    db.commit()
    return added, updated


def get_cases_dict(db: Session) -> Dict[str, Dict[str, Any]]:
    cases = db.query(Case).all()
    return {
        c.case_no: {
            "case_no": c.case_no,
            "case_name": c.case_name,
            "is_secret": c.is_secret,
            "secret_level": c.secret_level,
        }
        for c in cases
    }


def get_persons_dict(db: Session) -> Dict[str, Dict[str, Any]]:
    persons = db.query(Person).all()
    return {
        p.person_id: {
            "person_id": p.person_id,
            "name": p.name,
            "department": p.department,
            "can_access_secret": p.can_access_secret,
        }
        for p in persons
    }


def process_borrow_records(
    db: Session,
    content: bytes,
    filename: str,
    check_duplicate: bool = True,
) -> Dict[str, Any]:
    batch_id = generate_batch_id()
    file_type = get_file_type(filename)

    borrow_records = parse_borrow_records(content, file_type)

    cases = get_cases_dict(db)
    persons = get_persons_dict(db)
    rule_engine = RuleEngine(cases, persons)

    batch = ImportBatch(
        batch_id=batch_id,
        filename=filename,
        import_type="borrow",
        total_records=len(borrow_records),
        status="processing",
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    success_items = []
    confirm_items = []
    fail_items = []

    success_count = 0
    confirm_count = 0
    fail_count = 0

    for record in borrow_records:
        raw_data = record.pop("_raw", {})

        is_duplicate = False
        if check_duplicate:
            is_duplicate = check_duplicate_record(db, record)

        if is_duplicate:
            fail_items.append({
                "record_no": record.get("record_no"),
                "original_data": raw_data,
                "result_type": "fail",
                "rule_code": "DUPLICATE_RECORD",
                "rule_name": "重复记录校验",
                "message": "该借阅记录已存在，不允许重复导入",
                "suggestion": "请检查记录是否重复，或使用新的记录编号",
            })
            fail_count += 1
            continue

        result_type, rule_results = rule_engine.check_all_rules(record)

        record_data = {k: v for k, v in record.items() if k != "_raw"}

        borrow_record = BorrowRecord(
            batch_id=batch.id,
            **record_data,
        )
        db.add(borrow_record)
        db.flush()

        for rule_result in rule_results:
            import_result = ImportResult(
                batch_id=batch.id,
                record_id=borrow_record.id,
                result_type=rule_result.result_type.value,
                rule_code=rule_result.rule_code,
                rule_name=rule_result.rule_name,
                message=rule_result.message,
                suggestion=rule_result.suggestion,
                original_data=json.dumps(raw_data, ensure_ascii=False),
            )
            db.add(import_result)

        output_data = {
            "record_no": record.get("record_no"),
            "case_no": record.get("case_no"),
            "person_id": record.get("person_id"),
            "person_name": record.get("person_name"),
            "borrow_date": record.get("borrow_date"),
            "due_date": record.get("due_date"),
            "return_date": record.get("return_date"),
            "renew_count": record.get("renew_count"),
            "action_type": record.get("action_type"),
        }

        if result_type == ResultType.SUCCESS:
            success_items.append(output_data)
            success_count += 1
        elif result_type == ResultType.CONFIRM:
            confirm_items.append({
                **output_data,
                "original_data": raw_data,
                "result_type": "confirm",
                "check_results": [
                    {
                        "rule_code": r.rule_code,
                        "rule_name": r.rule_name,
                        "message": r.message,
                        "suggestion": r.suggestion,
                    }
                    for r in rule_results
                ],
            })
            confirm_count += 1
        else:
            fail_items.append({
                **output_data,
                "original_data": raw_data,
                "result_type": "fail",
                "check_results": [
                    {
                        "rule_code": r.rule_code,
                        "rule_name": r.rule_name,
                        "message": r.message,
                        "suggestion": r.suggestion,
                    }
                    for r in rule_results
                ],
            })
            fail_count += 1

    batch.success_count = success_count
    batch.confirm_count = confirm_count
    batch.fail_count = fail_count
    batch.status = "completed"
    db.commit()

    return {
        "batch_id": batch_id,
        "import_time": batch.import_time,
        "summary": {
            "total": len(borrow_records),
            "success": success_count,
            "confirm": confirm_count,
            "fail": fail_count,
        },
        "success_items": success_items,
        "confirm_items": confirm_items,
        "fail_items": fail_items,
    }