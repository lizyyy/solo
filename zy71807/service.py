import csv
import io
import json
import os
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import asdict, fields

from models import (
    ReviewRecord, ReviewStatus, SourceType,
    Evidence, EvidenceType, AuditLog, ActionType,
    PENDING_REASONS
)
from database import (
    init_db, create_review_record, get_review_record,
    update_review_record_status, add_evidence,
    find_duplicate_records, find_duplicate_by_file_hash,
    mark_as_duplicate, query_records, compute_file_hash,
    list_all_records, get_evidences_for_record,
    get_audit_logs_for_record
)


class DuplicateDetectionResult:
    def __init__(self):
        self.is_duplicate: bool = False
        self.existing_record_id: Optional[int] = None
        self.match_type: str = ""
        self.match_details: Dict[str, Any] = {}
        self.created_record: Optional[ReviewRecord] = None


class RiskReviewService:
    def __init__(self):
        init_db()

    def import_record(
        self,
        customer_id: str,
        customer_name: str,
        questionnaire_id: str,
        questionnaire_version: str,
        source_type: SourceType,
        source_batch_id: str,
        created_by: str,
        assigned_to: str = "",
        auto_detect_duplicate: bool = True,
        screenshot_content: Optional[bytes] = None,
        screenshot_name: str = "",
        email_content: Optional[bytes] = None,
        email_name: str = "",
    ) -> DuplicateDetectionResult:
        result = DuplicateDetectionResult()

        if auto_detect_duplicate:
            existing = find_duplicate_records(
                customer_id, questionnaire_id, questionnaire_version
            )
            if existing:
                result.is_duplicate = True
                result.existing_record_id = existing[0].id
                result.match_type = "customer_questionnaire"
                result.match_details = {
                    "customer_id": customer_id,
                    "questionnaire_id": questionnaire_id,
                    "questionnaire_version": questionnaire_version,
                    "existing_record_created_at": existing[0].created_at.isoformat()
                }

        record = ReviewRecord(
            customer_id=customer_id,
            customer_name=customer_name,
            questionnaire_id=questionnaire_id,
            questionnaire_version=questionnaire_version,
            source_type=source_type,
            source_batch_id=source_batch_id,
            current_status=ReviewStatus.PENDING_APPROVAL_SCREENSHOT,
            assigned_to=assigned_to,
            created_by=created_by,
            is_duplicate=result.is_duplicate,
            duplicate_of_id=result.existing_record_id
        )

        import_details = {
            "auto_detect_duplicate": auto_detect_duplicate,
            "duplicate_detected": result.is_duplicate,
            "match_type": result.match_type,
            "screenshot_provided": screenshot_content is not None,
            "email_provided": email_content is not None,
        }

        created = create_review_record(record, created_by, import_details)
        result.created_record = created

        if screenshot_content:
            self.add_evidence(
                created.id, EvidenceType.APPROVAL_SCREENSHOT,
                screenshot_content, screenshot_name or "approval_screenshot.png",
                created_by, "导入时上传的审批截图"
            )

        if email_content:
            self.add_evidence(
                created.id, EvidenceType.SUPPLEMENT_EMAIL,
                email_content, email_name or "supplement_email.eml",
                created_by, "导入时上传的补充邮件"
            )

        return result

    def batch_import(
        self,
        records_data: List[Dict[str, Any]],
        source_batch_id: str,
        created_by: str,
        source_type: SourceType = SourceType.BATCH_IMPORT
    ) -> List[DuplicateDetectionResult]:
        results = []
        for idx, data in enumerate(records_data):
            result = self.import_record(
                customer_id=data['customer_id'],
                customer_name=data['customer_name'],
                questionnaire_id=data['questionnaire_id'],
                questionnaire_version=data.get('questionnaire_version', 'v1.0'),
                source_type=source_type,
                source_batch_id=source_batch_id,
                created_by=created_by,
                assigned_to=data.get('assigned_to', ''),
                auto_detect_duplicate=data.get('auto_detect_duplicate', True),
                screenshot_content=data.get('screenshot_content'),
                screenshot_name=data.get('screenshot_name', ''),
                email_content=data.get('email_content'),
                email_name=data.get('email_name', ''),
            )
            results.append(result)
        return results

    def add_evidence(
        self,
        record_id: int,
        evidence_type: EvidenceType,
        file_content: bytes,
        file_name: str,
        uploaded_by: str,
        description: str = "",
        metadata: Optional[Dict] = None
    ) -> Optional[Evidence]:
        file_hash = compute_file_hash(file_content)
        existing_evidence = find_duplicate_by_file_hash(file_hash)
        if existing_evidence and existing_evidence.review_record_id != record_id:
            existing_record = get_review_record(existing_evidence.review_record_id, load_related=False)
            if existing_record and not existing_record.is_duplicate:
                mark_as_duplicate(
                    record_id, existing_evidence.review_record_id,
                    uploaded_by,
                    f"证据文件重复，与记录#{existing_evidence.review_record_id}的文件哈希相同"
                )

        return add_evidence(
            record_id, evidence_type, file_content, file_name,
            uploaded_by, description, metadata
        )

    def withdraw_record(
        self,
        record_id: int,
        operator: str,
        reason: str
    ) -> Optional[ReviewRecord]:
        record = get_review_record(record_id, load_related=False)
        if not record:
            return None
        if record.current_status in [ReviewStatus.APPROVED, ReviewStatus.REJECTED]:
            raise ValueError(f"已完成的记录（{record.current_status.value}）不能撤回")
        return update_review_record_status(
            record_id, ReviewStatus.WITHDRAWN, operator, reason
        )

    def correct_record(
        self,
        record_id: int,
        operator: str,
        correction_note: str,
        reset_to_start: bool = False
    ) -> Optional[ReviewRecord]:
        record = get_review_record(record_id, load_related=False)
        if not record:
            return None

        from database import get_connection
        with get_connection() as conn:
            now = datetime.now().isoformat()
            conn.execute('''
                UPDATE review_records
                SET correction_note = ?, updated_at = ?
                WHERE id = ?
            ''', (correction_note, now, record_id))

        new_status = ReviewStatus.NEEDS_CORRECTION
        if reset_to_start:
            new_status = ReviewStatus.PENDING_APPROVAL_SCREENSHOT

        result = update_review_record_status(
            record_id, new_status, operator,
            f"撤回修正: {correction_note}",
            {"correction_note": correction_note, "reset_to_start": reset_to_start}
        )

        if result and reset_to_start:
            corrected_record = ReviewRecord(
                customer_id=record.customer_id,
                customer_name=record.customer_name,
                questionnaire_id=record.questionnaire_id,
                questionnaire_version=record.questionnaire_version,
                source_type=SourceType.CORRECTION,
                source_batch_id=f"correction_{record_id}_{datetime.now().strftime('%Y%m%d')}",
                current_status=ReviewStatus.PENDING_APPROVAL_SCREENSHOT,
                assigned_to=record.assigned_to,
                created_by=operator,
                correction_note=f"修正自记录#{record_id}: {correction_note}"
            )
            create_review_record(
                corrected_record, operator,
                {"corrected_from_id": record_id, "correction_note": correction_note}
            )

        return result

    def manual_confirm(
        self,
        record_id: int,
        operator: str,
        confirm_note: str,
        confirm_file_content: Optional[bytes] = None,
        confirm_file_name: str = "manual_confirmation.pdf"
    ) -> Optional[ReviewRecord]:
        record = get_review_record(record_id, load_related=True)
        if not record:
            return None
        if record.current_status != ReviewStatus.PENDING_MANUAL_CONFIRM:
            raise ValueError(
                f"当前状态{record.current_status.value}不能进行人工确认，"
                f"需要状态为{ReviewStatus.PENDING_MANUAL_CONFIRM.value}"
            )

        missing = []
        if not record.get_evidence_by_type(EvidenceType.APPROVAL_SCREENSHOT):
            missing.append("审批截图")
        if not record.get_evidence_by_type(EvidenceType.SUPPLEMENT_EMAIL):
            missing.append("补充邮件")
        if missing:
            raise ValueError(f"缺少必要证据: {', '.join(missing)}")

        if confirm_file_content is None:
            confirm_file_content = json.dumps({
                "operator": operator,
                "confirm_note": confirm_note,
                "confirmed_at": datetime.now().isoformat(),
                "record_id": record_id
            }, ensure_ascii=False).encode('utf-8')

        self.add_evidence(
            record_id, EvidenceType.MANUAL_CONFIRMATION,
            confirm_file_content, confirm_file_name,
            operator, confirm_note,
            {"confirm_note": confirm_note}
        )

        return get_review_record(record_id)

    def risk_review(
        self,
        record_id: int,
        operator: str,
        approved: bool,
        review_note: str,
        checklist_content: Optional[bytes] = None,
        checklist_name: str = "review_checklist.pdf"
    ) -> Optional[ReviewRecord]:
        record = get_review_record(record_id, load_related=True)
        if not record:
            return None
        if record.current_status != ReviewStatus.PENDING_RISK_REVIEW:
            raise ValueError(
                f"当前状态{record.current_status.value}不能进行风控复核，"
                f"需要状态为{ReviewStatus.PENDING_RISK_REVIEW.value}"
            )

        if checklist_content is None:
            checklist_content = json.dumps({
                "operator": operator,
                "approved": approved,
                "review_note": review_note,
                "reviewed_at": datetime.now().isoformat(),
                "record_id": record_id,
                "checklist_items": {
                    "screenshot_verified": record.get_evidence_by_type(EvidenceType.APPROVAL_SCREENSHOT) is not None,
                    "email_verified": record.get_evidence_by_type(EvidenceType.SUPPLEMENT_EMAIL) is not None,
                    "confirmation_verified": record.get_evidence_by_type(EvidenceType.MANUAL_CONFIRMATION) is not None,
                }
            }, ensure_ascii=False).encode('utf-8')

        self.add_evidence(
            record_id, EvidenceType.REVIEW_CHECKLIST,
            checklist_content, checklist_name,
            operator, review_note,
            {"approved": approved, "review_note": review_note}
        )

        if not approved:
            return update_review_record_status(
                record_id, ReviewStatus.REJECTED, operator,
                f"风控复核驳回: {review_note}"
            )

        return get_review_record(record_id)

    def filter_records(
        self,
        filters: Optional[Dict[str, Any]] = None,
        order_by: str = "created_at DESC",
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[ReviewRecord], int, int]:
        offset = (page - 1) * page_size
        records, total = query_records(filters, order_by, page_size, offset)
        total_pages = (total + page_size - 1) // page_size
        return records, total, total_pages

    def export_records(
        self,
        filters: Optional[Dict[str, Any]] = None,
        format: str = "csv",
        include_evidence: bool = True,
        include_audit: bool = False
    ) -> bytes:
        records, _ = query_records(filters, "created_at DESC")
        full_records = []
        for r in records:
            r.evidences = get_evidences_for_record(r.id)
            if include_audit:
                r.audit_logs = get_audit_logs_for_record(r.id)
            full_records.append(r)

        if format == "csv":
            return self._export_to_csv(full_records, include_evidence, include_audit)
        elif format == "json":
            return self._export_to_json(full_records, include_evidence, include_audit)
        else:
            raise ValueError(f"不支持的导出格式: {format}")

    def _export_to_csv(
        self,
        records: List[ReviewRecord],
        include_evidence: bool,
        include_audit: bool
    ) -> bytes:
        output = io.StringIO()
        writer = csv.writer(output)

        headers = [
            "记录ID", "客户ID", "客户名称", "问卷ID", "问卷版本",
            "来源类型", "来源批次", "当前状态", "待处理原因",
            "处理人", "创建人", "创建时间", "更新时间",
            "是否重复", "重复原记录ID", "修正备注"
        ]
        if include_evidence:
            headers.extend(["审批截图", "补充邮件", "人工确认", "复核清单"])
        if include_audit:
            headers.append("操作日志")
        writer.writerow(headers)

        for r in records:
            row = [
                r.id, r.customer_id, r.customer_name,
                r.questionnaire_id, r.questionnaire_version,
                r.source_type.value, r.source_batch_id,
                r.current_status.value, r.pending_reason,
                r.assigned_to, r.created_by,
                r.created_at.isoformat(), r.updated_at.isoformat(),
                "是" if r.is_duplicate else "否",
                r.duplicate_of_id or "",
                r.correction_note
            ]
            if include_evidence:
                row.append(self._format_evidence_info(r, EvidenceType.APPROVAL_SCREENSHOT))
                row.append(self._format_evidence_info(r, EvidenceType.SUPPLEMENT_EMAIL))
                row.append(self._format_evidence_info(r, EvidenceType.MANUAL_CONFIRMATION))
                row.append(self._format_evidence_info(r, EvidenceType.REVIEW_CHECKLIST))
            if include_audit:
                row.append("; ".join([
                    f"[{log.created_at.isoformat()}] {log.operator}: {log.action_type.value} - {log.reason}"
                    for log in r.audit_logs
                ]))
            writer.writerow(row)

        return output.getvalue().encode('utf-8-sig')

    def _format_evidence_info(self, record: ReviewRecord, ev_type: EvidenceType) -> str:
        ev = record.get_evidence_by_type(ev_type)
        if not ev:
            return "未上传"
        return f"已上传 ({ev.uploaded_by}@{ev.uploaded_at.isoformat()})"

    def _export_to_json(
        self,
        records: List[ReviewRecord],
        include_evidence: bool,
        include_audit: bool
    ) -> bytes:
        data = []
        for r in records:
            item = {
                "id": r.id,
                "customer_id": r.customer_id,
                "customer_name": r.customer_name,
                "questionnaire_id": r.questionnaire_id,
                "questionnaire_version": r.questionnaire_version,
                "source_type": r.source_type.value,
                "source_batch_id": r.source_batch_id,
                "current_status": r.current_status.value,
                "pending_reason": r.pending_reason,
                "assigned_to": r.assigned_to,
                "created_by": r.created_by,
                "created_at": r.created_at.isoformat(),
                "updated_at": r.updated_at.isoformat(),
                "is_duplicate": r.is_duplicate,
                "duplicate_of_id": r.duplicate_of_id,
                "correction_note": r.correction_note,
            }
            if include_evidence:
                item["evidences"] = [
                    {
                        "id": e.id,
                        "type": e.evidence_type.value,
                        "file_name": e.file_name,
                        "file_path": e.file_path,
                        "file_hash": e.file_hash,
                        "uploaded_by": e.uploaded_by,
                        "uploaded_at": e.uploaded_at.isoformat(),
                        "description": e.description
                    }
                    for e in r.evidences
                ]
            if include_audit:
                item["audit_logs"] = [
                    {
                        "id": log.id,
                        "action": log.action_type.value,
                        "operator": log.operator,
                        "old_status": log.old_status.value if log.old_status else None,
                        "new_status": log.new_status.value if log.new_status else None,
                        "reason": log.reason,
                        "created_at": log.created_at.isoformat(),
                        "details": log.details
                    }
                    for log in r.audit_logs
                ]
            data.append(item)
        return json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')

    def get_record_detail(self, record_id: int) -> Optional[Dict[str, Any]]:
        record = get_review_record(record_id, load_related=True)
        if not record:
            return None
        return {
            "record": self._record_to_dict(record),
            "can_transition_to": [
                s.value for s in ReviewStatus
                if record.can_transition_to(s)
            ],
            "pending_reason_explanation": PENDING_REASONS.get(record.current_status, "")
        }

    def _record_to_dict(self, record: ReviewRecord) -> Dict[str, Any]:
        def _convert_enum(v):
            if isinstance(v, Enum):
                return v.value
            if isinstance(v, list):
                return [_convert_enum(item) for item in v]
            if isinstance(v, dict):
                return {k: _convert_enum(val) for k, val in v.items()}
            if isinstance(v, datetime):
                return v.isoformat()
            return v

        result = {}
        for f in fields(record):
            v = getattr(record, f.name)
            if f.name == 'evidences':
                result[f.name] = [self._evidence_to_dict(e) for e in v]
            elif f.name == 'audit_logs':
                result[f.name] = [self._audit_to_dict(a) for a in v]
            else:
                result[f.name] = _convert_enum(v)
        return result

    def _evidence_to_dict(self, evidence: Evidence) -> Dict[str, Any]:
        return {
            'id': evidence.id,
            'review_record_id': evidence.review_record_id,
            'evidence_type': evidence.evidence_type.value,
            'file_path': evidence.file_path,
            'file_name': evidence.file_name,
            'file_hash': evidence.file_hash,
            'uploaded_by': evidence.uploaded_by,
            'uploaded_at': evidence.uploaded_at.isoformat(),
            'description': evidence.description,
            'metadata': evidence.metadata
        }

    def _audit_to_dict(self, audit: AuditLog) -> Dict[str, Any]:
        return {
            'id': audit.id,
            'review_record_id': audit.review_record_id,
            'action_type': audit.action_type.value,
            'operator': audit.operator,
            'old_status': audit.old_status.value if audit.old_status else None,
            'new_status': audit.new_status.value if audit.new_status else None,
            'reason': audit.reason,
            'created_at': audit.created_at.isoformat(),
            'details': audit.details
        }

    def get_statistics(self) -> Dict[str, Any]:
        stats = {}
        for status in ReviewStatus:
            records, _ = query_records({"status": [status]})
            stats[status.value] = len(records)

        total, _ = query_records()
        duplicates, _ = query_records({"is_duplicate": True})

        return {
            "total": len(total),
            "by_status": stats,
            "duplicates": len(duplicates),
            "pending_reason_explanation": {
                k.value: v for k, v in PENDING_REASONS.items()
            }
        }
