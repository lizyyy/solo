from __future__ import annotations

import json
import sys

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .models import ProcessingStatus
from .store import ResultStore
from .workflow import WorkflowEngine

console = Console()


def _amount_display(amount: int) -> str:
    return f"¥{amount / 100:.2f}"


def _status_style(status: ProcessingStatus) -> str:
    styles = {
        ProcessingStatus.IMPORTED: "dim",
        ProcessingStatus.SELF_CHECK_PASSED: "green",
        ProcessingStatus.PENDING_REVIEW: "bold red",
        ProcessingStatus.HOLIDAY_NOTED: "cyan",
        ProcessingStatus.SUMMARY_UPDATED: "blue",
        ProcessingStatus.CONFIRMED: "bold green",
        ProcessingStatus.REJECTED: "bold magenta",
    }
    return styles.get(status, "white")


@click.group()
def main() -> None:
    pass


@main.command(name="import")
@click.argument("file", type=click.Path(exists=True))
@click.option("--actor", default="system", help="操作人")
def import_cmd(file: str, actor: str) -> None:
    store = ResultStore.get_instance()
    engine = WorkflowEngine(store)

    with open(file, encoding="utf-8") as f:
        rows = json.load(f)

    records = engine.import_records(rows, actor=actor)
    console.print(f"[green]导入 {len(records)} 条记录[/green]")

    check_results = engine.run_self_check()
    failures = [r for r in check_results if not r.get("passed")]
    passes = [r for r in check_results if r.get("passed")]

    console.print(f"\n[bold]自检结果[/bold]: {len(passes)} 通过, {len(failures)} 异常")
    for f in failures:
        severity = f.get("severity", "warning")
        color = "red" if severity == "error" else "yellow"
        console.print(f"  [{color}]{f.get('rule')}[/{color}]: {f.get('message')}")

    _render_records_table(store)


@main.command()
@click.argument("clearing_batch_no")
@click.argument("note")
@click.option("--effective-date", default="", help="生效日期")
@click.option("--source", default="", help="信息来源")
@click.option("--actor", default="system", help="操作人")
def holiday(clearing_batch_no: str, note: str, effective_date: str, source: str, actor: str) -> None:
    store = ResultStore.get_instance()
    engine = WorkflowEngine(store)

    info = engine.apply_holiday_note(clearing_batch_no, note, effective_date, source, actor)
    if info is None:
        console.print(f"[red]未找到清算批次号 {clearing_batch_no}[/red]")
        sys.exit(1)

    console.print(Panel(
        f"[cyan]节假日顺延说明已应用[/cyan]\n"
        f"批次号: {info.clearing_batch_no}\n"
        f"说明: {info.note}\n"
        f"生效日期: {info.effective_date or '(未指定)'}\n"
        f"来源: {info.source or '(未指定)'}",
        title="节假日顺延",
    ))

    _render_records_table(store)


@main.command()
@click.argument("clearing_batch_no")
@click.option("--note", default="", help="摘要备注")
@click.option("--actor", default="system", help="操作人")
def summary(clearing_batch_no: str, note: str, actor: str) -> None:
    store = ResultStore.get_instance()
    engine = WorkflowEngine(store)

    update = engine.update_summary(clearing_batch_no, note, actor)
    if update is None:
        console.print(f"[red]未找到清算批次号 {clearing_batch_no}[/red]")
        sys.exit(1)

    console.print(Panel(
        f"[blue]摘要已更新[/blue]\n"
        f"批次号: {update.clearing_batch_no}\n"
        f"差异总额: {_amount_display(update.total_diff)}\n"
        f"冲正总额: {_amount_display(update.total_reversed)}\n"
        f"待复核条数: {update.pending_review_count}\n"
        f"备注: {update.note or '(无)'}",
        title="摘要更新",
    ))

    if update.pending_review_count > 0:
        console.print("[bold yellow]⚠ 金额为0且备注含'已冲正'的记录已留待风控复核，未自动归入正常[/bold yellow]")

    _render_records_table(store)


@main.command()
@click.argument("record_id")
@click.option("--actor", default="risk_control", help="操作人")
def confirm(record_id: str, actor: str) -> None:
    store = ResultStore.get_instance()
    engine = WorkflowEngine(store)
    record = engine.confirm_record(record_id, actor)
    if record is None:
        console.print(f"[red]未找到记录 {record_id}[/red]")
        sys.exit(1)
    console.print(f"[green]记录 {record_id} 已由 {actor} 确认[/green]")
    _render_evidence(store, record_id)


@main.command()
@click.argument("record_id")
@click.argument("reason")
@click.option("--actor", default="risk_control", help="操作人")
def reject(record_id: str, reason: str, actor: str) -> None:
    store = ResultStore.get_instance()
    engine = WorkflowEngine(store)
    record = engine.reject_record(record_id, reason, actor)
    if record is None:
        console.print(f"[red]未找到记录 {record_id}[/red]")
        sys.exit(1)
    console.print(f"[magenta]记录 {record_id} 已由 {actor} 驳回: {reason}[/magenta]")
    _render_evidence(store, record_id)


@main.command(name="evidence")
@click.argument("record_id")
def evidence_cmd(record_id: str) -> None:
    store = ResultStore.get_instance()
    _render_evidence(store, record_id)


@main.command()
@click.option("--output", "-o", default="", help="输出文件路径")
def export(output: str) -> None:
    store = ResultStore.get_instance()
    data = {
        "records": store.export_records(),
        "check_results": store.export_check_results(),
        "evidence_summaries": store.export_evidence_summaries(),
    }
    content = json.dumps(data, ensure_ascii=False, indent=2)
    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(content)
        console.print(f"[green]已导出到 {output}[/green]")
    else:
        console.print(content)


def _render_records_table(store: ResultStore) -> None:
    table = Table(title="网联通道清分差异记录")
    table.add_column("ID", style="dim")
    table.add_column("清算批次号")
    table.add_column("行号", justify="right")
    table.add_column("通道")
    table.add_column("金额", justify="right")
    table.add_column("备注")
    table.add_column("状态")
    table.add_column("0+已冲正")
    table.add_column("节假日顺延")

    for record in store.get_records():
        status_text = Text(record.status.value, style=_status_style(record.status))
        zero_rev = "[bold red]⚠ 是[/bold red]" if record.is_zero_reversed else "否"
        holiday = record.holiday_extension_note[:20] if record.holiday_extension_note else "-"
        table.add_row(
            record.id,
            record.clearing_batch_no,
            str(record.original_line_no),
            record.channel,
            _amount_display(record.amount),
            record.remark[:30],
            status_text,
            zero_rev,
            holiday,
        )

    console.print(table)


def _render_evidence(store: ResultStore, record_id: str) -> None:
    ev = store.build_evidence_summary(record_id)
    if ev is None:
        console.print(f"[red]未找到记录 {record_id}[/red]")
        return

    lines = [
        f"[bold]证据摘要[/bold]",
        f"清算批次号: {ev.clearing_batch_no}",
        f"原始行号: {ev.original_line_no}",
        f"金额: {_amount_display(ev.amount)}",
        f"备注: {ev.remark}",
        f"当前状态: {ev.status.value}",
        f"金额0+已冲正: {'是' if ev.is_zero_reversed else '否'}",
        f"节假日顺延: {ev.holiday_extension_note or '(无)'}",
        "",
        "[bold]审计轨迹[/bold]:",
    ]
    for entry in ev.audit_trail_summary:
        lines.append(f"  {entry}")

    console.print(Panel("\n".join(lines), title=f"记录 {record_id}"))
