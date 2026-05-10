import click
from tabulate import tabulate
from datetime import datetime

from .core.database import init_db, db_exists
from .core.importer import (
    import_owners, import_books, import_sales, import_returns, import_payments
)
from .core.settlement import (
    validate_sales, create_settlement_batch, confirm_settlement,
    list_batches, get_batch_detail, get_unsettled_summary
)
from .core.exporter import (
    export_owner_statement, export_batch_summary, export_all_owners_for_batch
)


def _ensure_db():
    if not db_exists():
        click.echo(click.style('错误: 数据库不存在，请先运行 init 命令初始化', fg='red'))
        raise click.Abort()


@click.group()
@click.version_option(package_name='book-consignment')
def cli():
    """二手书寄售结算 CLI 工具"""
    pass


@cli.command()
@click.option('--force', is_flag=True, help='强制重建数据库（会清空所有数据）')
def init(force):
    """初始化数据库"""
    if db_exists() and not force:
        click.echo(click.style('数据库已存在，使用 --force 强制重建', fg='yellow'))
        return
    
    try:
        init_db(force=force)
        click.echo(click.style(f'✓ 数据库初始化成功', fg='green'))
    except Exception as e:
        click.echo(click.style(f'初始化失败: {e}', fg='red'))


@cli.group(name='import')
def import_cmd():
    """导入数据"""
    pass


@import_cmd.command('owners')
@click.argument('file_path', type=click.Path(exists=True))
def import_owners_cmd(file_path):
    """导入书主信息"""
    _ensure_db()
    result = import_owners(file_path)
    if result['success']:
        click.echo(click.style(f'✓ {result["message"]}', fg='green'))
    else:
        click.echo(click.style(f'✗ {result["message"]}', fg='red'))


@import_cmd.command('books')
@click.argument('file_path', type=click.Path(exists=True))
def import_books_cmd(file_path):
    """导入书籍信息"""
    _ensure_db()
    result = import_books(file_path)
    if result['success']:
        click.echo(click.style(f'✓ {result["message"]}', fg='green'))
        if 'warnings' in result and result['warnings']:
            click.echo(click.style('警告: 部分记录被跳过:', fg='yellow'))
            for w in result['warnings']:
                click.echo(f'  - {w}')
    else:
        click.echo(click.style(f'✗ {result["message"]}', fg='red'))


@import_cmd.command('sales')
@click.argument('file_path', type=click.Path(exists=True))
def import_sales_cmd(file_path):
    """导入销售记录"""
    _ensure_db()
    result = import_sales(file_path)
    if result['success']:
        click.echo(click.style(f'✓ {result["message"]}', fg='green'))
    else:
        click.echo(click.style(f'✗ {result["message"]}', fg='red'))
    if result.get('errors'):
        click.echo(click.style('错误记录:', fg='red'))
        for e in result['errors']:
            click.echo(f'  - {e}')


@import_cmd.command('returns')
@click.argument('file_path', type=click.Path(exists=True))
def import_returns_cmd(file_path):
    """导入退回记录"""
    _ensure_db()
    result = import_returns(file_path)
    if result['success']:
        click.echo(click.style(f'✓ {result["message"]}', fg='green'))
    else:
        click.echo(click.style(f'✗ {result["message"]}', fg='red'))
    if result.get('errors'):
        click.echo(click.style('错误记录:', fg='red'))
        for e in result['errors']:
            click.echo(f'  - {e}')


@import_cmd.command('payments')
@click.argument('file_path', type=click.Path(exists=True))
def import_payments_cmd(file_path):
    """导入付款记录"""
    _ensure_db()
    result = import_payments(file_path)
    if result['success']:
        click.echo(click.style(f'✓ {result["message"]}', fg='green'))
    else:
        click.echo(click.style(f'✗ {result["message"]}', fg='red'))
    if result.get('errors'):
        click.echo(click.style('错误记录:', fg='red'))
        for e in result['errors']:
            click.echo(f'  - {e}')


@cli.command()
@click.option('--start-date', help='开始日期 (YYYY-MM-DD)')
@click.option('--end-date', help='结束日期 (YYYY-MM-DD)')
def check(start_date, end_date):
    """检查未结算的销售记录（试算前检查）"""
    _ensure_db()
    
    click.echo(click.style('正在检查销售记录...', fg='cyan'))
    result = validate_sales(start_date, end_date)
    
    s = result['summary']
    click.echo(f'\n销售数量: {s["sale_count"]}')
    click.echo(f'销售总额: ¥{s["total_amount"]:.2f}')
    click.echo(f'书主分成: ¥{s["total_owner_share"]:.2f}')
    click.echo(f'店铺分成: ¥{s["total_store_share"]:.2f}')
    if abs(s["rounding_diff_total"]) >= 0.01:
        click.echo(click.style(f'四舍五入总差异: ¥{s["rounding_diff_total"]:.2f}', fg='yellow'))
    
    if result['error_count'] > 0:
        click.echo(click.style(f'\n⚠ 发现 {result["error_count"]} 个错误，必须修正后才能确认结算', fg='red'))
        errors = [i for i in result['issues'] if i['severity'] == 'error']
        for e in errors[:10]:
            click.echo(f'  [错误] {e["message"]}')
        if len(errors) > 10:
            click.echo(f'  ... 还有 {len(errors) - 10} 个错误')
    else:
        click.echo(click.style('\n✓ 无错误', fg='green'))
    
    if result['warning_count'] > 0:
        click.echo(click.style(f'\n⚠ 发现 {result["warning_count"]} 个警告（可选处理）', fg='yellow'))
        warnings = [i for i in result['issues'] if i['severity'] == 'warning']
        for w in warnings[:5]:
            click.echo(f'  [警告] {w["message"]}')
    
    if result['info_count'] > 0:
        click.echo(f'\nℹ {result["info_count"]} 条信息提示')
    
    if result['owner_breakdown']:
        click.echo('\n--- 按书主统计 ---')
        headers = ['书主编号', '姓名', '销售册数', '销售总额', '书主分成', '已付款', '应付余额']
        rows = []
        for ob in result['owner_breakdown']:
            rows.append([
                ob['owner_code'],
                ob['owner_name'],
                ob['sale_count'],
                f'¥{ob["total_amount"]:.2f}',
                f'¥{ob["owner_share"]:.2f}',
                f'¥{ob["total_paid"]:.2f}',
                f'¥{ob["balance"]:.2f}'
            ])
        click.echo(tabulate(rows, headers=headers, tablefmt='grid'))


@cli.command()
@click.option('--start-date', required=True, help='开始日期 (YYYY-MM-DD)')
@click.option('--end-date', required=True, help='结束日期 (YYYY-MM-DD)')
@click.option('--description', default='', help='批次描述')
def trial(start_date, end_date, description):
    """创建试算批次（确认前预览）"""
    _ensure_db()
    
    click.echo(click.style('正在检查数据...', fg='cyan'))
    result = validate_sales(start_date, end_date)
    
    if result['error_count'] > 0:
        click.echo(click.style(f'✗ 发现 {result["error_count"]} 个错误，无法创建试算批次', fg='red'))
        errors = [i for i in result['issues'] if i['severity'] == 'error']
        for e in errors[:10]:
            click.echo(f'  {e["message"]}')
        return
    
    batch = create_settlement_batch(start_date, end_date, description)
    
    click.echo(click.style(f'\n✓ 试算批次已创建', fg='green'))
    click.echo(f'  批次号: {batch["batch_no"]}')
    click.echo(f'  结算周期: {start_date} 至 {end_date}')
    
    s = result['summary']
    click.echo(f'\n  销售数量: {s["sale_count"]}')
    click.echo(f'  销售总额: ¥{s["total_amount"]:.2f}')
    click.echo(f'  书主分成: ¥{s["total_owner_share"]:.2f}')
    
    if result['owner_breakdown']:
        click.echo('\n  --- 书主明细 ---')
        for ob in result['owner_breakdown']:
            click.echo(f'    {ob["owner_code"]} {ob["owner_name"]}: {ob["sale_count"]}本, 分成 ¥{ob["owner_share"]:.2f}')
    
    click.echo(click.style(f'\n请仔细核对，确认无误后运行: confirm {batch["batch_no"]}', fg='cyan'))


@cli.command()
@click.argument('batch_no')
def confirm(batch_no):
    """确认结算（确认后不可撤销，数据将被锁定）"""
    _ensure_db()
    
    detail = get_batch_detail(batch_no)
    if not detail:
        click.echo(click.style(f'✗ 找不到批次 {batch_no}', fg='red'))
        return
    
    if detail['batch']['status'] == 'confirmed':
        click.echo(click.style(f'✗ 批次 {batch_no} 已经确认过了，不能重复确认', fg='red'))
        return
    
    click.echo(click.style('批次详情:', fg='cyan'))
    click.echo(f'  批次号: {batch_no}')
    click.echo(f'  状态: {detail["batch"]["status"]}')
    click.echo(f'  销售数量: {detail["sale_count"]}')
    click.echo(f'  销售总额: ¥{detail["total_amount"]:.2f}')
    
    click.echo('\n书主汇总:')
    for ot in detail['owner_totals']:
        click.echo(f'  {ot["owner_code"]} {ot["owner_name"]}: {ot["sale_count"]}本, 书主分成 ¥{ot["owner_share"]:.2f}')
    
    if not click.confirm('\n确认要锁定此批次吗？确认后不能撤销，再次导入相同数据不会重复计算。'):
        click.echo('已取消')
        return
    
    result = confirm_settlement(batch_no)
    if result['success']:
        click.echo(click.style(f'✓ {result["message"]}', fg='green'))
        click.echo(click.style(f'现在可以运行 export 命令导出结算单给书主核对', fg='cyan'))
    else:
        click.echo(click.style(f'✗ {result["message"]}', fg='red'))


@cli.group(name='list')
def list_cmd():
    """查询历史记录"""
    pass


@list_cmd.command('batches')
@click.option('--status', help='按状态筛选 (trial/confirmed)')
def list_batches_cmd(status):
    """列出所有结算批次"""
    _ensure_db()
    
    batches = list_batches(status)
    
    if not batches:
        click.echo('暂无批次记录')
        return
    
    headers = ['批次号', '描述', '开始日期', '结束日期', '状态', '销售数', '创建时间']
    rows = []
    for b in batches:
        rows.append([
            b['batch_no'],
            b['description'] or '-',
            b['start_date'],
            b['end_date'],
            b['status'],
            b['sale_count'],
            b['created_at'][:19]
        ])
    
    click.echo(tabulate(rows, headers=headers, tablefmt='grid'))


@list_cmd.command('unsettled')
def list_unsettled_cmd():
    """查看未结算的销售汇总"""
    _ensure_db()
    
    summary = get_unsettled_summary()
    
    if not summary['owners'] or all(o['sale_count'] == 0 for o in summary['owners']):
        click.echo('没有未结算的销售记录')
        return
    
    headers = ['书主编号', '姓名', '未结算销售数', '未结算总额', '书主分成']
    rows = []
    for o in summary['owners']:
        if o['sale_count'] > 0:
            rows.append([
                o['owner_code'],
                o['owner_name'],
                o['sale_count'],
                f'¥{o["total_amount"]:.2f}',
                f'¥{o["owner_share"]:.2f}'
            ])
    
    click.echo(tabulate(rows, headers=headers, tablefmt='grid'))


@cli.command()
@click.argument('batch_no')
def show(batch_no):
    """查看批次详情"""
    _ensure_db()
    
    detail = get_batch_detail(batch_no)
    if not detail:
        click.echo(click.style(f'✗ 找不到批次 {batch_no}', fg='red'))
        return
    
    click.echo(click.style(f'批次 {batch_no}', fg='cyan'))
    click.echo(f'  描述: {detail["batch"]["description"] or "-"}')
    click.echo(f'  周期: {detail["batch"]["start_date"]} 至 {detail["batch"]["end_date"]}')
    click.echo(f'  状态: {detail["batch"]["status"]}')
    click.echo(f'  销售数: {detail["sale_count"]}')
    click.echo(f'  总额: ¥{detail["total_amount"]:.2f}')
    
    if detail['owner_totals']:
        click.echo('\n--- 书主汇总 ---')
        headers = ['编号', '姓名', '销售册数', '总额', '书主分成']
        rows = []
        for ot in detail['owner_totals']:
            rows.append([
                ot['owner_code'],
                ot['owner_name'],
                ot['sale_count'],
                f'¥{ot["total_amount"]:.2f}',
                f'¥{ot["owner_share"]:.2f}'
            ])
        click.echo(tabulate(rows, headers=headers, tablefmt='grid'))


@cli.group()
def export():
    """导出结算单"""
    pass


@export.command('owner')
@click.argument('batch_no')
@click.argument('owner_code')
@click.argument('output_path', type=click.Path())
def export_owner_cmd(batch_no, owner_code, output_path):
    """导出单个书主的结算单"""
    _ensure_db()
    
    result = export_owner_statement(batch_no, owner_code, output_path)
    if result['success']:
        click.echo(click.style(f'✓ 已导出到 {output_path}', fg='green'))
        click.echo(f'  销售册数: {result["sale_count"]}')
        click.echo(f'  书主分成: ¥{result["owner_share"]:.2f}')
    else:
        click.echo(click.style(f'✗ {result["message"]}', fg='red'))


@export.command('summary')
@click.argument('batch_no')
@click.argument('output_path', type=click.Path())
def export_summary_cmd(batch_no, output_path):
    """导出批次汇总表"""
    _ensure_db()
    
    result = export_batch_summary(batch_no, output_path)
    if result['success']:
        click.echo(click.style(f'✓ 已导出到 {output_path}', fg='green'))
        click.echo(f'  书主数量: {len(result) - 3 if "files" in result else "-"}')
        click.echo(f'  总销售册数: {result.get("total_sales", "-")}')
        click.echo(f'  总销售金额: ¥{result.get("total_amount", 0):.2f}')
    else:
        click.echo(click.style(f'✗ {result["message"]}', fg='red'))


@export.command('all')
@click.argument('batch_no')
@click.argument('output_dir', type=click.Path())
def export_all_cmd(batch_no, output_dir):
    """导出批次中所有书主的结算单（给书主核对用）"""
    _ensure_db()
    
    result = export_all_owners_for_batch(batch_no, output_dir)
    if result['success']:
        click.echo(click.style(f'✓ 已导出 {result["export_count"]} 份结算单', fg='green'))
        for f in result['files']:
            click.echo(f'  - {f["owner_code"]} {f["owner_name"]}: {f["file_path"]}')
    else:
        click.echo(click.style(f'✗ {result["message"]}', fg='red'))


if __name__ == '__main__':
    cli()
