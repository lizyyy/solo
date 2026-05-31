from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional, Set

import click
from rich.console import Console
from rich.table import Table

from .engine.differ import Differ
from .engine.importer import Importer
from .engine.tracer import Tracer
from .engine.verifier import Verifier
from .models import Experiment
from .report import Report
from .store import Store

console = Console()


def _get_store(db: str) -> Store:
    return Store(db)


@click.group()
@click.option("--db", default="eval_trace.db", help="SQLite 数据库路径")
@click.pass_context
def cli(ctx: click.Context, db: str) -> None:
    """离线评估追溯 — 串起数据集版本、指标脚本、阈值配置与人工排除样本"""
    ctx.ensure_object(dict)
    ctx.obj["db"] = db


@cli.command("import")
@click.option("--name", required=True, help="实验名称（唯一标识）")
@click.option("--round-tag", default="", help="轮次标签，如 2024-W23")
@click.option("--note", default="", help="备注")
@click.option("--dataset", "dataset_path", default=None, help="数据集版本文件路径")
@click.option("--dataset-name", default=None, help="数据集名称（默认取文件名）")
@click.option("--script", "script_path", default=None, help="指标脚本路径")
@click.option("--script-tag", default="", help="脚本版本标签")
@click.option("--config", "config_path", default=None, help="阈值配置文件路径")
@click.option("--results", "results_path", default=None, help="评估结果文件路径")
@click.option("--excluded", "excluded_path", default=None, help="人工排除样本文件路径")
@click.pass_context
def import_cmd(
    ctx: click.Context,
    name: str,
    round_tag: str,
    note: str,
    dataset_path: Optional[str],
    dataset_name: Optional[str],
    script_path: Optional[str],
    script_tag: str,
    config_path: Optional[str],
    results_path: Optional[str],
    excluded_path: Optional[str],
) -> None:
    """导入一次实验，自动检测重复并识别变更类型"""
    store = _get_store(ctx.obj["db"])
    try:
        importer = Importer(store)
        result = importer.import_from_files(
            name=name,
            round_tag=round_tag,
            note=note,
            dataset_path=dataset_path,
            dataset_name=dataset_name,
            script_path=script_path,
            script_version_tag=script_tag,
            config_path=config_path,
            results_path=results_path,
            excluded_path=excluded_path,
        )
        console.print(f"[bold green]✓[/bold green] {result.summary()}")
        if result.changes:
            for c in result.changes:
                console.print(f"  [yellow]变更[/yellow] {c.field}: {c.old_value!r} → {c.new_value!r}")
    finally:
        store.close()


@cli.command("verify")
@click.option("--name", required=True, help="实验名称")
@click.option("--train-ids", default=None, help="训练集样本ID文件（每行一个ID）")
@click.option("--expected-labels", default=None, help="预期标签列表文件（每行一个标签）")
@click.option("--strict/--no-strict", default=True, help="严格阈值检查模式")
@click.pass_context
def verify_cmd(
    ctx: click.Context,
    name: str,
    train_ids: Optional[str],
    expected_labels: Optional[str],
    strict: bool,
) -> None:
    """校验实验：检测标签漏映射、训练集泄漏等问题，给出诊断建议"""
    store = _get_store(ctx.obj["db"])
    try:
        exp = store.load_experiment(name)
        if exp is None:
            console.print(f"[red]✗[/red] 未找到实验: {name}")
            return

        train_sample_ids: Set[str] = set()
        if train_ids:
            train_sample_ids = set(Path(train_ids).read_text().strip().splitlines())

        expected_labels_set: Set[str] = set()
        if expected_labels:
            expected_labels_set = set(Path(expected_labels).read_text().strip().splitlines())

        verifier = Verifier(
            train_sample_ids=train_sample_ids,
            expected_labels=expected_labels_set,
            strict_threshold_check=strict,
        )
        result = verifier.verify(exp)
        exp.issues = result.issues
        store.save_experiment(exp)

        console.print(result.summary())
        if result.has_critical:
            console.print("[bold red]校验未通过：存在严重问题[/bold red]")
        elif result.has_warning:
            console.print("[bold yellow]校验通过（有警告）[/bold yellow]")
        else:
            console.print("[bold green]校验通过[/bold green]")
    finally:
        store.close()


@cli.command("trace")
@click.option("--name", required=True, help="实验名称")
@click.option("--metric", default=None, help="追溯指定指标的分数链路")
@click.option("--sample-range", is_flag=True, help="追溯样本范围")
@click.pass_context
def trace_cmd(ctx: click.Context, name: str, metric: Optional[str], sample_range: bool) -> None:
    """从分数追溯到样本范围和配置差异"""
    store = _get_store(ctx.obj["db"])
    try:
        exp = store.load_experiment(name)
        if exp is None:
            console.print(f"[red]✗[/red] 未找到实验: {name}")
            return

        tracer = Tracer()

        if metric:
            chain = tracer.trace_score(exp, metric)
            if chain is None:
                console.print(f"[yellow]未找到指标: {metric}[/yellow]")
                return
            console.print(f"[bold]指标 {metric} 追溯链:[/bold]")
            console.print(chain.render())
        elif sample_range:
            chain = tracer.trace_sample_range(exp)
            console.print("[bold]样本范围追溯:[/bold]")
            console.print(chain.render())
        else:
            console.print("[bold]全部指标追溯:[/bold]")
            for r in exp.results:
                chain = tracer.trace_score(exp, r.metric_name)
                if chain:
                    console.print(chain.render())
                    console.print()
    finally:
        store.close()


@cli.command("report")
@click.option("--name", required=True, help="实验名称")
@click.pass_context
def report_cmd(ctx: click.Context, name: str) -> None:
    """生成评估说明：从分数追溯到样本范围和配置差异"""
    store = _get_store(ctx.obj["db"])
    try:
        exp = store.load_experiment(name)
        if exp is None:
            console.print(f"[red]✗[/red] 未找到实验: {name}")
            return

        report = Report(exp, store)
        console.print(report.generate())
    finally:
        store.close()


@cli.command("diff")
@click.option("--name-a", required=True, help="实验A名称")
@click.option("--name-b", required=True, help="实验B名称")
@click.option("--metric", default=None, help="定位指定指标的差异原因")
@click.pass_context
def diff_cmd(ctx: click.Context, name_a: str, name_b: str, metric: Optional[str]) -> None:
    """对比两次实验配置差异，或定位指标差异的原因"""
    store = _get_store(ctx.obj["db"])
    try:
        exp_a = store.load_experiment(name_a)
        exp_b = store.load_experiment(name_b)
        if exp_a is None:
            console.print(f"[red]✗[/red] 未找到实验: {name_a}")
            return
        if exp_b is None:
            console.print(f"[red]✗[/red] 未找到实验: {name_b}")
            return

        differ = Differ()

        if metric:
            result = differ.pinpoint_cause(metric, exp_a, exp_b)
            console.print(result)
        else:
            result = differ.diff(exp_a, exp_b)
            console.print(f"[bold]对比: {name_a} vs {name_b}[/bold]")
            console.print(result.render())
    finally:
        store.close()


@cli.command("list")
@click.option("--round-tag", default=None, help="按轮次标签筛选")
@click.pass_context
def list_cmd(ctx: click.Context, round_tag: Optional[str]) -> None:
    """列出已导入的实验"""
    store = _get_store(ctx.obj["db"])
    try:
        experiments = store.list_experiments(round_tag=round_tag)
        if not experiments:
            console.print("[yellow]暂无实验记录[/yellow]")
            return

        table = Table(title="实验列表")
        table.add_column("名称", style="cyan")
        table.add_column("轮次", style="magenta")
        table.add_column("状态", style="green")
        table.add_column("配置指纹", style="dim")
        table.add_column("更新时间", style="dim")
        table.add_column("指标数", justify="right")

        for exp in experiments:
            metric_count = len(exp.results)
            status_style = {"draft": "yellow", "verified": "green", "approved": "bold green"}.get(exp.status.value, "")
            table.add_row(
                exp.name,
                exp.round_tag or "-",
                f"[{status_style}]{exp.status.value}[/{status_style}]",
                exp.config_fingerprint(),
                str(exp.updated_at)[:19],
                str(metric_count),
            )

        console.print(table)
    finally:
        store.close()


@cli.command("history")
@click.option("--name", required=True, help="实验名称")
@click.pass_context
def history_cmd(ctx: click.Context, name: str) -> None:
    """查看实验导入历史"""
    store = _get_store(ctx.obj["db"])
    try:
        history = store.get_import_history(name)
        if not history:
            console.print(f"[yellow]实验 {name} 无导入历史[/yellow]")
            return

        console.print(f"[bold]实验 {name} 导入历史:[/bold]")
        for h in history:
            icon = {"new": "🆕", "re_import_note": "📝", "re_import_config": "⚙️"}.get(h["import_type"], "❓")
            console.print(f"  {icon} {h['import_time']} — {h['import_type']}")
            for c in h.get("changes", []):
                console.print(f"      {c['field']}: {c.get('old_value', 'N/A')} → {c.get('new_value', 'N/A')}")
    finally:
        store.close()


if __name__ == "__main__":
    cli()
