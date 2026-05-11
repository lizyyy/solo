#!/usr/bin/env python3
"""
体检中心加项收费核对 CLI
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import click

from services.data_importer import DataStore
from services.check_service import BillingChecker
from services.history_manager import HistoryManager
from utils.display import DisplayFormatter


class CLIController:
    def __init__(self):
        self.data_store = DataStore()
        self.history_manager = HistoryManager()
        self.current_session = None


@click.group()
@click.pass_context
def cli(ctx):
    """体检中心加项收费核对工具 - 帮助前台快速识别收费异常"""
    ctx.obj = CLIController()


@cli.command()
@click.option('--group', 'group_file', help='团检企业名单 (JSON)')
@click.option('--employees', 'employees_file', help='员工名单 (JSON/CSV)')
@click.option('--packages', 'packages_file', help='套餐配置 (JSON)')
@click.option('--addons', 'addons_file', help='现场加项记录 (JSON/CSV)')
@click.option('--payments', 'payments_file', help='收费流水 (JSON/CSV)')
@click.option('--discounts', 'discounts_file', help='折扣政策 (JSON)')
@click.option('--refunds', 'refunds_file', help='退费记录 (JSON/CSV)')
@click.pass_obj
def import_data(ctrl, group_file, employees_file, packages_file, 
                addons_file, payments_file, discounts_file, refunds_file):
    """导入各类数据文件"""
    DisplayFormatter.print_header("📥 数据导入")
    
    if group_file:
        click.echo(f"导入团检企业: {group_file}")
        ctrl.data_store.import_group_checkups(group_file)
    
    if employees_file:
        click.echo(f"导入员工名单: {employees_file}")
        ctrl.data_store.import_employees(employees_file)
    
    if packages_file:
        click.echo(f"导入套餐配置: {packages_file}")
        ctrl.data_store.import_packages(packages_file)
    
    if addons_file:
        click.echo(f"导入加项记录: {addons_file}")
        ctrl.data_store.import_add_ons(addons_file)
    
    if payments_file:
        click.echo(f"导入收费流水: {payments_file}")
        ctrl.data_store.import_payments(payments_file)
    
    if discounts_file:
        click.echo(f"导入折扣政策: {discounts_file}")
        ctrl.data_store.import_discount_policies(discounts_file)
    
    if refunds_file:
        click.echo(f"导入退费记录: {refunds_file}")
        ctrl.data_store.import_refunds(refunds_file)
    
    DisplayFormatter.print_import_summary(ctrl.data_store.get_summary())


@cli.command()
@click.option('--show-pending/--no-pending', default=True, help='显示待收费清单')
@click.option('--show-issues/--no-issues', default=True, help='显示异常清单')
@click.option('--show-normal/--no-normal', default=False, help='显示正常清单')
@click.pass_obj
def check(ctrl, show_pending, show_issues, show_normal):
    """执行收费核对检查"""
    DisplayFormatter.print_header("🔍 加项收费核对")
    
    checker = BillingChecker(ctrl.data_store)
    session = checker.run_check()
    
    ctrl.current_session = session
    ctrl.history_manager.save_session(session)
    
    DisplayFormatter.print_summary(session)
    
    if show_pending:
        DisplayFormatter.print_pending(session.results)
    
    if show_issues:
        DisplayFormatter.print_issues(session.results)
    
    if show_normal:
        DisplayFormatter.print_normal(session.results)
    
    DisplayFormatter.print_quick_summary(session)
    
    click.echo(f"💾 核对结果已保存，会话 ID: {session.session_id}")
    click.echo()


@cli.command()
@click.argument('session_id')
@click.pass_obj
def confirm(ctrl, session_id):
    """确认核对结果"""
    DisplayFormatter.print_header("✅ 确认核对结果")
    
    if ctrl.history_manager.confirm_session(session_id):
        click.echo(f"会话 {session_id} 已确认！")
        click.echo("确认后的结果将作为历史记录保存，可供后续查询和审计。")
    else:
        click.echo(f"错误: 未找到会话 {session_id}")
    click.echo()


@cli.command()
@click.option('--limit', default=10, help='显示最近N条记录')
@click.pass_obj
def history(ctrl, limit):
    """查看历史核对会话"""
    sessions = ctrl.history_manager.list_sessions(limit)
    DisplayFormatter.print_session_list(sessions)


@cli.command()
@click.argument('session_id')
@click.option('--show-pending/--no-pending', default=True)
@click.option('--show-issues/--no-issues', default=True)
@click.option('--show-normal/--no-normal', default=False)
@click.pass_obj
def show(ctrl, session_id, show_pending, show_issues, show_normal):
    """查看指定会话的详细结果"""
    session = ctrl.history_manager.get_session(session_id)
    
    if not session:
        click.echo(f"错误: 未找到会话 {session_id}")
        return
    
    DisplayFormatter.print_header(f"📊 会话详情 - {session_id}")
    DisplayFormatter.print_summary(session)
    
    if show_pending:
        DisplayFormatter.print_pending(session.results)
    
    if show_issues:
        DisplayFormatter.print_issues(session.results)
    
    if show_normal:
        DisplayFormatter.print_normal(session.results)


@cli.command()
@click.argument('session_id')
@click.option('--format', 'output_format', type=click.Choice(['csv', 'json']), default='csv')
@click.option('--output', '-o', 'output_path', help='输出文件路径')
@click.pass_obj
def export(ctrl, session_id, output_format, output_path):
    """导出核对结果"""
    DisplayFormatter.print_header("📤 导出核对结果")
    
    if not output_path:
        output_path = f"check_result_{session_id}.{output_format}"
    
    if output_format == 'csv':
        success = ctrl.history_manager.export_to_csv(session_id, output_path)
    else:
        success = ctrl.history_manager.export_to_json(session_id, output_path)
    
    if success:
        click.echo(f"✅ 导出成功: {output_path}")
    else:
        click.echo(f"❌ 导出失败: 未找到会话 {session_id}")
    click.echo()


@cli.command()
@click.pass_obj
def clear(ctrl):
    """清空所有数据"""
    click.echo("⚠️  警告: 这将清空所有导入的数据！")
    confirm = click.prompt("输入 'yes' 确认清空", default="no")
    if confirm == 'yes':
        ctrl.data_store.clear()
    else:
        click.echo("已取消")


@cli.command()
@click.pass_obj
def status(ctrl):
    """显示当前数据状态"""
    summary = ctrl.data_store.get_summary()
    DisplayFormatter.print_import_summary(summary)


if __name__ == '__main__':
    cli()
