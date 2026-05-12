import sys
import json
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

from .models import (
    ChangeStatus,
    BackfillStatus,
)
from .storage import JSONStorage
from .rules import (
    RuleEngine,
    update_change_status,
    manual_correction,
)
from .report import ReportGenerator
from .samples import create_sample_project, create_failure_scenario_project

app = typer.Typer(
    name="metric-cli",
    help="报表口径变更管理CLI工具",
    add_completion=False,
)
console = Console()
storage = JSONStorage()
rule_engine = RuleEngine()
report_gen = ReportGenerator()


def _print_status_header(text: str):
    console.print(f"\n[bold cyan]{text}[/bold cyan]")
    console.print("[cyan]" + "=" * 50 + "[/cyan]")


def _print_success(message: str):
    console.print(f"[bold green]✓ {message}[/bold green]")


def _print_error(message: str):
    console.print(f"[bold red]✗ {message}[/bold red]")


def _print_warning(message: str):
    console.print(f"[bold yellow]⚠ {message}[/bold yellow]")


def _print_info(message: str):
    console.print(f"[cyan]{message}[/cyan]")


@app.command("list")
def list_projects():
    """列出所有项目"""
    projects = storage.list_projects()

    if not projects:
        _print_warning("暂无项目")
        return

    _print_status_header("项目列表")

    table = Table(title="现有项目", box=box.SIMPLE)
    table.add_column("项目ID", style="cyan")
    table.add_column("名称", style="bold")
    table.add_column("创建时间")
    table.add_column("变更数", justify="right")
    table.add_column("状态")

    for p in projects:
        status_style = {
            "completed": "green",
            "needs_attention": "yellow",
            "in_progress": "blue",
            "has_failures": "red",
            "empty": "dim"
        }.get(p["status"], "white")

        table.add_row(
            p["id"],
            p["name"],
            p["created_at"].strftime("%Y-%m-%d %H:%M"),
            str(p["changes"]),
            f"[{status_style}]{p['status']}[/{status_style}]"
        )

    console.print(table)


@app.command("init")
def init_project(
    project_id: Optional[str] = typer.Option(None, "--id", "-i", help="指定项目ID（默认自动生成）"),
    name: str = typer.Option(..., "--name", "-n", help="项目名称"),
    description: str = typer.Option("", "--desc", "-d", help="项目描述"),
    operator: str = typer.Option(..., "--operator", "-o", help="操作者标识"),
    sample: bool = typer.Option(False, "--sample", "-s", help="加载内置样例数据"),
    fail_sample: bool = typer.Option(False, "--fail-sample", "-f", help="加载失败场景样例数据"),
):
    """初始化新项目"""

    if sample and fail_sample:
        _print_error("不能同时使用 --sample 和 --fail-sample")
        raise typer.Exit(code=1)

    if sample:
        project = create_sample_project(operator)
        if project_id:
            project.project_id = project_id
        if name:
            project.name = name
        if description:
            project.description = description
    elif fail_sample:
        project = create_failure_scenario_project(operator)
        if project_id:
            project.project_id = project_id
        if name:
            project.name = name
    else:
        from .models import ChangeProject
        import uuid
        project = ChangeProject(
            project_id=project_id or f"proj_{uuid.uuid4().hex[:8]}",
            name=name,
            description=description,
            created_by=operator,
        )

    if storage.project_exists(project.project_id):
        _print_warning(f"项目 {project.project_id} 已存在，跳过（幂等）")
        return

    storage.save_project(project, operator)
    _print_success(f"项目已创建: {project.project_id}")

    if sample:
        _print_info("已加载内置样例：GMV、活跃用户、退款率 三个场景")
    elif fail_sample:
        _print_info("已加载失败场景样例：包含负责人缺失和回填失败")


@app.command("import")
def import_data(
    project_id: str = typer.Option(..., "--project", "-p", help="目标项目ID"),
    metrics_file: Optional[Path] = typer.Option(None, "--metrics", "-m", help="新旧指标定义JSON文件"),
    dashboards_file: Optional[Path] = typer.Option(None, "--dashboards", "-d", help="看板关系JSON文件"),
    backfill_file: Optional[Path] = typer.Option(None, "--backfill", "-b", help="回填任务JSON文件"),
    operator: str = typer.Option(..., "--operator", "-o", help="操作者标识"),
):
    """导入数据到项目"""
    if not storage.project_exists(project_id):
        _print_error(f"项目 {project_id} 不存在")
        raise typer.Exit(code=1)

    project = storage.load_project(project_id)

    imported_count = 0

    if metrics_file:
        data = json.loads(metrics_file.read_text())
        from .models import MetricDefinition, MetricChange
        import uuid

        for item in data.get("new_metrics", data if isinstance(data, list) else []):
            if "old" in item and "new" in item:
                old = item["old"]
                new = item["new"]
                old_metric = MetricDefinition(**old) if old else None
                new_metric = MetricDefinition(**new)
                change = MetricChange(
                    change_id=f"chg_{uuid.uuid4().hex[:8]}",
                    old_metric=old_metric,
                    new_metric=new_metric,
                    created_by=operator,
                )
                if old_metric:
                    project.old_metrics[old_metric.metric_id] = old_metric
                project.metrics[new_metric.metric_id] = new_metric
                project.metric_changes[change.change_id] = change
                imported_count += 1
        _print_success(f"已导入 {imported_count} 个指标变更")

    if dashboards_file:
        from .models import Dashboard
        data = json.loads(dashboards_file.read_text())
        for item in data if isinstance(data, list) else data.get("dashboards", []):
            dashboard = Dashboard(**item)
            project.dashboards[dashboard.dashboard_id] = dashboard
            for metric_id in dashboard.metrics:
                for change in project.metric_changes.values():
                    if (change.new_metric.metric_id == metric_id or
                        (change.old_metric and change.old_metric.metric_id == metric_id)):
                        if dashboard.dashboard_id not in change.affected_dashboards:
                            change.affected_dashboards.append(dashboard.dashboard_id)
        _print_success(f"已导入 {len(data if isinstance(data, list) else data.get('dashboards', []))} 个看板")

    if backfill_file:
        from .models import BackfillTask
        data = json.loads(backfill_file.read_text())
        for item in data if isinstance(data, list) else data.get("backfill_tasks", []):
            task = BackfillTask(**item)
            project.backfill_tasks[task.task_id] = task
            for change in project.metric_changes.values():
                if change.new_metric.metric_id == task.metric_id:
                    if task.task_id not in change.backfill_tasks:
                        change.backfill_tasks.append(task.task_id)
        _print_success(f"已导入 {len(data if isinstance(data, list) else data.get('backfill_tasks', []))} 个回填任务")

    storage.save_project(project, operator, "import data")
    _print_success(f"数据已导入到项目 {project_id}")


@app.command("check")
def check_project(
    project_id: str = typer.Option(..., "--project", "-p", help="项目ID"),
    operator: str = typer.Option(..., "--operator", "-o", help="操作者标识"),
):
    """执行规则检查"""
    if not storage.project_exists(project_id):
        _print_error(f"项目 {project_id} 不存在")
        raise typer.Exit(code=1)

    project = storage.load_project(project_id)

    if not project.metric_changes:
        _print_warning("项目中没有待检查的变更")
        return

    _print_status_header(f"正在检查项目: {project.name}")

    results = rule_engine.check_project(project, operator)

    passed = [r for r in results if r.passed]
    failed = [r for r in results if not r.passed]

    console.print(f"\n[bold]检查结果:[/bold]")
    _print_info(f"  通过: {len(passed)} 项")
    if failed:
        _print_warning(f"  问题: {len(failed)} 项")

    for change_id, change in project.metric_changes.items():
        new_status = rule_engine.determine_change_status(change, results)
        update_change_status(project, change_id, new_status, operator, "rule check")

    storage.save_project(project, operator, "run check")

    if failed:
        console.print(f"\n[bold yellow]问题详情:[/bold yellow]")
        for r in failed:
            console.print(f"  [{r.severity}] {r.rule_name}: {r.message}")

    _print_success("检查完成，状态已更新")


@app.command("detail")
def detail(
    project_id: str = typer.Option(..., "--project", "-p", help="项目ID"),
    change_id: Optional[str] = typer.Option(None, "--change", "-c", help="变更ID（可选，不填则列出所有）"),
    show_history: bool = typer.Option(False, "--history", "-H", help="显示历史记录"),
):
    """查看变更详情"""
    if not storage.project_exists(project_id):
        _print_error(f"项目 {project_id} 不存在")
        raise typer.Exit(code=1)

    project = storage.load_project(project_id)

    if not project.metric_changes:
        _print_warning("项目中没有变更记录")
        return

    changes_to_show = []
    if change_id:
        if change_id not in project.metric_changes:
            _print_error(f"变更 {change_id} 不存在")
            raise typer.Exit(code=1)
        changes_to_show.append((change_id, project.metric_changes[change_id]))
    else:
        changes_to_show = list(project.metric_changes.items())

    for cid, change in changes_to_show:
        _print_status_header(f"变更详情: {cid}")
        metric = change.new_metric
        old_metric = change.old_metric

        status_color = {
            "pending": "white",
            "in_progress": "blue",
            "needs_review": "yellow",
            "needs_backfill": "yellow",
            "notify_business": "red",
            "internal_only": "green",
            "checked": "cyan",
            "completed": "green",
            "failed": "red"
        }.get(change.status.value, "white")

        info = [
            f"状态: [{status_color}]{change.status.value}[/{status_color}]",
            f"指标ID: {metric.metric_id}",
            f"指标名称: {metric.name}",
            f"业务负责人: {metric.business_owner or '[bold red]未设置[/bold red]'}",
            f"技术负责人: {metric.tech_owner or '[bold red]未设置[/bold red]'}",
        ]

        if change.renamed_from:
            info.append(f"[bold yellow]重命名自: {change.renamed_from}[/bold yellow]")

        if old_metric:
            info.append(f"\n[bold]新旧对比:[/bold]")
            if old_metric.sql != metric.sql:
                info.append(f"  SQL变更: ✓")
            if old_metric.aggregation != metric.aggregation:
                info.append(f"  聚合方式变更: {old_metric.aggregation} -> {metric.aggregation}")
            if old_metric.filters != metric.filters:
                info.append(f"  过滤条件变更: ✓")

        if change.affected_dashboards:
            info.append(f"\n[bold]影响看板 ({len(change.affected_dashboards)} 个):[/bold]")
            for d_id in change.affected_dashboards:
                dash = project.dashboards.get(d_id)
                if dash:
                    owner = dash.owner or "[bold red]无负责人[/bold red]"
                    info.append(f"  - {dash.name} ({d_id}) | 负责人: {owner}")
                else:
                    info.append(f"  - {d_id}")

        if change.backfill_tasks:
            info.append(f"\n[bold]回填任务 ({len(change.backfill_tasks)} 个):[/bold]")
            for task_id in change.backfill_tasks:
                task = project.backfill_tasks.get(task_id)
                if task:
                    status_color = {
                        "succeeded": "green",
                        "running": "blue",
                        "pending": "white",
                        "failed": "red"
                    }.get(task.status.value, "white")
                    info.append(
                        f"  - {task_id} [{status_color}]{task.status.value}[/{status_color}]"
                        f" | {task.start_date.strftime('%Y-%m-%d')} ~ {task.end_date.strftime('%Y-%m-%d')}"
                    )
                    if task.error_message:
                        info.append(f"    [bold red]错误: {task.error_message}[/bold red]")

        console.print(Panel("\n".join(info), box=box.ROUNDED))

        if show_history and change.history:
            _print_info(f"\n历史记录 ({len(change.history)} 条):")
            for record in change.history:
                console.print(
                    f"  [{record.timestamp.strftime('%H:%M:%S')}] "
                    f"[bold]{record.change_type}[/bold] by {record.operator}"
                )
                if record.before or record.after:
                    before = str(record.before) if record.before else "-"
                    after = str(record.after) if record.after else "-"
                    console.print(f"    {before} -> {after}")
                if record.reason:
                    console.print(f"    原因: {record.reason}")


@app.command("report")
def report(
    project_id: str = typer.Option(..., "--project", "-p", help="项目ID"),
    format: str = typer.Option("text", "--format", "-f", help="输出格式: text/markdown"),
    output: Optional[Path] = typer.Option(None, "--output", "-o", help="输出文件路径"),
):
    """生成报告"""
    if not storage.project_exists(project_id):
        _print_error(f"项目 {project_id} 不存在")
        raise typer.Exit(code=1)

    project = storage.load_project(project_id)

    check_results = []

    summary = report_gen.generate_summary(project, check_results)

    if format == "markdown":
        content = report_gen.generate_markdown_report(project, summary)
    else:
        content = report_gen.generate_text_report(project, summary)

    if output:
        output.write_text(content, encoding='utf-8')
        _print_success(f"报告已写入: {output}")
    else:
        console.print(content)


@app.command("update-status")
def update_status(
    project_id: str = typer.Option(..., "--project", "-p", help="项目ID"),
    change_id: str = typer.Option(..., "--change", "-c", help="变更ID"),
    status: str = typer.Option(..., "--to", "-t", help="目标状态"),
    operator: str = typer.Option(..., "--operator", "-o", help="操作者标识"),
    reason: str = typer.Option("", "--reason", "-r", help="变更原因"),
):
    """更新变更状态（幂等）"""
    if not storage.project_exists(project_id):
        _print_error(f"项目 {project_id} 不存在")
        raise typer.Exit(code=1)

    project = storage.load_project(project_id)

    try:
        target_status = ChangeStatus(status)
    except ValueError:
        valid = ", ".join([s.value for s in ChangeStatus])
        _print_error(f"无效的状态，有效值: {valid}")
        raise typer.Exit(code=1)

    success, message = update_change_status(project, change_id, target_status, operator, reason)

    if success:
        storage.save_project(project, operator, f"update status to {status}")
        _print_success(message)
    else:
        _print_error(message)
        raise typer.Exit(code=1)


@app.command("correct")
def correct(
    project_id: str = typer.Option(..., "--project", "-p", help="项目ID"),
    change_id: str = typer.Option(..., "--change", "-c", help="变更ID"),
    field: str = typer.Option(..., "--field", "-f", help="修正字段"),
    old_value: str = typer.Option(..., "--old", "-o", help="旧值"),
    new_value: str = typer.Option(..., "--new", "-n", help="新值"),
    operator: str = typer.Option(..., "--operator", "-op", help="操作者标识"),
    reason: str = typer.Option(..., "--reason", "-r", help="修正原因"),
):
    """人工修正（记录前后差异）"""
    if not storage.project_exists(project_id):
        _print_error(f"项目 {project_id} 不存在")
        raise typer.Exit(code=1)

    project = storage.load_project(project_id)

    success, message = manual_correction(
        project, change_id, field, old_value, new_value, operator, reason
    )

    if success:
        storage.save_project(project, operator, f"manual correction: {field}")
        _print_success(message)
        _print_info(f"  变更: {old_value} -> {new_value}")
        _print_info(f"  原因: {reason}")
        _print_info(f"  操作者: {operator}")
    else:
        _print_error(message)
        raise typer.Exit(code=1)


@app.command("update-backfill")
def update_backfill(
    project_id: str = typer.Option(..., "--project", "-p", help="项目ID"),
    task_id: str = typer.Option(..., "--task", "-t", help="回填任务ID"),
    status: str = typer.Option(..., "--to", "-s", help="目标状态"),
    operator: str = typer.Option(..., "--operator", "-o", help="操作者标识"),
    error: Optional[str] = typer.Option(None, "--error", "-e", help="错误信息"),
):
    """更新回填任务状态（幂等）"""
    if not storage.project_exists(project_id):
        _print_error(f"项目 {project_id} 不存在")
        raise typer.Exit(code=1)

    project = storage.load_project(project_id)

    if task_id not in project.backfill_tasks:
        _print_error(f"回填任务 {task_id} 不存在")
        raise typer.Exit(code=1)

    try:
        target_status = BackfillStatus(status)
    except ValueError:
        valid = ", ".join([s.value for s in BackfillStatus])
        _print_error(f"无效的状态，有效值: {valid}")
        raise typer.Exit(code=1)

    task = project.backfill_tasks[task_id]

    if task.status == target_status:
        _print_success(f"状态未变更（幂等）: {target_status.value}")
        return

    from .models import ChangeRecord
    from datetime import datetime
    import uuid

    before = {"status": task.status.value}
    task.status = target_status
    after = {"status": target_status.value}

    if error:
        task.error_message = error

    record = ChangeRecord(
        record_id=f"rec_{uuid.uuid4().hex[:8]}",
        timestamp=datetime.now(),
        change_type="backfill_update",
        entity_id=task_id,
        entity_type="backfill_task",
        before=before,
        after=after,
        operator=operator,
        reason=error or f"状态更新: {before['status']} -> {after['status']}"
    )
    project.history.append(record)

    storage.save_project(project, operator, f"update backfill {task_id}")
    _print_success(f"回填任务状态已更新: {before['status']} -> {after['status']}")


if __name__ == "__main__":
    app()
