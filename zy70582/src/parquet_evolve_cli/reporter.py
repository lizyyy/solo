import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree

from .types import EvolutionReport, CompatibilityLevel


def generate_console_summary(report: EvolutionReport) -> None:
    console = Console()
    
    level_colors = {
        CompatibilityLevel.FULLY_COMPATIBLE: "green",
        CompatibilityLevel.BACKWARD_COMPATIBLE: "yellow",
        CompatibilityLevel.FORWARD_COMPATIBLE: "yellow",
        CompatibilityLevel.INCOMPATIBLE: "red",
    }
    
    color = level_colors.get(report.compatibility.overall_level, "white")
    
    console.print(Panel(
        f"[{color} bold]{report.compatibility.overall_level.value.upper()}[/{color} bold]",
        title="Parquet Schema Evolution Check",
        subtitle=f"Run ID: {report.run_id}",
    ))
    
    console.print(f"\n📅 Run time: {report.run_time}")
    console.print(f"📁 Input files: {len(report.input_files)}")
    
    if report.reference_schema:
        console.print(f"📊 Reference schema: {Path(report.reference_schema.file_path).name}")
        console.print(f"   Fields: {report.reference_schema.row_count} rows, {len(report.reference_schema.fields)} columns")
    
    summary = report.compatibility.summary
    
    table = Table(title="Summary Statistics")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", justify="right")
    table.add_row("Total changes", str(summary.get("total_changes", 0)))
    table.add_row("Reference fields", str(summary.get("reference_field_count", 0)))
    table.add_row("Target fields", str(summary.get("target_field_count", 0)))
    console.print(table)
    
    if "changes_by_type" in summary and summary["changes_by_type"]:
        type_table = Table(title="Changes by Type")
        type_table.add_column("Change Type", style="magenta")
        type_table.add_column("Count", justify="right")
        for change_type, count in summary["changes_by_type"].items():
            type_table.add_row(change_type, str(count))
        console.print(type_table)
    
    if "changes_by_impact" in summary and summary["changes_by_impact"]:
        impact_table = Table(title="Changes by Impact")
        impact_table.add_column("Impact Level", style="yellow")
        impact_table.add_column("Count", justify="right")
        for impact, count in summary["changes_by_impact"].items():
            impact_table.add_row(impact, str(count))
        console.print(impact_table)
    
    if report.compatibility.changes:
        change_tree = Tree("🔄 Field Changes")
        for change in report.compatibility.changes:
            impact_color = {
                "low": "green",
                "medium": "yellow",
                "high": "red",
            }.get(change.compatibility_impact, "white")
            
            node = change_tree.add(f"[{impact_color}]{change.field_name}[/{impact_color}] ({change.change_type.value})")
            if change.old_value or change.new_value:
                node.add(f"{change.old_value or 'N/A'} → {change.new_value or 'N/A'}")
            node.add(change.description)
        console.print(change_tree)
    
    if report.compatibility.bad_rows:
        error_table = Table(title=f"⚠️ Bad Rows ({len(report.compatibility.bad_rows)} found)")
        error_table.add_column("Row Index", style="red")
        error_table.add_column("Column", style="blue")
        error_table.add_column("Reason", style="yellow")
        
        for bad_row in report.compatibility.bad_rows[:20]:
            error_table.add_row(
                str(bad_row.row_index),
                bad_row.column_name or "N/A",
                bad_row.reason[:80]
            )
        if len(report.compatibility.bad_rows) > 20:
            error_table.add_row("...", "...", f"and {len(report.compatibility.bad_rows) - 20} more")
        console.print(error_table)
    
    console.print(f"\n💾 Output files:")
    for name, path in report.output_paths.items():
        console.print(f"   - {name}: {path}")
    
    exit_hint = "[green]✓ Ready for release[/green]" if report.compatibility.overall_level in [
        CompatibilityLevel.FULLY_COMPATIBLE,
        CompatibilityLevel.BACKWARD_COMPATIBLE
    ] else "[red]✗ Review required before release[/red]"
    console.print(f"\n{exit_hint}")


def generate_machine_readable(report: EvolutionReport, output_path: str) -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report.model_dump(), f, indent=2, ensure_ascii=False)


def generate_markdown_report(report: EvolutionReport, output_path: str) -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    
    level_emoji = {
        CompatibilityLevel.FULLY_COMPATIBLE: "✅",
        CompatibilityLevel.BACKWARD_COMPATIBLE: "⚠️",
        CompatibilityLevel.FORWARD_COMPATIBLE: "⚠️",
        CompatibilityLevel.INCOMPATIBLE: "❌",
    }
    
    md = [
        f"# Parquet Schema Evolution Report",
        f"",
        f"## Overview",
        f"",
        f"| Item | Value |",
        f"|------|-------|",
        f"| Run ID | `{report.run_id}` |",
        f"| Run Time | {report.run_time} |",
        f"| Overall Compatibility | {level_emoji.get(report.compatibility.overall_level, '')} {report.compatibility.overall_level.value} |",
        f"| Input Files | {len(report.input_files)} |",
        f"",
    ]
    
    if report.reference_schema:
        md.extend([
            f"## Reference Schema",
            f"",
            f"- File: `{Path(report.reference_schema.file_path).name}`",
            f"- Rows: {report.reference_schema.row_count}",
            f"- Columns: {len(report.reference_schema.fields)}",
            f"",
        ])
        
        md.extend([
            f"### Field List",
            f"",
            f"| Field Name | Type | Nullable |",
            f"|------------|------|----------|",
        ])
        for field in report.reference_schema.fields:
            nullable = "✓" if field["nullable"] else "✗"
            md.append(f"| {field['name']} | `{field['type']}` | {nullable} |")
        md.append("")
    
    md.extend([
        f"## Compatibility Analysis",
        f"",
        f"### Summary",
        f"",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Total Changes | {report.compatibility.summary.get('total_changes', 0)} |",
        f"| Reference Fields | {report.compatibility.summary.get('reference_field_count', 0)} |",
        f"| Target Fields | {report.compatibility.summary.get('target_field_count', 0)} |",
        f"",
    ])
    
    if report.compatibility.changes:
        md.extend([
            f"### Field Changes",
            f"",
            f"| Field | Change Type | Old Value | New Value | Impact | Description |",
            f"|-------|-------------|-----------|-----------|--------|-------------|",
        ])
        
        impact_colors = {
            "low": "🟢",
            "medium": "🟡",
            "high": "🔴",
        }
        
        for change in report.compatibility.changes:
            emoji = impact_colors.get(change.compatibility_impact, "⚪")
            old_val = f"`{change.old_value}`" if change.old_value else "N/A"
            new_val = f"`{change.new_value}`" if change.new_value else "N/A"
            md.append(
                f"| {change.field_name} | {change.change_type.value} | {old_val} | {new_val} | {emoji} {change.compatibility_impact} | {change.description} |"
            )
        md.append("")
    
    if report.compatibility.bad_rows:
        md.extend([
            f"## Bad Rows / Data Issues",
            f"",
            f"**{len(report.compatibility.bad_rows)} issues found:**",
            f"",
            f"| Row Index | Column | Reason |",
            f"|-----------|--------|--------|",
        ])
        
        for bad_row in report.compatibility.bad_rows[:50]:
            col = bad_row.column_name or "N/A"
            md.append(f"| {bad_row.row_index} | {col} | {bad_row.reason} |")
        
        if len(report.compatibility.bad_rows) > 50:
            md.append(f"| ... | ... | and {len(report.compatibility.bad_rows) - 50} more rows |")
        md.append("")
    
    md.extend([
        f"## Output Files",
        f"",
    ])
    
    for name, path in report.output_paths.items():
        md.append(f"- **{name}**: `{path}`")
    
    md.extend([
        f"",
        f"---",
        f"*Report generated by Parquet Evolve CLI*",
    ])
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(md))
