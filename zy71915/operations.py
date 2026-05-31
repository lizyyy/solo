from datetime import datetime
from typing import List, Dict, Optional, Callable
from models import ScheduleRecord, ScheduleDatabase, ConfirmationStatus, Material, SilenceSegment, IssueType
from validator import validate_all, validate_record
import copy
import csv
import io


def generate_record_key(record: ScheduleRecord) -> str:
    if record.slot_start and record.ad_name:
        return f"{record.slot_start.strftime('%Y%m%d')}_{record.ad_name}"
    return record.record_id


def import_records(
    db: ScheduleDatabase,
    new_records: List[ScheduleRecord],
    operator: str,
    allow_versioning: bool = True
) -> Dict:
    result = {
        "imported": [],
        "updated": [],
        "skipped": [],
        "errors": [],
        "warnings": []
    }
    
    validated = validate_all(new_records)
    
    for record in validated:
        key = generate_record_key(record)
        existing = None
        
        for rid, r in db.records.items():
            if generate_record_key(r) == key and r.status != ConfirmationStatus.REJECTED:
                existing = r
                break
        
        if existing:
            if allow_versioning:
                old_version = existing.version
                new_version = old_version + 1
                
                old_record = copy.deepcopy(existing)
                db.add_log(
                    operation="撤回旧版本",
                    record_id=existing.record_id,
                    version=old_version,
                    operator=operator,
                    details={"reason": "导入新版本，旧版本自动撤回"}
                )
                
                existing.version = new_version
                existing.ad_name = record.ad_name
                existing.slot_start = record.slot_start
                existing.slot_end = record.slot_end
                existing.expected_duration = record.expected_duration
                existing.actual_duration = record.actual_duration
                existing.materials = record.materials
                existing.silence_segments = record.silence_segments
                existing.notes = record.notes
                existing.updated_at = datetime.now()
                existing.created_by = operator
                
                validated_record = validate_record(existing)
                
                db.add_log(
                    operation="导入新版本",
                    record_id=existing.record_id,
                    version=new_version,
                    operator=operator,
                    details={
                        "old_version": old_version,
                        "status": validated_record.status.value,
                        "issues": [i.message for i in validated_record.issues]
                    }
                )
                
                result["updated"].append({
                    "record_id": existing.record_id,
                    "ad_name": existing.ad_name,
                    "old_version": old_version,
                    "new_version": new_version,
                    "status": validated_record.status.value,
                    "issues": [i.message for i in validated_record.issues]
                })
            else:
                result["skipped"].append({
                    "record_id": record.record_id,
                    "ad_name": record.ad_name,
                    "reason": "记录已存在，且不允许版本更新"
                })
        else:
            record.created_by = operator
            validated_record = validate_record(record)
            db.records[record.record_id] = validated_record
            
            db.add_log(
                operation="新导入",
                record_id=record.record_id,
                version=1,
                operator=operator,
                details={
                    "status": validated_record.status.value,
                    "issues": [i.message for i in validated_record.issues]
                }
            )
            
            result["imported"].append({
                "record_id": record.record_id,
                "ad_name": record.ad_name,
                "version": 1,
                "status": validated_record.status.value,
                "issues": [i.message for i in validated_record.issues]
            })
    
    all_records = list(db.records.values())
    validate_all(all_records)
    
    return result


def withdraw_record(
    db: ScheduleDatabase,
    record_id: str,
    operator: str,
    reason: str
) -> Dict:
    if record_id not in db.records:
        return {
            "success": False,
            "error": f"找不到记录ID：{record_id}"
        }
    
    record = db.records[record_id]
    old_status = record.status
    record.status = ConfirmationStatus.REJECTED
    record.updated_at = datetime.now()
    
    db.add_log(
        operation="撤回",
        record_id=record_id,
        version=record.version,
        operator=operator,
        details={"old_status": old_status.value, "reason": reason}
    )
    
    return {
        "success": True,
        "record_id": record_id,
        "ad_name": record.ad_name,
        "old_status": old_status.value,
        "new_status": record.status.value,
        "reason": reason
    }


def amend_record(
    db: ScheduleDatabase,
    record_id: str,
    operator: str,
    updates: Dict,
    reason: str
) -> Dict:
    if record_id not in db.records:
        return {
            "success": False,
            "error": f"找不到记录ID：{record_id}"
        }
    
    record = db.records[record_id]
    old_version = record.version
    old_record = copy.deepcopy(record)
    
    for key, value in updates.items():
        if hasattr(record, key):
            setattr(record, key, value)
    
    record.version = old_version + 1
    record.updated_at = datetime.now()
    
    validated = validate_record(record)
    
    db.add_log(
        operation="修正",
        record_id=record_id,
        version=record.version,
        operator=operator,
        details={
            "old_version": old_version,
            "old_status": old_record.status.value,
            "new_status": validated.status.value,
            "updates": list(updates.keys()),
            "reason": reason,
            "issues": [i.message for i in validated.issues]
        }
    )
    
    all_records = list(db.records.values())
    validate_all(all_records)
    
    return {
        "success": True,
        "record_id": record_id,
        "ad_name": record.ad_name,
        "old_version": old_version,
        "new_version": record.version,
        "status": validated.status.value,
        "issues": [i.message for i in validated.issues]
    }


def filter_records(
    records: List[ScheduleRecord],
    status_filter: Optional[List[ConfirmationStatus]] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    ad_name_contains: Optional[str] = None,
    has_issues: Optional[bool] = None
) -> List[ScheduleRecord]:
    filtered = records
    
    if status_filter:
        filtered = [r for r in filtered if r.status in status_filter]
    
    if date_from:
        filtered = [r for r in filtered if r.slot_start and r.slot_start >= date_from]
    
    if date_to:
        filtered = [r for r in filtered if r.slot_end and r.slot_end <= date_to]
    
    if ad_name_contains:
        filtered = [r for r in filtered if ad_name_contains.lower() in r.ad_name.lower()]
    
    if has_issues is not None:
        if has_issues:
            filtered = [r for r in filtered if len(r.issues) > 0]
        else:
            filtered = [r for r in filtered if len(r.issues) == 0]
    
    return filtered


def export_records(
    records: List[ScheduleRecord],
    operator: str,
    include_pending: bool = False,
    include_issues: bool = True
) -> Dict:
    validated = validate_all(records)
    
    if include_pending:
        exportable = [r for r in validated if r.status != ConfirmationStatus.REJECTED]
    else:
        exportable = [r for r in validated if r.status == ConfirmationStatus.CONFIRMED]
    
    pending_count = len([r for r in validated if r.status == ConfirmationStatus.PENDING])
    review_count = len([r for r in validated if r.status == ConfirmationStatus.NEEDS_REVIEW])
    rejected_count = len([r for r in validated if r.status == ConfirmationStatus.REJECTED])
    
    export_data = []
    for record in exportable:
        row = {
            "记录ID": record.record_id,
            "版本": record.version,
            "广告名称": record.ad_name,
            "状态": record.status.value,
            "开始时间": record.slot_start.strftime("%Y-%m-%d %H:%M:%S") if record.slot_start else "",
            "结束时间": record.slot_end.strftime("%Y-%m-%d %H:%M:%S") if record.slot_end else "",
            "预期时长(秒)": record.expected_duration.total_seconds() if record.expected_duration else "",
            "素材数量": len(record.materials),
            "素材名称": "、".join([m.name for m in record.materials])
        }
        
        if include_issues and record.issues:
            row["问题数量"] = len(record.issues)
            row["问题描述"] = "；".join([i.message for i in record.issues])
            row["复核原因"] = "\n".join([i.reviewable_reason or "" for i in record.issues if i.reviewable_reason])
        
        export_data.append(row)
    
    return {
        "exported_count": len(export_data),
        "total_count": len(validated),
        "confirmed_count": len([r for r in validated if r.status == ConfirmationStatus.CONFIRMED]),
        "pending_count": pending_count,
        "review_needed_count": review_count,
        "rejected_count": rejected_count,
        "records": export_data,
        "warnings": [] if (pending_count == 0 and review_count == 0) else [
            f"本次导出包含 {len(export_data)} 条记录",
            f"其中已确认 {len([r for r in validated if r.status == ConfirmationStatus.CONFIRMED])} 条",
            f"待确认 {pending_count} 条" if include_pending else f"有 {pending_count} 条待确认记录未导出",
            f"需复核 {review_count} 条" if include_pending else f"有 {review_count} 条需复核记录未导出",
            f"已撤回 {rejected_count} 条"
        ]
    }


def export_to_csv(export_result: Dict) -> str:
    if not export_result["records"]:
        return "没有可导出的记录"
    
    output = io.StringIO()
    fieldnames = export_result["records"][0].keys()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(export_result["records"])
    
    csv_content = output.getvalue()
    
    if export_result["warnings"]:
        csv_content += "\n\n# 导出说明\n"
        for warning in export_result["warnings"]:
            csv_content += f"# {warning}\n"
    
    return csv_content


def get_record_history(db: ScheduleDatabase, record_id: str) -> List[Dict]:
    logs = [l for l in db.logs if l.record_id == record_id]
    return [
        {
            "时间": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "操作": log.operation,
            "版本": log.version,
            "操作人": log.operator,
            "详情": log.details
        }
        for log in sorted(logs, key=lambda l: l.timestamp)
    ]


def get_controversial_records(records: List[ScheduleRecord]) -> List[Dict]:
    controversial = []
    for record in records:
        drift_issues = [i for i in record.issues if i.issue_type == IssueType.TIMELINE_DRIFT]
        silence_issues = [i for i in record.issues if i.issue_type == IssueType.SILENCE_DELETED]
        
        if drift_issues or silence_issues:
            controversial.append({
                "record_id": record.record_id,
                "ad_name": record.ad_name,
                "status": record.status.value,
                "version": record.version,
                "issues": [
                    {
                        "type": i.issue_type,
                        "message": i.message,
                        "review_reason": i.reviewable_reason
                    }
                    for i in drift_issues + silence_issues
                ]
            })
    return controversial
