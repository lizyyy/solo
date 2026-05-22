from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from .models import (
    ColdChainRecord, ImportBatch, RecordIssue, FixHistory,
    OperationLog, RecordStatus, IssueType, DataSource
)


def generate_supervisor_report(session: Session, batch_id=None, days=7):
    report = {
        "generated_at": datetime.now().isoformat(),
        "summary": {},
        "failed_records": [],
        "fixed_records": [],
        "reimport_summary": [],
        "issue_by_type": {}
    }
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    records_query = session.query(ColdChainRecord).filter(
        ColdChainRecord.created_at >= start_date
    )
    if batch_id:
        records_query = records_query.filter_by(batch_id=batch_id)
    
    all_records = records_query.all()
    report["summary"]["total_records"] = len(all_records)
    
    status_counts = {}
    for record in all_records:
        status = record.status.value
        if status not in status_counts:
            status_counts[status] = 0
        status_counts[status] += 1
    report["summary"]["by_status"] = status_counts
    
    issues_query = session.query(RecordIssue).filter(
        RecordIssue.detected_at >= start_date
    )
    if batch_id:
        issues_query = issues_query.join(ColdChainRecord).filter(
            ColdChainRecord.batch_id == batch_id
        )
    
    issues = issues_query.all()
    report["summary"]["total_issues"] = len(issues)
    
    issue_types = {}
    for issue in issues:
        itype = issue.issue_type.value
        if itype not in issue_types:
            issue_types[itype] = {"count": 0, "resolved": 0, "records": []}
        issue_types[itype]["count"] += 1
        if issue.resolved:
            issue_types[itype]["resolved"] += 1
        
        if len(issue_types[itype]["records"]) < 20:
            issue_types[itype]["records"].append({
                "record_id": issue.record_id,
                "description": issue.description,
                "resolved": issue.resolved
            })
    
    report["issue_by_type"] = issue_types
    
    failed_query = session.query(ColdChainRecord).filter(
        ColdChainRecord.status == RecordStatus.ISSUE_FOUND,
        ColdChainRecord.created_at >= start_date
    )
    if batch_id:
        failed_query = failed_query.filter_by(batch_id=batch_id)
    
    failed_records = failed_query.all()
    for record in failed_records:
        record_issues = session.query(RecordIssue).filter_by(
            record_id=record.id, resolved=False
        ).all()
        
        report["failed_records"].append({
            "record_id": record.id,
            "original_line_no": record.original_line_no,
            "batch_id": record.batch_id,
            "box_no": record.box_no,
            "source_type": record.source_type.value if record.source_type else None,
            "issues": [
                {
                    "type": i.issue_type.value,
                    "field": i.field_name,
                    "description": i.description
                }
                for i in record_issues
            ],
            "created_at": record.created_at.isoformat() if record.created_at else None
        })
    
    fixed_query = session.query(ColdChainRecord).filter(
        ColdChainRecord.status == RecordStatus.FIXED,
        ColdChainRecord.created_at >= start_date
    )
    if batch_id:
        fixed_query = fixed_query.filter_by(batch_id=batch_id)
    
    fixed_records = fixed_query.all()
    for record in fixed_records:
        fix_histories = session.query(FixHistory).filter_by(
            record_id=record.id
        ).all()
        
        report["fixed_records"].append({
            "record_id": record.id,
            "original_line_no": record.original_line_no,
            "batch_id": record.batch_id,
            "box_no": record.box_no,
            "fix_count": len(fix_histories),
            "fixes": [
                {
                    "field": fh.field_name,
                    "old_value": fh.old_value,
                    "new_value": fh.new_value,
                    "reason": fh.fix_reason,
                    "operator_role": fh.operator_role.value if fh.operator_role else None,
                    "created_at": fh.created_at.isoformat() if fh.created_at else None
                }
                for fh in fix_histories
            ]
        })
    
    reimport_batches = session.query(ImportBatch).filter(
        ImportBatch.status == "reimported",
        ImportBatch.imported_at >= start_date
    ).all()
    
    for batch in reimport_batches:
        report["reimport_summary"].append({
            "batch_no": batch.batch_no,
            "filename": batch.filename,
            "total_rows": batch.total_rows,
            "imported_at": batch.imported_at.isoformat() if batch.imported_at else None,
            "notes": batch.notes
        })
    
    return report


def get_operation_history(session: Session, user_id=None, action=None, days=30):
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    query = session.query(OperationLog).filter(
        OperationLog.created_at >= start_date
    )
    
    if user_id:
        query = query.filter_by(user_id=user_id)
    if action:
        query = query.filter_by(action=action)
    
    logs = query.order_by(OperationLog.created_at.desc()).all()
    
    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None
        })
    
    return result


def get_batch_list(session: Session):
    batches = session.query(ImportBatch).order_by(
        ImportBatch.imported_at.desc()
    ).all()
    
    result = []
    for batch in batches:
        record_count = session.query(ColdChainRecord).filter_by(
            batch_id=batch.id
        ).count()
        
        issue_count = session.query(RecordIssue).join(
            ColdChainRecord
        ).filter(
            ColdChainRecord.batch_id == batch.id
        ).count()
        
        result.append({
            "id": batch.id,
            "batch_no": batch.batch_no,
            "source": batch.source.value if batch.source else None,
            "filename": batch.filename,
            "total_rows": batch.total_rows,
            "actual_records": record_count,
            "issues": issue_count,
            "status": batch.status,
            "imported_at": batch.imported_at.isoformat() if batch.imported_at else None
        })
    
    return result


def export_to_csv(session: Session, output_path: str, batch_id=None, include_raw=False):
    import csv
    
    query = session.query(ColdChainRecord)
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    
    records = query.all()
    
    fieldnames = [
        "id", "batch_id", "original_line_no", "source_type",
        "box_no", "original_box_no", "driver_name", "vehicle_no",
        "departure", "destination",
        "shipment_date", "receive_date", "expected_date", "cross_day",
        "quantity", "original_quantity", "unit_price", "amount", "original_amount",
        "min_temp", "max_temp", "avg_temp", "temp_exceed_count",
        "shift_no", "photo_ref", "signatory",
        "status", "created_at", "updated_at"
    ]
    
    if include_raw:
        fieldnames.append("raw_data")
    
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for record in records:
            row = {
                "id": record.id,
                "batch_id": record.batch_id,
                "original_line_no": record.original_line_no,
                "source_type": record.source_type.value if record.source_type else "",
                "box_no": record.box_no or "",
                "original_box_no": record.original_box_no or "",
                "driver_name": record.driver_name or "",
                "vehicle_no": record.vehicle_no or "",
                "departure": record.departure or "",
                "destination": record.destination or "",
                "shipment_date": record.shipment_date.isoformat() if record.shipment_date else "",
                "receive_date": record.receive_date.isoformat() if record.receive_date else "",
                "expected_date": record.expected_date.isoformat() if record.expected_date else "",
                "cross_day": "是" if record.cross_day else "否",
                "quantity": record.quantity or "",
                "original_quantity": record.original_quantity or "",
                "unit_price": record.unit_price or "",
                "amount": record.amount or "",
                "original_amount": record.original_amount or "",
                "min_temp": record.min_temp or "",
                "max_temp": record.max_temp or "",
                "avg_temp": record.avg_temp or "",
                "temp_exceed_count": record.temp_exceed_count or 0,
                "shift_no": record.shift_no or "",
                "photo_ref": record.photo_ref or "",
                "signatory": record.signatory or "",
                "status": record.status.value if record.status else "",
                "created_at": record.created_at.isoformat() if record.created_at else "",
                "updated_at": record.updated_at.isoformat() if record.updated_at else "",
            }
            
            if include_raw:
                row["raw_data"] = str(record.raw_data) if record.raw_data else ""
            
            writer.writerow(row)
    
    return len(records)


def export_issues_to_csv(session: Session, output_path: str, batch_id=None):
    import csv
    
    query = session.query(RecordIssue).join(ColdChainRecord)
    if batch_id:
        query = query.filter(ColdChainRecord.batch_id == batch_id)
    
    issues = query.all()
    
    fieldnames = [
        "issue_id", "record_id", "original_line_no", "batch_id",
        "issue_type", "field_name", "description",
        "old_value", "new_value", "confidence",
        "resolved", "resolved_by", "resolved_at", "detected_at"
    ]
    
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for issue in issues:
            writer.writerow({
                "issue_id": issue.id,
                "record_id": issue.record_id,
                "original_line_no": issue.record.original_line_no if issue.record else "",
                "batch_id": issue.record.batch_id if issue.record else "",
                "issue_type": issue.issue_type.value,
                "field_name": issue.field_name or "",
                "description": issue.description or "",
                "old_value": issue.old_value or "",
                "new_value": issue.new_value or "",
                "confidence": issue.confidence or "",
                "resolved": "是" if issue.resolved else "否",
                "resolved_by": issue.resolved_by or "",
                "resolved_at": issue.resolved_at.isoformat() if issue.resolved_at else "",
                "detected_at": issue.detected_at.isoformat() if issue.detected_at else ""
            })
    
    return len(issues)
