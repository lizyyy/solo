"""报告生成器

支持导出Markdown和CSV格式的报告，包含：
- 仿真结果概览
- 各批次温度变化详情
- 热负荷分析
- 风险评估结果
- 改进建议
"""

import csv
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime

from pre_cool_validator.models import (
    SimulationResult,
    BatchSimulationResult,
    RiskReport,
    RiskAssessment,
    RiskType,
    RiskSeverity,
    LoadingPlan,
    VehicleConfig,
)


class MarkdownReporter:
    """Markdown报告生成器"""

    def __init__(self):
        self.report_lines: list = []

    def _add(self, text: str = ""):
        """添加一行内容"""
        self.report_lines.append(text)

    def _add_header(self, level: int, text: str):
        """添加标题"""
        prefix = "#" * level
        self._add(f"{prefix} {text}")
        self._add()

    def _add_table(self, headers: list, rows: list):
        """添加表格"""
        if not headers:
            return

        self._add(f"| {' | '.join(str(h) for h in headers)} |")
        self._add(f"| {' | '.join(['---'] * len(headers))} |")

        for row in rows:
            formatted_row = []
            for i, cell in enumerate(row):
                if isinstance(cell, float):
                    formatted_row.append(f"{cell:.2f}")
                elif isinstance(cell, (datetime,)):
                    formatted_row.append(cell.strftime("%Y-%m-%d %H:%M:%S"))
                else:
                    formatted_row.append(str(cell))
            self._add(f"| {' | '.join(formatted_row)} |")

        self._add()

    def _severity_badge(self, severity: RiskSeverity) -> str:
        """生成严重程度徽章"""
        badges = {
            RiskSeverity.HIGH: "🔴 **高风险**",
            RiskSeverity.MEDIUM: "🟡 **中风险**",
            RiskSeverity.LOW: "🟢 **低风险**",
        }
        return badges.get(severity, str(severity))

    def _risk_type_label(self, risk_type: RiskType) -> str:
        """风险类型中文标签"""
        labels = {
            RiskType.PRECOOL_INSUFFICIENT: "预冷不足",
            RiskType.COOLING_CAPACITY_INSUFFICIENT: "制冷量不够",
            RiskType.DOOR_OPEN_TOO_LONG: "开门过久",
            RiskType.TARGET_TEMP_CONFLICT: "目标温度冲突",
            RiskType.BATCH_TIMEOUT: "批次超时",
            RiskType.AMBIENT_TEMP_HIGH: "环境温度过高",
        }
        return labels.get(risk_type, str(risk_type))

    def generate(
        self,
        simulation: SimulationResult,
        risk_report: Optional[RiskReport] = None,
        plan: Optional[LoadingPlan] = None,
        vehicle: Optional[VehicleConfig] = None,
    ) -> str:
        """
        生成完整的Markdown报告

        Args:
            simulation: 仿真结果
            risk_report: 风险报告（可选）
            plan: 装车计划（可选）
            vehicle: 车辆配置（可选）

        Returns:
            str: Markdown格式的报告内容
        """
        self.report_lines = []

        self._add_header(1, "预冷装车热负荷校验报告")
        self._add(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self._add(f"**计划ID**: {simulation.plan_id}")
        self._add(f"**车辆ID**: {simulation.vehicle_id}")
        self._add()

        if risk_report:
            self._add_header(2, "风险评估概览")

            status_badge = "✅ **通过**" if risk_report.overall_pass else "❌ **不通过**"
            self._add(f"**整体状态**: {status_badge}")
            self._add()

            risk_headers = ["风险等级", "数量"]
            risk_rows = [
                ["🔴 高风险", risk_report.high_severity],
                ["🟡 中风险", risk_report.medium_severity],
                ["🟢 低风险", risk_report.low_severity],
                ["**总计**", risk_report.total_risks],
            ]
            self._add_table(risk_headers, risk_rows)

        self._add_header(2, "仿真参数概览")

        params_headers = ["参数", "值"]
        params_rows = [
            ["环境温度", f"{simulation.ambient_temp} °C"],
            ["总预冷时间", f"{simulation.total_precool_time} 分钟"],
            ["开门时长", f"{simulation.door_open_duration} 分钟"],
            ["车辆制冷量", f"{simulation.vehicle_cooling_capacity} kW"],
        ]
        self._add_table(params_headers, params_rows)

        self._add_header(2, "冷量平衡分析")

        energy_headers = ["项目", "能量 (kJ)"]
        energy_rows = [
            ["货品冷却需冷量", simulation.total_cooling_required],
            ["开门热侵入", simulation.door_heat_infiltration],
            ["箱体热侵入", simulation.ambient_heat_infiltration],
            ["呼吸热", simulation.respiration_heat_total],
            ["---", "---"],
            ["**总需冷量**", simulation.total_cooling_required + simulation.door_heat_infiltration + simulation.ambient_heat_infiltration + simulation.respiration_heat_total],
            ["**总供冷量**", simulation.total_cooling_provided],
            ["---", "---"],
            ["**冷量盈余**", simulation.cooling_surplus],
        ]
        self._add_table(energy_headers, energy_rows)

        surplus_status = "✅ 盈余" if simulation.cooling_surplus >= 0 else "❌ 不足"
        self._add(f"**冷量状态**: {surplus_status}")
        self._add()

        self._add_header(2, "批次仿真结果详情")

        batch_headers = [
            "批次ID", "货品名称", "初温(°C)", "目标(°C)",
            "终温(°C)", "达标时间(分)", "是否达标", "峰值热负荷(kW)"
        ]
        batch_rows = []

        for br in simulation.batch_results:
            status = "✅ 是" if br.reached_target else "❌ 否"
            time_to_target = f"{br.time_to_target:.1f}" if br.time_to_target else "-"

            batch_rows.append([
                br.batch_id,
                br.product_name,
                br.initial_temp,
                br.target_temp,
                br.final_temp,
                time_to_target,
                status,
                br.peak_heat_load,
            ])

        self._add_table(batch_headers, batch_rows)

        if risk_report and risk_report.risks:
            self._add_header(2, "风险详情")

            for i, risk in enumerate(risk_report.risks, 1):
                self._add_header(3, f"风险 {i}: {self._risk_type_label(risk.risk_type)}")
                self._add(f"**严重程度**: {self._severity_badge(risk.severity)}")
                self._add()
                self._add(f"**描述**: {risk.message}")
                self._add()

                if risk.affected_batches:
                    self._add(f"**受影响批次**: {', '.join(risk.affected_batches)}")
                    self._add()

                if risk.suggestion:
                    self._add("**改进建议**:")
                    self._add()
                    self._add("```")
                    for line in risk.suggestion.split("\n"):
                        self._add(line)
                    self._add("```")
                    self._add()

        if plan:
            self._add_header(2, "装车计划配置")

            plan_headers = ["批次ID", "货品名称", "体积(m³)", "质量(kg)", "到达时间(分)"]
            plan_rows = []
            for batch in plan.batches:
                plan_rows.append([
                    batch.batch_id,
                    batch.product_name,
                    batch.volume,
                    batch.mass,
                    batch.arrival_time,
                ])
            self._add_table(plan_headers, plan_rows)

        self._add("---")
        self._add()
        self._add("*报告由预冷装车热负荷校验器自动生成*")

        return "\n".join(self.report_lines)

    def save(
        self,
        file_path: Path,
        simulation: SimulationResult,
        risk_report: Optional[RiskReport] = None,
        plan: Optional[LoadingPlan] = None,
        vehicle: Optional[VehicleConfig] = None,
    ) -> None:
        """保存报告到文件"""
        content = self.generate(simulation, risk_report, plan, vehicle)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)


class CSVReporter:
    """CSV报告生成器"""

    def export_batch_results(
        self,
        simulation: SimulationResult,
        file_path: Path,
    ) -> None:
        """
        导出批次仿真结果到CSV

        Args:
            simulation: 仿真结果
            file_path: 输出文件路径
        """
        headers = [
            "plan_id", "batch_id", "product_name",
            "initial_temp", "target_temp", "final_temp",
            "reached_target", "time_to_target_min",
            "peak_heat_load_kw", "avg_heat_load_kw",
            "total_heat_removed_kj",
        ]

        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)

            for br in simulation.batch_results:
                writer.writerow([
                    simulation.plan_id,
                    br.batch_id,
                    br.product_name,
                    round(br.initial_temp, 2),
                    round(br.target_temp, 2),
                    round(br.final_temp, 2),
                    1 if br.reached_target else 0,
                    round(br.time_to_target, 2) if br.time_to_target else "",
                    round(br.peak_heat_load, 2),
                    round(br.avg_heat_load, 2),
                    round(br.total_heat_removed, 2),
                ])

    def export_energy_balance(
        self,
        simulation: SimulationResult,
        file_path: Path,
    ) -> None:
        """
        导出能量平衡到CSV

        Args:
            simulation: 仿真结果
            file_path: 输出文件路径
        """
        total_demand = (
            simulation.total_cooling_required
            + simulation.door_heat_infiltration
            + simulation.ambient_heat_infiltration
            + simulation.respiration_heat_total
        )

        headers = ["item", "value_kj", "description"]
        rows = [
            ["product_cooling", round(simulation.total_cooling_required, 2), "货品冷却需冷量"],
            ["door_infiltration", round(simulation.door_heat_infiltration, 2), "开门热侵入"],
            ["ambient_conduction", round(simulation.ambient_heat_infiltration, 2), "箱体热侵入"],
            ["respiration", round(simulation.respiration_heat_total, 2), "呼吸热"],
            ["total_demand", round(total_demand, 2), "总需冷量"],
            ["total_supply", round(simulation.total_cooling_provided, 2), "总供冷量"],
            ["surplus", round(simulation.cooling_surplus, 2), "冷量盈余"],
        ]

        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)

    def export_time_series(
        self,
        simulation: SimulationResult,
        file_path: Path,
    ) -> None:
        """
        导出时间序列数据到CSV

        Args:
            simulation: 仿真结果
            file_path: 输出文件路径
        """
        headers = [
            "plan_id", "batch_id", "time_minute", "batch_temp",
            "heat_load", "cooling_provided", "ambient_heat_infiltration",
            "respiration_heat",
        ]

        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)

            for br in simulation.batch_results:
                for ts in br.time_steps:
                    writer.writerow([
                        simulation.plan_id,
                        br.batch_id,
                        round(ts.time_minute, 2),
                        round(ts.batch_temp, 2),
                        round(ts.heat_load, 2),
                        round(ts.cooling_provided, 2),
                        round(ts.ambient_heat_infiltration, 2),
                        round(ts.respiration_heat, 2),
                    ])

    def export_risks(
        self,
        risk_report: RiskReport,
        file_path: Path,
    ) -> None:
        """
        导出风险评估结果到CSV

        Args:
            risk_report: 风险报告
            file_path: 输出文件路径
        """
        headers = [
            "plan_id", "risk_type", "severity", "message",
            "affected_batches", "suggestion",
        ]

        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)

            for risk in risk_report.risks:
                writer.writerow([
                    risk_report.plan_id,
                    risk.risk_type.value,
                    risk.severity.value,
                    risk.message,
                    ";".join(risk.affected_batches),
                    risk.suggestion or "",
                ])


class ReportExporter:
    """综合报告导出器"""

    def __init__(self):
        self.markdown_reporter = MarkdownReporter()
        self.csv_reporter = CSVReporter()

    def export_all(
        self,
        output_dir: Path,
        simulation: SimulationResult,
        risk_report: Optional[RiskReport] = None,
        plan: Optional[LoadingPlan] = None,
        vehicle: Optional[VehicleConfig] = None,
        prefix: str = "",
    ) -> Dict[str, Path]:
        """
        导出所有格式的报告

        Args:
            output_dir: 输出目录
            simulation: 仿真结果
            risk_report: 风险报告
            plan: 装车计划
            vehicle: 车辆配置
            prefix: 文件名前缀

        Returns:
            Dict[str, Path]: 导出的文件路径映射
        """
        output_dir.mkdir(parents=True, exist_ok=True)
        prefix = prefix or simulation.plan_id

        exported_files: Dict[str, Path] = {}

        md_path = output_dir / f"{prefix}_report.md"
        self.markdown_reporter.save(md_path, simulation, risk_report, plan, vehicle)
        exported_files["markdown"] = md_path

        batch_path = output_dir / f"{prefix}_batch_results.csv"
        self.csv_reporter.export_batch_results(simulation, batch_path)
        exported_files["batch_results"] = batch_path

        energy_path = output_dir / f"{prefix}_energy_balance.csv"
        self.csv_reporter.export_energy_balance(simulation, energy_path)
        exported_files["energy_balance"] = energy_path

        ts_path = output_dir / f"{prefix}_time_series.csv"
        self.csv_reporter.export_time_series(simulation, ts_path)
        exported_files["time_series"] = ts_path

        if risk_report:
            risks_path = output_dir / f"{prefix}_risks.csv"
            self.csv_reporter.export_risks(risk_report, risks_path)
            exported_files["risks"] = risks_path

        return exported_files
