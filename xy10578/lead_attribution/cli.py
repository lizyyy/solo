import os
import sys
import json
import click
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

from .database import DatabaseManager
from .data_importer import DataImporter
from .attribution_engine import AttributionEngine
from .models import AttributionType, SourceType

console = Console()


def get_db():
    return DatabaseManager()


@click.group()
@click.option('--db', 'db_path', help='数据库路径', default=None)
@click.pass_context
def cli(ctx, db_path):
    """销售线索来源归因 CLI 工具"""
    ctx.ensure_object(dict)
    if db_path:
        os.environ['LEAD_ATTRIBUTION_DB'] = db_path
    ctx.obj['db'] = get_db()


@cli.command()
@click.option('--force', is_flag=True, help='强制重新初始化（清空现有数据）')
@click.pass_context
def init(ctx, force):
    """初始化数据库"""
    db = ctx.obj['db']
    
    if force and os.path.exists(db.db_path):
        os.remove(db.db_path)
        console.print(f"[yellow]已删除旧数据库: {db.db_path}[/yellow]")
    
    db.init_database()
    console.print(Panel.fit(
        f"[green]数据库初始化成功！[/green]\n"
        f"数据库路径: [cyan]{db.db_path}[/cyan]",
        title="初始化完成",
        border_style="green"
    ))


@cli.group('import')
def import_group():
    """导入数据"""
    pass


@import_group.command('ads')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--operator', default='system', help='操作人')
@click.pass_context
def import_ads(ctx, file_path, operator):
    """导入广告点击数据"""
    db = ctx.obj['db']
    importer = DataImporter(db)
    
    console.print(f"[cyan]正在导入广告点击数据: {file_path}[/cyan]")
    session = importer.import_ad_clicks(file_path, operator)
    
    _display_import_session(session)


@import_group.command('events')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--operator', default='system', help='操作人')
@click.pass_context
def import_events(ctx, file_path, operator):
    """导入活动签到数据"""
    db = ctx.obj['db']
    importer = DataImporter(db)
    
    console.print(f"[cyan]正在导入活动签到数据: {file_path}[/cyan]")
    session = importer.import_event_attendances(file_path, operator)
    
    _display_import_session(session)


@import_group.command('referrals')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--operator', default='system', help='操作人')
@click.pass_context
def import_referrals(ctx, file_path, operator):
    """导入转介绍数据"""
    db = ctx.obj['db']
    importer = DataImporter(db)
    
    console.print(f"[cyan]正在导入转介绍数据: {file_path}[/cyan]")
    session = importer.import_referrals(file_path, operator)
    
    _display_import_session(session)


@import_group.command('deals')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--operator', default='system', help='操作人')
@click.pass_context
def import_deals(ctx, file_path, operator):
    """导入成交订单数据"""
    db = ctx.obj['db']
    importer = DataImporter(db)
    
    console.print(f"[cyan]正在导入成交订单数据: {file_path}[/cyan]")
    session = importer.import_deals(file_path, operator)
    
    _display_import_session(session)


@import_group.command('leads')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--operator', default='system', help='操作人')
@click.pass_context
def import_leads(ctx, file_path, operator):
    """导入线索数据"""
    db = ctx.obj['db']
    importer = DataImporter(db)
    
    console.print(f"[cyan]正在导入线索数据: {file_path}[/cyan]")
    session = importer.import_leads(file_path, operator)
    
    _display_import_session(session)


def _display_import_session(session):
    status_color = {
        'success': 'green',
        'partial': 'yellow',
        'failed': 'red',
        'pending': 'blue'
    }.get(session.status.value, 'white')
    
    table = Table(title="导入结果", box=box.SIMPLE)
    table.add_column("指标", style="cyan")
    table.add_column("值")
    
    table.add_row("导入ID", session.id)
    table.add_row("源类型", session.source_type)
    table.add_row("文件路径", session.file_path)
    table.add_row("状态", f"[{status_color}]{session.status.value.upper()}[/{status_color}]")
    table.add_row("总记录数", str(session.total_records))
    table.add_row("成功", f"[green]{session.success_count}[/green]")
    table.add_row("失败", f"[red]{session.failed_count}[/red]")
    table.add_row("重复", f"[yellow]{session.duplicate_count}[/yellow]")
    table.add_row("黑名单", f"[magenta]{session.blacklisted_count}[/magenta]")
    
    if session.error_message:
        table.add_row("错误信息", f"[red]{session.error_message}[/red]")
    
    console.print(table)


@cli.command()
@click.pass_context
def check(ctx):
    """检查数据一致性"""
    db = ctx.obj['db']
    importer = DataImporter(db)
    
    console.print("[cyan]正在检查数据一致性...[/cyan]")
    result = importer.check_data_consistency()
    
    table = Table(title="数据一致性检查", box=box.SIMPLE)
    table.add_column("指标", style="cyan")
    table.add_column("值")
    
    table.add_row("总订单数", str(result['total_deals']))
    table.add_row("总归因数", str(result['total_attributions']))
    table.add_row("发现问题", f"[{'green' if result['issues_found'] == 0 else 'red'}]{result['issues_found']}[/{'green' if result['issues_found'] == 0 else 'red'}]")
    
    console.print(table)
    
    if result['issues']:
        console.print("\n[red]发现以下问题:[/red]")
        for issue in result['issues']:
            console.print(f"  - [{issue['type']}] {issue['message']}")


@cli.command()
@click.argument('deal_id')
@click.pass_context
def detail(ctx, deal_id):
    """查看订单详情和归因结果"""
    db = ctx.obj['db']
    
    deal = db.get_deal_by_id(deal_id)
    if not deal:
        console.print(f"[red]订单不存在: {deal_id}[/red]")
        return
    
    customer = db.get_customer_by_id(deal.customer_id)
    attributions = db.get_attributions_by_deal(deal_id)
    touch_points = db.get_customer_touch_points(customer.id, deal.close_time)
    follow_ups = db.get_sales_follow_ups(deal_id=deal_id)
    audit_logs = db.get_audit_logs(record_type='attribution')
    
    console.print(Panel.fit(
        f"[cyan]订单信息[/cyan]\n"
        f"订单ID: {deal.id}\n"
        f"订单名称: {deal.deal_name}\n"
        f"金额: [green]¥{deal.amount:,.2f}[/green]\n"
        f"成交时间: {deal.close_time}\n"
        f"销售人员: {deal.salesperson or '-'}\n\n"
        f"[cyan]客户信息[/cyan]\n"
        f"客户名称: {customer.name}\n"
        f"客户类型: {customer.customer_type.value}\n"
        f"邮箱: {customer.email or '-'}\n"
        f"电话: {customer.phone or '-'}\n"
        f"公司: {customer.company_name or '-'}",
        title="订单详情",
        border_style="cyan"
    ))
    
    if touch_points:
        tp_table = Table(title="触点历史（按时间排序）", box=box.SIMPLE)
        tp_table.add_column("#", style="dim")
        tp_table.add_column("时间")
        tp_table.add_column("来源类型")
        tp_table.add_column("来源详情")
        tp_table.add_column("记录类型")
        
        for i, tp in enumerate(touch_points, 1):
            details = ', '.join([f"{k}: {v}" for k, v in tp['source_details'].items() if v])
            tp_table.add_row(
                str(i),
                tp['touch_time'].strftime('%Y-%m-%d %H:%M:%S'),
                tp['source_type'].value,
                details or '-',
                tp['record_type']
            )
        console.print(tp_table)
    
    if attributions:
        attr_by_type = {}
        for attr in attributions:
            t = attr.attribution_type.value
            if t not in attr_by_type:
                attr_by_type[t] = []
            attr_by_type[t].append(attr)
        
        for attr_type, attrs in attr_by_type.items():
            type_name = {
                'first_touch': '首触达归因',
                'last_touch': '末触达归因',
                'weighted': '加权归因'
            }.get(attr_type, attr_type)
            
            a_table = Table(title=f"{type_name}", box=box.SIMPLE)
            a_table.add_column("来源类型")
            a_table.add_column("占比")
            a_table.add_column("金额")
            a_table.add_column("是否人工")
            a_table.add_column("操作人")
            
            for attr in attrs:
                a_table.add_row(
                    attr.source_type.value,
                    f"{attr.percentage:.1f}%",
                    f"¥{attr.amount:,.2f}",
                    "[red]是[/red]" if attr.is_manual else "否",
                    attr.operator or '-'
                )
            console.print(a_table)
    
    if follow_ups:
        fu_table = Table(title="销售跟进记录", box=box.SIMPLE)
        fu_table.add_column("时间")
        fu_table.add_column("销售人员")
        fu_table.add_column("状态")
        fu_table.add_column("备注")
        
        for fu in follow_ups:
            fu_table.add_row(
                fu.follow_up_time.strftime('%Y-%m-%d %H:%M:%S'),
                fu.salesperson or '-',
                fu.status,
                fu.notes or '-'
            )
        console.print(fu_table)


@cli.command()
@click.option('--type', 'attr_type', type=click.Choice(['first', 'last', 'weighted', 'all']), 
              default='all', help='归因类型')
@click.option('--json', 'output_json', is_flag=True, help='输出JSON格式')
@click.pass_context
def report(ctx, attr_type, output_json):
    """生成归因报告"""
    db = ctx.obj['db']
    engine = AttributionEngine(db)
    
    summary = engine.get_attribution_summary()
    
    if output_json:
        console.print(json.dumps(summary, indent=2, ensure_ascii=False, default=str))
        return
    
    overview = summary['overview']
    
    overview_table = Table(title="概览", box=box.SIMPLE)
    overview_table.add_column("指标", style="cyan")
    overview_table.add_column("值")
    
    overview_table.add_row("总客户数", str(overview['total_customers']))
    overview_table.add_row("总订单数", str(overview['total_deals']))
    overview_table.add_row("总收入", f"[green]¥{overview['total_revenue']:,.2f}[/green]")
    overview_table.add_row("总归因数", str(overview['total_attributions']))
    overview_table.add_row("人工调整数", f"[yellow]{overview['manual_attributions']}[/yellow]")
    
    console.print(overview_table)
    
    type_names = {
        'first_touch': '首触达归因',
        'last_touch': '末触达归因',
        'weighted': '加权归因'
    }
    
    types_to_show = []
    if attr_type == 'all' or attr_type == 'first':
        types_to_show.append(('first_touch', summary.get('first_touch', {})))
    if attr_type == 'all' or attr_type == 'last':
        types_to_show.append(('last_touch', summary.get('last_touch', {})))
    if attr_type == 'all' or attr_type == 'weighted':
        types_to_show.append(('weighted', summary.get('weighted', {})))
    
    for t_name, t_data in types_to_show:
        if not t_data:
            continue
        
        table = Table(title=type_names.get(t_name, t_name), box=box.SIMPLE)
        table.add_column("来源", style="cyan")
        table.add_column("金额")
        table.add_column("占比")
        
        total = sum(t_data.values())
        
        for source, amount in sorted(t_data.items(), key=lambda x: -x[1]):
            pct = (amount / total * 100) if total > 0 else 0
            source_label = {
                'ad': '广告',
                'event': '活动',
                'referral': '转介绍',
                'organic': '自然流量'
            }.get(source, source)
            
            table.add_row(
                source_label,
                f"¥{amount:,.2f}",
                f"{pct:.1f}%"
            )
        
        if total > 0:
            table.add_row(
                "[bold]合计[/bold]",
                f"[bold]¥{total:,.2f}[/bold]",
                "[bold]100%[/bold]"
            )
        
        console.print(table)


@cli.command()
@click.argument('deal_id')
@click.option('--attr-type', required=True, 
              type=click.Choice(['first_touch', 'last_touch', 'weighted']),
              help='归因类型')
@click.option('--source', required=True, multiple=True,
              help='来源信息，格式: source_type:percentage')
@click.option('--operator', required=True, help='操作人')
@click.option('--reason', help='调整原因')
@click.pass_context
def adjust(ctx, deal_id, attr_type, source, operator, reason):
    """人工调整归因"""
    db = ctx.obj['db']
    engine = AttributionEngine(db)
    
    new_source = []
    for s in source:
        if ':' in s:
            st, pct = s.split(':', 1)
            new_source.append({
                'source_type': st,
                'percentage': float(pct)
            })
        else:
            new_source.append({
                'source_type': s,
                'percentage': 100.0
            })
    
    try:
        attributions = engine.manual_update_attribution(
            deal_id=deal_id,
            attribution_type=AttributionType(attr_type),
            new_source=new_source,
            operator=operator,
            reason=reason
        )
        
        console.print(Panel.fit(
            f"[green]归因调整成功！[/green]\n"
            f"调整了 {len(attributions)} 条归因记录\n"
            f"操作人: {operator}\n"
            f"原因: {reason or '-'}",
            title="人工归因",
            border_style="green"
        ))
        
        for attr in attributions:
            console.print(f"  - {attr.source_type.value}: {attr.percentage:.1f}% (¥{attr.amount:,.2f})")
            
    except Exception as e:
        console.print(f"[red]调整失败: {e}[/red]")


@cli.command()
@click.argument('identifier')
@click.option('--type', 'id_type', required=True, type=click.Choice(['email', 'phone']),
              help='标识符类型')
@click.option('--reason', help='加入黑名单原因')
@click.option('--operator', default='system', help='操作人')
@click.pass_context
def blacklist(ctx, identifier, id_type, reason, operator):
    """添加黑名单"""
    db = ctx.obj['db']
    importer = DataImporter(db)
    
    blacklist_item = importer.add_to_blacklist(
        identifier=identifier,
        identifier_type=id_type,
        reason=reason,
        operator=operator
    )
    
    console.print(Panel.fit(
        f"[green]已添加到黑名单[/green]\n"
        f"标识符: {identifier}\n"
        f"类型: {id_type}\n"
        f"原因: {reason or '-'}\n"
        f"操作人: {operator}",
        title="黑名单",
        border_style="green"
    ))


@cli.command()
@click.option('--record-type', help='记录类型筛选')
@click.option('--record-id', help='记录ID筛选')
@click.option('--limit', default=20, help='显示条数')
@click.pass_context
def history(ctx, record_type, record_id, limit):
    """查看操作历史"""
    db = ctx.obj['db']
    
    logs = db.get_audit_logs(record_type=record_type, record_id=record_id)
    logs = logs[:limit]
    
    if not logs:
        console.print("[yellow]暂无操作记录[/yellow]")
        return
    
    table = Table(title="操作历史", box=box.SIMPLE)
    table.add_column("时间")
    table.add_column("操作")
    table.add_column("记录类型")
    table.add_column("记录ID")
    table.add_column("操作人")
    table.add_column("原因")
    
    for log in logs:
        table.add_row(
            log.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            log.action,
            log.record_type,
            log.record_id[:12] + '...' if len(log.record_id) > 12 else log.record_id,
            log.operator or '-',
            log.reason or '-'
        )
    
    console.print(table)


@cli.command()
@click.pass_context
def status(ctx):
    """查看当前状态"""
    db = ctx.obj['db']
    importer = DataImporter(db)
    
    customers = db.get_all_customers()
    deals = db.get_all_deals()
    attributions = db.get_all_attributions()
    sessions = db.get_import_sessions()
    consistency = importer.check_data_consistency()
    blacklist_items = db.get_all_blacklist()
    
    console.print(Panel.fit(
        f"[cyan]数据库状态[/cyan]\n"
        f"路径: {db.db_path}\n\n"
        f"[cyan]数据统计[/cyan]\n"
        f"客户数: {len(customers)}\n"
        f"订单数: {len(deals)}\n"
        f"归因记录数: {len(attributions)}\n"
        f"导入会话数: {len(sessions)}\n"
        f"黑名单数: {len(blacklist_items)}\n\n"
        f"[cyan]数据一致性[/cyan]\n"
        f"问题数: [{'green' if consistency['issues_found'] == 0 else 'red'}]{consistency['issues_found']}[/{'green' if consistency['issues_found'] == 0 else 'red'}]",
        title="系统状态",
        border_style="cyan"
    ))


if __name__ == '__main__':
    cli()
