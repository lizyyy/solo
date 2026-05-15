import json
import os
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from slice_validator.core.validator import SliceValidator
from slice_validator.core.candidate_manager import CandidateManager
from slice_validator.core.output_formatter import OutputFormatter
from slice_validator.models.schemas import BatchSubmission, FailureType

console = Console()


@click.group()
def cli():
    """大文件切片校验工具 - 灰度物流拦截数据校验"""
    pass


@cli.command()
@click.argument("batch_file", type=click.Path(exists=True))
@click.option("--base-dir", "-d", default="", help="文件基础目录")
@click.option("--format", "-f", type=click.Choice(["json", "markdown", "console"]), default="console")
@click.option("--force", "-F", is_flag=True, help="强制重新校验，忽略历史结果")
@click.option("--output", "-o", help="输出文件路径")
def validate(batch_file, base_dir, format, force, output):
    """校验批次切片文件"""
    with open(batch_file, "r", encoding="utf-8") as f:
        batch_data = json.load(f)

    batch = BatchSubmission(**batch_data)

    console.print(f"[blue]开始校验批次: {batch.batch_id}[/blue]")

    validator = SliceValidator()
    result = validator.validate_batch(batch, base_dir=base_dir, force_revalidate=force)

    if result.overall_status.value == "success":
        console.print("[green]✓ 批次校验全部通过[/green]")
    else:
        console.print(f"[red]✗ 批次校验存在问题: {result.overall_status.value}[/red]")

    if format == "console":
        _print_console_result(result)
    elif format == "json":
        json_output = OutputFormatter.to_json(result)
        if output:
            with open(output, "w", encoding="utf-8") as f:
                f.write(json_output)
            console.print(f"[green]结果已保存到: {output}[/green]")
        else:
            click.echo(json_output)
    elif format == "markdown":
        md_output = OutputFormatter.validation_to_markdown(result)
        if output:
            with open(output, "w", encoding="utf-8") as f:
                f.write(md_output)
            console.print(f"[green]结果已保存到: {output}[/green]")
        else:
            click.echo(md_output)


@cli.command()
@click.argument("batch_id")
@click.argument("failure_type")
def filter(batch_id, failure_type):
    """按失败类型过滤查询"""
    try:
        failure_enum = FailureType(failure_type)
    except ValueError:
        console.print(f"[red]无效的失败类型: {failure_type}[/red]")
        console.print(f"[yellow]可用类型: {[ft.value for ft in FailureType]}[/yellow]")
        return

    validator = SliceValidator()
    results = validator.filter_by_failure_type(batch_id, failure_enum)

    if not results:
        console.print(f"[yellow]未找到批次 {batch_id} 中类型为 {failure_type} 的失败记录[/yellow]")
        return

    table = Table(title=f"失败记录 - {failure_type}")
    table.add_column("文件名", style="cyan")
    table.add_column("切片索引", style="magenta")
    table.add_column("状态", style="red")

    for r in results:
        table.add_row(r["file_name"], str(r["slice_index"]), r["status"])

    console.print(table)


@cli.command()
@click.argument("batch_id")
@click.option("--output", "-o", help="回滚计划输出文件")
def plan_rollback(batch_id, output):
    """生成回滚候选清单"""
    validator = SliceValidator()
    result_data = validator.check_previous_result(batch_id)

    if not result_data:
        console.print(f"[red]未找到批次 {batch_id} 的校验结果[/red]")
        return

    from slice_validator.models.schemas import ValidationResult
    result = ValidationResult(**result_data)

    candidate_manager = CandidateManager()
    rollback_plan = candidate_manager.generate_rollback_candidates(result)

    console.print(f"[blue]回滚计划已生成: {rollback_plan.plan_id}[/blue]")
    console.print(f"[yellow]候选操作数: {len(rollback_plan.candidates)}[/yellow]")

    if output:
        md_output = OutputFormatter.rollback_to_markdown(rollback_plan)
        with open(output, "w", encoding="utf-8") as f:
            f.write(md_output)
        console.print(f"[green]回滚计划已保存到: {output}[/green]")


@cli.command()
def list_plans():
    """列出待确认的回滚计划"""
    candidate_manager = CandidateManager()
    plans = candidate_manager.list_pending_plans()

    if not plans:
        console.print("[yellow]没有待确认的回滚计划[/yellow]")
        return

    table = Table(title="待确认回滚计划")
    table.add_column("计划ID", style="cyan")
    table.add_column("批次ID", style="magenta")
    table.add_column("创建时间", style="green")
    table.add_column("候选操作数", style="yellow")

    for plan in plans:
        table.add_row(
            plan["plan_id"],
            plan["batch_id"],
            plan["created_at"],
            str(len(plan["candidates"])),
        )

    console.print(table)


@cli.command()
@click.argument("plan_id")
@click.option("--yes", "-y", is_flag=True, help="确认执行")
@click.option("--dry-run", "-n", is_flag=True, help="试运行，不实际删除文件")
def confirm(plan_id, yes, dry_run):
    """确认并执行回滚计划"""
    candidate_manager = CandidateManager()

    if not yes:
        click.confirm(f"确认要执行回滚计划 {plan_id} 吗？", abort=True)

    candidate_manager.confirm_plan(plan_id, confirmed=True)
    console.print(f"[green]计划 {plan_id} 已确认[/green]")

    result = candidate_manager.execute_rollback(plan_id, dry_run=dry_run)

    if result.get("dry_run"):
        console.print(f"[blue]试运行模式: {result['message']}[/blue]")
        console.print(f"[yellow]待删除文件数: {len(result['files_to_delete'])}[/yellow]")
    elif result["success"]:
        console.print(f"[green]✓ 回滚执行成功，删除 {result['deleted_count']} 个文件[/green]")
    else:
        console.print(f"[red]✗ 回滚执行失败[/red]")
        if "failed_deletions" in result:
            for fail in result["failed_deletions"]:
                console.print(f"  - {fail['file']}: {fail['error']}")


@cli.command()
@click.argument("batch_id")
@click.argument("partition_file", type=click.Path(exists=True))
@click.option("--approve/--reject", default=True, help="批准或拒绝")
def confirm_partition(batch_id, partition_file, approve):
    """人工确认湖仓分区清单"""
    with open(partition_file, "r", encoding="utf-8") as f:
        partitions = json.load(f)

    candidate_manager = CandidateManager()
    result = candidate_manager.manual_partition_confirmation(
        batch_id, partitions, approved=approve
    )

    status = "[green]已批准[/green]" if approve else "[red]已拒绝[/red]"
    console.print(f"分区确认完成: {status}")
    console.print(f"涉及分区数: {len(partitions)}")


def _print_console_result(result):
    table = Table(title="校验结果概览")
    table.add_column("指标", style="cyan")
    table.add_column("数值", style="magenta")

    table.add_row("批次ID", result.batch_id)
    table.add_row("整体状态", f"[green]{result.overall_status.value}[/green]" if result.overall_status.value == "success" else f"[red]{result.overall_status.value}[/red]")
    table.add_row("总切片数", str(result.total_slices))
    table.add_row("成功", f"[green]{result.success_count}[/green]")
    table.add_row("失败", f"[red]{result.failed_count}[/red]")
    table.add_row("部分", str(result.partial_count))

    console.print(table)

    if result.failure_groups:
        console.print("\n[red]失败分组:[/red]")
        for failure_type, items in result.failure_groups.items():
            console.print(f"  [yellow]{failure_type.value}:[/yellow]")
            for item in items[:3]:
                console.print(f"    - {item}")
            if len(items) > 3:
                console.print(f"    ... 还有 {len(items) - 3} 项")


if __name__ == "__main__":
    cli()
