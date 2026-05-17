import json
from datetime import datetime
from typing import Dict, Any
from pathlib import Path

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .models import CheckResult, MatchResult, BadLine


class Reporter:
    def __init__(self, result: CheckResult):
        self.result = result
        self.console = Console()

    def print_terminal_summary(self) -> None:
        self.console.print("\n")
        self.console.print(Panel.fit(
            "[bold blue]API网关路由体检报告[/bold blue]",
            subtitle=f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ))

        self._print_summary_stats()
        self._print_match_results()
        self._print_unmatched_requests()
        self._print_bad_lines()
        self._print_upstream_stats()

    def _print_summary_stats(self) -> None:
        total_routes = len(self.result.routes)
        total_requests = len(self.result.requests)
        matched_count = sum(1 for r in self.result.match_results if r.is_matched)
        unmatched_count = len(self.result.unmatched_requests)
        bad_line_count = len(self.result.bad_lines)

        table = Table(title="概览统计", show_header=True, header_style="bold magenta")
        table.add_column("指标", style="cyan")
        table.add_column("数值", style="green")
        table.add_row("路由规则总数", str(total_routes))
        table.add_row("请求样本总数", str(total_requests))
        table.add_row("成功匹配", f"[green]{matched_count}[/green]")
        table.add_row("未命中请求", f"[yellow]{unmatched_count}[/yellow]")
        table.add_row("解析错误行数", f"[red]{bad_line_count}[/red]")

        self.console.print(table)

    def _print_match_results(self) -> None:
        if not self.result.match_results:
            return

        table = Table(title="匹配结果详情", show_header=True, header_style="bold magenta")
        table.add_column("#", style="cyan")
        table.add_column("请求路径", style="white")
        table.add_column("方法", style="blue")
        table.add_column("匹配状态", style="green")
        table.add_column("上游服务", style="yellow")
        table.add_column("匹配说明", style="dim")

        for idx, result in enumerate(self.result.match_results, 1):
            status = "[green]✓[/green]" if result.is_matched else "[red]✗[/red]"
            upstream = result.matched_route.upstream if result.matched_route else "-"
            table.add_row(
                str(idx),
                result.request.path,
                result.request.method,
                status,
                upstream,
                result.match_reason[:50] + "..." if len(result.match_reason) > 50 else result.match_reason
            )

        self.console.print(table)

    def _print_unmatched_requests(self) -> None:
        if not self.result.unmatched_requests:
            return

        table = Table(title="未命中请求列表", show_header=True, header_style="bold yellow")
        table.add_column("#", style="cyan")
        table.add_column("请求路径", style="white")
        table.add_column("方法", style="blue")
        table.add_column("来源文件", style="dim")
        table.add_column("行号", style="dim")

        for idx, req in enumerate(self.result.unmatched_requests, 1):
            table.add_row(
                str(idx),
                req.path,
                req.method,
                req.source_file,
                str(req.line_number)
            )

        self.console.print(table)

    def _print_bad_lines(self) -> None:
        if not self.result.bad_lines:
            return

        table = Table(title="解析错误行", show_header=True, header_style="bold red")
        table.add_column("#", style="cyan")
        table.add_column("来源文件", style="dim")
        table.add_column("行号", style="dim")
        table.add_column("错误类型", style="red")
        table.add_column("原始内容", style="white", no_wrap=True)
        table.add_column("错误信息", style="yellow")

        for idx, bad_line in enumerate(self.result.bad_lines, 1):
            table.add_row(
                str(idx),
                bad_line.source_file,
                str(bad_line.line_number),
                bad_line.error_type,
                bad_line.raw_content[:40] + "..." if len(bad_line.raw_content) > 40 else bad_line.raw_content,
                bad_line.error_message
            )

        self.console.print(table)

    def _print_upstream_stats(self) -> None:
        if not self.result.upstream_stats:
            return

        table = Table(title="上游服务分布", show_header=True, header_style="bold green")
        table.add_column("上游服务", style="cyan")
        table.add_column("匹配次数", style="green")

        for upstream, count in sorted(self.result.upstream_stats.items(), key=lambda x: -x[1]):
            table.add_row(upstream, str(count))

        self.console.print(table)

    def generate_json_report(self, output_path: str) -> None:
        report = {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_routes": len(self.result.routes),
                "total_requests": len(self.result.requests),
                "matched_requests": sum(1 for r in self.result.match_results if r.is_matched),
                "unmatched_requests": len(self.result.unmatched_requests),
                "bad_lines": len(self.result.bad_lines),
                "upstream_stats": self.result.upstream_stats
            },
            "routes": [
                {
                    "path": r.path,
                    "upstream": r.upstream,
                    "match_type": r.match_type.value,
                    "priority": r.priority,
                    "methods": r.methods,
                    "source_file": r.source_file,
                    "line_number": r.line_number
                }
                for r in self.result.routes
            ],
            "match_results": [
                {
                    "request": {
                        "path": mr.request.path,
                        "method": mr.request.method,
                        "headers": mr.request.headers,
                        "source_file": mr.request.source_file,
                        "line_number": mr.request.line_number
                    },
                    "is_matched": mr.is_matched,
                    "matched_route": {
                        "path": mr.matched_route.path,
                        "upstream": mr.matched_route.upstream
                    } if mr.matched_route else None,
                    "match_reason": mr.match_reason
                }
                for mr in self.result.match_results
            ],
            "unmatched_requests": [
                {
                    "path": req.path,
                    "method": req.method,
                    "source_file": req.source_file,
                    "line_number": req.line_number,
                    "raw_content": req.raw_content
                }
                for req in self.result.unmatched_requests
            ],
            "bad_lines": [
                {
                    "source_file": bl.source_file,
                    "line_number": bl.line_number,
                    "raw_content": bl.raw_content,
                    "error_message": bl.error_message,
                    "error_type": bl.error_type
                }
                for bl in self.result.bad_lines
            ]
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

    def generate_markdown_report(self, output_path: str) -> None:
        content = self._build_markdown_content()
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)

    def _build_markdown_content(self) -> str:
        total_routes = len(self.result.routes)
        total_requests = len(self.result.requests)
        matched_count = sum(1 for r in self.result.match_results if r.is_matched)
        unmatched_count = len(self.result.unmatched_requests)
        bad_line_count = len(self.result.bad_lines)

        content = f"""# API网关路由体检报告

**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 概览统计

| 指标 | 数值 |
|------|------|
| 路由规则总数 | {total_routes} |
| 请求样本总数 | {total_requests} |
| 成功匹配 | {matched_count} |
| 未命中请求 | {unmatched_count} |
| 解析错误行数 | {bad_line_count} |

"""

        if self.result.upstream_stats:
            content += """## 上游服务分布

| 上游服务 | 匹配次数 |
|----------|----------|
"""
            for upstream, count in sorted(self.result.upstream_stats.items(), key=lambda x: -x[1]):
                content += f"| {upstream} | {count} |\n"

        if self.result.routes:
            content += """

## 路由规则优先级

| 优先级排序 | 路径匹配规则 | 上游服务 | 匹配类型 | 优先级值 |
|------------|--------------|----------|----------|----------|
"""
            for idx, route in enumerate(self.result.routes, 1):
                content += f"| {idx} | `{route.path}` | {route.upstream} | {route.match_type.value} | {route.priority} |\n"

        if self.result.match_results:
            content += """

## 匹配结果详情

| # | 请求路径 | 方法 | 匹配状态 | 上游服务 | 匹配说明 |
|---|----------|------|----------|----------|----------|
"""
            for idx, result in enumerate(self.result.match_results, 1):
                status = "✅ 匹配" if result.is_matched else "❌ 未匹配"
                upstream = result.matched_route.upstream if result.matched_route else "-"
                content += f"| {idx} | `{result.request.path}` | {result.request.method} | {status} | {upstream} | {result.match_reason} |\n"

        if self.result.unmatched_requests:
            content += """

## 未命中请求列表

| # | 请求路径 | 方法 | 来源文件 | 行号 | 原始内容 |
|---|----------|------|----------|------|----------|
"""
            for idx, req in enumerate(self.result.unmatched_requests, 1):
                content += f"| {idx} | `{req.path}` | {req.method} | `{Path(req.source_file).name}` | {req.line_number} | `{req.raw_content}` |\n"

        if self.result.bad_lines:
            content += """

## ⚠️ 解析错误行

| # | 来源文件 | 行号 | 错误类型 | 原始内容 | 错误信息 |
|---|----------|------|----------|----------|----------|
"""
            for idx, bad_line in enumerate(self.result.bad_lines, 1):
                raw_content = bad_line.raw_content.replace('|', '\\|')
                error_msg = bad_line.error_message.replace('|', '\\|')
                content += f"| {idx} | `{Path(bad_line.source_file).name}` | {bad_line.line_number} | {bad_line.error_type} | `{raw_content[:60]}` | {error_msg} |\n"

        content += """

---

*此报告由 route-checker 工具自动生成*
"""

        return content
