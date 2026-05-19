#!/usr/bin/env python3
import click
from datetime import date, datetime
from typing import Optional

from database import SessionLocal, init_db
from compensation_service import CompensationService
from export_service import ExportService
from schemas import (
    ShortageIdentifyRequest, ShortageConfirmRequest,
    CompensationRequest, RollbackRequest, SettlementRequest,
    ExportRequest, OperatorContext, Role, CompensationType
)


def get_operator_context(
    role: str = "operator",
    operator_id: str = "cli_user",
    operator_name: str = "CLI用户"
) -> OperatorContext:
    return OperatorContext(
        operator_role=Role(role),
        operator_id=operator_id,
        operator_name=operator_name
    )


@click.group()
def cli():
    """生鲜缺货补偿系统命令行工具"""
    init_db()


@cli.command()
@click.argument('order_no')
@click.argument('product_id')
@click.argument('shortage_quantity', type=int)
@click.option('--remark', help='备注')
@click.option('--role', default='operator', help='角色: admin/operator/finance/customer_service/viewer')
def identify(order_no, product_id, shortage_quantity, remark, role):
    """识别缺货"""
    db = SessionLocal()
    service = CompensationService(db)
    request = ShortageIdentifyRequest(
        order_no=order_no,
        product_id=product_id,
        shortage_quantity=shortage_quantity,
        remark=remark
    )
    result = service.identify_shortage(request, get_operator_context(role=role))
    click.echo(f"成功: {result.success}")
    click.echo(f"消息: {result.message}")
    if result.data:
        click.echo(f"数据: {result.data}")
    if result.rule_results:
        click.echo("\n规则校验结果:")
        for r in result.rule_results:
            status = "✓" if r.passed else "✗"
            click.echo(f"  {status} {r.rule_name}: {r.reason}")


@cli.command()
@click.argument('shortage_no')
@click.option('--cancel', is_flag=True, help='取消（不确认）')
@click.option('--remark', help='备注')
@click.option('--role', default='operator', help='角色')
def confirm(shortage_no, cancel, remark, role):
    """确认缺货"""
    db = SessionLocal()
    service = CompensationService(db)
    request = ShortageConfirmRequest(
        shortage_no=shortage_no,
        confirmed=not cancel,
        remark=remark
    )
    result = service.confirm_shortage(request, get_operator_context(role=role))
    click.echo(f"成功: {result.success}")
    click.echo(f"消息: {result.message}")
    if result.data:
        click.echo(f"数据: {result.data}")
    if result.rule_results:
        click.echo("\n规则校验结果:")
        for r in result.rule_results:
            status = "✓" if r.passed else "✗"
            click.echo(f"  {status} {r.rule_name}: {r.reason}")


@cli.command()
@click.argument('shortage_no')
@click.option('--type', 'compensation_type', default='refund', 
              type=click.Choice(['refund', 'coupon', 'exchange', 'partial_refund']),
              help='补偿类型')
@click.option('--amount', type=float, help='退款金额')
@click.option('--coupon-value', type=float, help='券面值')
@click.option('--coupon-expiry-days', type=int, default=30, help='券有效期(天)')
@click.option('--exchange-product-id', help='换货商品ID')
@click.option('--exchange-product-name', help='换货商品名称')
@click.option('--remark', help='备注')
@click.option('--role', default='operator', help='角色')
def compensate(shortage_no, compensation_type, amount, coupon_value, 
               coupon_expiry_days, exchange_product_id, exchange_product_name, remark, role):
    """处理补偿"""
    db = SessionLocal()
    service = CompensationService(db)
    request = CompensationRequest(
        shortage_no=shortage_no,
        compensation_type=CompensationType(compensation_type),
        amount=amount,
        coupon_value=coupon_value,
        coupon_expiry_days=coupon_expiry_days,
        exchange_product_id=exchange_product_id,
        exchange_product_name=exchange_product_name,
        remark=remark
    )
    result = service.process_compensation(request, get_operator_context(role=role))
    click.echo(f"成功: {result.success}")
    click.echo(f"消息: {result.message}")
    if result.data:
        click.echo(f"数据: {result.data}")
    if result.rule_results:
        click.echo("\n规则校验结果:")
        for r in result.rule_results:
            status = "✓" if r.passed else "✗"
            click.echo(f"  {status} {r.rule_name}: {r.reason}")


@cli.command()
@click.argument('compensation_no')
@click.argument('reason')
@click.option('--role', default='finance', help='角色')
def rollback(compensation_no, reason, role):
    """回滚补偿"""
    db = SessionLocal()
    service = CompensationService(db)
    request = RollbackRequest(
        compensation_no=compensation_no,
        reason=reason
    )
    result = service.rollback_compensation(request, get_operator_context(role=role))
    click.echo(f"成功: {result.success}")
    click.echo(f"消息: {result.message}")
    if result.data:
        click.echo(f"数据: {result.data}")
    if result.rule_results:
        click.echo("\n规则校验结果:")
        for r in result.rule_results:
            status = "✓" if r.passed else "✗"
            click.echo(f"  {status} {r.rule_name}: {r.reason}")


@cli.command()
@click.option('--start-date', required=True, help='开始日期 YYYY-MM-DD')
@click.option('--end-date', required=True, help='结束日期 YYYY-MM-DD')
@click.option('--remark', help='备注')
@click.option('--role', default='finance', help='角色')
def settle(start_date, end_date, remark, role):
    """结算处理"""
    db = SessionLocal()
    service = CompensationService(db)
    request = SettlementRequest(
        start_date=datetime.strptime(start_date, '%Y-%m-%d').date(),
        end_date=datetime.strptime(end_date, '%Y-%m-%d').date(),
        remark=remark
    )
    result = service.process_settlement(request, get_operator_context(role=role))
    click.echo(f"成功: {result.success}")
    click.echo(f"消息: {result.message}")
    if result.data:
        for k, v in result.data.items():
            click.echo(f"  {k}: {v}")
    if result.rule_results:
        click.echo("\n规则校验结果:")
        for r in result.rule_results:
            status = "✓" if r.passed else "✗"
            click.echo(f"  {status} {r.rule_name}: {r.reason}")


@cli.command()
@click.option('--type', 'export_type', default='shortage', 
              type=click.Choice(['shortage', 'compensation', 'settlement']),
              help='导出类型')
@click.option('--start-date', required=True, help='开始日期 YYYY-MM-DD')
@click.option('--end-date', required=True, help='结束日期 YYYY-MM-DD')
@click.option('--format', 'export_format', default='xlsx', 
              type=click.Choice(['xlsx', 'csv']),
              help='导出格式')
@click.option('--include-sensitive', is_flag=True, help='包含敏感数据(需权限)')
@click.option('--role', default='operator', help='角色')
def export(export_type, start_date, end_date, export_format, include_sensitive, role):
    """导出数据"""
    db = SessionLocal()
    service = ExportService(db)
    request = ExportRequest(
        start_date=datetime.strptime(start_date, '%Y-%m-%d').date(),
        end_date=datetime.strptime(end_date, '%Y-%m-%d').date(),
        export_type=export_type,
        include_sensitive=include_sensitive
    )
    result = service.export_to_file(request, get_operator_context(role=role), export_format)
    click.echo(f"成功: {result.get('success')}")
    click.echo(f"消息: {result.get('message')}")
    if result.get('filepath'):
        click.echo(f"导出文件: {result.get('filepath')}")
    if result.get('count'):
        click.echo(f"记录数: {result.get('count')}")


@cli.command()
@click.argument('order_no')
@click.argument('customer_id')
@click.argument('customer_name')
@click.argument('customer_phone')
@click.argument('total_amount', type=float)
@click.option('--item', multiple=True, nargs=3, type=(str, int, float), 
              help='商品项: product_id quantity unit_price')
@click.option('--delivery-date', help='配送日期 YYYY-MM-DD')
@click.option('--role', default='operator', help='角色')
def create_order(order_no, customer_id, customer_name, customer_phone, 
                 total_amount, item, delivery_date, role):
    """创建订单"""
    from models import Order, OrderItem
    db = SessionLocal()
    
    db_order = Order(
        order_no=order_no,
        customer_id=customer_id,
        customer_name=customer_name,
        customer_phone=customer_phone,
        total_amount=total_amount,
        delivery_date=datetime.strptime(delivery_date, '%Y-%m-%d').date() if delivery_date else None
    )
    db.add(db_order)
    db.flush()
    
    for product_id, quantity, unit_price in item:
        db_item = OrderItem(
            order_id=db_order.id,
            product_id=product_id,
            product_name=f"商品{product_id}",
            quantity=quantity,
            unit_price=unit_price,
            subtotal=quantity * unit_price
        )
        db.add(db_item)
    
    db.commit()
    click.echo(f"订单创建成功: {order_no}")
    click.echo(f"包含商品: {len(item)} 件")


if __name__ == '__main__':
    cli()
