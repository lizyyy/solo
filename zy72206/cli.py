#!/usr/bin/env python3
import click
import json
from forex_settlement import (
    SettlementRepository,
    ProcessingStep,
)


@click.group()
@click.option("--data-dir", default="./data", help="数据目录路径")
@click.pass_context
def cli(ctx, data_dir):
    ctx.ensure_object(dict)
    ctx.obj["repo"] = SettlementRepository(data_dir=data_dir)


@cli.command()
@click.argument("file_path")
@click.option("--operator", default="system", help="操作人")
@click.pass_context
def import_excel(ctx, file_path, operator):
    repo = ctx.obj["repo"]
    records = repo.import_from_excel(file_path, operator)
    click.echo(f"成功导入 {len(records)} 条记录")
    for r in records:
        click.echo(f"  - 记录ID: {r.id}, 原始行号: {r.original_row_number}, 状态: {r.status}")


@cli.command("list")
@click.option("--step", type=click.Choice([s.value for s in ProcessingStep]), help="按步骤筛选")
@click.pass_context
def list_records(ctx, step):
    repo = ctx.obj["repo"]
    if step:
        records = repo.get_records_by_step(ProcessingStep(step))
    else:
        records = repo.get_all_records()
    click.echo(f"共 {len(records)} 条记录:")
    for r in records:
        blocking = repo.get_blocking_info(r.id)
        status_str = f"{r.status} ({r.current_step})"
        if blocking and blocking["is_blocked"]:
            status_str += f" [阻塞: {blocking['block_reason']}]"
        click.echo(f"  {r.id[:8]}... | 行号: {r.original_row_number:3d} | 金额: {r.amount:12.2f} | {status_str}")


@cli.command()
@click.argument("record_id")
@click.pass_context
def show(ctx, record_id):
    repo = ctx.obj["repo"]
    record = repo.get_record(record_id)
    if not record:
        click.echo(f"记录不存在: {record_id}")
        return
    data = repo.get_record_for_api(record_id)
    click.echo(json.dumps(data, ensure_ascii=False, indent=2))
    blocking = repo.get_blocking_info(record_id)
    if blocking and blocking["is_blocked"]:
        click.echo("\n⚠️  阻塞信息:")
        click.echo(f"   原因: {blocking['block_reason']}")
        click.echo(f"   下一步: {blocking['next_action']}")


@cli.command()
@click.argument("record_id")
@click.option("--operator", default="operator", help="操作人")
@click.pass_context
def advance(ctx, record_id, operator):
    repo = ctx.obj["repo"]
    record = repo.advance_record_step(record_id, operator)
    if record:
        click.echo(f"记录 {record_id[:8]}... 已推进至: {record.current_step}")
    else:
        click.echo("推进失败")


@cli.command("update-tax")
@click.argument("record_id")
@click.argument("tax_rate", type=float)
@click.argument("tax_remark")
@click.option("--operator", default="afen", help="操作人")
@click.pass_context
def update_tax(ctx, record_id, tax_rate, tax_remark, operator):
    repo = ctx.obj["repo"]
    record = repo.update_record_tax_rate(record_id, tax_rate, tax_remark, operator)
    if record:
        click.echo(f"记录 {record_id[:8]}... 税率已更新")
    else:
        click.echo("更新失败")


@cli.command("risk-review")
@click.argument("record_id")
@click.option("--approve/--reject", default=True, help="通过或驳回")
@click.option("--note", required=True, help="复核备注")
@click.option("--operator", default="risk", help="操作人")
@click.pass_context
def risk_review(ctx, record_id, approve, note, operator):
    repo = ctx.obj["repo"]
    record = repo.risk_review_record(record_id, approve, note, operator)
    if record:
        click.echo(f"记录 {record_id[:8]}... 风控复核{'通过' if approve else '驳回'}")
    else:
        click.echo("复核失败")


@cli.command("update-summary")
@click.argument("record_id")
@click.argument("summary")
@click.option("--operator", default="manager", help="操作人")
@click.pass_context
def update_summary(ctx, record_id, summary, operator):
    repo = ctx.obj["repo"]
    record = repo.update_record_summary(record_id, summary, operator)
    if record:
        click.echo(f"记录 {record_id[:8]}... 摘要已更新")
    else:
        click.echo("更新失败")


@cli.command()
@click.argument("record_id")
@click.option("--reason", required=True, help="冲正原因")
@click.option("--operator", default="operator", help="操作人")
@click.pass_context
def reverse(ctx, record_id, reason, operator):
    repo = ctx.obj["repo"]
    record = repo.reverse_record(record_id, reason, operator)
    if record:
        click.echo(f"记录 {record_id[:8]}... 已冲正")
    else:
        click.echo("冲正失败")


@cli.command()
@click.argument("record_id")
@click.argument("to_step", type=click.Choice([s.value for s in ProcessingStep]))
@click.option("--reason", required=True, help="回滚原因")
@click.option("--operator", default="operator", help="操作人")
@click.pass_context
def rollback(ctx, record_id, to_step, reason, operator):
    repo = ctx.obj["repo"]
    record = repo.rollback_record(record_id, ProcessingStep(to_step), operator, reason)
    if record:
        click.echo(f"记录 {record_id[:8]}... 已回滚至: {to_step}")
    else:
        click.echo("回滚失败")


@cli.command()
@click.argument("output_path")
@click.pass_context
def export(ctx, output_path):
    repo = ctx.obj["repo"]
    repo.export_to_excel(output_path)
    click.echo(f"已导出至: {output_path}")


@cli.command("audit")
@click.argument("record_id", required=False)
@click.pass_context
def audit_logs(ctx, record_id):
    repo = ctx.obj["repo"]
    logs = repo.get_audit_logs(record_id)
    click.echo(f"共 {len(logs)} 条审计日志:")
    for log in logs:
        click.echo(
            f"  {log.timestamp.strftime('%Y-%m-%d %H:%M:%S')} | "
            f"{log.action:15s} | {log.operator:10s} | {log.note or ''}"
        )


@cli.command("blocking")
@click.pass_context
def list_blocking(ctx):
    repo = ctx.obj["repo"]
    records = repo.get_all_records()
    blocking_records = []
    for r in records:
        info = repo.get_blocking_info(r.id)
        if info and info["is_blocked"]:
            blocking_records.append(info)
    if blocking_records:
        click.echo(f"共 {len(blocking_records)} 条阻塞记录:")
        for info in blocking_records:
            click.echo(f"  记录: {info['record_id'][:8]}...")
            click.echo(f"    步骤: {info['current_step']}")
            click.echo(f"    原因: {info['block_reason']}")
            click.echo(f"    下一步: {info['next_action']}")
    else:
        click.echo("没有阻塞记录")


if __name__ == "__main__":
    cli()
