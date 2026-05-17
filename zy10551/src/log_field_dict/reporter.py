import json
import os
from datetime import datetime
from typing import Dict, Any
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from .models import AnalysisResult, FieldInfo


class Reporter:
    def __init__(self, result: AnalysisResult, output_dir: str = "output"):
        self.result = result
        self.output_dir = output_dir
        self.console = Console()
        os.makedirs(output_dir, exist_ok=True)

    def print_summary(self):
        self.console.print(Panel.fit(
            f"[bold blue]日志字段字典分析报告[/bold blue]\n"
            f"生成时间: {self.result.generated_at.strftime('%Y-%m-%d %H:%M:%S')}",
            border_style="blue"
        ))

        stats_table = Table(title="统计概览", show_header=True, header_style="bold magenta")
        stats_table.add_column("指标")
        stats_table.add_column("数值", justify="right")
        stats_table.add_row("总日志行数", str(self.result.total_records))
        stats_table.add_row("发现字段数", str(self.result.total_fields))
        stats_table.add_row("涉及服务数", str(len(self.result.services)))
        stats_table.add_row("冲突字段数", f"[red]{len(self.result.conflicting_fields)}[/red]")
        stats_table.add_row("坏记录数", f"[yellow]{len(self.result.bad_records)}[/yellow]")
        self.console.print(stats_table)

        if self.result.services:
            services_table = Table(title="涉及服务列表", show_header=True, header_style="bold green")
            services_table.add_column("服务名")
            for svc in sorted(self.result.services):
                services_table.add_row(svc)
            self.console.print(services_table)

        if self.result.conflicting_fields:
            self.console.print("\n[bold red]冲突字段详情:[/bold red]")
            for field_name in sorted(self.result.conflicting_fields):
                field_info = self.result.fields[field_name]
                conflict_table = Table(title=f"字段: {field_name}", show_header=True)
                conflict_table.add_column("类型", style="cyan")
                conflict_table.add_column("使用该类型的服务")
                
                for type_name, services in sorted(field_info.type_summary.items()):
                    conflict_table.add_row(type_name, ", ".join(sorted(services)))
                
                self.console.print(conflict_table)

        if self.result.bad_records:
            self.console.print(f"\n[bold yellow]坏记录数: {len(self.result.bad_records)}[/bold yellow]")
            self.console.print("详情请查看 bad_records.json 文件\n")

    def export_json(self) -> str:
        output = self._build_json_output()
        file_path = os.path.join(self.output_dir, "field_dictionary.json")
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        return file_path

    def export_bad_records(self) -> str:
        bad_records_data = []
        for br in self.result.bad_records:
            bad_records_data.append({
                "line_number": br.line_number,
                "service_name": br.service_name,
                "error_message": br.error_message,
                "raw_content": br.raw_content
            })
        
        file_path = os.path.join(self.output_dir, "bad_records.json")
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(bad_records_data, f, ensure_ascii=False, indent=2)
        return file_path

    def export_markdown(self) -> str:
        content = self._build_markdown_content()
        file_path = os.path.join(self.output_dir, "field_dictionary_report.md")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return file_path

    def _build_json_output(self) -> Dict[str, Any]:
        fields_dict = {}
        for field_name, field_info in self.result.fields.items():
            fields_dict[field_name] = {
                "has_conflict": field_info.has_conflict,
                "services": field_info.services,
                "type_summary": field_info.type_summary,
                "samples": self._get_samples_for_field(field_info)
            }
        
        return {
            "metadata": {
                "generated_at": self.result.generated_at.isoformat(),
                "total_records": self.result.total_records,
                "total_fields": self.result.total_fields,
                "services": self.result.services,
                "conflicting_fields_count": len(self.result.conflicting_fields),
                "bad_records_count": len(self.result.bad_records)
            },
            "conflicting_fields": self.result.conflicting_fields,
            "fields": fields_dict
        }

    def _get_samples_for_field(self, field_info: FieldInfo) -> Dict[str, Any]:
        samples = {}
        for svc, occurrences in field_info.occurrences.items():
            if occurrences:
                occ = occurrences[0]
                samples[svc] = {
                    "type": occ.field_type.value,
                    "sample_value": str(occ.sample_value)[:100],
                    "first_seen_line": occ.line_number
                }
        return samples

    def _build_markdown_content(self) -> str:
        lines = []
        lines.append("# 日志字段字典分析报告")
        lines.append("")
        lines.append(f"**生成时间**: {self.result.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 统计概览")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总日志行数 | {self.result.total_records} |")
        lines.append(f"| 发现字段数 | {self.result.total_fields} |")
        lines.append(f"| 涉及服务数 | {len(self.result.services)} |")
        lines.append(f"| 冲突字段数 | **{len(self.result.conflicting_fields)}** |")
        lines.append(f"| 坏记录数 | {len(self.result.bad_records)} |")
        lines.append("")

        lines.append("## 涉及服务")
        lines.append("")
        for svc in sorted(self.result.services):
            lines.append(f"- {svc}")
        lines.append("")

        if self.result.conflicting_fields:
            lines.append("## ⚠️ 冲突字段详情")
            lines.append("")
            for field_name in sorted(self.result.conflicting_fields):
                lines.append(f"### {field_name}")
                lines.append("")
                lines.append("| 类型 | 使用服务 |")
                lines.append("|------|----------|")
                field_info = self.result.fields[field_name]
                for type_name, services in sorted(field_info.type_summary.items()):
                    lines.append(f"| {type_name} | {', '.join(sorted(services))} |")
                lines.append("")
                
                lines.append("**各服务样本:**")
                lines.append("")
                for svc, occurrences in field_info.occurrences.items():
                    if occurrences:
                        occ = occurrences[0]
                        sample_val = str(occ.sample_value).replace('|', '\\|')[:80]
                        lines.append(f"- **{svc}**: `{occ.field_type.value}` - 示例值: `{sample_val}`")
                lines.append("")

        lines.append("## 完整字段字典")
        lines.append("")
        lines.append("| 字段名 | 冲突? | 类型分布 | 使用服务 |")
        lines.append("|--------|-------|----------|----------|")
        for field_name in sorted(self.result.fields.keys()):
            field_info = self.result.fields[field_name]
            conflict_mark = "✅" if not field_info.has_conflict else "⚠️"
            type_dist = ", ".join([f"{k}({len(v)})" for k, v in sorted(field_info.type_summary.items())])
            services_str = ", ".join(sorted(field_info.services)[:3])
            if len(field_info.services) > 3:
                services_str += f" (+{len(field_info.services) - 3} more)"
            lines.append(f"| {field_name} | {conflict_mark} | {type_dist} | {services_str} |")
        lines.append("")

        if self.result.bad_records:
            lines.append("## ❌ 坏记录")
            lines.append("")
            lines.append(f"共 {len(self.result.bad_records)} 条坏记录，详情请查看 bad_records.json")
            lines.append("")

        lines.append("---")
        lines.append("*此报告由 log-field-dict CLI 自动生成*")

        return "\n".join(lines)
