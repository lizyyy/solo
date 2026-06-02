from __future__ import annotations

import json
from dataclasses import asdict
from typing import Any, Dict, List

from .models import (
    DataQualityWarning,
    DecisionSource,
    ReviewDecision,
    ReviewReport,
    ReviewSession,
    ReviewStatus,
    SampleReviewResult,
    WarningType,
)


class ReportGenerator:
    def generate(self, session: ReviewSession) -> ReviewReport:
        model_count = 0
        human_count = 0
        review_count = 0
        sample_details: List[Dict[str, Any]] = []

        for result in session.sample_results:
            decision = result.decision
            if decision.decision_source == DecisionSource.MODEL:
                model_count += 1
            elif decision.decision_source == DecisionSource.HUMAN_CORRECTION:
                human_count += 1
            elif decision.decision_source == DecisionSource.NEEDS_REVIEW:
                review_count += 1

            detail = self._build_sample_detail(result)
            sample_details.append(detail)

        warnings_summary = self._build_warnings_summary(session.warnings)

        return ReviewReport(
            session=session,
            model_approved_count=model_count,
            human_corrected_count=human_count,
            needs_review_count=review_count,
            total_count=len(session.sample_results),
            warnings_summary=warnings_summary,
            sample_details=sample_details,
        )

    def _build_sample_detail(self, result: SampleReviewResult) -> Dict[str, Any]:
        decision = result.decision
        sample = result.sample

        status_display = {
            ReviewStatus.MODEL_APPROVED: "模型判断",
            ReviewStatus.HUMAN_CORRECTED: "人工修正",
            ReviewStatus.NEEDS_REVIEW: "待复核",
        }

        detail: Dict[str, Any] = {
            "sample_id": decision.sample_id,
            "status": status_display.get(result.status, "未知"),
            "decided_label": decision.decided_label,
            "original_label": decision.original_label,
            "reference_result": decision.reference_result,
            "model_version": decision.model_version,
            "threshold": decision.threshold,
            "evidence": decision.evidence,
            "decided_at": decision.decided_at,
            "original_source": sample.source,
            "created_at": sample.created_at,
        }

        if decision.decision_source == DecisionSource.HUMAN_CORRECTION:
            detail["human_reason"] = decision.human_reason
            detail["human_operator"] = decision.human_operator

        if result.warnings:
            detail["warnings"] = [
                {"type": w.warning_type.value, "detail": w.detail}
                for w in result.warnings
            ]

        return detail

    def _build_warnings_summary(self, warnings: List[DataQualityWarning]) -> List[Dict[str, Any]]:
        by_type: Dict[str, List[DataQualityWarning]] = {}
        for w in warnings:
            key = w.warning_type.value
            by_type.setdefault(key, []).append(w)

        summary: List[Dict[str, Any]] = []
        type_display = {
            "duplicate_sample": "重复样本",
            "missing_reference": "缺引用结果",
            "label_conflict": "标签冲突",
            "sample_leakage": "样本泄漏",
            "null_feature": "空特征值",
        }
        for wtype, wlist in by_type.items():
            all_ids: List[str] = []
            for w in wlist:
                all_ids.extend(w.sample_ids)
            summary.append(
                {
                    "type": wtype,
                    "display": type_display.get(wtype, wtype),
                    "count": len(set(all_ids)),
                    "sample_ids": sorted(set(all_ids)),
                    "details": [w.detail for w in wlist],
                }
            )
        return summary

    def to_text(self, report: ReviewReport) -> str:
        lines: List[str] = []
        lines.append("=" * 60)
        lines.append("智能调度特征回看报告")
        lines.append("=" * 60)
        lines.append(f"会话ID: {report.session.session_id}")
        lines.append(f"生成时间: {report.generated_at}")
        lines.append(f"模型版本: {report.session.model_version}")
        lines.append(f"阈值: {report.session.threshold}")
        lines.append("")

        lines.append("-" * 40)
        lines.append("一、总体概览")
        lines.append("-" * 40)
        lines.append(f"总样本数: {report.total_count}")
        lines.append(f"  模型判断: {report.model_approved_count}")
        lines.append(f"  人工修正: {report.human_corrected_count}")
        lines.append(f"  待复核:   {report.needs_review_count}")
        lines.append("")

        if report.warnings_summary:
            lines.append("-" * 40)
            lines.append("二、数据质量告警（独立提示，不计入平均指标）")
            lines.append("-" * 40)
            for ws in report.warnings_summary:
                lines.append(f"  [{ws['display']}] 影响样本数: {ws['count']}")
                lines.append(f"    涉及ID: {ws['sample_ids']}")
                for d in ws["details"]:
                    lines.append(f"    - {d}")
            lines.append("")

        lines.append("-" * 40)
        lines.append("三、逐样本详情")
        lines.append("-" * 40)
        for sd in report.sample_details:
            lines.append(f"  [{sd['status']}] {sd['sample_id']}")
            lines.append(f"    判定标签: {sd['decided_label']}")
            lines.append(f"    原始标签: {sd['original_label']}")
            lines.append(f"    引用结果: {sd['reference_result']}")
            lines.append(f"    模型版本: {sd['model_version']}, 阈值: {sd['threshold']}")
            lines.append(f"    判定时间: {sd['decided_at']}")
            lines.append(f"    原始来源: {sd['original_source']}")
            if sd.get("human_reason"):
                lines.append(f"    人工修正原因: {sd['human_reason']}")
            if sd.get("warnings"):
                lines.append(f"    告警:")
                for w in sd["warnings"]:
                    lines.append(f"      - [{w['type']}] {w['detail']}")
            evidence = sd.get("evidence", {})
            if evidence:
                lines.append(f"    证据: {json.dumps(evidence, ensure_ascii=False, default=str)}")
            lines.append("")

        lines.append("=" * 60)
        lines.append("报告结束")
        lines.append("=" * 60)
        return "\n".join(lines)

    def to_dict(self, report: ReviewReport) -> Dict[str, Any]:
        return {
            "session_id": report.session.session_id,
            "generated_at": report.generated_at,
            "model_version": report.session.model_version,
            "threshold": report.session.threshold,
            "summary": {
                "total": report.total_count,
                "model_approved": report.model_approved_count,
                "human_corrected": report.human_corrected_count,
                "needs_review": report.needs_review_count,
            },
            "warnings": report.warnings_summary,
            "samples": report.sample_details,
        }
