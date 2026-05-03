from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from ..models import (
    PondConfig,
    PondState,
    AnalysisReport,
    ComparisonReport,
    RiskLevel,
    RiskAssessment,
    Scenario,
)


class MarkdownExporter:
    def __init__(self):
        self._level_icons = {
            RiskLevel.SAFE: "✅",
            RiskLevel.WARNING: "⚠️",
            RiskLevel.DANGER: "🔴",
            RiskLevel.CRITICAL: "🚨",
        }

        self._level_names = {
            RiskLevel.SAFE: "安全",
            RiskLevel.WARNING: "警告",
            RiskLevel.DANGER: "危险",
            RiskLevel.CRITICAL: "临界",
        }

    def _format_timestamp(self, dt: datetime) -> str:
        return dt.strftime("%Y-%m-%d %H:%M:%S")

    def _format_risk_level(self, level: RiskLevel) -> str:
        return f"{self._level_icons.get(level, '')} {self._level_names.get(level, level.value)}"

    def generate_analysis_report(
        self,
        report: AnalysisReport,
        pond_config: Optional[PondConfig] = None,
        initial_state: Optional[PondState] = None,
        scenario: Optional[Scenario] = None,
    ) -> str:
        lines = []

        lines.append("# 育苗池水质处置单")
        lines.append("")
        lines.append(f"**报告编号**: {report.report_id}")
        lines.append(f"**生成时间**: {self._format_timestamp(report.generated_at)}")
        lines.append(f"**池塘ID**: {report.pond_id}")
        lines.append(f"**方案ID**: {report.scenario_id}")
        lines.append("")

        if pond_config:
            lines.append("## 📋 池塘基本信息")
            lines.append("")
            lines.append("| 项目 | 内容 |")
            lines.append("|------|------|")
            lines.append(f"| 池塘名称 | {pond_config.pond_name} |")
            lines.append(f"| 养殖品种 | {pond_config.species} |")
            lines.append(f"| 育苗阶段 | {pond_config.stage} |")
            lines.append(f"| 水体体积 | {pond_config.volume} m³ |")
            lines.append(f"| 水面面积 | {pond_config.area} m² |")
            lines.append(f"| 平均水深 | {pond_config.depth} m |")
            lines.append(f"| 放养密度 | {pond_config.stocking_density} 尾/m³ |")
            lines.append("")

        if initial_state:
            lines.append("## 📊 初始水质状态")
            lines.append("")
            lines.append("| 参数 | 当前值 | 单位 | 状态 |")
            lines.append("|------|--------|------|------|")
            lines.append(f"| 水温 | {initial_state.temperature:.1f} | ℃ | {'正常' if 18 <= initial_state.temperature <= 32 else '异常'} |")
            lines.append(f"| pH值 | {initial_state.ph:.2f} | pH | {'正常' if 7.0 <= initial_state.ph <= 8.5 else '异常'} |")
            lines.append(f"| 氨氮 | {initial_state.ammonia_nitrogen:.4f} | mg/L | {'正常' if initial_state.ammonia_nitrogen < 0.5 else '偏高'} |")
            lines.append(f"| 亚硝酸盐 | {initial_state.nitrite:.4f} | mg/L | {'正常' if initial_state.nitrite < 0.15 else '偏高'} |")
            lines.append(f"| 盐度 | {initial_state.salinity:.1f} | ‰ | - |")
            lines.append(f"| 溶解氧 | {initial_state.dissolved_oxygen:.2f} | mg/L | {'充足' if initial_state.dissolved_oxygen >= 5.0 else '偏低'} |")
            lines.append("")

        final_state = report.simulation_result.get_final_state()
        lines.append("## 🔮 24小时模拟预测")
        lines.append("")
        lines.append("| 参数 | 初始值 | 预测值 | 变化 |")
        lines.append("|------|--------|--------|------|")

        if initial_state:
            ammonia_change = final_state.get("ammonia_nitrogen", 0) - initial_state.ammonia_nitrogen
            nitrite_change = final_state.get("nitrite", 0) - initial_state.nitrite
            do_change = final_state.get("dissolved_oxygen", 0) - initial_state.dissolved_oxygen
            ph_change = final_state.get("ph", 0) - initial_state.ph

            lines.append(f"| 氨氮 | {initial_state.ammonia_nitrogen:.4f} mg/L | {final_state.get('ammonia_nitrogen', 0):.4f} mg/L | {'上升' if ammonia_change > 0 else '下降'} {abs(ammonia_change):.4f} mg/L |")
            lines.append(f"| 亚硝酸盐 | {initial_state.nitrite:.4f} mg/L | {final_state.get('nitrite', 0):.4f} mg/L | {'上升' if nitrite_change > 0 else '下降'} {abs(nitrite_change):.4f} mg/L |")
            lines.append(f"| pH值 | {initial_state.ph:.2f} | {final_state.get('ph', 0):.2f} | {'上升' if ph_change > 0 else '下降'} {abs(ph_change):.2f} |")
            lines.append(f"| 溶解氧 | {initial_state.dissolved_oxygen:.2f} mg/L | {final_state.get('dissolved_oxygen', 0):.2f} mg/L | {'上升' if do_change > 0 else '下降'} {abs(do_change):.2f} mg/L |")
        lines.append("")

        lines.append("## ⚠️ 风险评估")
        lines.append("")

        highest_level = report.get_highest_risk_level()
        lines.append(f"**最高风险等级**: {self._format_risk_level(highest_level)}")
        lines.append("")

        if report.risks:
            for level in [RiskLevel.CRITICAL, RiskLevel.DANGER, RiskLevel.WARNING]:
                level_risks = report.get_risks_by_level(level)
                if level_risks:
                    lines.append(f"### {self._format_risk_level(level)} 风险 ({len(level_risks)}项)")
                    lines.append("")
                    for i, risk in enumerate(level_risks, 1):
                        lines.append(f"**{i}. {risk.description}**")
                        if risk.current_value is not None:
                            lines.append(f"   - 当前值: {risk.current_value}")
                        if risk.threshold_value is not None:
                            lines.append(f"   - 阈值: {risk.threshold_value}")
                        if risk.location:
                            lines.append(f"   - 位置: {risk.location}")
                        if risk.suggested_action:
                            lines.append(f"   - 建议措施: {risk.suggested_action}")
                        lines.append("")
        else:
            lines.append("✅ 未检测到显著风险")
            lines.append("")

        lines.append("## 📋 处置建议")
        lines.append("")
        lines.append(report.summary)
        lines.append("")

        recommendations = report.recommendations
        if recommendations:
            wc_rec = recommendations.get("water_change", {})
            if wc_rec and wc_rec.get("recommended"):
                lines.append("### 💧 换水建议")
                lines.append("")
                lines.append(f"- **建议换水**: {wc_rec.get('exchange_ratio', 0) * 100:.1f}%")
                lines.append(f"- **紧急程度**: {wc_rec.get('urgency', 'normal')}")
                lines.append(f"- **持续时间**: {wc_rec.get('duration_hours', 0)} 小时")
                lines.append(f"- **原因**: {wc_rec.get('reason', '')}")
                if wc_rec.get("precautions"):
                    lines.append("- **注意事项**:")
                    for prec in wc_rec["precautions"]:
                        lines.append(f"  - {prec}")
                lines.append("")

            aer_rec = recommendations.get("aeration", {})
            if aer_rec and aer_rec.get("recommended"):
                lines.append("### 🌀 曝气建议")
                lines.append("")
                lines.append(f"- **曝气强度**: {aer_rec.get('intensity', 'normal')}")
                lines.append(f"- **持续时间**: {aer_rec.get('duration_hours', 0)} 小时")
                lines.append(f"- **原因**: {aer_rec.get('reason', '')}")
                if aer_rec.get("use_oxygenator"):
                    lines.append("- 建议开启增氧机")
                lines.append("")

            prob_rec = recommendations.get("probiotics", {})
            if prob_rec and prob_rec.get("recommended"):
                lines.append("### 🦠 补菌建议")
                lines.append("")
                lines.append(f"- **益生菌类型**: {prob_rec.get('probiotics_type', '')}")
                lines.append(f"- **投加量**: {prob_rec.get('dosage', 0)} g/m³")
                lines.append(f"- **原因**: {prob_rec.get('reason', '')}")
                if prob_rec.get("timing_hint"):
                    lines.append(f"- **施用时机**: {prob_rec.get('timing_hint', '')}")
                lines.append("")

        if scenario:
            lines.append("## 📝 方案详情")
            lines.append("")
            lines.append(f"**方案名称**: {scenario.scenario_name}")
            if scenario.description:
                lines.append(f"**描述**: {scenario.description}")
            lines.append("")

            if scenario.water_change_plans:
                lines.append("### 换水计划")
                for plan in scenario.water_change_plans:
                    lines.append(f"- **{plan.plan_id}: 开始时间: {self._format_timestamp(plan.start_time)}")
                    lines.append(f"  - 总换水比例: {plan.total_exchange_ratio * 100:.1f}%")
                    lines.append(f"  - 持续时间: {plan.duration_hours} 小时")
                    if plan.is_urgent:
                        lines.append(f"  - ⚠️ 紧急换水")
                lines.append("")

            if scenario.aeration_plans:
                lines.append("### 曝气计划")
                for plan in scenario.aeration_plans:
                    lines.append(f"- **{plan.plan_id}**: 开始时间: {self._format_timestamp(plan.start_time)}")
                    lines.append(f"  - 曝气强度: {plan.aeration_intensity}")
                    lines.append(f"  - 持续时间: {plan.duration_hours} 小时")
                lines.append("")

            if scenario.probiotics_plans:
                lines.append("### 补菌计划")
                for plan in scenario.probiotics_plans:
                    lines.append(f"- **{plan.plan_id}**: 施用时间: {self._format_timestamp(plan.application_time)}")
                    lines.append(f"  - 益生菌类型: {plan.probiotics_type}")
                    lines.append(f"  - 投加量: {plan.dosage} g/m³")
                lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*本处置单由育苗池水质换水推演器自动生成*")
        lines.append(f"*生成时间: {self._format_timestamp(datetime.now())}*")

        return "\n".join(lines)

    def generate_comparison_report(
        self,
        comparison_report: ComparisonReport,
    ) -> str:
        lines = []

        lines.append("# 方案对比分析报告")
        lines.append("")
        lines.append(f"**对比编号**: {comparison_report.comparison_id}")
        lines.append(f"**生成时间**: {self._format_timestamp(comparison_report.generated_at)}")
        lines.append("")

        lines.append("## 📊 方案概览")
        lines.append("")
        lines.append("| 方案 | 最终氨氮 | 最终亚硝酸盐 | 最低溶解氧 | 风险数 | 换水比例 | 综合评分 |")
        lines.append("|------|----------|--------------|------------|--------|----------|----------|")

        baseline = comparison_report.baseline_summary
        comp = comparison_report.comparison_summary

        lines.append(f"| {baseline.get('scenario_name', '基线方案')} | {baseline.get('final_ammonia', 0):.4f} mg/L | {baseline.get('final_nitrite', 0):.4f} mg/L | {baseline.get('min_do', 0):.2f} mg/L | {baseline.get('risk_count', 0)} | {baseline.get('water_exchange_ratio', 0):.1f}% | {baseline.get('score', 0):.1f} 分 |")
        lines.append(f"| {comp.get('scenario_name', '对比方案')} | {comp.get('final_ammonia', 0):.4f} mg/L | {comp.get('final_nitrite', 0):.4f} mg/L | {comp.get('min_do', 0):.2f} mg/L | {comp.get('risk_count', 0)} | {comp.get('water_exchange_ratio', 0):.1f}% | {comp.get('score', 0):.1f} 分 |")
        lines.append("")

        lines.append("## 🔍 关键差异")
        lines.append("")

        if comparison_report.key_differences:
            for diff in comparison_report.key_differences:
                impact_icon = "✅" if diff.get("impact") == "positive" else "❌" if diff.get("impact") == "negative" else "⚪"
                lines.append(f"### {impact_icon} {diff.get('name', '未知指标')}")
                lines.append("")
                lines.append(f"- **基线方案**: {diff.get('baseline_value')} {diff.get('unit', '')}")
                lines.append(f"- **对比方案**: {diff.get('comparison_value')} {diff.get('unit', '')}")
                lines.append(f"- **差异**: {diff.get('direction')} {abs(diff.get('difference', 0))} {diff.get('unit', '')}")
                if diff.get('percentage'):
                    lines.append(f"- **变化幅度**: {diff.get('percentage'):.1f}%")
                lines.append("")
        else:
            lines.append("两个方案在关键指标上差异不显著")
            lines.append("")

        lines.append("## 💡 推荐结论")
        lines.append("")
        lines.append(comparison_report.recommendation)
        lines.append("")

        if comparison_report.preferred_scenario:
            lines.append(f"**推荐方案ID**: {comparison_report.preferred_scenario}")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*本对比报告由育苗池水质换水推演器自动生成*")
        lines.append(f"*生成时间: {self._format_timestamp(datetime.now())}*")

        return "\n".join(lines)

    def export_analysis_report(
        self,
        file_path: str,
        report: AnalysisReport,
        pond_config: Optional[PondConfig] = None,
        initial_state: Optional[PondState] = None,
        scenario: Optional[Scenario] = None,
    ) -> None:
        content = self.generate_analysis_report(report, pond_config, initial_state, scenario)
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def export_comparison_report(
        self,
        file_path: str,
        comparison_report: ComparisonReport,
    ) -> None:
        content = self.generate_comparison_report(comparison_report)
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
