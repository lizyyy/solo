from typing import List, Dict, Any, Tuple
from collections import defaultdict
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import DRIFT_THRESHOLD, ALLOWED_UNITS, STANDARD_CONSTRAINTS
from .models import (
    PickingResult,
    ValidationStatus,
    ValidationIssue,
    IssueType,
)


class ResultValidator:
    def __init__(self):
        self.drift_threshold = DRIFT_THRESHOLD
        self.allowed_units = ALLOWED_UNITS
        self.constraints = STANDARD_CONSTRAINTS.copy()

    def validate_all(
        self,
        results: List[PickingResult],
        baseline_results: List[PickingResult] = None,
    ) -> Tuple[List[PickingResult], Dict[str, Any]]:
        validated_results = []
        stats = {
            "total": len(results),
            "normal": 0,
            "suspicious": 0,
            "pending": 0,
            "invalid": 0,
            "issues_by_type": defaultdict(int),
        }

        baseline_map = {}
        if baseline_results:
            for r in baseline_results:
                key = f"{r.order_no}|{r.sku_code}"
                baseline_map[key] = r

        order_qty_map = defaultdict(list)
        for result in results:
            order_qty_map[result.order_no].append(result)

        unit_map = defaultdict(set)
        for result in results:
            unit_map[result.sku_code].add(result.unit)

        for result in results:
            result.issues = []
            result.status = ValidationStatus.NORMAL

            self._check_drift(result, baseline_map)
            self._check_unit_consistency(result, unit_map)
            self._check_constraints(result, order_qty_map[result.order_no])
            self._check_unit_validity(result)

            if result.issues:
                has_high_severity = any(i.severity == "high" for i in result.issues)
                if has_high_severity:
                    result.status = ValidationStatus.SUSPICIOUS
                else:
                    result.status = ValidationStatus.PENDING

            validated_results.append(result)
            stats[result.status.name.lower()] += 1
            for issue in result.issues:
                stats["issues_by_type"][issue.issue_type.value] += 1

        stats["issues_by_type"] = dict(stats["issues_by_type"])
        return validated_results, stats

    def _check_drift(
        self, result: PickingResult, baseline_map: Dict[str, PickingResult]
    ) -> None:
        key = f"{result.order_no}|{result.sku_code}"
        if key not in baseline_map:
            return

        baseline = baseline_map[key]
        qty_diff = abs(result.pick_qty - baseline.pick_qty)
        if baseline.pick_qty > 0:
            drift_ratio = qty_diff / baseline.pick_qty
        else:
            drift_ratio = 1.0 if qty_diff > 0 else 0

        if drift_ratio > self.drift_threshold:
            issue = ValidationIssue(
                issue_type=IssueType.DRIFT,
                description=f"拣货数量结果漂移超过阈值({self.drift_threshold*100:.0f}%)",
                severity="high",
                evidence={
                    "baseline_qty": baseline.pick_qty,
                    "current_qty": result.pick_qty,
                    "difference": qty_diff,
                    "drift_ratio": round(drift_ratio, 4),
                    "baseline_run_id": baseline.run_id,
                    "current_run_id": result.run_id,
                },
                suggestion=f"人工复核该订单拣货数量，确认是数据更新还是模型漂移。基线数量：{baseline.pick_qty}，当前数量：{result.pick_qty}",
            )
            result.issues.append(issue)

    def _check_unit_validity(self, result: PickingResult) -> None:
        if result.unit not in self.allowed_units:
            issue = ValidationIssue(
                issue_type=IssueType.UNIT_MISMATCH,
                description=f"单位'{result.unit}'不在允许的单位列表中",
                severity="medium",
                evidence={
                    "current_unit": result.unit,
                    "allowed_units": self.allowed_units,
                },
                suggestion=f"将单位修正为标准单位之一: {', '.join(self.allowed_units)}",
            )
            result.issues.append(issue)

    def _check_unit_consistency(
        self, result: PickingResult, unit_map: Dict[str, set]
    ) -> None:
        sku_units = unit_map.get(result.sku_code, set())
        if len(sku_units) > 1:
            issue = ValidationIssue(
                issue_type=IssueType.UNIT_MISMATCH,
                description=f"同一SKU存在多个单位混用",
                severity="high",
                evidence={
                    "sku_code": result.sku_code,
                    "used_units": list(sku_units),
                    "current_record_unit": result.unit,
                },
                suggestion=f"统一SKU '{result.sku_code}' 的计量单位，当前使用了: {', '.join(sku_units)}",
            )
            result.issues.append(issue)

    def _check_constraints(
        self, result: PickingResult, order_results: List[PickingResult]
    ) -> None:
        total_qty = sum(r.pick_qty for r in order_results)

        if total_qty > self.constraints["max_pick_per_order"]:
            issue = ValidationIssue(
                issue_type=IssueType.CONSTRAINT_OVERRIDE,
                description=f"订单总拣货数超过单订单上限约束",
                severity="medium",
                evidence={
                    "order_no": result.order_no,
                    "total_pick_qty": total_qty,
                    "constraint_max": self.constraints["max_pick_per_order"],
                    "item_count": len(order_results),
                },
                suggestion=f"检查订单 '{result.order_no}' 是否需要拆分，当前总拣货数 {total_qty} 超过上限 {self.constraints['max_pick_per_order']}",
            )
            result.issues.append(issue)

        if result.pick_qty < self.constraints["min_pick_per_order"]:
            issue = ValidationIssue(
                issue_type=IssueType.CONSTRAINT_OVERRIDE,
                description=f"单行拣货数低于最小拣货约束",
                severity="low",
                evidence={
                    "pick_qty": result.pick_qty,
                    "constraint_min": self.constraints["min_pick_per_order"],
                },
                suggestion=f"确认拣货数量 {result.pick_qty} 是否正确，低于最小拣货量可能影响效率",
            )
            result.issues.append(issue)

    def update_constraints(self, new_constraints: Dict[str, Any]) -> None:
        self.constraints.update(new_constraints)

    def get_validation_summary(
        self, results: List[PickingResult]
    ) -> Dict[str, Any]:
        summary = {
            "total_records": len(results),
            "by_status": defaultdict(int),
            "by_issue_type": defaultdict(list),
            "suspicious_records": [],
        }

        for result in results:
            summary["by_status"][result.status.value] += 1
            for issue in result.issues:
                summary["by_issue_type"][issue.issue_type.value].append(
                    {
                        "record_id": result.record_id,
                        "order_no": result.order_no,
                        "sku_code": result.sku_code,
                        "description": issue.description,
                        "severity": issue.severity,
                    }
                )
            if result.status in [ValidationStatus.SUSPICIOUS, ValidationStatus.PENDING]:
                summary["suspicious_records"].append(
                    {
                        "record_id": result.record_id,
                        "order_no": result.order_no,
                        "sku_code": result.sku_code,
                        "sku_name": result.sku_name,
                        "status": result.status.value,
                        "issues_count": len(result.issues),
                        "issues": [i.description for i in result.issues],
                        "suggestions": [i.suggestion for i in result.issues],
                    }
                )

        summary["by_status"] = dict(summary["by_status"])
        summary["by_issue_type"] = {k: len(v) for k, v in summary["by_issue_type"].items()}
        return summary
