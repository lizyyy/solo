import os
import json
from datetime import datetime
from typing import Any

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .config import AnalyzerConfig
from .types import AnalysisReport, SensorAnalysisResult, DropGap, SensorType


class ReportGenerator:
    def __init__(self, config: AnalyzerConfig):
        self.config = config
        self.console = Console()

    def print_console_summary(self, report: AnalysisReport):
        self.console.print("\n")
        self._print_overview(report)
        self._print_sensor_summary(report)
        self._print_warnings(report)

    def _print_overview(self, report: AnalysisReport):
        title = Text("📊 分析概览", style="bold blue")
        overview_table = Table(title=title, show_header=False, box=None)
        overview_table.add_column("项目", style="cyan")
        overview_table.add_column("值", style="white")

        overview_table.add_row("Bag 文件", os.path.basename(report.bag_file))
        overview_table.add_row("分析时间", report.analysis_time.strftime("%Y-%m-%d %H:%M:%S"))
        overview_table.add_row("总时长", f"{report.total_duration:.2f} 秒")
        overview_table.add_row("起始时间", f"{report.start_time:.6f}")
        overview_table.add_row("结束时间", f"{report.end_time:.6f}")
        overview_table.add_row("传感器数量", str(len(report.sensors)))
        overview_table.add_row(
            "整体掉帧率",
            f"{report.overall_drop_rate:.2%}",
            style="red" if report.overall_drop_rate > 0.05 else "green",
        )

        self.console.print(Panel(overview_table, border_style="blue"))

    def _print_sensor_summary(self, report: AnalysisReport):
        title = Text("📡 传感器详细数据", style="bold green")
        table = Table(title=title, show_lines=True)

        table.add_column("传感器", style="cyan", no_wrap=True)
        table.add_column("类型", style="magenta")
        table.add_column("帧数", justify="right")
        table.add_column("期望 FPS", justify="right")
        table.add_column("实际 FPS", justify="right")
        table.add_column("丢失帧数", justify="right")
        table.add_column("掉帧率", justify="right")
        table.add_column("最大空窗", justify="right")
        table.add_column("掉段数", justify="right")

        for sensor_name, result in report.sensors.items():
            drop_rate = result.total_missing_frames / result.total_frames if result.total_frames > 0 else 0

            fps_color = "green" if result.actual_fps >= result.expected_fps * 0.95 else "yellow"
            drop_color = "red" if drop_rate > 0.05 else "green"

            table.add_row(
                sensor_name,
                result.sensor_type.value,
                str(result.total_frames),
                f"{result.expected_fps:.1f}",
                f"[{fps_color}]{result.actual_fps:.1f}[/{fps_color}]",
                f"[{drop_color}]{result.total_missing_frames}[/{drop_color}]",
                f"[{drop_color}]{drop_rate:.2%}[/{drop_color}]",
                f"{result.max_gap_duration:.3f}s",
                str(len(result.frame_drops)),
            )

        self.console.print(table)

        for sensor_name, result in report.sensors.items():
            if result.frame_drops:
                self._print_frame_drops(sensor_name, result)

    def _print_frame_drops(self, sensor_name: str, result: SensorAnalysisResult):
        if len(result.frame_drops) == 0:
            return

        title = Text(f"⚠️  {sensor_name} 掉帧详情 (前 10 条)", style="bold yellow")
        table = Table(title=title, show_lines=True)

        table.add_column("#", style="dim", justify="right")
        table.add_column("开始时间", justify="right")
        table.add_column("结束时间", justify="right")
        table.add_column("时长(秒)", justify="right")
        table.add_column("缺失帧数", justify="right")
        table.add_column("严重程度", justify="center")

        severity_colors = {
            "critical": "bold red",
            "high": "red",
            "medium": "yellow",
            "low": "cyan",
        }

        for i, gap in enumerate(result.frame_drops[:10], 1):
            color = severity_colors.get(gap.severity, "white")
            table.add_row(
                str(i),
                f"{gap.start_time:.6f}",
                f"{gap.end_time:.6f}",
                f"[{color}]{gap.duration:.4f}[/{color}]",
                str(gap.missing_frames),
                f"[{color}]{gap.severity.upper()}[/{color}]",
            )

        if len(result.frame_drops) > 10:
            table.add_row("...", "...", "...", "...", "...", "...")

        self.console.print(table)

    def _print_warnings(self, report: AnalysisReport):
        if report.warnings:
            title = Text("⚠️ 警告信息", style="bold yellow")
            warning_text = "\n".join(f"  • {w}" for w in report.warnings)
            self.console.print(Panel(warning_text, title=title, border_style="yellow"))

        if report.errors:
            title = Text("❌ 错误信息", style="bold red")
            error_text = "\n".join(f"  • {e}" for e in report.errors)
            self.console.print(Panel(error_text, title=title, border_style="red"))

    def export_json(self, report: AnalysisReport):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"drop_analysis_{timestamp}.json"
        filepath = os.path.join(self.config.output_dir, filename)

        report_dict = self._report_to_dict(report)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report_dict, f, indent=2, ensure_ascii=False, default=str)

        self.console.print(f"[green]✓ JSON 报告已导出: {filepath}[/green]")

    def _report_to_dict(self, report: AnalysisReport) -> dict:
        sensors_dict = {}
        for sensor_name, result in report.sensors.items():
            sensors_dict[sensor_name] = {
                "sensor_type": result.sensor_type.value,
                "total_frames": result.total_frames,
                "start_time": result.start_time,
                "end_time": result.end_time,
                "duration": result.duration,
                "expected_fps": result.expected_fps,
                "actual_fps": result.actual_fps,
                "total_missing_frames": result.total_missing_frames,
                "total_drop_duration": result.total_drop_duration,
                "max_gap_duration": result.max_gap_duration,
                "drop_rate": result.total_missing_frames / result.total_frames if result.total_frames > 0 else 0,
                "frame_drops": [
                    {
                        "start_time": gap.start_time,
                        "end_time": gap.end_time,
                        "duration": gap.duration,
                        "expected_frames": gap.expected_frames,
                        "missing_frames": gap.missing_frames,
                        "severity": gap.severity,
                    }
                    for gap in result.frame_drops
                ],
                "timestamp_issues": result.timestamp_issues,
                "topic_changes": result.topic_changes,
                "invalid_records": result.invalid_records,
            }

        return {
            "bag_file": report.bag_file,
            "analysis_time": report.analysis_time.isoformat(),
            "start_time": report.start_time,
            "end_time": report.end_time,
            "total_duration": report.total_duration,
            "overall_drop_rate": report.overall_drop_rate,
            "sensors": sensors_dict,
            "warnings": report.warnings,
            "errors": report.errors,
            "config": {
                "thresholds": {k.value: v for k, v in self.config.thresholds.items()},
                "expected_fps": {k.value: v for k, v in self.config.expected_fps.items()},
            },
        }

    def export_markdown(self, report: AnalysisReport):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"drop_analysis_{timestamp}.md"
        filepath = os.path.join(self.config.output_dir, filename)

        content = self._generate_markdown(report)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        self.console.print(f"[green]✓ Markdown 报告已导出: {filepath}[/green]")

    def _generate_markdown(self, report: AnalysisReport) -> str:
        lines = []

        lines.append("# ROS 传感器掉帧分析报告")
        lines.append("")
        lines.append(f"**生成时间**: {report.analysis_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**Bag 文件**: `{os.path.basename(report.bag_file)}`")
        lines.append("")

        lines.append("## 1. 概览")
        lines.append("")
        lines.append("| 项目 | 值 |")
        lines.append("|------|----|")
        lines.append(f"| 总时长 | {report.total_duration:.2f} 秒 |")
        lines.append(f"| 起始时间 | `{report.start_time:.6f}` |")
        lines.append(f"| 结束时间 | `{report.end_time:.6f}` |")
        lines.append(f"| 传感器数量 | {len(report.sensors)} |")
        lines.append(f"| 整体掉帧率 | {report.overall_drop_rate:.2%} |")
        lines.append("")

        lines.append("## 2. 传感器统计")
        lines.append("")
        lines.append("| 传感器 | 类型 | 帧数 | 期望 FPS | 实际 FPS | 丢失帧数 | 掉帧率 | 最大空窗 | 掉段数 |")
        lines.append("|--------|------|------|----------|----------|----------|--------|----------|--------|")

        for sensor_name, result in report.sensors.items():
            drop_rate = result.total_missing_frames / result.total_frames if result.total_frames > 0 else 0
            lines.append(
                f"| {sensor_name} | {result.sensor_type.value} | {result.total_frames} | "
                f"{result.expected_fps:.1f} | {result.actual_fps:.1f} | {result.total_missing_frames} | "
                f"{drop_rate:.2%} | {result.max_gap_duration:.3f}s | {len(result.frame_drops)} |"
            )
        lines.append("")

        lines.append("## 3. 掉帧详细分析")
        lines.append("")

        for sensor_name, result in report.sensors.items():
            lines.append(f"### 3.1 {sensor_name}")
            lines.append("")

            if not result.frame_drops:
                lines.append("✅ 未检测到明显掉帧")
                lines.append("")
                continue

            lines.append(f"**总丢失帧数**: {result.total_missing_frames}")
            lines.append(f"**总掉帧时长**: {result.total_drop_duration:.3f} 秒")
            lines.append(f"**最大空窗**: {result.max_gap_duration:.3f} 秒")
            lines.append("")

            lines.append("| # | 开始时间 | 结束时间 | 时长(秒) | 缺失帧数 | 严重程度 |")
            lines.append("|---|----------|----------|----------|----------|----------|")

            for i, gap in enumerate(result.frame_drops, 1):
                severity_emoji = {
                    "critical": "🔴",
                    "high": "🟠",
                    "medium": "🟡",
                    "low": "🔵",
                }.get(gap.severity, "⚪")

                lines.append(
                    f"| {i} | `{gap.start_time:.6f}` | `{gap.end_time:.6f}` | "
                    f"{gap.duration:.4f} | {gap.missing_frames} | {severity_emoji} {gap.severity.upper()} |"
                )
            lines.append("")

        lines.append("## 4. 异常检测")
        lines.append("")

        has_issues = False

        for sensor_name, result in report.sensors.items():
            sensor_issues = []

            if result.timestamp_issues:
                has_issues = True
                sensor_issues.append(f"- **时间戳回退**: {len(result.timestamp_issues)} 次")
                for issue in result.timestamp_issues[:5]:
                    line_info = f" (第 {issue.get('curr_line', '?')} 行)" if issue.get('curr_line') else ""
                    sensor_issues.append(f"  - `{issue['time']:.6f}`: {issue['description']}{line_info}")

            if result.topic_changes:
                has_issues = True
                sensor_issues.append(f"- **Topic 变化**: {len(result.topic_changes)} 次")
                for change in result.topic_changes[:5]:
                    line_info = f" (第 {change.get('line_number', '?')} 行)" if change.get('line_number') else ""
                    sensor_issues.append(
                        f"  - `{change['time']:.6f}`: {change['from_topic']} → {change['to_topic']}{line_info}"
                    )

            if result.invalid_records:
                has_issues = True
                sensor_issues.append(f"- **无效记录**: {len(result.invalid_records)} 条")
                for record in result.invalid_records[:5]:
                    line_info = f" (第 {record.get('line_number', '?')} 行)" if record.get('line_number') else ""
                    sensor_issues.append(
                        f"  - topic: `{record['topic']}`, timestamp: `{record['timestamp']}`{line_info}"
                    )

            if sensor_issues:
                lines.append(f"### 4.1 {sensor_name}")
                lines.append("")
                lines.extend(sensor_issues)
                lines.append("")

        if not has_issues:
            lines.append("✅ 未检测到异常")
            lines.append("")

        if report.warnings:
            lines.append("## 5. 警告信息")
            lines.append("")
            for warning in report.warnings:
                lines.append(f"- ⚠️ {warning}")
            lines.append("")

        lines.append("## 6. 配置参数")
        lines.append("")
        lines.append("### 6.1 掉帧阈值")
        lines.append("")
        lines.append("| 传感器类型 | 阈值(秒) |")
        lines.append("|------------|----------|")
        for sensor_type, threshold in self.config.thresholds.items():
            lines.append(f"| {sensor_type.value} | {threshold} |")
        lines.append("")

        lines.append("### 6.2 期望帧率")
        lines.append("")
        lines.append("| 传感器类型 | 期望 FPS |")
        lines.append("|------------|----------|")
        for sensor_type, fps in self.config.expected_fps.items():
            lines.append(f"| {sensor_type.value} | {fps} |")
        lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*本报告由 ROS Drop Analyzer 自动生成*")

        return "\n".join(lines)
