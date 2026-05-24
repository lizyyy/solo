from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import List, Optional

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from .models import CompatibilityLevel, EvolutionReport, SchemaChange, SchemaChangeType


class ReportGenerator:
    def __init__(self, output_dir: str = "./reports", overwrite: bool = False):
        self.output_dir = Path(output_dir)
        self.overwrite = overwrite
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_all(
        self, report: EvolutionReport, task_name: Optional[str] = None
    ) -> dict:
        task_name = task_name or report.task_name
        base_name = self._sanitize_filename(task_name)

        json_path = self.output_dir / f"{base_name}_report.json"
        md_path = self.output_dir / f"{base_name}_report.md"

        json_path = self._resolve_path(json_path)
        md_path = self._resolve_path(md_path)

        self._write_json(report, json_path)
        self._write_markdown(report, md_path)

        return {
            "json_path": str(json_path),
            "markdown_path": str(md_path),
        }

    def _sanitize_filename(self, name: str) -> str:
        import re

        name = re.sub(r"[^\w\s/-]", "", name).strip()
        name = re.sub(r"[-\s/]+", "_", name)
        return name.lower()

    def _resolve_path(self, path: Path) -> Path:
        if not path.exists():
            return path

        if self.overwrite:
            return path

        counter = 1
        while True:
            new_path = path.parent / f"{path.stem}_{counter}{path.suffix}"
            if not new_path.exists():
                return new_path
            counter += 1

    def _write_json(self, report: EvolutionReport, path: Path) -> None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(report.to_dict(), f, indent=2, ensure_ascii=False)

    def _write_markdown(self, report: EvolutionReport, path: Path) -> None:
        content = self._generate_markdown(report)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def _generate_markdown(self, report: EvolutionReport) -> str:
        lines = []

        lines.append(f"# Parquet Schema 演进报告 - {report.task_name}")
        lines.append("")
        lines.append(f"**生成时间**: {report.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        compat_emoji = self._compat_emoji(report.compatibility_level)
        compat_text = self._compat_text(report.compatibility_level)
        lines.append(f"## 兼容性评估")
        lines.append("")
        lines.append(f"{compat_emoji} **{compat_text}**")
        lines.append("")

        lines.append("## 变更摘要")
        lines.append("")
        lines.append("| 指标 | 数量 |")
        lines.append("|------|------|")
        for key, value in report.summary.items():
            if value > 0:
                lines.append(f"| {self._humanize_key(key)} | {value} |")
        lines.append("")

        lines.append("## Schema 源信息")
        lines.append("")
        lines.append("### 旧 Schema")
        lines.append(f"- 来源: {report.old_schema.source}")
        lines.append(f"- 字段数: {len(report.old_schema.fields)}")
        if report.old_schema.row_count is not None:
            lines.append(f"- 行数: {report.old_schema.row_count:,}")
        if report.old_schema.file_count is not None:
            lines.append(f"- 文件数: {report.old_schema.file_count}")
        lines.append("")

        lines.append("### 新 Schema")
        lines.append(f"- 来源: {report.new_schema.source}")
        lines.append(f"- 字段数: {len(report.new_schema.fields)}")
        if report.new_schema.row_count is not None:
            lines.append(f"- 行数: {report.new_schema.row_count:,}")
        if report.new_schema.file_count is not None:
            lines.append(f"- 文件数: {report.new_schema.file_count}")
        lines.append("")

        lines.append("## 详细变更")
        lines.append("")

        if not report.changes:
            lines.append("> ✅ 没有检测到任何 Schema 变更")
            lines.append("")
        else:
            for change_type in SchemaChangeType:
                type_changes = [
                    c for c in report.changes if c.change_type == change_type
                ]
                if type_changes:
                    lines.append(f"### {self._change_type_title(change_type)}")
                    lines.append("")
                    for change in type_changes:
                        severity_badge = self._severity_badge_md(change.severity)
                        lines.append(f"- **{change.field_path}** {severity_badge}")
                        lines.append(f"  - 描述: {change.description}")
                        if change.old_value is not None:
                            lines.append(f"  - 旧值: `{change.old_value}`")
                        if change.new_value is not None:
                            lines.append(f"  - 新值: `{change.new_value}`")
                        if change.compatibility_impact != "none":
                            lines.append(
                                f"  - 兼容性影响: **{change.compatibility_impact}**"
                            )
                    lines.append("")

        lines.append("## 建议")
        lines.append("")
        for rec in report.recommendations:
            lines.append(f"- {rec}")
        lines.append("")

        lines.append("## 完整 Schema 对比")
        lines.append("")
        lines.append("<details>")
        lines.append("<summary>点击展开完整 Schema 对比</summary>")
        lines.append("")
        lines.append("### 旧 Schema 字段")
        lines.append("```json")
        lines.append(
            json.dumps(
                [f.to_dict() for f in report.old_schema.fields],
                indent=2,
                ensure_ascii=False,
            )
        )
        lines.append("```")
        lines.append("")
        lines.append("### 新 Schema 字段")
        lines.append("```json")
        lines.append(
            json.dumps(
                [f.to_dict() for f in report.new_schema.fields],
                indent=2,
                ensure_ascii=False,
            )
        )
        lines.append("```")
        lines.append("")
        lines.append("</details>")

        return "\n".join(lines)

    def generate_terminal_summary(self, report: EvolutionReport) -> None:
        console = Console()

        console.print()

        title = Text("Parquet Schema 演进报告", style="bold blue")
        subtitle = Text(f"任务: {report.task_name}", style="dim")
        console.print(Panel.fit(f"{title}\n{subtitle}"))

        console.print()
        compat_color = self._compat_color(report.compatibility_level)
        compat_emoji = self._compat_emoji(report.compatibility_level)
        compat_text = self._compat_text(report.compatibility_level)
        console.print(
            f"  兼容性评估: {compat_emoji} [{compat_color}]{compat_text}[/{compat_color}]"
        )

        console.print()
        console.print("  [bold]变更摘要:[/bold]")

        for key in [
            "total_changes",
            "field_added",
            "field_removed",
            "type_changed",
            "nullable_changed",
            "decimal_precision_changed",
            "breaking_changes",
        ]:
            value = report.summary.get(key, 0)
            if value > 0 or key == "total_changes":
                console.print(f"    • {self._humanize_key(key)}: [bold]{value}[/bold]")

        if report.changes:
            console.print()
            console.print("  [bold]重要变更:[/bold]")

            high_changes = [c for c in report.changes if c.severity == "high"]
            medium_changes = [c for c in report.changes if c.severity == "medium"]
            show_changes = high_changes[:3] + medium_changes[:2]

            for change in show_changes[:5]:
                color = "red" if change.severity == "high" else "yellow"
                console.print(
                    f"    [{color}]•[/{color}] {change.field_path}: {change.description}"
                )

            if len(report.changes) > 5:
                console.print(
                    f"    [dim]... 还有 {len(report.changes) - 5} 个变更[/dim]"
                )

        console.print()
        console.print("  [bold]建议:[/bold]")
        for rec in report.recommendations[:3]:
            console.print(f"    • {rec}")
        if len(report.recommendations) > 3:
            console.print(
                f"    [dim]... 还有 {len(report.recommendations) - 3} 条建议[/dim]"
            )

        console.print()

    def _compat_emoji(self, level: CompatibilityLevel) -> str:
        return {
            CompatibilityLevel.FULLY_COMPATIBLE: "✅",
            CompatibilityLevel.FORWARD_COMPATIBLE: "ℹ️",
            CompatibilityLevel.BACKWARD_COMPATIBLE: "⚠️",
            CompatibilityLevel.INCOMPATIBLE: "❌",
        }.get(level, "❓")

    def _compat_text(self, level: CompatibilityLevel) -> str:
        return {
            CompatibilityLevel.FULLY_COMPATIBLE: "完全兼容",
            CompatibilityLevel.FORWARD_COMPATIBLE: "仅向前兼容",
            CompatibilityLevel.BACKWARD_COMPATIBLE: "向后兼容（有潜在问题）",
            CompatibilityLevel.INCOMPATIBLE: "不兼容",
        }.get(level, "未知")

    def _compat_color(self, level: CompatibilityLevel) -> str:
        return {
            CompatibilityLevel.FULLY_COMPATIBLE: "green",
            CompatibilityLevel.FORWARD_COMPATIBLE: "blue",
            CompatibilityLevel.BACKWARD_COMPATIBLE: "yellow",
            CompatibilityLevel.INCOMPATIBLE: "red",
        }.get(level, "white")

    def _humanize_key(self, key: str) -> str:
        key_map = {
            "total_changes": "总变更数",
            "field_added": "新增字段",
            "field_removed": "删除字段",
            "field_renamed": "重命名字段",
            "type_changed": "类型变更",
            "nullable_changed": "Nullable 变更",
            "decimal_precision_changed": "Decimal 精度变更",
            "nested_structure_changed": "嵌套结构变更",
            "breaking_changes": "破坏性变更",
            "high_severity": "高严重性",
            "medium_severity": "中严重性",
            "low_severity": "低严重性",
        }
        return key_map.get(key, key.replace("_", " ").title())

    def _change_type_title(self, change_type: SchemaChangeType) -> str:
        return {
            SchemaChangeType.FIELD_ADDED: "🟢 新增字段",
            SchemaChangeType.FIELD_REMOVED: "🔴 删除字段",
            SchemaChangeType.FIELD_RENAMED: "🔵 重命名字段",
            SchemaChangeType.TYPE_CHANGED: "🟡 类型变更",
            SchemaChangeType.NULLABLE_CHANGED: "🟣 Nullable 变更",
            SchemaChangeType.DECIMAL_PRECISION_CHANGED: "🟠 Decimal 精度变更",
            SchemaChangeType.NESTED_STRUCTURE_CHANGED: "🟤 嵌套结构变更",
        }.get(change_type, change_type.value)

    def _severity_badge_md(self, severity: str) -> str:
        return {
            "high": "![High](https://img.shields.io/badge/-HIGH-red)",
            "medium": "![Medium](https://img.shields.io/badge/-MEDIUM-yellow)",
            "low": "![Low](https://img.shields.io/badge/-LOW-green)",
        }.get(severity, "")
