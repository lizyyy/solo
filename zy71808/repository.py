from datetime import datetime
from typing import Dict, List, Optional
from collections import defaultdict

from models import (
    AssetPool, CreditLine, FreezeRecord, ReviewReport,
    OperationLog, GapCalculationResult, PendingConfirmation
)


class DataRepository:
    def __init__(self) -> None:
        self._asset_pools: Dict[str, AssetPool] = {}
        self._credit_lines: Dict[str, CreditLine] = {}
        self._freeze_records: Dict[str, FreezeRecord] = {}
        self._review_reports: Dict[str, ReviewReport] = {}
        self._operation_logs: List[OperationLog] = []
        self._gap_results: Dict[str, GapCalculationResult] = {}
        self._pending_confirmations: Dict[str, PendingConfirmation] = {}
        self._report_versions: Dict[str, List[ReviewReport]] = defaultdict(list)
        self._pool_results: Dict[str, List[GapCalculationResult]] = defaultdict(list)

    def save_asset_pool(self, pool: AssetPool) -> None:
        self._asset_pools[pool.pool_id] = pool

    def get_asset_pool(self, pool_id: str) -> Optional[AssetPool]:
        return self._asset_pools.get(pool_id)

    def save_credit_line(self, credit: CreditLine) -> None:
        self._credit_lines[credit.credit_id] = credit

    def get_credit_line(self, credit_id: str) -> Optional[CreditLine]:
        return self._credit_lines.get(credit_id)

    def get_credit_lines_by_customer(self, customer_id: str) -> List[CreditLine]:
        return [c for c in self._credit_lines.values() if c.customer_id == customer_id]

    def get_all_credit_lines(self) -> List[CreditLine]:
        return list(self._credit_lines.values())

    def save_freeze_record(self, record: FreezeRecord) -> None:
        self._freeze_records[record.freeze_id] = record

    def get_freeze_record(self, freeze_id: str) -> Optional[FreezeRecord]:
        return self._freeze_records.get(freeze_id)

    def get_freeze_records_by_credit(self, credit_id: str) -> List[FreezeRecord]:
        return [f for f in self._freeze_records.values() if f.credit_id == credit_id]

    def get_unreleased_freeze_records(self) -> List[FreezeRecord]:
        return [f for f in self._freeze_records.values() if not f.is_released]

    def save_review_report(self, report: ReviewReport) -> None:
        self._review_reports[report.report_id] = report
        key = f"{report.asset_pool_id}_{report.report_date.date()}"
        self._report_versions[key].append(report)
        self._report_versions[key].sort(key=lambda r: r.version)

    def get_review_report(self, report_id: str) -> Optional[ReviewReport]:
        return self._review_reports.get(report_id)

    def get_latest_report(self, asset_pool_id: str, report_date: datetime) -> Optional[ReviewReport]:
        key = f"{asset_pool_id}_{report_date.date()}"
        versions = self._report_versions.get(key, [])
        return versions[-1] if versions else None

    def get_all_report_versions(self, asset_pool_id: str, report_date: datetime) -> List[ReviewReport]:
        key = f"{asset_pool_id}_{report_date.date()}"
        return list(self._report_versions.get(key, []))

    def get_next_report_version(self, asset_pool_id: str, report_date: datetime) -> int:
        key = f"{asset_pool_id}_{report_date.date()}"
        versions = self._report_versions.get(key, [])
        return len(versions) + 1

    def log_operation(self, log: OperationLog) -> None:
        self._operation_logs.append(log)

    def get_operation_logs(self, target_id: Optional[str] = None) -> List[OperationLog]:
        if target_id:
            return [log for log in self._operation_logs if log.target_id == target_id]
        return list(self._operation_logs)

    def save_gap_result(self, result: GapCalculationResult) -> None:
        self._gap_results[result.result_id] = result
        self._pool_results[result.asset_pool_id].append(result)
        self._pool_results[result.asset_pool_id].sort(key=lambda r: r.calculation_date)

    def get_gap_result(self, result_id: str) -> Optional[GapCalculationResult]:
        return self._gap_results.get(result_id)

    def get_latest_gap_result(self, asset_pool_id: str) -> Optional[GapCalculationResult]:
        results = self._pool_results.get(asset_pool_id, [])
        return results[-1] if results else None

    def get_previous_gap_result(self, asset_pool_id: str, before_date: datetime) -> Optional[GapCalculationResult]:
        results = self._pool_results.get(asset_pool_id, [])
        for result in reversed(results):
            if result.calculation_date < before_date:
                return result
        return None

    def save_pending_confirmation(self, pc: PendingConfirmation) -> None:
        self._pending_confirmations[pc.confirm_id] = pc

    def get_pending_confirmations(self, gap_result_id: Optional[str] = None) -> List[PendingConfirmation]:
        if gap_result_id:
            return [pc for pc in self._pending_confirmations.values()
                    if pc.gap_result_id == gap_result_id]
        return [pc for pc in self._pending_confirmations.values() if not pc.is_confirmed]

    def confirm_pending(self, confirm_id: str, confirmed_by: str) -> Optional[PendingConfirmation]:
        pc = self._pending_confirmations.get(confirm_id)
        if pc:
            pc.is_confirmed = True
            pc.confirmed_by = confirmed_by
            pc.confirmed_at = datetime.now()
        return pc
