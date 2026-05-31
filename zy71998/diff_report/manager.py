import os
import hashlib
import zipfile
import tempfile
import shutil
from typing import List, Optional, Dict, Set, Tuple
from datetime import datetime
from pathlib import Path

from .models import (
    DiffRecord,
    ChangeOrder,
    OperationLog,
    ManualConfirm,
    RecordStatus,
    DiffType,
    generate_id,
)
from .storage import DiffReportStorage


class DiffReportManager:
    def __init__(self, data_dir: str = "./data"):
        self.storage = DiffReportStorage(data_dir)
        self._init_source_index()

    def _init_source_index(self):
        self._source_file_index: Dict[str, Set[str]] = {}
        for record in self.storage.load_all_records():
            if record.source not in self._source_file_index:
                self._source_file_index[record.source] = set()
            self._source_file_index[record.source].add(record.file_path)

    def _calc_md5(self, file_path: str) -> str:
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()

    def _check_path_space(self, file_path: str) -> Tuple[bool, str]:
        if " " in file_path:
            return True, "路径包含空格"
        return False, ""

    def _check_duplicate_exec(self, source: str, file_path: str) -> Tuple[bool, str]:
        if source in self._source_file_index and file_path in self._source_file_index[source]:
            return True, "同一来源重复导入该文件"
        return False, ""

    def _check_file_mismatch(self, file_path: str, expected_md5: Optional[str]) -> Tuple[bool, str]:
        if expected_md5 and os.path.exists(file_path):
            actual_md5 = self._calc_md5(file_path)
            if actual_md5 != expected_md5:
                return True, f"文件MD5不匹配: 期望={expected_md5[:8]}, 实际={actual_md5[:8]}"
        return False, ""

    def _log_operation(
        self,
        record_id: str,
        action: str,
        operator: str,
        old_status: Optional[str] = None,
        new_status: Optional[str] = None,
        remark: str = "",
    ):
        log = OperationLog(
            log_id=generate_id("log_"),
            record_id=record_id,
            action=action,
            operator=operator,
            old_status=old_status,
            new_status=new_status,
            remark=remark,
        )
        self.storage.save_log(log)

    def register_change_order(
        self, order_id: str, title: str, applicant: str, description: str = "", source: str = ""
    ) -> ChangeOrder:
        order = ChangeOrder(
            order_id=order_id,
            title=title,
            applicant=applicant,
            apply_time=datetime.now().isoformat(),
            description=description,
            source=source,
        )
        self.storage.save_order(order)
        return order

    def import_diff_from_zip(
        self,
        zip_path: str,
        source: str,
        change_order_id: str,
        operator: str,
        base_dir: Optional[str] = None,
    ) -> List[DiffRecord]:
        if not os.path.exists(zip_path):
            raise FileNotFoundError(f"压缩包不存在: {zip_path}")

        temp_dir = tempfile.mkdtemp(prefix="diff_report_")
        records = []

        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(temp_dir)

            scan_root = temp_dir
            if base_dir:
                scan_root = os.path.join(temp_dir, base_dir)

            for root, _, files in os.walk(scan_root):
                for filename in files:
                    file_path = os.path.join(root, filename)
                    rel_path = os.path.relpath(file_path, scan_root)

                    pending_reasons = []
                    has_path_space, reason = self._check_path_space(rel_path)
                    if has_path_space:
                        pending_reasons.append(reason)

                    duplicate_exec, reason = self._check_duplicate_exec(source, rel_path)
                    if duplicate_exec:
                        pending_reasons.append(reason)

                    md5_val = self._calc_md5(file_path)
                    status = RecordStatus.NORMAL
                    if pending_reasons:
                        status = RecordStatus.PENDING

                    record = DiffRecord(
                        record_id=generate_id("rec_"),
                        file_path=rel_path,
                        diff_type=DiffType.MODIFIED,
                        status=status,
                        source=source,
                        change_order_id=change_order_id,
                        md5_after=md5_val,
                        operator=operator,
                        pending_reason="; ".join(pending_reasons),
                        has_path_space=has_path_space,
                        duplicate_exec=duplicate_exec,
                    )

                    self.storage.save_record(record)
                    self._log_operation(
                        record.record_id, "导入", operator, new_status=status.value, remark=f"来源: {source}"
                    )

                    if source not in self._source_file_index:
                        self._source_file_index[source] = set()
                    self._source_file_index[source].add(rel_path)

                    records.append(record)

        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

        return records

    def add_manual_record(
        self,
        file_path: str,
        diff_type: DiffType,
        source: str,
        change_order_id: str,
        operator: str,
        md5_before: Optional[str] = None,
        md5_after: Optional[str] = None,
        remark: str = "",
        actual_file_path: Optional[str] = None,
    ) -> DiffRecord:
        pending_reasons = []

        has_path_space, reason = self._check_path_space(file_path)
        if has_path_space:
            pending_reasons.append(reason)

        duplicate_exec, reason = self._check_duplicate_exec(source, file_path)
        if duplicate_exec:
            pending_reasons.append(reason)

        file_mismatch = False
        if actual_file_path and md5_after:
            file_mismatch, reason = self._check_file_mismatch(actual_file_path, md5_after)
            if file_mismatch:
                pending_reasons.append(reason)

        status = RecordStatus.NORMAL
        if pending_reasons:
            status = RecordStatus.PENDING

        record = DiffRecord(
            record_id=generate_id("rec_"),
            file_path=file_path,
            diff_type=diff_type,
            status=status,
            source=source,
            change_order_id=change_order_id,
            md5_before=md5_before,
            md5_after=md5_after,
            operator=operator,
            remark=remark,
            pending_reason="; ".join(pending_reasons),
            has_path_space=has_path_space,
            duplicate_exec=duplicate_exec,
            file_mismatch=file_mismatch,
        )

        self.storage.save_record(record)
        self._log_operation(
            record.record_id, "人工录入", operator, new_status=status.value, remark=remark
        )

        if source not in self._source_file_index:
            self._source_file_index[source] = set()
        self._source_file_index[source].add(file_path)

        return record

    def withdraw_record(self, record_id: str, operator: str, reason: str) -> bool:
        record = self.storage.load_record(record_id)
        if not record:
            return False

        old_status = record.status.value
        record.status = RecordStatus.WITHDRAWN
        record.pending_reason = f"撤回: {reason}"

        self.storage.save_record(record)
        self._log_operation(
            record_id, "撤回", operator, old_status=old_status, new_status=RecordStatus.WITHDRAWN.value, remark=reason
        )
        return True

    def confirm_record(
        self, record_id: str, confirmer: str, confirm_result: str, remark: str = ""
    ) -> bool:
        record = self.storage.load_record(record_id)
        if not record:
            return False

        old_status = record.status.value

        confirm = ManualConfirm(
            confirm_id=generate_id("cfm_"),
            record_id=record_id,
            confirmer=confirmer,
            confirm_result=confirm_result,
            remark=remark,
        )
        self.storage.save_confirm(confirm)

        if confirm_result == "正常":
            new_status = RecordStatus.NORMAL
            record.pending_reason = ""
        elif confirm_result == "异常":
            new_status = RecordStatus.ABNORMAL
        else:
            new_status = RecordStatus.PENDING

        record.status = new_status
        self.storage.save_record(record)

        self._log_operation(
            record_id, "人工确认", confirmer, old_status=old_status, new_status=new_status.value, remark=remark
        )
        return True

    def rollback_record(self, record_id: str, operator: str, reason: str) -> bool:
        record = self.storage.load_record(record_id)
        if not record:
            return False

        old_status = record.status.value
        record.status = RecordStatus.ROLLBACK

        self.storage.save_record(record)
        self._log_operation(
            record_id, "回滚", operator, old_status=old_status, new_status=RecordStatus.ROLLBACK.value, remark=reason
        )
        return True

    def update_record_remark(self, record_id: str, operator: str, remark: str) -> bool:
        record = self.storage.load_record(record_id)
        if not record:
            return False

        old_remark = record.remark
        record.remark = remark

        self.storage.save_record(record)
        self._log_operation(
            record_id, "更新备注", operator, remark=f"原备注: {old_remark} -> 新备注: {remark}"
        )
        return True

    def query_records(
        self,
        status: Optional[RecordStatus] = None,
        source: Optional[str] = None,
        change_order_id: Optional[str] = None,
        operator: Optional[str] = None,
    ) -> List[DiffRecord]:
        records = self.storage.load_all_records()

        if status:
            records = [r for r in records if r.status == status]
        if source:
            records = [r for r in records if r.source == source]
        if change_order_id:
            records = [r for r in records if r.change_order_id == change_order_id]
        if operator:
            records = [r for r in records if r.operator == operator]

        return records

    def get_record_detail(self, record_id: str) -> Optional[Dict]:
        record = self.storage.load_record(record_id)
        if not record:
            return None

        order = self.storage.load_order(record.change_order_id)
        logs = self.storage.load_logs_for_record(record_id)
        confirms = self.storage.load_confirms_for_record(record_id)

        return {
            "record": record,
            "change_order": order,
            "operation_logs": logs,
            "manual_confirms": confirms,
        }

    def get_record_history(self, record_id: str) -> List[Dict]:
        logs = self.storage.load_logs_for_record(record_id)
        confirms = self.storage.load_confirms_for_record(record_id)

        history = []
        for log in logs:
            history.append(
                {
                    "time": log.timestamp,
                    "type": "操作",
                    "operator": log.operator,
                    "action": log.action,
                    "detail": log.remark,
                }
            )

        for confirm in confirms:
            history.append(
                {
                    "time": confirm.timestamp,
                    "type": "确认",
                    "operator": confirm.confirmer,
                    "action": confirm.confirm_result,
                    "detail": confirm.remark,
                }
            )

        return sorted(history, key=lambda x: x["time"])
