from datetime import datetime
from pathlib import Path
from typing import List, Optional

from kiln_analyzer.models import (
    AnalysisResult,
    BatchRiskAssessment,
    HeatIntegral,
    KilnLoad,
    PhaseDeviation,
    PhaseType,
    ReviewSession,
    TargetCurve,
)
from kiln_analyzer.rules.risk_engine import RiskAssessmentEngine


class MarkdownExporter:
    def __init__(self):
        pass

    def generate_report(
        self,
        analysis_result: AnalysisResult,
        target_curve: TargetCurve,
        kiln_load: Optional[KilnLoad] = None,
        review_session: Optional[ReviewSession] = None,
    ) -> str:
        lines: List[str] = []

        lines.append(f"# 窑炉烧成曲线复盘报告")
        lines.append("")
        lines.append(f"> 批次ID: {analysis_result.batch_id}")
        lines.append(f"> 曲线名称: {analysis_result.curve_name}")
        lines.append(f"> 分析时间: {analysis_result.analysis_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        lines.append("")

        lines.append(self._generate_risk_section(analysis_result.risk_assessment))
        lines.append("")

        lines.append(self._generate_deviation_section(analysis_result.phase_deviations))
        lines.append("")

        lines.append(self._generate_heat_section(analysis_result.heat_integrals))
        lines.append("")

        if kiln_load:
            lines.append(self._generate_kiln_load_section(kiln_load))
            lines.append("")

        if review_session:
            lines.append(self._generate_review_section(review_session))
            lines.append("")

        lines.append(self._generate_summary_section(
            analysis_result, target_curve, kiln_load
        ))
        lines.append("")

        lines.append("---")
        lines.append("")
        lines.append(f"*本报告由窑炉烧成曲线复盘器自动生成*")
        lines.append(f"*生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")

        return "\n".join(lines)

    def _generate_risk_section(self, assessment: BatchRiskAssessment) -> str:
        lines: List[str] = []

        lines.append("## 📊 风险评估结果")
        lines.append("")

        risk_display = RiskAssessmentEngine.format_risk_level(assessment.overall_risk)
        lines.append(f"**整体风险等级**: {risk_display}")
        lines.append(f"**风险评分**: {assessment.overall_score:.2f}")
        lines.append("")

        if assessment.critical_factors:
            lines.append("### ⚠️ 关键风险因素")
            lines.append("")
            for factor in assessment.critical_factors:
                lines.append(f"- {factor}")
            lines.append("")

        lines.append("### 🧱 分层风险")
        lines.append("")

        lines.append("| 层位 | 风险等级 | 风险评分 | 风险因素 |")
        lines.append("|------|---------|---------|---------|")

        for layer_name, risk in assessment.layer_risks.items():
            risk_emoji = RiskAssessmentEngine.format_risk_level(risk.risk_level)
            factors_str = "; ".join(risk.risk_factors[:3])
            if len(risk.risk_factors) > 3:
                factors_str += f" (共{len(risk.risk_factors)}项)"
            lines.append(f"| {layer_name} | {risk_emoji} | {risk.risk_score:.2f} | {factors_str} |")

        lines.append("")

        if assessment.suggestions:
            lines.append("### 💡 改进建议")
            lines.append("")
            for suggestion in assessment.suggestions:
                lines.append(f"- {suggestion}")

        return "\n".join(lines)

    def _generate_deviation_section(self, deviations: List[PhaseDeviation]) -> str:
        lines: List[str] = []

        lines.append("## 📈 各阶段偏差分析")
        lines.append("")

        for dev in deviations:
            phase_type_emoji = self._phase_type_emoji(dev.phase_type)
            lines.append(f"### {phase_type_emoji} {dev.phase_name}")
            lines.append("")

            lines.append("#### 温度偏差")
            lines.append("")
            lines.append("| 层位 | 平均偏差 (°C) | 最大偏差 (°C) |")
            lines.append("|------|--------------|--------------|")

            for layer_name, avg_dev in dev.avg_temp_deviation.items():
                max_dev = dev.max_temp_deviation.get(layer_name, 0.0)
                avg_sign = "+" if avg_dev > 0 else ""
                max_sign = "+" if max_dev > 0 else ""
                lines.append(f"| {layer_name} | {avg_sign}{avg_dev:.2f} | {max_sign}{max_dev:.2f} |")

            lines.append("")

            if dev.rate_deviation:
                lines.append("#### 速率偏差 (°C/min)")
                lines.append("")
                for layer_name, rate_dev in dev.rate_deviation.items():
                    sign = "+" if rate_dev > 0 else ""
                    status = "偏快" if rate_dev > 0 else "偏慢" if rate_dev < 0 else "正常"
                    lines.append(f"- **{layer_name}**: {sign}{rate_dev:.2f} ({status})")
                lines.append("")

            if dev.hold_deviation_seconds is not None and dev.hold_deviation_seconds > 0:
                lines.append(f"#### ⏱️ 保温时间异常")
                lines.append("")
                lines.append(f"- 超出公差时间: {dev.hold_deviation_seconds:.0f} 秒 ({dev.hold_deviation_seconds/60:.1f} 分钟)")
                lines.append("")

        return "\n".join(lines)

    def _generate_heat_section(self, integrals: List[HeatIntegral]) -> str:
        lines: List[str] = []

        lines.append("## 🔥 热量积分分析")
        lines.append("")

        lines.append("### 各阶段热量积分")
        lines.append("")

        for integral in integrals:
            lines.append(f"#### {integral.phase_name}")
            lines.append("")
            lines.append(f"**总热量积分**: {self._format_heat(integral.total_heat)}")

            if integral.deviation_percent is not None:
                dev_pct = integral.deviation_percent
                sign = "+" if dev_pct > 0 else ""
                status = "偏高" if dev_pct > 0 else "偏低" if dev_pct < 0 else "正常"
                lines.append(f"**与参考值偏差**: {sign}{dev_pct:.1f}% ({status})")

            lines.append("")
            lines.append("| 层位 | 热量积分 |")
            lines.append("|------|---------|")

            for layer_name, heat in integral.heat_by_layer.items():
                lines.append(f"| {layer_name} | {self._format_heat(heat)} |")

            lines.append("")

        return "\n".join(lines)

    def _generate_kiln_load_section(self, kiln_load: KilnLoad) -> str:
        lines: List[str] = []

        lines.append("## 🏺 窑车装载信息")
        lines.append("")

        lines.append(f"- **窑炉型号**: {kiln_load.kiln_model}")
        lines.append(f"- **装载日期**: {kiln_load.load_date.strftime('%Y-%m-%d')}")
        lines.append(f"- **总件数**: {kiln_load.total_pieces} 件")
        lines.append("")

        lines.append("### 各层装载情况")
        lines.append("")
        lines.append("| 层位 | 位置 | 装载类型 | 件数 | 预期温度偏移 |")
        lines.append("|------|------|---------|------|-------------|")

        for layer in kiln_load.layers:
            offset_str = f"+{layer.expected_temp_offset}" if layer.expected_temp_offset > 0 else f"{layer.expected_temp_offset}"
            lines.append(
                f"| {layer.layer_name} | {layer.position} | {layer.load_type} | "
                f"{layer.piece_count} | {offset_str}°C |"
            )

        lines.append("")

        if kiln_load.notes:
            lines.append("### 📝 装载备注")
            lines.append("")
            lines.append(kiln_load.notes)
            lines.append("")

        return "\n".join(lines)

    def _generate_review_section(self, review: ReviewSession) -> str:
        lines: List[str] = []

        lines.append("## 📝 人工复盘记录")
        lines.append("")

        lines.append(f"- **复盘会话ID**: {review.session_id}")
        lines.append(f"- **参与人员**: {', '.join(review.reviewers) if review.reviewers else '未记录'}")
        lines.append(f"- **创建时间**: {review.created_at.strftime('%Y-%m-%d %H:%M')}")
        lines.append(f"- **更新时间**: {review.updated_at.strftime('%Y-%m-%d %H:%M')}")
        lines.append("")

        if review.notes:
            lines.append("### 复盘笔记")
            lines.append("")

            for note in review.notes:
                author = note.author or "匿名"
                time_str = note.created_at.strftime("%Y-%m-%d %H:%M")
                lines.append(f"#### [{note.category}] {author} ({time_str})")
                lines.append("")
                lines.append(note.content)

                if note.related_layer:
                    lines.append(f"")
                    lines.append(f"*关联层位: {note.related_layer}*")
                if note.related_phase:
                    lines.append(f"*关联阶段: {note.related_phase.value}*")
                lines.append("")

        if review.conclusion:
            lines.append("### 复盘结论")
            lines.append("")
            lines.append(review.conclusion)
            lines.append("")

        if review.recommendations:
            lines.append("### 改进建议")
            lines.append("")
            for rec in review.recommendations:
                lines.append(f"- {rec}")
            lines.append("")

        return "\n".join(lines)

    def _generate_summary_section(
        self,
        analysis_result: AnalysisResult,
        target_curve: TargetCurve,
        kiln_load: Optional[KilnLoad],
    ) -> str:
        lines: List[str] = []

        lines.append("## 📋 总结概览")
        lines.append("")

        lines.append("### 烧成曲线信息")
        lines.append("")
        lines.append(f"- **曲线名称**: {target_curve.name}")
        if target_curve.description:
            lines.append(f"- **描述**: {target_curve.description}")
        lines.append(f"- **总持续时间**: {target_curve.total_duration / 60:.0f} 分钟")
        lines.append(f"- **最高温度**: {target_curve.max_temp:.0f}°C")
        lines.append(f"- **阶段数**: {len(target_curve.phases)}")
        lines.append("")

        lines.append("### 阶段列表")
        lines.append("")
        lines.append("| 阶段 | 类型 | 起始温度 | 结束温度 | 持续时间 |")
        lines.append("|------|------|---------|---------|---------|")

        for phase in target_curve.phases:
            type_name = {
                PhaseType.HEATING: "升温",
                PhaseType.HOLDING: "保温",
                PhaseType.COOLING: "冷却",
            }.get(phase.phase_type, phase.phase_type.value)

            lines.append(
                f"| {phase.name} | {type_name} | {phase.start_temp:.0f}°C | "
                f"{phase.end_temp:.0f}°C | {phase.duration / 60:.0f} 分钟 |"
            )

        return "\n".join(lines)

    def _phase_type_emoji(self, phase_type: PhaseType) -> str:
        emoji_map = {
            PhaseType.HEATING: "🌡️",
            PhaseType.HOLDING: "⏳",
            PhaseType.COOLING: "❄️",
        }
        return emoji_map.get(phase_type, "📊")

    def _format_heat(self, heat: float) -> str:
        if heat >= 1_000_000:
            return f"{heat / 1_000_000:.2f} M°C·s"
        elif heat >= 1_000:
            return f"{heat / 1_000:.2f} k°C·s"
        else:
            return f"{heat:.2f} °C·s"

    def save_report(self, content: str, output_path: Path) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
