"""实验批改表生成器。

生成带处理口径的实验批改表，按状态分类展示记录（已确认、待补、人工更正），
便于任课老师批改和查阅。
"""

from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime
from collections import defaultdict
import json

import pandas as pd

from .models import (
    ExperimentRecord,
    CalibrationRecord,
    FitResult,
    DataGap,
    ProcessingSummary,
    DataStatus,
    RecordSource,
)


class ReportGenerator:
    """实验批改表生成器。

    生成多种格式的批改表，包含完整的数据处理口径和各状态记录分类。
    """

    def __init__(self, output_dir: Optional[str] = None):
        self.output_dir = Path(output_dir) if output_dir else Path.cwd()
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_grading_report(
        self,
        experiment_records: List[ExperimentRecord],
        fit_result: Optional[FitResult],
        processing_summary: ProcessingSummary,
        gaps: List[DataGap],
        calibration_records: Optional[List[CalibrationRecord]] = None,
        student_name: str = "",
        student_id: str = "",
    ) -> Dict[str, Any]:
        """生成完整的实验批改表。

        Args:
            experiment_records: 实验记录列表
            fit_result: 拟合结果
            processing_summary: 数据处理摘要
            gaps: 数据缺口列表
            calibration_records: 标定记录列表（可选）
            student_name: 学生姓名
            student_id: 学号

        Returns:
            包含批改表所有内容的字典
        """
        confirmed_records = [r for r in experiment_records if r.status == DataStatus.CONFIRMED]
        pending_records = [r for r in experiment_records if r.status == DataStatus.PENDING]
        manual_records = [r for r in experiment_records if r.status == DataStatus.MANUAL_CORRECTED]
        duplicate_records = [r for r in experiment_records if r.status == DataStatus.DUPLICATE]
        invalid_records = [r for r in experiment_records if r.status == DataStatus.INVALID]

        report = {
            "header": {
                "report_title": "弹簧振子实验批改表",
                "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "student_name": student_name,
                "student_id": student_id,
            },
            "processing_policy": processing_summary.processing_policy,
            "summary": {
                "total_records": len(experiment_records),
                "confirmed": len(confirmed_records),
                "pending": len(pending_records),
                "manual_corrected": len(manual_records),
                "duplicate": len(duplicate_records),
                "invalid": len(invalid_records),
                "used_for_fitting": processing_summary.records_used_for_fitting,
                "data_gaps": len(gaps),
            },
            "warnings": processing_summary.warnings,
            "errors": processing_summary.errors,
            "confirmed_records": [r.to_dict() for r in confirmed_records],
            "pending_records": [r.to_dict() for r in pending_records],
            "manual_corrected_records": [r.to_dict() for r in manual_records],
            "fit_result": fit_result.to_dict() if fit_result else None,
            "data_gaps": [g.to_dict() for g in gaps],
            "gap_summary": self._generate_gap_summary(gaps),
            "calibration_summary": self._generate_calibration_summary(calibration_records) if calibration_records else None,
            "grading_remarks": self._generate_grading_remarks(
                confirmed_records,
                pending_records,
                manual_records,
                fit_result,
                gaps,
            ),
        }

        return report

    def export_to_excel(
        self,
        report: Dict[str, Any],
        filename: str = "spring_oscillator_grading_report.xlsx",
    ) -> Path:
        """将批改表导出为Excel文件。

        Args:
            report: 批改表字典
            filename: 输出文件名

        Returns:
            输出文件路径
        """
        output_path = self.output_dir / filename

        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            self._write_summary_sheet(writer, report)
            self._write_confirmed_sheet(writer, report)
            self._write_pending_sheet(writer, report)
            self._write_manual_sheet(writer, report)
            self._write_fit_result_sheet(writer, report)
            self._write_gaps_sheet(writer, report)
            self._write_policy_sheet(writer, report)

        return output_path

    def export_to_csv(
        self,
        report: Dict[str, Any],
        prefix: str = "spring_oscillator",
    ) -> List[Path]:
        """将批改表导出为多个CSV文件。

        Args:
            report: 批改表字典
            prefix: 文件名前缀

        Returns:
            输出文件路径列表
        """
        output_files = []

        if report["confirmed_records"]:
            df = pd.DataFrame(report["confirmed_records"])
            path = self.output_dir / f"{prefix}_confirmed.csv"
            df.to_csv(path, index=False, encoding="utf-8-sig")
            output_files.append(path)

        if report["pending_records"]:
            df = pd.DataFrame(report["pending_records"])
            path = self.output_dir / f"{prefix}_pending.csv"
            df.to_csv(path, index=False, encoding="utf-8-sig")
            output_files.append(path)

        if report["manual_corrected_records"]:
            df = pd.DataFrame(report["manual_corrected_records"])
            path = self.output_dir / f"{prefix}_manual_corrected.csv"
            df.to_csv(path, index=False, encoding="utf-8-sig")
            output_files.append(path)

        if report["data_gaps"]:
            df = pd.DataFrame(report["data_gaps"])
            path = self.output_dir / f"{prefix}_data_gaps.csv"
            df.to_csv(path, index=False, encoding="utf-8-sig")
            output_files.append(path)

        return output_files

    def export_to_json(
        self,
        report: Dict[str, Any],
        filename: str = "spring_oscillator_grading_report.json",
    ) -> Path:
        """将批改表导出为JSON文件。

        Args:
            report: 批改表字典
            filename: 输出文件名

        Returns:
            输出文件路径
        """
        output_path = self.output_dir / filename

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        return output_path

    def print_console_report(self, report: Dict[str, Any]) -> None:
        """在控制台打印美观的批改报告。

        Args:
            report: 批改表字典
        """
        try:
            from rich.console import Console
            from rich.table import Table
            from rich.panel import Panel
            from rich.text import Text

            console = Console()

            header = report["header"]
            summary = report["summary"]

            console.print()
            console.print(Panel.fit(
                Text(f"📊 {header['report_title']}", style="bold blue"),
                subtitle=f"生成时间: {header['generated_at']}",
            ))

            if header["student_name"] or header["student_id"]:
                console.print(f"\n👤 学生: {header['student_name']} ({header['student_id']})")

            console.print()
            console.print("📋 数据处理口径")
            console.print("─" * 60)
            console.print(report["processing_policy"])

            console.print()
            console.print("📈 数据统计")
            console.print("─" * 60)

            stat_table = Table(show_header=True, header_style="bold")
            stat_table.add_column("状态", style="cyan")
            stat_table.add_column("数量", justify="right", style="magenta")
            stat_table.add_column("说明", style="dim")

            stat_table.add_row(
                "[green]已确认[/green]",
                str(summary["confirmed"]),
                "可用于拟合的有效数据",
            )
            stat_table.add_row(
                "[yellow]待补[/yellow]",
                str(summary["pending"]),
                "需要人工复核或补充的数据",
            )
            stat_table.add_row(
                "[blue]人工更正[/blue]",
                str(summary["manual_corrected"]),
                "人工修改过的记录（含原始值）",
            )
            stat_table.add_row(
                "[dim]重复项[/dim]",
                str(summary["duplicate"]),
                "已去重的重复数据",
            )
            stat_table.add_row(
                "[red]无效[/red]",
                str(summary["invalid"]),
                "不符合物理规律的记录",
            )
            stat_table.add_row(
                "[bold]用于拟合[/bold]",
                str(summary["used_for_fitting"]),
                "实际参与拟合计算的记录数",
            )

            console.print(stat_table)

            if report["warnings"]:
                console.print()
                console.print("⚠️  警告信息")
                console.print("─" * 60)
                for i, warning in enumerate(report["warnings"], 1):
                    console.print(f"  {i}. {warning}")

            if report["errors"]:
                console.print()
                console.print("❌ 错误信息")
                console.print("─" * 60)
                for i, error in enumerate(report["errors"], 1):
                    console.print(f"  {i}. {error}")

            if report["fit_result"]:
                console.print()
                console.print("🎯 拟合结果")
                console.print("─" * 60)

                fit = report["fit_result"]
                fit_table = Table(show_header=False, header_style="bold")
                fit_table.add_column("参数", style="cyan")
                fit_table.add_column("值", style="magenta")

                fit_table.add_row("拟合方法", fit["fit_method"])
                fit_table.add_row("理论公式", fit["formula"])
                fit_table.add_row(
                    "弹簧劲度系数 k",
                    f"{fit['spring_constant_k']} ± {fit['spring_constant_uncertainty']} N/m",
                )
                fit_table.add_row(
                    "等效质量 m₀",
                    f"{fit['equivalent_mass_kg'] * 1000:.2f} ± {fit['equivalent_mass_uncertainty'] * 1000:.2f} g",
                )
                fit_table.add_row("R²", f"{fit['r_squared']:.6f}")
                fit_table.add_row("χ²", f"{fit['chi_squared']:.4f}")
                fit_table.add_row("自由度", str(fit["degrees_of_freedom"]))
                fit_table.add_row(
                    "质量范围",
                    f"{fit['mass_range_kg'][0]} - {fit['mass_range_kg'][1]} kg",
                )
                fit_table.add_row(
                    "周期范围",
                    f"{fit['period_range_s'][0]} - {fit['period_range_s'][1]} s",
                )

                console.print(fit_table)
                console.print(f"  💡 {fit['notes']}")

            if report["data_gaps"]:
                console.print()
                console.print("🔍 数据缺口")
                console.print("─" * 60)

                gap_table = Table(show_header=True, header_style="bold")
                gap_table.add_column("#", style="dim", width=3)
                gap_table.add_column("类型", style="cyan")
                gap_table.add_column("来源", style="blue")
                gap_table.add_column("严重程度", style="magenta")
                gap_table.add_column("说明", style="white")
                gap_table.add_column("下一步", style="yellow")

                for i, gap in enumerate(report["data_gaps"], 1):
                    severity_style = {
                        "error": "red",
                        "warning": "yellow",
                        "info": "blue",
                    }.get(gap["severity"], "white")

                    gap_table.add_row(
                        str(i),
                        gap["gap_type_display"],
                        gap["source_display"],
                        f"[{severity_style}]{gap['severity'].upper()}[/{severity_style}]",
                        gap["description"],
                        gap["next_step"],
                    )

                console.print(gap_table)

            if report["grading_remarks"]:
                console.print()
                console.print("📝 批改意见")
                console.print("─" * 60)
                for remark in report["grading_remarks"]:
                    console.print(f"  • {remark}")

            console.print()

        except ImportError:
            self._print_simple_report(report)

    def _write_summary_sheet(self, writer, report: Dict[str, Any]) -> None:
        """写入汇总Sheet。"""
        header = report["header"]
        summary = report["summary"]

        data = [
            ["弹簧振子实验批改表"],
            ["生成时间", header["generated_at"]],
            ["学生姓名", header["student_name"]],
            ["学号", header["student_id"]],
            [],
            ["数据统计"],
            ["总计记录数", summary["total_records"]],
            ["已确认", summary["confirmed"]],
            ["待补", summary["pending"]],
            ["人工更正", summary["manual_corrected"]],
            ["重复项", summary["duplicate"]],
            ["无效数据", summary["invalid"]],
            ["用于拟合", summary["used_for_fitting"]],
            ["数据缺口", summary["data_gaps"]],
            [],
            ["警告信息"],
        ]

        for warning in report["warnings"]:
            data.append(["", warning])

        if report["errors"]:
            data.append([])
            data.append(["错误信息"])
            for error in report["errors"]:
                data.append(["", error])

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name="汇总", index=False, header=False)

        if report["fit_result"]:
            fit = report["fit_result"]
            fit_data = [
                [],
                ["拟合结果"],
                ["拟合方法", fit["fit_method"]],
                ["理论公式", fit["formula"]],
                ["弹簧劲度系数 k (N/m)", f"{fit['spring_constant_k']} ± {fit['spring_constant_uncertainty']}"],
                ["等效质量 m₀ (g)", f"{fit['equivalent_mass_kg'] * 1000:.2f} ± {fit['equivalent_mass_uncertainty'] * 1000:.2f}"],
                ["R²", fit["r_squared"]],
                ["χ²", fit["chi_squared"]],
                ["自由度", fit["degrees_of_freedom"]],
                ["备注", fit["notes"]],
            ]
            fit_df = pd.DataFrame(fit_data)
            fit_df.to_excel(writer, sheet_name="汇总", startrow=len(data) + 2, index=False, header=False)

    def _write_confirmed_sheet(self, writer, report: Dict[str, Any]) -> None:
        """写入已确认记录Sheet。"""
        if report["confirmed_records"]:
            df = pd.DataFrame(report["confirmed_records"])
            df.to_excel(writer, sheet_name="已确认记录", index=False)

    def _write_pending_sheet(self, writer, report: Dict[str, Any]) -> None:
        """写入待补记录Sheet。"""
        if report["pending_records"]:
            df = pd.DataFrame(report["pending_records"])
            df.to_excel(writer, sheet_name="待补记录", index=False)

    def _write_manual_sheet(self, writer, report: Dict[str, Any]) -> None:
        """写入人工更正记录Sheet。"""
        if report["manual_corrected_records"]:
            df = pd.DataFrame(report["manual_corrected_records"])
            df.to_excel(writer, sheet_name="人工更正记录", index=False)

    def _write_fit_result_sheet(self, writer, report: Dict[str, Any]) -> None:
        """写入拟合结果Sheet。"""
        if report["fit_result"]:
            df = pd.DataFrame([report["fit_result"]])
            df.to_excel(writer, sheet_name="拟合结果", index=False)

    def _write_gaps_sheet(self, writer, report: Dict[str, Any]) -> None:
        """写入数据缺口Sheet。"""
        if report["data_gaps"]:
            df = pd.DataFrame(report["data_gaps"])
            df.to_excel(writer, sheet_name="数据缺口", index=False)

    def _write_policy_sheet(self, writer, report: Dict[str, Any]) -> None:
        """写入处理口径Sheet。"""
        policy_lines = report["processing_policy"].split("\n")
        df = pd.DataFrame([["数据处理口径"]] + [[line] for line in policy_lines])
        df.to_excel(writer, sheet_name="处理口径", index=False, header=False)

    def _generate_gap_summary(self, gaps: List[DataGap]) -> Dict[str, Any]:
        """生成缺口摘要。"""
        by_severity = defaultdict(int)
        by_type = defaultdict(int)

        for gap in gaps:
            by_severity[gap.severity] += 1
            by_type[gap.gap_type.display_name] += 1

        return {
            "total": len(gaps),
            "by_severity": dict(by_severity),
            "by_type": dict(by_type),
        }

    def _generate_calibration_summary(
        self,
        calibration_records: List[CalibrationRecord],
    ) -> Dict[str, Any]:
        """生成标定数据摘要。"""
        valid = [c for c in calibration_records if c.status != DataStatus.INVALID]

        return {
            "total_records": len(calibration_records),
            "valid_records": len(valid),
            "mass_points": sorted(set([c.nominal_mass_kg for c in valid])),
            "spring_ids": sorted(set([c.spring_id for c in valid if c.spring_id])),
        }

    def _generate_grading_remarks(
        self,
        confirmed: List[ExperimentRecord],
        pending: List[ExperimentRecord],
        manual: List[ExperimentRecord],
        fit_result: Optional[FitResult],
        gaps: List[DataGap],
    ) -> List[str]:
        """生成批改意见。"""
        remarks = []

        if len(confirmed) >= 5:
            remarks.append("数据量充足，可用于可靠拟合。")
        elif len(confirmed) >= 3:
            remarks.append(f"有效数据点偏少（{len(confirmed)}个），建议补充更多测量数据。")
        else:
            remarks.append(f"有效数据点严重不足（{len(confirmed)}个），拟合结果可信度较低。")

        if pending:
            remarks.append(f"有 {len(pending)} 条记录待确认，请学生补充或说明。")

        if manual:
            remarks.append(f"有 {len(manual)} 条记录被人工更正，请注意核对修改原因。")

        if gaps:
            error_gaps = [g for g in gaps if g.severity == "error"]
            warning_gaps = [g for g in gaps if g.severity == "warning"]
            if error_gaps:
                remarks.append(f"存在 {len(error_gaps)} 个严重数据缺口，必须补充后才能完成批改。")
            if warning_gaps:
                remarks.append(f"存在 {len(warning_gaps)} 个数据缺口，建议补充以提高拟合精度。")

        if fit_result:
            if fit_result.r_squared >= 0.999:
                remarks.append(f"拟合效果优秀（R² = {fit_result.r_squared:.6f}），数据一致性很好。")
            elif fit_result.r_squared >= 0.99:
                remarks.append(f"拟合效果良好（R² = {fit_result.r_squared:.6f}）。")
            elif fit_result.r_squared >= 0.95:
                remarks.append(f"拟合效果一般（R² = {fit_result.r_squared:.6f}），请注意检查是否有异常值。")
            else:
                remarks.append(f"拟合效果较差（R² = {fit_result.r_squared:.6f}），建议检查实验操作或重新测量。")

            remarks.append(
                f"测得弹簧劲度系数 k = {fit_result.spring_constant_k:.3f} ± "
                f"{fit_result.spring_constant_uncertainty:.3f} N/m"
            )
            remarks.append(
                f"弹簧等效质量 m₀ = {fit_result.equivalent_mass_kg * 1000:.2f} ± "
                f"{fit_result.equivalent_mass_uncertainty * 1000:.2f} g"
            )

        return remarks

    def _print_simple_report(self, report: Dict[str, Any]) -> None:
        """简单的控制台输出（无rich库时使用）。"""
        header = report["header"]
        summary = report["summary"]

        print("\n" + "=" * 60)
        print(f"📊 {header['report_title']}")
        print(f"生成时间: {header['generated_at']}")
        if header["student_name"] or header["student_id"]:
            print(f"学生: {header['student_name']} ({header['student_id']})")
        print("=" * 60)

        print("\n📋 数据处理口径")
        print("-" * 60)
        print(report["processing_policy"])

        print("\n📈 数据统计")
        print("-" * 60)
        print(f"  已确认: {summary['confirmed']} 条")
        print(f"  待补: {summary['pending']} 条")
        print(f"  人工更正: {summary['manual_corrected']} 条")
        print(f"  重复项: {summary['duplicate']} 条")
        print(f"  无效: {summary['invalid']} 条")
        print(f"  用于拟合: {summary['used_for_fitting']} 条")

        if report["warnings"]:
            print("\n⚠️  警告信息")
            print("-" * 60)
            for i, warning in enumerate(report["warnings"], 1):
                print(f"  {i}. {warning}")

        if report["fit_result"]:
            fit = report["fit_result"]
            print("\n🎯 拟合结果")
            print("-" * 60)
            print(f"  方法: {fit['fit_method']}")
            print(f"  公式: {fit['formula']}")
            print(f"  k = {fit['spring_constant_k']} ± {fit['spring_constant_uncertainty']} N/m")
            print(f"  m₀ = {fit['equivalent_mass_kg'] * 1000:.2f} ± {fit['equivalent_mass_uncertainty'] * 1000:.2f} g")
            print(f"  R² = {fit['r_squared']:.6f}")
            print(f"  {fit['notes']}")

        if report["data_gaps"]:
            print("\n🔍 数据缺口")
            print("-" * 60)
            for i, gap in enumerate(report["data_gaps"], 1):
                print(f"  {i}. [{gap['severity'].upper()}] {gap['gap_type_display']}")
                print(f"     来源: {gap['source_display']}")
                print(f"     说明: {gap['description']}")
                print(f"     下一步: {gap['next_step']}")

        if report["grading_remarks"]:
            print("\n📝 批改意见")
            print("-" * 60)
            for remark in report["grading_remarks"]:
                print(f"  • {remark}")

        print("\n" + "=" * 60 + "\n")
