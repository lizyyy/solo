import json
import os
from dataclasses import asdict, is_dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .models import DriftReport, DriftType, RiskLevel


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if is_dataclass(obj):
            return asdict(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, (DriftType, RiskLevel)):
            return obj.value
        return super().default(obj)


class ReportGenerator:
    def __init__(self, output_dir: str = "."):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.console = Console()

    def generate_all(self, report: DriftReport, base_filename: str = "drift_report"):
        self.print_console_summary(report)
        self.write_json(report, f"{base_filename}.json")
        self.write_markdown(report, f"{base_filename}.md")

    def print_console_summary(self, report: DriftReport):
        console = self.console

        console.print()
        console.print(Panel.fit("📊 Ansible Inventory 漂移检测报告", style="bold blue"))
        console.print()

        console.print(f"[dim]生成时间:[/dim] {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        console.print(f"[dim]Inventory 文件:[/dim] {report.inventory_file}")
        if report.cmdb_file:
            console.print(f"[dim]CMDB 文件:[/dim] {report.cmdb_file}")
        console.print()

        stats_table = Table(title="主机统计", show_header=True, header_style="bold cyan")
        stats_table.add_column("来源", style="cyan")
        stats_table.add_column("主机数量", justify="right", style="green")
        stats_table.add_row("Inventory", str(report.total_hosts_inventory))
        stats_table.add_row("CMDB", str(report.total_hosts_cmdb))
        console.print(stats_table)
        console.print()

        if not report.drift_items:
            console.print("[green]✅ 未发现任何漂移问题！[/green]")
            return

        risk_table = Table(title="风险等级汇总", show_header=True, header_style="bold magenta")
        risk_table.add_column("风险等级", style="bold")
        risk_table.add_column("数量", justify="right")

        risk_order = [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW, RiskLevel.INFO]
        risk_styles = {
            RiskLevel.CRITICAL: "bold red",
            RiskLevel.HIGH: "bold yellow",
            RiskLevel.MEDIUM: "bold blue",
            RiskLevel.LOW: "bold green",
            RiskLevel.INFO: "dim",
        }

        for level in risk_order:
            count = report.risk_summary.get(level, 0)
            if count > 0:
                risk_table.add_row(
                    Text(level.value, style=risk_styles[level]),
                    Text(str(count), style=risk_styles[level]),
                )
        console.print(risk_table)
        console.print()

        drift_table = Table(title="漂移类型详情", show_header=True, header_style="bold yellow")
        drift_table.add_column("漂移类型", style="cyan")
        drift_table.add_column("数量", justify="right")

        drift_descriptions = {
            DriftType.HOSTNAME_MISMATCH: "主机名不一致",
            DriftType.ROLE_MISMATCH: "角色标签不一致",
            DriftType.ENVIRONMENT_MISMATCH: "环境标签不一致",
            DriftType.MISSING_IN_CMDB: "CMDB 缺失",
            DriftType.MISSING_IN_INVENTORY: "Inventory 缺失",
            DriftType.LABEL_MISMATCH: "标签不一致",
            DriftType.ALIAS_CONFLICT: "别名冲突",
            DriftType.DECOMMISSIONED_STILL_PRESENT: "退役主机残留",
            DriftType.GROUP_INHERITANCE_ISSUE: "组继承问题",
        }

        for drift_type, count in sorted(report.summary.items(), key=lambda x: -x[1]):
            desc = drift_descriptions.get(DriftType(drift_type), drift_type)
            drift_table.add_row(desc, str(count))
        console.print(drift_table)
        console.print()

        console.print(Panel("📋 问题详情（前 20 条）", style="bold yellow"))
        console.print()

        detail_table = Table(show_header=True, header_style="bold white")
        detail_table.add_column("风险", style="bold", width=10)
        detail_table.add_column("主机", style="cyan", width=25)
        detail_table.add_column("类型", style="magenta", width=15)
        detail_table.add_column("描述", style="white")

        sorted_items = sorted(
            report.drift_items,
            key=lambda x: (
                [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW, RiskLevel.INFO].index(
                    x.risk_level
                ),
                x.host,
            ),
        )

        for item in sorted_items[:20]:
            style = risk_styles.get(item.risk_level, "white")
            type_desc = drift_descriptions.get(item.drift_type, item.drift_type.value)
            detail_table.add_row(
                Text(item.risk_level.value, style=style),
                Text(item.host, style="cyan"),
                Text(type_desc, style="magenta"),
                Text(item.description),
            )

        if len(sorted_items) > 20:
            detail_table.add_row("", "...", "", f"还有 {len(sorted_items) - 20} 条，详见完整报告")

        console.print(detail_table)
        console.print()

        if report.recommendations:
            console.print(Panel("💡 建议措施", style="bold green"))
            console.print()
            for i, rec in enumerate(report.recommendations, 1):
                console.print(f"  [yellow]{i}.[/yellow] {rec}")
            console.print()

    def write_json(self, report: DriftReport, filename: str) -> Path:
        output_path = self.output_dir / filename
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, cls=EnhancedJSONEncoder, indent=2, ensure_ascii=False)
        self.console.print(f"[green]📄 JSON 报告已写入:[/green] {output_path}")
        return output_path

    def write_markdown(self, report: DriftReport, filename: str) -> Path:
        output_path = self.output_dir / filename

        drift_descriptions = {
            DriftType.HOSTNAME_MISMATCH: "主机名不一致",
            DriftType.ROLE_MISMATCH: "角色标签不一致",
            DriftType.ENVIRONMENT_MISMATCH: "环境标签不一致",
            DriftType.MISSING_IN_CMDB: "CMDB 缺失",
            DriftType.MISSING_IN_INVENTORY: "Inventory 缺失",
            DriftType.LABEL_MISMATCH: "标签不一致",
            DriftType.ALIAS_CONFLICT: "别名冲突",
            DriftType.DECOMMISSIONED_STILL_PRESENT: "退役主机残留",
            DriftType.GROUP_INHERITANCE_ISSUE: "组继承问题",
        }

        risk_emojis = {
            RiskLevel.CRITICAL: "🔴",
            RiskLevel.HIGH: "🟠",
            RiskLevel.MEDIUM: "🟡",
            RiskLevel.LOW: "🟢",
            RiskLevel.INFO: "🔵",
        }

        lines = []

        lines.append("# Ansible Inventory 漂移检测报告")
        lines.append("")
        lines.append(f"**生成时间**: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("## 📊 概览")
        lines.append("")
        lines.append("| 来源 | 主机数量 |")
        lines.append("|------|----------|")
        lines.append(f"| Inventory | {report.total_hosts_inventory} |")
        lines.append(f"| CMDB | {report.total_hosts_cmdb} |")
        lines.append("")

        if report.drift_items:
            lines.append("## ⚠️ 风险等级汇总")
            lines.append("")
            lines.append("| 风险等级 | 数量 |")
            lines.append("|----------|------|")
            for level in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW, RiskLevel.INFO]:
                count = report.risk_summary.get(level, 0)
                if count > 0:
                    lines.append(f"| {risk_emojis.get(level, '')} {level.value} | {count} |")
            lines.append("")

            lines.append("## 📋 漂移类型统计")
            lines.append("")
            lines.append("| 漂移类型 | 数量 | 说明 |")
            lines.append("|----------|------|------|")
            for drift_type, count in sorted(report.summary.items(), key=lambda x: -x[1]):
                desc = drift_descriptions.get(DriftType(drift_type), drift_type)
                lines.append(f"| {drift_type} | {count} | {desc} |")
            lines.append("")

            lines.append("## 🔍 问题详情")
            lines.append("")

            sorted_items = sorted(
                report.drift_items,
                key=lambda x: (
                    [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW, RiskLevel.INFO].index(
                        x.risk_level
                    ),
                    x.host,
                ),
            )

            for i, item in enumerate(sorted_items, 1):
                emoji = risk_emojis.get(item.risk_level, "")
                type_desc = drift_descriptions.get(item.drift_type, item.drift_type.value)

                lines.append(f"### {emoji} {i}. {item.host} - {type_desc}")
                lines.append("")
                lines.append(f"- **风险等级**: {item.risk_level.value}")
                lines.append(f"- **漂移类型**: {item.drift_type.value}")
                lines.append(f"- **描述**: {item.description}")

                if item.inventory_value is not None:
                    if isinstance(item.inventory_value, (list, dict)):
                        lines.append(f"- **Inventory 值**:")
                        lines.append("  ```json")
                        lines.append(f"  {json.dumps(item.inventory_value, ensure_ascii=False, indent=2)}")
                        lines.append("  ```")
                    else:
                        lines.append(f"- **Inventory 值**: `{item.inventory_value}`")

                if item.cmdb_value is not None:
                    if isinstance(item.cmdb_value, (list, dict)):
                        lines.append(f"- **CMDB 值**:")
                        lines.append("  ```json")
                        lines.append(f"  {json.dumps(item.cmdb_value, ensure_ascii=False, indent=2)}")
                        lines.append("  ```")
                    else:
                        lines.append(f"- **CMDB 值**: `{item.cmdb_value}`")

                if item.details:
                    lines.append(f"- **详细信息**:")
                    lines.append("  ```json")
                    lines.append(f"  {json.dumps(item.details, ensure_ascii=False, indent=2)}")
                    lines.append("  ```")

                lines.append("")

            if report.recommendations:
                lines.append("## 💡 建议措施")
                lines.append("")
                for i, rec in enumerate(report.recommendations, 1):
                    lines.append(f"{i}. {rec}")
                lines.append("")

        else:
            lines.append("## ✅ 检测结果")
            lines.append("")
            lines.append("未发现任何漂移问题！")
            lines.append("")

        lines.append("---")
        lines.append("*本报告由 inventory-drift 工具自动生成*")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        self.console.print(f"[green]📄 Markdown 报告已写入:[/green] {output_path}")
        return output_path

    def get_exit_code(self, report: DriftReport) -> int:
        if not report.drift_items:
            return 0

        highest_risk = report.get_highest_risk()
        if highest_risk == RiskLevel.CRITICAL:
            return 2
        elif highest_risk in (RiskLevel.HIGH, RiskLevel.MEDIUM):
            return 1
        else:
            return 0
