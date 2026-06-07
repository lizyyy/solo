import json
import csv
from datetime import datetime
from typing import List, Optional, Dict, Any
from collections import defaultdict

from .models import (
    CollateralRecord, ImportBatch, ReviewHistory,
    RecordStatus, SkipReason, ReviewResult
)
from .database import Database


class ReviewService:
    def __init__(self, db: Database):
        self.db = db

    def review_record(
        self,
        record_id: int,
        review_result: str,
        review_comment: str = None,
        reviewer: str = None,
        is_manual_override: bool = False
    ) -> bool:
        record = self.db.get_record(record_id)
        if not record:
            return False

        old_status = record.status
        old_review_result = record.review_result
        old_review_comment = record.review_comment

        updates = {
            "review_result": review_result,
            "review_comment": review_comment,
            "reviewer": reviewer,
            "review_time": datetime.now().isoformat(),
        }

        if is_manual_override and record.status == RecordStatus.SKIPPED.value:
            updates["status"] = RecordStatus.MANUAL_FIXED.value
            updates["is_manual_overridden"] = True
            updates["previous_review_comment"] = record.review_comment or record.skip_detail

        success = self.db.update_record(record_id, updates)
        if success:
            history = ReviewHistory(
                record_id=record_id,
                batch_id=record.batch_id,
                old_status=old_status,
                new_status=updates.get("status", old_status),
                old_review_result=old_review_result,
                new_review_result=review_result,
                old_review_comment=old_review_comment,
                new_review_comment=review_comment,
                operator=reviewer,
                operation_type="manual_review" if is_manual_override else "review",
                remark="人工改判，覆盖原有理由" if is_manual_override else None
            )
            self.db.add_review_history(history)

        return success

    def fix_skipped_record(
        self,
        record_id: int,
        field_updates: Dict[str, Any],
        operator: str = None
    ) -> bool:
        record = self.db.get_record(record_id)
        if not record:
            return False

        old_status = record.status
        updates = {}
        for key, value in field_updates.items():
            if hasattr(record, key):
                updates[key] = value

        updates["status"] = RecordStatus.NORMAL.value
        updates["skip_reason"] = None
        updates["skip_detail"] = None

        success = self.db.update_record(record_id, updates)
        if success:
            history = ReviewHistory(
                record_id=record_id,
                batch_id=record.batch_id,
                old_status=old_status,
                new_status=RecordStatus.NORMAL.value,
                operator=operator,
                operation_type="fix_data",
                remark=f"修正字段: {', '.join(field_updates.keys())}"
            )
            self.db.add_review_history(history)

        return success

    def get_multi_account_groups(self, batch_id: Optional[str] = None) -> Dict[str, List[CollateralRecord]]:
        records = self.db.get_multi_account_clients(batch_id)
        groups = defaultdict(list)
        for r in records:
            groups[r.client_id].append(r)
        return dict(groups)

    def get_cross_settlement_refunds(self, batch_id: Optional[str] = None) -> List[CollateralRecord]:
        return self.db.get_cross_settlement_refunds(batch_id)

    def get_manual_overridden_records(self, batch_id: Optional[str] = None) -> List[CollateralRecord]:
        return self.db.get_manual_overridden_records(batch_id)

    def get_need_review_records(self, batch_id: Optional[str] = None) -> List[CollateralRecord]:
        reasons = [
            SkipReason.CALIBER_MISMATCH.value,
            SkipReason.MULTI_ACCOUNT.value,
            SkipReason.CROSS_SETTLEMENT_REFUND.value
        ]
        records = []
        for reason in reasons:
            records.extend(self.db.get_records_by_skip_reason(reason, batch_id))
        return records

    def get_batch_statistics(self, batch_id: str) -> Dict[str, Any]:
        batch = self.db.get_batch(batch_id)
        if not batch:
            return {}

        records = self.db.get_records_by_batch(batch_id)

        reason_counts = defaultdict(int)
        for r in records:
            if r.skip_reason:
                for reason in r.skip_reason.split(","):
                    reason_counts[reason] += 1

        result_counts = defaultdict(int)
        for r in records:
            if r.review_result:
                result_counts[r.review_result] += 1

        return {
            "batch_id": batch.batch_id,
            "file_name": batch.file_name,
            "total_count": batch.total_count,
            "processed_count": batch.processed_count,
            "normal_count": batch.normal_count,
            "skipped_count": batch.skipped_count,
            "need_review_count": batch.need_review_count,
            "manual_fixed_count": sum(1 for r in records if r.status == RecordStatus.MANUAL_FIXED.value),
            "skip_reason_breakdown": dict(reason_counts),
            "review_result_breakdown": dict(result_counts),
            "created_at": batch.created_at,
            "import_user": batch.import_user,
        }

    def get_all_batches(self) -> List[ImportBatch]:
        return self.db.get_all_batches()

    def get_record_detail(self, record_id: int) -> Optional[Dict[str, Any]]:
        record = self.db.get_record(record_id)
        if not record:
            return None
        history = self.db.get_review_history(record_id=record_id)
        return {
            "record": record,
            "history": history
        }

    def export_records(
        self,
        output_path: str,
        batch_id: Optional[str] = None,
        status: Optional[str] = None,
        skip_reason: Optional[str] = None,
        format: str = "csv"
    ) -> int:
        if batch_id:
            records = self.db.get_records_by_batch(batch_id)
        elif status:
            records = self.db.get_records_by_status(status)
        elif skip_reason:
            records = self.db.get_records_by_skip_reason(skip_reason)
        else:
            records = []
            for batch in self.db.get_all_batches():
                records.extend(self.db.get_records_by_batch(batch.batch_id))

        if not records:
            return 0

        fieldnames = [
            "id", "batch_id", "client_id", "client_name", "account_id",
            "collateral_code", "collateral_name", "collateral_type",
            "quantity", "market_value", "collateral_ratio", "available_collateral",
            "trade_date", "settlement_date", "is_refund", "source_system",
            "status", "skip_reason", "skip_detail",
            "review_result", "review_comment", "reviewer", "review_time",
            "is_manual_overridden", "previous_review_comment",
            "created_at", "updated_at"
        ]

        if format == "csv":
            with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for r in records:
                    row = {k: getattr(r, k) for k in fieldnames}
                    writer.writerow(row)
        elif format == "json":
            data = []
            for r in records:
                row = {k: getattr(r, k) for k in fieldnames}
                data.append(row)
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        else:
            raise ValueError(f"不支持的导出格式: {format}")

        return len(records)

    def export_need_review(self, batch_id: str, output_path: str, format: str = "csv") -> int:
        records = self.get_need_review_records(batch_id)
        if not records:
            return 0

        fieldnames = [
            "id", "client_id", "client_name", "account_id",
            "collateral_code", "collateral_name",
            "skip_reason", "skip_detail",
            "market_value", "available_collateral",
            "trade_date", "settlement_date", "is_refund"
        ]

        if format == "csv":
            with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for r in records:
                    row = {k: getattr(r, k) for k in fieldnames}
                    writer.writerow(row)
        elif format == "json":
            data = []
            for r in records:
                row = {k: getattr(r, k) for k in fieldnames}
                data.append(row)
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        else:
            raise ValueError(f"不支持的导出格式: {format}")

        return len(records)
