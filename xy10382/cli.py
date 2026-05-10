#!/usr/bin/env python3
import click
import sys
import json
import os
from typing import List, Optional

from core import DataStorage, LedgerManager, Validator, OverdueCalculator
from models import Farmer, Sale, Payment, ReturnItem, Deduction
from utils import format_ledger, format_collection_list, format_error, format_report, format_currency


@click.group()
@click.option('--data-dir', default='data', help='数据目录路径')
@click.pass_context
def main(ctx, data_dir):
    ctx.ensure_object(dict)
    ctx.obj['storage'] = DataStorage(data_dir)
    ctx.obj['validator'] = Validator(ctx.obj['storage'])
    ctx.obj['ledger'] = LedgerManager(ctx.obj['storage'])


@main.group()
def farmer():
    pass


@farmer.command('add')
@click.option('--name', required=True, help='农户姓名')
@click.option('--phone', required=True, help='联系电话')
@click.option('--address', default='', help='详细地址')
@click.option('--village', default='', help='所在村庄')
@click.pass_context
def add_farmer(ctx, name, phone, address, village):
    storage = ctx.obj['storage']
    validator = ctx.obj['validator']

    farmer = Farmer(
        id='',
        name=name,
        phone=phone,
        address=address,
        village=village
    )

    raw_input = f'name={name}, phone={phone}'
    result = validator.validate_farmer(farmer, raw_input=raw_input)

    if not result.valid:
        click.echo(format_error(result))
        sys.exit(1)

    for warn in result.warnings:
        click.echo(f'⚠️  {warn}')

    storage.add_farmer(farmer)
    click.echo(f'✅ 已添加农户: {farmer.name} (ID: {farmer.id})')


@farmer.command('list')
@click.pass_context
def list_farmers(ctx):
    storage = ctx.obj['storage']
    farmers = storage.get_farmers()

    if not farmers:
        click.echo('暂无农户档案')
        return

    click.echo('=' * 80)
    click.echo('  农户列表')
    click.echo('=' * 80)
    for farmer in farmers:
        click.echo(f'  {farmer.id[:12]}...  {farmer.name:10s}  {farmer.phone:15s}  {farmer.village}')
    click.echo(f'  共 {len(farmers)} 户')


@main.group()
def sale():
    pass


@sale.command('add')
@click.option('--farmer-id', required=True, help='农户ID')
@click.option('--date', required=True, help='赊销日期 (YYYY-MM-DD)')
@click.option('--due-date', default=None, help='到期日期 (YYYY-MM-DD)')
@click.option('--items', required=True, help='商品列表 JSON 格式: [{"name":"农药","qty":10,"price":50}]')
@click.option('--remark', default='', help='备注')
@click.pass_context
def add_sale(ctx, farmer_id, date, due_date, items, remark):
    storage = ctx.obj['storage']
    validator = ctx.obj['validator']

    try:
        items_data = json.loads(items)
    except json.JSONDecodeError:
        click.echo('❌ 商品列表 JSON 格式错误')
        sys.exit(1)

    sale_items = []
    for item in items_data:
        sale_items.append({
            'product_name': item.get('name', ''),
            'unit': item.get('unit', '件'),
            'quantity': item.get('qty', 0),
            'unit_price': item.get('price', 0)
        })

    sale = Sale.from_dict({
        'farmer_id': farmer_id,
        'sale_date': date,
        'due_date': due_date,
        'items': sale_items,
        'remark': remark
    })

    raw_input = f'farmer_id={farmer_id}, date={date}, items={items}'
    result = validator.validate_sale(sale, raw_input=raw_input)

    if not result.valid:
        click.echo(format_error(result, '新增赊销失败'))
        sys.exit(1)

    for warn in result.warnings:
        click.echo(f'⚠️  {warn}')

    storage.add_sale(sale)
    click.echo(f'✅ 已添加赊销单: {sale.id}')
    click.echo(f'   金额: {format_currency(sale.total_amount)}')
    if due_date:
        click.echo(f'   到期日期: {due_date}')


@sale.command('list')
@click.option('--farmer-id', default=None, help='筛选农户ID')
@click.pass_context
def list_sales(ctx, farmer_id):
    storage = ctx.obj['storage']

    if farmer_id:
        sales = storage.get_sales_by_farmer(farmer_id)
    else:
        sales = storage.get_sales()

    if not sales:
        click.echo('暂无赊销记录')
        return

    click.echo('=' * 80)
    click.echo('  赊销单列表')
    click.echo('=' * 80)
    for sale in sales:
        farmer = storage.get_farmer_by_id(sale.farmer_id)
        farmer_name = farmer.name if farmer else '未知'
        due_str = f' -> {sale.due_date}' if sale.due_date else ''
        click.echo(f'  {sale.id[:12]}...  {farmer_name:10s}  {sale.sale_date}{due_str}  {format_currency(sale.total_amount)}')
    click.echo(f'  共 {len(sales)} 笔')


@main.group()
def payment():
    pass


@payment.command('add')
@click.option('--farmer-id', required=True, help='农户ID')
@click.option('--amount', required=True, type=float, help='回款金额')
@click.option('--date', required=True, help='回款日期 (YYYY-MM-DD)')
@click.option('--receipt', default='', help='收据号')
@click.option('--method', default='现金', help='付款方式')
@click.option('--remark', default='', help='备注')
@click.pass_context
def add_payment(ctx, farmer_id, amount, date, receipt, method, remark):
    storage = ctx.obj['storage']
    validator = ctx.obj['validator']

    payment = Payment.from_dict({
        'farmer_id': farmer_id,
        'payment_date': date,
        'amount': amount,
        'receipt_no': receipt,
        'payment_method': method,
        'remark': remark
    })

    raw_input = f'farmer_id={farmer_id}, amount={amount}, date={date}, receipt={receipt}'
    result = validator.validate_payment(payment, raw_input=raw_input)

    if not result.valid:
        click.echo(format_error(result, '回款导入失败'))
        sys.exit(1)

    storage.add_payment(payment)
    click.echo(f'✅ 已登记回款: {format_currency(amount)}')
    click.echo(f'   日期: {date}')
    if receipt:
        click.echo(f'   收据号: {receipt}')


@payment.command('list')
@click.option('--farmer-id', default=None, help='筛选农户ID')
@click.pass_context
def list_payments(ctx, farmer_id):
    storage = ctx.obj['storage']

    if farmer_id:
        payments = storage.get_payments_by_farmer(farmer_id)
    else:
        payments = storage.get_payments()

    if not payments:
        click.echo('暂无回款记录')
        return

    click.echo('=' * 80)
    click.echo('  回款记录列表')
    click.echo('=' * 80)
    for payment in payments:
        farmer = storage.get_farmer_by_id(payment.farmer_id)
        farmer_name = farmer.name if farmer else '未知'
        receipt_str = f' [{payment.receipt_no}]' if payment.receipt_no else ''
        click.echo(f'  {payment.payment_date}  {farmer_name:10s}  {format_currency(payment.amount):>10s}  {payment.payment_method}{receipt_str}')
    click.echo(f'  共 {len(payments)} 笔')


@main.group()
def return_():
    pass


@return_.command('add')
@click.option('--farmer-id', required=True, help='农户ID')
@click.option('--sale-id', required=True, help='原赊销单ID')
@click.option('--product', required=True, help='商品名称')
@click.option('--qty', required=True, type=float, help='退货数量')
@click.option('--price', required=True, type=float, help='退货单价')
@click.option('--date', required=True, help='退货日期 (YYYY-MM-DD)')
@click.option('--reason', default='', help='退货原因')
@click.option('--remark', default='', help='备注')
@click.pass_context
def add_return(ctx, farmer_id, sale_id, product, qty, price, date, reason, remark):
    storage = ctx.obj['storage']
    validator = ctx.obj['validator']

    return_item = ReturnItem.from_dict({
        'farmer_id': farmer_id,
        'sale_id': sale_id,
        'return_date': date,
        'product_name': product,
        'quantity': qty,
        'unit_price': price,
        'reason': reason,
        'remark': remark
    })

    raw_input = f'farmer_id={farmer_id}, sale_id={sale_id}, product={product}, qty={qty}, date={date}'
    result = validator.validate_return(return_item, raw_input=raw_input)

    if not result.valid:
        click.echo(format_error(result, '退货登记失败'))
        sys.exit(1)

    storage.add_return(return_item)
    click.echo(f'✅ 已登记退货: {product} x {qty}')
    click.echo(f'   金额: {format_currency(return_item.amount)}')


@main.group()
def deduction():
    pass


@deduction.command('add')
@click.option('--farmer-id', required=True, help='农户ID')
@click.option('--amount', required=True, type=float, help='抵扣金额')
@click.option('--date', required=True, help='抵扣日期 (YYYY-MM-DD)')
@click.option('--evidence', required=True, help='抵扣凭证号/说明')
@click.option('--reason', required=True, help='抵扣原因')
@click.option('--remark', default='', help='备注')
@click.pass_context
def add_deduction(ctx, farmer_id, amount, date, evidence, reason, remark):
    storage = ctx.obj['storage']
    validator = ctx.obj['validator']

    deduction = Deduction.from_dict({
        'farmer_id': farmer_id,
        'deduction_date': date,
        'amount': amount,
        'evidence': evidence,
        'reason': reason,
        'remark': remark
    })

    raw_input = f'farmer_id={farmer_id}, amount={amount}, date={date}, evidence={evidence}'
    result = validator.validate_deduction(deduction, raw_input=raw_input)

    if not result.valid:
        click.echo(format_error(result, '抵扣登记失败'))
        sys.exit(1)

    storage.add_deduction(deduction)
    click.echo(f'✅ 已登记抵扣: {format_currency(amount)}')
    click.echo(f'   原因: {reason}')
    click.echo(f'   凭证: {evidence}')


@main.command()
@click.option('--farmer-id', required=True, help='农户ID')
@click.pass_context
def ledger(ctx, farmer_id):
    ledger_mgr = ctx.obj['ledger']

    farmer_ledger = ledger_mgr.get_farmer_ledger(farmer_id)
    if not farmer_ledger:
        click.echo(f'❌ 未找到农户: {farmer_id}')
        sys.exit(1)

    click.echo(format_ledger(farmer_ledger))


@main.command('collection-list')
@click.pass_context
def collection_list(ctx):
    ledger_mgr = ctx.obj['ledger']
    list_data = ledger_mgr.get_collection_list()
    click.echo(format_collection_list(list_data))


@main.command('export-report')
@click.option('--farmer-id', required=True, help='农户ID')
@click.option('--output', required=True, help='输出文件路径')
@click.pass_context
def export_report(ctx, farmer_id, output):
    ledger_mgr = ctx.obj['ledger']

    farmer_ledger = ledger_mgr.get_farmer_ledger(farmer_id)
    if not farmer_ledger:
        click.echo(f'❌ 未找到农户: {farmer_id}')
        sys.exit(1)

    report_content = format_report(farmer_ledger)
    with open(output, 'w', encoding='utf-8') as f:
        f.write(report_content)
    click.echo(f'✅ 对账报告已导出: {output}')


@main.command('import')
@click.option('--type', 'import_type', required=True, type=click.Choice(['farmers', 'sales', 'payments', 'returns', 'deductions']),
              help='导入类型')
@click.option('--file', 'import_file', required=True, help='JSON 数据文件')
@click.pass_context
def import_data(ctx, import_type, import_file):
    storage = ctx.obj['storage']
    validator = ctx.obj['validator']

    with open(import_file, 'r', encoding='utf-8') as f:
        raw_data = f.read()
        data = json.loads(raw_data)

    if not isinstance(data, list):
        click.echo('❌ 数据必须是数组格式')
        sys.exit(1)

    success_count = 0
    fail_count = 0
    errors = []

    for i, item in enumerate(data):
        item_json = json.dumps(item, ensure_ascii=False)
        try:
            if import_type == 'farmers':
                obj = Farmer.from_dict(item)
                result = validator.validate_farmer(obj, raw_input=item_json)
                if result.valid:
                    storage.add_farmer(obj)
                    success_count += 1
                else:
                    fail_count += 1
                    errors.append(f'第 {i+1} 条: {format_error(result)}')

            elif import_type == 'sales':
                obj = Sale.from_dict(item)
                result = validator.validate_sale(obj, raw_input=item_json)
                if result.valid:
                    storage.add_sale(obj)
                    success_count += 1
                else:
                    fail_count += 1
                    errors.append(f'第 {i+1} 条: {format_error(result)}')

            elif import_type == 'payments':
                obj = Payment.from_dict(item)
                result = validator.validate_payment(obj, raw_input=item_json)
                if result.valid:
                    storage.add_payment(obj)
                    success_count += 1
                else:
                    fail_count += 1
                    errors.append(f'第 {i+1} 条: {format_error(result)}')

            elif import_type == 'returns':
                obj = ReturnItem.from_dict(item)
                result = validator.validate_return(obj, raw_input=item_json)
                if result.valid:
                    storage.add_return(obj)
                    success_count += 1
                else:
                    fail_count += 1
                    errors.append(f'第 {i+1} 条: {format_error(result)}')

            elif import_type == 'deductions':
                obj = Deduction.from_dict(item)
                result = validator.validate_deduction(obj, raw_input=item_json)
                if result.valid:
                    storage.add_deduction(obj)
                    success_count += 1
                else:
                    fail_count += 1
                    errors.append(f'第 {i+1} 条: {format_error(result)}')

        except Exception as e:
            fail_count += 1
            errors.append(f'第 {i+1} 条: ❌ 解析错误 - {str(e)} (原始输入: {item_json})')

    click.echo('=' * 80)
    click.echo(f'  导入结果: 成功 {success_count} 条, 失败 {fail_count} 条')
    if errors:
        click.echo('-' * 80)
        for err in errors:
            click.echo(err)
    click.echo('=' * 80)


if __name__ == '__main__':
    main()
