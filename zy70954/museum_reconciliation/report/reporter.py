import csv
import json
import os
from datetime import datetime
from typing import Dict, List, Optional

from ..models.models import (
    ArtifactGrade,
    Discrepancy,
    ReconciliationRecord,
    ReconciliationStatus,
    ReviewStatus,
)


class ReportGenerator:
    def __init__(self):
        self._cache: Dict[str, dict] = {}

    def generate_detail_report(self, record: ReconciliationRecord) -> dict:
        report = {
            "record_id": record.record_id,
            "artifact_id": record.artifact_id,
            "artifact_name": record.artifact_name,
            "artifact_grade": record.artifact_grade.value if record.artifact_grade else "未分级",
            "status": record.status.value,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "import_batch": record.reconciliation_batch,
        }

        if record.artifact:
            report["artifact_info"] = {
                "artifact_id": record.artifact.artifact_id,
                "name": record.artifact.name,
                "grade": record.artifact.grade.value,
                "category": record.artifact.category,
                "origin_museum": record.artifact.origin_museum,
                "current_valuation": record.artifact.current_valuation,
                "current_valuation_formatted": f"¥{record.artifact.current_valuation:,.2f}",
                "previous_valuation": record.artifact.previous_valuation,
                "previous_valuation_formatted": (
                    f"¥{record.artifact.previous_valuation:,.2f}"
                    if record.artifact.previous_valuation
                    else None
                ),
                "condition": record.artifact.condition,
                "last_condition_check": record.artifact.last_condition_check,
                "remarks": record.artifact.remarks,
            }

        if record.transport:
            nodes_info = []
            for node in record.transport.nodes:
                nodes_info.append({
                    "node_name": node.node_name,
                    "planned_arrival": node.planned_arrival,
                    "actual_arrival": node.actual_arrival,
                    "temperature": node.temperature,
                    "humidity": node.humidity,
                    "status": node.status,
                    "notes": node.notes,
                })
            report["transport_info"] = {
                "transport_id": record.transport.transport_id,
                "start_location": record.transport.start_location,
                "end_location": record.transport.end_location,
                "planned_start_date": record.transport.planned_start_date,
                "planned_end_date": record.transport.planned_end_date,
                "actual_start_date": record.transport.actual_start_date,
                "actual_end_date": record.transport.actual_end_date,
                "transport_method": record.transport.transport_method,
                "carrier": record.transport.carrier,
                "overall_status": record.transport.overall_status,
                "nodes": nodes_info,
            }

        if record.insurance:
            report["insurance_info"] = {
                "policy_id": record.insurance.policy_id,
                "insurer": record.insurance.insurer,
                "insured_amount": record.insurance.insured_amount,
                "insured_amount_formatted": f"¥{record.insurance.insured_amount:,.2f}",
                "coverage_start": record.insurance.coverage_start,
                "coverage_end": record.insurance.coverage_end,
                "policy_type": record.insurance.policy_type,
                "premium": record.insurance.premium,
                "exclusions": record.insurance.exclusions,
                "special_clauses": record.insurance.special_clauses,
            }

        discrepancies_info = []
        for disc in record.discrepancies:
            discrepancies_info.append({
                "discrepancy_id": disc.discrepancy_id,
                "type": disc.discrepancy_type.value,
                "field": disc.field_name,
                "expected_value": disc.expected_value,
                "actual_value": disc.actual_value,
                "description": disc.description,
                "explanation": disc.explanation,
                "severity": disc.severity,
                "resolved": disc.resolved,
                "resolution_note": disc.resolution_note,
            })
        report["discrepancies"] = discrepancies_info
        report["discrepancy_count"] = len(record.discrepancies)
        report["critical_discrepancy_count"] = sum(
            1 for d in record.discrepancies if d.severity == "critical"
        )

        if record.review_decision:
            report["review_decision"] = {
                "review_id": record.review_decision.review_id,
                "decision": record.review_decision.decision.value,
                "reviewer": record.review_decision.reviewer,
                "review_time": record.review_decision.review_time,
                "comments": record.review_decision.comments,
                "required_actions": record.review_decision.required_actions,
                "requires_manual_fix": record.review_decision.requires_manual_fix,
                "manual_fix_fields": record.review_decision.manual_fix_fields,
            }

        report["matched_fields"] = record.matched_fields
        report["unmatched_fields"] = record.unmatched_fields

        self._cache[f"detail_{record.artifact_id}"] = report
        return report

    def generate_summary(self, records: Dict[str, ReconciliationRecord]) -> dict:
        total = len(records)
        matched = sum(1 for r in records.values() if r.status == ReconciliationStatus.MATCHED)
        needs_review = sum(1 for r in records.values() if r.status == ReconciliationStatus.NEEDS_REVIEW)
        resolved = sum(1 for r in records.values() if r.status == ReconciliationStatus.RESOLVED)
        exception = sum(1 for r in records.values() if r.status == ReconciliationStatus.EXCEPTION)

        total_disc = sum(len(r.discrepancies) for r in records.values())
        critical_disc = sum(
            1
            for r in records.values()
            for d in r.discrepancies
            if d.severity == "critical"
        )

        by_type: Dict[str, int] = {}
        for r in records.values():
            for d in r.discrepancies:
                type_name = d.discrepancy_type.value
                by_type[type_name] = by_type.get(type_name, 0) + 1

        by_grade: Dict[str, int] = {}
        by_grade_with_issues: Dict[str, int] = {}
        for r in records.values():
            grade = r.artifact_grade.value if r.artifact_grade else "未分级"
            by_grade[grade] = by_grade.get(grade, 0) + 1
            if r.status != ReconciliationStatus.MATCHED:
                by_grade_with_issues[grade] = by_grade_with_issues.get(grade, 0) + 1

        approved_count = sum(
            1
            for r in records.values()
            if r.review_decision and r.review_decision.decision == ReviewStatus.APPROVED
        )
        rejected_count = sum(
            1
            for r in records.values()
            if r.review_decision and r.review_decision.decision == ReviewStatus.REJECTED
        )
        supplement_count = sum(
            1
            for r in records.values()
            if r.review_decision and r.review_decision.decision == ReviewStatus.NEEDS_SUPPLEMENT
        )

        total_valuation = sum(
            r.artifact.current_valuation for r in records.values() if r.artifact
        )
        total_insured = sum(
            r.insurance.insured_amount for r in records.values() if r.insurance
        )

        summary = {
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_records": total,
            "by_status": {
                "完全一致": matched,
                "待复核": needs_review,
                "已处理": resolved,
                "异常": exception,
            },
            "by_review_decision": {
                "已放行": approved_count,
                "已退回": rejected_count,
                "需补材料": supplement_count,
            },
            "total_discrepancies": total_disc,
            "critical_discrepancies": critical_disc,
            "discrepancies_by_type": by_type,
            "records_by_grade": by_grade,
            "records_with_issues_by_grade": by_grade_with_issues,
            "total_valuation": total_valuation,
            "total_valuation_formatted": f"¥{total_valuation:,.2f}",
            "total_insured": total_insured,
            "total_insured_formatted": f"¥{total_insured:,.2f}",
            "insurance_valuation_diff": total_insured - total_valuation,
            "insurance_valuation_diff_formatted": f"¥{total_insured - total_valuation:,.2f}",
        }

        self._cache["summary"] = summary
        return summary

    def generate_export_report(
        self, records: Dict[str, ReconciliationRecord], output_dir: str
    ) -> str:
        os.makedirs(output_dir, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"reconciliation_report_{timestamp}.json"
        filepath = os.path.join(output_dir, filename)

        summary = self.generate_summary(records)
        details = []
        for artifact_id in sorted(records.keys()):
            detail = self.generate_detail_report(records[artifact_id])
            details.append(detail)

        full_report = {
            "report_title": "博物馆展陈部文物借展对账报告",
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "reconciliation_batch": list(records.values())[0].reconciliation_batch if records else "",
            "summary": summary,
            "details": details,
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(full_report, f, ensure_ascii=False, indent=2)

        return filepath

    def export_csv(
        self, records: Dict[str, ReconciliationRecord], output_dir: str
    ) -> str:
        os.makedirs(output_dir, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"reconciliation_summary_{timestamp}.csv"
        filepath = os.path.join(output_dir, filename)

        fieldnames = [
            "文物编号",
            "文物名称",
            "文物等级",
            "对账状态",
            "差异数量",
            "严重差异数量",
            "差异类型",
            "复核状态",
            "复核人",
            "复核时间",
            "当前估值",
            "保险金额",
            "估值与保险差额",
            "运输状态",
            "备注",
        ]

        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for artifact_id in sorted(records.keys()):
                record = records[artifact_id]

                valuation = record.artifact.current_valuation if record.artifact else 0
                insured = record.insurance.insured_amount if record.insurance else 0
                diff = insured - valuation

                disc_types = "、".join(
                    set(d.discrepancy_type.value for d in record.discrepancies)
                )

                review_status = ""
                reviewer = ""
                review_time = ""
                if record.review_decision:
                    review_status = record.review_decision.decision.value
                    reviewer = record.review_decision.reviewer
                    review_time = record.review_decision.review_time or ""

                row = {
                    "文物编号": record.artifact_id,
                    "文物名称": record.artifact_name,
                    "文物等级": record.artifact_grade.value if record.artifact_grade else "未分级",
                    "对账状态": record.status.value,
                    "差异数量": len(record.discrepancies),
                    "严重差异数量": sum(1 for d in record.discrepancies if d.severity == "critical"),
                    "差异类型": disc_types,
                    "复核状态": review_status,
                    "复核人": reviewer,
                    "复核时间": review_time,
                    "当前估值": f"¥{valuation:,.2f}",
                    "保险金额": f"¥{insured:,.2f}",
                    "估值与保险差额": f"¥{diff:,.2f}",
                    "运输状态": record.transport.overall_status if record.transport else "",
                    "备注": record.artifact.remarks if record.artifact else "",
                }
                writer.writerow(row)

        return filepath

    def export_discrepancy_details(
        self, records: Dict[str, ReconciliationRecord], output_dir: str
    ) -> str:
        os.makedirs(output_dir, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"discrepancy_details_{timestamp}.csv"
        filepath = os.path.join(output_dir, filename)

        fieldnames = [
            "文物编号",
            "文物名称",
            "文物等级",
            "差异类型",
            "差异字段",
            "期望值",
            "实际值",
            "差异描述",
            "差异解释",
            "严重程度",
            "是否已解决",
            "解决说明",
        ]

        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for artifact_id in sorted(records.keys()):
                record = records[artifact_id]
                for disc in record.discrepancies:
                    row = {
                        "文物编号": record.artifact_id,
                        "文物名称": record.artifact_name,
                        "文物等级": record.artifact_grade.value if record.artifact_grade else "未分级",
                        "差异类型": disc.discrepancy_type.value,
                        "差异字段": disc.field_name,
                        "期望值": disc.expected_value,
                        "实际值": disc.actual_value,
                        "差异描述": disc.description,
                        "差异解释": disc.explanation,
                        "严重程度": "严重" if disc.severity == "critical" else "一般",
                        "是否已解决": "是" if disc.resolved else "否",
                        "解决说明": disc.resolution_note,
                    }
                    writer.writerow(row)

        return filepath

    def get_cache(self) -> dict:
        return self._cache

    def invalidate_cache(self, artifact_id: Optional[str] = None):
        if artifact_id:
            self._cache.pop(f"detail_{artifact_id}", None)
        else:
            self._cache.clear()