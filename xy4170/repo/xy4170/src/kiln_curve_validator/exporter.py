"""报告导出模块 - Markdown复核报告、CSV修正曲线导出"""

import csv
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, TextIO, Tuple
import json

from .models import (
    ValidationResult,
    ValidationIssue,
    ComparisonResult,
    CorrectionCurve,
    CurveSegment,
    SegmentType,
    KilnParameters,
    FiringRecipe,
    PlannedCurve,
    MeasuredCurve,
    SimulationResult,
    AdjustmentSuggestion,
)


class MarkdownExporter:
    """Markdown报告导出器"""

    def __init__(self):
        self.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def export_report(
        self,
        output_path: Path,
        validation_result: ValidationResult,
        comparison_result: Optional[ComparisonResult] = None,
        simulation_result: Optional[SimulationResult] = None,
        kiln: Optional[KilnParameters] = None,
        recipe: Optional[FiringRecipe] = None,
        planned_curve: Optional[PlannedCurve] = None,
        measured_curve: Optional[MeasuredCurve] = None,
    ) -> None:
        """导出完整的复核报告"""
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(self._generate_header())
            f.write("\n")

            f.write(self._generate_overview(
                validation_result,
                comparison_result,
                kiln,
                recipe
            ))
            f.write("\n")

            f.write(self._generate_issues_summary(validation_result))
            f.write("\n")

            if comparison_result:
                f.write(self._generate_comparison_section(comparison_result))
                f.write("\n")

            if planned_curve:
                f.write(self._generate_planned_curve_section(planned_curve))
                f.write("\n")

            if simulation_result:
                f.write(self._generate_simulation_section(simulation_result))
                f.write("\n")

            f.write(self._generate_detailed_issues(validation_result))
            f.write("\n")

            f.write(self._generate_recommendations(validation_result))
            f.write("\n")

            f.write(self._generate_footer())

    def _generate_header(self) -> str:
        """生成报告头部"""
        return f"""# 烧成曲线复核报告

**生成时间**: {self.timestamp}

---
"""

    def _generate_overview(
        self,
        validation: ValidationResult,
        comparison: Optional[ComparisonResult],
        kiln: Optional[KilnParameters],
        recipe: Optional[FiringRecipe]
    ) -> str:
        """生成概览部分"""
        status_emoji = {
            "pass": "✅",
            "warning": "⚠️",
            "fail": "❌"
        }.get(validation.overall_status, "❓")

        status_text = {
            "pass": "通过",
            "warning": "存在警告",
            "fail": "未通过"
        }.get(validation.overall_status, "未知")

        lines = [
            "## 复核概览",
            "",
            f"**整体状态**: {status_emoji} **{status_text}**",
            "",
            f"> {validation.summary}",
            "",
        ]

        lines.append("### 校验项状态")
        lines.append("")
        lines.append("| 校验项 | 状态 |")
        lines.append("|--------|------|")
        lines.append(f"| 升温速率 | {'✅ 正常' if validation.heating_rate_ok else '❌ 异常'} |")
        lines.append(f"| 热功充足 | {'✅ 正常' if validation.thermal_work_ok else '❌ 异常'} |")
        lines.append(f"| 保温时间 | {'✅ 正常' if validation.hold_time_ok else '❌ 异常'} |")
        lines.append(f"| 冷却风险 | {'✅ 正常' if validation.cooling_risk_ok else '❌ 异常'} |")
        lines.append(f"| 传感器状态 | {'✅ 正常' if validation.sensor_ok else '❌ 异常'} |")
        lines.append("")

        if kiln:
            lines.append("### 窑炉信息")
            lines.append("")
            lines.append(f"- **名称**: {kiln.name}")
            lines.append(f"- **容积**: {kiln.chamber_volume} L")
            lines.append(f"- **额定功率**: {kiln.power_rating} kW")
            lines.append(f"- **热惯性系数**: {kiln.thermal_inertia_factor}")
            lines.append("")

        if recipe:
            lines.append("### 配方信息")
            lines.append("")
            lines.append(f"- **名称**: {recipe.name}")
            lines.append(f"- **烧成类型**: {'素烧' if recipe.firing_type == 'bisque' else '釉烧'}")
            lines.append(f"- **目标温度**: {recipe.target_temperature} °C")
            lines.append(f"- **总厚度**: {recipe.total_thickness} cm")
            lines.append("")

        return "\n".join(lines)

    def _generate_issues_summary(self, validation: ValidationResult) -> str:
        """生成问题汇总"""
        critical = [i for i in validation.issues if i.severity == "critical"]
        warning = [i for i in validation.issues if i.severity == "warning"]
        info = [i for i in validation.issues if i.severity == "info"]

        lines = [
            "## 问题汇总",
            "",
            f"- **严重问题**: {len(critical)} 个",
            f"- **警告项**: {len(warning)} 个",
            f"- **提示项**: {len(info)} 个",
            "",
        ]

        if critical:
            lines.append("### ⚠️ 严重问题 (需立即关注)")
            lines.append("")
            for idx, issue in enumerate(critical, 1):
                lines.append(f"**{idx}. {issue.message}**")
                if issue.location:
                    lines.append(f"   - 位置: {issue.location}")
                if issue.suggested_action:
                    lines.append(f"   - 建议: {issue.suggested_action}")
                lines.append("")

        if warning:
            lines.append("### ⚡ 警告项 (建议关注)")
            lines.append("")
            for idx, issue in enumerate(warning, 1):
                lines.append(f"**{idx}. {issue.message}**")
                if issue.location:
                    lines.append(f"   - 位置: {issue.location}")
                if issue.suggested_action:
                    lines.append(f"   - 建议: {issue.suggested_action}")
                lines.append("")

        return "\n".join(lines)

    def _generate_comparison_section(self, comparison: ComparisonResult) -> str:
        """生成计划与实测对比部分"""
        lines = [
            "## 计划与实测对比",
            "",
            "### 关键指标对比",
            "",
            "| 指标 | 计划值 | 实测值 | 偏差 |",
            "|------|--------|--------|------|",
            f"| 总时长 | {comparison.planned_duration:.0f} min | {comparison.measured_duration:.0f} min | {comparison.measured_duration - comparison.planned_duration:+.0f} min |",
            f"| 峰值温度 | {comparison.planned_peak:.1f} °C | {comparison.measured_peak:.1f} °C | {comparison.measured_peak - comparison.planned_peak:+.1f} °C |",
            f"| 到达峰值时间差 | - | - | {comparison.peak_time_diff:+.1f} min |",
            "",
            f"**平均温度偏差**: {comparison.avg_deviation:+.2f} °C",
            "",
            f"**最大温度偏差**: {'+' if comparison.max_deviation > 0 else ''}{comparison.max_deviation:.2f} °C",
            "",
        ]

        return "\n".join(lines)

    def _generate_planned_curve_section(self, planned: PlannedCurve) -> str:
        """生成计划曲线详情"""
        lines = [
            "## 计划曲线详情",
            "",
            f"- **配方**: {planned.recipe_name}",
            f"- **窑炉**: {planned.kiln_name}",
            f"- **总时长**: {planned.get_total_duration():.0f} 分钟",
            f"- **峰值温度**: {planned.get_peak_temperature():.1f} °C",
            "",
            "### 曲线段明细",
            "",
            "| 段号 | 类型 | 起始温度 | 结束温度 | 时长 | 速率 |",
            "|------|------|----------|----------|------|------|",
        ]

        type_names = {
            SegmentType.RAMP: "升温",
            SegmentType.HOLD: "保温",
            SegmentType.COOL: "降温",
        }

        for idx, seg in enumerate(planned.segments, 1):
            seg_type = type_names.get(seg.segment_type, "未知")
            rate_str = f"{seg.rate:+.2f}" if seg.rate is not None else "-"
            lines.append(
                f"| {idx} | {seg_type} | {seg.start_temp:.1f}°C | {seg.end_temp:.1f}°C | {seg.duration:.0f}min | {rate_str}°C/min |"
            )

        lines.append("")
        return "\n".join(lines)

    def _generate_simulation_section(self, simulation: SimulationResult) -> str:
        """生成模拟结果部分"""
        lines = [
            "## 热惯性模拟分析",
            "",
        ]

        if simulation.core_surface_diff:
            max_diff = max(abs(d) for d in simulation.core_surface_diff)
            avg_diff = sum(abs(d) for d in simulation.core_surface_diff) / len(simulation.core_surface_diff)

            lines.append("### 表里温差分析")
            lines.append("")
            lines.append(f"- **最大表里温差**: {max_diff:.2f} °C")
            lines.append(f"- **平均表里温差**: {avg_diff:.2f} °C")
            lines.append("")

            if max_diff > 30:
                lines.append("> ⚠️ 表里温差较大，建议降低升温速率以减少热应力")
                lines.append("")

        if simulation.lag_times:
            max_lag = max(simulation.lag_times)
            avg_lag = sum(simulation.lag_times) / len(simulation.lag_times)

            lines.append("### 热滞后分析")
            lines.append("")
            lines.append(f"- **最大滞后时间**: {max_lag:.2f} 分钟")
            lines.append(f"- **平均滞后时间**: {avg_lag:.2f} 分钟")
            lines.append("")

        return "\n".join(lines)

    def _generate_detailed_issues(self, validation: ValidationResult) -> str:
        """生成详细问题列表"""
        if not validation.issues:
            return ""

        lines = [
            "## 详细问题列表",
            "",
            "| 序号 | 严重程度 | 分类 | 问题描述 | 位置 | 实测值 | 阈值 |",
            "|------|----------|------|----------|------|--------|------|",
        ]

        severity_emoji = {
            "critical": "🔴 严重",
            "warning": "🟡 警告",
            "info": "🔵 提示",
        }

        category_names = {
            "heating_rate": "升温速率",
            "thermal_work": "热功",
            "hold_time": "保温时间",
            "cooling": "冷却风险",
            "sensor": "传感器",
        }

        for idx, issue in enumerate(validation.issues, 1):
            severity = severity_emoji.get(issue.severity, issue.severity)
            category = category_names.get(issue.category, issue.category)
            location = issue.location or "-"
            measured = f"{issue.measured_value}" if issue.measured_value is not None else "-"
            threshold = f"{issue.threshold_value}" if issue.threshold_value is not None else "-"

            lines.append(
                f"| {idx} | {severity} | {category} | {issue.message} | {location} | {measured} | {threshold} |"
            )

        lines.append("")
        return "\n".join(lines)

    def _generate_recommendations(self, validation: ValidationResult) -> str:
        """生成调整建议汇总"""
        suggestions = []

        for issue in validation.issues:
            if issue.suggested_action:
                suggestions.append({
                    "severity": issue.severity,
                    "action": issue.suggested_action,
                    "message": issue.message
                })

        if not suggestions:
            return """## 调整建议

✅ 本次复核未发现需要调整的问题，曲线参数设置合理。

"""

        lines = [
            "## 调整建议",
            "",
        ]

        critical_actions = [s for s in suggestions if s["severity"] == "critical"]
        if critical_actions:
            lines.append("### 🔴 紧急调整")
            lines.append("")
            for s in critical_actions:
                lines.append(f"**问题**: {s['message']}")
                lines.append(f"**建议**: {s['action']}")
                lines.append("")

        warning_actions = [s for s in suggestions if s["severity"] == "warning"]
        if warning_actions:
            lines.append("### 🟡 建议调整")
            lines.append("")
            for s in warning_actions:
                lines.append(f"**问题**: {s['message']}")
                lines.append(f"**建议**: {s['action']}")
                lines.append("")

        return "\n".join(lines)

    def _generate_footer(self) -> str:
        """生成报告页脚"""
        return """---

*此报告由烧成曲线复核器自动生成*

> 提示：本工具仅提供参考建议，最终烧成决策请结合实际经验和窑炉特性判断。
"""


class CSVExporter:
    """CSV修正曲线导出器"""

    @staticmethod
    def export_correction_curve(
        output_path: Path,
        correction_curve: CorrectionCurve
    ) -> None:
        """导出修正后的曲线为CSV"""
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)

            writer.writerow(["# 修正烧成曲线", correction_curve.name])
            writer.writerow(["# 基于曲线:", correction_curve.base_on])
            writer.writerow(["# 生成时间:", correction_curve.created_at.strftime("%Y-%m-%d %H:%M:%S")])
            writer.writerow([])

            writer.writerow(["段号", "类型", "起始温度(°C)", "结束温度(°C)", "时长(min)", "速率(°C/min)"])

            type_names = {
                SegmentType.RAMP: "升温",
                SegmentType.HOLD: "保温",
                SegmentType.COOL: "降温",
            }

            for idx, seg in enumerate(correction_curve.segments, 1):
                seg_type = type_names.get(seg.segment_type, "未知")
                rate_str = f"{seg.rate:+.2f}" if seg.rate is not None else ""
                writer.writerow([
                    idx,
                    seg_type,
                    f"{seg.start_temp:.1f}",
                    f"{seg.end_temp:.1f}",
                    f"{seg.duration:.1f}",
                    rate_str
                ])

            writer.writerow([])
            writer.writerow(["# 调整说明"])
            writer.writerow(["段号", "原时长(min)", "建议时长(min)", "原速率", "建议速率", "调整原因", "优先级"])

            for adj in correction_curve.adjustments:
                orig_rate = f"{adj.original_segment.rate:+.2f}" if adj.original_segment.rate else ""
                sug_rate = f"{adj.suggested_rate:+.2f}" if adj.suggested_rate else ""
                writer.writerow([
                    adj.segment_index + 1,
                    f"{adj.original_segment.duration:.1f}",
                    f"{adj.suggested_duration:.1f}",
                    orig_rate,
                    sug_rate,
                    adj.reason,
                    adj.priority
                ])

            if correction_curve.notes:
                writer.writerow([])
                writer.writerow(["# 备注"])
                writer.writerow([correction_curve.notes])

    @staticmethod
    def export_detailed_curve(
        output_path: Path,
        time_points: List[float],
        temperatures: List[float],
        core_temps: Optional[List[float]] = None,
        labels: Optional[Dict[str, str]] = None
    ) -> None:
        """导出详细的逐点曲线数据"""
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)

            headers = ["时间(min)", "表面温度(°C)"]
            if core_temps:
                headers.append("中心温度(°C)")
                headers.append("表里温差(°C)")
            writer.writerow(headers)

            for i, time in enumerate(time_points):
                row = [f"{time:.2f}", f"{temperatures[i]:.2f}"]
                if core_temps and i < len(core_temps):
                    row.append(f"{core_temps[i]:.2f}")
                    row.append(f"{core_temps[i] - temperatures[i]:.2f}")
                writer.writerow(row)


class AdjustmentGenerator:
    """调整建议生成器"""

    def __init__(self, kiln: KilnParameters, recipe: FiringRecipe):
        self.kiln = kiln
        self.recipe = recipe

    def generate_correction_curve(
        self,
        original_curve: PlannedCurve,
        validation_result: ValidationResult,
        comparison_result: Optional[ComparisonResult] = None
    ) -> CorrectionCurve:
        """根据校验结果生成修正曲线"""
        adjustments: List[AdjustmentSuggestion] = []
        new_segments = list(original_curve.segments)

        heating_issues = [i for i in validation_result.issues
                          if i.category == "heating_rate" and i.severity in ["critical", "warning"]]

        for issue in heating_issues:
            for idx, seg in enumerate(new_segments):
                if seg.segment_type == SegmentType.RAMP and seg.rate and seg.rate > 0:
                    if issue.location:
                        loc_temp = float(issue.location.split('~')[0].strip().replace('°C', ''))
                        if seg.start_temp <= loc_temp <= seg.end_temp:
                            new_duration, new_rate = self._adjust_heating_segment(seg, issue)

                            adjustments.append(AdjustmentSuggestion(
                                segment_index=idx,
                                original_segment=seg,
                                suggested_duration=new_duration,
                                suggested_rate=new_rate,
                                reason=issue.message,
                                priority=1 if issue.severity == "critical" else 2
                            ))

                            new_segments[idx] = CurveSegment(
                                segment_type=seg.segment_type,
                                start_temp=seg.start_temp,
                                end_temp=seg.end_temp,
                                duration=new_duration,
                                rate=new_rate
                            )
                            break

        hold_issues = [i for i in validation_result.issues
                       if i.category in ["hold_time", "thermal_work"]]

        for issue in hold_issues:
            for idx, seg in enumerate(new_segments):
                if seg.segment_type == SegmentType.HOLD:
                    new_duration = self._adjust_hold_segment(seg, issue)

                    if abs(new_duration - seg.duration) > 1:
                        adjustments.append(AdjustmentSuggestion(
                            segment_index=idx,
                            original_segment=seg,
                            suggested_duration=new_duration,
                            suggested_rate=0.0,
                            reason=issue.message,
                            priority=1 if issue.severity == "critical" else 2
                        ))

                        new_segments[idx] = CurveSegment(
                            segment_type=seg.segment_type,
                            start_temp=seg.start_temp,
                            end_temp=seg.end_temp,
                            duration=new_duration,
                            rate=0.0
                        )
                        break

        cooling_issues = [i for i in validation_result.issues
                          if i.category == "cooling"]

        for issue in cooling_issues:
            for idx, seg in enumerate(new_segments):
                if seg.segment_type == SegmentType.COOL:
                    new_duration, new_rate = self._adjust_cooling_segment(seg, issue)

                    adjustments.append(AdjustmentSuggestion(
                        segment_index=idx,
                        original_segment=seg,
                        suggested_duration=new_duration,
                        suggested_rate=new_rate,
                        reason=issue.message,
                        priority=1 if issue.severity == "critical" else 2
                    ))

                    new_segments[idx] = CurveSegment(
                        segment_type=seg.segment_type,
                        start_temp=seg.start_temp,
                        end_temp=seg.end_temp,
                        duration=new_duration,
                        rate=new_rate
                    )
                    break

        notes_parts = []
        if heating_issues:
            notes_parts.append(f"调整了 {len([a for a in adjustments if a.original_segment.segment_type == SegmentType.RAMP])} 个升温段")
        if hold_issues:
            notes_parts.append(f"调整了 {len([a for a in adjustments if a.original_segment.segment_type == SegmentType.HOLD])} 个保温段")
        if cooling_issues:
            notes_parts.append(f"调整了 {len([a for a in adjustments if a.original_segment.segment_type == SegmentType.COOL])} 个冷却段")

        return CorrectionCurve(
            name=f"{original_curve.recipe_name} - 修正版",
            base_on=original_curve.recipe_name,
            segments=new_segments,
            adjustments=adjustments,
            notes="; ".join(notes_parts) if notes_parts else "无重大调整"
        )

    def _adjust_heating_segment(
        self,
        segment: CurveSegment,
        issue: ValidationIssue
    ) -> Tuple[float, Optional[float]]:
        """调整升温段参数"""
        if issue.threshold_value and issue.measured_value:
            ratio = issue.measured_value / issue.threshold_value
            multiplier = min(1.5, ratio * 1.2)
            new_duration = segment.duration * multiplier
            temp_range = segment.end_temp - segment.start_temp
            new_rate = temp_range / new_duration if new_duration > 0 else 0
            return new_duration, new_rate

        return segment.duration * 1.3, segment.rate

    def _adjust_hold_segment(
        self,
        segment: CurveSegment,
        issue: ValidationIssue
    ) -> float:
        """调整保温段时间"""
        return segment.duration * 1.3

    def _adjust_cooling_segment(
        self,
        segment: CurveSegment,
        issue: ValidationIssue
    ) -> Tuple[float, Optional[float]]:
        """调整冷却段参数"""
        if issue.threshold_value and issue.measured_value:
            ratio = abs(issue.measured_value) / abs(issue.threshold_value)
            multiplier = min(1.5, ratio * 1.2)
            new_duration = segment.duration * multiplier
            temp_range = segment.end_temp - segment.start_temp
            new_rate = temp_range / new_duration if new_duration > 0 else 0
            return new_duration, new_rate

        return segment.duration * 1.3, segment.rate
