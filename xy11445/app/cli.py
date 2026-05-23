import click
import sys
import json
from datetime import datetime
from typing import Optional

from app.models.database import init_db, SessionLocal
from app.models.enums import DataSource, BatchStrategy, WorkOrderStatus
from app.schemas import BatchCreate, WorkOrderCreate
from app.services.batch_service import BatchService
from app.services.work_order_service import WorkOrderService
from app.services.export_service import ExportService
from app.services.task_service import TaskService, TaskExecutor


EXIT_SUCCESS = 0
EXIT_ERROR = 1
EXIT_NOT_FOUND = 2
EXIT_INVALID_INPUT = 3


@click.group()
@click.pass_context
def cli(ctx):
    """充电桩巡检异常回执状态机 CLI"""
    init_db()
    ctx.ensure_object(dict)
    ctx.obj["db"] = SessionLocal()


@cli.command("api")
@click.option("--host", default="0.0.0.0", help="API服务监听地址")
@click.option("--port", default=8000, type=int, help="API服务监听端口")
def api(host, port):
    """启动API服务"""
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=True,
    )
    sys.exit(EXIT_SUCCESS)


@cli.group()
def batch():
    """批次管理命令"""
    pass


@batch.command("create")
@click.option("--batch-no", required=True, help="批次号")
@click.option("--source", required=True, type=click.Choice([s.value for s in DataSource]), help="数据来源")
@click.option("--strategy", default="ignore", type=click.Choice([s.value for s in BatchStrategy]), help="重复数据策略")
@click.option("--created-by", default="cli", help="创建人")
@click.option("--remark", help="备注")
@click.pass_context
def batch_create(ctx, batch_no, source, strategy, created_by, remark):
    """创建批次"""
    try:
        service = BatchService(ctx.obj["db"])
        batch_data = BatchCreate(
            batch_no=batch_no,
            source=DataSource(source),
            strategy=BatchStrategy(strategy),
            created_by=created_by,
            remark=remark,
        )
        batch = service.create_batch(batch_data)
        click.echo(f"批次创建成功: {batch.id}")
        click.echo(f"批次号: {batch.batch_no}")
        click.echo(f"来源: {batch.source}")
        click.echo(f"策略: {batch.strategy}")
        sys.exit(EXIT_SUCCESS)
    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)
        sys.exit(EXIT_ERROR)


@batch.command("list")
@click.option("--source", help="按来源筛选")
@click.option("--limit", default=20, help="显示数量")
@click.pass_context
def batch_list(ctx, source, limit):
    """列出批次"""
    service = BatchService(ctx.obj["db"])
    batches = service.list_batches(limit=limit, source=source)

    if not batches:
        click.echo("没有批次数据")
        sys.exit(EXIT_SUCCESS)

    click.echo(f"{'ID':<38} {'批次号':<20} {'来源':<15} {'状态':<10} {'总数':<6} {'成功':<6}")
    click.echo("-" * 100)
    for b in batches:
        click.echo(f"{b.id:<38} {b.batch_no:<20} {b.source:<15} {b.status:<10} {b.total_count:<6} {b.success_count:<6}")
    sys.exit(EXIT_SUCCESS)


@batch.command("import")
@click.option("--batch-id", required=True, help="批次ID")
@click.option("--file", required=True, type=click.File("r"), help="JSON数据文件")
@click.option("--strategy", default="ignore", type=click.Choice([s.value for s in BatchStrategy]), help="重复数据策略")
@click.pass_context
def batch_import(ctx, batch_id, file, strategy):
    """导入工单数据"""
    try:
        data = json.load(file)
        work_orders = [WorkOrderCreate(**item) for item in data]

        service = BatchService(ctx.obj["db"])
        result = service.import_work_orders(batch_id, work_orders, BatchStrategy(strategy))

        click.echo(f"导入完成:")
        click.echo(f"  总数: {result.total_count}")
        click.echo(f"  成功: {result.success_count}")
        click.echo(f"  失败: {result.failed_count}")
        click.echo(f"  忽略: {result.ignored_count}")

        if result.failed_items:
            click.echo(f"\n失败项:")
            for item in result.failed_items:
                click.echo(f"  {item['order_no']}: {item['error']}")

        sys.exit(EXIT_SUCCESS if result.failed_count == 0 else EXIT_ERROR)
    except json.JSONDecodeError as e:
        click.echo(f"JSON解析错误: {str(e)}", err=True)
        sys.exit(EXIT_INVALID_INPUT)
    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)
        sys.exit(EXIT_ERROR)


@cli.group()
def order():
    """工单管理命令"""
    pass


@order.command("list")
@click.option("--area", help="按片区筛选")
@click.option("--status", help="按状态筛选")
@click.option("--source", help="按来源筛选")
@click.option("--limit", default=20, help="显示数量")
@click.pass_context
def order_list(ctx, area, status, source, limit):
    """列出工单"""
    service = WorkOrderService(ctx.obj["db"])
    orders = service.list_work_orders(limit=limit, area=area, status=status, source=source)

    if not orders:
        click.echo("没有工单数据")
        sys.exit(EXIT_SUCCESS)

    click.echo(f"{'工单号':<15} {'充电桩':<12} {'片区':<10} {'来源':<12} {'状态':<10} {'告警类型':<20}")
    click.echo("-" * 80)
    for o in orders:
        click.echo(f"{o.order_no:<15} {o.pile_no:<12} {o.area:<10} {o.source:<12} {o.status:<10} {o.alarm_type:<20}")
    sys.exit(EXIT_SUCCESS)


@order.command("show")
@click.argument("work_order_id")
@click.pass_context
def order_show(ctx, work_order_id):
    """显示工单详情"""
    service = WorkOrderService(ctx.obj["db"])
    detail = service.get_work_order_detail(work_order_id)

    if not detail:
        click.echo(f"工单不存在: {work_order_id}", err=True)
        sys.exit(EXIT_NOT_FOUND)

    wo = detail["work_order"]
    click.echo(f"工单号: {wo.order_no}")
    click.echo(f"ID: {wo.id}")
    click.echo(f"充电桩: {wo.pile_no}")
    click.echo(f"片区: {wo.area}")
    click.echo(f"来源: {wo.source}")
    click.echo(f"当前状态: {wo.status}")
    click.echo(f"冻结前状态: {wo.status_before_freeze or '-'}")
    click.echo(f"故障时长: {wo.fault_duration or 0} 小时")
    click.echo(f"告警类型: {wo.alarm_type}")
    click.echo(f"告警级别: {wo.alarm_level}")
    click.echo(f"告警内容: {wo.alarm_content}")
    click.echo(f"处理人: {wo.handler or '-'}")
    click.echo(f"复核人: {wo.reviewer or '-'}")
    click.echo(f"人工理由: {wo.manual_reason or '-'}")

    if detail["status_transitions"]:
        click.echo(f"\n状态流转历史:")
        for t in detail["status_transitions"][:5]:
            click.echo(f"  {t['transition_time']} - {t['operator']}: {t['from_status']} -> {t['to_status']} ({t['reason'] or '-'})")

    if detail["audit_logs"]:
        click.echo(f"\n操作日志:")
        for log in detail["audit_logs"][:5]:
            click.echo(f"  {log['operation_time']} - {log['operator']}: {log['operation_type']} ({log['remark'] or '-'})")

    sys.exit(EXIT_SUCCESS)


@order.command("review")
@click.argument("work_order_id")
@click.option("--operator", required=True, help="操作人")
@click.option("--approved/--rejected", required=True, help="是否通过")
@click.option("--reason", required=True, help="复核理由")
@click.option("--manual-reason", help="人工调整理由")
@click.pass_context
def order_review(ctx, work_order_id, operator, approved, reason, manual_reason):
    """复核工单"""
    service = WorkOrderService(ctx.obj["db"])
    success, message = service.review(work_order_id, operator, approved, reason, manual_reason)

    if success:
        click.echo(f"复核成功: {message}")
        sys.exit(EXIT_SUCCESS)
    else:
        click.echo(f"复核失败: {message}", err=True)
        sys.exit(EXIT_ERROR)


@order.command("freeze")
@click.argument("work_order_id")
@click.option("--operator", required=True, help="操作人")
@click.option("--reason", required=True, help="冻结理由")
@click.pass_context
def order_freeze(ctx, work_order_id, operator, reason):
    """冻结工单"""
    service = WorkOrderService(ctx.obj["db"])
    success, message = service.freeze(work_order_id, operator, reason)

    if success:
        click.echo(f"冻结成功: {message}")
        sys.exit(EXIT_SUCCESS)
    else:
        click.echo(f"冻结失败: {message}", err=True)
        sys.exit(EXIT_ERROR)


@order.command("unfreeze")
@click.argument("work_order_id")
@click.option("--operator", required=True, help="操作人")
@click.option("--reason", required=True, help="解冻理由")
@click.pass_context
def order_unfreeze(ctx, work_order_id, operator, reason):
    """解冻工单"""
    service = WorkOrderService(ctx.obj["db"])
    success, message = service.unfreeze(work_order_id, operator, reason)

    if success:
        click.echo(f"解冻成功: {message}")
        sys.exit(EXIT_SUCCESS)
    else:
        click.echo(f"解冻失败: {message}", err=True)
        sys.exit(EXIT_ERROR)


@order.command("archive")
@click.argument("work_order_id")
@click.option("--operator", required=True, help="操作人")
@click.option("--reason", help="归档理由")
@click.pass_context
def order_archive(ctx, work_order_id, operator, reason):
    """归档工单"""
    service = WorkOrderService(ctx.obj["db"])
    success, message = service.archive(work_order_id, operator, reason)

    if success:
        click.echo(f"归档成功: {message}")
        sys.exit(EXIT_SUCCESS)
    else:
        click.echo(f"归档失败: {message}", err=True)
        sys.exit(EXIT_ERROR)


@order.command("offline-recovery")
@click.argument("work_order_id")
@click.option("--operator", required=True, help="操作人")
@click.option("--actual-duration", required=True, type=float, help="实际故障时长(小时)")
@click.pass_context
def order_offline_recovery(ctx, work_order_id, operator, actual_duration):
    """处理离线告警恢复"""
    service = WorkOrderService(ctx.obj["db"])
    success, message = service.handle_offline_recovery(work_order_id, operator, actual_duration)

    if success:
        click.echo(f"处理成功: {message}")
        sys.exit(EXIT_SUCCESS)
    else:
        click.echo(f"处理失败: {message}", err=True)
        sys.exit(EXIT_ERROR)


@cli.group()
def export():
    """导出命令"""
    pass


@export.command("summary")
@click.option("--area", help="按片区筛选")
@click.option("--output", required=True, help="输出文件路径")
@click.option("--format", "fmt", default="excel", type=click.Choice(["excel", "csv"]), help="输出格式")
@click.option("--status", help="按状态筛选")
@click.pass_context
def export_summary(ctx, area, output, fmt, status):
    """导出汇总报表"""
    service = ExportService(ctx.obj["db"])
    try:
        if fmt == "excel":
            service.export_to_excel(output_path=output, area=area, status=status)
        else:
            service.export_to_csv(output_path=output, area=area, status=status)

        click.echo(f"导出成功: {output}")
        sys.exit(EXIT_SUCCESS)
    except Exception as e:
        click.echo(f"导出失败: {str(e)}", err=True)
        sys.exit(EXIT_ERROR)


@export.command("stats")
@click.option("--area", help="按片区筛选")
@click.pass_context
def export_stats(ctx, area):
    """显示统计信息"""
    service = ExportService(ctx.obj["db"])
    stats = service.get_statistics_summary(area=area)

    click.echo("=== 汇总信息 ===")
    for k, v in stats["汇总信息"].items():
        click.echo(f"{k}: {v}")

    click.echo("\n=== 按状态统计 ===")
    for k, v in stats["按状态统计"].items():
        click.echo(f"{k}: {v}")

    click.echo("\n=== 按来源统计 ===")
    for k, v in stats["按来源统计"].items():
        click.echo(f"{k}: {v}")

    click.echo("\n=== 按片区统计 ===")
    for k, v in stats["按片区统计"].items():
        click.echo(f"{k}: {v}")

    sys.exit(EXIT_SUCCESS)


@cli.group()
def task():
    """任务管理命令"""
    pass


@task.command("list")
@click.option("--status", default="pending", type=click.Choice(["pending", "manual"]), help="任务状态")
@click.option("--limit", default=20, help="显示数量")
@click.pass_context
def task_list(ctx, status, limit):
    """列出任务"""
    service = TaskService(ctx.obj["db"])
    if status == "manual":
        tasks = service.get_manual_tasks(limit=limit)
    else:
        tasks = service.get_pending_tasks(limit=limit)

    if not tasks:
        click.echo("没有待处理任务")
        sys.exit(EXIT_SUCCESS)

    click.echo(f"{'ID':<38} {'类型':<15} {'状态':<15} {'重试':<6} {'错误信息'}")
    click.echo("-" * 100)
    for t in tasks:
        error = (t.last_error or "-")[:40]
        click.echo(f"{t.id:<38} {t.task_type:<15} {t.status:<15} {t.retry_count}/{t.max_retry:<6} {error}")
    sys.exit(EXIT_SUCCESS)


@task.command("run")
@click.option("--limit", default=10, help="执行数量")
@click.pass_context
def task_run(ctx, limit):
    """运行待处理任务"""
    executor = TaskExecutor(ctx.obj["db"])
    success_count = executor.run_pending_tasks(limit)
    click.echo(f"执行完成，成功: {success_count}")
    sys.exit(EXIT_SUCCESS)


@task.command("retry")
@click.argument("task_id")
@click.pass_context
def task_retry(ctx, task_id):
    """重试人工任务"""
    service = TaskService(ctx.obj["db"])
    success = service.retry_manual_task(task_id)
    if success:
        click.echo("任务已加入重试队列")
        sys.exit(EXIT_SUCCESS)
    else:
        click.echo("任务重试失败", err=True)
        sys.exit(EXIT_ERROR)


@task.command("cancel")
@click.argument("task_id")
@click.pass_context
def task_cancel(ctx, task_id):
    """取消任务"""
    service = TaskService(ctx.obj["db"])
    success = service.cancel_task(task_id)
    if success:
        click.echo("任务已取消")
        sys.exit(EXIT_SUCCESS)
    else:
        click.echo("任务取消失败", err=True)
        sys.exit(EXIT_ERROR)


def main():
    cli(obj={})


if __name__ == "__main__":
    main()
