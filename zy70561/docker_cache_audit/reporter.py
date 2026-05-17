import json
from typing import Optional
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box
from .models import AnalysisResult, CacheStatus, LayerInfo


class Reporter:
    def __init__(self, result: AnalysisResult):
        self.result = result
        self.console = Console()

    def _format_bytes(self, bytes_val: int) -> str:
        if bytes_val < 1024:
            return f"{bytes_val} B"
        elif bytes_val < 1024 * 1024:
            return f"{bytes_val / 1024:.2f} KB"
        elif bytes_val < 1024 * 1024 * 1024:
            return f"{bytes_val / (1024 * 1024):.2f} MB"
        else:
            return f"{bytes_val / (1024 * 1024 * 1024):.2f} GB"

    def _format_time(self, ms: int) -> str:
        if ms < 1000:
            return f"{ms} ms"
        elif ms < 60 * 1000:
            return f"{ms / 1000:.2f} s"
        else:
            minutes = ms // 60000
            seconds = (ms % 60000) / 1000
            return f"{minutes}m {seconds:.2f}s"

    def print_summary(self) -> None:
        self.console.print()
        self.console.print(Panel.fit(
            "[bold blue]Docker Build Cache Analysis Report[/bold blue]",
            border_style="blue"
        ))
        self.console.print()

        self._print_overview()
        self.console.print()
        self._print_layers_table()
        self.console.print()
        self._print_recommendations()
        self.console.print()

        if self.result.parse_errors:
            self._print_errors()
            self.console.print()

    def _print_overview(self) -> None:
        table = Table(title="Overview", box=box.SIMPLE, show_header=False)
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")

        hit_rate = self.result.cache_hit_rate * 100
        hit_rate_color = "green" if hit_rate >= 80 else "yellow" if hit_rate >= 50 else "red"

        table.add_row("Total Layers", str(len(self.result.layers)))
        table.add_row("Cache Hits", f"[green]{self.result.cache_hit_count}[/green]")
        table.add_row("Cache Misses", f"[red]{self.result.cache_miss_count}[/red]")
        table.add_row("Cache Hit Rate", f"[{hit_rate_color}]{hit_rate:.1f}%[/{hit_rate_color}]")
        table.add_row("Total Build Time", self._format_time(self.result.total_build_time_ms))
        table.add_row("Total Size", self._format_bytes(sum(l.size_bytes for l in self.result.layers)))

        self.console.print(table)

    def _print_layers_table(self) -> None:
        table = Table(title="Layer Details", box=box.ROUNDED)
        table.add_column("#", style="dim", width=4)
        table.add_column("Status", width=8)
        table.add_column("Instruction", style="cyan", width=30)
        table.add_column("Time", style="magenta", width=12)
        table.add_column("Size", style="yellow", width=12)
        table.add_column("Cause of Miss", style="red")

        for layer in self.result.layers:
            status = self._get_status_text(layer.cache_status)
            instruction = layer.instruction[:30] + "..." if len(layer.instruction) > 30 else layer.instruction
            time_str = self._format_time(layer.build_time_ms) if layer.build_time_ms > 0 else "-"
            size_str = self._format_bytes(layer.size_bytes) if layer.size_bytes > 0 else "-"
            cause = layer.cause_of_miss if layer.cache_status == CacheStatus.MISS else ""

            table.add_row(
                str(layer.index),
                status,
                instruction,
                time_str,
                size_str,
                cause
            )

        self.console.print(table)

    def _get_status_text(self, status: CacheStatus) -> Text:
        if status == CacheStatus.HIT:
            return Text("✓ HIT", style="bold green")
        elif status == CacheStatus.MISS:
            return Text("✗ MISS", style="bold red")
        else:
            return Text("?", style="bold yellow")

    def _print_recommendations(self) -> None:
        if self.result.recommendations:
            self.console.print(Panel(
                "\n".join(f"• {rec}" for rec in self.result.recommendations),
                title="[bold yellow]Recommendations[/bold yellow]",
                border_style="yellow"
            ))

    def _print_errors(self) -> None:
        table = Table(title="Parse Errors", box=box.ROUNDED)
        table.add_column("File", style="cyan")
        table.add_column("Line", style="dim", width=6)
        table.add_column("Type", style="magenta")
        table.add_column("Message", style="red")

        for error in self.result.parse_errors:
            table.add_row(
                error.source_file,
                str(error.line_number),
                error.error_type,
                error.message
            )

        self.console.print(table)

    def export_json(self, filepath: Optional[str] = None, indent: int = 2) -> Optional[str]:
        data = self.result.to_dict()
        
        if filepath:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=indent, ensure_ascii=False)
            return None
        else:
            return json.dumps(data, indent=indent, ensure_ascii=False)

    def export_markdown(self, filepath: Optional[str] = None) -> Optional[str]:
        lines = []
        
        lines.append("# Docker Build Cache Analysis Report")
        lines.append("")
        
        lines.append("## Overview")
        lines.append("")
        lines.append("| Metric | Value |")
        lines.append("|--------|-------|")
        hit_rate = self.result.cache_hit_rate * 100
        lines.append(f"| Total Layers | {len(self.result.layers)} |")
        lines.append(f"| Cache Hits | {self.result.cache_hit_count} |")
        lines.append(f"| Cache Misses | {self.result.cache_miss_count} |")
        lines.append(f"| Cache Hit Rate | {hit_rate:.1f}% |")
        lines.append(f"| Total Build Time | {self._format_time(self.result.total_build_time_ms)} |")
        lines.append(f"| Total Size | {self._format_bytes(sum(l.size_bytes for l in self.result.layers))} |")
        lines.append("")
        
        lines.append("## Layer Details")
        lines.append("")
        lines.append("| # | Status | Instruction | Time | Size | Cause of Miss |")
        lines.append("|---|--------|-------------|------|------|---------------|")
        
        for layer in self.result.layers:
            status = "HIT" if layer.cache_status == CacheStatus.HIT else "MISS" if layer.cache_status == CacheStatus.MISS else "UNKNOWN"
            instruction = layer.instruction.replace('|', '\\|')
            time_str = self._format_time(layer.build_time_ms) if layer.build_time_ms > 0 else "-"
            size_str = self._format_bytes(layer.size_bytes) if layer.size_bytes > 0 else "-"
            cause = layer.cause_of_miss.replace('|', '\\|') if layer.cache_status == CacheStatus.MISS else ""
            
            lines.append(f"| {layer.index} | {status} | {instruction} | {time_str} | {size_str} | {cause} |")
        
        lines.append("")
        
        if self.result.recommendations:
            lines.append("## Recommendations")
            lines.append("")
            for rec in self.result.recommendations:
                lines.append(f"- {rec}")
            lines.append("")
        
        if self.result.parse_errors:
            lines.append("## Parse Errors")
            lines.append("")
            lines.append("| File | Line | Type | Message |")
            lines.append("|------|------|------|---------|")
            for error in self.result.parse_errors:
                msg = error.message.replace('|', '\\|')
                lines.append(f"| {error.source_file} | {error.line_number} | {error.error_type} | {msg} |")
            lines.append("")
        
        markdown_content = "\n".join(lines)
        
        if filepath:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(markdown_content)
            return None
        else:
            return markdown_content
