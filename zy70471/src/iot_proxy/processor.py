import json
import hashlib
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Tuple, Optional
import pytz
from dateutil import parser

from .models import IoTReceipt, ProcessResult, RecordStatus, ReceiptType, ChangeLog


class ReceiptProcessor:
    def __init__(self, base_dir: str = "."):
        self.base_dir = Path(base_dir)
        self.cache_dir = self.base_dir / "output" / "cache"
        self.failures_dir = self.base_dir / "failures"
        self.history_dir = self.base_dir / "history"
        self.output_dir = self.base_dir / "output"
        
        for dir_path in [self.cache_dir, self.failures_dir, self.history_dir, self.output_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)

    def _generate_batch_id(self, receipts_data: List[dict]) -> str:
        data_str = json.dumps(receipts_data, sort_keys=True)
        return hashlib.sha256(data_str.encode()).hexdigest()[:16]

    def _get_cache_path(self, batch_id: str) -> Path:
        return self.cache_dir / f"{batch_id}.json"

    def _check_cache(self, batch_id: str) -> Optional[ProcessResult]:
        cache_path = self._get_cache_path(batch_id)
        if cache_path.exists():
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                data["is_cached"] = True
                return ProcessResult(**data)
        return None

    def _save_cache(self, result: ProcessResult) -> None:
        cache_path = self._get_cache_path(result.batch_id)
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(result.model_dump(mode="json"), f, ensure_ascii=False, indent=2)

    def _parse_timestamp(self, timestamp_str: str) -> Tuple[Optional[datetime], Optional[int], Optional[str]]:
        try:
            parsed = parser.parse(timestamp_str)
            
            if parsed.tzinfo is None:
                error_msg = "时间戳缺少时区信息"
                return None, None, error_msg
            
            utc_offset = parsed.utcoffset()
            if utc_offset is None:
                error_msg = "无法获取时区偏移"
                return None, None, error_msg
            
            offset_minutes = int(utc_offset.total_seconds() / 60)
            
            local_tz = pytz.timezone("Asia/Shanghai")
            local_offset = int(local_tz.utcoffset(datetime.now()).total_seconds() / 60)
            
            if abs(offset_minutes - local_offset) > 60:
                return parsed, offset_minutes, f"时区偏移异常: 预期{local_offset}分钟，实际{offset_minutes}分钟"
            
            return parsed, offset_minutes, None
        except Exception as e:
            return None, None, f"时间戳解析失败: {str(e)}"

    def _parse_single_receipt(self, receipt_data: dict) -> IoTReceipt:
        try:
            receipt = IoTReceipt(**receipt_data)
            
            parsed_time, tz_offset, error = self._parse_timestamp(receipt.timestamp)
            receipt.parsed_time = parsed_time
            receipt.timezone_offset = tz_offset
            
            if error:
                receipt.status = RecordStatus.ABNORMAL if "时区偏移异常" in error else RecordStatus.FAILED
                receipt.error_message = error
            else:
                receipt.status = RecordStatus.NORMAL
            
            return receipt
        except Exception as e:
            return IoTReceipt(
                device_id=receipt_data.get("device_id", "unknown"),
                receipt_id=receipt_data.get("receipt_id", "unknown"),
                receipt_type=ReceiptType.POWER,
                timestamp=receipt_data.get("timestamp", ""),
                status=RecordStatus.FAILED,
                error_message=f"回执解析失败: {str(e)}"
            )

    def process_receipts(self, receipts_data: List[dict]) -> ProcessResult:
        batch_id = self._generate_batch_id(receipts_data)
        
        cached_result = self._check_cache(batch_id)
        if cached_result:
            return cached_result
        
        receipts = []
        for data in receipts_data:
            receipt = self._parse_single_receipt(data)
            receipts.append(receipt)
        
        normal_count = sum(1 for r in receipts if r.status == RecordStatus.NORMAL)
        abnormal_count = sum(1 for r in receipts if r.status == RecordStatus.ABNORMAL)
        failed_count = sum(1 for r in receipts if r.status == RecordStatus.FAILED)
        
        result = ProcessResult(
            batch_id=batch_id,
            total_count=len(receipts),
            normal_count=normal_count,
            abnormal_count=abnormal_count,
            failed_count=failed_count,
            receipts=receipts,
            is_cached=False
        )
        
        self._save_cache(result)
        
        if failed_count > 0:
            self._save_failures(batch_id, receipts)
        
        return result

    def _save_failures(self, batch_id: str, receipts: List[IoTReceipt]) -> None:
        failures = [r for r in receipts if r.status in [RecordStatus.FAILED, RecordStatus.ABNORMAL]]
        if failures:
            failure_path = self.failures_dir / f"{batch_id}_failures.json"
            with open(failure_path, "w", encoding="utf-8") as f:
                json.dump(
                    [r.model_dump(mode="json") for r in failures],
                    f, ensure_ascii=False, indent=2
                )

    def add_change_log(self, resource_scope: str, change_reason: str, changed_by: str = "system", extra: dict = None) -> ChangeLog:
        change_id = hashlib.sha256(f"{resource_scope}:{change_reason}:{datetime.now()}".encode()).hexdigest()[:12]
        change_log = ChangeLog(
            change_id=change_id,
            resource_scope=resource_scope,
            change_reason=change_reason,
            changed_by=changed_by,
            extra=extra or {}
        )
        
        history_path = self.history_dir / f"changes_{datetime.now().strftime('%Y%m')}.jsonl"
        with open(history_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(change_log.model_dump(mode="json"), ensure_ascii=False) + "\n")
        
        return change_log

    def get_change_logs(self, resource_scope: Optional[str] = None) -> List[ChangeLog]:
        logs = []
        for history_file in sorted(self.history_dir.glob("changes_*.jsonl")):
            with open(history_file, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        log = ChangeLog(**json.loads(line.strip()))
                        if resource_scope is None or log.resource_scope == resource_scope:
                            logs.append(log)
        return logs
