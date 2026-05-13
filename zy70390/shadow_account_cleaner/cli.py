"""CLI 命令行接口"""
import json
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import List, Optional

import click
from rich.console import Console
from rich.table import Table

from .config import create_default_config, load_config
from .data_loader import DataLoader
from .history_manager import HistoryManager
from .matcher import Matcher
from .models import DisablePlan, OwnerMark, RiskAssessment
from .risk_assessor import RiskAssessor

console = Console()


@click.group()
@click.option('--config', '-c', type=click.Path(exists=False), help='配置文件路径')
@click.pass_context
def cli(ctx: click.Context, config: Optional[str]):
    """影子账号清理 CLI - 识别和清理影子账号"""
    ctx.ensure_object(dict)
    ctx.obj['config'] = load_config(config)


@cli.command()
def init():
    """初始化项目配置和目录结构"""
    config_path = Path("shadow_account_cleaner.yaml")
    if not config_path.exists():
        create_default_config(str(config_path))
        console.print(f"[green]✓[/green] 已创建配置文件: {config_path}")
    else:
        console.print(f"[yellow]⚠[/yellow] 配置文件已存在: {config_path}")
    
    data_dir = Path("data")
    data_dir.mkdir(exist_ok=True)
    console.print(f"[green]✓[/green] 数据目录: {data_dir}")
    
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    console.print(f"[green]✓[/green] 输出目录: {output_dir}")
    
    console.print("\n[bold]请将以下数据文件放入 data 目录:[/bold]")
    console.print("  - employees.yaml/json: HR 员工数据")
    console.print("  - accounts.yaml/json: 各系统账号清单")
    console.print("  - permissions.yaml/json: 权限列表")


@cli.command()
@click.option('--output', '-o', type=click.Path(), help='输出文件路径 (JSON)')
@click.option('--account-id', help='只匹配指定账号ID')
@click.pass_context
def match(ctx: click.Context, output: Optional[str], account_id: Optional[str]):
    """匹配账号与HR员工数据"""
    config = ctx.obj['config']
    loader = DataLoader(config.data_directory)
    
    employees = loader.load_employees()
    accounts = loader.load_accounts()
    
    if not employees:
        console.print("[red]✗[/red] 未找到员工数据")
        return
    
    if not accounts:
        console.print("[red]✗[/red] 未找到账号数据")
        return
    
    console.print(f"加载 {len(employees)} 名员工，{len(accounts)} 个账号")
    
    matcher = Matcher(employees, accounts)
    
    if account_id:
        matches = matcher.get_account_matches(account_id)
    else:
        matches = matcher.match_all()
    
    table = Table(title=f"匹配结果 ({len(matches)} 条)")
    table.add_column("账号ID", style="cyan")
    table.add_column("系统", style="magenta")
    table.add_column("员工号", style="green")
    table.add_column("员工姓名")
    table.add_column("置信度", justify="right")
    table.add_column("匹配方法")
    table.add_column("证据", style="dim")
    
    matched_account_ids = set()
    for m in matches:
        if m.employee_id:
            employee = next((e for e in employees if e.employee_id == m.employee_id), None)
            emp_name = employee.name if employee else "未知"
        else:
            emp_name = "-"
        
        confidence_color = "green" if m.confidence >= 0.8 else "yellow" if m.confidence >= 0.6 else "red"
        table.add_row(
            m.account_id,
            next((a.system for a in accounts if a.account_id == m.account_id), "-"),
            m.employee_id or "-",
            emp_name,
            f"[{confidence_color}]{m.confidence:.0%}[/{confidence_color}]",
            m.match_method,
            ', '.join(f"{k}={v}" for k, v in m.evidence.items())
        )
        matched_account_ids.add(m.account_id)
    
    console.print(table)
    
    # 显示未匹配的账号
    unmatched = [a for a in accounts if a.account_id not in matched_account_ids and not a.is_service_account]
    if unmatched:
        console.print(f"\n[yellow]⚠[/yellow] {len(unmatched)} 个账号未匹配到任何员工:")
        for a in unmatched[:10]:
            console.print(f"  - {a.account_id} ({a.system}): {a.username}")
        if len(unmatched) > 10:
            console.print(f"  ... 还有 {len(unmatched) - 10} 个")
    
    # 输出到文件
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            json.dump([m.dict() for m in matches], f, ensure_ascii=False, indent=2, default=str)
        console.print(f"\n[green]✓[/green] 结果已保存到: {output}")


@cli.command()
@click.option('--output', '-o', type=click.Path(), help='输出文件路径 (JSON)')
@click.option('--risk-level', type=click.Choice(['high', 'medium', 'low']), help='只显示指定风险等级')
@click.pass_context
def risk(ctx: click.Context, output: Optional[str], risk_level: Optional[str]):
    """评估账号风险"""
    config = ctx.obj['config']
    loader = DataLoader(config.data_directory)
    history = HistoryManager(config.history_file)
    
    employees = loader.load_employees()
    accounts = loader.load_accounts()
    permissions = loader.load_permissions()
    owner_marks = history.get_owner_marks()
    disable_plans = history.get_disable_plans()
    
    if not accounts:
        console.print("[red]✗[/red] 未找到账号数据")
        return
    
    console.print(f"加载 {len(employees)} 名员工，{len(accounts)} 个账号，{len(permissions)} 条权限")
    
    matcher = Matcher(employees, accounts)
    matches = matcher.match_all()
    
    assessor = RiskAssessor(config)
    risks = assessor.assess_all(
        accounts, employees, matches, permissions,
        owner_marks, disable_plans
    )
    
    if risk_level:
        risks = [r for r in risks if r.risk_level == risk_level]
    
    if not risks:
        console.print("[green]✓[/green] 未发现风险账号")
        return
    
    # 统计
    high_count = sum(1 for r in risks if r.risk_level == 'high')
    medium_count = sum(1 for r in risks if r.risk_level == 'medium')
    low_count = sum(1 for r in risks if r.risk_level == 'low')
    
    console.print(f"\n[bold]风险统计:[/bold] 高风险={high_count}, 中风险={medium_count}, 低风险={low_count}")
    
    table = Table(title=f"风险评估结果 ({len(risks)} 条)")
    table.add_column("账号ID", style="cyan")
    table.add_column("系统", style="magenta")
    table.add_column("风险等级", style="bold")
    table.add_column("风险类型")
    table.add_column("描述")
    table.add_column("建议动作")
    table.add_column("分数", justify="right")
    
    risk_type_cn = {
        'terminated_employee': '离职未禁用',
        'transferred_stale': '转岗残留高权限',
        'unclaimed': '无人认领',
        'duplicate': '重复账号',
        'service_account_expired': '服务账号豁免过期',
    }
    
    for r in risks:
        level_style = {
            'high': '[bold red]高[/bold red]',
            'medium': '[bold yellow]中[/bold yellow]',
            'low': '[bold green]低[/bold green]',
        }[r.risk_level]
        
        table.add_row(
            r.account_id,
            next((a.system for a in accounts if a.account_id == r.account_id), "-"),
            level_style,
            risk_type_cn.get(r.risk_type, r.risk_type),
            r.description,
            r.recommended_action,
            f"{r.score:.0%}"
        )
    
    console.print(table)
    
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            json.dump([r.dict() for r in risks], f, ensure_ascii=False, indent=2, default=str)
        console.print(f"\n[green]✓[/green] 结果已保存到: {output}")


@cli.command()
@click.argument('account_id')
@click.option('--owner', '-o', help='认领人员工号 (留空表示标记为无人认领)')
@click.option('--reason', '-r', required=True, help='认领原因/备注')
@click.option('--by', '-b', required=True, help='操作人')
@click.option('--exemption', is_flag=True, help='是否为豁免（服务账号）')
@click.option('--exemption-days', type=int, default=90, help='豁免天数（默认90天）')
@click.pass_context
def mark_owner(
    ctx: click.Context,
    account_id: str,
    owner: Optional[str],
    reason: str,
    by: str,
    exemption: bool,
    exemption_days: int
):
    """人工标记账号归属（认领/豁免）"""
    config = ctx.obj['config']
    history = HistoryManager(config.history_file)
    
    if exemption:
        expiry_date = date.today() + timedelta(days=exemption_days)
        mark = OwnerMark(
            account_id=account_id,
            owner_employee_id=owner,
            marked_by=by,
            reason=reason,
            is_exemption=True,
            exemption_expiry=expiry_date
        )
        console.print(f"[green]✓[/green] 账号 {account_id} 已豁免至 {expiry_date}")
    else:
        mark = OwnerMark(
            account_id=account_id,
            owner_employee_id=owner,
            marked_by=by,
            reason=reason,
            is_exemption=False
        )
        if owner:
            console.print(f"[green]✓[/green] 账号 {account_id} 已认领给员工 {owner}")
        else:
            console.print(f"[green]✓[/green] 账号 {account_id} 已标记为无人认领")
    
    history.add_owner_mark(mark)
    console.print(f"[dim]操作人: {by}, 原因: {reason}[/dim]")


@cli.command('history')
@click.option('--account-id', help='只显示指定账号的历史')
@click.pass_context
def show_history(ctx: click.Context, account_id: Optional[str]):
    """查看人工认领历史记录"""
    config = ctx.obj['config']
    history = HistoryManager(config.history_file)
    
    marks = history.get_owner_marks(account_id)
    
    if not marks:
        console.print("[yellow]ℹ[/yellow] 暂无认领历史记录")
        return
    
    table = Table(title="认领历史记录")
    table.add_column("账号ID", style="cyan")
    table.add_column("归属员工")
    table.add_column("操作人")
    table.add_column("操作时间", style="dim")
    table.add_column("类型")
    table.add_column("到期时间")
    table.add_column("原因")
    
    for mark in marks:
        mark_type = "[yellow]豁免[/yellow]" if mark.is_exemption else "[green]认领[/green]"
        expiry = str(mark.exemption_expiry) if mark.exemption_expiry else "-"
        table.add_row(
            mark.account_id,
            mark.owner_employee_id or "-",
            mark.marked_by,
            mark.marked_at.strftime('%Y-%m-%d %H:%M'),
            mark_type,
            expiry,
            mark.reason
        )
    
    console.print(table)


@cli.command('plan-disable')
@click.argument('account_id')
@click.option('--days', type=int, default=7, help='计划禁用天数（默认7天后）')
@click.option('--reason', '-r', required=True, help='禁用原因')
@click.option('--by', '-b', required=True, help='操作人')
@click.pass_context
def plan_disable(
    ctx: click.Context,
    account_id: str,
    days: int,
    reason: str,
    by: str
):
    """创建账号禁用计划"""
    config = ctx.obj['config']
    history = HistoryManager(config.history_file)
    
    planned_date = date.today() + timedelta(days=days)
    plan = DisablePlan(
        account_id=account_id,
        planned_date=planned_date,
        created_by=by,
        reason=reason,
        status='pending'
    )
    
    history.add_disable_plan(plan)
    console.print(f"[green]✓[/green] 账号 {account_id} 已计划于 {planned_date} 禁用")
    console.print(f"[dim]操作人: {by}, 原因: {reason}[/dim]")


@cli.command('plans')
@click.option('--status', type=click.Choice(['pending', 'executed', 'cancelled', 'expired']), help='按状态筛选')
@click.pass_context
def list_plans(ctx: click.Context, status: Optional[str]):
    """查看禁用计划列表"""
    config = ctx.obj['config']
    history = HistoryManager(config.history_file)
    
    plans = history.get_disable_plans(status=status)
    
    if not plans:
        console.print("[yellow]ℹ[/yellow] 暂无禁用计划")
        return
    
    today = date.today()
    table = Table(title="禁用计划列表")
    table.add_column("#", style="dim")
    table.add_column("账号ID", style="cyan")
    table.add_column("计划日期")
    table.add_column("状态", style="bold")
    table.add_column("创建人")
    table.add_column("创建时间", style="dim")
    table.add_column("原因")
    
    for idx, plan in enumerate(plans):
        status_style = {
            'pending': '[yellow]待执行[/yellow]',
            'executed': '[green]已执行[/green]',
            'cancelled': '[dim]已取消[/dim]',
            'expired': '[red]已过期[/red]',
        }.get(plan.status, plan.status)
        
        if plan.status == 'pending' and plan.planned_date < today:
            status_style = '[red]已过期[/red]'
        
        table.add_row(
            str(idx),
            plan.account_id,
            str(plan.planned_date),
            status_style,
            plan.created_by,
            plan.created_at.strftime('%Y-%m-%d %H:%M'),
            plan.reason
        )
    
    console.print(table)


@cli.command()
@click.option('--output', '-o', type=click.Path(), required=True, help='输出报告路径 (JSON/HTML)')
@click.option('--format', '-f', type=click.Choice(['json', 'html']), default='json', help='报告格式')
@click.pass_context
def report(ctx: click.Context, output: str, format: str):
    """生成完整的清理报告"""
    config = ctx.obj['config']
    loader = DataLoader(config.data_directory)
    history = HistoryManager(config.history_file)
    
    employees = loader.load_employees()
    accounts = loader.load_accounts()
    permissions = loader.load_permissions()
    owner_marks = history.get_owner_marks()
    disable_plans = history.get_disable_plans()
    
    console.print("正在生成报告...")
    
    # 匹配
    matcher = Matcher(employees, accounts)
    matches = matcher.match_all()
    
    # 风险评估
    assessor = RiskAssessor(config)
    risks = assessor.assess_all(
        accounts, employees, matches, permissions,
        owner_marks, disable_plans
    )
    
    # 统计
    summary = {
        'total_employees': len(employees),
        'total_accounts': len(accounts),
        'active_accounts': sum(1 for a in accounts if a.status == 'active'),
        'disabled_accounts': sum(1 for a in accounts if a.status == 'disabled'),
        'service_accounts': sum(1 for a in accounts if a.is_service_account),
        'matched_accounts': len(set(m.account_id for m in matches if m.employee_id and not m.is_ambiguous)),
        'unmatched_accounts': len(set(a.account_id for a in accounts if not any(m.account_id == a.account_id for m in matches) and not a.is_service_account)),
        'high_risk': sum(1 for r in risks if r.risk_level == 'high'),
        'medium_risk': sum(1 for r in risks if r.risk_level == 'medium'),
        'low_risk': sum(1 for r in risks if r.risk_level == 'low'),
        'pending_plans': sum(1 for p in disable_plans if p.status == 'pending'),
        'total_risks': len(risks),
    }
    
    if format == 'json':
        report_data = {
            'generated_at': datetime.now().isoformat(),
            'summary': summary,
            'risks': [r.dict() for r in risks],
            'matches': [m.dict() for m in matches],
            'owner_marks': [m.dict() for m in owner_marks],
            'disable_plans': [p.dict() for p in disable_plans],
        }
        
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2, default=str)
    else:
        # HTML 格式
        html = _generate_html_report(summary, risks, matches, owner_marks, disable_plans, accounts)
        with open(output, 'w', encoding='utf-8') as f:
            f.write(html)
    
    # 显示统计摘要
    console.print("\n[bold]报告摘要:[/bold]")
    for key, value in summary.items():
        console.print(f"  {key}: {value}")
    
    console.print(f"\n[green]✓[/green] 报告已保存到: {output}")


def _generate_html_report(
    summary: dict,
    risks: List[RiskAssessment],
    matches: list,
    owner_marks: list,
    disable_plans: list,
    accounts: list
) -> str:
    """生成HTML报告"""
    risk_level_colors = {
        'high': '#dc2626',
        'medium': '#d97706',
        'low': '#059669',
    }
    risk_type_cn = {
        'terminated_employee': '离职员工账号未禁用',
        'transferred_stale': '转岗员工残留高权限',
        'unclaimed': '无人认领账号',
        'duplicate': '重复账号',
        'service_account_expired': '服务账号豁免过期',
    }
    
    risks_html = ""
    for r in risks:
        color = risk_level_colors.get(r.risk_level, '#6b7280')
        level_cn = {'high': '高风险', 'medium': '中风险', 'low': '低风险'}[r.risk_level]
        risks_html += f"""
        <tr>
            <td style="border: 1px solid #e5e7eb; padding: 8px;">{r.account_id}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; color: {color}; font-weight: bold;">{level_cn}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px;">{risk_type_cn.get(r.risk_type, r.risk_type)}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px;">{r.description}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px;">{r.recommended_action}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px;">{r.score:.0%}</td>
        </tr>
        """
    
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>影子账号清理报告 - {datetime.now().strftime('%Y-%m-%d')}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; max-width: 1400px; }}
        h1 {{ color: #1f2937; }}
        h2 {{ color: #374151; margin-top: 40px; }}
        .summary {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }}
        .summary-card {{ background: #f9fafb; border-radius: 8px; padding: 20px; }}
        .summary-card .label {{ color: #6b7280; font-size: 14px; }}
        .summary-card .value {{ font-size: 28px; font-weight: bold; color: #1f2937; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
        th {{ background: #f3f4f6; padding: 12px 8px; text-align: left; border: 1px solid #e5e7eb; }}
        td {{ border: 1px solid #e5e7eb; padding: 8px; }}
        .timestamp {{ color: #6b7280; font-size: 14px; }}
    </style>
</head>
<body>
    <h1>影子账号清理报告</h1>
    <p class="timestamp">生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
    
    <h2>统计摘要</h2>
    <div class="summary">
        <div class="summary-card"><div class="label">员工总数</div><div class="value">{summary['total_employees']}</div></div>
        <div class="summary-card"><div class="label">账号总数</div><div class="value">{summary['total_accounts']}</div></div>
        <div class="summary-card"><div class="label">活跃账号</div><div class="value">{summary['active_accounts']}</div></div>
        <div class="summary-card"><div class="label">已匹配</div><div class="value">{summary['matched_accounts']}</div></div>
        <div class="summary-card"><div class="label">未匹配</div><div class="value">{summary['unmatched_accounts']}</div></div>
        <div class="summary-card"><div class="label">高风险</div><div class="value" style="color: #dc2626;">{summary['high_risk']}</div></div>
        <div class="summary-card"><div class="label">中风险</div><div class="value" style="color: #d97706;">{summary['medium_risk']}</div></div>
        <div class="summary-card"><div class="label">待执行计划</div><div class="value">{summary['pending_plans']}</div></div>
    </div>
    
    <h2>风险账号列表</h2>
    <table>
        <thead>
            <tr>
                <th>账号ID</th>
                <th>风险等级</th>
                <th>风险类型</th>
                <th>描述</th>
                <th>建议动作</th>
                <th>风险分数</th>
            </tr>
        </thead>
        <tbody>
            {risks_html or '<tr><td colspan="6" style="text-align: center; padding: 20px;">暂无风险账号</td></tr>'}
        </tbody>
    </table>
</body>
</html>
"""


if __name__ == '__main__':
    cli()
