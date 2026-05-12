import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from .config import ApprovalConfig, FieldConfig, StrategyConfig
from .exporter import ExportEngine
from .storage import Storage

app = typer.Typer(
    name="sensitive-export",
    help="租户数据脱敏导出 CLI 工具 - 支持按策略对敏感数据进行脱敏导出",
    no_args_is_help=True
)

console = Console()
DEFAULT_STORAGE = Path(os.getcwd()) / '.sensitive_export'


def get_storage(storage_path: Optional[str] = None) -> Storage:
    path = Path(storage_path) if storage_path else DEFAULT_STORAGE
    return Storage(str(path))


@app.command()
def import_strategy(
    strategy_file: str = typer.Argument(..., help="策略配置文件路径 (JSON)"),
    storage: Optional[str] = typer.Option(None, "--storage", "-s", help="存储目录路径")
):
    """导入字段脱敏策略配置文件"""
    storage = get_storage(storage)
    
    with open(strategy_file, 'r', encoding='utf-8') as f:
        strategy_data = json.load(f)
    
    strategy = StrategyConfig.model_validate(strategy_data)
    storage.save_strategy(strategy)
    
    table = Table(title=f"策略导入成功", show_header=True)
    table.add_column("项目", style="cyan")
    table.add_column("值", style="green")
    table.add_row("租户ID", strategy.tenant_id)
    table.add_row("数据类型", strategy.data_type)
    table.add_row("版本", strategy.version)
    table.add_row("字段数量", str(len(strategy.fields)))
    
    console.print(table)
    
    fields_table = Table(title="字段配置")
    fields_table.add_column("#", style="dim")
    fields_table.add_column("字段名", style="blue")
    fields_table.add_column("脱敏类型", style="yellow")
    fields_table.add_column("数据分类", style="magenta")
    fields_table.add_column("需审批", style="red")
    
    for idx, field in enumerate(strategy.fields, 1):
        fields_table.add_row(
            str(idx),
            field.name,
            field.mask_type.value,
            field.data_category.value if field.data_category else "-",
            "是" if field.approval_required else "否"
        )
    
    console.print(fields_table)


@app.command()
def create_approval(
    approval_id: str = typer.Argument(..., help="审批号"),
    tenant_id: str = typer.Option(..., "--tenant", "-t", help="租户ID"),
    data_type: str = typer.Option(..., "--data-type", "-d", help="数据类型"),
    fields: str = typer.Option(..., "--fields", "-f", help="批准的字段列表 (逗号分隔)"),
    approved_by: str = typer.Option(..., "--approver", "-a", help="审批人"),
    reason: str = typer.Option(..., "--reason", "-r", help="审批原因"),
    valid_days: int = typer.Option(7, "--days", help="有效期天数"),
    storage: Optional[str] = typer.Option(None, "--storage", "-s", help="存储目录路径")
):
    """创建审批号以允许导出特定敏感字段原值"""
    storage = get_storage(storage)
    
    now = datetime.now()
    expires_at = now + timedelta(days=valid_days)
    
    field_list = [f.strip() for f in fields.split(',') if f.strip()]
    
    approval = ApprovalConfig(
        approval_id=approval_id,
        tenant_id=tenant_id,
        data_type=data_type,
        approved_fields=field_list,
        approved_by=approved_by,
        approved_at=now,
        expires_at=expires_at,
        reason=reason
    )
    
    storage.save_approval(approval)
    
    table = Table(title=f"审批创建成功")
    table.add_column("项目", style="cyan")
    table.add_column("值", style="green")
    table.add_row("审批号", approval_id)
    table.add_row("租户ID", tenant_id)
    table.add_row("数据类型", data_type)
    table.add_row("批准字段", ', '.join(field_list))
    table.add_row("审批人", approved_by)
    table.add_row("有效期至", expires_at.strftime('%Y-%m-%d %H:%M:%S'))
    table.add_row("审批原因", reason)
    
    console.print(table)


@app.command()
def preflight(
    data_file: str = typer.Argument(..., help="数据文件路径 (CSV/JSON)"),
    tenant_id: str = typer.Option(..., "--tenant", "-t", help="租户ID"),
    data_type: str = typer.Option(..., "--data-type", "-d", help="数据类型"),
    strategy_version: Optional[str] = typer.Option(None, "--strategy-version", "-v", help="策略版本"),
    approval_id: Optional[str] = typer.Option(None, "--approval", "-a", help="审批号"),
    storage: Optional[str] = typer.Option(None, "--storage", "-s", help="存储目录路径")
):
    """预检数据文件和策略配置，检查字段匹配和审批有效性"""
    storage = get_storage(storage)
    
    strategy = storage.load_strategy(tenant_id, data_type, strategy_version)
    if not strategy:
        console.print(Panel(f"[red]未找到策略配置: 租户={tenant_id}, 类型={data_type}[/red]"))
        raise typer.Exit(code=1)
    
    approval = None
    if approval_id:
        approval = storage.load_approval(approval_id)
        if not approval:
            console.print(Panel(f"[red]未找到审批号: {approval_id}[/red]"))
            raise typer.Exit(code=1)
    
    engine = ExportEngine(storage)
    result = engine.preflight_check(data_file, strategy, approval)
    
    if result['valid']:
        status = Text("✓ 通过", style="green bold")
    else:
        status = Text("✗ 失败", style="red bold")
    
    console.print(Panel.fit(f"预检结果: {status}"))
    
    if result['issues']:
        console.print("\n[red]错误问题:[/red]")
        for issue in result['issues']:
            console.print(f"  ✗ {issue}")
    
    if result['warnings']:
        console.print("\n[yellow]警告:[/yellow]")
        for warning in result['warnings']:
            console.print(f"  ⚠ {warning}")
    
    if not result['issues']:
        table = Table(title="字段匹配检查")
        table.add_column("字段名", style="blue")
        table.add_column("状态", style="green")
        
        for field in sorted(result['strategy_fields']):
            table.add_row(field, "✓ 匹配")
        
        console.print(table)
    
    if not result['valid']:
        raise typer.Exit(code=1)


@app.command()
def export(
    data_file: str = typer.Argument(..., help="数据文件路径 (CSV/JSON)"),
    tenant_id: str = typer.Option(..., "--tenant", "-t", help="租户ID"),
    data_type: str = typer.Option(..., "--data-type", "-d", help="数据类型"),
    start_date: str = typer.Option(..., "--start", help="起始日期 YYYY-MM-DD"),
    end_date: str = typer.Option(..., "--end", help="结束日期 YYYY-MM-DD"),
    strategy_version: Optional[str] = typer.Option(None, "--strategy-version", "-v", help="策略版本"),
    approval_id: Optional[str] = typer.Option(None, "--approval", "-a", help="审批号"),
    output_format: str = typer.Option("csv", "--format", "-f", help="输出格式: csv/json"),
    skip_duplicate: bool = typer.Option(False, "--skip-duplicate-check", help="跳过重复任务检查"),
    storage: Optional[str] = typer.Option(None, "--storage", "-s", help="存储目录路径")
):
    """执行数据脱敏导出"""
    storage = get_storage(storage)
    
    strategy = storage.load_strategy(tenant_id, data_type, strategy_version)
    if not strategy:
        console.print(Panel(f"[red]未找到策略配置: 租户={tenant_id}, 类型={data_type}[/red]"))
        raise typer.Exit(code=1)
    
    approval = None
    if approval_id:
        approval = storage.load_approval(approval_id)
        if not approval:
            console.print(Panel(f"[red]未找到审批号: {approval_id}[/red]"))
            raise typer.Exit(code=1)
        if not approval.is_valid():
            console.print(Panel(f"[red]审批号已过期: {approval_id}[/red]"))
            raise typer.Exit(code=1)
    
    engine = ExportEngine(storage)
    
    try:
        with console.status("正在处理数据...", spinner="dots"):
            result = engine.export(
                data_file=data_file,
                strategy=strategy,
                tenant_id=tenant_id,
                data_type=data_type,
                start_date=start_date,
                end_date=end_date,
                approval=approval,
                output_format=output_format,
                skip_duplicate_check=skip_duplicate
            )
    except ValueError as e:
        console.print(Panel(f"[red]{e}[/red]"))
        raise typer.Exit(code=1)
    
    task = result.task
    
    summary_table = Table(title=f"导出成功 - 任务ID: {task.task_id}")
    summary_table.add_column("项目", style="cyan")
    summary_table.add_column("值", style="green")
    summary_table.add_row("租户ID", task.tenant_id)
    summary_table.add_row("数据类型", task.data_type)
    summary_table.add_row("时间范围", f"{start_date} 至 {end_date}")
    summary_table.add_row("总记录数", str(task.total_records))
    summary_table.add_row("导出记录数", str(task.total_records - task.rejected_records))
    summary_table.add_row("被遮盖字段次数", str(task.masked_records))
    summary_table.add_row("被拒绝记录数", str(task.rejected_records))
    summary_table.add_row("输出文件", task.output_path or "-")
    
    console.print(summary_table)
    
    if result.masked_fields:
        masked_table = Table(title="被遮盖字段统计")
        masked_table.add_column("字段名", style="blue")
        masked_table.add_column("遮盖次数", style="yellow")
        
        for field, count in sorted(result.masked_fields.items()):
            masked_table.add_row(field, str(count))
        
        console.print(masked_table)
    
    if result.rejected_rows:
        rejected_table = Table(title=f"被拒绝记录 ({len(result.rejected_rows)} 条)")
        rejected_table.add_row("行索引", style="cyan")
        rejected_table.add_row("原因", style="red")
        
        for row in result.rejected_rows[:10]:
            rejected_table.add_row(str(row['row_index']), row['reason'])
        
        if len(result.rejected_rows) > 10:
            console.print(f"\n[yellow]... 还有 {len(result.rejected_rows) - 10} 条拒绝记录[/yellow]")
        
        console.print(rejected_table)
    
    if result.strategy_comparison:
        comp = result.strategy_comparison
        console.print(Panel(f"[yellow]策略已变更 (v{comp['previous_version']} → v{comp['current_version']})[/yellow]"))
        if comp['added_fields']:
            console.print(f"  新增字段: {', '.join(comp['added_fields'])}")
        if comp['removed_fields']:
            console.print(f"  删除字段: {', '.join(comp['removed_fields'])}")
        if comp['modified_fields']:
            console.print("  修改字段:")
            for mod in comp['modified_fields']:
                console.print(f"    - {mod['field']}: {mod['changes']}")
    
    audit_path = storage.audit_dir / f"{task.task_id}_audit.json"
    console.print(f"\n[dim]审计报告已生成: {audit_path}[/dim]")


@app.command("audit-list")
def audit_list(
    tenant_id: Optional[str] = typer.Option(None, "--tenant", "-t", help="按租户筛选"),
    limit: int = typer.Option(20, "--limit", "-n", help="显示条数"),
    storage: Optional[str] = typer.Option(None, "--storage", "-s", help="存储目录路径")
):
    """查看导出审计历史列表"""
    storage = get_storage(storage)
    
    tasks = storage.list_tasks(tenant_id)
    
    if not tasks:
        console.print("[yellow]没有找到导出任务记录[/yellow]")
        return
    
    table = Table(title=f"审计历史 (最近 {min(limit, len(tasks))} 条)")
    table.add_column("任务ID", style="blue")
    table.add_column("租户", style="cyan")
    table.add_column("数据类型", style="magenta")
    table.add_column("状态", style="green")
    table.add_column("记录数", style="yellow")
    table.add_column("创建时间", style="dim")
    
    for task in tasks[:limit]:
        status_style = "green" if task['status'] == 'completed' else "red"
        table.add_row(
            task['task_id'],
            task['tenant_id'],
            task['data_type'],
            f"[{status_style}]{task['status']}[/{status_style}]",
            str(task['total_records']),
            task['created_at']
        )
    
    console.print(table)


@app.command("audit-detail")
def audit_detail(
    task_id: str = typer.Argument(..., help="任务ID"),
    storage: Optional[str] = typer.Option(None, "--storage", "-s", help="存储目录路径")
):
    """查看单个任务的审计详情"""
    storage = get_storage(storage)
    
    report = storage.load_audit_report(task_id)
    if not report:
        console.print(Panel(f"[red]未找到审计报告: {task_id}[/red]"))
        raise typer.Exit(code=1)
    
    summary = report.get('summary', {})
    
    console.print(Panel(f"[bold blue]审计报告 - {task_id}[/bold blue]"))
    
    info_table = Table(title="基本信息")
    info_table.add_column("项目", style="cyan")
    info_table.add_column("值", style="green")
    info_table.add_row("租户ID", report['tenant_id'])
    info_table.add_row("数据类型", report['data_type'])
    info_table.add_row("导出时间", report.get('export_time', '-'))
    info_table.add_row("策略版本", report.get('strategy_version', '-'))
    
    console.print(info_table)
    
    summary_table = Table(title="统计摘要")
    summary_table.add_column("指标", style="cyan")
    summary_table.add_column("数值", style="yellow")
    summary_table.add_row("总记录数", str(summary.get('total_records', 0)))
    summary_table.add_row("导出记录数", str(summary.get('exported_records', 0)))
    summary_table.add_row("遮盖字段次数", str(summary.get('masked_field_count', 0)))
    summary_table.add_row("拒绝记录数", str(summary.get('rejected_records', 0)))
    
    console.print(summary_table)
    
    if report.get('masked_fields'):
        masked_table = Table(title="被遮盖字段详情")
        masked_table.add_column("字段名", style="blue")
        masked_table.add_column("遮盖次数", style="yellow")
        masked_table.add_column("脱敏策略", style="magenta")
        masked_table.add_column("数据分类", style="cyan")
        
        for field_data in report['masked_fields']:
            masked_table.add_row(
                field_data['field_name'],
                str(field_data['mask_count']),
                field_data.get('mask_strategy', '-'),
                field_data.get('data_category', '-')
            )
        
        console.print(masked_table)
    
    if report.get('approval_exceptions'):
        exception_table = Table(title="审批例外字段")
        exception_table.add_column("字段", style="blue")
        exception_table.add_column("审批号", style="yellow")
        exception_table.add_column("审批人", style="cyan")
        exception_table.add_column("原因", style="magenta")
        
        for exc in report['approval_exceptions']:
            exception_table.add_row(
                exc['field'],
                exc['approval_id'],
                exc['approved_by'],
                exc['reason']
            )
        
        console.print(exception_table)
    
    if report.get('rejected_rows'):
        console.print(f"\n[yellow]被拒绝记录: {len(report['rejected_rows'])} 条[/yellow]")
        for row in report['rejected_rows'][:5]:
            console.print(f"  行 {row['row_index']}: {row['reason']}")
        if len(report['rejected_rows']) > 5:
            console.print(f"  ... 还有 {len(report['rejected_rows']) - 5} 条")


@app.command("risk-stats")
def risk_stats(
    task_id: Optional[str] = typer.Option(None, "--task", help="指定任务ID"),
    tenant_id: Optional[str] = typer.Option(None, "--tenant", "-t", help="按租户筛选"),
    storage: Optional[str] = typer.Option(None, "--storage", "-s", help="存储目录路径")
):
    """生成风险统计报告，方便安全同事复核"""
    storage = get_storage(storage)
    
    reports = []
    if task_id:
        report = storage.load_audit_report(task_id)
        if report:
            reports.append(report)
        else:
            console.print(Panel(f"[red]未找到任务: {task_id}[/red]"))
            raise typer.Exit(code=1)
    else:
        tasks = storage.list_tasks(tenant_id)
        for task in tasks:
            report = storage.load_audit_report(task['task_id'])
            if report:
                reports.append(report)
    
    if not reports:
        console.print("[yellow]没有找到审计报告[/yellow]")
        return
    
    total_masked = 0
    total_rejected = 0
    field_stats = {}
    exception_count = 0
    
    for report in reports:
        summary = report.get('summary', {})
        total_masked += summary.get('masked_field_count', 0)
        total_rejected += summary.get('rejected_records', 0)
        
        for field_data in report.get('masked_fields', []):
            field = field_data['field_name']
            if field not in field_stats:
                field_stats[field] = {'count': 0, 'category': field_data.get('data_category', '-')}
            field_stats[field]['count'] += field_data['mask_count']
        
        exception_count += len(report.get('approval_exceptions', []))
    
    console.print(Panel(f"[bold red]风险统计报告[/bold red]"))
    
    summary_table = Table(title="总体风险统计")
    summary_table.add_column("指标", style="cyan")
    summary_table.add_column("数值", style="yellow")
    summary_table.add_row("分析任务数", str(len(reports)))
    summary_table.add_row("总遮盖次数", str(total_masked))
    summary_table.add_row("总拒绝记录", str(total_rejected))
    summary_table.add_row("审批例外次数", str(exception_count))
    
    console.print(summary_table)
    
    if field_stats:
        field_table = Table(title="字段风险排行")
        field_table.add_column("字段", style="blue")
        field_table.add_column("数据分类", style="magenta")
        field_table.add_column("遮盖次数", style="yellow")
        
        sorted_fields = sorted(field_stats.items(), key=lambda x: x[1]['count'], reverse=True)
        for field, stats in sorted_fields:
            field_table.add_row(field, stats['category'], str(stats['count']))
        
        console.print(field_table)
    
    console.print("\n[dim]安全复核建议:[/dim]")
    if exception_count > 0:
        console.print("[yellow]  ⚠ 存在审批例外字段，请审核审批原因是否合理[/yellow]")
    if total_rejected > 0:
        console.print("[yellow]  ⚠ 存在被拒绝记录，请确认是否需要补充审批[/yellow]")


@app.command()
def demo(
    storage: Optional[str] = typer.Option(None, "--storage", "-s", help="存储目录路径")
):
    """运行完整演示流程"""
    from pathlib import Path
    from datetime import datetime, timedelta
    
    demo_dir = Path(os.path.dirname(__file__)) / '..' / 'demo'
    if not demo_dir.exists():
        console.print(Panel("[red]演示文件不存在，请先创建 demo 目录[/red]"))
        raise typer.Exit(code=1)
    
    console.print(Panel("[bold blue]=== 租户数据脱敏导出 CLI 完整演示 ===[/bold blue]"))
    
    s = get_storage(storage)
    engine = ExportEngine(s)
    
    console.print("\n[bold green]步骤 1: 导入策略配置[/bold green]")
    strategy_file = demo_dir / 'strategy_orders.json'
    with open(strategy_file, 'r', encoding='utf-8') as f:
        strategy_data = json.load(f)
    strategy = StrategyConfig.model_validate(strategy_data)
    s.save_strategy(strategy)
    
    table = Table(title=f"策略导入成功", show_header=True)
    table.add_column("项目", style="cyan")
    table.add_column("值", style="green")
    table.add_row("租户ID", strategy.tenant_id)
    table.add_row("数据类型", strategy.data_type)
    table.add_row("版本", strategy.version)
    table.add_row("字段数量", str(len(strategy.fields)))
    console.print(table)
    
    console.print("\n[bold green]步骤 2: 创建审批号[/bold green]")
    now = datetime.now()
    expires_at = now + timedelta(days=7)
    approval = ApprovalConfig(
        approval_id="APPR-2024-001",
        tenant_id="tenant001",
        data_type="orders",
        approved_fields=["id_card", "bank_card"],
        approved_by="sec_officer_zhang",
        approved_at=now,
        expires_at=expires_at,
        reason="客户投诉排查，需查看银行卡号核实退款"
    )
    s.save_approval(approval)
    
    appr_table = Table(title=f"审批创建成功")
    appr_table.add_column("项目", style="cyan")
    appr_table.add_column("值", style="green")
    appr_table.add_row("审批号", "APPR-2024-001")
    appr_table.add_row("批准字段", "id_card, bank_card")
    appr_table.add_row("审批人", "sec_officer_zhang")
    appr_table.add_row("有效期至", expires_at.strftime('%Y-%m-%d %H:%M:%S'))
    console.print(appr_table)
    
    console.print("\n[bold green]步骤 3: 预检检查[/bold green]")
    data_file = demo_dir / 'sample_orders.csv'
    preflight_result = engine.preflight_check(str(data_file), strategy, approval)
    
    if preflight_result['valid']:
        console.print(Panel.fit("预检结果: [green]✓ 通过[/green]"))
        fields_table = Table(title="字段匹配检查")
        fields_table.add_column("字段名", style="blue")
        fields_table.add_column("状态", style="green")
        for field in sorted(preflight_result['strategy_fields']):
            fields_table.add_row(field, "✓ 匹配")
        console.print(fields_table)
    else:
        console.print(Panel.fit("预检结果: [red]✗ 失败[/red]"))
        for issue in preflight_result['issues']:
            console.print(f"[red]  ✗ {issue}[/red]")
        raise typer.Exit(code=1)
    
    console.print("\n[bold green]步骤 4: 执行脱敏导出[/bold green]")
    try:
        with console.status("正在处理数据...", spinner="dots"):
            result = engine.export(
                data_file=str(data_file),
                strategy=strategy,
                tenant_id="tenant001",
                data_type="orders",
                start_date="2024-01-01",
                end_date="2024-12-31",
                approval=approval,
                output_format="csv",
                skip_duplicate_check=False
            )
    except ValueError as e:
        console.print(Panel(f"[red]{e}[/red]"))
        raise typer.Exit(code=1)
    
    task = result.task
    summary_table = Table(title=f"导出成功 - 任务ID: {task.task_id}")
    summary_table.add_column("项目", style="cyan")
    summary_table.add_column("值", style="green")
    summary_table.add_row("总记录数", str(task.total_records))
    summary_table.add_row("导出记录数", str(task.total_records - task.rejected_records))
    summary_table.add_row("被遮盖字段次数", str(task.masked_records))
    summary_table.add_row("被拒绝记录数", str(task.rejected_records))
    summary_table.add_row("输出文件", task.output_path or "-")
    console.print(summary_table)
    
    if result.masked_fields:
        masked_table = Table(title="被遮盖字段统计")
        masked_table.add_column("字段名", style="blue")
        masked_table.add_column("遮盖次数", style="yellow")
        for field, count in sorted(result.masked_fields.items()):
            masked_table.add_row(field, str(count))
        console.print(masked_table)
    
    console.print("\n[bold green]步骤 5: 查看审计历史[/bold green]")
    tasks = s.list_tasks("tenant001")
    if tasks:
        audit_table = Table(title=f"审计历史 (最近 {len(tasks)} 条)")
        audit_table.add_column("任务ID", style="blue")
        audit_table.add_column("数据类型", style="magenta")
        audit_table.add_column("状态", style="green")
        audit_table.add_column("记录数", style="yellow")
        for t in tasks:
            status_style = "green" if t['status'] == 'completed' else "red"
            audit_table.add_row(
                t['task_id'],
                t['data_type'],
                f"[{status_style}]{t['status']}[/{status_style}]",
                str(t['total_records'])
            )
        console.print(audit_table)
    
    console.print("\n[bold green]步骤 6: 生成风险统计[/bold green]")
    reports = []
    for t in s.list_tasks("tenant001"):
        report = s.load_audit_report(t['task_id'])
        if report:
            reports.append(report)
    
    if reports:
        total_masked = sum(r.get('summary', {}).get('masked_field_count', 0) for r in reports)
        total_rejected = sum(r.get('summary', {}).get('rejected_records', 0) for r in reports)
        
        risk_table = Table(title="风险统计报告")
        risk_table.add_column("指标", style="cyan")
        risk_table.add_column("数值", style="yellow")
        risk_table.add_row("分析任务数", str(len(reports)))
        risk_table.add_row("总遮盖次数", str(total_masked))
        risk_table.add_row("总拒绝记录", str(total_rejected))
        console.print(risk_table)
    
    console.print(Panel("[bold green]=== 演示流程完成 ===[/bold green]"))


if __name__ == "__main__":
    app()
