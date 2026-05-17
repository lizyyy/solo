import click
import logging
from pathlib import Path
from typing import List, Optional
from datetime import datetime as dt_datetime

from .parser import (
    RentalOrderParser, DepositTransactionParser,
    DamageItemParser, RenewalApplicationParser,
    derive_audit_date, make_stable_report_name
)
from .reporter import ReportGenerator

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@click.group()
@click.version_option(version='0.1.0', prog_name='rental-audit')
def cli():
    """摄影器材租赁押金审计CLI工具
    
    用于审计租赁订单的押金冻结、逾期计费、损坏扣款、续租幂等等问题。
    """
    pass


@cli.command()
@click.option('--orders', '-o', required=True, help='租赁订单文件路径 (CSV/JSON)')
@click.option('--transactions', '-t', required=True, help='押金交易记录文件路径 (CSV/JSON)')
@click.option('--damages', '-d', default=None, help='损坏记录文件路径 (CSV/JSON)')
@click.option('--renewals', '-r', default=None, help='续租申请文件路径 (CSV/JSON)')
@click.option('--output-dir', '-O', default='audit_output', help='输出目录路径')
@click.option('--report-name', default=None, help='报告名称 (不包含扩展名)')
@click.option('--audit-date', default=None, help='审计日期 (YYYY-MM-DD)，用于计算逾期。默认从输入数据中推导最新日期')
@click.option('--verbose', '-v', is_flag=True, help='显示详细日志')
def audit(orders: str, transactions: str, damages: Optional[str], 
          renewals: Optional[str], output_dir: str, report_name: Optional[str],
          audit_date: Optional[str], verbose: bool):
    """执行完整的租赁押金审计
    
    解析输入文件，执行审计规则，生成审计报告。
    默认从输入数据中推导审计日期（取所有记录中的最新日期），确保同一批材料重复运行结果稳定。
    使用 --audit-date 可手动指定审计日期。
    """
    if verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    click.echo("开始租赁押金审计...")
    
    all_orders = []
    all_transactions = []
    all_damages = []
    all_renewals = []
    all_bad_rows = []
    
    click.echo(f"  解析订单文件: {orders}")
    order_parser = RentalOrderParser(orders)
    parsed_orders, order_bad_rows = order_parser.parse()
    all_orders.extend(parsed_orders)
    all_bad_rows.extend(order_bad_rows)
    click.echo(f"    成功解析 {len(parsed_orders)} 条订单")
    if order_bad_rows:
        click.echo(f"    发现 {len(order_bad_rows)} 条解析错误")
    
    click.echo(f"  解析交易记录文件: {transactions}")
    trans_parser = DepositTransactionParser(transactions)
    parsed_trans, trans_bad_rows = trans_parser.parse()
    all_transactions.extend(parsed_trans)
    all_bad_rows.extend(trans_bad_rows)
    click.echo(f"    成功解析 {len(parsed_trans)} 条交易记录")
    if trans_bad_rows:
        click.echo(f"    发现 {len(trans_bad_rows)} 条解析错误")
    
    if damages and Path(damages).exists():
        click.echo(f"  解析损坏记录文件: {damages}")
        damage_parser = DamageItemParser(damages)
        parsed_damages, damage_bad_rows = damage_parser.parse()
        all_damages.extend(parsed_damages)
        all_bad_rows.extend(damage_bad_rows)
        click.echo(f"    成功解析 {len(parsed_damages)} 条损坏记录")
        if damage_bad_rows:
            click.echo(f"    发现 {len(damage_bad_rows)} 条解析错误")
    
    if renewals and Path(renewals).exists():
        click.echo(f"  解析续租申请文件: {renewals}")
        renewal_parser = RenewalApplicationParser(renewals)
        parsed_renewals, renewal_bad_rows = renewal_parser.parse()
        all_renewals.extend(parsed_renewals)
        all_bad_rows.extend(renewal_bad_rows)
        click.echo(f"    成功解析 {len(parsed_renewals)} 条续租申请")
        if renewal_bad_rows:
            click.echo(f"    发现 {len(renewal_bad_rows)} 条解析错误")
    
    parsed_audit_date = None
    parsed_audit_timestamp = None
    if audit_date:
        try:
            parsed_audit_date = dt_datetime.strptime(audit_date, '%Y-%m-%d').date()
            parsed_audit_timestamp = dt_datetime.strptime(audit_date, '%Y-%m-%d')
            click.echo(f"  使用指定审计日期: {parsed_audit_date}")
        except ValueError:
            click.echo(f"  警告: 审计日期格式无效 '{audit_date}'，将从输入数据推导")
    
    if parsed_audit_date is None:
        derived_date = derive_audit_date(all_orders, all_transactions, all_damages, all_renewals)
        if derived_date:
            parsed_audit_date = derived_date
            parsed_audit_timestamp = dt_datetime.combine(derived_date, dt_datetime.min.time())
            click.echo(f"  从输入数据推导审计日期: {parsed_audit_date}")
    
    final_report_name = make_stable_report_name(parsed_audit_date, report_name)
    
    click.echo("\n  执行审计规则...")
    reporter = ReportGenerator(output_dir)
    
    report_path = reporter.generate_audit_report(
        all_orders, all_transactions, all_damages, all_renewals,
        all_bad_rows, final_report_name, parsed_audit_date, parsed_audit_timestamp
    )
    
    reporter.print_console_summary(
        all_orders, all_transactions, all_damages, all_renewals, all_bad_rows
    )
    
    click.echo(f"审计报告已生成: {report_path}")


@cli.command()
@click.option('--order-id', '-i', required=True, help='要审计的订单ID')
@click.option('--orders', '-o', required=True, help='租赁订单文件路径 (CSV/JSON)')
@click.option('--transactions', '-t', required=True, help='押金交易记录文件路径 (CSV/JSON)')
@click.option('--damages', '-d', default=None, help='损坏记录文件路径 (CSV/JSON)')
@click.option('--renewals', '-r', default=None, help='续租申请文件路径 (CSV/JSON)')
@click.option('--output-dir', '-O', default='audit_output', help='输出目录路径')
@click.option('--audit-date', default=None, help='审计日期 (YYYY-MM-DD)，用于计算逾期。默认从输入数据中推导最新日期')
def audit_order(order_id: str, orders: str, transactions: str, 
                damages: Optional[str], renewals: Optional[str], output_dir: str,
                audit_date: Optional[str]):
    """审计单个订单的详细信息
    
    生成指定订单的详细审计报告。
    默认从输入数据中推导审计日期（取所有记录中的最新日期），确保同一批材料重复运行结果稳定。
    使用 --audit-date 可手动指定审计日期。
    """
    click.echo(f"开始审计订单 {order_id}...")
    
    all_orders = []
    all_transactions = []
    all_damages = []
    all_renewals = []
    
    order_parser = RentalOrderParser(orders)
    parsed_orders, _ = order_parser.parse()
    all_orders.extend(parsed_orders)
    
    target_order = None
    for o in all_orders:
        if o.order_id == order_id:
            target_order = o
            break
    
    if not target_order:
        click.echo(f"错误: 未找到订单 {order_id}")
        return
    
    click.echo(f"  找到订单: {target_order.customer_name} - {target_order.equipment_name}")
    
    trans_parser = DepositTransactionParser(transactions)
    parsed_trans, _ = trans_parser.parse()
    order_transactions = [t for t in parsed_trans if t.order_id == order_id]
    all_transactions.extend(order_transactions)
    click.echo(f"  找到 {len(order_transactions)} 条相关交易记录")
    
    if damages and Path(damages).exists():
        damage_parser = DamageItemParser(damages)
        parsed_damages, _ = damage_parser.parse()
        order_damages = [d for d in parsed_damages if d.order_id == order_id]
        all_damages.extend(order_damages)
        click.echo(f"  找到 {len(order_damages)} 条相关损坏记录")
    
    if renewals and Path(renewals).exists():
        renewal_parser = RenewalApplicationParser(renewals)
        parsed_renewals, _ = renewal_parser.parse()
        order_renewals = [r for r in parsed_renewals if r.order_id == order_id]
        all_renewals.extend(order_renewals)
        click.echo(f"  找到 {len(order_renewals)} 条相关续租申请")
    
    parsed_audit_date = None
    parsed_audit_timestamp = None
    if audit_date:
        try:
            parsed_audit_date = dt_datetime.strptime(audit_date, '%Y-%m-%d').date()
            parsed_audit_timestamp = dt_datetime.strptime(audit_date, '%Y-%m-%d')
            click.echo(f"  使用指定审计日期: {parsed_audit_date}")
        except ValueError:
            click.echo(f"  警告: 审计日期格式无效 '{audit_date}'，将从输入数据推导")
    
    if parsed_audit_date is None:
        derived_date = derive_audit_date(all_orders, all_transactions, all_damages, all_renewals)
        if derived_date:
            parsed_audit_date = derived_date
            parsed_audit_timestamp = dt_datetime.combine(derived_date, dt_datetime.min.time())
            click.echo(f"  从输入数据推导审计日期: {parsed_audit_date}")
    
    reporter = ReportGenerator(output_dir)
    report_path = reporter.export_detailed_audit(
        target_order, order_transactions, all_damages, all_renewals,
        parsed_audit_date, parsed_audit_timestamp
    )
    
    click.echo(f"\n详细审计报告已生成: {report_path}")


@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--file-type', '-t', 
              type=click.Choice(['orders', 'transactions', 'damages', 'renewals']),
              required=True, help='文件类型')
@click.option('--output-dir', '-O', default='audit_output', help='输出目录路径')
def validate(file_path: str, file_type: str, output_dir: str):
    """验证数据文件的格式
    
    检查CSV/JSON文件是否符合要求的格式，输出解析错误。
    """
    click.echo(f"验证 {file_type} 文件: {file_path}")
    
    parsers = {
        'orders': RentalOrderParser,
        'transactions': DepositTransactionParser,
        'damages': DamageItemParser,
        'renewals': RenewalApplicationParser
    }
    
    parser_class = parsers[file_type]
    parser = parser_class(file_path)
    
    try:
        data, bad_rows = parser.parse()
        click.echo(f"  成功解析: {len(data)} 条记录")
        
        if bad_rows:
            click.echo(f"\n  发现 {len(bad_rows)} 条解析错误:")
            for i, br in enumerate(bad_rows[:10], 1):
                click.echo(f"\n  [{i}] 行号: {br.source.line_number or '未知'}")
                click.echo(f"      类型: {br.error_type}")
                click.echo(f"      错误: {br.error_message}")
            if len(bad_rows) > 10:
                click.echo(f"\n  ... 还有 {len(bad_rows) - 10} 条错误")
            
            reporter = ReportGenerator(output_dir)
            bad_rows_path = reporter._write_bad_rows_report(
                f"validate_{file_type}_{Path(file_path).stem}",
                bad_rows
            )
            click.echo(f"\n  详细错误报告: {bad_rows_path}")
        else:
            click.echo("\n  文件格式验证通过，没有发现解析错误")
    
    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)


@cli.command()
@click.argument('output_dir', type=click.Path(), default='sample_data')
def generate_samples(output_dir: str):
    """生成示例数据文件
    
    创建CSV格式的示例数据文件，用于测试审计功能。
    """
    from datetime import datetime, timedelta, date
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    click.echo(f"生成示例数据到: {output_dir}")
    
    orders_csv = output_path / 'orders.csv'
    with open(orders_csv, 'w', encoding='utf-8-sig', newline='') as f:
        import csv as csv_module
        writer = csv_module.writer(f)
        writer.writerow([
            'order_id', 'customer_id', 'customer_name', 'equipment_id',
            'equipment_name', 'rental_start_date', 'rental_end_date',
            'daily_rate', 'deposit_amount', 'status', 'actual_return_date',
            'created_at'
        ])
        
        writer.writerow([
            'ORD001', 'CUST001', '张三', 'CAM001',
            '佳能 EOS R5 套机', '2024-01-15', '2024-01-20',
            '300', '5000', 'returned', '2024-01-20',
            '2024-01-15T10:00:00'
        ])
        writer.writerow([
            'ORD002', 'CUST002', '李四', 'CAM002',
            '索尼 A7S III', '2024-01-18', '2024-01-22',
            '280', '4500', 'overdue', '',
            '2024-01-18T14:30:00'
        ])
        writer.writerow([
            'ORD003', 'CUST003', '王五', 'LEN001',
            '索尼 24-70mm f/2.8 GM', '2024-01-20', '2024-01-25',
            '120', '2000', 'active', '',
            '2024-01-20T09:15:00'
        ])
        writer.writerow([
            'ORD004', 'CUST004', '赵六', 'LIGHT001',
            '神牛 SL60W 补光灯', '2024-01-21', '2024-01-23',
            '50', '800', 'settled', '2024-01-23',
            '2024-01-21T11:00:00'
        ])
    
    click.echo(f"  创建订单文件: {orders_csv}")
    
    transactions_csv = output_path / 'transactions.csv'
    with open(transactions_csv, 'w', encoding='utf-8-sig', newline='') as f:
        import csv as csv_module
        writer = csv_module.writer(f)
        writer.writerow([
            'transaction_id', 'order_id', 'transaction_type', 'amount',
            'currency', 'transaction_date', 'status', 'payment_method',
            'reference_no'
        ])
        
        writer.writerow([
            'TRX001', 'ORD001', 'deposit_freeze', '5000', 'CNY',
            '2024-01-15T10:30:00', 'frozen', 'credit_card', 'REF001'
        ])
        writer.writerow([
            'TRX002', 'ORD001', 'deposit_release', '5000', 'CNY',
            '2024-01-20T16:00:00', 'released', 'credit_card', 'REF002'
        ])
        writer.writerow([
            'TRX003', 'ORD002', 'deposit_freeze', '4500', 'CNY',
            '2024-01-18T15:00:00', 'frozen', 'wechat', 'REF003'
        ])
        writer.writerow([
            'TRX004', 'ORD003', 'deposit_freeze', '2000', 'CNY',
            '2024-01-20T09:30:00', 'frozen', 'alipay', 'REF004'
        ])
        writer.writerow([
            'TRX005', 'ORD004', 'deposit_freeze', '800', 'CNY',
            '2024-01-21T11:30:00', 'frozen', 'credit_card', 'REF005'
        ])
        writer.writerow([
            'TRX006', 'ORD004', 'damage_deduction', '150', 'CNY',
            '2024-01-23T17:00:00', 'partial_deducted', 'credit_card', 'REF006'
        ])
        writer.writerow([
            'TRX007', 'ORD004', 'deposit_release', '650', 'CNY',
            '2024-01-23T17:05:00', 'released', 'credit_card', 'REF007'
        ])
    
    click.echo(f"  创建交易记录文件: {transactions_csv}")
    
    damages_csv = output_path / 'damages.csv'
    with open(damages_csv, 'w', encoding='utf-8-sig', newline='') as f:
        import csv as csv_module
        writer = csv_module.writer(f)
        writer.writerow([
            'damage_id', 'order_id', 'equipment_id', 'damage_description',
            'severity', 'repair_cost', 'reported_date', 'reported_by',
            'photos_attached', 'is_verified'
        ])
        
        writer.writerow([
            'DMG001', 'ORD004', 'LIGHT001', '灯架轻微划痕',
            'minor', '150', '2024-01-23T16:30:00', 'staff001',
            'photo1.jpg;photo2.jpg', 'true'
        ])
    
    click.echo(f"  创建损坏记录文件: {damages_csv}")
    
    renewals_csv = output_path / 'renewals.csv'
    with open(renewals_csv, 'w', encoding='utf-8-sig', newline='') as f:
        import csv as csv_module
        writer = csv_module.writer(f)
        writer.writerow([
            'renewal_id', 'order_id', 'original_end_date', 'new_end_date',
            'renewal_days', 'renewal_fee', 'application_date', 'approved',
            'approved_by', 'approved_date', 'idempotency_key'
        ])
        
        writer.writerow([
            'REN001', 'ORD002', '2024-01-22', '2024-01-24',
            '2', '560', '2024-01-22T10:00:00', 'true',
            'staff002', '2024-01-22T10:30:00', 'IDEMP_ORD002_001'
        ])
    
    click.echo(f"  创建续租申请文件: {renewals_csv}")
    
    click.echo("\n示例数据生成完成!")
    click.echo("\n可以使用以下命令运行审计:")
    click.echo(f"  rental-audit audit --orders {orders_csv} --transactions {transactions_csv} --damages {damages_csv} --renewals {renewals_csv}")


if __name__ == '__main__':
    cli()
