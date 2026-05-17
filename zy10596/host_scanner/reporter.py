import json
import csv
from datetime import datetime
from typing import List, Dict
from io import StringIO
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .models import ScanResult, ScanSummary, BadEntry, HostEntry


class ResultAggregator:
    @staticmethod
    def calculate_summary(
        results: List[ScanResult],
        bad_entries: List[BadEntry],
        scan_duration: float
    ) -> ScanSummary:
        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful
        
        successful_latencies = [r.latency_ms for r in results if r.success and r.latency_ms]
        avg_latency = sum(successful_latencies) / len(successful_latencies) if successful_latencies else None
        
        tags_summary = ResultAggregator._group_by_tags(results)
        
        return ScanSummary(
            total=len(results) + len(bad_entries),
            successful=successful,
            failed=failed,
            bad_entries=len(bad_entries),
            avg_latency_ms=round(avg_latency, 2) if avg_latency else None,
            scan_duration_seconds=round(scan_duration, 2),
            results=results,
            bad_entries_list=bad_entries,
            tags_summary=tags_summary
        )
    
    @staticmethod
    def _group_by_tags(results: List[ScanResult]) -> Dict[str, Dict[str, int]]:
        tags_stats: Dict[str, Dict[str, int]] = {}
        
        for result in results:
            for tag in result.host.tags:
                if tag not in tags_stats:
                    tags_stats[tag] = {"total": 0, "successful": 0, "failed": 0}
                tags_stats[tag]["total"] += 1
                if result.success:
                    tags_stats[tag]["successful"] += 1
                else:
                    tags_stats[tag]["failed"] += 1
        
        return tags_stats


class ConsoleReporter:
    def __init__(self):
        self.console = Console()
    
    def print_summary(self, summary: ScanSummary):
        self._print_header(summary)
        self._print_overview(summary)
        self._print_results_table(summary)
        self._print_tags_summary(summary)
        self._print_bad_entries(summary)
        self._print_failed_hosts(summary)
    
    def _print_header(self, summary: ScanSummary):
        title = Text("远程主机连通性巡检报告", style="bold blue")
        subtitle = Text(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", style="dim")
        self.console.print(Panel.fit(Text.assemble(title, "\n", subtitle), border_style="blue"))
    
    def _print_overview(self, summary: ScanSummary):
        table = Table(title="巡检概览", show_header=True, header_style="bold magenta")
        table.add_column("指标", style="cyan")
        table.add_column("数值", justify="right")
        table.add_column("说明", style="dim")
        
        table.add_row("主机总数", str(summary.total), "包含有效条目和坏数据")
        table.add_row("探测成功", f"[green]{summary.successful}[/green]", f"成功率: {summary.successful/summary.total*100:.1f}%" if summary.total > 0 else "N/A")
        table.add_row("探测失败", f"[red]{summary.failed}[/red]", "")
        table.add_row("坏数据", f"[yellow]{summary.bad_entries}[/yellow]", "格式错误或空行")
        table.add_row("平均延迟", f"{summary.avg_latency_ms:.2f}ms" if summary.avg_latency_ms else "N/A", "仅统计成功主机")
        table.add_row("扫描耗时", f"{summary.scan_duration_seconds:.2f}s", "")
        
        self.console.print(table)
    
    def _print_results_table(self, summary: ScanSummary):
        table = Table(title="探测结果详情", show_header=True, header_style="bold magenta")
        table.add_column("行号", justify="right", style="dim")
        table.add_column("主机名", style="cyan")
        table.add_column("端口", justify="right")
        table.add_column("标签", style="blue")
        table.add_column("状态", style="bold")
        table.add_column("延迟", justify="right")
        table.add_column("错误原因", style="red")
        
        for result in sorted(summary.results, key=lambda x: x.host.line_number):
            status = "[green]✓ 成功[/green]" if result.success else "[red]✗ 失败[/red]"
            latency = f"{result.latency_ms:.2f}ms" if result.latency_ms else "N/A"
            tags = ", ".join(result.host.tags) if result.host.tags else "-"
            error = result.error_message or ""
            table.add_row(
                str(result.host.line_number),
                result.host.hostname,
                str(result.host.port),
                tags,
                status,
                latency,
                error
            )
        
        self.console.print(table)
    
    def _print_tags_summary(self, summary: ScanSummary):
        if not summary.tags_summary:
            return
        
        table = Table(title="按标签分组统计", show_header=True, header_style="bold magenta")
        table.add_column("标签", style="blue")
        table.add_column("总数", justify="right")
        table.add_column("成功", justify="right", style="green")
        table.add_column("失败", justify="right", style="red")
        table.add_column("成功率", justify="right")
        
        for tag, stats in sorted(summary.tags_summary.items()):
            success_rate = stats["successful"] / stats["total"] * 100 if stats["total"] > 0 else 0
            table.add_row(
                tag,
                str(stats["total"]),
                str(stats["successful"]),
                str(stats["failed"]),
                f"{success_rate:.1f}%"
            )
        
        self.console.print(table)
    
    def _print_bad_entries(self, summary: ScanSummary):
        if not summary.bad_entries_list:
            return
        
        table = Table(title="坏数据记录", show_header=True, header_style="bold yellow")
        table.add_column("行号", justify="right", style="dim")
        table.add_column("原始内容", style="red")
        table.add_column("错误原因", style="yellow")
        
        for bad in sorted(summary.bad_entries_list, key=lambda x: x.line_number):
            table.add_row(str(bad.line_number), bad.raw_line or "(空行)", bad.error_reason)
        
        self.console.print(table)
    
    def _print_failed_hosts(self, summary: ScanSummary):
        failed_hosts = [r for r in summary.results if not r.success]
        if not failed_hosts:
            return
        
        table = Table(title="失败主机详情", show_header=True, header_style="bold red")
        table.add_column("行号", justify="right")
        table.add_column("主机名", style="cyan")
        table.add_column("端口", justify="right")
        table.add_column("标签", style="blue")
        table.add_column("失败原因", style="red")
        
        for result in sorted(failed_hosts, key=lambda x: x.host.line_number):
            tags = ", ".join(result.host.tags) if result.host.tags else "-"
            table.add_row(
                str(result.host.line_number),
                result.host.hostname,
                str(result.host.port),
                tags,
                result.error_message or "未知错误"
            )
        
        self.console.print(table)


class FileReporter:
    @staticmethod
    def export_json(summary: ScanSummary, filepath: str):
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(summary.to_dict(), f, ensure_ascii=False, indent=2)
    
    @staticmethod
    def export_csv(summary: ScanSummary, filepath: str):
        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(["行号", "主机名", "端口", "标签", "状态", "延迟(ms)", "错误原因"])
            for result in summary.results:
                status = "成功" if result.success else "失败"
                tags = ", ".join(result.host.tags) if result.host.tags else ""
                writer.writerow([
                    result.host.line_number,
                    result.host.hostname,
                    result.host.port,
                    tags,
                    status,
                    result.latency_ms or "",
                    result.error_message or ""
                ])
            
            writer.writerow([])
            writer.writerow(["坏数据记录"])
            writer.writerow(["行号", "原始内容", "错误原因"])
            for bad in summary.bad_entries_list:
                writer.writerow([bad.line_number, bad.raw_line, bad.error_reason])
    
    @staticmethod
    def export_markdown(summary: ScanSummary, filepath: str):
        md_content = FileReporter._generate_markdown(summary)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(md_content)
    
    @staticmethod
    def _generate_markdown(summary: ScanSummary) -> str:
        output = StringIO()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        output.write("# 远程主机连通性巡检报告\n\n")
        output.write(f"> 生成时间: {now}\n\n")
        
        output.write("## 巡检概览\n\n")
        output.write("| 指标 | 数值 | 说明 |\n")
        output.write("|------|------|------|\n")
        output.write(f"| 主机总数 | {summary.total} | 包含有效条目和坏数据 |\n")
        output.write(f"| 探测成功 | **{summary.successful}** | 成功率: {summary.successful/summary.total*100:.1f}% |\n" if summary.total > 0 else "")
        output.write(f"| 探测失败 | **{summary.failed}** | |\n")
        output.write(f"| 坏数据 | **{summary.bad_entries}** | 格式错误或空行 |\n")
        output.write(f"| 平均延迟 | {summary.avg_latency_ms:.2f}ms" if summary.avg_latency_ms else "| 平均延迟 | N/A")
        output.write(" | 仅统计成功主机 |\n")
        output.write(f"| 扫描耗时 | {summary.scan_duration_seconds:.2f}s | |\n\n")
        
        output.write("## 按标签分组统计\n\n")
        if summary.tags_summary:
            output.write("| 标签 | 总数 | 成功 | 失败 | 成功率 |\n")
            output.write("|------|------|------|------|--------|\n")
            for tag, stats in sorted(summary.tags_summary.items()):
                success_rate = stats["successful"] / stats["total"] * 100 if stats["total"] > 0 else 0
                output.write(f"| {tag} | {stats['total']} | {stats['successful']} | {stats['failed']} | {success_rate:.1f}% |\n")
            output.write("\n")
        else:
            output.write("暂无标签数据\n\n")
        
        output.write("## 失败主机列表\n\n")
        failed_hosts = [r for r in summary.results if not r.success]
        if failed_hosts:
            output.write("| 行号 | 主机名 | 端口 | 标签 | 失败原因 |\n")
            output.write("|------|--------|------|------|----------|\n")
            for result in sorted(failed_hosts, key=lambda x: x.host.line_number):
                tags = ", ".join(result.host.tags) if result.host.tags else "-"
                output.write(f"| {result.host.line_number} | {result.host.hostname} | {result.host.port} | {tags} | {result.error_message or '未知错误'} |\n")
            output.write("\n")
        else:
            output.write("🎉 所有主机探测成功！\n\n")
        
        output.write("## 探测结果详情\n\n")
        output.write("| 行号 | 主机名 | 端口 | 标签 | 状态 | 延迟(ms) | 错误原因 |\n")
        output.write("|------|--------|------|------|------|----------|----------|\n")
        for result in sorted(summary.results, key=lambda x: x.host.line_number):
            status = "✅ 成功" if result.success else "❌ 失败"
            latency = f"{result.latency_ms:.2f}" if result.latency_ms else "N/A"
            tags = ", ".join(result.host.tags) if result.host.tags else "-"
            error = result.error_message or ""
            output.write(f"| {result.host.line_number} | {result.host.hostname} | {result.host.port} | {tags} | {status} | {latency} | {error} |\n")
        output.write("\n")
        
        if summary.bad_entries_list:
            output.write("## 坏数据记录\n\n")
            output.write("| 行号 | 原始内容 | 错误原因 |\n")
            output.write("|------|----------|----------|\n")
            for bad in sorted(summary.bad_entries_list, key=lambda x: x.line_number):
                raw = bad.raw_line if bad.raw_line else "(空行)"
                output.write(f"| {bad.line_number} | `{raw}` | {bad.error_reason} |\n")
            output.write("\n")
        
        output.write("---\n\n")
        output.write("> 本报告由 host-scanner 工具自动生成\n")
        
        return output.getvalue()
