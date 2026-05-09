import os
import sys
import json
import logging
from datetime import datetime
from pathlib import Path

import click

from inventory import __version__
from inventory.config import DATABASE_URL, LOG_FILE, LOG_LEVEL
from inventory.utils.database import get_db, init_database
from inventory.seed.seed_data import seed_all
from inventory.models import Store, Product, Inventory, Transfer, PriceChange, AuditLog, User


logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


@click.group()
@click.version_option(__version__)
@click.pass_context
def cli(ctx):
    """门店库存管理命令行工具"""
    ctx.ensure_object(dict)


@cli.group()
def db():
    """数据库操作"""
    pass


@db.command('init')
@click.option('--reset', is_flag=True, help='重置所有表')
def db_init(reset):
    """初始化数据库"""
    click.echo(f'连接数据库: {DATABASE_URL}')
    init_database(reset=reset)
    click.echo(f'数据库初始化完成')


@db.command('seed')
@click.option('--clear', is_flag=True, default=True, help='清空现有数据')
def db_seed(clear):
    """导入种子数据"""
    db = get_db()
    with db.session() as session:
        click.echo('开始导入种子数据...')
        seed_all(session, clear=clear)
        click.echo('种子数据导入完成!')

        store_count = session.query(Store).count()
        product_count = session.query(Product).count()
        inv_count = session.query(Inventory).count()
        user_count = session.query(User).count()

        click.echo(f'  - 门店: {store_count} 家')
        click.echo(f'  - 商品: {product_count} 个')
        click.echo(f'  - 库存记录: {inv_count} 条')
        click.echo(f'  - 用户: {user_count} 个')


@cli.group()
def store():
    """门店管理"""
    pass


@store.command('list')
def store_list():
    """列出所有门店"""
    db = get_db()
    with db.session() as session:
        stores = session.query(Store).order_by(Store.code).all()
        click.echo(f'共 {len(stores)} 家门店:')
        click.echo('-' * 80)
        click.echo(f'{"代码":<10} {"名称":<15} {"城市":<8} {"电话":<15} {"状态":<10}')
        click.echo('-' * 80)
        for s in stores:
            click.echo(f'{s.code:<10} {s.name:<15} {s.city:<8} {s.phone:<15} {s.status:<10}')


@cli.group()
def product():
    """商品管理"""
    pass


@product.command('list')
@click.option('--category', help='按分类筛选')
def product_list(category):
    """列出商品"""
    db = get_db()
    with db.session() as session:
        query = session.query(Product)
        if category:
            query = query.filter(Product.category == category)
        products = query.order_by(Product.sku).all()

        click.echo(f'共 {len(products)} 个商品:')
        click.echo('-' * 80)
        click.echo(f'{"SKU":<10} {"名称":<25} {"分类":<10} {"成本价":<10} {"售价":<10} {"状态":<8}')
        click.echo('-' * 80)
        for p in products:
            click.echo(f'{p.sku:<10} {p.name:<25} {p.category:<10} {p.cost_price:<10.2f} {p.base_sale_price:<10.2f} {p.status:<8}')


@cli.group()
def inventory():
    """库存管理"""
    pass


@inventory.command('list')
@click.option('--store', 'store_code', help='门店代码')
@click.option('--sku', help='商品SKU')
@click.option('--status', type=click.Choice(['normal', 'low_stock', 'negative']), help='库存状态')
def inventory_list(store_code, sku, status):
    """查看库存"""
    db = get_db()
    with db.session() as session:
        from inventory.services.inventory_service import InventoryService

        store_id = None
        product_id = None

        if store_code:
            store = session.query(Store).filter(Store.code == store_code).first()
            store_id = store.id if store else None

        if sku:
            product = session.query(Product).filter(Product.sku == sku).first()
            product_id = product.id if product else None

        inv_service = InventoryService(session)
        items = inv_service.get_inventory(store_id=store_id, product_id=product_id, status=status)

        click.echo(f'共 {len(items)} 条库存记录:')
        click.echo('-' * 120)
        click.echo(f'{"门店":<12} {"SKU":<10} {"商品名":<25} {"库存":<8} {"可用":<8} {"预留":<8} {"售价":<10} {"状态":<12}')
        click.echo('-' * 120)
        for inv in items:
            click.echo(f'{inv.store.code:<12} {inv.product.sku:<10} {inv.product.name:<25} '
                       f'{inv.quantity:<8} {inv.available_quantity:<8} {inv.reserved_quantity:<8} '
                       f'{inv.sale_price:<10.2f} {inv.status:<12}')


@inventory.command('adjust')
@click.option('--store', 'store_code', required=True, help='门店代码')
@click.option('--sku', required=True, help='商品SKU')
@click.option('--qty', 'quantity', type=int, required=True, help='调整数量(正加负减)')
@click.option('--reason', required=True, help='调整原因')
@click.option('--user', default='system', help='操作人')
def inventory_adjust(store_code, sku, quantity, reason, user):
    """调整库存数量"""
    db = get_db()
    with db.session() as session:
        from inventory.services.inventory_service import InventoryService

        store = session.query(Store).filter(Store.code == store_code).first()
        product = session.query(Product).filter(Product.sku == sku).first()

        if not store:
            click.echo(f'错误: 门店 {store_code} 不存在')
            return
        if not product:
            click.echo(f'错误: 商品 {sku} 不存在')
            return

        inv_service = InventoryService(session)
        inv = inv_service.adjust_quantity(
            store_id=store.id,
            product_id=product.id,
            quantity_change=quantity,
            reason=reason,
            username=user
        )

        click.echo(f'库存调整成功!')
        click.echo(f'  门店: {store_code}')
        click.echo(f'  商品: {sku}')
        click.echo(f'  调整量: {quantity:+d}')
        click.echo(f'  当前库存: {inv.quantity}')


@inventory.command('history')
@click.option('--store', 'store_code', required=True, help='门店代码')
@click.option('--sku', required=True, help='商品SKU')
@click.option('--limit', type=int, default=20, help='显示数量')
def inventory_history(store_code, sku, limit):
    """查看库存历史版本"""
    db = get_db()
    with db.session() as session:
        store = session.query(Store).filter(Store.code == store_code).first()
        product = session.query(Product).filter(Product.sku == sku).first()

        if not store or not product:
            click.echo('门店或商品不存在')
            return

        inventory = session.query(Inventory).filter(
            Inventory.store_id == store.id,
            Inventory.product_id == product.id
        ).first()

        if not inventory:
            click.echo('库存记录不存在')
            return

        from inventory.services.inventory_service import InventoryService
        inv_service = InventoryService(session)
        history = inv_service.get_history(inventory.id, limit=limit)

        click.echo(f'库存历史记录 (最近 {len(history)} 条):')
        click.echo('-' * 120)
        click.echo(f'{"版本":<6} {"操作类型":<15} {"时间":<20} {"库存":<8} {"价格":<8} {"操作人":<15} {"原因":<30}')
        click.echo('-' * 120)
        for h in history:
            click.echo(f'{h.version:<6} {h.change_type:<15} {h.changed_at.strftime("%Y-%m-%d %H:%M:%S"):<20} '
                       f'{h.quantity:<8} {h.sale_price:<8.2f} {h.changed_by:<15} {h.change_reason or "":<30}')


@cli.group()
def transfer():
    """库存调拨管理"""
    pass


@transfer.command('list')
@click.option('--status', type=click.Choice(['pending', 'approved', 'in_transit', 'completed', 'failed', 'cancelled']))
def transfer_list(status):
    """列出调拨单"""
    db = get_db()
    with db.session() as session:
        from inventory.services.transfer_service import TransferService
        tf_service = TransferService(session)
        transfers = tf_service.get_transfers(status=status)

        click.echo(f'共 {len(transfers)} 个调拨单:')
        click.echo('-' * 100)
        click.echo(f'{"单号":<15} {"源门店":<12} {"目标门店":<12} {"数量":<8} {"金额":<10} {"状态":<12} {"创建人":<15}')
        click.echo('-' * 100)
        for tf in transfers:
            click.echo(f'{tf.transfer_no:<15} {tf.from_store.code:<12} {tf.to_store.code:<12} '
                       f'{tf.total_quantity:<8} {tf.total_amount:<10.2f} {tf.status:<12} {tf.created_by or "":<15}')


@transfer.command('create')
@click.option('--from', 'from_store', required=True, help='源门店代码')
@click.option('--to', 'to_store', required=True, help='目标门店代码')
@click.option('--item', 'items', multiple=True, required=True, help='商品:SKU=数量 (可多次指定)')
@click.option('--user', default='system', help='操作人')
@click.option('--notes', default='', help='备注')
def transfer_create(from_store, to_store, items, user, notes):
    """创建调拨单"""
    db = get_db()
    with db.session() as session:
        from inventory.services.transfer_service import TransferService

        item_list = []
        for item_str in items:
            try:
                sku, qty = item_str.split('=')
                item_list.append({'sku': sku.strip(), 'quantity': int(qty.strip())})
            except:
                click.echo(f'错误的商品格式: {item_str}，应为 SKU=数量')
                return

        tf_service = TransferService(session)
        transfer = tf_service.create_transfer(
            from_store_code=from_store,
            to_store_code=to_store,
            items=item_list,
            created_by=user,
            notes=notes
        )

        click.echo(f'调拨单创建成功!')
        click.echo(f'  单号: {transfer.transfer_no}')
        click.echo(f'  源门店: {from_store}')
        click.echo(f'  目标门店: {to_store}')
        click.echo(f'  商品数: {len(transfer.items)}')


@transfer.command('approve')
@click.argument('transfer_no')
@click.option('--user', default='system', help='审批人')
def transfer_approve(transfer_no, user):
    """审批调拨单"""
    db = get_db()
    with db.session() as session:
        from inventory.services.transfer_service import TransferService
        tf_service = TransferService(session)
        tf_service.approve_transfer(transfer_no, user)
        click.echo(f'调拨单 {transfer_no} 已审批通过')


@transfer.command('ship')
@click.argument('transfer_no')
@click.option('--user', default='system', help='发货人')
def transfer_ship(transfer_no, user):
    """发货"""
    db = get_db()
    with db.session() as session:
        from inventory.services.transfer_service import TransferService
        tf_service = TransferService(session)
        tf_service.ship_transfer(transfer_no, user)
        click.echo(f'调拨单 {transfer_no} 已发货')


@transfer.command('receive')
@click.argument('transfer_no')
@click.option('--user', default='system', help='收货人')
def transfer_receive(transfer_no, user):
    """收货"""
    db = get_db()
    with db.session() as session:
        from inventory.services.transfer_service import TransferService
        tf_service = TransferService(session)
        tf_service.receive_transfer(transfer_no, user)
        click.echo(f'调拨单 {transfer_no} 已收货完成')


@transfer.command('retry')
@click.argument('transfer_no')
@click.option('--user', default='system', help='操作人')
def transfer_retry(transfer_no, user):
    """重试失败的调拨单"""
    db = get_db()
    with db.session() as session:
        from inventory.services.transfer_service import TransferService
        tf_service = TransferService(session)
        success, msg = tf_service.retry_failed_transfer(transfer_no, user)
        click.echo(msg)


@cli.group()
def price():
    """价格管理"""
    pass


@price.command('list')
@click.option('--status', type=click.Choice(['draft', 'pending', 'approved', 'applied', 'failed', 'cancelled']))
def price_list(status):
    """列出价格调整单"""
    db = get_db()
    with db.session() as session:
        from inventory.services.price_service import PriceService
        pc_service = PriceService(session)
        price_changes = pc_service.get_price_changes(status=status)

        click.echo(f'共 {len(price_changes)} 个价格调整单:')
        click.echo('-' * 100)
        click.echo(f'{"单号":<15} {"门店":<10} {"SKU":<10} {"原价":<10} {"新价":<10} {"状态":<12} {"原因":<20}')
        click.echo('-' * 100)
        for pc in price_changes:
            click.echo(f'{pc.change_no:<15} {pc.store.code:<10} {pc.product.sku:<10} '
                       f'{pc.old_price:<10.2f} {pc.new_price:<10.2f} {pc.status:<12} {(pc.reason or "")[:18]:<20}')


@price.command('create')
@click.option('--store', required=True, help='门店代码')
@click.option('--sku', required=True, help='商品SKU')
@click.option('--new-price', type=float, required=True, help='新价格')
@click.option('--reason', required=True, help='调价原因')
@click.option('--user', default='system', help='操作人')
def price_create(store, sku, new_price, reason, user):
    """创建价格调整单"""
    db = get_db()
    with db.session() as session:
        from inventory.services.price_service import PriceService
        pc_service = PriceService(session)
        pc = pc_service.create_price_change(
            store_code=store,
            sku=sku,
            new_price=new_price,
            reason=reason,
            created_by=user
        )
        click.echo(f'价格调整单创建成功: {pc.change_no}')


@price.command('submit')
@click.argument('change_no')
@click.option('--user', default='system', help='操作人')
def price_submit(change_no, user):
    """提交审批"""
    db = get_db()
    with db.session() as session:
        from inventory.services.price_service import PriceService
        pc_service = PriceService(session)
        pc_service.submit_for_approval(change_no, user)
        click.echo(f'价格调整单 {change_no} 已提交审批')


@price.command('approve')
@click.argument('change_no')
@click.option('--user', default='system', help='审批人')
def price_approve(change_no, user):
    """审批价格调整"""
    db = get_db()
    with db.session() as session:
        from inventory.services.price_service import PriceService
        pc_service = PriceService(session)
        pc_service.approve_price_change(change_no, user)
        click.echo(f'价格调整单 {change_no} 已审批通过')


@price.command('apply')
@click.argument('change_no')
@click.option('--user', default='system', help='执行人')
def price_apply(change_no, user):
    """执行价格调整"""
    db = get_db()
    with db.session() as session:
        from inventory.services.price_service import PriceService
        pc_service = PriceService(session)
        pc_service.apply_price_change(change_no, user)
        click.echo(f'价格调整单 {change_no} 已生效')


@cli.group()
def log():
    """审计日志"""
    pass


@log.command('list')
@click.option('--resource', help='资源类型: STORE/PRODUCT/INVENTORY/TRANSFER/PRICE_CHANGE')
@click.option('--action', help='操作类型')
@click.option('--user', help='操作人')
@click.option('--limit', type=int, default=50, help='显示数量')
def log_list(resource, action, user, limit):
    """查看审计日志"""
    db = get_db()
    with db.session() as session:
        from inventory.services.audit_service import AuditService
        audit_service = AuditService(session)
        logs = audit_service.get_logs(
            resource_type=resource,
            action=action,
            username=user,
            limit=limit
        )

        click.echo(f'共 {len(logs)} 条日志:')
        click.echo('-' * 120)
        click.echo(f'{"时间":<20} {"动作":<15} {"资源":<15} {"ID":<15} {"操作人":<15} {"状态":<8}')
        click.echo('-' * 120)
        for log in logs:
            click.echo(f'{log.timestamp.strftime("%Y-%m-%d %H:%M:%S"):<20} {log.action:<15} '
                       f'{log.resource_type:<15} {log.resource_id or "":<15} {log.username or "":<15} {log.status:<8}')


@cli.group()
def export():
    """数据导出"""
    pass


@export.command('inventory')
@click.argument('output')
@click.option('--store', 'store_code', help='门店代码')
@click.option('--format', type=click.Choice(['xlsx', 'csv', 'json']), default='xlsx', help='导出格式')
def export_inventory(output, store_code, format):
    """导出库存数据"""
    db = get_db()
    with db.session() as session:
        from inventory.services.import_export_service import ImportExportService
        ie_service = ImportExportService(session)
        path = ie_service.export_inventory(output, store_code=store_code, format=format)
        click.echo(f'库存数据已导出到: {path}')


@export.command('transfers')
@click.argument('output')
@click.option('--status', help='调拨状态')
@click.option('--format', type=click.Choice(['xlsx', 'csv', 'json']), default='xlsx')
def export_transfers(output, status, format):
    """导出调拨数据"""
    db = get_db()
    with db.session() as session:
        from inventory.services.import_export_service import ImportExportService
        ie_service = ImportExportService(session)
        path = ie_service.export_transfers(output, status=status, format=format)
        click.echo(f'调拨数据已导出到: {path}')


@export.command('products')
@click.argument('output')
@click.option('--format', type=click.Choice(['xlsx', 'csv', 'json']), default='xlsx')
def export_products(output, format):
    """导出商品数据"""
    db = get_db()
    with db.session() as session:
        from inventory.services.import_export_service import ImportExportService
        ie_service = ImportExportService(session)
        path = ie_service.export_products(output, format=format)
        click.echo(f'商品数据已导出到: {path}')


@export.command('stores')
@click.argument('output')
@click.option('--format', type=click.Choice(['xlsx', 'csv', 'json']), default='xlsx')
def export_stores(output, format):
    """导出门店数据"""
    db = get_db()
    with db.session() as session:
        from inventory.services.import_export_service import ImportExportService
        ie_service = ImportExportService(session)
        path = ie_service.export_stores(output, format=format)
        click.echo(f'门店数据已导出到: {path}')


@cli.group()
def import_():
    """数据导入"""
    pass


@import_.command('products')
@click.argument('file')
@click.option('--overwrite', is_flag=True, help='覆盖已有数据')
@click.option('--user', default='system', help='操作人')
def import_products(file, overwrite, user):
    """导入商品数据"""
    db = get_db()
    with db.session() as session:
        from inventory.services.import_export_service import ImportExportService
        ie_service = ImportExportService(session)
        result = ie_service.import_products(file, created_by=user, overwrite=overwrite)
        click.echo(f'导入结果: 共{result["total"]}条，成功{result["success"]}条，失败{result["failed"]}条')
        if result['errors']:
            click.echo('\n错误详情:')
            for err in result['errors'][:10]:
                click.echo(f'  {err}')


@import_.command('stores')
@click.argument('file')
@click.option('--overwrite', is_flag=True, help='覆盖已有数据')
@click.option('--user', default='system', help='操作人')
def import_stores(file, overwrite, user):
    """导入门店数据"""
    db = get_db()
    with db.session() as session:
        from inventory.services.import_export_service import ImportExportService
        ie_service = ImportExportService(session)
        result = ie_service.import_stores(file, created_by=user, overwrite=overwrite)
        click.echo(f'导入结果: 共{result["total"]}条，成功{result["success"]}条，失败{result["failed"]}条')
        if result['errors']:
            click.echo('\n错误详情:')
            for err in result['errors'][:10]:
                click.echo(f'  {err}')


@import_.command('inventory-adjust')
@click.argument('file')
@click.option('--reason', default='批量导入调整', help='调整原因')
@click.option('--user', default='system', help='操作人')
def import_inventory_adjust(file, reason, user):
    """批量调整库存"""
    db = get_db()
    with db.session() as session:
        from inventory.services.import_export_service import ImportExportService
        ie_service = ImportExportService(session)
        result = ie_service.import_inventory_adjustments(file, reason=reason, adjusted_by=user)
        click.echo(f'导入结果: 共{result["total"]}条，成功{result["success"]}条，失败{result["failed"]}条')
        if result['errors']:
            click.echo('\n错误详情:')
            for err in result['errors'][:10]:
                click.echo(f'  {err}')


@cli.group()
def batch():
    """批量操作"""
    pass


@batch.command('create-transfers')
@click.argument('json_file')
@click.option('--user', default='system', help='操作人')
@click.option('--stop-on-error', is_flag=True, help='出错即停止')
def batch_create_transfers(json_file, user, stop_on_error):
    """批量创建调拨单 (JSON格式)"""
    db = get_db()
    with db.session() as session:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        from inventory.services.batch_service import BatchService
        batch_service = BatchService(session)
        result = batch_service.batch_create_transfers(data, created_by=user, stop_on_error=stop_on_error)

        click.echo(f'批量创建调拨单结果:')
        click.echo(f'  总数: {result["total"]}')
        click.echo(f'  成功: {result["success"]}')
        click.echo(f'  失败: {result["failed"]}')

        if result['failed'] > 0:
            click.echo('\n失败详情:')
            for d in result['details']:
                if d['status'] == 'failed':
                    click.echo(f'  索引{d["index"]}: {d["error"]}')


@batch.command('create-prices')
@click.argument('json_file')
@click.option('--user', default='system', help='操作人')
@click.option('--auto-submit', is_flag=True, help='自动提交审批')
def batch_create_prices(json_file, user, auto_submit):
    """批量创建价格调整单 (JSON格式)"""
    db = get_db()
    with db.session() as session:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        from inventory.services.batch_service import BatchService
        batch_service = BatchService(session)
        result = batch_service.batch_create_price_changes(data, created_by=user, auto_submit=auto_submit)

        click.echo(f'批量创建价格调整单结果:')
        click.echo(f'  总数: {result["total"]}')
        click.echo(f'  成功: {result["success"]}')
        click.echo(f'  失败: {result["failed"]}')

        if result['failed'] > 0:
            click.echo('\n失败详情:')
            for d in result['details']:
                if d['status'] == 'failed':
                    click.echo(f'  索引{d["index"]}: {d["error"]}')


@batch.command('adjust-inventory')
@click.argument('json_file')
@click.option('--user', default='system', help='操作人')
def batch_adjust_inventory(json_file, user):
    """批量调整库存 (JSON格式)"""
    db = get_db()
    with db.session() as session:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        from inventory.services.batch_service import BatchService
        batch_service = BatchService(session)
        result = batch_service.batch_adjust_inventory(data, adjusted_by=user)

        click.echo(f'批量调整库存结果:')
        click.echo(f'  总数: {result["total"]}')
        click.echo(f'  成功: {result["success"]}')
        click.echo(f'  失败: {result["failed"]}')

        if result['failed'] > 0:
            click.echo('\n失败详情:')
            for d in result['details']:
                if d['status'] == 'failed':
                    click.echo(f'  索引{d["index"]}: {d["error"]}')


if __name__ == '__main__':
    cli()
