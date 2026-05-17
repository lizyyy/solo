import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .reader import ReadResult
from .grouper import GroupResult
from .sampler import SampleResult
from .redactor import Redactor


@dataclass
class OutputPaths:
    summary_json: str
    samples_jsonl: str
    report_md: str
    errors_jsonl: str


class Reporter:
    def __init__(self, redactor: Optional[Redactor] = None, no_redact: bool = False):
        self.console = Console()
        self.redactor = redactor if not no_redact else None
        self.no_redact = no_redact

    def print_terminal_summary(self, read_result: ReadResult, group_result: GroupResult, sample_result: SampleResult):
        self.console.print(Panel.fit("[bold blue]死信采样报告摘要[/bold blue]"))
        
        self.console.print(f"\n[bold]总统计[/bold]")
        self.console.print(f"  总行数: {read_result.total_lines}")
        self.console.print(f"  有效消息: {read_result.valid_count}")
        self.console.print(f"  解析错误: {read_result.invalid_count}")
        self.console.print(f"  错误类型数: {group_result.total_reasons}")
        self.console.print(f"  采样总数: {sample_result.total_sampled}")

        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("排名", style="dim", width=6)
        table.add_column("错误原因", width=60)
        table.add_column("数量", justify="right")
        table.add_column("占比", justify="right")
        table.add_column("采样", justify="right")

        for idx, group in enumerate(group_result.groups[:15], 1):
            reason_key = group.reason or "UNKNOWN"
            sampled = sample_result.sample_summary.get(reason_key, {}).get("sampled", 0)
            table.add_row(
                str(idx),
                (group.reason or "UNKNOWN")[:57] + "..." if len(group.reason or "") > 57 else group.reason,
                str(group.count),
                f"{group.percentage:.1f}%",
                str(sampled)
            )

        if len(group_result.groups) > 15:
            table.add_row("...", f"... 还有 {len(group_result.groups) - 15} 种", "", "", "")

        self.console.print("\n[bold]错误原因分布 (TOP 15)[/bold]")
        self.console.print(table)

        if sample_result.parse_errors:
            self.console.print(f"\n[bold yellow]⚠️  解析错误: {len(sample_result.parse_errors)} 条[/bold yellow]")
            for err in sample_result.parse_errors[:3]:
                self.console.print(f"  行 {err.line_number}: {err.parse_error}")
            if len(sample_result.parse_errors) > 3:
                self.console.print(f"  ... 还有 {len(sample_result.parse_errors) - 3} 条")

    def generate_json_summary(self, read_result: ReadResult, group_result: GroupResult, 
                             sample_result: SampleResult) -> dict:
        return {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_lines": read_result.total_lines,
                "valid_messages": read_result.valid_count,
                "parse_errors": read_result.invalid_count,
                "error_types_count": group_result.total_reasons,
                "total_sampled": sample_result.total_sampled,
            },
            "error_distribution": [
                {
                    "reason": g.reason,
                    "count": g.count,
                    "percentage": g.percentage,
                    "sampled": sample_result.sample_summary.get(g.reason or "UNKNOWN", {}).get("sampled", 0)
                }
                for g in group_result.groups
            ],
            "parse_errors_summary": [
                {
                    "line_number": e.line_number,
                    "error": e.parse_error
                }
                for e in sample_result.parse_errors
            ]
        }

    def generate_samples_jsonl(self, sample_result: SampleResult) -> str:
        lines = []
        for msg in sample_result.samples:
            if self.redactor:
                redacted = self.redactor.redact_message(msg)
                lines.append(json.dumps(redacted, ensure_ascii=False))
            else:
                lines.append(msg.raw_content)
        return "\n".join(lines)

    def generate_errors_jsonl(self, sample_result: SampleResult) -> str:
        lines = []
        for msg in sample_result.parse_errors:
            lines.append(json.dumps({
                "line_number": msg.line_number,
                "parse_error": msg.parse_error,
                "raw_content": msg.raw_content
            }, ensure_ascii=False))
        return "\n".join(lines)

    def generate_markdown_report(self, read_result: ReadResult, group_result: GroupResult, 
                                 sample_result: SampleResult) -> str:
        lines = []
        lines.append("# 死信队列采样报告")
        lines.append("")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 统计摘要")
        lines.append("")
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 总行数 | {read_result.total_lines} |")
        lines.append(f"| 有效消息 | {read_result.valid_count} |")
        lines.append(f"| 解析错误 | {read_result.invalid_count} |")
        lines.append(f"| 错误类型数 | {group_result.total_reasons} |")
        lines.append(f"| 采样总数 | {sample_result.total_sampled} |")
        lines.append("")

        lines.append("## 错误原因分布")
        lines.append("")
        lines.append("| 排名 | 错误原因 | 数量 | 占比 | 采样 |")
        lines.append("|------|---------|------|------|------|")
        
        for idx, group in enumerate(group_result.groups, 1):
            reason_key = group.reason or "UNKNOWN"
            sampled = sample_result.sample_summary.get(reason_key, {}).get("sampled", 0)
            reason_display = (group.reason or "UNKNOWN").replace("|", "\\|")
            lines.append(f"| {idx} | {reason_display} | {group.count} | {group.percentage:.1f}% | {sampled} |")
        
        lines.append("")

        if sample_result.parse_errors:
            lines.append("## 解析错误明细")
            lines.append("")
            lines.append("| 行号 | 错误原因 |")
            lines.append("|------|---------|")
            for err in sample_result.parse_errors:
                lines.append(f"| {err.line_number} | {err.parse_error} |")
            lines.append("")

        lines.append("## 采样说明")
        lines.append("")
        lines.append("- 采用分层采样，确保每种错误类型至少有代表性样本")
        lines.append("- 大占比的错误类型会分配更多采样数")
        lines.append("- 采样结果包含在 samples.jsonl 文件中")
        if not self.no_redact:
            lines.append("- 敏感数据已自动脱敏（手机号、邮箱、密码等）")
        lines.append("")

        return "\n".join(lines)

    def write_outputs(self, output_dir: str, read_result: ReadResult, 
                      group_result: GroupResult, sample_result: SampleResult) -> OutputPaths:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        summary_path = output_path / "summary.json"
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(self.generate_json_summary(read_result, group_result, sample_result), 
                     f, ensure_ascii=False, indent=2)

        samples_path = output_path / "samples.jsonl"
        with open(samples_path, "w", encoding="utf-8") as f:
            f.write(self.generate_samples_jsonl(sample_result))

        errors_path = output_path / "errors.jsonl"
        with open(errors_path, "w", encoding="utf-8") as f:
            f.write(self.generate_errors_jsonl(sample_result))

        report_path = output_path / "report.md"
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(self.generate_markdown_report(read_result, group_result, sample_result))

        self.console.print(f"\n[bold green]✓ 输出文件已写入: {output_dir}/[/bold green]")
        self.console.print(f"  - summary.json (机器可读统计)")
        self.console.print(f"  - samples.jsonl (采样结果)")
        self.console.print(f"  - errors.jsonl (解析错误详情)")
        self.console.print(f"  - report.md (团队分享报告)")

        return OutputPaths(
            summary_json=str(summary_path),
            samples_jsonl=str(samples_path),
            report_md=str(report_path),
            errors_jsonl=str(errors_path)
        )
