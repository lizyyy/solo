from __future__ import annotations

from .models import (
    ClearingRecord,
    HolidayExtensionInfo,
    ProcessingStatus,
    SelfCheckResult,
    SelfCheckRule,
    SummaryUpdate,
)
from .store import ResultStore


class SelfCheckEngine:
    def __init__(self, store: ResultStore | None = None) -> None:
        self._store = store or ResultStore.get_instance()

    def run_all(self) -> list[SelfCheckResult]:
        results: list[SelfCheckResult] = []
        results.extend(self._check_duplicate_import())
        results.extend(self._check_zero_amount_reversed())
        results.extend(self._check_recalc_after_supplement())
        results.extend(self._check_export_consistency())
        self._store.store_check_results(results)

        for record in self._store.get_records():
            if record.status == ProcessingStatus.IMPORTED:
                record_results = [r for r in results if r.record_id == record.id]
                has_failure = any(not r.passed for r in record_results)
                if has_failure:
                    record.status = ProcessingStatus.PENDING_REVIEW
                else:
                    record.status = ProcessingStatus.SELF_CHECK_PASSED
                record.add_audit(
                    action="self_check",
                    detail=f"自检完成, {'存在异常' if has_failure else '全部通过'}",
                )

        return results

    def _check_duplicate_import(self) -> list[SelfCheckResult]:
        results: list[SelfCheckResult] = []
        seen: dict[str, list[ClearingRecord]] = {}

        for record in self._store.get_records():
            key = f"{record.clearing_batch_no}:{record.original_line_no}"
            seen.setdefault(key, []).append(record)

        for key, records in seen.items():
            if len(records) > 1:
                for record in records:
                    record.is_duplicate = True
                    record.add_audit(action="duplicate_detected", detail=f"重复导入: {key}")
                results.append(SelfCheckResult(
                    rule=SelfCheckRule.DUPLICATE_IMPORT,
                    passed=False,
                    record_id=records[0].id,
                    clearing_batch_no=records[0].clearing_batch_no,
                    message=f"清算批次号 {records[0].clearing_batch_no} 行号 {records[0].original_line_no} 重复导入 {len(records)} 次",
                    severity="error",
                ))
            else:
                results.append(SelfCheckResult(
                    rule=SelfCheckRule.DUPLICATE_IMPORT,
                    passed=True,
                    record_id=records[0].id,
                    clearing_batch_no=records[0].clearing_batch_no,
                    message="无重复",
                ))

        return results

    def _check_zero_amount_reversed(self) -> list[SelfCheckResult]:
        results: list[SelfCheckResult] = []
        for record in self._store.get_records():
            is_zero_reversed = record.amount == 0 and "已冲正" in record.remark
            record.is_zero_reversed = is_zero_reversed

            if is_zero_reversed:
                record.add_audit(
                    action="zero_amount_reversed_detected",
                    detail="金额为0且备注含'已冲正'，标记待风控复核",
                )
                results.append(SelfCheckResult(
                    rule=SelfCheckRule.ZERO_AMOUNT_REVERSED,
                    passed=False,
                    record_id=record.id,
                    clearing_batch_no=record.clearing_batch_no,
                    message=f"清算批次号 {record.clearing_batch_no} 行号 {record.original_line_no}: 金额为0但备注含'已冲正'，请勿直接归正常，需风控复核",
                    severity="warning",
                ))
            else:
                results.append(SelfCheckResult(
                    rule=SelfCheckRule.ZERO_AMOUNT_REVERSED,
                    passed=True,
                    record_id=record.id,
                    clearing_batch_no=record.clearing_batch_no,
                    message="无异常",
                ))

        return results

    def _check_recalc_after_supplement(self) -> list[SelfCheckResult]:
        results: list[SelfCheckResult] = []
        for record in self._store.get_records():
            if record.supplement_applied:
                before_amounts = [
                    e.original_value for e in record.audit_trail
                    if e.action == "supplement_applied" and e.original_value is not None
                ]
                after_amounts = [
                    e.new_value for e in record.audit_trail
                    if e.action == "supplement_applied" and e.new_value is not None
                ]
                if before_amounts and after_amounts and before_amounts[-1] == after_amounts[-1]:
                    results.append(SelfCheckResult(
                        rule=SelfCheckRule.RECALC_AFTER_SUPPLEMENT,
                        passed=False,
                        record_id=record.id,
                        clearing_batch_no=record.clearing_batch_no,
                        message=f"补录后重算金额未变化: {before_amounts[-1]}",
                        severity="warning",
                    ))
                    record.add_audit(
                        action="recalc_check_failed",
                        detail="补录后重算金额未变化",
                    )
                else:
                    results.append(SelfCheckResult(
                        rule=SelfCheckRule.RECALC_AFTER_SUPPLEMENT,
                        passed=True,
                        record_id=record.id,
                        clearing_batch_no=record.clearing_batch_no,
                        message="补录后重算正常",
                    ))
            else:
                results.append(SelfCheckResult(
                    rule=SelfCheckRule.RECALC_AFTER_SUPPLEMENT,
                    passed=True,
                    record_id=record.id,
                    clearing_batch_no=record.clearing_batch_no,
                    message="未涉及补录",
                ))

        return results

    def _check_export_consistency(self) -> list[SelfCheckResult]:
        results: list[SelfCheckResult] = []
        export_data = self._store.export_records()
        records = self._store.get_records()

        if len(export_data) != len(records):
            results.append(SelfCheckResult(
                rule=SelfCheckRule.EXPORT_CONSISTENCY,
                passed=False,
                message=f"导出记录数({len(export_data)})与内存记录数({len(records)})不一致",
                severity="error",
            ))
            return results

        for record in records:
            exported = next((e for e in export_data if e["id"] == record.id), None)
            if exported is None:
                results.append(SelfCheckResult(
                    rule=SelfCheckRule.EXPORT_CONSISTENCY,
                    passed=False,
                    record_id=record.id,
                    clearing_batch_no=record.clearing_batch_no,
                    message=f"记录 {record.id} 在导出中缺失",
                    severity="error",
                ))
            elif exported["amount"] != record.amount or exported["status"] != record.status.value:
                results.append(SelfCheckResult(
                    rule=SelfCheckRule.EXPORT_CONSISTENCY,
                    passed=False,
                    record_id=record.id,
                    clearing_batch_no=record.clearing_batch_no,
                    message=f"记录 {record.id} 导出数据与内存不一致",
                    severity="error",
                ))
            else:
                results.append(SelfCheckResult(
                    rule=SelfCheckRule.EXPORT_CONSISTENCY,
                    passed=True,
                    record_id=record.id,
                    clearing_batch_no=record.clearing_batch_no,
                    message="导出一致",
                ))

        return results
