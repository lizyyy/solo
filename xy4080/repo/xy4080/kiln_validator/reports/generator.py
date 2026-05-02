"""报告生成器 - 导出 Markdown、CSV、JSON 格式报告"""

from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime
import json
import csv
import io

from kiln_validator.models import (
    ValidationResult,
    ValidationIssue,
    IssueSeverity,
    IssueCategory,
    FiringPlan,
    WorkpieceList,
    ThermoSimulationResult,
    KilnConfig,
)


SEVERITY_ICONS = {
    IssueSeverity.CRITICAL: "🔴",
    IssueSeverity.WARNING: "🟡",
    IssueSeverity.INFO: "ℹ️",
}

SEVERITY_NAMES = {
    IssueSeverity.CRITICAL: "严重",
    IssueSeverity.WARNING: "警告",
    IssueSeverity.INFO: "信息",
}

CATEGORY_NAMES = {
    IssueCategory.RAMP_RATE: "升温速率",
    IssueCategory.SOAK_TIME: "保温时间",
    IssueCategory.COOLING_RATE: "降温速率",
    IssueCategory.PROBE_DRIFT: "探头漂移",
    IssueCategory.THICKNESS_CONFLICT: "坯体厚度",
    IssueCategory.GLAZE_COMPATIBILITY: "釉料匹配",
    IssueCategory.THERMAL_DELTA: "热温差",
}


class ReportGenerator:
    """报告生成器"""

    def __init__(
        self,
        validation_result: ValidationResult,
        plan: Optional[FiringPlan] = None,
        workpieces: Optional[WorkpieceList] = None,
        simulation: Optional[ThermoSimulationResult] = None,
        config: Optional[KilnConfig] = None,
    ):
        self.validation = validation_result
        self.plan = plan
        self.workpieces = workpieces
        self.simulation = simulation
        self.config = config

    def generate_markdown(self) -> str:
        """生成 Markdown 格式报告"""
        lines = []
        
        lines.append("# 窑炉升温曲线校验报告")
        lines.append("")
        
        lines.append("## 校验概览")
        lines.append("")
        lines.append(f"- **计划名称**: {self.validation.plan_name}")
        lines.append(f"- **校验时间**: {self.validation.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"- **作品数量**: {self.validation.workpiece_count}")
        lines.append("")
        
        lines.append("### 问题统计")
        lines.append("")
        lines.append(f"- 🔴 **严重问题**: {self.validation.critical_count}")
        lines.append(f"- 🟡 **警告**: {self.validation.warning_count}")
        lines.append(f"- ℹ️ **信息提示**: {self.validation.info_count}")
        lines.append("")
        
        if self.validation.has_critical:
            lines.append("---")
            lines.append("## ⚠️ 严重问题 (必须修复)")
            lines.append("")
            for issue in self.validation.get_critical_issues():
                lines.extend(self._format_issue_markdown(issue, show_details=True))
                lines.append("")
        
        if self.validation.has_warnings:
            lines.append("---")
            lines.append("## 🟡 警告 (建议检查)")
            lines.append("")
            for issue in self.validation.get_warning_issues():
                lines.extend(self._format_issue_markdown(issue, show_details=True))
                lines.append("")
        
        info_issues = [i for i in self.validation.issues if i.severity == IssueSeverity.INFO]
        if info_issues:
            lines.append("---")
            lines.append("## ℹ️ 信息提示")
            lines.append("")
            for issue in info_issues:
                lines.extend(self._format_issue_markdown(issue, show_details=False))
                lines.append("")
        
        if self.plan:
            lines.append("---")
            lines.append("## 烧成计划详情")
            lines.append("")
            lines.append(f"- **类型**: {self.plan.firing_type}")
            lines.append(f"- **总时长**: {self.plan.total_duration_minutes} 分钟 ({self.plan.total_duration_hours:.1f} 小时)")
            lines.append(f"- **峰值温度**: {self.plan.peak_temperature_c}°C")
            lines.append(f"- **最大升温速率**: {self.plan.max_ramp_up_rate:.1f} °C/小时")
            lines.append("")
            lines.append("### 烧成段列表")
            lines.append("")
            lines.append("| 序号 | 段名 | 类型 | 起始温度 | 结束温度 | 时长 | 速率 |")
            lines.append("|------|------|------|----------|----------|------|------|")
            for idx, seg in enumerate(self.plan.segments, 1):
                seg_type_name = self._get_segment_type_name(seg.segment_type.value)
                rate_str = f"{seg.ramp_rate_c_per_hour:.1f} °C/h" if seg.ramp_rate_c_per_hour else "-"
                lines.append(
                    f"| {idx} | {seg.name} | {seg_type_name} | "
                    f"{seg.start_temperature_c}°C | {seg.end_temperature_c}°C | "
                    f"{seg.duration_minutes}min | {rate_str} |"
                )
            lines.append("")
        
        if self.workpieces and self.workpieces.count > 0:
            lines.append("---")
            lines.append("## 作品清单")
            lines.append("")
            lines.append(f"- **作品总数**: {self.workpieces.count}")
            lines.append(f"- **最大厚度**: {self.workpieces.max_thickness_cm} cm")
            lines.append(f"- **最小厚度**: {self.workpieces.min_thickness_cm} cm")
            lines.append(f"- **带釉作品**: {len(self.workpieces.get_glazed_workpieces())}")
            lines.append("")
            lines.append("### 作品列表")
            lines.append("")
            lines.append("| 编号 | 名称 | 厚度 | 粘土类型 | 外层釉 | 内层釉 |")
            lines.append("|------|------|------|----------|--------|--------|")
            for w in self.workpieces.workpieces:
                name = w.name or "-"
                glaze_outer = w.glaze_outer.name if w.glaze_outer else "-"
                glaze_inner = w.glaze_inner.name if w.glaze_inner else "-"
                lines.append(
                    f"| {w.id} | {name} | {w.thickness_cm}cm | "
                    f"{w.clay_type} | {glaze_outer} | {glaze_inner} |"
                )
            lines.append("")
        
        if self.simulation:
            lines.append("---")
            lines.append("## 热模拟结果")
            lines.append("")
            lines.append(f"- **模拟厚度**: {self.simulation.workpiece_thickness_cm} cm")
            lines.append(f"- **时间步长**: {self.simulation.time_step_minutes} 分钟")
            lines.append(f"- **总模拟步数**: {self.simulation.total_steps}")
            lines.append(f"- **最大内外温差**: {self.simulation.max_internal_delta_c:.1f} °C")
            lines.append(f"- **最高窑炉温度**: {self.simulation.peak_oven_temperature_c:.1f} °C")
            lines.append("")
            
            max_step = self.simulation.max_internal_delta_at_step
            if max_step:
                lines.append("### 最大温差详情")
                lines.append("")
                lines.append(f"- **发生时间**: {max_step.time_minutes} 分钟")
                lines.append(f"- **窑炉温度**: {max_step.oven_temperature_c:.1f} °C")
                lines.append(f"- **坯体表面**: {max_step.surface_temperature_c:.1f} °C")
                lines.append(f"- **坯体中心**: {max_step.core_temperature_c:.1f} °C")
                lines.append(f"- **内外温差**: {max_step.max_internal_delta_c:.1f} °C")
                if max_step.segment_name:
                    lines.append(f"- **所在段**: {max_step.segment_name}")
                lines.append("")
        
        if self.config:
            lines.append("---")
            lines.append("## 校验配置参数")
            lines.append("")
            lines.append("| 参数 | 值 | 说明 |")
            lines.append("|------|-----|------|")
            lines.append(f"| 最大升温速率 | {self.config.max_ramp_rate_c_per_hour} °C/h | 超过此值警告 |")
            lines.append(f"| 釉料容差 | ±{self.config.glaze_temperature_tolerance} °C | 温区匹配容差 |")
            lines.append(f"| 厚度警告阈值 | {self.config.thickness_warning_threshold_cm} cm | 超过即警告 |")
            lines.append(f"| 厚度临界阈值 | {self.config.thickness_critical_threshold_cm} cm | 超过即严重 |")
            lines.append(f"| 探头漂移阈值 | {self.config.probe_drift_threshold_c} °C | 偏差检测 |")
            lines.append("")
        
        lines.append("---")
        lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        lines.append("")
        
        return "\n".join(lines)

    def generate_csv(self) -> str:
        """生成 CSV 格式报告"""
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            "严重程度",
            "类别",
            "消息",
            "位置(分钟)",
            "位置(段名)",
            "建议",
            "详情",
        ])
        
        for issue in self.validation.issues:
            writer.writerow([
                SEVERITY_NAMES.get(issue.severity, issue.severity.value),
                CATEGORY_NAMES.get(issue.category, issue.category.value),
                issue.message,
                issue.location_minutes or "",
                issue.location_segment or "",
                issue.suggestion or "",
                json.dumps(issue.details, ensure_ascii=False) if issue.details else "",
            ])
        
        return output.getvalue()

    def generate_json(self, indent: int = 2) -> str:
        """生成 JSON 格式报告"""
        data: Dict[str, Any] = {
            "report_info": {
                "generated_at": self.validation.timestamp.isoformat(),
                "plan_name": self.validation.plan_name,
                "workpiece_count": self.validation.workpiece_count,
            },
            "summary": {
                "total_issues": self.validation.total_issues,
                "critical_count": self.validation.critical_count,
                "warning_count": self.validation.warning_count,
                "info_count": self.validation.info_count,
                "has_critical": self.validation.has_critical,
                "has_warnings": self.validation.has_warnings,
            },
            "issues": [self._issue_to_dict(i) for i in self.validation.issues],
        }
        
        if self.plan:
            data["firing_plan"] = {
                "name": self.plan.name,
                "description": self.plan.description,
                "firing_type": self.plan.firing_type,
                "total_duration_minutes": self.plan.total_duration_minutes,
                "peak_temperature_c": self.plan.peak_temperature_c,
                "max_ramp_up_rate": self.plan.max_ramp_up_rate,
                "segments": [
                    {
                        "name": s.name,
                        "type": s.segment_type.value,
                        "start_temp_c": s.start_temperature_c,
                        "end_temp_c": s.end_temperature_c,
                        "duration_minutes": s.duration_minutes,
                        "ramp_rate_c_per_hour": s.ramp_rate_c_per_hour,
                    }
                    for s in self.plan.segments
                ],
            }
        
        if self.workpieces:
            data["workpieces"] = {
                "count": self.workpieces.count,
                "max_thickness_cm": self.workpieces.max_thickness_cm,
                "min_thickness_cm": self.workpieces.min_thickness_cm,
                "items": [
                    {
                        "id": w.id,
                        "name": w.name,
                        "thickness_cm": w.thickness_cm,
                        "clay_type": w.clay_type,
                        "has_glaze": w.has_glaze,
                        "glaze_outer": {
                            "name": w.glaze_outer.name,
                            "min_c": w.glaze_outer.maturing_temp_min_c,
                            "max_c": w.glaze_outer.maturing_temp_max_c,
                        } if w.glaze_outer else None,
                        "glaze_inner": {
                            "name": w.glaze_inner.name,
                            "min_c": w.glaze_inner.maturing_temp_min_c,
                            "max_c": w.glaze_inner.maturing_temp_max_c,
                        } if w.glaze_inner else None,
                    }
                    for w in self.workpieces.workpieces
                ],
            }
        
        if self.simulation:
            data["thermal_simulation"] = {
                "workpiece_thickness_cm": self.simulation.workpiece_thickness_cm,
                "time_step_minutes": self.simulation.time_step_minutes,
                "total_steps": self.simulation.total_steps,
                "max_internal_delta_c": self.simulation.max_internal_delta_c,
                "peak_oven_temperature_c": self.simulation.peak_oven_temperature_c,
            }
        
        if self.config:
            data["config"] = self.config.model_dump()
        
        return json.dumps(data, ensure_ascii=False, indent=indent, default=str)

    def _format_issue_markdown(self, issue: ValidationIssue, show_details: bool = True) -> List[str]:
        """格式化单个问题为 Markdown"""
        lines = []
        
        icon = SEVERITY_ICONS.get(issue.severity, "❓")
        cat_name = CATEGORY_NAMES.get(issue.category, issue.category.value)
        
        lines.append(f"### {icon} [{cat_name}] {issue.message}")
        lines.append("")
        
        if issue.location_minutes or issue.location_segment:
            loc_parts = []
            if issue.location_segment:
                loc_parts.append(f"段: **{issue.location_segment}**")
            if issue.location_minutes:
                loc_parts.append(f"时间: **{issue.location_minutes} 分钟**")
            lines.append(f"- 位置: {', '.join(loc_parts)}")
            lines.append("")
        
        if issue.suggestion:
            lines.append(f"💡 **建议**: {issue.suggestion}")
            lines.append("")
        
        if show_details and issue.details:
            lines.append("<details>")
            lines.append("<summary>查看详情</summary>")
            lines.append("")
            lines.append("```json")
            lines.append(json.dumps(issue.details, ensure_ascii=False, indent=2))
            lines.append("```")
            lines.append("")
            lines.append("</details>")
            lines.append("")
        
        return lines

    def _issue_to_dict(self, issue: ValidationIssue) -> Dict[str, Any]:
        """将问题转为字典"""
        return {
            "severity": issue.severity.value,
            "category": issue.category.value,
            "severity_name": SEVERITY_NAMES.get(issue.severity, issue.severity.value),
            "category_name": CATEGORY_NAMES.get(issue.category, issue.category.value),
            "message": issue.message,
            "location_minutes": issue.location_minutes,
            "location_segment": issue.location_segment,
            "details": issue.details,
            "suggestion": issue.suggestion,
        }

    def _get_segment_type_name(self, type_value: str) -> str:
        """获取段类型中文名"""
        names = {
            "ramp_up": "升温",
            "soak": "保温",
            "ramp_down": "强制降温",
            "natural_cool": "自然冷却",
        }
        return names.get(type_value, type_value)


def generate_markdown_report(
    validation_result: ValidationResult,
    plan: Optional[FiringPlan] = None,
    workpieces: Optional[WorkpieceList] = None,
    simulation: Optional[ThermoSimulationResult] = None,
    config: Optional[KilnConfig] = None,
) -> str:
    """生成 Markdown 报告"""
    gen = ReportGenerator(validation_result, plan, workpieces, simulation, config)
    return gen.generate_markdown()


def generate_csv_report(
    validation_result: ValidationResult,
    plan: Optional[FiringPlan] = None,
    workpieces: Optional[WorkpieceList] = None,
    simulation: Optional[ThermoSimulationResult] = None,
    config: Optional[KilnConfig] = None,
) -> str:
    """生成 CSV 报告"""
    gen = ReportGenerator(validation_result, plan, workpieces, simulation, config)
    return gen.generate_csv()


def generate_json_report(
    validation_result: ValidationResult,
    plan: Optional[FiringPlan] = None,
    workpieces: Optional[WorkpieceList] = None,
    simulation: Optional[ThermoSimulationResult] = None,
    config: Optional[KilnConfig] = None,
    indent: int = 2,
) -> str:
    """生成 JSON 报告"""
    gen = ReportGenerator(validation_result, plan, workpieces, simulation, config)
    return gen.generate_json(indent=indent)


def generate_all_reports(
    output_dir: Path,
    base_name: str,
    validation_result: ValidationResult,
    plan: Optional[FiringPlan] = None,
    workpieces: Optional[WorkpieceList] = None,
    simulation: Optional[ThermoSimulationResult] = None,
    config: Optional[KilnConfig] = None,
) -> Dict[str, Path]:
    """
    生成所有三种格式的报告
    
    Returns:
        字典: {"markdown": path, "csv": path, "json": path}
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    
    gen = ReportGenerator(validation_result, plan, workpieces, simulation, config)
    
    paths = {}
    
    md_path = output_dir / f"{base_name}.md"
    md_path.write_text(gen.generate_markdown(), encoding="utf-8")
    paths["markdown"] = md_path
    
    csv_path = output_dir / f"{base_name}.csv"
    csv_path.write_text(gen.generate_csv(), encoding="utf-8-sig")
    paths["csv"] = csv_path
    
    json_path = output_dir / f"{base_name}.json"
    json_path.write_text(gen.generate_json(), encoding="utf-8")
    paths["json"] = json_path
    
    return paths
