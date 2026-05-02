import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from rain_garden_checker.models.data_models import (
    SimulationResult,
    CheckReport,
    ProjectConfig,
    WarningLevel,
    PondGeometry,
    SoilInfiltrationTest,
    CatchmentArea,
    SimulationTimeStep,
)


class ReportExporter:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _generate_markdown_summary(
        self,
        project: Optional[ProjectConfig],
        results: List[SimulationResult],
        check_report: Optional[CheckReport],
        pond: Optional[PondGeometry],
        soil: Optional[SoilInfiltrationTest],
        catchments: List[CatchmentArea],
    ) -> str:
        lines = []

        lines.append("# 雨水花园渗透复核报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')")
        lines.append("")

        if project:
            lines.append("## 项目信息")
            lines.append("")
            lines.append(f"- **项目名称**: {project.project_name}")
            lines.append(f"- **项目ID**: {project.project_id}")
            if project.description:
                lines.append(f"- **描述**: {project.description}")
            lines.append("")
            lines.append("### 模拟配置")
            lines.append("")
            lines.append(f"- **入渗模型**: {project.simulation_config.infiltration_model.value}")
            lines.append(f"- **时间步长**: {project.simulation_config.time_step} {project.simulation_config.time_unit.value}")
            lines.append(f"- **最大排空时间**: {project.simulation_config.max_drain_hours} 小时")
            lines.append(f"- **启用地下排水**: {'是' if project.simulation_config.enable_underdrain else '否'}")
            lines.append("")

        lines.append("## 输入参数概览")
        lines.append("")

        if pond:
            lines.append("### 池体几何")
            lines.append("")
            lines.append(f"- **名称**: {pond.name}")
            lines.append(f"- **表面积**: {pond.surface_area} {pond.area_unit.value}")
            lines.append(f"- **深度**: {pond.depth} {pond.depth_unit.value}")
            lines.append(f"- **有效容积**: {pond.storage_volume:.2f} m³")
            if pond.underdrain_rate:
                lines.append(f"- **排水速率**: {pond.underdrain_rate} {pond.underdrain_unit.value}/{pond.underdrain_time_unit.value}")
            lines.append("")

        if soil:
            lines.append("### 土壤参数")
            lines.append("")
            lines.append(f"- **土壤类型**: {soil.soil_type}")
            lines.append(f"- **饱和导水率**: {soil.saturated_hydraulic_conductivity} {soil.conductivity_unit.value}/{soil.conductivity_time_unit.value}")
            lines.append(f"- **初始含水量**: {soil.initial_moisture:.2f}")
            lines.append(f"- **饱和含水量**: {soil.saturated_moisture:.2f}")
            lines.append("")

        if catchments:
            lines.append("### 汇水区")
            lines.append("")
            lines.append("| 名称 | 面积 | 径流系数 | 土地利用 | 不透水率 |")
            lines.append("|------|------|----------|----------|----------|")
            for c in catchments:
                land_use = c.land_use_type or "-"
                impervious = f"{c.impervious_ratio:.1%}" if c.impervious_ratio else "-"
                lines.append(
                    f"| {c.name} | {c.area} {c.area_unit.value} | {c.runoff_coefficient:.2f} | {land_use} | {impervious} |"
                )
            lines.append("")

        if results:
            lines.append("## 模拟结果汇总")
            lines.append("")

            lines.append("| 降雨 | 重现期 | 总径流 | 总入渗 | 总溢流 | 峰值水位 | 排空时间 | 溢流 |")
            lines.append("|------|--------|--------|--------|--------|----------|----------|------|")
            for r in results:
                overflow_mark = "⚠️ **是**" if r.has_overflow else "否"
                lines.append(
                    f"| {r.rainfall_name} | {r.return_period}年 | {r.total_runoff_volume:.2f} m³ | {r.total_infiltration_volume:.2f} m³ | {r.total_overflow_volume:.2f} m³ | {r.peak_pond_level:.3f} m | {r.drain_time_hours:.1f} h | {overflow_mark} |"
                )
            lines.append("")

            for r in results:
                lines.append(f"### {r.rainfall_name} ({r.return_period}年一遇)")
                lines.append("")

                if r.has_overflow:
                    lines.append(
                        f"> **⚠️ 警告**: 发生溢流 {r.total_overflow_volume:.2f} m³"
                    )
                    lines.append("")

                lines.append("- **水量平衡:")
                lines.append(f"  - 总径流入量: {r.total_runoff_volume:.2f} m³")
                lines.append(f"  - 总入渗量: {r.total_infiltration_volume:.2f} m³")
                lines.append(f"  - 总溢流量: {r.total_overflow_volume:.2f} m³")
                lines.append("")
                lines.append(f"- **峰值蓄水量**: {r.peak_storage:.2f} m³")
                lines.append(f"- **峰值水位**: {r.peak_pond_level * 100:.1f} cm")
                lines.append(f"- **排空时间**: {r.drain_time_hours:.1f} 小时")

                if r.drain_time_hours > 72:
                    lines.append(f"  ⚠️ 超过72小时限值")
                lines.append("")

        if check_report and check_report.warnings:
            lines.append("## 规则校验结果")
            lines.append("")

            criticals = [w for w in check_report.warnings if w.level == WarningLevel.CRITICAL]
            warnings = [w for w in check_report.warnings if w.level == WarningLevel.WARNING]
            infos = [w for w in check_report.warnings if w.level == WarningLevel.INFO]

            if criticals:
                lines.append("### 🔴 严重问题")
                lines.append("")
                for w in criticals:
                    lines.append(f"**{w.warning_type.value}**: {w.message}")
                    if w.suggestion:
                        lines.append(f"> 建议: {w.suggestion}")
                    lines.append("")

            if warnings:
                lines.append("### 🟡 警告")
                lines.append("")
                for w in warnings:
                    lines.append(f"**{w.warning_type.value}**: {w.message}")
                    if w.suggestion:
                        lines.append(f"> 建议: {w.suggestion}")
                    lines.append("")

            if infos:
                lines.append("### ℹ️ 信息")
                lines.append("")
                for w in infos:
                    lines.append(f"{w.message}")
                lines.append("")

            if check_report.has_critical:
                lines.append("---")
                lines.append("**结论**: 复核不通过，存在严重问题需要整改。")
            elif check_report.has_warnings:
                lines.append("---")
                lines.append("**结论**: 复核有条件通过，存在警告项建议优化。")
            else:
                lines.append("---")
                lines.append("**结论**: 复核通过。")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("> 本报告由雨水花园渗透复核器自动生成。")

        return "\n".join(lines)

    def export_markdown(
        self,
        project: Optional[ProjectConfig],
        results: List[SimulationResult],
        check_report: Optional[CheckReport],
        pond: Optional[PondGeometry] = None,
        soil: Optional[SoilInfiltrationTest] = None,
        catchments: Optional[List[CatchmentArea]] = None,
        filename: str = "report.md",
    ) -> Path:
        content = self._generate_markdown_summary(
            project,
            results,
            check_report,
            pond,
            soil,
            catchments or [],
        )

        output_path = self.output_dir / filename
        output_path.write_text(content, encoding="utf-8")

        return output_path

    def export_results_csv(
        self,
        results: List[SimulationResult],
        filename: str = "simulation_results.csv",
    ) -> Path:
        output_path = self.output_dir / filename

        with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)

            writer.writerow([
                "降雨名称", "重现期(年)", "总径流量(m³)", "总入渗量(m³)",
                "总溢流量(m³)", "峰值水位(m)", "峰值蓄水量(m³)",
                "排空时间(h)", "是否溢流"
            ])

            for r in results:
                writer.writerow([
                    r.rainfall_name,
                    r.return_period,
                    f"{r.total_runoff_volume:.4f}",
                    f"{r.total_infiltration_volume:.4f}",
                    f"{r.total_overflow_volume:.4f}",
                    f"{r.peak_pond_level:.4f}",
                    f"{r.peak_storage:.4f}",
                    f"{r.drain_time_hours:.2f}",
                    "是" if r.has_overflow else "否"
                ])

        return output_path

    def export_timeseries_csv(
        self,
        result: SimulationResult,
        filename: Optional[str] = None,
    ) -> Path:
        safe_name = result.rainfall_name.replace(" ", "_").lower()
        output_filename = filename or f"timeseries_{safe_name}_{result.return_period}y.csv"
        output_path = self.output_dir / output_filename

        with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)

            writer.writerow([
                "时间(h)", "降雨强度(mm/h)", "径流流入(m³/h)",
                "入渗率(m³/h)", "池体水位(m)", "蓄水量(m³)",
                "溢流率(m³/h)", "排水率(m³/h)",
                "累计入渗(m³)", "累计溢流(m³)"
            ])

            for step in result.time_series:
                writer.writerow([
                    f"{step.time:.4f}",
                    f"{step.rainfall_intensity:.4f}",
                    f"{step.runoff_inflow:.4f}",
                    f"{step.infiltration_rate:.4f}",
                    f"{step.pond_level:.6f}",
                    f"{step.storage_volume:.4f}",
                    f"{step.overflow_rate:.4f}",
                    f"{step.underdrain_rate:.4f}",
                    f"{step.cumulative_infiltration:.4f}",
                    f"{step.cumulative_overflow:.4f}",
                ])

        return output_path

    def export_warnings_csv(
        self,
        check_report: CheckReport,
        filename: str = "warnings.csv",
    ) -> Path:
        output_path = self.output_dir / filename

        with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)

            writer.writerow([
                "级别", "类型", "消息", "字段", "值", "建议"
            ])

            for w in check_report.warnings:
                value_str = str(w.value) if w.value is not None else ""
                writer.writerow([
                    w.level.value,
                    w.warning_type.value,
                    w.message,
                    w.field or "",
                    value_str,
                    w.suggestion or "",
                ])

        return output_path

    def export_json(
        self,
        project: Optional[ProjectConfig],
        results: List[SimulationResult],
        check_report: Optional[CheckReport],
        pond: Optional[PondGeometry] = None,
        soil: Optional[SoilInfiltrationTest] = None,
        catchments: Optional[List[CatchmentArea]] = None,
        filename: str = "report.json",
    ) -> Path:
        data: Dict[str, Any] = {
            "generated_at": datetime.now().isoformat(),
        }

        if project:
            data["project"] = {
                "name": project.project_name,
                "id": project.project_id,
                "description": project.description,
                "simulation_config": {
                    "infiltration_model": project.simulation_config.infiltration_model.value,
                    "time_step": project.simulation_config.time_step,
                    "time_unit": project.simulation_config.time_unit.value,
                    "max_drain_hours": project.simulation_config.max_drain_hours,
                    "enable_underdrain": project.simulation_config.enable_underdrain,
                },
            }

        if pond:
            data["pond"] = {
                "name": pond.name,
                "surface_area": pond.surface_area,
                "area_unit": pond.area_unit.value,
                "depth": pond.depth,
                "depth_unit": pond.depth_unit.value,
                "storage_volume": pond.storage_volume,
                "underdrain_rate": pond.underdrain_rate,
            }

        if soil:
            data["soil"] = {
                "soil_type": soil.soil_type,
                "saturated_hydraulic_conductivity": soil.saturated_hydraulic_conductivity,
                "conductivity_unit": soil.conductivity_unit.value,
                "conductivity_time_unit": soil.conductivity_time_unit.value,
                "initial_moisture": soil.initial_moisture,
                "saturated_moisture": soil.saturated_moisture,
            }

        if catchments:
            data["catchments"] = [
                {
                    "name": c.name,
                    "area": c.area,
                    "area_unit": c.area_unit.value,
                    "runoff_coefficient": c.runoff_coefficient,
                    "land_use_type": c.land_use_type,
                    "impervious_ratio": c.impervious_ratio,
                }
                for c in catchments
            ]

        if results:
            data["simulation_results"] = [
                {
                    "rainfall_name": r.rainfall_name,
                    "return_period": r.return_period,
                    "total_runoff_volume": r.total_runoff_volume,
                    "total_infiltration_volume": r.total_infiltration_volume,
                    "total_overflow_volume": r.total_overflow_volume,
                    "peak_pond_level": r.peak_pond_level,
                    "peak_storage": r.peak_storage,
                    "drain_time_hours": r.drain_time_hours,
                    "has_overflow": r.has_overflow,
                }
                for r in results
            ]

        if check_report:
            data["check_report"] = {
                "project_id": check_report.project_id,
                "checked_at": check_report.checked_at.isoformat(),
                "has_critical": check_report.has_critical,
                "has_warnings": check_report.has_warnings,
                "warnings": [
                    {
                        "level": w.level.value,
                        "warning_type": w.warning_type.value,
                        "message": w.message,
                        "field": w.field,
                        "value": w.value,
                        "suggestion": w.suggestion,
                    }
                    for w in check_report.warnings
                ],
            }

        output_path = self.output_dir / filename
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)

        return output_path

    def export_full_package(
        self,
        project: Optional[ProjectConfig],
        results: List[SimulationResult],
        check_report: Optional[CheckReport],
        pond: Optional[PondGeometry] = None,
        soil: Optional[SoilInfiltrationTest] = None,
        catchments: Optional[List[CatchmentArea]] = None,
        prefix: str = "",
    ) -> Dict[str, Path]:
        outputs: Dict[str, Path] = {}

        md_filename = f"{prefix}report.md" if prefix else "report.md"
        outputs["markdown"] = self.export_markdown(
            project, results, check_report, pond, soil, catchments, md_filename
        )

        csv_filename = f"{prefix}summary.csv" if prefix else "summary.csv"
        outputs["summary_csv"] = self.export_results_csv(results, csv_filename)

        for r in results:
            safe_name = r.rainfall_name.replace(" ", "_").lower()
            ts_filename = f"{prefix}timeseries_{safe_name}_{r.return_period}y.csv" if prefix else f"timeseries_{safe_name}_{r.return_period}y.csv"
            outputs[f"timeseries_{safe_name}"] = self.export_timeseries_csv(r, ts_filename)

        if check_report and check_report.warnings:
            warn_filename = f"{prefix}warnings.csv" if prefix else "warnings.csv"
            outputs["warnings_csv"] = self.export_warnings_csv(check_report, warn_filename)

        json_filename = f"{prefix}report.json" if prefix else "report.json"
        outputs["json"] = self.export_json(
            project, results, check_report, pond, soil, catchments, json_filename
        )

        return outputs
