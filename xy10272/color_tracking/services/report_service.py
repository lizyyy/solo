import json
import csv
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime
from ..models import (
    SampleRecord,
    SampleComparison,
    TrackingReport,
    WorkflowStatus,
    AlertLevel,
    generate_id
)
from ..core import ComparisonEngine


class ReportService:
    @staticmethod
    def generate_tracking_report(
        order_id: str,
        records: List[SampleRecord]
    ) -> TrackingReport:
        if not records:
            raise ValueError("没有打样记录可生成报告")

        deltas = [r.color_delta.delta_e2000 for r in records if r.color_delta]

        approved = sum(1 for r in records if r.approved is True)
        rejected = sum(1 for r in records if r.approved is False)
        pending_review = sum(1 for r in records if r.status == WorkflowStatus.NEEDS_REVIEW)

        paper_batches = list({r.paper_batch.batch_code for r in records})

        total_adjustments = sum(len(r.adjustments) for r in records)

        alert_summary = {
            "CRITICAL": sum(1 for r in records if r.alert_level == AlertLevel.CRITICAL),
            "WARNING": sum(1 for r in records if r.alert_level == AlertLevel.WARNING),
            "NORMAL": sum(1 for r in records if r.alert_level == AlertLevel.NORMAL),
        }

        recommendations = ReportService._generate_recommendations(records)

        return TrackingReport(
            report_id=generate_id("RPT_"),
            order_id=order_id,
            generated_at=datetime.now(),
            total_samples=len(records),
            approved_samples=approved,
            rejected_samples=rejected,
            pending_review=pending_review,
            max_delta_e2000=max(deltas) if deltas else 0.0,
            min_delta_e2000=min(deltas) if deltas else 0.0,
            avg_delta_e2000=sum(deltas) / len(deltas) if deltas else 0.0,
            paper_batches_used=paper_batches,
            adjustments_applied=total_adjustments,
            alert_summary=alert_summary,
            recommendations=recommendations,
            records=[r.record_id for r in records],
        )

    @staticmethod
    def _generate_recommendations(records: List[SampleRecord]) -> List[str]:
        recommendations = []

        critical_records = [r for r in records if r.alert_level == AlertLevel.CRITICAL]
        if critical_records:
            recommendations.append(
                f"存在 {len(critical_records)} 次严重色差，建议重新评估油墨配方"
            )

        if len(records) >= 2:
            deltas = [r.color_delta.delta_e2000 for r in records if r.color_delta]
            if deltas:
                trend = ComparisonEngine.analyze_trend(deltas)
                if trend.get("trend") == "worsening":
                    recommendations.append("色差呈恶化趋势，建议检查设备稳定性")
                elif trend.get("trend") == "improving":
                    recommendations.append("色差呈改善趋势，当前调整方向正确")

        paper_batches = {r.paper_batch.batch_code for r in records}
        if len(paper_batches) > 1:
            recommendations.append(f"使用了 {len(paper_batches)} 个纸张批次，建议评估纸张一致性")

        adjustments = sum(len(r.adjustments) for r in records)
        if adjustments > 5:
            recommendations.append(f"累计进行了 {adjustments} 次调整，建议建立标准作业流程")

        if not recommendations:
            recommendations.append("整体质量稳定，可继续当前生产参数")

        return recommendations

    @staticmethod
    def export_to_csv(
        records: List[SampleRecord],
        filepath: str
    ) -> str:
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)

        headers = [
            "序号", "记录ID", "订单ID", "批次ID", "产品名称",
            "纸张批次", "参考色L", "参考色a", "参考色b",
            "测量色L", "测量色a", "测量色b",
            "ΔE76", "ΔE2000", "ΔL", "Δa", "Δb",
            "状态", "预警级别", "调整次数",
            "审核人", "审核结论", "创建时间"
        ]

        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(headers)

            for record in records:
                row = [
                    record.sequence_number,
                    record.record_id,
                    record.batch_info.order_id,
                    record.batch_info.batch_id,
                    record.batch_info.product_name,
                    record.paper_batch.batch_code,
                    record.reference_sample.lab_l,
                    record.reference_sample.lab_a,
                    record.reference_sample.lab_b,
                    record.measured_sample.lab_l,
                    record.measured_sample.lab_a,
                    record.measured_sample.lab_b,
                ]

                if record.color_delta:
                    row.extend([
                        round(record.color_delta.delta_e76, 4),
                        round(record.color_delta.delta_e2000, 4),
                        round(record.color_delta.delta_l, 4),
                        round(record.color_delta.delta_a, 4),
                        round(record.color_delta.delta_b, 4),
                    ])
                else:
                    row.extend(["", "", "", "", ""])

                row.extend([
                    record.status.value,
                    record.alert_level.value,
                    len(record.adjustments),
                    record.reviewer or "",
                    "通过" if record.approved is True else "拒绝" if record.approved is False else "待审核",
                    record.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                ])

                writer.writerow(row)

        return filepath

    @staticmethod
    def generate_text_report(
        report: TrackingReport,
        records: List[SampleRecord],
        comparison: Optional[SampleComparison] = None
    ) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("              印刷厂色差追样报告")
        lines.append("=" * 60)
        lines.append(f"报告编号: {report.report_id}")
        lines.append(f"订单编号: {report.order_id}")
        lines.append(f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("-" * 60)

        lines.append("\n【基本统计】")
        lines.append(f"  总打样次数: {report.total_samples}")
        lines.append(f"  通过数量: {report.approved_samples}")
        lines.append(f"  拒绝数量: {report.rejected_samples}")
        lines.append(f"  待复核数量: {report.pending_review}")

        lines.append("\n【色差统计】")
        lines.append(f"  最大ΔE2000: {report.max_delta_e2000:.4f}")
        lines.append(f"  最小ΔE2000: {report.min_delta_e2000:.4f}")
        lines.append(f"  平均ΔE2000: {report.avg_delta_e2000:.4f}")

        lines.append("\n【纸张批次】")
        for batch in report.paper_batches_used:
            lines.append(f"  - {batch}")

        lines.append("\n【调整统计】")
        lines.append(f"  累计调整次数: {report.adjustments_applied}")

        lines.append("\n【预警汇总】")
        for level, count in report.alert_summary.items():
            lines.append(f"  {level}: {count}")

        lines.append("\n【建议事项】")
        for i, rec in enumerate(report.recommendations, 1):
            lines.append(f"  {i}. {rec}")

        lines.append("\n" + "-" * 60)
        lines.append("【打样明细】")
        lines.append(f"{'序号':<6}{'ΔE2000':<12}{'状态':<12}{'预警':<10}{'调整':<8}")

        for record in records:
            delta = record.color_delta.delta_e2000 if record.color_delta else "N/A"
            if isinstance(delta, float):
                delta = f"{delta:.4f}"
            lines.append(
                f"{record.sequence_number:<6}{delta:<12}"
                f"{record.status.value:<12}"
                f"{record.alert_level.value:<10}"
                f"{len(record.adjustments):<8}"
            )

        if comparison and comparison.adjustments_summary.get("total_adjustments", 0) > 0:
            lines.append("\n【调整记录汇总】")
            adj_summary = comparison.adjustments_summary
            lines.append(f"  总调整次数: {adj_summary['total_adjustments']}")
            lines.append("  按色组统计:")
            for channel, count in adj_summary.get("by_channel", {}).items():
                lines.append(f"    - {channel}: {count}次")

        if comparison and comparison.paper_batch_changes:
            lines.append("\n【纸张批次变更】")
            for change in comparison.paper_batch_changes:
                lines.append(f"  - {change}")

        lines.append("\n" + "=" * 60)
        lines.append("                      报告结束")
        lines.append("=" * 60)

        return "\n".join(lines)

    @staticmethod
    def save_text_report(
        content: str,
        filepath: str
    ) -> str:
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return filepath
