import click
from datetime import datetime

from task_retry.data_loader import DataLoader
from task_retry.task_scheduler import TaskScheduler
from task_retry.report_generator import ReportGenerator
from task_retry.models import TaskStatus, DataSource


@click.group()
def cli():
    """任务调度重试工具 - 报警记录、接口文档、调用日志统一处理"""
    pass


@cli.command()
@click.option("--batch-id", help="批次ID，自动生成如未指定")
@click.option("--force", is_flag=True, help="强制重新处理已完成的任务")
def run(batch_id, force):
    """执行任务调度重试处理"""
    click.echo("=" * 60)
    click.echo("任务调度重试 - 开始处理")
    click.echo("=" * 60)

    data_loader = DataLoader()
    data_loader.load_all()

    click.echo(f"加载报警记录: {len(data_loader.alarm_records)} 条")
    click.echo(f"加载旧接口文档: {len(data_loader.old_api_docs)} 份")
    click.echo(f"加载调用日志: {len(data_loader.call_logs)} 条")
    click.echo(f"已有任务记录: {len(data_loader.task_records)} 条")
    click.echo("")

    scheduler = TaskScheduler(data_loader)
    tasks = scheduler.process_batch(batch_id=batch_id, force=force)

    click.echo("处理结果:")
    click.echo("-" * 60)
    for task in tasks:
        status_icon = _get_status_icon(task.status)
        click.echo(
            f"{status_icon} {task.task_id} | {task.api_endpoint} | "
            f"{task.status.value} | 重试次数: {task.retry_count}"
        )
        if task.idempotent_issue:
            click.echo(
                f"  ⚠️  幂等键问题: {task.idempotent_issue.issue_type} | "
                f"来源: {task.idempotent_issue.source.value}"
            )
            click.echo(f"     联系人: {task.idempotent_issue.contact_person}")
            click.echo(f"     下一步: {task.idempotent_issue.next_step}")
        if task.auto_judgment:
            click.echo(f"  💡 判断理由: {task.auto_judgment.reason}")
            click.echo(f"     处理建议: {task.auto_judgment.suggestion}")
        click.echo("")

    click.echo("=" * 60)
    click.echo(f"处理完成，共处理 {len(tasks)} 条任务")
    click.echo("=" * 60)


@cli.command()
@click.option("--batch-id", required=True, help="批次ID")
def report(batch_id):
    """生成技术负责人迁移报告"""
    click.echo("=" * 60)
    click.echo("生成迁移报告")
    click.echo("=" * 60)

    data_loader = DataLoader()
    data_loader.load_all()

    batch_tasks = [
        t for t in data_loader.task_records if t.batch_id == batch_id
    ]

    if not batch_tasks:
        click.echo(f"未找到批次ID为 {batch_id} 的任务记录")
        return

    report_gen = ReportGenerator()
    report = report_gen.generate_migration_report(batch_tasks, batch_id)

    click.echo(f"报告ID: {report.report_id}")
    click.echo(f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
    click.echo("")
    click.echo("概览统计:")
    click.echo(f"  总记录数: {report.total_records}")
    click.echo(f"  已确认: {report.confirmed_count}")
    click.echo(f"  待补充: {report.awaiting_supplement_count}")
    click.echo(f"  人工修改: {report.manually_modified_count}")
    click.echo(f"  成功: {report.success_count}")
    click.echo(f"  失败: {report.failed_count}")
    click.echo(f"  幂等键问题: {report.idempotent_issue_count}")
    click.echo("")
    click.echo(f"报告已保存至 ./reports/ 目录")
    click.echo("=" * 60)


@cli.command()
@click.argument("task_id")
@click.option("--notes", default="", help="确认备注")
def confirm(task_id, notes):
    """人工确认任务"""
    data_loader = DataLoader()
    data_loader.load_all()

    scheduler = TaskScheduler(data_loader)
    scheduler.mark_confirmed(task_id, notes)

    click.echo(f"任务 {task_id} 已标记为已确认")


@cli.command()
@click.argument("task_id")
@click.option("--notes", required=True, help="修改说明")
def modify(task_id, notes):
    """标记任务为人工修改"""
    data_loader = DataLoader()
    data_loader.load_all()

    scheduler = TaskScheduler(data_loader)
    scheduler.mark_manually_modified(task_id, notes)

    click.echo(f"任务 {task_id} 已标记为人工修改")


@cli.command()
@click.option("--api", help="按API端点过滤")
@click.option("--idempotent-key", help="按幂等键过滤")
def timeline(api, idempotent_key):
    """查看统一时间线视图"""
    data_loader = DataLoader()
    data_loader.load_all()

    from task_retry.data_loader import UnifiedViewBuilder, TimelineBuilder

    if idempotent_key:
        builder = UnifiedViewBuilder(data_loader)
        view = builder.build_by_idempotent_key(idempotent_key)
        if view:
            _display_timeline(view)
        else:
            click.echo(f"未找到幂等键 {idempotent_key} 的相关记录")
    elif api:
        builder = UnifiedViewBuilder(data_loader)
        view = builder.build_by_api_endpoint(api)
        if view:
            _display_timeline(view)
        else:
            click.echo(f"未找到API {api} 的相关记录")
    else:
        timeline = TimelineBuilder.build_timeline(
            data_loader.alarm_records,
            data_loader.old_api_docs,
            data_loader.call_logs,
        )
        click.echo(f"共 {len(timeline)} 条时间线记录")
        for item in timeline[:20]:
            source_icon = _get_source_icon(item.source)
            click.echo(
                f"{source_icon} {item.timestamp.strftime('%Y-%m-%d %H:%M:%S')} | "
                f"{item.title}"
            )
        if len(timeline) > 20:
            click.echo(f"... 还有 {len(timeline) - 20} 条记录")


def _display_timeline(view):
    click.echo("=" * 80)
    click.echo(f"统一视图 - {view.api_endpoint}")
    click.echo(f"幂等键: {view.idempotent_key or '无'}")
    click.echo(f"当前状态: {view.latest_status.value}")
    click.echo(f"摘要: {view.summary}")
    click.echo("=" * 80)
    click.echo("时间线:")
    click.echo("-" * 80)
    for item in view.timeline:
        source_icon = _get_source_icon(item.source)
        click.echo(
            f"{source_icon} {item.timestamp.strftime('%Y-%m-%d %H:%M:%S')} | "
            f"{item.title}"
        )
        click.echo(f"     {item.content}")
        click.echo("")
    click.echo("=" * 80)


def _get_status_icon(status: TaskStatus) -> str:
    icon_map = {
        TaskStatus.SUCCESS: "✅",
        TaskStatus.FAILED: "❌",
        TaskStatus.PENDING: "⏳",
        TaskStatus.PROCESSING: "🔄",
        TaskStatus.IDEMPOTENT_ISSUE: "⚠️",
        TaskStatus.NEEDS_MANUAL_REVIEW: "👀",
        TaskStatus.CONFIRMED: "✓",
        TaskStatus.AWAITING_SUPPLEMENT: "📋",
        TaskStatus.MANUALLY_MODIFIED: "✏️",
    }
    return icon_map.get(status, "•")


def _get_source_icon(source: DataSource) -> str:
    icon_map = {
        DataSource.ALARM_RECORD: "🚨",
        DataSource.OLD_API_DOC: "📄",
        DataSource.CALL_LOG: "📝",
    }
    return icon_map.get(source, "•")


@cli.command()
def list_tasks():
    """列出所有任务记录"""
    data_loader = DataLoader()
    data_loader.load_all()

    if not data_loader.task_records:
        click.echo("暂无任务记录")
        return

    click.echo("=" * 80)
    click.echo(f"{'任务ID':<12} {'API端点':<25} {'状态':<20} {'重试次数':<8}")
    click.echo("-" * 80)

    for task in data_loader.task_records:
        status_icon = _get_status_icon(task.status)
        click.echo(
            f"{task.task_id:<12} {task.api_endpoint:<25} "
            f"{status_icon} {task.status.value:<18} {task.retry_count:<8}"
        )

    click.echo("=" * 80)
    click.echo(f"共 {len(data_loader.task_records)} 条任务记录")


if __name__ == "__main__":
    cli()
