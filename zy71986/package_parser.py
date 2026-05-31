import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from models import (
    ApprovalRecord, Attachment, ManualCorrection,
    PermissionTable, RollbackPackage, RecordStatus, Issue, IssueType
)


class PackageParser:
    def __init__(self):
        self.duplicate_detector = set()
        self.approval_id_to_records: Dict[str, List[ApprovalRecord]] = {}

    def parse_package(self, raw_data: Dict[str, Any], source_desc: str = "") -> RollbackPackage:
        package_id = raw_data.get("package_id", f"PKG-{datetime.now().strftime('%Y%m%d%H%M%S')}")
        received_time = self._parse_datetime(raw_data.get("received_time")) or datetime.now()

        permission_table = None
        if "permission_table" in raw_data:
            permission_table = self._parse_permission_table(raw_data["permission_table"])

        records: List[ApprovalRecord] = []
        for raw_record in raw_data.get("records", []):
            record = self._parse_single_record(raw_record)
            records.append(record)

            if record.approval_id not in self.approval_id_to_records:
                self.approval_id_to_records[record.approval_id] = []
            self.approval_id_to_records[record.approval_id].append(record)

        self._mark_duplicates(records)
        self._mark_late_attachments(records)

        return RollbackPackage(
            package_id=package_id,
            received_time=received_time,
            records=records,
            permission_table=permission_table,
            source_description=source_desc
        )

    def _parse_single_record(self, raw: Dict[str, Any]) -> ApprovalRecord:
        record_id = raw.get("record_id", "")
        approval_id = raw.get("approval_id", "")

        dup_key = f"{approval_id}|{record_id}"
        is_duplicate = dup_key in self.duplicate_detector
        self.duplicate_detector.add(dup_key)

        attachments = [
            self._parse_attachment(att, approval_id)
            for att in raw.get("attachments", [])
        ]

        manual_corrections = [
            self._parse_manual_correction(corr)
            for corr in raw.get("manual_corrections", [])
        ]

        record = ApprovalRecord(
            record_id=record_id,
            approval_id=approval_id,
            applicant=raw.get("applicant", ""),
            approver=raw.get("approver", ""),
            approval_time=self._parse_datetime(raw.get("approval_time")) or datetime.now(),
            status=raw.get("status", ""),
            content=raw.get("content", ""),
            idempotent_key=raw.get("idempotent_key"),
            client_version=raw.get("client_version"),
            attachments=attachments,
            audit_log_ids=raw.get("audit_log_ids", []),
            manual_corrections=manual_corrections,
            permission_table_version=raw.get("permission_table_version"),
            raw_data=raw
        )

        if is_duplicate:
            record.record_status = RecordStatus.DUPLICATE
            record.issues.append(Issue(
                issue_type=IssueType.DUPLICATE_RECORD,
                human_message=f"这条记录和之前处理过的 {record_id} 重复了",
                suggestion="已自动跳过，无需额外处理",
                affected_fields=["record_id"]
            ))

        if manual_corrections:
            record.record_status = RecordStatus.MANUAL_CORRECTION

        return record

    def _parse_attachment(self, raw: Dict[str, Any], approval_id: str) -> Attachment:
        return Attachment(
            attachment_id=raw.get("attachment_id", ""),
            name=raw.get("name", ""),
            upload_time=self._parse_datetime(raw.get("upload_time")) or datetime.now(),
            approval_id=approval_id,
            content_hash=raw.get("content_hash", "")
        )

    def _parse_manual_correction(self, raw: Dict[str, Any]) -> ManualCorrection:
        return ManualCorrection(
            correction_id=raw.get("correction_id", ""),
            field_name=raw.get("field_name", ""),
            old_value=raw.get("old_value", ""),
            new_value=raw.get("new_value", ""),
            operator=raw.get("operator", ""),
            correction_time=self._parse_datetime(raw.get("correction_time")) or datetime.now(),
            reason=raw.get("reason", "")
        )

    def _parse_permission_table(self, raw: Dict[str, Any]) -> PermissionTable:
        return PermissionTable(
            version=raw.get("version", ""),
            effective_date=self._parse_datetime(raw.get("effective_date")) or datetime.now(),
            entries=raw.get("entries", {}),
            source_file=raw.get("source_file", "")
        )

    def _parse_datetime(self, value: Any) -> Optional[datetime]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            for fmt in [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M",
                "%Y-%m-%d",
                "%Y/%m/%d %H:%M:%S",
                "%Y/%m/%d"
            ]:
                try:
                    return datetime.strptime(value, fmt)
                except ValueError:
                    continue
        return None

    def _mark_duplicates(self, records: List[ApprovalRecord]) -> None:
        approval_groups: Dict[str, List[ApprovalRecord]] = {}
        for record in records:
            if record.approval_id not in approval_groups:
                approval_groups[record.approval_id] = []
            approval_groups[record.approval_id].append(record)

        for approval_id, group in approval_groups.items():
            if len(group) > 1:
                for i, record in enumerate(group):
                    if i > 0 and record.record_status != RecordStatus.DUPLICATE:
                        record.record_status = RecordStatus.DUPLICATE
                        record.issues.append(Issue(
                            issue_type=IssueType.DUPLICATE_RECORD,
                            human_message=f"审批单 {approval_id} 在数据包里出现了多次",
                            suggestion=f"已保留最早的一条，这条将被跳过。如确有不同内容，请人工核对后单独处理",
                            affected_fields=["approval_id"]
                        ))

    def _mark_late_attachments(self, records: List[ApprovalRecord]) -> None:
        for record in records:
            approval_time = record.approval_time
            for attachment in record.attachments:
                if attachment.upload_time > approval_time:
                    attachment.is_late = True
                    if record.record_status == RecordStatus.NORMAL:
                        record.record_status = RecordStatus.LATE_ATTACHMENT
                    record.issues.append(Issue(
                        issue_type=IssueType.LATE_ATTACHMENT_WARNING,
                        human_message=f"附件「{attachment.name}」上传时间比审批时间晚了 "
                                     f"{(attachment.upload_time - approval_time).total_seconds() / 3600:.1f} 小时",
                        suggestion="附件可能是审批后补传的，回滚时请注意核对附件内容是否需要一起撤销",
                        affected_fields=["attachments"]
                    ))
