"""报告生成模块 - Markdown复核报告、CSV结果导出"""

from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .models import (
    FlowResult,
    HistoricalComparison,
    SectionData,
    ValidationIssue,
)


class ReportGenerator:
    """报告生成器"""

    def __init__(self):
        """初始化报告生成器"""
        pass

    def generate_markdown_report(
        self,
        section: SectionData,
        result: FlowResult,
        validation_issues: Optional[List[ValidationIssue]] = None,
        historical_comparison: Optional[HistoricalComparison] = None,
        include_segments: bool = True,
        include_uncertainty: bool = True,
    ) -> str:
        """
        生成 Markdown 格式的复核报告

        Args:
            section: 断面数据
            result: 流量计算结果
            validation_issues: 数据验证问题列表
            historical_comparison: 历史对比结果
            include_segments: 是否包含分段详细结果
            include_uncertainty: 是否包含不确定度分析

        Returns:
            str: Markdown 格式的报告内容
        """
        report_lines = []

        # 标题
        report_lines.append("# 断面流量复核报告")
        report_lines.append("")
        report_lines.append(f"**报告生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("")

        # 断面基本信息
        report_lines.append("## 1. 断面基本信息")
        report_lines.append("")
        report_lines.append("| 项目 | 内容 |")
        report_lines.append("|------|------|")
        report_lines.append(f"| 断面编号 | {section.section_id} |")
        if section.section_name:
            report_lines.append(f"| 断面名称 | {section.section_name} |")
        report_lines.append(f"| 测量日期 | {section.measurement_date.strftime('%Y-%m-%d %H:%M:%S')} |")
        report_lines.append(f"| 河宽 | {section.river_width:.2f} 米 |")
        report_lines.append(f"| 最大水深 | {section.max_depth:.2f} 米 |")
        report_lines.append(f"| 测点数 | {len(section.measuring_points)} 个 |")
        if section.temperature:
            report_lines.append(f"| 水温 | {section.temperature:.1f} °C |")
        if section.weather:
            report_lines.append(f"| 天气 | {section.weather} |")
        if section.operator:
            report_lines.append(f"| 操作员 | {section.operator} |")
        if section.instrument_id:
            report_lines.append(f"| 使用仪器 | {section.instrument_id} |")
        report_lines.append(f"| 单位制 | {'公制 (米)' if section.unit.value == 'metric' else '英制 (英尺)'} |")
        if section.notes:
            report_lines.append(f"| 备注 | {section.notes} |")
        report_lines.append("")

        # 流量计算结果
        report_lines.append("## 2. 流量计算结果")
        report_lines.append("")
        report_lines.append(f"**计算方法**: {'中垂线法' if result.method.value == 'midpoint' else '梯形法'}")
        report_lines.append("")
        report_lines.append("| 指标 | 数值 | 单位 |")
        report_lines.append("|------|------|------|")
        report_lines.append(f"| 总流量 | {result.total_discharge:.4f} | m³/s |")
        report_lines.append(f"| 过水面积 | {result.total_area:.4f} | m² |")
        report_lines.append(f"| 平均流速 | {result.average_velocity:.4f} | m/s |")
        if result.max_velocity:
            report_lines.append(f"| 最大流速 | {result.max_velocity:.4f} | m/s |")
        report_lines.append(f"| 计算河宽 | {result.river_width:.2f} | 米 |")
        report_lines.append(f"| 最大水深 | {result.max_depth:.2f} | 米 |")
        report_lines.append(f"| 分段数 | {len(result.segment_results)} | 个 |")
        report_lines.append("")

        # 分段详细结果
        if include_segments and result.segment_results:
            report_lines.append("### 2.1 分段详细结果")
            report_lines.append("")
            report_lines.append("| 分段 | 起始位置 | 终止位置 | 宽度 | 平均水深 | 平均流速 | 面积 | 流量 |")
            report_lines.append("|------|----------|----------|------|----------|----------|------|------|")
            for seg in result.segment_results:
                report_lines.append(
                    f"| {seg.segment_id} | {seg.start_distance:.2f}m | {seg.end_distance:.2f}m | "
                    f"{seg.width:.2f}m | {seg.average_depth:.3f}m | {seg.average_velocity:.3f}m/s | "
                    f"{seg.area:.2f}m² | {seg.discharge:.4f}m³/s |"
                )
            report_lines.append("")

        # 不确定度分析
        if include_uncertainty and result.uncertainty:
            report_lines.append("## 3. 不确定度分析")
            report_lines.append("")
            report_lines.append("| 指标 | 数值 |")
            report_lines.append("|------|------|")
            report_lines.append(f"| 合成不确定度 | {result.uncertainty.combined_uncertainty:.4f} m³/s |")
            report_lines.append(f"| 相对不确定度 | {result.uncertainty.relative_uncertainty:.2f} % |")
            report_lines.append(f"| 扩展不确定度 (k={result.uncertainty.coverage_factor}) | {result.uncertainty.expanded_uncertainty:.4f} m³/s |")
            report_lines.append("")

            if result.uncertainty.source_uncertainties:
                report_lines.append("### 3.1 不确定度分量")
                report_lines.append("")
                report_lines.append("| 不确定度来源 | 标准不确定度 | 灵敏系数 | 贡献 | 相对贡献 |")
                report_lines.append("|--------------|--------------|----------|------|----------|")
                for su in result.uncertainty.source_uncertainties:
                    report_lines.append(
                        f"| {su.source} | {su.standard_uncertainty:.4f} | {su.sensitivity_coefficient:.4f} | "
                        f"{su.contribution:.6f} | {su.relative_contribution:.2f}% |"
                    )
                report_lines.append("")

            # 结论
            report_lines.append("### 3.2 不确定度结论")
            report_lines.append("")
            rel_uncert = result.uncertainty.relative_uncertainty
            if rel_uncert <= 2:
                report_lines.append(f"✅ 测量精度良好，相对不确定度 {rel_uncert:.2f}% ≤ 2%")
            elif rel_uncert <= 5:
                report_lines.append(f"⚠️ 测量精度一般，相对不确定度 {rel_uncert:.2f}% ≤ 5%")
            else:
                report_lines.append(f"❌ 测量精度较差，相对不确定度 {rel_uncert:.2f}% > 5%")
            report_lines.append("")
            report_lines.append(f"**流量结果**: {result.total_discharge:.4f} ± {result.uncertainty.expanded_uncertainty:.4f} m³/s")
            report_lines.append(f"**置信概率**: 约 95% (包含因子 k={result.uncertainty.coverage_factor})")
            report_lines.append("")

        # 数据验证问题
        if validation_issues:
            report_lines.append("## 4. 数据验证问题")
            report_lines.append("")

            # 统计问题数量
            error_count = sum(1 for i in validation_issues if i.severity == "error")
            warning_count = sum(1 for i in validation_issues if i.severity == "warning")
            info_count = sum(1 for i in validation_issues if i.severity == "info")

            report_lines.append(f"**问题统计**: 错误 {error_count} 个, 警告 {warning_count} 个, 提示 {info_count} 个")
            report_lines.append("")

            # 按严重程度分组显示
            for severity in ["error", "warning", "info"]:
                severity_issues = [i for i in validation_issues if i.severity == severity]
                if severity_issues:
                    severity_label = {
                        "error": "错误",
                        "warning": "警告",
                        "info": "提示"
                    }.get(severity, severity)
                    
                    report_lines.append(f"### 4.1 {severity_label}问题")
                    report_lines.append("")
                    report_lines.append("| 编号 | 类型 | 测点 | 描述 | 建议 |")
                    report_lines.append("|------|------|------|------|------|")
                    
                    for issue in severity_issues:
                        point_str = str(issue.related_point_id) if issue.related_point_id else "-"
                        suggestion = issue.suggestion if issue.suggestion else "-"
                        report_lines.append(
                            f"| {issue.issue_id} | {issue.issue_type} | {point_str} | "
                            f"{issue.message} | {suggestion} |"
                        )
                    report_lines.append("")

        # 历史对比
        if historical_comparison:
            report_lines.append("## 5. 历史对比")
            report_lines.append("")
            report_lines.append(f"**对比断面**: {historical_comparison.historical_section_id}")
            report_lines.append("")
            report_lines.append("| 指标 | 差值 | 相对变化 |")
            report_lines.append("|------|------|----------|")
            report_lines.append(
                f"| 流量 | {historical_comparison.discharge_difference:+.4f} m³/s | "
                f"{historical_comparison.discharge_difference_percent:+.2f}% |"
            )
            if historical_comparison.area_difference is not None:
                report_lines.append(
                    f"| 面积 | {historical_comparison.area_difference:+.4f} m² | "
                    f"{historical_comparison.area_difference_percent:+.2f}% |"
                )
            if historical_comparison.velocity_difference is not None:
                report_lines.append(
                    f"| 流速 | {historical_comparison.velocity_difference:+.4f} m/s | "
                    f"{historical_comparison.velocity_difference_percent:+.2f}% |"
                )
            if historical_comparison.depth_profile_difference is not None:
                report_lines.append(
                    f"| 断面形态差异指数 | {historical_comparison.depth_profile_difference:.4f} | - |"
                )
            report_lines.append("")

            # 分析变化趋势
            q_diff = historical_comparison.discharge_difference
            q_pct = historical_comparison.discharge_difference_percent
            if abs(q_pct) <= 5:
                trend = "✅ 流量变化在正常范围内（±5%以内）"
            elif abs(q_pct) <= 15:
                trend = "⚠️ 流量有一定变化（±5% ~ ±15%）"
            else:
                trend = "❌ 流量变化较大（超过±15%）"
            
            report_lines.append(f"**变化分析**: {trend}")
            if q_diff > 0:
                report_lines.append(f"**趋势**: 流量较历史增加了 {q_pct:.2f}%")
            elif q_diff < 0:
                report_lines.append(f"**趋势**: 流量较历史减少了 {abs(q_pct):.2f}%")
            else:
                report_lines.append(f"**趋势**: 流量与历史持平")
            report_lines.append("")

        # 复核结论
        report_lines.append("## 6. 复核结论")
        report_lines.append("")

        # 根据验证问题和不确定度给出结论
        has_critical_errors = validation_issues and any(i.severity == "error" for i in validation_issues)
        has_warnings = validation_issues and any(i.severity == "warning" for i in validation_issues)

        if has_critical_errors:
            report_lines.append("❌ **复核不通过**")
            report_lines.append("")
            report_lines.append("存在严重错误，需要修正数据后重新计算：")
            for issue in validation_issues:
                if issue.severity == "error":
                    report_lines.append(f"- [{issue.issue_id}] {issue.message}")
        elif has_warnings:
            report_lines.append("⚠️ **复核有条件通过**")
            report_lines.append("")
            report_lines.append("存在警告信息，建议关注：")
            for issue in validation_issues:
                if issue.severity == "warning":
                    report_lines.append(f"- [{issue.issue_id}] {issue.message}")
        else:
            report_lines.append("✅ **复核通过**")
            report_lines.append("")
            report_lines.append("数据质量良好，无严重问题。")

        report_lines.append("")
        report_lines.append("---")
        report_lines.append("")
        report_lines.append(f"*本报告由断面流量复核器自动生成*")

        return "\n".join(report_lines)

    def export_to_csv(
        self,
        result: FlowResult,
        file_path: Path,
        include_segments: bool = True,
    ) -> Path:
        """
        导出计算结果到 CSV 文件

        Args:
            result: 流量计算结果
            file_path: 输出文件路径
            include_segments: 是否包含分段数据

        Returns:
            Path: 输出文件路径
        """
        import csv

        with open(file_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)

            # 汇总信息
            writer.writerow(["# 断面流量计算结果汇总"])
            writer.writerow(["断面编号", result.section_id])
            writer.writerow(["计算日期", result.calculation_date.strftime("%Y-%m-%d %H:%M:%S")])
            writer.writerow(["计算方法", "中垂线法" if result.method.value == "midpoint" else "梯形法"])
            writer.writerow([])
            writer.writerow(["指标", "数值", "单位"])
            writer.writerow(["总流量", result.total_discharge, "m³/s"])
            writer.writerow(["过水面积", result.total_area, "m²"])
            writer.writerow(["平均流速", result.average_velocity, "m/s"])
            if result.max_velocity:
                writer.writerow(["最大流速", result.max_velocity, "m/s"])
            writer.writerow(["河宽", result.river_width, "米"])
            writer.writerow(["最大水深", result.max_depth, "米"])
            writer.writerow([])

            # 不确定度信息
            if result.uncertainty:
                writer.writerow(["# 不确定度分析"])
                writer.writerow(["指标", "数值", "单位"])
                writer.writerow(["合成不确定度", result.uncertainty.combined_uncertainty, "m³/s"])
                writer.writerow(["相对不确定度", result.uncertainty.relative_uncertainty, "%"])
                writer.writerow(["扩展不确定度", result.uncertainty.expanded_uncertainty, "m³/s"])
                writer.writerow(["包含因子", result.uncertainty.coverage_factor, ""])
                writer.writerow([])

                if result.uncertainty.source_uncertainties:
                    writer.writerow(["# 不确定度分量"])
                    writer.writerow(["来源", "标准不确定度", "灵敏系数", "贡献", "相对贡献(%)"])
                    for su in result.uncertainty.source_uncertainties:
                        writer.writerow([
                            su.source,
                            su.standard_uncertainty,
                            su.sensitivity_coefficient,
                            su.contribution,
                            su.relative_contribution,
                        ])
                    writer.writerow([])

            # 分段数据
            if include_segments and result.segment_results:
                writer.writerow(["# 分段详细结果"])
                writer.writerow([
                    "分段编号", "起始位置(m)", "终止位置(m)", "宽度(m)",
                    "平均水深(m)", "平均流速(m/s)", "面积(m²)", "流量(m³/s)"
                ])
                for seg in result.segment_results:
                    writer.writerow([
                        seg.segment_id,
                        seg.start_distance,
                        seg.end_distance,
                        seg.width,
                        seg.average_depth,
                        seg.average_velocity,
                        seg.area,
                        seg.discharge,
                    ])

        return file_path

    def export_validation_issues_to_csv(
        self,
        issues: List[ValidationIssue],
        file_path: Path,
    ) -> Path:
        """
        导出验证问题到 CSV 文件

        Args:
            issues: 验证问题列表
            file_path: 输出文件路径

        Returns:
            Path: 输出文件路径
        """
        import csv

        with open(file_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)

            writer.writerow(["问题编号", "断面编号", "类型", "严重程度", "测点", "字段", "描述", "期望值", "实际值", "建议"])

            for issue in issues:
                writer.writerow([
                    issue.issue_id,
                    issue.section_id,
                    issue.issue_type,
                    issue.severity,
                    issue.related_point_id if issue.related_point_id else "",
                    issue.related_field if issue.related_field else "",
                    issue.message,
                    issue.expected_value if issue.expected_value is not None else "",
                    issue.actual_value if issue.actual_value is not None else "",
                    issue.suggestion if issue.suggestion else "",
                ])

        return file_path
