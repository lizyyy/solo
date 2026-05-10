import click
from tabulate import tabulate
from datetime import date, datetime
from typing import List
import csv

from prescription_refill.database import init_db, reset_db
from prescription_refill import services
from prescription_refill.models import RefillItem


def format_date(d: date) -> str:
    return d.strftime('%Y-%m-%d')


def format_warnings(warnings: List[str]) -> str:
    if not warnings:
        return ''
    return '; '.join(f'[!] {w}' for w in warnings)


def print_contact_list(items: List[RefillItem]):
    if not items:
        click.echo("今日无需要联系的顾客")
        return

    table_data = []
    total_estimated = 0.0
    status_count = {'续配窗口': 0, '已过期': 0, '异常': 0, '其他': 0}
    warning_count = 0
    unique_customers = set()

    for item in items:
        unique_customers.add(item.customer_id)
        total_estimated += item.estimated_amount
        if item.status in status_count:
            status_count[item.status] += 1
        else:
            status_count['其他'] += 1
        if item.warnings:
            warning_count += 1

        table_data.append([
            item.customer_code,
            item.customer_name,
            item.phone,
            item.drug_name,
            item.status,
            item.days_remaining,
            format_date(item.last_sale_date),
            format_date(item.estimated_finish_date),
            f"{item.quantity_needed}",
            f"{item.estimated_amount:.2f}",
            format_warnings(item.warnings),
        ])

    headers = [
        '顾客编码', '姓名', '电话', '药品', '状态',
        '剩余天数', '上次购药', '预计用完', '需配数量',
        '预估金额', '备注/警告'
    ]

    click.echo("\n" + "=" * 120)
    click.echo(f"今日续配联系清单 - {date.today().strftime('%Y-%m-%d')}")
    click.echo("=" * 120)
    click.echo(tabulate(table_data, headers=headers, tablefmt='simple'))
    click.echo("=" * 120)

    click.echo(f"\n【汇总信息】")
    click.echo(f"  - 需要联系顾客数: {len(unique_customers)} 人")
    click.echo(f"  - 待续配药品数: {len(items)} 种")
    click.echo(f"  - 续配窗口: {status_count['续配窗口']} 种 | 已过期: {status_count['已过期']} 种 | 异常: {status_count['异常']} 种")
    click.echo(f"  - 有警告信息: {warning_count} 种")
    click.echo(f"  - 预估总金额: {total_estimated:.2f} 元")


def print_customer_detail(customer_code: str):
    customer = services.get_customer_by_code(customer_code)
    if not customer:
        click.echo(f"未找到顾客: {customer_code}")
        return

    click.echo("\n" + "=" * 80)
    click.echo(f"顾客明细: {customer.name} ({customer.customer_code})")
    click.echo("=" * 80)

    click.echo(f"\n【基本信息】")
    click.echo(f"  电话: {customer.phone or '-'}")
    click.echo(f"  疾病类型: {customer.disease_type or '-'}")
    click.echo(f"  备注: {customer.notes or '-'}")

    sales = services.get_customer_sales_history(customer.id)
    click.echo(f"\n【购药历史】共 {len(sales)} 次")
    if sales:
        table_data = []
        total_amount = 0.0
        for record in sales:
            total_amount += record.total_amount
            items_str = '; '.join(f"{it.drug_name}×{it.quantity}" for it in record.items)
            table_data.append([
                record.sale_date,
                record.receipt_no,
                items_str,
                f"{record.total_amount:.2f}",
            ])
        click.echo(tabulate(table_data, headers=['日期', '小票号', '商品', '金额'], tablefmt='simple'))
        click.echo(f"  历史总金额: {total_amount:.2f} 元")

    refills, _ = services.calculate_refill_for_customer(customer)
    click.echo(f"\n【续配状态】")
    if refills:
        table_data = []
        total_estimated = 0.0
        for item in refills:
            total_estimated += item.estimated_amount
            table_data.append([
                item.drug_name,
                item.status,
                item.days_remaining,
                format_date(item.last_sale_date),
                format_date(item.estimated_finish_date),
                f"{item.quantity_needed}",
                f"{item.estimated_amount:.2f}",
                format_warnings(item.warnings),
            ])
        click.echo(tabulate(
            table_data,
            headers=['药品', '状态', '剩余天数', '上次购药', '预计用完', '需配数量', '预估金额', '警告'],
            tablefmt='simple'
        ))
        click.echo(f"  预估续配总金额: {total_estimated:.2f} 元")

    logs = services.get_contact_logs(customer_code)
    if logs:
        click.echo(f"\n【联系记录】")
        table_data = []
        for log in logs:
            table_data.append([
                log.contact_date,
                log.contacted_by or '-',
                log.status or '-',
                log.notes or '-',
            ])
        click.echo(tabulate(table_data, headers=['日期', '联系人员', '状态', '备注'], tablefmt='simple'))


def export_report(csv_path: str, items: List[RefillItem]):
    with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            '顾客编码', '姓名', '电话', '疾病类型', '药品', '状态',
            '剩余天数', '上次购药日期', '预计用完日期',
            '续配窗口开始', '续配窗口结束', '需配数量',
            '单价', '预估金额', '警告信息'
        ])
        for item in items:
            customer = services.get_customer_by_code(item.customer_code)
            disease_type = customer.disease_type if customer else ''
            writer.writerow([
                item.customer_code,
                item.customer_name,
                item.phone,
                disease_type,
                item.drug_name,
                item.status,
                item.days_remaining,
                format_date(item.last_sale_date),
                format_date(item.estimated_finish_date),
                format_date(item.refill_window_start),
                format_date(item.refill_window_end),
                item.quantity_needed,
                item.unit_price,
                item.estimated_amount,
                format_warnings(item.warnings),
            ])


@click.group()
def main():
    """药店慢病用药续配管理工具"""
    init_db()


@main.command()
def init():
    """初始化数据库"""
    reset_db()
    click.echo("数据库初始化完成")


@main.group('import')
def import_():
    """导入数据"""
    pass


@import_.command('customers')
@click.argument('csv_path', type=click.Path(exists=True))
def import_customers(csv_path):
    """导入顾客档案 CSV"""
    count, errors = services.import_customers(csv_path)
    click.echo(f"导入顾客: {count} 条")
    if errors:
        click.echo(f"错误: {len(errors)} 条")
        for e in errors[:10]:
            click.echo(f"  - {e}")


@import_.command('drugs')
@click.argument('csv_path', type=click.Path(exists=True))
def import_drugs(csv_path):
    """导入药品信息 CSV"""
    count, errors = services.import_drugs(csv_path)
    click.echo(f"导入药品: {count} 条")
    if errors:
        click.echo(f"错误: {len(errors)} 条")
        for e in errors[:10]:
            click.echo(f"  - {e}")


@import_.command('rules')
@click.argument('csv_path', type=click.Path(exists=True))
def import_rules(csv_path):
    """导入药品规则 CSV"""
    count, errors = services.import_drug_rules(csv_path)
    click.echo(f"导入规则: {count} 条")
    if errors:
        click.echo(f"错误: {len(errors)} 条")
        for e in errors[:10]:
            click.echo(f"  - {e}")


@import_.command('contraindications')
@click.argument('csv_path', type=click.Path(exists=True))
def import_contraindications(csv_path):
    """导入药品禁忌 CSV"""
    count, errors = services.import_contraindications(csv_path)
    click.echo(f"导入禁忌: {count} 条")
    if errors:
        click.echo(f"错误: {len(errors)} 条")
        for e in errors[:10]:
            click.echo(f"  - {e}")


@import_.command('inventory')
@click.argument('csv_path', type=click.Path(exists=True))
def import_inventory(csv_path):
    """导入库存 CSV"""
    count, errors = services.import_inventory(csv_path)
    click.echo(f"导入库存: {count} 条")
    if errors:
        click.echo(f"错误: {len(errors)} 条")
        for e in errors[:10]:
            click.echo(f"  - {e}")


@import_.command('sales')
@click.argument('csv_path', type=click.Path(exists=True))
def import_sales(csv_path):
    """导入销售记录 CSV（自动跳过重复小票）"""
    count, warnings, errors = services.import_sales(csv_path)
    click.echo(f"导入销售: {count} 条")
    if warnings:
        click.echo(f"警告: {len(warnings)} 条")
        for w in warnings[:10]:
            click.echo(f"  - {w}")
    if errors:
        click.echo(f"错误: {len(errors)} 条")
        for e in errors[:10]:
            click.echo(f"  - {e}")


@main.command('today')
@click.option('--date', 'date_str', default=None, help='指定日期 (YYYY-MM-DD)，用于重新计算')
def today_list(date_str):
    """今日续配联系清单"""
    if date_str:
        try:
            today = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            click.echo("日期格式错误，请使用 YYYY-MM-DD")
            return
    else:
        today = date.today()

    items = services.get_today_contact_list(today)
    print_contact_list(items)


@main.command('customer')
@click.argument('customer_code')
def customer_detail(customer_code):
    """查看顾客明细"""
    print_customer_detail(customer_code)


@main.command('mark')
@click.argument('customer_code')
@click.option('--by', 'contacted_by', default='', help='联系人员')
@click.option('--status', default='已联系', help='联系状态')
@click.option('--notes', default='', help='备注')
def mark_contacted(customer_code, contacted_by, status, notes):
    """标记已联系"""
    success = services.mark_contacted(customer_code, contacted_by, status, notes)
    if success:
        click.echo(f"已标记: {customer_code} [{status}]")
    else:
        click.echo(f"未找到顾客: {customer_code}")


@main.command('export')
@click.argument('csv_path', type=click.Path())
@click.option('--date', 'date_str', default=None, help='指定日期 (YYYY-MM-DD)')
def export_refill_report(csv_path, date_str):
    """导出续配报告 CSV"""
    if date_str:
        try:
            today = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            click.echo("日期格式错误，请使用 YYYY-MM-DD")
            return
    else:
        today = date.today()

    items = services.get_today_contact_list(today)
    export_report(csv_path, items)
    click.echo(f"报告已导出: {csv_path}")
    click.echo(f"共 {len(items)} 条记录")


@main.command('recalc')
@click.option('--date', 'date_str', default=None, help='指定日期 (YYYY-MM-DD)')
def recalculate(date_str):
    """重新计算所有续配状态（修改数据后使用）"""
    if date_str:
        try:
            today = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            click.echo("日期格式错误，请使用 YYYY-MM-DD")
            return
    else:
        today = date.today()

    all_items = services.calculate_all_refills(today)

    status_count = {}
    total_estimated = 0.0
    for item in all_items:
        status_count[item.status] = status_count.get(item.status, 0) + 1
        total_estimated += item.estimated_amount

    click.echo(f"\n重新计算完成 - 基准日期: {today}")
    click.echo(f"总药品记录数: {len(all_items)}")
    for status, count in sorted(status_count.items()):
        click.echo(f"  {status}: {count}")
    click.echo(f"预估总金额: {total_estimated:.2f} 元")


if __name__ == '__main__':
    main()
