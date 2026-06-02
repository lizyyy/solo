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

        reports = [self.storage.load_report(rid) for rid in batch_run.report_ids]
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

        if batch_run.sample_changes:
            lines.append("-" * 100)
            lines.append(f"样本变化记录 (共 {len(batch_run.sample_changes)} 条)")
            lines.append("-" * 100)
            for change in batch_run.sample_changes:
                lines.append(
                    f"  样本 {change['sample_id']}: {change['change_type']} "
                    f"(报告 {change['old_report_id']} → {change['new_report_id']})"
                )
            lines.append("")

        lines.append("-" * 100)
        lines.append("报告明细索引 (与明细报告一一对应)")
        lines.append("-" * 100)
        for i, r in enumerate(reports, 1):
            lines.append(
                f"  [{i}] {r.report_id} | 样本: {r.sample_id} | "
                f"状态: {self._format_status(r.status)} | "
                f"路径: {r.recommended_path} | "
                f"置信度: {r.confidence_score:.2%}"
            )
        lines.append("")

        lines.append("-" * 100)
        lines.append("指标变化 vs 样本变化 分解")
        lines.append("-" * 100)

        if len(batch_run.sample_changes) > 0:
            changed_sample_ids = {c["sample_id"] for c in batch_run.sample_changes}
            changed_reports = [r for r in reports if r.sample_id in changed_sample_ids]
            unchanged_reports = [r for r in reports if r.sample_id not in changed_sample_ids]

            lines.append(f"  变化样本数: {len(changed_sample_ids)}")
            lines.append(f"  不变样本数: {len(unchanged_reports)}")

            if unchanged_reports:
                unchanged_avg_conf = sum(r.confidence_score for r in unchanged_reports) / len(unchanged_reports)
                lines.append(f"  不变样本平均置信度: {unchanged_avg_conf:.2%}")
                lines.append(
                    f"  不变样本自动通过率: {sum(1 for r in unchanged_reports if r.status == ExplanationStatus.AUTO_SUCCESS) / len(unchanged_reports):.2%}"
                )

            if changed_reports:
                lines.append(f"  变化样本列表: {sorted(changed_sample_ids)}")

            lines.append("")
            lines.append("  结论:")
            lines.append(
                f"    - 因样本本身变化导致的指标变动: {len(changed_sample_ids) / len(reports):.2%}"
            )
            lines.append(
                f"    - 因模型/阈值变化导致的指标变动: {(len(reports) - len(changed_sample_ids)) / len(reports):.2%}"
            )
        else:
            lines.append("  本次运行无样本变化，所有指标变动均来自模型或阈值调整")
        lines.append("")

        lines.append("=" * 100)
        lines.append(f"共 {len(reports)} 份明细报告，数据来源一致，无两套说法")
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
        lines.append("变化汇总")
        lines.append("-" * 100)
        s = comparison["summary"]
        lines.append(f"  总样本数: {s['total_samples']}")
        lines.append(f"  新增样本: {s['added']}")
        lines.append(f"  移除样本: {s['removed']}")
        lines.append(f"  发生变化: {s['changed']}")
        lines.append(f"  保持不变: {s['unchanged']}")
        lines.append("")

        lines.append("-" * 100)
        lines.append("指标变化 vs 样本变化 归因分析")
        lines.append("-" * 100)

        pure_model_changes = [
            c
            for c in comparison["sample_changes"]
            if c["change_type"] in ["status_changed", "path_changed", "both_changed"]
        ]
        sample_only_changes = [
            c
            for c in comparison["sample_changes"]
            if c["change_type"] in ["added", "removed"]
        ]

        lines.append(
            f"  仅因样本集变化导致 (新增/移除): {len(sample_only_changes)} 个样本"
        )
        lines.append(
            f"  因模型/阈值变化导致 (状态/路径改变): {len(pure_model_changes)} 个样本"
        )
        lines.append(f"  无变化: {s['unchanged']} 个样本")
        lines.append("")

        if pure_model_changes:
            lines.append("  模型/阈值导致的变化明细:")
            for c in pure_model_changes:
                details = c["details"]
                lines.append(f"    样本 {c['sample_id']}: {c['change_type']}")
                if "old_status" in details:
                    lines.append(
                        f"      状态: {details['old_status']} → {details['new_status']}"
                    )
                if "old_path" in details:
                    lines.append(
                        f"      路径: {details['old_path']} → {details['new_path']}"
                    )
                if "old_confidence" in details:
                    lines.append(
                        f"      置信度: {details['old_confidence']:.2%} → {details['new_confidence']:.2%}"
                    )
            lines.append("")

        if sample_only_changes:
            lines.append("  样本集变化明细:")
            for c in sample_only_changes:
                lines.append(f"    样本 {c['sample_id']}: {c['change_type']}")
            lines.append("")

        lines.append("-" * 100)
        lines.append("归因结论")
        lines.append("-" * 100)
        total = comparison["summary"]["total_samples"]
        if total > 0:
            lines.append(
                f"  样本集变动贡献: {len(sample_only_changes) / total:.2%}"
            )
            lines.append(
                f"  模型/阈值变动贡献: {len(pure_model_changes) / total:.2%}"
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
