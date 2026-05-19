from typing import List, Dict, Any, Optional
from datetime import date
from models import (
    ProcessedRecord, SettlementRecord, QueryFilter,
    RecordStatus, ExceptionType, BatchResult
)
from billing_engine import BillingEngine
import uuid
import pandas as pd


class DataStore:
    def __init__(self, billing_engine: BillingEngine = None):
        self.billing_engine = billing_engine or BillingEngine()
        self._records: Dict[str, ProcessedRecord] = {}
        self._settlements: Dict[str, SettlementRecord] = {}

    def batch_process(self, records: List[Dict[str, Any]]) -> BatchResult:
        success_ids = []
        failed_details = []
        for idx, record_data in enumerate(records):
            try:
                from models import WorkRecord
                record = WorkRecord(**record_data)
                if record.record_no in [r.record_no for r in self._records.values()]:
                    failed_details.append({
                        "index": idx,
                        "record_no": record.record_no,
                        "error": f"记录编号 {record.record_no} 已存在",
                        "exception_type": ExceptionType.DUPLICATE
                    })
                    continue
                processed = self.billing_engine.process_record(record)
                self._records[processed.id] = processed
                success_ids.append(processed.id)
            except Exception as e:
                failed_details.append({
                    "index": idx,
                    "record_no": record_data.get("record_no", f"unknown_{idx}"),
                    "error": str(e),
                    "exception_type": ExceptionType.INVALID_DATA
                })
        return BatchResult(
            total=len(records),
            success_count=len(success_ids),
            failed_count=len(failed_details),
            success_ids=success_ids,
            failed_details=failed_details
        )

    def retry_failed(self, failed_records: List[Dict[str, Any]]) -> BatchResult:
        return self.batch_process(failed_records)

    def query_records(self, query_filter: QueryFilter) -> List[ProcessedRecord]:
        results = list(self._records.values())
        if query_filter.operator:
            results = [r for r in results if r.operator == query_filter.operator]
        if query_filter.start_date:
            results = [r for r in results if r.work_date >= query_filter.start_date]
        if query_filter.end_date:
            results = [r for r in results if r.work_date <= query_filter.end_date]
        if query_filter.status:
            results = [r for r in results if r.status == query_filter.status]
        if query_filter.exception_type:
            results = [r for r in results if r.exception_type == query_filter.exception_type]
        return results

    def get_record_summary(self, records: List[ProcessedRecord]) -> Dict[str, Any]:
        total_count = len(records)
        approved_count = len([r for r in records if r.status == RecordStatus.APPROVED])
        rejected_count = len([r for r in records if r.status == RecordStatus.REJECTED])
        settled_count = len([r for r in records if r.status == RecordStatus.SETTLED])
        total_amount = sum(r.amount for r in records if r.status in [RecordStatus.APPROVED, RecordStatus.SETTLED])
        exception_summary = {}
        for r in records:
            if r.exception_type:
                exception_summary[r.exception_type] = exception_summary.get(r.exception_type, 0) + 1
        return {
            "total_count": total_count,
            "approved_count": approved_count,
            "rejected_count": rejected_count,
            "settled_count": settled_count,
            "total_amount": round(total_amount, 2),
            "exception_summary": exception_summary
        }

    def export_report(self, records: List[ProcessedRecord], filepath: str) -> str:
        data = []
        for r in records:
            data.append({
                "记录编号": r.record_no,
                "拖拉机号": r.tractor_no,
                "机手": r.operator,
                "作业日期": r.work_date.strftime("%Y-%m-%d"),
                "工时": r.work_hours,
                "亩数": r.work_area,
                "油耗": r.fuel_consumption,
                "计费类型": r.billing_type,
                "金额": r.amount,
                "状态": r.status,
                "异常类型": r.exception_type,
                "异常原因": r.exception_reason,
                "是否跨天": r.is_cross_day,
                "处理时间": r.processed_at.strftime("%Y-%m-%d %H:%M:%S")
            })
        df = pd.DataFrame(data)
        df.to_excel(filepath, index=False, sheet_name="作业记录")
        return filepath

    def create_settlement(self, record_ids: List[str], operator: str) -> Dict[str, Any]:
        records = [self._records[rid] for rid in record_ids if rid in self._records]
        valid_records = [r for r in records if r.status == RecordStatus.APPROVED]
        if not valid_records:
            return {
                "success": False,
                "error": "没有可结算的有效记录"
            }
        already_settled = [r for r in records if r.status == RecordStatus.SETTLED]
        if already_settled:
            return {
                "success": False,
                "error": f"包含已结算记录: {[r.record_no for r in already_settled]}"
            }
        total_amount = sum(r.amount for r in valid_records)
        settlement_id = str(uuid.uuid4())
        settlement = SettlementRecord(
            id=settlement_id,
            record_ids=[r.id for r in valid_records],
            operator=operator,
            total_amount=round(total_amount, 2),
            settlement_date=date.today()
        )
        self._settlements[settlement_id] = settlement
        for r in valid_records:
            r.status = RecordStatus.SETTLED
        return {
            "success": True,
            "settlement_id": settlement_id,
            "total_amount": settlement.total_amount,
            "record_count": len(valid_records)
        }

    def get_record(self, record_id: str) -> Optional[ProcessedRecord]:
        return self._records.get(record_id)

    def get_all_records(self) -> List[ProcessedRecord]:
        return list(self._records.values())

    def get_settlements(self) -> List[SettlementRecord]:
        return list(self._settlements.values())
