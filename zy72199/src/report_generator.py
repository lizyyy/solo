from typing import List, Dict
from datetime import datetime
from pathlib import Path
import json
import logging

from .data_models import (
    ProcessedRecord,
    DataStatus,
    LabelType,
)
from .config import AppConfig
from .metrics import MetricsCalculator, VersionManager
from .review import ReviewManager

logger = logging.getLogger(__name__)


class ReportGenerator:
    def __init__(self, config: AppConfig, report_dir: str = "reports"):
        self.config = config
        self.report_dir = Path(report_dir)
        self.report_dir.mkdir(parents=True, exist_ok=True)
        self.metrics = MetricsCalculator()
        self.version_manager = VersionManager(report_dir)
        self.review_manager = ReviewManager(config)

    def generate(
        self,
        records: List[ProcessedRecord],
        data_stats: Dict = None,
        run_info: Dict = None,
    ) -> str:
        version = self.version_manager.get_next_version()
        timestamp = datetime.now()
        filename = self.version_manager.generate_report_filename()
        filepath = self.report_dir / filename

        all_metrics = self.metrics.calculate_all(records)
        review_checklist = self.review_manager.generate_review_checklist(records)

        sections = []

        sections.append(self._generate_header(version, timestamp, run_info))
        sections.append(self._generate_summary_section(all_metrics, data_stats))
        sections.append(self._generate_model_vs_human_section(records, all_metrics))
        sections.append(self._generate_decisions_section(records))
        sections.append(self._generate_review_section(records, review_checklist))
        sections.append(self._generate_special_cases_section(records))
        sections.append(self._generate_detailed_records_section(records))
        sections.append(self._generate_action_items_section(records, review_checklist))
        sections.append(self._generate_appendix_section(all_metrics, data_stats))

        full_report = "\n\n".join(sections)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(full_report)

        json_filename = filename.replace(".md", ".json")
        json_filepath = self.report_dir / json_filename
        self._save_json_data(records, all_metrics, data_stats, version, timestamp, json_filepath)

        logger.info(f"报告已生成: {filepath}")
        return str(filepath)

    def _generate_header(self, version: str, timestamp: datetime, run_info: Dict = None) -> str:
        lines = [
            "# 算法竞赛题解去重 - 分析报告",
            "",
            f"**报告版本**: {version}",
            f"**生成时间**: {timestamp.strftime('%Y-%m-%d %H:%M:%S')}",
            "",
        ]

        if run_info:
            lines.append("## 运行信息")
            lines.append("")
            for key, value in run_info.items():
                lines.append(f"- **{key}**: {value}")
            lines.append("")

        lines.append("> 本报告版本独立保存，旧版本报告不会被覆盖。如需查看历史报告，请联系管理员。")
        lines.append("")
        lines.append("---")

        return "\n".join(lines)

    def _generate_summary_section(self, metrics: Dict, data_stats: Dict = None) -> str:
        lines = [
            "## 📊 总体概览",
            "",
            "### 去重效果",
            "",
            f"- 原始评测记录数: **{metrics.get('original_evaluation_records', 0)}** 条",
            f"- 去重后样本数: **{metrics.get('total_processed_samples', 0)}** 条",
            f"- 合并重复记录: **{metrics.get('duplicates_merged', 0)}** 条",
            f"- 去重率: **{metrics.get('deduplication_rate', 0)}%**",
            "",
            "### 质量分布",
            "",
        ]

        status_dist = metrics.get('status_distribution', {})
        status_labels = {
            'kept': '✅ 正常保留',
            'duplicate': '🔄 已合并重复',
            'empty': '⚠️  空值样本',
            'boundary': '⚖️  边界案例',
            'conflict': '❌ 冲突案例',
        }

        for key, label in status_labels.items():
            count = status_dist.get(key, 0)
            lines.append(f"- {label}: **{count}** 条")

        lines.append("")
        lines.append("### 人工复核")
        lines.append("")
        lines.append(f"- 需要人工复核: **{metrics.get('samples_needing_review', 0)}** 条 ({metrics.get('review_rate', 0)}%)")
        lines.append(f"- 已有人工标注: **{metrics.get('samples_with_annotation', 0)}** 条")
        lines.append(f"- 已知冲突案例: **{metrics.get('samples_with_conflict_cases', 0)}** 条")
        lines.append("")

        if data_stats:
            lines.append("### 输入数据统计")
            lines.append("")
            for key, value in data_stats.items():
                if isinstance(value, dict):
                    lines.append(f"- **{key}**:")
                    for k, v in value.items():
                        lines.append(f"  - {k}: {v}")
                else:
                    lines.append(f"- **{key}**: {value}")
            lines.append("")

        lines.append("---")
        return "\n".join(lines)

    def _generate_model_vs_human_section(self, records: List[ProcessedRecord], metrics: Dict) -> str:
        lines = [
            "## 🤖 vs 👤 模型判断 vs 人工标注",
            "",
            "### 一致性分析",
            "",
            f"- 模型与人工标注一致: **{metrics.get('model_human_agreement_count', 0)}** 条",
            f"- 模型与人工标注不一致: **{metrics.get('model_human_disagreement_count', 0)}** 条",
            f"- 标注一致性率: **{metrics.get('model_human_agreement_rate', 0)}%**",
            f"- 人工修正覆盖: **{metrics.get('human_decisions_overridden', 0)}** 条",
            "",
            "### 标签分布对比",
            "",
            "| 标签 | 模型预测 | 人工标注 | 最终判定 |",
            "|------|----------|----------|----------|",
        ]

        model_labels = metrics.get('model_predicted_labels', {})
        human_labels = metrics.get('human_annotated_labels', {})
        final_labels = metrics.get('final_decisions', {})

        for label in ['accept', 'revise', 'reject', 'pending']:
            m = model_labels.get(label, 0)
            h = human_labels.get(label, 0)
            f = final_labels.get(label, 0)
            lines.append(f"| {label} | {m} | {h} | {f} |")

        lines.append("")
        lines.append("### 模型分数质量")
        lines.append("")
        lines.append(f"- 平均分数: **{metrics.get('avg_model_score', 0)}**")
        lines.append(f"- 最高分数: **{metrics.get('max_model_score', 0)}**")
        lines.append(f"- 最低分数: **{metrics.get('min_model_score', 0)}**")
        lines.append("")

        version_scores = metrics.get('avg_score_by_version', {})
        if version_scores:
            lines.append("### 各模型版本表现")
            lines.append("")
            lines.append("| 模型版本 | 样本数 | 平均分数 |")
            lines.append("|----------|--------|----------|")
            version_dist = metrics.get('model_version_distribution', {})
            for v, count in sorted(version_dist.items()):
                avg = version_scores.get(v, 0)
                lines.append(f"| {v} | {count} | {avg} |")
            lines.append("")

        lines.append("---")
        return "\n".join(lines)

    def _generate_decisions_section(self, records: List[ProcessedRecord]) -> str:
        lines = [
            "## 📋 判定详情",
            "",
        ]

        by_label = {}
        for pr in records:
            label = pr.get_final_label().value
            if label not in by_label:
                by_label[label] = []
            by_label[label].append(pr)

        label_headers = {
            'accept': ('✅ 模型判断 - 接受 (Accept)', '模型输出质量良好，可直接使用'),
            'revise': ('⚠️  人工修正 - 需要修改 (Revise)', '模型输出基本正确，但需要补充或调整'),
            'reject': ('❌ 人工修正 - 拒绝 (Reject)', '模型输出质量较差，需要重新生成'),
            'pending': ('⏳ 仍需复核 (Pending)', '尚未有明确标注或需要进一步确认'),
        }

        for label, header_info in label_headers.items():
            if label not in by_label:
                continue

            header, desc = header_info
            lines.append(f"### {header}")
            lines.append("")
            lines.append(f"> {desc}")
            lines.append("")
            lines.append("| 样本ID | 题目ID | 模型版本 | 模型分数 | 状态 | 重复数 | 来源时间 | 判定依据 |")
            lines.append("|--------|--------|----------|----------|------|--------|----------|----------|")

            for pr in by_label[label]:
                dup_count = len(pr.duplicates)
                source_time = pr.primary_record.timestamp.strftime('%Y-%m-%d %H:%M')
                status_icon = self._get_status_icon(pr.status.value)
                reason = self._get_decision_reason(pr)

                lines.append(
                    f"| [{pr.primary_record.sample_id}](#sample-{pr.primary_record.sample_id}) "
                    f"| {pr.primary_record.problem_id} "
                    f"| {pr.primary_record.model_version} "
                    f"| {pr.primary_record.score:.2f} "
                    f"| {status_icon} {pr.status.value} "
                    f"| {dup_count} "
                    f"| {source_time} "
                    f"| {reason} |"
                )

            lines.append("")

        lines.append("---")
        return "\n".join(lines)

    def _generate_review_section(self, records: List[ProcessedRecord], checklist: List[dict]) -> str:
        lines = [
            "## 👀 人工复核清单",
            "",
        ]

        if not checklist:
            lines.append("> ✅ 当前没有需要复核的样本，所有判定均已确认。")
            lines.append("")
            lines.append("---")
            return "\n".join(lines)

        lines.append(f"> ⚠️  共有 **{len(checklist)}** 条样本需要人工复核。请按顺序处理，处理完成后标记决策。")
        lines.append("")

        for idx, item in enumerate(checklist, 1):
            lines.append(f"### {idx}. 样本 {item['sample_id']} (题目 {item['problem_id']})")
            lines.append("")
            lines.append(f"- **模型版本**: {item['model_version']}")
            lines.append(f"- **模型分数**: {item['model_score']:.2f}")
            lines.append(f"- **当前状态**: {item['status']}")
            lines.append(f"- **原标注**: {item['original_annotation']}")
            lines.append(f"- **当前判定**: {item['current_decision']}")
            lines.append(f"- **合并重复数**: {item['duplicate_count']}")
            lines.append(f"- **处理时间**: {item['processing_time']}")
            lines.append("")
            lines.append(f"**复核原因**: {item['review_reason']}")
            lines.append("")
            lines.append(f"**模型输出预览**: {item['model_output_preview']}")
            lines.append("")
            lines.append(f"**来源追踪**:")
            for trace in item['source_trace']:
                lines.append(f"- {trace}")
            lines.append("")
            lines.append(item['action_suggestion'])
            lines.append("")
            lines.append("**可选决策**:")
            for d in item['available_decisions']:
                lines.append(f"- [ ] {d}")
            lines.append("")

        lines.append("---")
        return "\n".join(lines)

    def _generate_special_cases_section(self, records: List[ProcessedRecord]) -> str:
        lines = [
            "## 🔍 特殊案例说明",
            "",
        ]

        empty_records = self.review_manager.get_empty_records(records)
        boundary_records = self.review_manager.get_boundary_records(records)
        conflict_records = self.review_manager.get_conflict_records(records)

        if empty_records:
            lines.append("### ⚠️  空值样本")
            lines.append("")
            lines.append(f"共 **{len(empty_records)}** 条样本模型输出为空或分数为0。")
            lines.append("")
            lines.append("| 样本ID | 模型版本 | 时间 | 建议处理方式 |")
            lines.append("|--------|----------|------|--------------|")
            for pr in empty_records:
                t = pr.primary_record.timestamp.strftime('%Y-%m-%d %H:%M')
                suggestion = "检查模型是否异常，或重新提交评测"
                lines.append(f"| {pr.primary_record.sample_id} | {pr.primary_record.model_version} | {t} | {suggestion} |")
            lines.append("")

        if boundary_records:
            lines.append("### ⚖️  边界案例 (分数接近阈值)")
            lines.append("")
            lines.append(f"共 **{len(boundary_records)}** 条样本模型分数处于0.6-0.8区间，建议仔细复核。")
            lines.append("")
            lines.append("| 样本ID | 模型版本 | 分数 | 原标注 | 建议处理方式 |")
            lines.append("|--------|----------|------|--------|--------------|")
            for pr in boundary_records:
                ann = pr.annotation.human_label.value if pr.annotation else "无"
                suggestion = "仔细阅读输出内容，确认是否达到可用标准"
                lines.append(f"| {pr.primary_record.sample_id} | {pr.primary_record.model_version} | {pr.primary_record.score:.2f} | {ann} | {suggestion} |")
            lines.append("")

        if conflict_records:
            lines.append("### ❌ 已知冲突案例")
            lines.append("")
            lines.append(f"共 **{len(conflict_records)}** 条样本存在已知冲突。")
            lines.append("")
            lines.append("| 样本ID | 案例ID | 严重程度 | 冲突描述 | 预期处理 |")
            lines.append("|--------|--------|----------|----------|----------|")
            for pr in conflict_records:
                if pr.conflict_case:
                    lines.append(
                        f"| {pr.primary_record.sample_id} "
                        f"| {pr.conflict_case.case_id} "
                        f"| {pr.conflict_case.severity} "
                        f"| {pr.conflict_case.description[:50]}... "
                        f"| {pr.conflict_case.expected_action} |"
                    )
            lines.append("")

        if not any([empty_records, boundary_records, conflict_records]):
            lines.append("> ✅ 当前没有特殊案例需要处理。")
            lines.append("")

        lines.append("---")
        return "\n".join(lines)

    def _generate_detailed_records_section(self, records: List[ProcessedRecord]) -> str:
        lines = [
            "## 📝 完整记录明细",
            "",
        ]

        for pr in records:
            sample_id = pr.primary_record.sample_id
            lines.append(f"### <a id=\"sample-{sample_id}\"></a>样本 {sample_id}")
            lines.append("")

            lines.append("#### 基本信息")
            lines.append("")
            lines.append(f"- **题目ID**: {pr.primary_record.problem_id}")
            lines.append(f"- **模型版本**: {pr.primary_record.model_version}")
            lines.append(f"- **模型分数**: {pr.primary_record.score}")
            lines.append(f"- **评测时间**: {pr.primary_record.timestamp.isoformat()}")
            lines.append(f"- **处理状态**: {pr.status.value}")
            lines.append(f"- **处理时间**: {pr.processed_at.isoformat()}")
            lines.append("")

            lines.append("#### 判定结果")
            lines.append("")
            final_label = pr.get_final_label().value
            lines.append(f"- **最终判定**: **{final_label}**")
            if pr.human_decision_override:
                lines.append(f"- ⚠️  **人工覆盖**: 原标注为 {pr.annotation.human_label.value if pr.annotation else '无'}，已被人工修改为 {final_label}")
            lines.append(f"- **处理理由**: {pr.processing_reason}")
            lines.append("")

            if self.config.report.include_raw_sources:
                lines.append("#### 模型输出 (原始)")
                lines.append("")
                lines.append("```")
                lines.append(pr.primary_record.model_output or "(空)")
                lines.append("```")
                lines.append("")

            if pr.duplicates:
                lines.append("#### 合并的重复记录")
                lines.append("")
                lines.append("| 记录ID | 模型版本 | 分数 | 相似度 | 时间 |")
                lines.append("|--------|----------|------|--------|------|")
                for dup in pr.duplicates:
                    sim = pr.similarity_scores.get(dup.record_id, "-")
                    t = dup.timestamp.strftime('%Y-%m-%d %H:%M')
                    lines.append(f"| {dup.record_id} | {dup.model_version} | {dup.score:.2f} | {sim} | {t} |")
                lines.append("")

            if pr.annotation:
                lines.append("#### 人工标注信息")
                lines.append("")
                lines.append(f"- **标注人**: {pr.annotation.annotator}")
                lines.append(f"- **标注时间**: {pr.annotation.annotation_time.isoformat()}")
                lines.append(f"- **标注标签**: {pr.annotation.human_label.value}")
                lines.append(f"- **置信度**: {pr.annotation.confidence}")
                if pr.annotation.notes:
                    lines.append(f"- **标注备注**: {pr.annotation.notes}")
                lines.append("")

            if pr.review_notes:
                lines.append("#### 复核备注")
                lines.append("")
                lines.append(f"> {pr.review_notes}")
                lines.append("")

            lines.append("#### 来源追踪")
            lines.append("")
            for trace in pr.get_source_trace():
                lines.append(f"- {trace}")
            lines.append("")

            lines.append("---")

        return "\n".join(lines)

    def _generate_action_items_section(self, records: List[ProcessedRecord], checklist: List[dict]) -> str:
        lines = [
            "## 📌 处理建议与待办事项",
            "",
        ]

        empty_count = len(self.review_manager.get_empty_records(records))
        boundary_count = len(self.review_manager.get_boundary_records(records))
        conflict_count = len(self.review_manager.get_conflict_records(records))
        review_count = len(checklist)

        lines.append("### 给业务同事的处理提醒")
        lines.append("")
        lines.append("#### 🔴 高优先级")
        lines.append("")

        if empty_count > 0:
            lines.append(f"- [ ] **{empty_count} 条空值样本**：请检查是否为模型异常。如果是模型bug，请反馈给算法工程师小乔；如果是输入问题，请重新提交评测。")

        if conflict_count > 0:
            lines.append(f"- [ ] **{conflict_count} 条冲突案例**：请参考特殊案例章节的说明，按照预期处理方式执行。如有疑问请咨询标注人。")

        if review_count > 0:
            lines.append(f"- [ ] **{review_count} 条待复核样本**：请按照「人工复核清单」顺序处理，每条样本都给出了明确的操作建议。")

        lines.append("")
        lines.append("#### 🟡 中优先级")
        lines.append("")

        if boundary_count > 0:
            lines.append(f"- [ ] **{boundary_count} 条边界案例**：模型分数在0.6-0.8之间，建议结合实际业务场景判断是否可用。如不确定可标记为revise后让模型重新生成。")

        lines.append("")
        lines.append("#### 🟢 低优先级")
        lines.append("")
        lines.append("- [ ] **确认重复记录合并策略**：默认保留最高分/最新版本，如需调整请在复核时人工指定保留的记录。")
        lines.append("- [ ] **关注模型版本差异**：不同版本的模型输出可能有差异，可在报告末尾查看各版本平均分对比。")
        lines.append("")

        lines.append("### 给算法团队的建议")
        lines.append("")
        lines.append(f"- 空值样本数: {empty_count}，建议检查推理流程是否有异常中断")
        lines.append(f"- 边界案例数: {boundary_count}，可考虑调整模型决策阈值或增强边界样本的训练")
        avg_score = self.metrics.calculate_all(records).get('avg_model_score', 0)
        lines.append(f"- 模型平均分数: {avg_score}，整体质量{'良好' if avg_score >= 0.8 else '一般'}")
        lines.append("")

        lines.append("### 交接提示")
        lines.append("")
        lines.append("> **重要**：本报告每条记录都保留了完整的来源追踪信息，包括原始评测时间、模型版本、记录ID。后续接手的同事可在「完整记录明细」章节查看每条样本的完整历史，无需再询问原始标注人。")
        lines.append("")
        lines.append("> 如需追溯某条记录为什么这么判定，请查看该样本下的「处理理由」和「来源追踪」部分。")
        lines.append("")

        lines.append("---")
        return "\n".join(lines)

    def _generate_appendix_section(self, metrics: Dict, data_stats: Dict = None) -> str:
        lines = [
            "## 📎 附录 - 完整指标",
            "",
            "### 去重相关",
            "",
        ]

        dedup_fields = [
            ('duplicate_groups_found', '发现的重复组数'),
            ('avg_similarity_score', '平均相似度分数'),
            ('min_similarity_score', '最低相似度分数'),
            ('max_similarity_score', '最高相似度分数'),
        ]

        for key, label in dedup_fields:
            lines.append(f"- **{label}**: {metrics.get(key, 0)}")

        lines.append("")
        lines.append("### 阈值配置 (本次使用)")
        lines.append("")
        cfg = self.config.deduplication
        lines.append(f"- 文本相似度阈值: {cfg.text_similarity_threshold}")
        lines.append(f"- 分数差阈值: {cfg.score_diff_threshold}")
        lines.append(f"- 时间窗口: {cfg.time_window_hours} 小时")
        lines.append(f"- 考虑模型版本: {'是' if cfg.consider_model_version else '否'}")
        lines.append(f"- 考虑题目ID: {'是' if cfg.consider_problem_id else '否'}")
        lines.append("")

        lines.append("### 历史报告列表")
        lines.append("")
        existing = self.version_manager.list_existing_reports()
        if existing:
            lines.append("| 报告文件名 | 创建时间 | 大小 |")
            lines.append("|------------|----------|------|")
            for rep in existing:
                lines.append(f"| {rep['filename']} | {rep['created_time']} | {rep['size_bytes']} bytes |")
        else:
            lines.append("> 暂无历史报告，这是第一份报告。")

        return "\n".join(lines)

    def _get_status_icon(self, status: str) -> str:
        icons = {
            'kept': '✅',
            'duplicate': '🔄',
            'empty': '⚠️',
            'boundary': '⚖️',
            'conflict': '❌',
        }
        return icons.get(status, '📝')

    def _get_decision_reason(self, pr: ProcessedRecord) -> str:
        if pr.human_decision_override:
            return f"人工决策: {pr.human_decision_override.value}"
        if pr.annotation:
            return f"人工标注: {pr.annotation.human_label.value}"
        if pr.primary_record.score >= 0.8:
            return "模型高分 (≥0.8)"
        elif pr.primary_record.score >= 0.6:
            return "模型中分 (0.6-0.8)"
        else:
            return "模型低分 (<0.6)"

    def _save_json_data(
        self,
        records: List[ProcessedRecord],
        metrics: Dict,
        data_stats: Dict,
        version: str,
        timestamp: datetime,
        filepath: Path,
    ):
        data = {
            "report_version": version,
            "generated_at": timestamp.isoformat(),
            "metrics": metrics,
            "data_stats": data_stats,
            "threshold_config": {
                "text_similarity_threshold": self.config.deduplication.text_similarity_threshold,
                "score_diff_threshold": self.config.deduplication.score_diff_threshold,
                "time_window_hours": self.config.deduplication.time_window_hours,
            },
            "records": [],
        }

        for pr in records:
            rec_data = {
                "sample_id": pr.primary_record.sample_id,
                "problem_id": pr.primary_record.problem_id,
                "model_version": pr.primary_record.model_version,
                "model_score": pr.primary_record.score,
                "model_output": pr.primary_record.model_output,
                "timestamp": pr.primary_record.timestamp.isoformat(),
                "record_id": pr.primary_record.record_id,
                "status": pr.status.value,
                "final_label": pr.get_final_label().value,
                "processing_reason": pr.processing_reason,
                "processed_at": pr.processed_at.isoformat(),
                "needs_review": pr.needs_review,
                "review_notes": pr.review_notes,
                "duplicates": [
                    {
                        "record_id": d.record_id,
                        "model_version": d.model_version,
                        "score": d.score,
                        "timestamp": d.timestamp.isoformat(),
                        "similarity": pr.similarity_scores.get(d.record_id, None),
                    }
                    for d in pr.duplicates
                ],
                "annotation": {
                    "label": pr.annotation.human_label.value if pr.annotation else None,
                    "annotator": pr.annotation.annotator if pr.annotation else None,
                    "notes": pr.annotation.notes if pr.annotation else None,
                } if pr.annotation else None,
                "human_override": pr.human_decision_override.value if pr.human_decision_override else None,
                "source_trace": pr.get_source_trace(),
            }
            data["records"].append(rec_data)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
