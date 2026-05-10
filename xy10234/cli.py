#!/usr/bin/env python3
import click
import sys
from datetime import date, datetime
from tabulate import tabulate
from prop_deposit_cli.storage import Storage
from prop_deposit_cli.business import PropDepositManager
from prop_deposit_cli.importer import DataImporter
from prop_deposit_cli.reports import ReportGenerator
from prop_deposit_cli.models import DamageLevel, PropStatus, BorrowStatus
from prop_deposit_cli.config import DATA_DIR, PROBLEMS_DIR, REPORTS_DIR


def get_services():
    storage = Storage()
    manager = PropDepositManager(storage)
    importer = DataImporter(storage, manager)
    reporter = ReportGenerator(storage, manager)
    return storage, manager, importer, reporter


@click.group()
def cli():
    """影棚道具借用押金管理 CLI"""
    pass


@cli.group(name='import')
def import_cmd():
    """导入数据"""
    pass


@import_cmd.command('props')
@click.argument('file_path', type=click.Path(exists=True))
def import_props(file_path):
    """导入道具档案"""
    storage, manager, importer, reporter = get_services()
    click.echo(f"正在导入道具档案: {file_path}")
    
    try:
        result = importer.import_props_from_excel(file_path)
        click.echo(f"\n导入结果:")
        click.echo(f"  成功: {result['success']} 条")
        click.echo(f"  跳过: {result['skipped']} 条")
        click.echo(f"  失败: {result['failed']} 条")
        
        if result['problems']:
            click.echo(f"\n问题记录已保存到: {PROBLEMS_DIR}")
            for p in result['problems']:
                click.echo(f"  第{p['line']}行: {p['error']}")
    except Exception as e:
        click.echo(f"导入失败: {e}", err=True)
        sys.exit(1)


@import_cmd.command('borrows')
@click.argument('file_path', type=click.Path(exists=True))
def import_borrows(file_path):
    """导入借用单"""
    storage, manager, importer, reporter = get_services()
    click.echo(f"正在导入借用单: {file_path}")
    
    try:
        result = importer.import_borrows_from_excel(file_path)
        click.echo(f"\n导入结果:")
        click.echo(f"  成功: {result['success']} 条")
        click.echo(f"  跳过: {result['skipped']} 条")
        click.echo(f"  失败: {result['failed']} 条")
        
        if result['problems']:
            click.echo(f"\n问题记录已保存到: {PROBLEMS_DIR}")
            for p in result['problems']:
                click.echo(f"  第{p['line']}行: {p['error']}")
    except Exception as e:
        click.echo(f"导入失败: {e}", err=True)
        sys.exit(1)


@import_cmd.command('returns')
@click.argument('file_path', type=click.Path(exists=True))
def import_returns(file_path):
    """导入归还记录"""
    storage, manager, importer, reporter = get_services()
    click.echo(f"正在导入归还记录: {file_path}")
    
    try:
        result = importer.import_returns_from_excel(file_path)
        click.echo(f"\n导入结果:")
        click.echo(f"  成功: {result['success']} 条")
        click.echo(f"  跳过: {result['skipped']} 条")
        click.echo(f"  失败: {result['failed']} 条")
        
        if result['problems']:
            click.echo(f"\n问题记录已保存到: {PROBLEMS_DIR}")
            for p in result['problems']:
                click.echo(f"  第{p['line']}行: {p['error']}")
    except Exception as e:
        click.echo(f"导入失败: {e}", err=True)
        sys.exit(1)


@cli.group()
def query():
    """查询数据"""
    pass


@query.command('props')
@click.option('--status', type=click.Choice(['all', 'available', 'borrowed', 'maintenance', 'retired']), default='all')
@click.option('--category', default=None, help='按分类筛选')
def list_props(status, category):
    """列出道具档案"""
    storage, manager, importer, reporter = get_services()
    props = storage.get_all_props()
    
    if status != 'all':
        props = [p for p in props if p.status.value == status]
    
    if category:
        props = [p for p in props if category.lower() in p.category.lower()]
    
    if not props:
        click.echo("没有找到道具")
        return
    
    table_data = []
    for p in props:
        table_data.append([
            p.prop_id,
            p.name,
            p.category,
            f"¥{p.value:,.0f}",
            f"{p.deposit_rate * 100:.0f}%",
            f"¥{p.required_deposit():,.0f}",
            p.status.value,
            p.location
        ])
    
    headers = ['道具ID', '名称', '分类', '价值', '押金比例', '所需押金', '状态', '存放位置']
    click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))
    click.echo(f"\n共 {len(props)} 个道具")


@query.command('borrows')
@click.option('--status', type=click.Choice(['all', 'pending', 'active', 'overdue', 'returned', 'settled']), default='all')
@click.option('--crew', default=None, help='按剧组筛选')
def list_borrows(status, crew):
    """列出借用单"""
    storage, manager, importer, reporter = get_services()
    borrows = storage.get_all_borrows()
    
    if status != 'all':
        borrows = [b for b in borrows if b.status.value == status]
    
    if crew:
        borrows = [b for b in borrows if crew.lower() in b.crew_name.lower()]
    
    if not borrows:
        click.echo("没有找到借用单")
        return
    
    table_data = []
    for b in borrows:
        prop = storage.get_prop(b.prop_id)
        prop_name = prop.name if prop else '未知'
        
        table_data.append([
            b.borrow_id,
            b.prop_id,
            prop_name,
            b.crew_name,
            b.borrow_date,
            b.scheduled_return_date,
            b.actual_return_date or '-',
            f"¥{b.deposit_paid:,.0f}",
            f"¥{b.damage_fee:,.0f}",
            f"¥{b.delay_fee:,.0f}",
            f"¥{b.refund_amount:,.0f}",
            b.status.value
        ])
    
    headers = ['借用单ID', '道具ID', '道具名称', '剧组', '借用日期', '计划归还', '实际归还', 
               '已交押金', '损坏费', '延期费', '退款', '状态']
    click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))
    click.echo(f"\n共 {len(borrows)} 个借用单")


@query.command('prop')
@click.argument('prop_id')
def prop_detail(prop_id):
    """查看道具详情"""
    storage, manager, importer, reporter = get_services()
    prop = storage.get_prop(prop_id)
    
    if not prop:
        click.echo(f"道具不存在: {prop_id}", err=True)
        sys.exit(1)
    
    click.echo(f"\n道具详情:")
    click.echo(f"  道具ID: {prop.prop_id}")
    click.echo(f"  名称: {prop.name}")
    click.echo(f"  分类: {prop.category}")
    click.echo(f"  价值: ¥{prop.value:,.2f}")
    click.echo(f"  押金比例: {prop.deposit_rate * 100:.0f}%")
    click.echo(f"  所需押金: ¥{prop.required_deposit():,.2f}")
    click.echo(f"  状态: {prop.status.value}")
    click.echo(f"  存放位置: {prop.location}")
    
    borrows = storage.get_borrows_by_prop(prop_id)
    if borrows:
        click.echo(f"\n借用历史 ({len(borrows)} 条):")
        for b in borrows:
            click.echo(f"  [{b.status.value}] {b.crew_name} - {b.borrow_date} 至 {b.actual_return_date or b.scheduled_return_date}")


@query.command('borrow')
@click.argument('borrow_id')
def borrow_detail(borrow_id):
    """查看借用单详情"""
    storage, manager, importer, reporter = get_services()
    borrow = storage.get_borrow(borrow_id)
    
    if not borrow:
        click.echo(f"借用单不存在: {borrow_id}", err=True)
        sys.exit(1)
    
    prop = storage.get_prop(borrow.prop_id)
    prop_name = prop.name if prop else '未知'
    prop_value = prop.value if prop else 0
    
    click.echo(f"\n借用单详情:")
    click.echo(f"  借用单ID: {borrow.borrow_id}")
    click.echo(f"  道具ID: {borrow.prop_id}")
    click.echo(f"  道具名称: {prop_name}")
    click.echo(f"  道具价值: ¥{prop_value:,.2f}")
    click.echo(f"  剧组: {borrow.crew_name}")
    click.echo(f"  借用日期: {borrow.borrow_date}")
    click.echo(f"  计划归还日期: {borrow.scheduled_return_date}")
    click.echo(f"  实际归还日期: {borrow.actual_return_date or '-'}")
    click.echo(f"  所需押金: ¥{borrow.required_deposit:,.2f}")
    click.echo(f"  已交押金: ¥{borrow.deposit_paid:,.2f}")
    click.echo(f"  损坏程度: {borrow.damage_level.value}")
    click.echo(f"  损坏费用: ¥{borrow.damage_fee:,.2f}")
    click.echo(f"  延期费用: ¥{borrow.delay_fee:,.2f}")
    click.echo(f"  退款金额: ¥{borrow.refund_amount:,.2f}")
    click.echo(f"  状态: {borrow.status.value}")


@query.command('problems')
@click.option('--include-fixed', is_flag=True, help='包含已修复的问题')
def list_problems(include_fixed):
    """列出问题记录"""
    storage, manager, importer, reporter = get_services()
    problems = storage.get_all_problems(include_fixed=include_fixed)
    
    if not problems:
        click.echo("没有问题记录")
        return
    
    table_data = []
    for p in problems:
        table_data.append([
            p.problem_id[:8],
            p.source_file.split('/')[-1],
            p.line_number,
            p.error_type,
            p.error_message[:50],
            '是' if p.fixed else '否',
            p.created_at.strftime('%Y-%m-%d %H:%M')
        ])
    
    headers = ['问题ID', '来源文件', '行号', '错误类型', '错误信息', '已修复', '创建时间']
    click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))
    click.echo(f"\n共 {len(problems)} 个问题")


@cli.group()
def check():
    """检查和验证"""
    pass


@check.command('overdue')
@click.option('--date', 'date_str', default=None, help='检查日期 (YYYY-MM-DD)，默认今天')
def check_overdue(date_str):
    """检查逾期借用单"""
    from datetime import date as date_class
    storage, manager, importer, reporter = get_services()
    
    check_date = date_class.fromisoformat(date_str) if date_str else None
    overdue = manager.check_overdue_borrows(check_date)
    
    if not overdue:
        click.echo("没有逾期借用单")
        return
    
    click.echo(f"发现 {len(overdue)} 个逾期借用单:\n")
    
    table_data = []
    for b in overdue:
        prop = storage.get_prop(b.prop_id)
        prop_name = prop.name if prop else '未知'
        today = check_date or date_class.today()
        overdue_days = (today - b.scheduled_return_date).days
        estimated_fee = b.required_deposit * 0.1 * overdue_days
        
        table_data.append([
            b.borrow_id,
            prop_name,
            b.crew_name,
            b.scheduled_return_date,
            f"{overdue_days} 天",
            f"¥{estimated_fee:,.2f}"
        ])
    
    headers = ['借用单ID', '道具', '剧组', '计划归还', '逾期天数', '预计延期费']
    click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))


@check.command('consistency')
def check_consistency():
    """检查数据一致性"""
    storage, manager, importer, reporter = get_services()
    
    click.echo("正在检查数据一致性...\n")
    result = manager.run_consistency_check()
    
    issues = []
    issues.extend(result['prop_issues'])
    issues.extend(result['borrow_issues'])
    issues.extend(result['deposit_issues'])
    issues.extend(result['state_inconsistencies'])
    
    if not issues:
        click.echo("数据一致性检查通过，未发现异常")
        return
    
    click.echo(f"发现 {len(issues)} 个问题:\n")
    
    for i, issue in enumerate(issues, 1):
        click.echo(f"{i}. [{issue.get('type', 'unknown')}] {issue.get('message', '未知错误')}")
    
    click.echo(f"\n  道具问题: {len(result['prop_issues'])}")
    click.echo(f"  借用单问题: {len(result['borrow_issues'])}")
    click.echo(f"  押金问题: {len(result['deposit_issues'])}")
    click.echo(f"  状态不一致: {len(result['state_inconsistencies'])}")


@check.command('summary')
def check_summary():
    """查看汇总统计"""
    storage, manager, importer, reporter = get_services()
    
    summary = manager.get_deposit_summary()
    
    click.echo("\n汇总统计:")
    click.echo(f"  道具总数: {summary['total_props']}")
    click.echo(f"  借用单总数: {summary['total_borrows']}")
    click.echo(f"  活动借用: {summary['active_borrows']}")
    click.echo(f"  逾期借用: {summary['overdue_borrows']}")
    click.echo(f"  冻结押金总额: ¥{summary['total_deposit_frozen']:,.2f}")
    click.echo(f"  损坏费用总额: ¥{summary['total_damage_fees']:,.2f}")
    click.echo(f"  延期费用总额: ¥{summary['total_delay_fees']:,.2f}")
    click.echo(f"  退款总额: ¥{summary['total_refunds']:,.2f}")
    click.echo(f"  待结算借用单: {summary['pending_settlements']}")


@cli.group()
def report():
    """生成报告"""
    pass


@report.command('summary')
def report_summary():
    """生成押金汇总报告"""
    storage, manager, importer, reporter = get_services()
    
    click.echo("正在生成汇总报告...")
    filepath = reporter.generate_deposit_summary_report()
    click.echo(f"报告已生成: {filepath}")


@report.command('overdue')
def report_overdue():
    """生成逾期报告"""
    storage, manager, importer, reporter = get_services()
    
    click.echo("正在生成逾期报告...")
    filepath = reporter.generate_overdue_report()
    click.echo(f"报告已生成: {filepath}")


@report.command('damage')
def report_damage():
    """生成损坏报告"""
    storage, manager, importer, reporter = get_services()
    
    click.echo("正在生成损坏报告...")
    filepath = reporter.generate_damage_report()
    click.echo(f"报告已生成: {filepath}")


@report.command('problems')
@click.option('--include-fixed', is_flag=True, help='包含已修复的问题')
def report_problems(include_fixed):
    """生成问题报告"""
    storage, manager, importer, reporter = get_services()
    
    click.echo("正在生成问题报告...")
    filepath = reporter.generate_problems_report(include_fixed=include_fixed)
    click.echo(f"报告已生成: {filepath}")


@report.command('business')
def report_business():
    """生成业务负责人汇总报告"""
    storage, manager, importer, reporter = get_services()
    
    click.echo("正在生成业务汇总报告...")
    filepath = reporter.generate_business_summary_for_manager()
    click.echo(f"报告已生成: {filepath}")


@cli.command('process-return')
@click.argument('borrow_id')
@click.option('--return-date', required=True, help='实际归还日期 (YYYY-MM-DD)')
@click.option('--damage', type=click.Choice(['none', 'minor', 'major', 'total']), default='none', help='损坏程度')
@click.option('--damage-fee', type=float, default=None, help='自定义损坏费')
@click.option('--delay-fee', type=float, default=None, help='自定义延期费')
def process_return(borrow_id, return_date, damage, damage_fee, delay_fee):
    """处理道具归还"""
    storage, manager, importer, reporter = get_services()
    
    try:
        return_date_obj = date.fromisoformat(return_date)
        damage_level = DamageLevel(damage)
        
        borrow = manager.process_return(
            borrow_id=borrow_id,
            actual_return_date=return_date_obj,
            damage_level=damage_level,
            damage_fee_override=damage_fee,
            delay_fee_override=delay_fee
        )
        
        click.echo(f"\n归还处理完成:")
        click.echo(f"  借用单: {borrow.borrow_id}")
        click.echo(f"  损坏费用: ¥{borrow.damage_fee:,.2f}")
        click.echo(f"  延期费用: ¥{borrow.delay_fee:,.2f}")
        click.echo(f"  应退押金: ¥{borrow.refund_amount:,.2f}")
        click.echo(f"  状态: {borrow.status.value}")
        
    except Exception as e:
        click.echo(f"处理失败: {e}", err=True)
        sys.exit(1)


@cli.command('settle')
@click.argument('borrow_id')
@click.option('--additional-payment', type=float, default=0.0, help='追加付款金额')
def settle_borrow(borrow_id, additional_payment):
    """结算借用单"""
    storage, manager, importer, reporter = get_services()
    
    try:
        borrow = manager.settle_borrow(borrow_id, additional_payment)
        
        click.echo(f"\n结算完成:")
        click.echo(f"  借用单: {borrow.borrow_id}")
        click.echo(f"  追加付款: ¥{additional_payment:,.2f}")
        click.echo(f"  实际退款: ¥{borrow.refund_amount:,.2f}")
        click.echo(f"  状态: {borrow.status.value}")
        
    except Exception as e:
        click.echo(f"结算失败: {e}", err=True)
        sys.exit(1)


@cli.group()
def fix():
    """修复问题"""
    pass


@fix.command('problem')
@click.argument('problem_id')
def mark_problem_fixed(problem_id):
    """标记问题为已修复"""
    storage, manager, importer, reporter = get_services()
    
    problem = storage.problems.get(problem_id)
    if not problem:
        # 尝试匹配部分ID
        for pid, p in storage.problems.items():
            if pid.startswith(problem_id):
                problem = p
                problem_id = pid
                break
    
    if not problem:
        click.echo(f"问题不存在: {problem_id}", err=True)
        sys.exit(1)
    
    storage.mark_problem_fixed(problem_id)
    click.echo(f"问题已标记为已修复: {problem_id}")


@cli.command('info')
def show_info():
    """显示系统信息"""
    click.echo("影棚道具借用押金管理系统")
    click.echo(f"\n数据目录: {DATA_DIR}")
    click.echo(f"问题目录: {PROBLEMS_DIR}")
    click.echo(f"报告目录: {REPORTS_DIR}")
    
    storage = Storage()
    click.echo(f"\n当前数据:")
    click.echo(f"  道具: {len(storage.get_all_props())} 个")
    click.echo(f"  借用单: {len(storage.get_all_borrows())} 个")
    click.echo(f"  未修复问题: {len(storage.get_all_problems(include_fixed=False))} 个")


if __name__ == '__main__':
    cli()
