from datetime import datetime
from typing import List, Dict, Any
import io
import csv
import json
from collections import defaultdict

from .models import (
    ReconciliationReport, ReconciliationSummary, ReviewStatus,
    ViolationType
)
from .store import store
from .review import ReviewManager


class ReportGenerator:
    @staticmethod
    def generate_summary() -> ReconciliationSummary:
        jobs = store.get_all_spray_jobs()
        validations = store.get_all_validation_results()
        reviews = store.get_all_review_records()

        total_jobs = len(jobs)
        valid_jobs = sum(1 for v in validations if v.is_valid)
        invalid_jobs = total_jobs - valid_jobs

        status_counts = defaultdict(int)
        for job in jobs:
            status = store.get_job_review_status(job.id)
            status_counts[status.value] += 1

        total_dosage_used = sum(job.dosage_used for job in jobs)

        pesticides = store.get_all_pesticides()
        total_stock = sum(p.stock_quantity for p in pesticides)
        total_stock_remaining = total_stock - total_dosage_used

        violation_counts = defaultdict(int)
        for result in validations:
            for violation in result.violations:
                violation_counts[violation.type.value] += 1

        return ReconciliationSummary(
            total_jobs=total_jobs,
            valid_jobs=valid_jobs,
            invalid_jobs=invalid_jobs,
            pending_review=status_counts.get(ReviewStatus.PENDING.value, 0),
            approved=status_counts.get(ReviewStatus.APPROVED.value, 0),
            rejected=status_counts.get(ReviewStatus.REJECTED.value, 0),
            needs_more_info=status_counts.get(ReviewStatus.NEEDS_MORE_INFO.value, 0),
            total_dosage_used=total_dosage_used,
            total_stock_used=total_dosage_used,
            total_stock_remaining=total_stock_remaining,
            violation_counts=dict(violation_counts)
        )

    @staticmethod
    def generate_report(session_id: str = "default") -> ReconciliationReport:
        summary = ReportGenerator.generate_summary()
        job_details = ReviewManager.get_all_jobs_with_reviews()
        review_records = [r.model_dump() for r in store.get_all_review_records()]

        return ReconciliationReport(
            session_id=session_id,
            generated_at=datetime.now(),
            summary=summary,
            job_details=job_details,
            review_records=review_records
        )

    @staticmethod
    def export_report_csv(session_id: str = "default") -> str:
        report = ReportGenerator.generate_report(session_id)
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["=== 园林喷洒对账报告 ==="])
        writer.writerow(["生成时间", report.generated_at.strftime("%Y-%m-%d %H:%M:%S")])
        writer.writerow([])

        writer.writerow(["=== 汇总统计 ==="])
        writer.writerow(["总记录数", report.summary.total_jobs])
        writer.writerow(["合规记录", report.summary.valid_jobs])
        writer.writerow(["违规记录", report.summary.invalid_jobs])
        writer.writerow(["待复核", report.summary.pending_review])
        writer.writerow(["已通过", report.summary.approved])
        writer.writerow(["已退回", report.summary.rejected])
        writer.writerow(["需补材料", report.summary.needs_more_info])
        writer.writerow([])

        writer.writerow(["=== 违规类型统计 ==="])
        for vtype, count in report.summary.violation_counts.items():
            writer.writerow([vtype, count])
        writer.writerow([])

        writer.writerow(["=== 详细记录 ==="])
        writer.writerow([
            "作业ID", "日期", "区域", "面积(公顷)", "药剂", "用量", "操作员",
            "验证状态", "复核状态", "违规项", "复核备注"
        ])

        for job in report.job_details:
            violations = "; ".join([
                f"{v['type']}: {v['message']}"
                for v in job.get("effective_violations", [])
            ])
            review_notes = job.get("review", {}).get("review_notes", "") if job.get("review") else ""

            writer.writerow([
                job.get("id", ""),
                job.get("job_date", ""),
                job.get("area", ""),
                job.get("area_size_hectares", ""),
                job.get("pesticide_name", ""),
                job.get("dosage_used", ""),
                job.get("operator", ""),
                "合规" if job.get("is_effectively_valid") else "违规",
                job.get("review_status", ""),
                violations,
                review_notes
            ])

        return output.getvalue()

    @staticmethod
    def export_report_json(session_id: str = "default") -> str:
        report = ReportGenerator.generate_report(session_id)
        return json.dumps(report.model_dump(), default=str, ensure_ascii=False, indent=2)

    @staticmethod
    def get_explanation_for_job(job_id: str) -> Dict[str, Any]:
        job_data = ReviewManager.get_job_with_review(job_id)
        if not job_data:
            return {"error": "作业记录不存在"}

        review = job_data.get("review")
        review_status = job_data.get("review_status")

        explanation = {
            "job_id": job_id,
            "review_status": review_status,
            "decision_reason": "",
            "evidence": [],
            "recommendations": []
        }

        violations = job_data.get("effective_violations", [])
        for v in violations:
            explanation["evidence"].append({
                "type": v["type"],
                "severity": v["severity"],
                "message": v["message"],
                "expected": v.get("expected_value"),
                "actual": v.get("actual_value"),
                "details": v.get("details")
            })

        if review:
            explanation["reviewer"] = review.get("reviewer")
            explanation["review_notes"] = review.get("review_notes")
            explanation["reviewed_at"] = review.get("reviewed_at")

            if review.get("adjusted_dosage") or review.get("adjusted_area"):
                explanation["adjustments"] = {
                    "adjusted_dosage": review.get("adjusted_dosage"),
                    "adjusted_area": review.get("adjusted_area")
                }

            if review.get("override_violations"):
                explanation["overridden_violations"] = review.get("override_violations")

        if review_status == ReviewStatus.APPROVED.value:
            overridden = review.get("override_violations", []) if review else []
            if violations:
                explanation["decision_reason"] = (
                    f"虽然存在 {len(violations)} 项违规，但已通过人工复核。"
                    f"复核意见: {review.get('review_notes', '无')}"
                )
            elif overridden:
                explanation["decision_reason"] = (
                    f"存在 {len(overridden)} 项违规已被人工豁免通过。"
                    f"复核意见: {review.get('review_notes', '无')}"
                )
            else:
                explanation["decision_reason"] = "所有校验项均通过，作业合规。"

        elif review_status == ReviewStatus.REJECTED.value:
            explanation["decision_reason"] = (
                f"作业存在 {len(violations)} 项违规，已被退回。"
                f"退回原因: {review.get('review_notes', '无')}"
            )
            for v in violations:
                if v["type"] == ViolationType.WIND_SPEED_EXCEEDED.value:
                    explanation["recommendations"].append(
                        "建议选择风速较低的日期重新安排喷洒作业"
                    )
                elif v["type"] == ViolationType.DOSAGE_EXCEEDED.value:
                    explanation["recommendations"].append(
                        "请核实实际用量，如确需超量使用请提交特殊申请"
                    )
                elif v["type"] == ViolationType.SAFETY_INTERVAL_VIOLATED.value:
                    explanation["recommendations"].append(
                        "请严格遵守安全间隔期，延后喷洒日期"
                    )

        elif review_status == ReviewStatus.NEEDS_MORE_INFO.value:
            explanation["decision_reason"] = (
                f"需要补充材料。原因: {review.get('review_notes', '无')}"
            )

        else:
            if violations:
                explanation["decision_reason"] = f"检测到 {len(violations)} 项违规，等待人工复核。"
            else:
                explanation["decision_reason"] = "所有校验项均通过，等待最终确认。"

        return explanation
