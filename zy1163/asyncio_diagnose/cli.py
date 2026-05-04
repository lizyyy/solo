import json
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table

from . import __version__
from .analyzer import AsyncioAnalyzer
from .importer import DataImporter
from .reporter import ReportGenerator
from .simulator import Simulator

console = Console()


@click.group()
@click.version_option(__version__)
@click.option("--task-dump", type=click.Path(exists=True, path_type=Path), help="Path to task_dump.json")
@click.option("--event-trace", type=click.Path(exists=True, path_type=Path), help="Path to event_loop_trace.jsonl")
@click.option("--await-graph", type=click.Path(exists=True, path_type=Path), help="Path to await_graph.yaml")
@click.option("--timeout-rules", type=click.Path(exists=True, path_type=Path), help="Path to timeout_rules.yaml")
@click.pass_context
def main(ctx, task_dump, event_trace, await_graph, timeout_rules):
    """Asyncio 诊断工具 - 排查协程卡住、任务泄漏和取消未生效问题"""
    importer = DataImporter()
    importer.import_all(
        task_dump=task_dump,
        event_loop_trace=event_trace,
        await_graph=await_graph,
        timeout_rules=timeout_rules,
    )
    ctx.obj = {"importer": importer}


@main.command()
@click.option("--pending-threshold", type=float, default=60.0, help="长期 pending 的阈值（秒），默认 60 秒")
@click.option("--cancel-grace", type=float, default=5.0, help="取消请求后的宽限期（秒），默认 5 秒")
@click.option("--format", type=click.Choice(["table", "json", "markdown"]), default="table", help="输出格式")
@click.option("--output", "-o", type=click.Path(path_type=Path), help="输出文件路径")
@click.pass_context
def analyze(ctx, pending_threshold, cancel_grace, format, output):
    """运行完整的 asyncio 问题分析"""
    importer = ctx.obj["importer"]
    analyzer = AsyncioAnalyzer(importer)
    result = analyzer.run_full_analysis(
        pending_threshold_seconds=pending_threshold,
        cancel_grace_seconds=cancel_grace,
    )

    if format == "table":
        _display_table(result, importer)
    elif format == "json":
        json_output = ReportGenerator.generate_json(result, importer)
        if output:
            output.write_text(json_output)
            console.print(f"[green]JSON 报告已写入: {output}[/green]")
        else:
            console.print(json_output)
    elif format == "markdown":
        md_output = ReportGenerator.generate_markdown(result, importer)
        if output:
            output.write_text(md_output)
            console.print(f"[green]Markdown 报告已写入: {output}[/green]")
        else:
            console.print(md_output)


def _display_table(result, importer):
    summary = result.summary

    console.print("\n[bold cyan]=== Asyncio 诊断摘要 ===[/bold cyan]\n")

    summary_table = Table(title="任务统计")
    summary_table.add_column("指标", style="cyan")
    summary_table.add_column("值", style="green")
    summary_table.add_row("总任务数", str(summary.get("total_tasks", 0)))
    summary_table.add_row("发现问题数", str(summary.get("issues_found", 0)))
    console.print(summary_table)

    if result.long_pending_tasks:
        console.print(f"\n[bold red]⚠️  长期 Pending 的任务 ({len(result.long_pending_tasks)} 个)[/bold red]")
        table = Table(title="长期 Pending 任务")
        table.add_column("Task ID", style="cyan")
        table.add_column("协程", style="green")
        table.add_column("状态", style="yellow")
        table.add_column("等待", style="magenta")
        for task in result.long_pending_tasks:
            table.add_row(
                task.task_id,
                task.coro_name,
                task.state.value,
                task.waiting_on or "N/A",
            )
        console.print(table)

    if result.task_leaks:
        console.print(f"\n[bold red]⚠️  任务泄漏 ({len(result.task_leaks)} 个)[/bold red]")
        table = Table(title="可能泄漏的任务")
        table.add_column("Task ID", style="cyan")
        table.add_column("协程", style="green")
        table.add_column("状态", style="yellow")
        for task in result.task_leaks:
            table.add_row(
                task.task_id,
                task.coro_name,
                task.state.value,
            )
        console.print(table)

    if result.ineffective_cancellations:
        console.print(f"\n[bold red]⚠️  取消未生效 ({len(result.ineffective_cancellations)} 个)[/bold red]")
        table = Table(title="取消未生效的任务")
        table.add_column("Task ID", style="cyan")
        table.add_column("协程", style="green")
        table.add_column("当前状态", style="yellow")
        table.add_column("取消时间", style="magenta")
        for task in result.ineffective_cancellations:
            table.add_row(
                task.task_id,
                task.coro_name,
                task.state.value,
                str(task.cancel_time) if task.cancel_time else "N/A",
            )
        console.print(table)

    if result.wait_chains:
        console.print(f"\n[bold yellow]📊 等待链 ({len(result.wait_chains)} 个)[/bold yellow]")
        for i, chain in enumerate(result.wait_chains, 1):
            console.print(f"  链 #{i}: {' → '.join(chain)}")

    if result.queue_congestion:
        console.print(f"\n[bold yellow]📊 队列堆积 ({len(result.queue_congestion)} 个)[/bold yellow]")
        table = Table(title="队列堆积")
        table.add_column("队列名", style="cyan")
        table.add_column("队列大小", style="green")
        table.add_column("等待任务数", style="yellow")
        for queue in result.queue_congestion:
            table.add_row(
                queue["queue_name"],
                str(queue["queue_size"]),
                str(queue["pending_count"]),
            )
        console.print(table)

    issues = summary.get("issues_found", 0)
    if issues > 0:
        console.print(f"\n[bold red]⚠️  共发现 {issues} 个问题需要关注[/bold red]")
    else:
        console.print(f"\n[bold green]✅ 未发现严重问题[/bold green]")


@main.command()
@click.option("--steps", type=int, help="重放的步数，默认重放所有")
@click.option("--format", type=click.Choice(["table", "json"]), default="table", help="输出格式")
@click.pass_context
def replay(ctx, steps, format):
    """重放事件循环跟踪日志"""
    importer = ctx.obj["importer"]
    simulator = Simulator(importer)

    console.print(f"[cyan]开始重放事件...[/cyan]")
    events = simulator.replay(steps=steps)

    if format == "json":
        console.print(json.dumps(events, indent=2, default=str))
    else:
        console.print(f"[green]共重放 {len(events)} 个事件[/green]")

        table = Table(title="重放事件")
        table.add_column("#", style="cyan")
        table.add_column("时间", style="green")
        table.add_column("Task ID", style="yellow")
        table.add_column("事件类型", style="magenta")
        table.add_column("状态变化", style="cyan")

        for i, event in enumerate(events[:20], 1):
            old = event["old_state"] or "-"
            new = event["new_state"] or "-"
            state_change = f"{old} → {new}" if old != new else old
            table.add_row(
                str(i),
                event["timestamp"][:19],
                event["task_id"],
                event["event_type"],
                state_change,
            )

        console.print(table)
        if len(events) > 20:
            console.print(f"... 还有 {len(events) - 20} 个事件")

        state = simulator.get_simulated_state()
        console.print(f"\n[cyan]重放后状态:[/cyan]")
        console.print(f"  任务数: {len(state['tasks'])}")
        console.print(f"  事件数: {state['trace_count']}")


@main.command()
@click.argument("action", type=click.Choice(["cancel", "timeout", "predict"]))
@click.option("--task-id", help="目标任务 ID（用于 cancel 和 timeout 操作）")
@click.option("--timeout-seconds", type=float, default=30.0, help="超时时间（秒），默认 30 秒")
@click.option("--format", type=click.Choice(["table", "json"]), default="table", help="输出格式")
@click.pass_context
def simulate(ctx, action, task_id, timeout_seconds, format):
    """模拟取消或超时操作，预测影响"""
    importer = ctx.obj["importer"]
    simulator = Simulator(importer)
    simulator.reset()

    if action == "cancel":
        if not task_id:
            console.print("[bold red]错误: 需要指定 --task-id[/bold red]")
            return
        result = simulator.simulate_cancel(task_id)
    elif action == "timeout":
        if not task_id:
            console.print("[bold red]错误: 需要指定 --task-id[/bold red]")
            return
        result = simulator.simulate_timeout(task_id, timeout_seconds)
    elif action == "predict":
        result = simulator.predict_issues()
    else:
        result = {}

    if format == "json":
        console.print(json.dumps(result, indent=2, default=str))
    else:
        if action == "cancel":
            if "error" in result:
                console.print(f"[bold red]{result['error']}[/bold red]")
            else:
                console.print(f"[green]模拟取消成功[/green]")
                console.print(f"  任务: {result['task_id']}")
                console.print(f"  状态变化: {result['old_state']} → {result['new_state']}")

        elif action == "timeout":
            if "error" in result:
                console.print(f"[bold red]{result['error']}[/bold red]")
            else:
                console.print(f"[green]模拟超时分析[/green]")
                console.print(f"  任务: {result['task_id']}")
                console.print(f"  超时时间: {result['timeout_seconds']} 秒")
                console.print(f"  当前状态: {result['current_state']}")
                console.print(f"\n  等待链: {' → '.join(result['wait_chain'])}")
                console.print(f"\n  受影响的任务 ({len(result['affected_tasks'])} 个):")
                for t in result["affected_tasks"]:
                    console.print(f"    - {t['task_id']} ({t['coro_name']}) - {t['state']}")
                console.print(f"\n  [yellow]{result['predicted_result']}[/yellow]")

        elif action == "predict":
            console.print(f"[cyan]问题预测[/cyan]")
            console.print(f"  预测问题数: {result['predicted_issues']}")
            console.print(f"  长期 pending: {result['long_pending_count']}")
            console.print(f"  任务泄漏: {result['task_leak_count']}")
            console.print(f"  取消未生效: {result['ineffective_cancel_count']}")

            details = result.get("details", {})
            if details.get("long_pending_tasks"):
                console.print(f"\n  [yellow]长期 pending 任务:[/yellow]")
                for t_id in details["long_pending_tasks"]:
                    console.print(f"    - {t_id}")
            if details.get("task_leaks"):
                console.print(f"\n  [yellow]任务泄漏:[/yellow]")
                for t_id in details["task_leaks"]:
                    console.print(f"    - {t_id}")
            if details.get("ineffective_cancellations"):
                console.print(f"\n  [yellow]取消未生效:[/yellow]")
                for t_id in details["ineffective_cancellations"]:
                    console.print(f"    - {t_id}")


@main.command()
@click.option("--format", type=click.Choice(["markdown", "json"]), default="markdown", help="导出格式")
@click.option("--output", "-o", type=click.Path(path_type=Path), required=True, help="输出文件路径")
@click.option("--pending-threshold", type=float, default=60.0, help="长期 pending 的阈值（秒）")
@click.option("--cancel-grace", type=float, default=5.0, help="取消请求后的宽限期（秒）")
@click.pass_context
def export(ctx, format, output, pending_threshold, cancel_grace):
    """导出分析报告为 Markdown 或 JSON 格式"""
    importer = ctx.obj["importer"]
    analyzer = AsyncioAnalyzer(importer)
    result = analyzer.run_full_analysis(
        pending_threshold_seconds=pending_threshold,
        cancel_grace_seconds=cancel_grace,
    )

    output_path = Path(output)
    if format == "markdown":
        ReportGenerator.export_markdown(result, importer, output_path)
    else:
        ReportGenerator.export_json(result, importer, output_path)

    console.print(f"[green]报告已导出到: {output_path}[/green]")


@main.command("list")
@click.option("--state", type=click.Choice(["all", "pending", "running", "done", "cancelled"]), default="all", help="按状态筛选")
@click.option("--format", type=click.Choice(["table", "json"]), default="table", help="输出格式")
@click.pass_context
def list_tasks(ctx, state, format):
    """列出所有任务"""
    importer = ctx.obj["importer"]
    tasks = importer.get_all_tasks()

    if state != "all":
        from .models import TaskState
        state_map = {
            "pending": TaskState.PENDING,
            "running": TaskState.RUNNING,
            "done": TaskState.DONE,
            "cancelled": TaskState.CANCELLED,
        }
        target_state = state_map[state]
        tasks = [t for t in tasks if t.state == target_state]

    if format == "json":
        output = [
            {
                "task_id": t.task_id,
                "name": t.name,
                "state": t.state.value,
                "coro_name": t.coro_name,
                "waiting_on": t.waiting_on,
                "awaited_by": t.awaited_by,
            }
            for t in tasks
        ]
        console.print(json.dumps(output, indent=2))
    else:
        console.print(f"[cyan]共 {len(tasks)} 个任务[/cyan]")
        table = Table(title="任务列表")
        table.add_column("Task ID", style="cyan")
        table.add_column("名称", style="green")
        table.add_column("协程", style="yellow")
        table.add_column("状态", style="magenta")
        table.add_column("等待", style="cyan")

        for task in tasks:
            table.add_row(
                task.task_id,
                task.name or "-",
                task.coro_name,
                task.state.value,
                task.waiting_on or "-",
            )

        console.print(table)


if __name__ == "__main__":
    main()
