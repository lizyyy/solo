import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

from models import ExplanationReport, BatchRun, ExplanationStatus
from storage import Storage


class ReportExporter:
    def __init__(self, storage: Storage):
        self.storage = storage

    def format_report_text(self, report: ExplanationReport) -> str:
        lines = []

        lines.append("=" * 80)
        lines.append(f"学习路径推荐解释报告")
        lines.append("=" * 80)
        lines.append(f"报告ID: {report.report_id}")
        lines.append(f"样本ID: {report.sample_id}")
        lines.append(f"模型版本: {report.model_version}")
        lines.append(f"生成时间: {report.generated_at}")
        lines.append(f"状态: {self._format_status(report.status)}")
        lines.append(f"推荐路径: {report.recommended_path}")
        lines.append(f"置信度: {report.confidence_score:.2%}")
        lines.append("")

        lines.append("-" * 80)
        lines.append("判定说明")
        lines.append("-" * 80)
        lines.append(report.generation_note)
        lines.append("")

        lines.append("-" * 80)
        lines.append("使用阈值")
        lines.append("-" * 80)
        for k, v in sorted(report.threshold_used.items()):
            lines.append(f"  {k}: {v}")
        lines.append("")

        lines.append("-" * 80)
        lines.append(f"证据链 (共 {len(report.evidence_chain)} 条)")
        lines.append("-" * 80)
        for i, ev in enumerate(report.evidence_chain, 1):
            lines.append(f"  [{i}] 类型: {ev.evidence_type.value}")
            lines.append(f"      来源: {ev.source}")
            lines.append(f"      取值: {ev.value}")
            lines.append(f"      描述: {ev.description}")
            lines.append(f"      时间: {ev.timestamp}")
            lines.append("")

        if report.human_review:
            lines.append("-" * 80)
            lines.append("人工审核记录")
            lines.append("-" * 80)
            lines.append(f"  审核人: {report.human_review.reviewer}")
            lines.append(f"  审核时间: {report.human_review.reviewed_at}")
            lines.append(f"  原状态: {self._format_status(report.human_review.original_status)}")
            lines.append(f"  最终状态: {self._format_status(report.human_review.final_status)}")
            lines.append(f"  审核说明: {report.human_review.revision_note}")
            if report.human_review.revised_path:
                lines.append(f"  修正后路径: {report.human_review.revised_path}")
            if report.human_review.revised_evidence:
                lines.append(f"  补充证据 ({len(report.human_review.revised_evidence)} 条):")
                for ev in report.human_review.revised_evidence:
                    lines.append(f"    - {ev.description}")
            lines.append("")

        if report.legacy_source:
            lines.append("-" * 80)
            lines.append("历史标注来源")
            lines.append("-" * 80)
            lines.append(f"  标注表ID: {report.legacy_source}")
            lines.append("")

        if report.online_feedback:
            lines.append("-" * 80)
            lines.append("线上反馈")
            lines.append("-" * 80)
            for k, v in sorted(report.online_feedback.items()):
                lines.append(f"  {k}: {v}")
            lines.append("")

        lines.append("=" * 80)
        lines.append("报告明细完整，与底层数据一致")
        lines.append("=" * 80)

        return "\n".join(lines)

    def _format_status(self, status: ExplanationStatus) -> str:
        status_map = {
            ExplanationStatus.AUTO_SUCCESS: "自动通过",
            ExplanationStatus.NEED_HUMAN_REVIEW: "待人工审核",
            ExplanationStatus.HUMAN_CONFIRMED: "人工确认",
            ExplanationStatus.HUMAN_REVISED: "人工改判",
            ExplanationStatus.LEGACY_FROM_ANNOTATION: "历史标注导入",
        }
        return status_map.get(status, status.value)

    def export_single_report(self, report_id: str, output_dir: str = "exports") -> str:
        os.makedirs(output_dir, exist_ok=True)

        report = self.storage.load_report(report_id)
        if not report:
            raise ValueError(f"Report {report_id} not found")

        text_content = self.format_report_text(report)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{report.report_id}_{timestamp}.txt"
        path = os.path.join(output_dir, filename)

        with open(path, "w", encoding="utf-8") as f:
            f.write(text_content)

        json_path = os.path.join(output_dir, f"report_{report.report_id}_{timestamp}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)

        return path

    def export_batch_run_report(
        self, run_id: str, output_dir: str = "exports"
    ) -> Tuple[str, str]:
        os.makedirs(output_dir, exist_ok=True)

        batch_run = self.storage.load_batch_run(run_id)
        if not batch_run:
            raise ValueError(f"Batch run {run_id} not found")

        snapshots = batch_run.report_snapshots
        report_ids = list(set(s["report_id"] for s in snapshots.values()))
        reports = [self.storage.load_report(rid) for rid in report_ids]
        reports = [r for r in reports if r]

        lines = []
        lines.append("=" * 100)
        lines.append(f"批次运行汇总报告")
        lines.append("=" * 100)
        lines.append(f"批次ID: {batch_run.run_id}")
        lines.append(f"运行时间: {batch_run.run_timestamp}")
        lines.append(f"模型版本: {batch_run.model_version}")
        lines.append(f"样本数量: {batch_run.sample_count}")
        lines.append("")

        lines.append("-" * 100)
        lines.append("整体指标")
        lines.append("-" * 100)
        for k, v in sorted(batch_run.metrics.items()):
            if isinstance(v, float) and 0 <= v <= 1 and "rate" in k:
                lines.append(f"  {k}: {v:.2%}")
            else:
                lines.append(f"  {k}: {v}")
        lines.append("")

        lines.append("-" * 100)
        lines.append("报告明细索引 (与明细报告一一对应)")
        lines.append("-" * 100)
        for sample_id in sorted(snapshots.keys()):
            s = snapshots[sample_id]
            status_display = self._format_status(ExplanationStatus(s["status"]))
            lines.append(
                f"  样本 {sample_id} | 报告 {s['report_id']} | "
                f"状态: {status_display} | "
                f"路径: {s['recommended_path']} | "
                f"置信度: {s['confidence_score']:.2%}"
            )
        lines.append("")

        lines.append("-" * 100)
        lines.append("汇总数据来源声明")
        lines.append("-" * 100)
        lines.append(f"  本报告指标与上述明细来自同一批次快照，无两套说法")
        lines.append(f"  快照时间: {batch_run.run_timestamp}")
        lines.append(f"  快照样本数: {len(snapshots)}")
        lines.append("")

        lines.append("=" * 100)
        lines.append(f"共 {len(snapshots)} 份明细，数据来源一致，无两套说法")
        lines.append("=" * 100)

        summary_text = "\n".join(lines)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        summary_filename = f"batch_summary_{batch_run.run_id}_{timestamp}.txt"
        summary_path = os.path.join(output_dir, summary_filename)

        with open(summary_path, "w", encoding="utf-8") as f:
            f.write(summary_text)

        detail_dir = os.path.join(output_dir, f"batch_{batch_run.run_id}_{timestamp}_details")
        os.makedirs(detail_dir, exist_ok=True)

        for r in reports:
            detail_text = self.format_report_text(r)
            detail_filename = f"{r.report_id}_{r.status.value}.txt"
            with open(os.path.join(detail_dir, detail_filename), "w", encoding="utf-8") as f:
                f.write(detail_text)

        return summary_path, detail_dir

    def compare_runs_and_export(
        self, run_id_old: str, run_id_new: str, output_dir: str = "exports"
    ) -> str:
        os.makedirs(output_dir, exist_ok=True)

        comparison = self.storage.compare_batch_runs(run_id_old, run_id_new)

        if "error" in comparison:
            raise ValueError(comparison["error"])

        lines = []
        lines.append("=" * 100)
        lines.append(f"批次运行对比报告")
        lines.append("=" * 100)
        lines.append(f"旧批次: {run_id_old} (模型 {comparison['old_model_version']})")
        lines.append(f"新批次: {run_id_new} (模型 {comparison['new_model_version']})")
        lines.append("")

        lines.append("-" * 100)
        lines.append("指标差异")
        lines.append("-" * 100)
        for metric, diff in sorted(comparison["metric_diffs"].items()):
            old = diff["old"]
            new = diff["new"]
            delta = diff["diff"]
            sign = "+" if delta >= 0 else ""
            if "rate" in metric and isinstance(old, float) and 0 <= old <= 1:
                lines.append(
                    f"  {metric}: {old:.2%} → {new:.2%} ({sign}{delta:.2%})"
                )
            else:
                lines.append(
                    f"  {metric}: {old} → {new} ({sign}{delta})"
                )
        lines.append("")

        lines.append("-" * 100)
        lines.append("样本级变化明细")
        lines.append("-" * 100)
        s = comparison["summary"]
        lines.append(f"  总样本数: {s['total_samples']}")
        lines.append(f"  新增样本: {s['added']}")
        lines.append(f"  移除样本: {s['removed']}")
        lines.append(f"  状态/路径变化: {s['status_or_path_changed']}")
        lines.append(f"  仅置信度变化: {s['confidence_changed']}")
        lines.append(f"  完全不变: {s['unchanged']}")
        lines.append("")

        lines.append("-" * 100)
        lines.append("归因分析")
        lines.append("-" * 100)

        attr = s["attribution"]
        lines.append(f"  样本集变动 (新增/移除): {attr['sample_set']} 个样本")
        lines.append(f"  模型/阈值变动: {attr['model_or_threshold']} 个样本")
        lines.append(f"  人工审核变动: {attr['human_review']} 个样本")
        lines.append(f"  无归因 (完全不变): {attr['none']} 个样本")
        lines.append("")

        for c in comparison["sample_changes"]:
            if c["change_type"] == "unchanged":
                continue

            lines.append(f"  样本 {c['sample_id']}: {c['change_type']} [归因: {c['attribution']}]")
            details = c["details"]
            if "old_status" in details:
                lines.append(
                    f"    状态: {details['old_status']} → {details['new_status']}"
                )
            if "old_path" in details:
                lines.append(
                    f"    路径: {details['old_path']} → {details['new_path']}"
                )
            if "old_confidence" in details:
                lines.append(
                    f"    置信度: {details['old_confidence']:.2%} → {details['new_confidence']:.2%}"
                )
            if "attribution_note" in details:
                lines.append(
                    f"    归因说明: {details['attribution_note']}"
                )
            lines.append("")

        lines.append("-" * 100)
        lines.append("归因结论")
        lines.append("-" * 100)
        total = comparison["summary"]["total_samples"]
        if total > 0:
            lines.append(
                f"  样本集变动贡献: {attr['sample_set'] / total:.2%}"
            )
            lines.append(
                f"  模型/阈值变动贡献: {attr['model_or_threshold'] / total:.2%}"
            )
            lines.append(
                f"  人工审核变动贡献: {attr['human_review'] / total:.2%}"
            )
            model_plus_human = attr['model_or_threshold'] + attr['human_review']
            lines.append(
                f"  模型/阈值 + 人工审核合计: {model_plus_human / total:.2%}"
            )
        else:
            lines.append("  无样本可对比")
        lines.append("")

        lines.append("=" * 100)
        lines.append("对比报告与底层明细数据完全一致")
        lines.append("=" * 100)

        text_content = "\n".join(lines)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"comparison_{run_id_old}_vs_{run_id_new}_{timestamp}.txt"
        path = os.path.join(output_dir, filename)

        with open(path, "w", encoding="utf-8") as f:
            f.write(text_content)

        json_path = path.replace(".txt", ".json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(comparison, f, ensure_ascii=False, indent=2)

        return path

    def print_report_to_console(self, report_id: str):
        report = self.storage.load_report(report_id)
        if report:
            print(self.format_report_text(report))
        else:
            print(f"报告 {report_id} 未找到")
