from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Callable
import logging
from pathlib import Path

from models import WorkOrder, DesensitizationRemark, ConflictSample, ConflictType, ConflictStatus
from utils import LinkChecker, save_json, save_csv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class CheckResult:
    check_name: str
    passed: bool
    message: str
    details: dict
    severity: str = "warning"

    def to_dict(self) -> dict:
        return {
            "check_name": self.check_name,
            "passed": self.passed,
            "message": self.message,
            "severity": self.severity,
            "details": self.details,
        }


class SelfChecker:
    def __init__(self, link_checker: LinkChecker = None):
        self.link_checker = link_checker or LinkChecker()
        self.results: List[CheckResult] = []

    def run_all_checks(
        self,
        work_orders: Dict[str, WorkOrder],
        remarks: Dict[str, DesensitizationRemark],
        conflicts: Dict[str, ConflictSample],
    ) -> List[CheckResult]:
        logger.info("Running self-checks...")
        self.results = []

        self.results.append(self._check_duplicate_imports(work_orders))
        self.results.append(self._check_link_404_passed(work_orders, conflicts))
        self.results.append(self._check_supplementary_recalculation(work_orders, conflicts))
        self.results.append(self._check_export_consistency(work_orders, remarks, conflicts))
        self.results.append(self._check_history_consistency(work_orders, remarks, conflicts))

        passed = sum(1 for r in self.results if r.passed)
        logger.info(f"Self-check complete: {passed}/{len(self.results)} passed")
        return self.results

    def _check_duplicate_imports(self, work_orders: Dict[str, WorkOrder]) -> CheckResult:
        batch_counts = {}
        for wo in work_orders.values():
            if wo.import_batch:
                batch_counts[wo.import_batch] = batch_counts.get(wo.import_batch, 0) + 1

        duplicates = []
        seen_ids = set()
        for wo in work_orders.values():
            if wo.id in seen_ids:
                duplicates.append(wo.id)
            seen_ids.add(wo.id)

        if duplicates:
            return CheckResult(
                check_name="重复导入检测",
                passed=False,
                message=f"发现 {len(duplicates)} 个重复导入的工单",
                severity="error",
                details={"duplicate_ids": duplicates, "batch_counts": batch_counts},
            )

        return CheckResult(
            check_name="重复导入检测",
            passed=True,
            message="未发现重复导入",
            severity="info",
            details={"batch_counts": batch_counts},
        )

    def _check_link_404_passed(
        self,
        work_orders: Dict[str, WorkOrder],
        conflicts: Dict[str, ConflictSample],
    ) -> CheckResult:
        problematic = []
        severity = "warning"
        has_missing_conflict = False

        link_404_conflicts = {}
        for c in conflicts.values():
            if c.conflict_type == ConflictType.LINK_404_PASSED:
                if c.work_order_id not in link_404_conflicts:
                    link_404_conflicts[c.work_order_id] = []
                link_404_conflicts[c.work_order_id].append(c)

        for wo in work_orders.values():
            if not wo.reference_links:
                continue

            broken_links_in_wo = []
            for link in wo.reference_links:
                is_valid, status_code, reason = self.link_checker.check_link(link)
                if not is_valid:
                    broken_links_in_wo.append({
                        "url": link,
                        "status_code": status_code,
                        "reason": reason,
                    })

            if not broken_links_in_wo:
                continue

            related_conflicts = link_404_conflicts.get(wo.id, [])
            need_review_conflicts = [
                c for c in related_conflicts
                if c.status == ConflictStatus.NEED_PRODUCT_REVIEW
            ]

            should_report = False
            conflict_status_to_add = None
            issue_type = ""

            if wo.status.value in ("classified", "resolved"):
                should_report = True
                issue_type = "已完成工单含失效链接"
                if need_review_conflicts:
                    conflict_status_to_add = need_review_conflicts[0].status.value
                elif related_conflicts:
                    conflict_status_to_add = related_conflicts[0].status.value

            if need_review_conflicts:
                should_report = True
                issue_type = "LINK_404冲突待产品复核"
                conflict_status_to_add = ConflictStatus.NEED_PRODUCT_REVIEW.value

            if should_report:
                for bl in broken_links_in_wo:
                    entry = {
                        "work_order_id": wo.id,
                        "work_order_title": wo.title,
                        "broken_link": bl["url"],
                        "status_code": bl["status_code"],
                        "reason": bl["reason"],
                        "work_order_status": wo.status.value,
                        "issue_type": issue_type,
                    }
                    if conflict_status_to_add:
                        entry["conflict_status"] = conflict_status_to_add
                    problematic.append(entry)

            if broken_links_in_wo and not related_conflicts:
                has_missing_conflict = True
                for bl in broken_links_in_wo:
                    entry = {
                        "work_order_id": wo.id,
                        "work_order_title": wo.title,
                        "broken_link": bl["url"],
                        "status_code": bl["status_code"],
                        "reason": bl["reason"],
                        "work_order_status": wo.status.value,
                        "issue_type": "检测到失效链接但未生成冲突",
                    }
                    problematic.append(entry)

        if has_missing_conflict:
            severity = "error"

        if problematic:
            return CheckResult(
                check_name="引用链接404仍被判通过检测",
                passed=False,
                message=f"发现 {len(problematic)} 个链接问题",
                severity=severity,
                details={"problematic_orders": problematic},
            )

        return CheckResult(
            check_name="引用链接404仍被判通过检测",
            passed=True,
            message="未发现链接问题",
            severity="info",
            details={},
        )

    def _check_supplementary_recalculation(
        self,
        work_orders: Dict[str, WorkOrder],
        conflicts: Dict[str, ConflictSample],
    ) -> CheckResult:
        supplementary = [wo for wo in work_orders.values() if wo.is_supplementary]
        issues = []

        for wo in supplementary:
            related_conflicts = [c for c in conflicts.values() if c.work_order_id == wo.id]
            if related_conflicts:
                has_recalc_history = any(
                    "补录" in c.handle_notes or "重算" in c.handle_notes
                    for c in related_conflicts
                    if c.handle_notes
                )
                if not has_recalc_history and wo.status.value in ("classified", "resolved"):
                    issues.append({
                        "work_order_id": wo.id,
                        "work_order_title": wo.title,
                        "conflict_count": len(related_conflicts),
                        "note": "补录工单未触发重算或冲突未更新",
                    })

        if issues:
            return CheckResult(
                check_name="补录后重算检测",
                passed=False,
                message=f"发现 {len(issues)} 个补录工单可能未正确重算",
                severity="warning",
                details={"issues": issues},
            )

        return CheckResult(
            check_name="补录后重算检测",
            passed=True,
            message="补录工单重算逻辑正常",
            severity="info",
            details={"supplementary_count": len(supplementary)},
        )

    def _check_export_consistency(
        self,
        work_orders: Dict[str, WorkOrder],
        remarks: Dict[str, DesensitizationRemark],
        conflicts: Dict[str, ConflictSample],
    ) -> CheckResult:
        wo_ids = set(work_orders.keys())
        remark_wo_ids = set(r.work_order_id for r in remarks.values())
        conflict_wo_ids = set(c.work_order_id for c in conflicts.values())

        remarks_without_order = remark_wo_ids - wo_ids
        conflicts_without_order = conflict_wo_ids - wo_ids

        inconsistencies = []
        if remarks_without_order:
            inconsistencies.append({
                "type": "remark_without_work_order",
                "ids": list(remarks_without_order),
            })
        if conflicts_without_order:
            inconsistencies.append({
                "type": "conflict_without_work_order",
                "ids": list(conflicts_without_order),
            })

        if inconsistencies:
            return CheckResult(
                check_name="导出一致性检测",
                passed=False,
                message="发现数据引用不一致",
                severity="error",
                details={"inconsistencies": inconsistencies},
            )

        return CheckResult(
            check_name="导出一致性检测",
            passed=True,
            message="数据引用一致",
            severity="info",
            details={
                "work_order_count": len(wo_ids),
                "remark_count": len(remarks),
                "conflict_count": len(conflicts),
            },
        )

    def _check_history_consistency(
        self,
        work_orders: Dict[str, WorkOrder],
        remarks: Dict[str, DesensitizationRemark],
        conflicts: Dict[str, ConflictSample],
    ) -> CheckResult:
        conflict_orders = set(c.work_order_id for c in conflicts.values())
        orders_with_conflict_mismatch = []

        for c in conflicts.values():
            wo = work_orders.get(c.work_order_id)
            if not wo:
                continue
            if c.status in (ConflictStatus.CONFIRMED, ConflictStatus.PENDING_CONFIRM):
                if wo.status.value not in ("conflict", "need_review"):
                    orders_with_conflict_mismatch.append({
                        "work_order_id": wo.id,
                        "work_order_status": wo.status.value,
                        "conflict_status": c.status.value,
                        "conflict_type": c.conflict_type.value,
                    })

        if orders_with_conflict_mismatch:
            return CheckResult(
                check_name="冲突样本表与历史记录一致性",
                passed=False,
                message=f"发现 {len(orders_with_conflict_mismatch)} 个工单状态与冲突状态不一致",
                severity="warning",
                details={"mismatches": orders_with_conflict_mismatch},
            )

        return CheckResult(
            check_name="冲突样本表与历史记录一致性",
            passed=True,
            message="冲突样本表与工单状态一致",
            severity="info",
            details={},
        )

    def generate_report(self, output_dir: str = "reports"):
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        report_data = {
            "check_time": datetime.now().isoformat(),
            "summary": {
                "total": len(self.results),
                "passed": sum(1 for r in self.results if r.passed),
                "failed": sum(1 for r in self.results if not r.passed),
                "errors": sum(1 for r in self.results if r.severity == "error" and not r.passed),
                "warnings": sum(1 for r in self.results if r.severity == "warning" and not r.passed),
            },
            "results": [r.to_dict() for r in self.results],
        }

        save_json(report_data, str(output_path / "self_check_report.json"))

        csv_rows = []
        for r in self.results:
            csv_rows.append({
                "检查项": r.check_name,
                "是否通过": "是" if r.passed else "否",
                "严重程度": r.severity,
                "消息": r.message,
                "详情": str(r.details)[:200],
            })
        save_csv(csv_rows, str(output_path / "self_check_report.csv"))

        logger.info(f"Self-check report generated in {output_path}")
        return report_data
