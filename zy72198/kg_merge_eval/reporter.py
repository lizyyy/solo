import json
import csv
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
from .models import MergedRecord


class ReportGenerator:
    def __init__(self, output_dir: Optional[str] = None):
        self.output_dir = Path(output_dir) if output_dir else Path.cwd() / "outputs"
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_full_report(
        self,
        records: Dict[str, MergedRecord],
        metrics: Dict,
        conflict_summary: Dict,
        strata_summary: Dict,
        run_name: str = "eval_run",
        comparison_data: Optional[Dict] = None,
    ) -> Dict[str, str]:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = f"{run_name}_{timestamp}"

        files = {}

        files["summary_report"] = self._generate_summary_report(
            records, metrics, conflict_summary, strata_summary, base_name, comparison_data
        )

        files["details_csv"] = self._generate_details_csv(records, base_name)

        files["conflict_report"] = self._generate_conflict_report(
            records, conflict_summary, base_name
        )

        files["trace_data"] = self._generate_trace_data(records, base_name)

        files["all_data_json"] = self._generate_full_json(
            records, metrics, conflict_summary, strata_summary, base_name
        )

        return files

    def _generate_summary_report(
        self,
        records: Dict[str, MergedRecord],
        metrics: Dict,
        conflict_summary: Dict,
        strata_summary: Dict,
        base_name: str,
        comparison_data: Optional[Dict] = None,
    ) -> str:
        file_path = self.output_dir / f"{base_name}_summary.md"
        overall = metrics.get("overall", {})

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(f"# 知识图谱实体合并 - 评测报告\n\n")
            f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

            f.write("## 整体概览\n\n")
            f.write(f"- 评测样本总数: {len(records)}\n")
            f.write(f"- 有效样本数: {overall.get('sample_count', 0)}\n\n")

            f.write("### 核心指标\n\n")
            f.write("| 指标 | 数值 |\n")
            f.write("|------|------|\n")
            f.write(f"| 准确率 (Accuracy) | {overall.get('accuracy', 0):.2%} |\n")
            f.write(f"| 精确率 (Precision) | {overall.get('precision', 0):.2%} |\n")
            f.write(f"| 召回率 (Recall) | {overall.get('recall', 0):.2%} |\n")
            f.write(f"| F1分数 | {overall.get('f1_score', 0):.2%} |\n")
            f.write(f"| 平均置信度 | {overall.get('avg_confidence', 0):.2f} |\n\n")

            f.write("### 详细统计\n\n")
            f.write(
                f"- 真阳性 (TP - 正确合并): {overall.get('true_positives', 0)}\n"
            )
            f.write(
                f"- 真阴性 (TN - 正确不合并): {overall.get('true_negatives', 0)}\n"
            )
            f.write(
                f"- 假阳性 (FP - 误合并): {overall.get('false_positives', 0)}\n"
            )
            f.write(
                f"- 假阴性 (FN - 漏合并): {overall.get('false_negatives', 0)}\n\n"
            )

            f.write("## ⚠️  冲突与异常检测\n\n")
            f.write(
                f"**总冲突数: {conflict_summary.get('total_conflicts', 0)}**\n\n"
            )

            sev = conflict_summary.get("conflicts_by_severity", {})
            if sev.get("critical", 0) > 0:
                f.write(f"🔴 **严重问题 (Critical): {sev.get('critical', 0)} 个**\n")
            if sev.get("high", 0) > 0:
                f.write(f"🟠 **高优先级 (High): {sev.get('high', 0)} 个**\n")
            if sev.get("medium", 0) > 0:
                f.write(f"🟡 **中等 (Medium): {sev.get('medium', 0)} 个**\n")
            if sev.get("low", 0) > 0:
                f.write(f"🟢 **低优先级 (Low): {sev.get('low', 0)} 个**\n")
            f.write("\n")

            f.write("| 冲突类型 | 数量 | 说明 |\n")
            f.write("|----------|------|------|\n")
            f.write(
                f"| 标签冲突 | {conflict_summary.get('label_conflicts', 0)} | 模型/人工与标注不一致 |\n"
            )
            f.write(
                f"| 样本泄漏 | {conflict_summary.get('sample_leaks', 0)} | 实体对重复出现 |\n"
            )
            f.write(
                f"| 数据缺失 | {conflict_summary.get('missing_data', 0)} | 字段或结果缺失 |\n"
            )
            f.write(
                f"| 重复项 | {conflict_summary.get('duplicates', 0)} | 两实体完全相同 |\n"
            )
            f.write(
                f"| 边界案例 | {conflict_summary.get('boundary_cases', 0)} | 置信度临界或有修正 |\n\n"
            )

            f.write("## 📊 分层抽样结果\n\n")
            f.write("| 分层 | 样本数 |\n")
            f.write("|------|--------|\n")

            key_strata = [
                "ground_truth_merge",
                "ground_truth_not_merge",
                "high_confidence",
                "medium_confidence",
                "low_confidence",
                "human_corrected",
                "has_feedback",
                "has_conflicts",
            ]

            for key in key_strata:
                count = strata_summary.get(key, 0)
                if count > 0:
                    display_name = self._get_stratum_display_name(key)
                    f.write(f"| {display_name} | {count} |\n")
            f.write("\n")

            if comparison_data:
                f.write("## 🔄 与上次运行对比\n\n")
                metric_comp = comparison_data.get("metric_changes", {})
                for field, change in metric_comp.items():
                    if field in ["accuracy", "precision", "recall", "f1_score"]:
                        old = change.get("old", 0)
                        new = change.get("new", 0)
                        diff = change.get("difference", 0)
                        arrow = "↑" if diff > 0 else "↓" if diff < 0 else "→"
                        f.write(
                            f"- {self._get_metric_display_name(field)}: {old:.2%} → {new:.2%} {arrow} {abs(diff)*100:.2f}pp\n"
                        )

                record_comp = comparison_data.get("record_comparison", {})
                if record_comp.get("total_changes", 0) > 0:
                    f.write(f"\n样本变化: {record_comp.get('total_changes', 0)} 个\n")
                    for change_type, count in record_comp.get(
                        "changes_by_type", {}
                    ).items():
                        f.write(f"  - {self._get_change_type_name(change_type)}: {count}\n")
                f.write("\n")

            f.write("## 💡 给老唐的交接提示\n\n")
            f.write("### 需要重点关注的问题:\n\n")

            if conflict_summary.get("label_conflicts", 0) > 0:
                f.write("- [ ] 检查标签冲突样本，确认是标注问题还是模型问题\n")

            if conflict_summary.get("sample_leaks", 0) > 0:
                f.write("- [ ] 检查样本泄漏，避免同一实体对反复出现\n")

            if conflict_summary.get("boundary_cases", 0) > 0:
                f.write(
                    f"- [ ] 边界案例有 {conflict_summary.get('boundary_cases', 0)} 个，建议人工复核\n"
                )

            f.write("\n### 每条记录都能追溯:\n")
            f.write("- 查看 details.csv 的 source_* 列了解样本来源\n")
            f.write("- trace_data.json 包含完整的决策变更轨迹\n")
            f.write("- 人工修正记录在 human_correction_* 列\n\n")

            f.write("## 📁 生成的文件\n\n")
            f.write("- `details.csv`: 完整明细，每条记录可追溯\n")
            f.write("- `conflict_report.md`: 冲突详情，按严重程度排序\n")
            f.write("- `trace_data.json`: 每条记录的完整决策轨迹\n")
            f.write("- `all_data.json`: 完整数据备份\n")

        return str(file_path)

    def _generate_details_csv(
        self, records: Dict[str, MergedRecord], base_name: str
    ) -> str:
        file_path = self.output_dir / f"{base_name}_details.csv"

        with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "sample_id",
                    "entity_a_id",
                    "entity_a_type",
                    "entity_a_value",
                    "entity_b_id",
                    "entity_b_type",
                    "entity_b_value",
                    "ground_truth",
                    "model_decision",
                    "model_confidence",
                    "model_version",
                    "has_human_correction",
                    "corrected_decision",
                    "corrected_by",
                    "correction_reason",
                    "final_decision",
                    "conflict_count",
                    "conflict_types",
                    "source_system",
                    "source_batch",
                    "created_at",
                    "feedback_count",
                    "has_unresolved_feedback",
                    "is_boundary",
                ]
            )

            for record in records.values():
                s = record.sample
                m = record.model_output
                h = record.human_correction
                fb = record.feedback

                conflict_types = ";".join(
                    [c.conflict_type.value for c in record.conflicts]
                )

                writer.writerow(
                    [
                        s.sample_id,
                        s.entity_a.entity_id,
                        s.entity_a.entity_type.value,
                        s.entity_a.entity_value,
                        s.entity_b.entity_id,
                        s.entity_b.entity_type.value,
                        s.entity_b.entity_value,
                        s.ground_truth.value if s.ground_truth else "",
                        m.decision.value if m else "",
                        f"{m.confidence:.4f}" if m else "",
                        m.model_version if m else "",
                        "是" if h else "否",
                        h.corrected_decision.value if h else "",
                        h.corrected_by if h else "",
                        h.correction_reason if h else "",
                        record.final_decision.value if record.final_decision else "",
                        len(record.conflicts),
                        conflict_types,
                        s.source.source_system if s.source else "",
                        s.source.source_batch if s.source else "",
                        s.created_at.isoformat(),
                        len(fb),
                        "是" if any(not f.resolved for f in fb) else "否",
                        "是" if s.is_boundary else "否",
                    ]
                )

        return str(file_path)

    def _generate_conflict_report(
        self,
        records: Dict[str, MergedRecord],
        conflict_summary: Dict,
        base_name: str,
    ) -> str:
        file_path = self.output_dir / f"{base_name}_conflicts.md"

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(f"# 冲突与异常详情\n\n")
            f.write("本报告列出所有需要人工关注的问题记录，按严重程度排序。\n\n")

            severity_order = ["critical", "high", "medium", "low"]
            severity_names = {
                "critical": "🔴 严重",
                "high": "🟠 高",
                "medium": "🟡 中",
                "low": "🟢 低",
            }

            for severity in severity_order:
                samples_with_sev = [
                    r
                    for r in records.values()
                    if any(c.severity == severity for c in r.conflicts)
                ]
                if not samples_with_sev:
                    continue

                f.write(f"## {severity_names[severity]} 问题\n\n")
                f.write(f"共 {len(samples_with_sev)} 条记录\n\n")

                for record in samples_with_sev:
                    sev_conflicts = [
                        c for c in record.conflicts if c.severity == severity
                    ]
                    f.write(f"### 样本 {record.sample.sample_id}\n\n")

                    for conflict in sev_conflicts:
                        f.write(
                            f"- **{self._get_conflict_type_name(conflict.conflict_type.value)}**: {conflict.message}\n"
                        )

                    f.write(
                        f"\n实体A: `{record.sample.entity_a.entity_value}` ({record.sample.entity_a.entity_type.value})\n"
                    )
                    f.write(
                        f"实体B: `{record.sample.entity_b.entity_value}` ({record.sample.entity_b.entity_type.value})\n"
                    )

                    if record.model_output:
                        f.write(
                            f"模型决策: {record.model_output.decision.value} (置信度: {record.model_output.confidence:.2f})\n"
                        )

                    if record.human_correction:
                        f.write(
                            f"人工修正: {record.human_correction.corrected_decision.value} (修正人: {record.human_correction.corrected_by})\n"
                        )

                    f.write("\n---\n\n")

        return str(file_path)

    def _generate_trace_data(
        self, records: Dict[str, MergedRecord], base_name: str
    ) -> str:
        file_path = self.output_dir / f"{base_name}_trace.json"

        traces = {}
        for sample_id, record in records.items():
            traces[sample_id] = record.get_trace()

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(traces, f, indent=2, ensure_ascii=False)

        return str(file_path)

    def _generate_full_json(
        self,
        records: Dict[str, MergedRecord],
        metrics: Dict,
        conflict_summary: Dict,
        strata_summary: Dict,
        base_name: str,
    ) -> str:
        file_path = self.output_dir / f"{base_name}_full_data.json"

        data = {
            "generated_at": datetime.now().isoformat(),
            "metrics": metrics,
            "conflict_summary": conflict_summary,
            "strata_summary": strata_summary,
            "records": {
                sample_id: record.to_dict()
                for sample_id, record in records.items()
            },
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return str(file_path)

    def _get_stratum_display_name(self, key: str) -> str:
        names = {
            "ground_truth_merge": "标注-合并",
            "ground_truth_not_merge": "标注-不合并",
            "high_confidence": "高置信度(≥0.9)",
            "medium_confidence": "中等置信度(0.7-0.9)",
            "low_confidence": "低置信度(0.5-0.7)",
            "very_low_confidence": "极低置信度(<0.5)",
            "human_corrected": "有人工修正",
            "decision_changed": "人工修正改变了决策",
            "has_feedback": "有线上反馈",
            "unresolved_feedback": "有未解决的反馈",
            "has_conflicts": "存在冲突",
        }
        return names.get(key, key)

    def _get_metric_display_name(self, field: str) -> str:
        names = {
            "accuracy": "准确率",
            "precision": "精确率",
            "recall": "召回率",
            "f1_score": "F1分数",
            "avg_confidence": "平均置信度",
        }
        return names.get(field, field)

    def _get_change_type_name(self, change_type: str) -> str:
        names = {
            "new_sample": "新增样本",
            "removed_sample": "移除样本",
            "modified": "修改样本",
        }
        return names.get(change_type, change_type)

    def _get_conflict_type_name(self, conflict_type: str) -> str:
        names = {
            "label_conflict": "标签冲突",
            "sample_leak": "样本泄漏",
            "missing_data": "数据缺失",
            "duplicate": "重复项",
            "boundary_case": "边界案例",
        }
        return names.get(conflict_type, conflict_type)
