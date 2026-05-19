import click
import json
from datetime import datetime
from uuid import uuid4

from models import Patient, Escort
from storage import Storage
from rules import TaskService
from batch import BatchProcessor, Exporter


@click.group()
@click.pass_context
def cli(ctx):
    """门诊陪检任务管理系统"""
    ctx.ensure_object(dict)
    ctx.obj['storage'] = Storage()
    ctx.obj['task_service'] = TaskService(ctx.obj['storage'])
    ctx.obj['batch'] = BatchProcessor(ctx.obj['storage'], ctx.obj['task_service'])
    ctx.obj['exporter'] = Exporter(ctx.obj['storage'])


@cli.group()
def escort():
    """陪检员管理"""
    pass


@escort.command("add")
@click.argument("name")
@click.argument("phone")
@click.argument("employee_id")
@click.option("--operator", default="admin", help="操作人")
@click.pass_context
def add_escort(ctx, name, phone, employee_id, operator):
    """添加陪检员"""
    escort = Escort(
        id=str(uuid4()),
        name=name,
        phone=phone,
        employee_id=employee_id,
        is_active=True
    )
    ctx.obj['storage'].save_escort(escort)
    click.echo(f"陪检员 {name} 添加成功，ID: {escort.id}")


@escort.command("list")
@click.option("--show-all", is_flag=True, help="显示所有（包括离职）")
@click.pass_context
def list_escorts(ctx, show_all):
    """列出陪检员"""
    escorts = ctx.obj['storage'].get_all_escorts()
    if not show_all:
        escorts = [e for e in escorts if e.is_active]
    click.echo(f"{'ID':<38} {'姓名':<8} {'工号':<12} {'电话':<15} {'状态':<6}")
    click.echo("-" * 90)
    for e in escorts:
        status = "在职" if e.is_active else "离职"
        desensitized_phone = Escort._desensitize_phone(e.phone)
        click.echo(f"{e.id:<38} {e.name:<8} {e.employee_id:<12} {desensitized_phone:<15} {status:<6}")


@cli.group()
def task():
    """任务管理"""
    pass


@task.command("create")
@click.argument("name")
@click.argument("phone")
@click.argument("id_card")
@click.argument("department")
@click.option("--emergency", is_flag=True, help="是否急诊")
@click.option("--operator", default="admin", help="操作人")
@click.pass_context
def create_task(ctx, name, phone, id_card, department, emergency, operator):
    """创建任务"""
    patient = Patient(
        id=str(uuid4()),
        name=name,
        phone=phone,
        id_card=id_card,
        department=department,
        is_emergency=emergency
    )
    task, results = ctx.obj['task_service'].create_task(patient, emergency, operator)
    click.echo(f"任务创建成功，ID: {task.id}")
    click.echo(f"排队位置: {task.position}")
    for r in results:
        status = "通过" if r.passed else "拦截"
        click.echo(f"  [{status}] {r.rule_name}: {r.reason}")


@task.command("list")
@click.option("--status", help="按状态过滤 pending/assigned/completed/cancelled/timeout")
@click.option("--show-sensitive", is_flag=True, help="显示敏感信息（需权限）")
@click.pass_context
def list_tasks(ctx, status, show_sensitive):
    """列出任务"""
    tasks = ctx.obj['storage'].get_all_tasks()
    if status:
        tasks = [t for t in tasks if t.status.value == status]
    tasks.sort(key=lambda x: (x.priority.value != "emergency", x.position))
    click.echo(f"{'位置':<4} {'ID':<10} {'患者':<8} {'科室':<10} {'优先级':<8} {'状态':<12} {'陪检员':<8}")
    click.echo("-" * 80)
    for t in tasks:
        patient_name = t.patient.name if show_sensitive else Patient._desensitize_name(t.patient.name)
        escort_name = t.escort.name if t.escort else "-"
        priority = "急诊" if t.priority.value == "emergency" else "普通"
        click.echo(f"{t.position:<4} {t.id[:8]:<10} {patient_name:<8} {t.patient.department:<10} {priority:<8} {t.status.value:<12} {escort_name:<8}")


@task.command("accept")
@click.argument("task_id")
@click.argument("escort_id")
@click.option("--operator", default="admin", help="操作人")
@click.pass_context
def accept_task(ctx, task_id, escort_id, operator):
    """接单"""
    task, results, _ = ctx.obj['task_service'].accept_task(task_id, escort_id, operator)
    if task:
        click.echo(f"接单成功！任务 {task.id} 已分配给 {task.escort.name}")
    else:
        click.echo("接单失败：")
        for r in results:
            if not r.passed:
                click.echo(f"  [{r.rule_name}]: {r.reason}")


@task.command("cancel")
@click.argument("task_id")
@click.argument("reason")
@click.option("--operator", default="admin", help="操作人")
@click.pass_context
def cancel_task(ctx, task_id, reason, operator):
    """取消任务"""
    task, results, fill_result = ctx.obj['task_service'].cancel_task(task_id, operator, reason)
    if task:
        click.echo(f"任务 {task.id} 已取消")
        click.echo(f"补位情况: {fill_result['message']}")
    else:
        click.echo("取消失败：")
        for r in results:
            if not r.passed:
                click.echo(f"  [{r.rule_name}]: {r.reason}")


@task.command("reassign")
@click.argument("task_id")
@click.argument("to_escort_id")
@click.argument("reason")
@click.option("--operator", default="admin", help="操作人")
@click.pass_context
def reassign_task(ctx, task_id, to_escort_id, reason, operator):
    """转派任务"""
    task, results = ctx.obj['task_service'].reassign_task(task_id, to_escort_id, operator, reason)
    if task:
        click.echo(f"任务 {task.id} 已转派给 {task.escort.name}")
        click.echo("操作已留痕，可通过 logs 命令查看")
    else:
        click.echo("转派失败：")
        for r in results:
            if not r.passed:
                click.echo(f"  [{r.rule_name}]: {r.reason}")


@task.command("jump")
@click.argument("task_id")
@click.argument("target_position", type=int)
@click.argument("reason")
@click.option("--operator", default="admin", help="操作人")
@click.pass_context
def jump_queue(ctx, task_id, target_position, reason, operator):
    """插队"""
    task, results = ctx.obj['task_service'].jump_queue(task_id, target_position, operator, reason)
    if task:
        click.echo(f"任务 {task.id} 已移动到位置 {target_position}")
    else:
        click.echo("插队失败：")
        for r in results:
            if not r.passed:
                click.echo(f"  [{r.rule_name}]: {r.reason}")


@task.command("timeout")
@click.option("--operator", default="system", help="操作人")
@click.pass_context
def process_timeout(ctx, operator):
    """处理超时任务"""
    result = ctx.obj['task_service'].process_timeout(operator)
    click.echo(f"处理完成，共 {result['timeout_count']} 个任务超时")
    if result['timeout_count'] > 0:
        click.echo(f"超时任务ID: {', '.join(result['timeout_task_ids'])}")


@task.command("complete")
@click.argument("task_id")
@click.option("--operator", default="admin", help="操作人")
@click.pass_context
def complete_task(ctx, task_id, operator):
    """完成任务"""
    task, results = ctx.obj['task_service'].complete_task(task_id, operator)
    if task:
        click.echo(f"任务 {task.id} 已完成")
    else:
        click.echo("完成失败：")
        for r in results:
            if not r.passed:
                click.echo(f"  [{r.rule_name}]: {r.reason}")


@task.command("logs")
@click.argument("task_id")
@click.pass_context
def show_logs(ctx, task_id):
    """查看任务操作日志"""
    task = ctx.obj['storage'].get_task(task_id)
    if not task:
        click.echo("任务不存在")
        return
    click.echo(f"任务 {task.id} 操作日志：")
    click.echo(f"{'时间':<20} {'操作':<12} {'操作人':<10} {'结果':<6} {'原因'}")
    click.echo("-" * 100)
    for log in task.action_logs:
        result = "成功" if log.success else "失败"
        click.echo(f"{log.timestamp.strftime('%m-%d %H:%M:%S'):<20} {log.action_type.value:<12} {log.operator:<10} {result:<6} {log.reason}")


@cli.group()
def batch():
    """批量操作"""
    pass


@batch.command("import")
@click.argument("json_file")
@click.option("--operator", default="admin", help="操作人")
@click.pass_context
def batch_import(ctx, json_file, operator):
    """批量导入任务"""
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    result = ctx.obj['batch'].batch_create_tasks(data, operator)
    click.echo(f"\n批量导入完成:")
    click.echo(f"  总数: {result['total']}")
    click.echo(f"  成功: {result['success_count']}")
    click.echo(f"  失败: {result['failed_count']}")
    if result['failed']:
        click.echo("\n失败详情：")
        for f in result['failed']:
            click.echo(f"  第{f['index'] + 1}项: {f['error']}")
            click.echo(f"    数据: {json.dumps(f['item'], ensure_ascii=False)}")


@cli.group()
def export():
    """数据导出"""
    pass


@export.command("json")
@click.option("--no-desensitize", is_flag=True, help="不脱敏（需权限）")
@click.pass_context
def export_json(ctx, no_desensitize):
    """导出为JSON"""
    filepath = ctx.obj['exporter'].export_tasks(desensitize=not no_desensitize)
    click.echo(f"已导出到: {filepath}")


@export.command("csv")
@click.option("--no-desensitize", is_flag=True, help="不脱敏（需权限）")
@click.pass_context
def export_csv(ctx, no_desensitize):
    """导出为CSV"""
    filepath = ctx.obj['exporter'].export_tasks_csv(desensitize=not no_desensitize)
    click.echo(f"已导出到: {filepath}")


@export.command("stats")
@click.pass_context
def export_stats(ctx):
    """统计报表"""
    stats = ctx.obj['exporter'].export_statistics()
    click.echo("\n统计报表:")
    click.echo(f"  总任务数: {stats['total_tasks']}")
    click.echo(f"  总陪检员: {stats['total_escorts']} (在职: {stats['active_escorts']})")
    click.echo(f"\n  按状态:")
    for k, v in stats['by_status'].items():
        click.echo(f"    {k}: {v}")
    click.echo(f"\n  按优先级:")
    for k, v in stats['by_priority'].items():
        click.echo(f"    {k}: {v}")
    click.echo(f"\n  平均等候时间: {stats['avg_wait_minutes']} 分钟")
    click.echo(f"  平均处理时间: {stats['avg_process_minutes']} 分钟")
    if stats['escort_workload']:
        click.echo(f"\n  陪检员工作量（前5）:")
        for i, (k, v) in enumerate(list(stats['escort_workload'].items())[:5]):
            click.echo(f"    {i + 1}. {k}: {v} 单")


if __name__ == "__main__":
    cli()
