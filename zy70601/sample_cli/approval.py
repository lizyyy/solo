from datetime import datetime
from typing import List, Optional, Dict
from pathlib import Path
import json

from .models import SampleRecord, ApprovalStatus, RejectionReason


class ApprovalManager:
    def __init__(self, approval_store_path: Optional[str] = None):
        self.approval_store_path = approval_store_path
        self.approval_cache: Dict[str, Dict] = {}
        if approval_store_path:
            self._load_approvals()

    def _load_approvals(self):
        if not self.approval_store_path:
            return

        path = Path(self.approval_store_path)
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for key, value in data.items():
                        self.approval_cache[key] = value
            except Exception:
                pass

    def _save_approvals(self):
        if not self.approval_store_path:
            return

        path = Path(self.approval_store_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.approval_cache, f, ensure_ascii=False, indent=2)

    def _get_record_key(self, record: SampleRecord) -> str:
        return f"{record.source_file}:{record.source_row}:{record.barcode}"

    def approve_record(
        self,
        record: SampleRecord,
        approver: str,
        approval_note: Optional[str] = None,
        override_rejection: bool = False
    ) -> SampleRecord:
        record.approval_status = ApprovalStatus.APPROVED
        record.approval_time = datetime.now()
        record.approver = approver

        if override_rejection:
            record.is_rejected = False
            record.warnings.append("审批通过，已解除拒收状态")
        else:
            record.warnings.append("审批通过，确认拒收")

        self.approval_cache[self._get_record_key(record)] = {
            "status": ApprovalStatus.APPROVED,
            "approver": approver,
            "approval_time": record.approval_time.isoformat(),
            "approval_note": approval_note,
            "override_rejection": override_rejection
        }
        self._save_approvals()

        return record

    def reject_approval(
        self,
        record: SampleRecord,
        approver: str,
        rejection_note: Optional[str] = None
    ) -> SampleRecord:
        record.approval_status = ApprovalStatus.REJECTED
        record.approval_time = datetime.now()
        record.approver = approver
        record.warnings.append("审批拒绝，需重新核查")

        self.approval_cache[self._get_record_key(record)] = {
            "status": ApprovalStatus.REJECTED,
            "approver": approver,
            "approval_time": record.approval_time.isoformat(),
            "rejection_note": rejection_note
        }
        self._save_approvals()

        return record

    def supplement_record(
        self,
        record: SampleRecord,
        sampling_time: Optional[datetime] = None,
        transporter: Optional[str] = None,
        transport_batch: Optional[str] = None,
        rejection_reason: Optional[RejectionReason] = None,
        rejection_note: Optional[str] = None
    ) -> SampleRecord:
        if sampling_time is not None:
            record.sampling_time = sampling_time
            record.warnings.append("已补录采样时间")

        if transporter is not None:
            record.transporter = transporter
            record.warnings.append("已补录运输人")

        if transport_batch is not None:
            record.transport_batch = transport_batch
            record.warnings.append("已补录运输批次")

        if rejection_reason is not None:
            record.rejection_reason = rejection_reason
            record.is_rejected = True
            record.warnings.append("已补录拒收原因")

        if rejection_note is not None:
            record.rejection_note = rejection_note

        return record

    def batch_approve(
        self,
        records: List[SampleRecord],
        approver: str,
        override_rejection: bool = False
    ) -> List[SampleRecord]:
        for record in records:
            if record.approval_status == ApprovalStatus.PENDING:
                self.approve_record(record, approver, None, override_rejection)
        return records

    def restore_approvals(self, records: List[SampleRecord]) -> List[SampleRecord]:
        for record in records:
            key = self._get_record_key(record)
            if key in self.approval_cache:
                cached = self.approval_cache[key]
                record.approval_status = cached.get("status", ApprovalStatus.PENDING)
                record.approver = cached.get("approver")
                approval_time = cached.get("approval_time")
                if approval_time:
                    record.approval_time = datetime.fromisoformat(approval_time)

        return records

    def get_approval_history(self, record: SampleRecord) -> Optional[Dict]:
        key = self._get_record_key(record)
        return self.approval_cache.get(key)

    def mark_for_reapproval(self, record: SampleRecord) -> SampleRecord:
        record.approval_status = ApprovalStatus.PENDING
        record.approval_time = None
        record.approver = None
        record.warnings.append("已重置审批状态，需重新审批")

        key = self._get_record_key(record)
        if key in self.approval_cache:
            del self.approval_cache[key]
            self._save_approvals()

        return record
