import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Iterator
from .models import (
    ScoringDifferenceRecord,
    AuditLog,
    ProcessingStatus,
)


class ResultStore:
    """
    统一结果存储层 - 确保导出、页面展示、API 返回读取同一份数据

    设计原则：
    1. 单一数据源：所有读写操作都通过此类进行
    2. 原子写入：使用临时文件+重命名确保写入一致性
    3. 不可变审计：审计日志只追加，不修改
    4. 版本追踪：保留阈值变更前后的完整记录
    """

    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.records_file = self.data_dir / "scoring_records.json"
        self.audit_file = self.data_dir / "audit_logs.json"
        self._ensure_directories()

    def _ensure_directories(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        if not self.records_file.exists():
            self._write_json(self.records_file, [])
        if not self.audit_file.exists():
            self._write_json(self.audit_file, [])

    def _read_json(self, path: Path) -> List[Dict[str, Any]]:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _write_json(self, path: Path, data: List[Dict[str, Any]]) -> None:
        temp_path = path.with_suffix(".tmp")
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(temp_path, path)

    def save_record(self, record: ScoringDifferenceRecord) -> None:
        records = self._read_json(self.records_file)
        record_dict = record.to_dict()
        found = False
        for i, r in enumerate(records):
            if r["record_id"] == record.record_id:
                records[i] = record_dict
                found = True
                break
        if not found:
            records.append(record_dict)
        self._write_json(self.records_file, records)

    def get_record(self, record_id: str) -> Optional[ScoringDifferenceRecord]:
        records = self._read_json(self.records_file)
        for r in records:
            if r["record_id"] == record_id:
                return ScoringDifferenceRecord.from_dict(r)
        return None

    def get_record_by_snapshot(self, snapshot_id: str) -> Optional[ScoringDifferenceRecord]:
        records = self._read_json(self.records_file)
        for r in records:
            if r["snapshot_id"] == snapshot_id:
                return ScoringDifferenceRecord.from_dict(r)
        return None

    def list_records(
        self, status: Optional[ProcessingStatus] = None
    ) -> List[ScoringDifferenceRecord]:
        records = self._read_json(self.records_file)
        result = []
        for r in records:
            if status and r["current_status"] != status.value:
                continue
            result.append(ScoringDifferenceRecord.from_dict(r))
        return result

    def add_audit_log(self, audit: AuditLog) -> None:
        audits = self._read_json(self.audit_file)
        audits.append(audit.to_dict())
        self._write_json(self.audit_file, audits)

    def get_audit_logs(self, record_id: Optional[str] = None) -> List[AuditLog]:
        audits = self._read_json(self.audit_file)
        result = []
        for a in audits:
            if record_id and a["record_id"] != record_id:
                continue
            result.append(AuditLog.from_dict(a))
        return result

    def export_records(
        self,
        output_path: str,
        status: Optional[ProcessingStatus] = None,
        include_threshold_changes: bool = True,
        include_manual_changes: bool = True,
    ) -> str:
        records = self.list_records(status)
        export_data = []
        for r in records:
            row = {
                "record_id": r.record_id,
                "snapshot_id": r.snapshot_id,
                "original_line_number": (
                    r.feature_snapshot.original_line_number
                    if r.feature_snapshot
                    else None
                ),
                "main_flow": (
                    r.feature_snapshot.main_flow if r.feature_snapshot else None
                ),
                "online_score": r.online_score,
                "offline_score": r.offline_score,
                "difference": r.difference,
                "percent_diff": r.percent_diff,
                "current_status": r.current_status.value,
                "has_threshold_mismatch": r.has_threshold_mismatch(),
                "created_at": r.created_at.isoformat(),
                "updated_at": r.updated_at.isoformat(),
                "data_scientist_notes": r.data_scientist_notes,
            }
            if include_threshold_changes:
                row["threshold_changes"] = [
                    tc.to_dict() for tc in r.threshold_changes
                ]
            if include_manual_changes:
                row["manual_changes"] = [mc.to_dict() for mc in r.manual_changes]
            export_data.append(row)

        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        with open(output, "w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)

        return str(output)

    def get_summary(self) -> Dict[str, Any]:
        records = self.list_records()
        status_counts: Dict[str, int] = {}
        threshold_mismatch_count = 0
        for r in records:
            s = r.current_status.value
            status_counts[s] = status_counts.get(s, 0) + 1
            if r.has_threshold_mismatch():
                threshold_mismatch_count += 1

        return {
            "total_records": len(records),
            "status_counts": status_counts,
            "threshold_mismatch_count": threshold_mismatch_count,
            "pending_review": sum(
                1
                for r in records
                if r.current_status
                in {
                    ProcessingStatus.PENDING,
                    ProcessingStatus.NEEDS_REVIEW,
                    ProcessingStatus.THRESHOLD_MISMATCH,
                }
            ),
        }

    def iterate_records_for_api(self) -> Iterator[Dict[str, Any]]:
        for r in self.list_records():
            d = r.to_dict()
            if r.feature_snapshot:
                d["original_line_number"] = r.feature_snapshot.original_line_number
                d["main_flow"] = r.feature_snapshot.main_flow
            yield d
