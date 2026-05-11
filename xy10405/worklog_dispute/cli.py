import click
import json
import os
from pathlib import Path
from tabulate import tabulate
from datetime import datetime

from .store import DataStore
from .importer import Importer
from .engine import DisputeEngine
from .models import DisputeType, DisputeStatus


@click.group()
@click.option("--data-dir", default=".worklog_data", help="数据存储目录")
@click.pass_context
def cli(ctx, data_dir):
    ctx.ensure_object(dict)
    ctx.obj["store"] = DataStore(data_dir)
    ctx.obj["importer"] = Importer(ctx.obj["store"])
    ctx.obj["engine"] = DisputeEngine(ctx.obj["store"])


DISPUTE_TYPE_NAMES = {
    DisputeType.OVERTIME: "超时",
    DisputeType.NO_TASK: "无对应任务",
    DisputeType.UNACCEPTED: "未验收",
    DisputeType.DUPLICATE: "重复日报",
    DisputeType.REJECTED: "客户驳回"
}

DISPUTE_STATUS_NAMES = {
    DisputeStatus.OPEN: "待处理",
    DisputeStatus.RESOLVED: "已解决",
    DisputeStatus.WAIVED: "已放弃",
    DisputeStatus.PENDING: "等待确认"
}


@cli.command("import")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--type", "import_type", required=True,
              type=click.Choice(["worklogs", "tasks", "acceptance"]),
              help="导入数据类型")
@click.pass_context
def import_cmd(ctx, file_path, import_type):
    importer = ctx.obj["importer"]
    store = ctx.obj["store"]
    
    file_path = Path(file_path)
    ext = file_path.suffix.lower()
    
    if ext == ".csv":
        if import_type == "worklogs":
            result = importer.import_worklogs_from_csv(str(file_path))
        elif import_type == "tasks":
            result = importer.import_tasks_from_csv(str(file_path))
        else:
            result = importer.import_acceptance_from_csv(str(file_path))
    elif ext == ".json":
        if import_type == "worklogs":
            result = importer.import_worklogs_from_json(str(file_path))
        elif import_type == "tasks":
            result = importer.import_tasks_from_json(str(file_path))
        else:
            result = importer.import_acceptance_from_json(str(file_path))
    else:
        click.echo(f"不支持的文件格式: {ext}")
        return
    
    if result.get("duplicate_source"):
        click.echo("该文件内容已导入过，跳过重复导入")
    else:
        if import_type == "worklogs":
            click.echo(f"导入成功: 新增 {result['added']} 条，跳过 {result['skipped']} 条重复")
        else:
            click.echo(f"导入成功: 新增 {result['added']} 条")


@cli.command()
@click.pass_context
def analyze(ctx):
    engine = ctx.obj["engine"]
    result = engine.run_full_analysis()
    
    if not result:
        click.echo("没有发现新的争议")
    else:
        click.echo("发现以下争议:")
        for dtype, count in result.items():
            name = DISPUTE_TYPE_NAMES.get(DisputeType(dtype), dtype)
            click.echo(f"  {name}: {count} 条")


@cli.command()
@click.option("--type", "filter_type", default=None,
              type=click.Choice(["overtime", "no_task", "unaccepted", "duplicate", "rejected"]),
              help="按争议类型过滤")
@click.option("--status", "filter_status", default=None,
              type=click.Choice(["open", "resolved", "waived", "pending"]),
              help="按状态过滤")
@click.pass_context
def disputes(ctx, filter_type, filter_status):
    store = ctx.obj["store"]
    
    all_disputes = list(store.disputes.values())
    
    if filter_type:
        dt = DisputeType(filter_type)
        all_disputes = [d for d in all_disputes if d.dispute_type == dt]
    
    if filter_status:
        ds = DisputeStatus(filter_status)
        all_disputes = [d for d in all_disputes if d.status == ds]
    
    if not all_disputes:
        click.echo("没有争议记录")
        return
    
    rows = []
    for d in all_disputes:
        log = store.worklogs.get(d.log_id)
        emp = store.employees.get(log.employee_id) if log else None
        task = store.tasks.get(log.task_id) if log else None
        
        rows.append([
            d.dispute_id,
            DISPUTE_TYPE_NAMES.get(d.dispute_type, d.dispute_type.value),
            DISPUTE_STATUS_NAMES.get(d.status, d.status.value),
            emp.name if emp else (log.employee_id if log else "?"),
            task.title if task else (log.task_id if log else "?"),
            log.work_date.isoformat() if log else "?",
            d.original_hours,
            d.adjusted_hours if d.adjusted_hours is not None else "-"
        ])
    
    headers = ["争议ID", "类型", "状态", "员工", "任务", "日期", "原工时", "调整后工时"]
    click.echo(tabulate(rows, headers=headers, tablefmt="simple"))


@cli.command()
@click.argument("dispute_id")
@click.pass_context
def dispute_detail(ctx, dispute_id):
    store = ctx.obj["store"]
    
    if dispute_id not in store.disputes:
        click.echo(f"未找到争议: {dispute_id}")
        return
    
    d = store.disputes[dispute_id]
    log = store.worklogs.get(d.log_id)
    emp = store.employees.get(log.employee_id) if log else None
    task = store.tasks.get(log.task_id) if log else None
    acc = store.acceptances.get(log.task_id) if log else None
    adjustments = [a for a in store.adjustments.values() if a.log_id == d.log_id]
    
    click.echo("=" * 60)
    click.echo(f"争议ID: {d.dispute_id}")
    click.echo(f"类型: {DISPUTE_TYPE_NAMES.get(d.dispute_type, d.dispute_type.value)}")
    click.echo(f"状态: {DISPUTE_STATUS_NAMES.get(d.status, d.status.value)}")
    click.echo("-" * 60)
    
    if log:
        click.echo(f"员工: {emp.name if emp else log.employee_id}")
        click.echo(f"任务ID: {log.task_id}")
        if task:
            click.echo(f"任务名称: {task.title}")
            click.echo(f"任务状态: {task.status}")
        click.echo(f"日期: {log.work_date.isoformat()}")
        click.echo(f"日报工时: {log.hours} 小时")
        if log.description:
            click.echo(f"描述: {log.description}")
    
    if acc:
        if acc.accepted:
            click.echo(f"验收状态: 已通过 ({acc.accepted_date})")
        else:
            click.echo(f"验收状态: 未通过")
            if acc.rejection_reason:
                click.echo(f"驳回原因: {acc.rejection_reason}")
    
    click.echo("-" * 60)
    click.echo(f"争议原始工时: {d.original_hours}")
    if d.adjusted_hours is not None:
        click.echo(f"系统建议调整: {d.adjusted_hours}")
        diff = d.adjusted_hours - d.original_hours
        if diff < 0:
            click.echo(f"扣减工时: {abs(diff)}")
    
    if d.notes:
        click.echo("-" * 60)
        click.echo("处理备注:")
        for note in d.notes:
            click.echo(f"  {note}")
    
    if adjustments:
        click.echo("-" * 60)
        click.echo("调整历史:")
        for adj in adjustments:
            click.echo(f"  [{adj.created_at.strftime('%Y-%m-%d %H:%M')}] "
                      f"{adj.before_hours} -> {adj.after_hours} 小时")
            click.echo(f"      原因: {adj.reason}")
    
    if emp:
        rate = emp.hourly_rate
        click.echo("-" * 60)
        click.echo(f"时薪: ¥{rate:.2f}")
        click.echo(f"日报金额: ¥{log.hours * rate:.2f}" if log else "-")
        if d.adjusted_hours is not None:
            click.echo(f"调整后金额: ¥{d.adjusted_hours * rate:.2f}")
        else:
            click.echo("调整后金额: 待确认")
    
    click.echo("=" * 60)


@cli.command()
@click.argument("dispute_id")
@click.argument("note")
@click.pass_context
def add_note(ctx, dispute_id, note):
    engine = ctx.obj["engine"]
    
    if engine.add_note(dispute_id, note):
        click.echo(f"备注已添加到 {dispute_id}")
    else:
        click.echo(f"未找到争议: {dispute_id}")


@cli.command()
@click.argument("dispute_id")
@click.option("--status", required=True,
              type=click.Choice(["resolved", "waived", "pending", "open"]),
              help="设置新状态")
@click.option("--hours", type=float, default=None, help="调整后的工时（可选）")
@click.option("--note", default="", help="处理备注")
@click.pass_context
def resolve(ctx, dispute_id, status, hours, note):
    engine = ctx.obj["engine"]
    ds = DisputeStatus(status)
    
    result = engine.resolve_dispute(dispute_id, ds, note, hours)
    
    if result:
        click.echo(f"争议 {dispute_id} 状态已更新为 {DISPUTE_STATUS_NAMES[ds]}")
    else:
        click.echo(f"未找到争议: {dispute_id}")


@cli.command()
@click.argument("log_id")
@click.argument("new_hours", type=float)
@click.argument("reason")
@click.pass_context
def adjust(ctx, log_id, new_hours, reason):
    engine = ctx.obj["engine"]
    store = ctx.obj["store"]
    
    if log_id not in store.worklogs:
        click.echo(f"未找到工时记录: {log_id}")
        return
    
    log = store.worklogs[log_id]
    old_hours = log.hours
    
    result = engine.adjust_worklog(log_id, new_hours, reason)
    
    if result:
        click.echo(f"工时已调整: {old_hours} -> {new_hours} 小时")
        click.echo(f"差异: {new_hours - old_hours} 小时")
    else:
        click.echo("调整失败")


@cli.command()
@click.option("--output", "-o", default=None, help="输出文件路径（不指定则显示到终端）")
@click.option("--format", "fmt", default="text", type=click.Choice(["text", "json"]),
              help="输出格式")
@click.pass_context
def report(ctx, output, fmt):
    engine = ctx.obj["engine"]
    store = ctx.obj["store"]
    
    report_data = engine.get_settlement_report()
    totals = report_data["totals"]
    
    if fmt == "json":
        content = json.dumps(report_data, ensure_ascii=False, indent=2)
        if output:
            with open(output, "w", encoding="utf-8") as f:
                f.write(content)
            click.echo(f"报告已保存到 {output}")
        else:
            click.echo(content)
        return
    
    lines = []
    lines.append("=" * 80)
    lines.append("                    外包工时结算报告")
    lines.append("=" * 80)
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    
    lines.append("【总体汇总】")
    lines.append("-" * 80)
    total_rows = [
        ["总工时", f"{totals['total_hours']:.2f} 小时"],
        ["可结算工时", f"{totals['settleable_hours']:.2f} 小时"],
        ["暂不可结算工时", f"{totals['held_hours']:.2f} 小时"],
        ["", ""],
        ["总金额", f"¥{totals['total_amount']:.2f}"],
        ["可结算金额", f"¥{totals['settleable_amount']:.2f}"],
        ["暂不可结算金额", f"¥{totals['held_amount']:.2f}"],
    ]
    lines.append(tabulate(total_rows, tablefmt="plain"))
    lines.append("")
    
    lines.append("【按员工汇总】")
    lines.append("-" * 80)
    emp_rows = []
    for emp_name, data in report_data["by_employee"].items():
        emp_rows.append([
            emp_name,
            f"{data['total_hours']:.2f}",
            f"{data['settleable_hours']:.2f}",
            f"{data['held_hours']:.2f}",
            f"¥{data['total_amount']:.2f}",
            f"¥{data['settleable_amount']:.2f}",
            f"¥{data['held_amount']:.2f}"
        ])
    lines.append(tabulate(
        emp_rows,
        headers=["员工", "总工时", "可结算", "暂扣", "总金额", "可结算额", "暂扣款"],
        tablefmt="simple"
    ))
    lines.append("")
    
    open_disputes = [d for d in store.disputes.values() if d.status == DisputeStatus.OPEN]
    if open_disputes:
        lines.append("【待处理争议（影响结算）】")
        lines.append("-" * 80)
        disp_rows = []
        for d in open_disputes:
            log = store.worklogs.get(d.log_id)
            emp = store.employees.get(log.employee_id) if log else None
            task = store.tasks.get(log.task_id) if log else None
            emp_name = emp.name if emp else (log.employee_id if log else "?")
            task_name = task.title if task else (log.task_id if log else "?")
            date_str = log.work_date.isoformat() if log else "?"
            disp_rows.append([
                d.dispute_id,
                DISPUTE_TYPE_NAMES.get(d.dispute_type, d.dispute_type.value),
                emp_name,
                task_name,
                date_str,
                d.original_hours
            ])
        lines.append(tabulate(
            disp_rows,
            headers=["争议ID", "类型", "员工", "任务", "日期", "争议工时"],
            tablefmt="simple"
        ))
    else:
        lines.append("【无待处理争议】")
    
    lines.append("")
    lines.append("=" * 80)
    lines.append(f"可结算金额: ¥{totals['settleable_amount']:.2f}")
    if totals['held_amount'] > 0:
        lines.append(f"暂不可结算金额: ¥{totals['held_amount']:.2f}  (请先处理上述争议)")
    else:
        lines.append("全部工时均可结算")
    lines.append("=" * 80)
    
    content = "\n".join(lines)
    
    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(content)
        click.echo(f"报告已保存到 {output}")
    else:
        click.echo(content)


@cli.command()
@click.argument("log_id")
@click.pass_context
def log_detail(ctx, log_id):
    store = ctx.obj["store"]
    
    if log_id not in store.worklogs:
        click.echo(f"未找到工时记录: {log_id}")
        return
    
    log = store.worklogs[log_id]
    emp = store.employees.get(log.employee_id)
    task = store.tasks.get(log.task_id)
    disputes = [d for d in store.disputes.values() if d.log_id == log_id]
    adjustments = [a for a in store.adjustments.values() if a.log_id == log_id]
    
    click.echo("=" * 60)
    click.echo(f"工时ID: {log.log_id}")
    click.echo(f"员工: {emp.name if emp else log.employee_id}")
    if emp:
        click.echo(f"时薪: ¥{emp.hourly_rate:.2f}")
    click.echo(f"任务: {log.task_id}")
    if task:
        click.echo(f"任务名称: {task.title}")
        click.echo(f"任务状态: {task.status}")
    click.echo(f"日期: {log.work_date.isoformat()}")
    click.echo(f"工时: {log.hours} 小时")
    if log.description:
        click.echo(f"描述: {log.description}")
    
    if emp:
        click.echo(f"金额: ¥{log.hours * emp.hourly_rate:.2f}")
    
    if disputes:
        click.echo("-" * 60)
        click.echo("争议:")
        for d in disputes:
            click.echo(f"  [{DISPUTE_STATUS_NAMES[d.status]}] {DISPUTE_TYPE_NAMES[d.dispute_type]}")
            if d.adjusted_hours is not None:
                click.echo(f"      建议: {d.original_hours} -> {d.adjusted_hours} 小时")
    
    if adjustments:
        click.echo("-" * 60)
        click.echo("调整历史:")
        for adj in adjustments:
            click.echo(f"  [{adj.created_at.strftime('%Y-%m-%d %H:%M')}] "
                      f"{adj.before_hours} -> {adj.after_hours}")
            click.echo(f"      原因: {adj.reason}")
    
    click.echo("=" * 60)


@cli.command()
@click.pass_context
def stats(ctx):
    store = ctx.obj["store"]
    
    click.echo("数据统计:")
    click.echo(f"  员工数: {len(store.employees)}")
    click.echo(f"  任务数: {len(store.tasks)}")
    click.echo(f"  验收记录: {len(store.acceptances)}")
    click.echo(f"  工时记录: {len(store.get_active_worklogs())}")
    click.echo(f"  争议数: {len(store.disputes)}")
    
    open_d = [d for d in store.disputes.values() if d.status == DisputeStatus.OPEN]
    click.echo(f"    待处理: {len(open_d)}")
    
    by_type = {}
    for d in open_d:
        t = DISPUTE_TYPE_NAMES.get(d.dispute_type, d.dispute_type.value)
        by_type[t] = by_type.get(t, 0) + 1
    
    if by_type:
        for t, c in by_type.items():
            click.echo(f"      {t}: {c}")


if __name__ == "__main__":
    cli()
