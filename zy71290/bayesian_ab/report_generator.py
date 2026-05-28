"""报告生成器 - JSON和Markdown格式导出"""

import json
from typing import List
from datetime import datetime

from .data_models import (
    ExperimentReport,
    RiskLevel,
    StoppingReason,
)


class ReportGenerator:
    """报告生成器
    
    支持导出为：
    1. JSON格式 - 完整结构化数据，便于复算
    2. Markdown格式 - 人类可读的试验报告
    """

    def to_json(self, report: ExperimentReport, pretty: bool = True) -> str:
        """导出为JSON格式"""
        indent = 2 if pretty else None
        return json.dumps(report.to_dict(), ensure_ascii=False, indent=indent)

    def to_markdown(self, report: ExperimentReport) -> str:
        """导出为Markdown格式"""
        lines: List[str] = []

        lines.append(f"# 贝叶斯A/B试验报告 - {report.experiment_id}")
        lines.append("")
        lines.append(f"**生成时间**: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**输入哈希**: `{report.input_hash}`")
        lines.append(f"**随机种子**: `{report.reproducibility_seed}`")
        lines.append("")
        lines.append("> 💡 **可复算性说明**: 使用相同输入再次运行，将得到完全一致的结果。")
        lines.append("> 输入哈希和随机种子可用于验证计算结果的一致性。")
        lines.append("")

        lines.append("## 1. 数据验证")
        lines.append("")
        validation = report.validation
        lines.append(f"**数据质量**: {self._format_data_quality(validation.data_quality.value)}")
        lines.append(f"**验证状态**: {'✅ 通过' if validation.is_valid else '❌ 未通过'}")
        lines.append("")

        if validation.missing_fields:
            lines.append("### ⚠️ 缺失字段")
            lines.append("")
            for field in validation.missing_fields:
                field_info = next(
                    (f for f in validation.fields if f.field_name == field),
                    None,
                )
                if field_info:
                    lines.append(f"- `{field}`: {field_info.message}")
            lines.append("")

        if validation.invalid_fields:
            lines.append("### ❌ 无效字段")
            lines.append("")
            for field in validation.invalid_fields:
                field_info = next(
                    (f for f in validation.fields if f.field_name == field),
                    None,
                )
                if field_info:
                    lines.append(
                        f"- `{field}`: {field_info.message} "
                        f"(提供值: `{field_info.provided_value}`)"
                    )
            lines.append("")

        if validation.warnings:
            lines.append("### ⚡ 警告")
            lines.append("")
            for warning in validation.warnings:
                lines.append(f"- {warning}")
            lines.append("")

        if validation.errors:
            lines.append("### 🛑 错误")
            lines.append("")
            for error in validation.errors:
                lines.append(f"- {error}")
            lines.append("")

        lines.append("### 处理顺序")
        lines.append("")
        for i, step in enumerate(validation.processing_order, 1):
            lines.append(f"{i}. {step}")
        lines.append("")

        lines.append("## 2. 贝叶斯分析结果")
        lines.append("")
        bayesian = report.bayesian_result

        lines.append("### 后验分布统计")
        lines.append("")
        lines.append("| 指标 | 对照组 | 实验组 |")
        lines.append("|------|--------|--------|")
        lines.append(
            f"| 均值 | {bayesian.control_posterior.mean:.4f} "
            f"| {bayesian.treatment_posterior.mean:.4f} |"
        )
        lines.append(
            f"| 中位数 | {bayesian.control_posterior.median:.4f} "
            f"| {bayesian.treatment_posterior.median:.4f} |"
        )
        lines.append(
            f"| 标准差 | {bayesian.control_posterior.std:.4f} "
            f"| {bayesian.treatment_posterior.std:.4f} |"
        )
        lines.append(
            f"| 95%CI下限 | {bayesian.control_posterior.ci_lower:.4f} "
            f"| {bayesian.treatment_posterior.ci_lower:.4f} |"
        )
        lines.append(
            f"| 95%CI上限 | {bayesian.control_posterior.ci_upper:.4f} "
            f"| {bayesian.treatment_posterior.ci_upper:.4f} |"
        )
        lines.append("")

        lines.append("### 关键指标")
        lines.append("")
        lines.append(
            f"- **P(实验组 > 对照组)**: **{bayesian.probability_treatment_better:.2%}**"
        )
        lines.append(
            f"- **预期提升量**: **{bayesian.expected_lift:.2%}** "
            f"(95%CI: [{bayesian.lift_ci_lower:.2%}, {bayesian.lift_ci_upper:.2%}])"
        )
        lines.append(f"- **先验强度**: {bayesian.prior_strength:.1f}")
        lines.append(f"- **有效样本量**: {bayesian.effective_sample_size:.0f}")
        lines.append("")

        if bayesian.metric_results:
            lines.append("### 多指标对比")
            lines.append("")
            lines.append("| 指标 | P(实验组>对照组) | 预期提升 | 95%CI |")
            lines.append("|------|------------------|----------|-------|")
            for metric_name, metric_result in bayesian.metric_results.items():
                direction = self._format_direction(
                    metric_result.probability_treatment_better
                )
                lines.append(
                    f"| {metric_name} {direction} "
                    f"| {metric_result.probability_treatment_better:.2%} "
                    f"| {metric_result.expected_lift:.2%} "
                    f"| [{metric_result.lift_ci_lower:.2%}, {metric_result.lift_ci_upper:.2%}] |"
                )
            lines.append("")

        lines.append("## 3. 风险评估")
        lines.append("")
        risk = report.risk_assessment

        lines.append(f"**整体风险等级**: {self._format_risk_level(risk.overall_risk_level.value)}")
        lines.append("")

        risk_summary = []
        if risk.has_early_stop:
            risk_summary.append("⚠️ 提前停测风险")
        if risk.has_strong_prior:
            risk_summary.append("⚠️ 先验过强风险")
        if risk.has_metric_conflict:
            risk_summary.append("⚠️ 多指标方向冲突")
        if not risk_summary:
            risk_summary.append("✅ 无重大风险")
        lines.append(f"**风险检测**: {', '.join(risk_summary)}")
        lines.append("")

        if risk.flags:
            lines.append("### 风险详情")
            lines.append("")
            for flag in risk.flags:
                level_icon = self._format_risk_icon(flag.level.value)
                lines.append(f"#### {level_icon} {self._format_risk_type(flag.risk_type)}")
                lines.append("")
                lines.append(f"**风险等级**: {self._format_risk_level(flag.level.value)}")
                lines.append(f"**问题描述**: {flag.message}")
                lines.append(f"**建议**: {flag.recommendation}")
                lines.append("")
                if flag.evidence:
                    lines.append("<details>")
                    lines.append("<summary>查看证据详情</summary>")
                    lines.append("")
                    lines.append("```json")
                    lines.append(
                        json.dumps(flag.evidence, ensure_ascii=False, indent=2)
                    )
                    lines.append("```")
                    lines.append("</details>")
                    lines.append("")

        lines.append("## 4. 停测建议")
        lines.append("")
        lines.append(f"**建议**: {self._format_stopping_reason(risk.stopping_recommendation.value)}")
        lines.append("")
        lines.append(f"> {risk.stopping_message}")
        lines.append("")

        if report.conclusions:
            lines.append("## 5. 结论")
            lines.append("")
            for conclusion in report.conclusions:
                lines.append(f"- {conclusion}")
            lines.append("")

        if report.recommendations:
            lines.append("## 6. 行动建议")
            lines.append("")
            for rec in report.recommendations:
                lines.append(f"- {rec}")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*本报告由贝叶斯A/B试验台自动生成，所有计算结果可复现。*")

        return "\n".join(lines)

    def save_json(self, report: ExperimentReport, filepath: str) -> None:
        """保存为JSON文件"""
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(self.to_json(report))

    def save_markdown(self, report: ExperimentReport, filepath: str) -> None:
        """保存为Markdown文件"""
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(self.to_markdown(report))

    def _format_data_quality(self, quality: str) -> str:
        """格式化数据质量显示"""
        mapping = {
            "clean": "✅ 干净",
            "borderline": "⚠️ 临界",
            "dirty": "❌ 脏数据",
        }
        return mapping.get(quality, quality)

    def _format_risk_level(self, level: str) -> str:
        """格式化风险等级显示"""
        mapping = {
            "none": "✅ 无",
            "low": "🟢 低",
            "medium": "🟡 中",
            "high": "🟠 高",
            "critical": "🔴 严重",
        }
        return mapping.get(level, level)

    def _format_risk_icon(self, level: str) -> str:
        """格式化风险图标"""
        mapping = {
            "none": "✅",
            "low": "🟢",
            "medium": "🟡",
            "high": "🟠",
            "critical": "🔴",
        }
        return mapping.get(level, "⚠️")

    def _format_risk_type(self, risk_type: str) -> str:
        """格式化风险类型显示"""
        mapping = {
            "early_stopping": "提前停测风险",
            "strong_prior": "先验过强风险",
            "metric_conflict": "多指标方向冲突",
            "small_sample": "样本量不足",
            "wide_ci": "可信区间过宽",
        }
        return mapping.get(risk_type, risk_type)

    def _format_stopping_reason(self, reason: str) -> str:
        """格式化停测原因显示"""
        mapping = {
            "not_stopped": "⏳ 继续试验",
            "early_stop": "⚠️ 不建议提前停测",
            "sample_size_reached": "✅ 已达到计划样本量，可以停测",
            "observation_window_end": "✅ 已完成观察窗口，可以停测",
            "manual_stop": "⚙️ 手动停测",
        }
        return mapping.get(reason, reason)

    def _format_direction(self, prob_better: float) -> str:
        """格式化指标方向图标"""
        if prob_better >= 0.95:
            return "🟢"
        elif prob_better <= 0.05:
            return "🔴"
        elif prob_better >= 0.8:
            return "🟡"
        elif prob_better <= 0.2:
            return "🟠"
        else:
            return "⚪"
