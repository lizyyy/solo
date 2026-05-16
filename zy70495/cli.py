#!/usr/bin/env python3
import click
import json
from datetime import datetime

from task_inspector.storage import Storage
from task_inspector.inspector import TaskInspector
from task_inspector.models import OperationType, RiskType, OperationStatus
from task_inspector.demo_data import generate_demo_data


@click.group()
@click.pass_context
def cli(ctx):
    """任务队列巡检工具 - 用于检测和处理任务队列中的数据异常"""
    storage = Storage()
    ctx.ensure_object(dict)
    ctx.obj['storage'] = storage
    ctx.obj['inspector'] = TaskInspector(storage)


@cli.command()
@click.pass_context
def init(ctx):
    """初始化演示数据"""
    storage = ctx.obj['storage']
    count = generate_demo_data(storage)
    click.echo(f"✅ 已生成 {count} 条演示值班记录")
    click.echo("   - 5条正常记录")
    click.echo("   - 1条有版本覆盖问题的坏记录")
    click.echo("   - 1条过期不完整记录")


@cli.command("list")
@click.pass_context
def list_records(ctx):
    """列出所有值班记录"""
    storage = ctx.obj['storage']
    records = storage.get_all_duty_records()

    if not records:
        click.echo("暂无记录")
        return

    click.echo("=" * 100)
    click.echo(f"{'记录ID':<12} {'日期':<12} {'工程师':<12} {'版本':<8} {'是否过期':<10} {'内容摘要'}")
    click.echo("=" * 100)

    for r in records:
        status = "🔴 是" if r.is_expired else "🟢 否"
        content_preview = r.content[:30] + "..." if len(r.content) > 30 else r.content
        click.echo(f"{r.record_id:<12} {r.date:<12} {r.engineer:<12} v{r.version:<7} {status:<10} {content_preview}")


@cli.command()
@click.option("--operator", "-o", required=True, help="操作者姓名")
@click.option("--type", "-t", "op_type", type=click.Choice(['ROLLBACK', 'CLEAN']), default='ROLLBACK', help="操作类型")
@click.pass_context
def inspect(ctx, operator, op_type):
    """创建巡检批次，生成候选清单"""
    inspector = ctx.obj['inspector']
    operation_type = OperationType[op_type]

    batch, duplicate_msg = inspector.create_inspection_batch(operator, operation_type)

    if duplicate_msg:
        click.echo(click.style(f"⚠️  {duplicate_msg}", fg="yellow"))

    click.echo(f"\n📋 巡检批次: {batch.batch_id}")
    click.echo(f"   操作者: {batch.operator}")
    click.echo(f"   操作类型: {batch.operation_type.value}")
    click.echo(f"   状态: {batch.status.value}")
    click.echo(f"   创建时间: {batch.created_at.strftime('%Y-%m-%d %H:%M:%S')}")

    if not batch.candidates:
        click.echo("\n✅ 未检测到任何问题")
        return

    click.echo(f"\n🔍 检测到 {len(batch.candidates)} 个问题候选：")
    click.echo("-" * 80)

    for i, c in enumerate(batch.candidates, 1):
        risk_icon = "⚠️" if c.risk_type == RiskType.OLD_VERSION_OVERWRITES_NEW else "🕒"
        click.echo(f"\n{i}. {risk_icon} 风险类型: {c.risk_type.value}")
        click.echo(f"   记录ID: {c.record_id}")
        click.echo(f"   描述: {c.description}")
        click.echo(f"   建议: {c.suggestion}")
        if c.detected_version:
            click.echo(f"   版本信息: 当前v{c.current_version} / 检测到v{c.detected_version}")

    click.echo("\n💡 提示: 请确认候选清单后执行 confirm 命令")


@cli.command()
@click.argument("batch_id")
@click.option("--operator", "-o", required=True, help="操作者姓名")
@click.pass_context
def confirm(ctx, batch_id, operator):
    """确认巡检批次的候选清单"""
    inspector = ctx.obj['inspector']
    success = inspector.confirm_batch(batch_id, operator)

    if success:
        click.echo(click.style(f"✅ 批次 {batch_id} 已确认", fg="green"))
        click.echo(f"💡 提示: 确认后可执行 execute 命令执行清理/回滚操作")
    else:
        click.echo(click.style(f"❌ 确认失败：批次不存在或状态不正确", fg="red"))


@cli.command()
@click.argument("batch_id")
@click.option("--operator", "-o", required=True, help="操作者姓名")
@click.pass_context
def execute(ctx, batch_id, operator):
    """执行巡检批次的操作"""
    inspector = ctx.obj['inspector']
    history_records = inspector.execute_batch(batch_id, operator)

    if not history_records:
        click.echo(click.style("❌ 执行失败：批次不存在或未确认", fg="red"))
        return

    click.echo(f"\n✅ 批次 {batch_id} 执行完成")
    click.echo(f"   共处理 {len(history_records)} 条记录\n")

    for h in history_records:
        status_icon = "🔴" if h.is_anomaly else "🟢"
        click.echo(f"{status_icon} 记录 {h.record_id}: {h.result}")


@cli.command()
@click.argument("batch_id")
@click.option("--operator", "-o", required=True, help="操作者姓名")
@click.pass_context
def cancel(ctx, batch_id, operator):
    """取消巡检批次"""
    inspector = ctx.obj['inspector']
    success = inspector.cancel_batch(batch_id, operator)

    if success:
        click.echo(click.style(f"✅ 批次 {batch_id} 已取消", fg="green"))
    else:
        click.echo(click.style(f"❌ 取消失败：批次不存在或状态不正确", fg="red"))


@cli.command("history")
@click.option("--batch-id", "-b", help="按批次ID过滤")
@click.option("--operator", "-o", help="按操作者过滤")
@click.option("--risk-type", "-r", type=click.Choice(['OLD_VERSION_OVERWRITES_NEW', 'EXPIRED_RECORD', 'NORMAL_RECORD']), help="按风险类型过滤")
@click.pass_context
def show_history(ctx, batch_id, operator, risk_type):
    """查询历史记录"""
    inspector = ctx.obj['inspector']
    rt = RiskType[risk_type] if risk_type else None

    histories = inspector.query_history(batch_id, operator, rt)

    if not histories:
        click.echo("暂无历史记录")
        return

    click.echo(f"\n📜 共找到 {len(histories)} 条历史记录\n")
    click.echo("=" * 120)
    click.echo(f"{'历史ID':<12} {'批次ID':<12} {'记录ID':<12} {'操作者':<10} {'风险类型':<20} {'异常':<8} {'执行时间'}")
    click.echo("=" * 120)

    for h in histories:
        anomaly = "是" if h.is_anomaly else "否"
        click.echo(f"{h.history_id:<12} {h.batch_id:<12} {h.record_id:<12} {h.operator:<10} {h.risk_type.value:<20} {anomaly:<8} {h.executed_at.strftime('%m-%d %H:%M')}")


@cli.command("trace")
@click.argument("history_id")
@click.pass_context
def trace(ctx, history_id):
    """追溯具体历史记录的详细信息（复盘用）"""
    inspector = ctx.obj['inspector']
    detail = inspector.get_traceable_history(history_id)

    if not detail:
        click.echo(click.style("❌ 未找到该历史记录", fg="red"))
        return

    click.echo("\n" + "=" * 80)
    click.echo("📋 数据擦除申请追溯详情")
    click.echo("=" * 80)

    click.echo(f"\n基本信息:")
    click.echo(f"  历史ID: {detail['history_id']}")
    click.echo(f"  批次ID: {detail['batch_id']}")
    click.echo(f"  记录ID: {detail['record_id']}")
    click.echo(f"  执行时间: {detail['executed_at']}")
    click.echo(f"  操作者: {detail['operator']}")
    click.echo(f"  风险类型: {detail['risk_type']}")
    click.echo(f"  操作类型: {detail['operation_type']}")
    click.echo(f"  是否异常: {'是' if detail['is_anomaly'] else '否'}")

    click.echo(f"\n处理结果:")
    click.echo(f"  {detail['result']}")

    click.echo(f"\n数据擦除申请 - 变更前状态:")
    click.echo(json.dumps(detail['data_erasure_application']['before_state'], ensure_ascii=False, indent=4))

    click.echo(f"\n数据擦除申请 - 变更后状态:")
    click.echo(json.dumps(detail['data_erasure_application']['after_state'], ensure_ascii=False, indent=4))

    click.echo(f"\n详细说明:")
    click.echo(json.dumps(detail['data_erasure_application']['details'], ensure_ascii=False, indent=4))


@cli.command("batches")
@click.pass_context
def list_batches(ctx):
    """列出所有巡检批次"""
    storage = ctx.obj['storage']
    batches = storage.get_all_batches()

    if not batches:
        click.echo("暂无批次")
        return

    click.echo("\n📋 巡检批次列表\n")
    click.echo("=" * 100)
    click.echo(f"{'批次ID':<12} {'操作者':<10} {'操作类型':<12} {'候选数':<8} {'状态':<15} {'创建时间'}")
    click.echo("=" * 100)

    for b in batches:
        status_color = "green" if b.status == OperationStatus.EXECUTED else "yellow" if b.status == OperationStatus.CONFIRMED else "white"
        click.echo(click.style(
            f"{b.batch_id:<12} {b.operator:<10} {b.operation_type.value:<12} {len(b.candidates):<8} {b.status.value:<15} {b.created_at.strftime('%m-%d %H:%M')}",
            fg=status_color
        ))


if __name__ == '__main__':
    cli()
