import json
import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .core import (
    SchemaParser,
    TraceParser,
    TimelineRebuilder,
    SchemaDriftDetector,
    RiskAnalyzer,
)
from .reports import MarkdownGenerator, JsonGenerator
from .repro import ReproGenerator

console = Console()


@click.group()
@click.version_option(version="0.1.0")
def main():
    """MCP 工具调用录制与重放调试器"""
    pass


@main.command()
@click.option("--schema", "-s", required=True, help="工具 Schema 文件 (JSON/YAML)")
@click.option("--trace", "-t", required=True, help="调用轨迹文件 (JSONL)")
@click.option("--config", "-c", help="回放配置文件 (JSON)")
@click.option("--output", "-o", help="输出报告文件路径")
@click.option("--format", "-f", "fmt", default="markdown", type=click.Choice(["markdown", "json", "console"]),
              help="输出格式")
@click.option("--verbose", "-v", is_flag=True, help="详细输出")
def analyze(schema: str, trace: str, config: Optional[str], output: Optional[str], fmt: str, verbose: bool):
    """分析工具调用轨迹，检测 Schema 漂移和风险"""
    schema_parser = SchemaParser()
    trace_parser = TraceParser()
    timeline_rebuilder = TimelineRebuilder()
    drift_detector = SchemaDriftDetector()
    risk_analyzer = RiskAnalyzer()

    try:
        tools = schema_parser.parse_file(schema)
        console.print(f"[green]✓[/green] 已加载 {len(tools)} 个工具定义")
    except Exception as e:
        console.print(f"[red]✗[/red] 解析 Schema 失败: {e}")
        sys.exit(1)

    try:
        events = trace_parser.parse_file(trace)
        parse_errors = trace_parser.get_parse_errors()
        if parse_errors:
            for err in parse_errors[:5]:
                console.print(f"[yellow]⚠[/yellow] {err}")
            if len(parse_errors) > 5:
                console.print(f"[yellow]... 还有 {len(parse_errors) - 5} 个错误[/yellow]")
        console.print(f"[green]✓[/green] 已加载 {len(events)} 个事件")
    except Exception as e:
        console.print(f"[red]✗[/red] 解析轨迹失败: {e}")
        sys.exit(1)

    timeline = timeline_rebuilder.rebuild(events)
    console.print(f"[green]✓[/green] 时间线重建完成 (时长: {timeline.total_duration_ms:.2f}ms)")

    drift_issues = drift_detector.detect(tools, events)
    drift_summary = drift_detector.get_summary()
    console.print(f"[green]✓[/green] Schema 漂移检测: {drift_summary['total_issues']} 个问题")

    risk_issues = risk_analyzer.analyze(events, tools)
    risk_summary = risk_analyzer.get_summary()
    console.print(f"[green]✓[/green] 风险分析: {risk_summary['total_risks']} 个风险")

    replay_config = {}
    if config:
        try:
            with open(config, "r") as f:
                replay_config = json.load(f)
        except Exception as e:
            console.print(f"[yellow]⚠[/yellow] 读取配置失败: {e}")

    replay_plan = timeline_rebuilder.generate_replay_plan(timeline, replay_config)

    if fmt == "console" or not output:
        _print_console_summary(
            timeline, drift_issues, risk_issues, tools, events, replay_plan, verbose
        )

    if output:
        if fmt == "markdown" or output.endswith(".md"):
            md_gen = MarkdownGenerator()
            md_gen.generate_file(
                output, timeline, drift_issues, risk_issues, tools, events, replay_plan
            )
            console.print(f"[green]✓[/green] Markdown 报告已生成: {output}")
        elif fmt == "json" or output.endswith(".json"):
            json_gen = JsonGenerator()
            json_gen.generate_file(
                output, timeline, drift_issues, risk_issues, tools, events, replay_plan
            )
            console.print(f"[green]✓[/green] JSON 报告已生成: {output}")


@main.command()
@click.option("--schema", "-s", required=True, help="工具 Schema 文件 (JSON/YAML)")
@click.option("--trace", "-t", required=True, help="调用轨迹文件 (JSONL)")
@click.option("--config", "-c", help="回放配置文件 (JSON)")
@click.option("--output", "-o", help="输出计划文件路径 (JSON)")
@click.option("--include-retries/--no-include-retries", default=True, help="是否包含重试")
@click.option("--respect-timing/--no-respect-timing", default=True, help="是否遵循原始时间")
def plan(
    schema: str, trace: str, config: Optional[str], output: Optional[str],
    include_retries: bool, respect_timing: bool
):
    """生成 dry-run 回放计划"""
    schema_parser = SchemaParser()
    trace_parser = TraceParser()
    timeline_rebuilder = TimelineRebuilder()

    try:
        tools = schema_parser.parse_file(schema)
        console.print(f"[green]✓[/green] 已加载 {len(tools)} 个工具定义")
    except Exception as e:
        console.print(f"[red]✗[/red] 解析 Schema 失败: {e}")
        sys.exit(1)

    try:
        events = trace_parser.parse_file(trace)
        console.print(f"[green]✓[/green] 已加载 {len(events)} 个事件")
    except Exception as e:
        console.print(f"[red]✗[/red] 解析轨迹失败: {e}")
        sys.exit(1)

    timeline = timeline_rebuilder.rebuild(events)
    console.print(f"[green]✓[/green] 时间线重建完成")

    replay_config = {
        "mode": "dry_run",
        "include_retries": include_retries,
        "respect_timing": respect_timing,
    }

    if config:
        try:
            with open(config, "r") as f:
                user_config = json.load(f)
                replay_config.update(user_config)
        except Exception as e:
            console.print(f"[yellow]⚠[/yellow] 读取配置失败: {e}")

    replay_plan = timeline_rebuilder.generate_replay_plan(timeline, replay_config)

    _print_plan_summary(replay_plan)

    if output:
        with open(output, "w") as f:
            json.dump(replay_plan, f, indent=2, ensure_ascii=False, default=str)
        console.print(f"[green]✓[/green] 计划已保存: {output}")


@main.command()
@click.option("--schema", "-s", required=True, help="工具 Schema 文件 (JSON/YAML)")
@click.option("--trace", "-t", required=True, help="调用轨迹文件 (JSONL)")
@click.option("--output", "-o", required=True, help="输出目录")
@click.option("--mode", "-m", default="minimal", type=click.Choice(["minimal", "full"]),
              help="复现包模式: minimal(最小) 或 full(完整)")
@click.option("--include-drift/--no-include-drift", default=True, help="包含 Schema 漂移事件")
@click.option("--include-risks/--no-include-risks", default=True, help="包含风险事件")
@click.option("--include-errors/--no-include-errors", default=True, help="包含错误事件")
@click.option("--include-retries/--no-include-retries", default=True, help="包含重试事件")
def repro(
    schema: str, trace: str, output: str, mode: str,
    include_drift: bool, include_risks: bool, include_errors: bool, include_retries: bool
):
    """生成最小复现包"""
    schema_parser = SchemaParser()
    trace_parser = TraceParser()
    timeline_rebuilder = TimelineRebuilder()
    drift_detector = SchemaDriftDetector()
    risk_analyzer = RiskAnalyzer()
    repro_gen = ReproGenerator()

    try:
        tools = schema_parser.parse_file(schema)
        console.print(f"[green]✓[/green] 已加载 {len(tools)} 个工具定义")
    except Exception as e:
        console.print(f"[red]✗[/red] 解析 Schema 失败: {e}")
        sys.exit(1)

    try:
        events = trace_parser.parse_file(trace)
        console.print(f"[green]✓[/green] 已加载 {len(events)} 个事件")
    except Exception as e:
        console.print(f"[red]✗[/red] 解析轨迹失败: {e}")
        sys.exit(1)

    timeline = timeline_rebuilder.rebuild(events)
    drift_issues = drift_detector.detect(tools, events)
    risk_issues = risk_analyzer.analyze(events, tools)

    filter_config = {
        "mode": mode,
        "include_drift": include_drift,
        "include_risks": include_risks,
        "include_errors": include_errors,
        "include_retries": include_retries,
    }

    output_path = repro_gen.generate_minimal_repro(
        output, tools, events, timeline, drift_issues, risk_issues, filter_config
    )

    console.print(f"[green]✓[/green] 复现包已生成: {output_path}")
    console.print(f"  - 模式: {mode}")
    console.print(f"  - 包含漂移: {include_drift}")
    console.print(f"  - 包含风险: {include_risks}")
    console.print(f"  - 包含错误: {include_errors}")
    console.print(f"  - 包含重试: {include_retries}")


def _print_console_summary(
    timeline, drift_issues, risk_issues, tools, events, replay_plan, verbose
):
    summary = timeline.get_summary()

    table = Table(title="分析总览")
    table.add_column("指标", style="cyan")
    table.add_column("数值", style="green")

    table.add_row("总事件数", str(summary["total_events"]))
    table.add_row("唯一工具调用", str(summary["unique_tool_calls"]))
    table.add_row("重试次数", str(summary["retry_count"]))
    table.add_row("错误次数", str(summary["error_count"]))
    table.add_row("总时长(ms)", f"{summary['total_duration_ms']:.2f}")
    table.add_row("并行批次", str(summary["parallel_batches"]))

    console.print(table)

    if drift_issues:
        drift_table = Table(title="Schema 漂移问题")
        drift_table.add_column("严重级别", style="red")
        drift_table.add_column("工具", style="cyan")
        drift_table.add_column("问题", style="yellow")

        for issue in drift_issues[:10]:
            severity_style = {
                "high": "bold red",
                "medium": "bold yellow",
                "low": "dim"
            }.get(issue.severity, "white")

            drift_table.add_row(
                Text(issue.severity, style=severity_style),
                issue.tool_name,
                issue.message[:60] + ("..." if len(issue.message) > 60 else ""),
            )

        console.print(drift_table)
        if len(drift_issues) > 10:
            console.print(f"... 还有 {len(drift_issues) - 10} 个问题")

    if risk_issues:
        risk_table = Table(title="风险分析")
        risk_table.add_column("严重级别", style="red")
        risk_table.add_column("工具", style="cyan")
        risk_table.add_column("风险类型", style="yellow")

        for risk in risk_issues[:10]:
            severity_style = {
                "high": "bold red",
                "medium": "bold yellow",
                "low": "dim"
            }.get(risk.severity, "white")

            risk_table.add_row(
                Text(risk.severity, style=severity_style),
                risk.tool_name,
                risk.risk_type,
            )

        console.print(risk_table)
        if len(risk_issues) > 10:
            console.print(f"... 还有 {len(risk_issues) - 10} 个风险")

    if verbose:
        _print_detailed_timeline(timeline)


def _print_detailed_timeline(timeline):
    console.print(Panel.fit("详细时间线", style="cyan"))

    for batch_idx, batch in enumerate(timeline.parallel_batches, 1):
        is_parallel = len(batch) > 1
        console.print(f"\n[bold]批次 {batch_idx}[/bold] {'[并行]' if is_parallel else ''}")

        for te in batch:
            event = te.event
            status = "✅" if event.event_type == "response" else ("❌" if event.error else "⏳")
            retry = f" [重试#{event.retry_count}]" if event.is_retry else ""

            console.print(
                f"  {status} {event.tool_name} `{event.id}`{retry}"
                f" @ {te.relative_time_ms:.2f}ms"
            )
            if event.error:
                console.print(f"       ❌ Error: {event.error}")


def _print_plan_summary(plan):
    summary = plan.get("summary", {})
    steps = plan.get("steps", [])

    table = Table(title="回放计划")
    table.add_column("配置", style="cyan")
    table.add_column("值", style="green")

    table.add_row("模式", plan.get("mode", "dry_run"))
    table.add_row("总步骤", str(plan.get("total_steps", 0)))
    table.add_row("总批次", str(plan.get("total_batches", 0)))
    table.add_row("遵循时间", "是" if plan.get("respect_timing") else "否")
    table.add_row("包含重试", "是" if plan.get("include_retries") else "否")

    console.print(table)

    if steps:
        console.print("\n[bold]执行计划[/bold]")
        for batch in steps[:5]:
            batch_num = batch.get("batch", 0)
            is_parallel = batch.get("is_parallel", False)
            events = batch.get("events", [])

            console.print(f"\n  批次 {batch_num} {'[并行]' if is_parallel else ''}:")
            for event in events:
                step = event.get("step", 0)
                tool = event.get("tool_name", "unknown")
                call_id = event.get("tool_call_id", "")
                retry = " [重试]" if event.get("is_retry") else ""

                console.print(f"    步骤 {step}: {tool} `{call_id}`{retry}")

        if len(steps) > 5:
            console.print(f"\n  ... 还有 {len(steps) - 5} 个批次")


if __name__ == "__main__":
    main()
