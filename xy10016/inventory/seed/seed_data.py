from sqlalchemy.orm import Session

from inventory.models import (
    User, Role, RolePermission, user_role,
    Store, Product, Inventory, InventoryHistory,
    Transfer, TransferItem, PriceChange
)
from inventory.services.inventory_service import InventoryService


ROLES_AND_PERMISSIONS = {
    'admin': [
        'store.create', 'store.read', 'store.update', 'store.delete',
        'product.create', 'product.read', 'product.update', 'product.delete',
        'inventory.read', 'inventory.update',
        'transfer.create', 'transfer.read', 'transfer.approve', 'transfer.execute', 'transfer.cancel',
        'price.create', 'price.read', 'price.approve', 'price.apply', 'price.cancel',
        'log.read', 'log.export',
        'import.execute', 'export.execute',
        'batch.execute',
        'user.create', 'user.read', 'user.update', 'user.delete',
    ],
    'manager': [
        'store.read',
        'product.read',
        'inventory.read', 'inventory.update',
        'transfer.create', 'transfer.read', 'transfer.approve', 'transfer.execute',
        'price.create', 'price.read', 'price.approve', 'price.apply',
        'log.read',
        'import.execute', 'export.execute',
        'batch.execute',
    ],
    'operator': [
        'store.read',
        'product.read',
        'inventory.read',
        'transfer.create', 'transfer.read', 'transfer.execute',
        'price.create', 'price.read',
        'export.execute',
    ],
    'auditor': [
        'store.read',
        'product.read',
        'inventory.read',
        'transfer.read',
        'price.read',
        'log.read', 'log.export',
        'export.execute',
    ]
}


STORES = [
    {'code': 'ST001', 'name': '北京朝阳店', 'city': '北京', 'address': '北京市朝阳区建国路88号', 'phone': '010-12345678', 'manager': '张三'},
    {'code': 'ST002', 'name': '上海浦东店', 'city': '上海', 'address': '上海市浦东新区陆家嘴环路1000号', 'phone': '021-23456789', 'manager': '李四'},
    {'code': 'ST003', 'name': '广州天河店', 'city': '广州', 'address': '广州市天河区天河路385号', 'phone': '020-34567890', 'manager': '王五'},
    {'code': 'ST004', 'name': '深圳南山店', 'city': '深圳', 'address': '深圳市南山区科技园南路', 'phone': '0755-45678901', 'manager': '赵六'},
    {'code': 'ST005', 'name': '杭州西湖店', 'city': '杭州', 'address': '杭州市西湖区文三路478号', 'phone': '0571-56789012', 'manager': '钱七'},
]


PRODUCTS = [
    {'sku': 'P001', 'name': '牛奶-常温250ml', 'category': '乳制品', 'barcode': '6901234500001', 'unit': '盒', 'cost_price': 2.5, 'base_sale_price': 3.5},
    {'sku': 'P002', 'name': '面包-全麦吐司', 'category': '烘焙', 'barcode': '6901234500002', 'unit': '袋', 'cost_price': 5.0, 'base_sale_price': 8.0},
    {'sku': 'P003', 'name': '鸡蛋-盒装30枚', 'category': '蛋品', 'barcode': '6901234500003', 'unit': '盒', 'cost_price': 18.0, 'base_sale_price': 22.0},
    {'sku': 'P004', 'name': '大米-东北长粒香5kg', 'category': '粮油', 'barcode': '6901234500004', 'unit': '袋', 'cost_price': 35.0, 'base_sale_price': 45.0},
    {'sku': 'P005', 'name': '食用油-大豆油5L', 'category': '粮油', 'barcode': '6901234500005', 'unit': '桶', 'cost_price': 48.0, 'base_sale_price': 62.0},
    {'sku': 'P006', 'name': '苹果-红富士1kg', 'category': '水果', 'barcode': '6901234500006', 'unit': 'kg', 'cost_price': 6.0, 'base_sale_price': 9.9},
    {'sku': 'P007', 'name': '猪肉-五花肉500g', 'category': '肉禽', 'barcode': '6901234500007', 'unit': '份', 'cost_price': 20.0, 'base_sale_price': 28.0},
    {'sku': 'P008', 'name': '矿泉水-550ml*24瓶', 'category': '饮料', 'barcode': '6901234500008', 'unit': '箱', 'cost_price': 20.0, 'base_sale_price': 28.0},
    {'sku': 'P009', 'name': '洗衣液-3L装', 'category': '日化', 'barcode': '6901234500009', 'unit': '瓶', 'cost_price': 25.0, 'base_sale_price': 35.0},
    {'sku': 'P010', 'name': '卫生纸-10卷装', 'category': '日化', 'barcode': '6901234500010', 'unit': '提', 'cost_price': 15.0, 'base_sale_price': 22.0},
]


INVENTORY_SEED = [
    ('ST001', 'P001', 500, 3.5, 50),
    ('ST001', 'P002', 200, 8.0, 20),
    ('ST001', 'P003', 150, 22.0, 30),
    ('ST001', 'P004', 100, 45.0, 20),
    ('ST001', 'P005', 80, 62.0, 10),
    ('ST002', 'P001', 400, 3.5, 50),
    ('ST002', 'P002', 180, 8.0, 20),
    ('ST002', 'P003', 120, 22.0, 30),
    ('ST002', 'P006', 300, 9.9, 40),
    ('ST002', 'P007', 80, 28.0, 15),
    ('ST003', 'P001', 350, 3.5, 50),
    ('ST003', 'P008', 200, 28.0, 30),
    ('ST003', 'P009', 100, 35.0, 20),
    ('ST003', 'P010', 150, 22.0, 25),
    ('ST004', 'P004', 120, 45.0, 20),
    ('ST004', 'P005', 90, 62.0, 10),
    ('ST004', 'P006', 250, 9.9, 40),
    ('ST005', 'P001', 300, 3.5, 50),
    ('ST005', 'P002', 150, 8.0, 20),
    ('ST005', 'P003', 100, 22.0, 30),
]


def seed_roles_and_users(db: Session, clear: bool = False):
    if clear:
        db.query(RolePermission).delete()
        db.execute(user_role.delete())
        db.query(User).delete()
        db.query(Role).delete()
        db.flush()

    role_map = {}
    for role_name, permissions in ROLES_AND_PERMISSIONS.items():
        role = Role(
            name=role_name,
            description=f'{role_name} role'
        )
        db.add(role)
        db.flush()
        role_map[role_name] = role

        for perm in permissions:
            db.add(RolePermission(role_id=role.id, permission=perm))

    users = [
        {'username': 'admin', 'email': 'admin@example.com', 'full_name': '系统管理员', 'role': 'admin'},
        {'username': 'manager_bj', 'email': 'manager_bj@example.com', 'full_name': '北京店经理', 'role': 'manager'},
        {'username': 'manager_sh', 'email': 'manager_sh@example.com', 'full_name': '上海店经理', 'role': 'manager'},
        {'username': 'operator_bj', 'email': 'operator_bj@example.com', 'full_name': '北京店操作员', 'role': 'operator'},
        {'username': 'operator_sh', 'email': 'operator_sh@example.com', 'full_name': '上海店操作员', 'role': 'operator'},
        {'username': 'auditor', 'email': 'auditor@example.com', 'full_name': '审计员', 'role': 'auditor'},
    ]

    for u in users:
        user = User(
            username=u['username'],
            email=u['email'],
            full_name=u['full_name'],
            is_active=1
        )
        user.roles.append(role_map[u['role']])
        db.add(user)


def seed_stores(db: Session, clear: bool = False):
    if clear:
        db.query(Store).delete()

    for s in STORES:
        store = Store(**s)
        db.add(store)


def seed_products(db: Session, clear: bool = False):
    if clear:
        db.query(Product).delete()

    for p in PRODUCTS:
        product = Product(**p)
        db.add(product)


def seed_inventory(db: Session):
    inv_service = InventoryService(db)

    store_map = {s.code: s for s in db.query(Store).all()}
    product_map = {p.sku: p for p in db.query(Product).all()}

    for store_code, sku, qty, price, min_stock in INVENTORY_SEED:
        if store_code not in store_map or sku not in product_map:
            continue

        store_id = store_map[store_code].id
        product_id = product_map[sku].id

        inventory = inv_service.get_or_create_inventory(store_id, product_id, 'system')
        inventory.quantity = qty
        inventory.available_quantity = qty
        inventory.sale_price = price
        inventory.min_stock = min_stock
        inventory.status = 'normal' if qty > min_stock else 'low_stock'


def seed_sample_operations(db: Session):
    from inventory.services.transfer_service import TransferService
    from inventory.services.price_service import PriceService

    transfer_service = TransferService(db)
    price_service = PriceService(db)

    try:
        transfer = transfer_service.create_transfer(
            from_store_code='ST001',
            to_store_code='ST002',
            items=[
                {'sku': 'P001', 'quantity': 50},
                {'sku': 'P002', 'quantity': 20},
            ],
            created_by='operator_bj',
            priority='normal',
            notes='上海店库存补充'
        )

        transfer_service.approve_transfer(transfer.transfer_no, 'manager_bj')
        transfer_service.ship_transfer(transfer.transfer_no, 'operator_bj')
    except Exception:
        pass

    try:
        price_change = price_service.create_price_change(
            store_code='ST001',
            sku='P001',
            new_price=3.2,
            reason='春节促销活动',
            created_by='operator_bj'
        )
        price_service.submit_for_approval(price_change.change_no, 'operator_bj')
        price_service.approve_price_change(price_change.change_no, 'manager_bj')
    except Exception:
        pass


def seed_all(db: Session, clear: bool = True):
    if clear:
        db.query(TransferItem).delete()
        db.query(Transfer).delete()
        db.query(PriceChange).delete()
        db.query(InventoryHistory).delete()
        db.query(Inventory).delete()
        db.flush()

    seed_roles_and_users(db, clear=clear)
    seed_stores(db, clear=clear)
    seed_products(db, clear=clear)
    db.flush()

    seed_inventory(db)
    db.flush()

    seed_sample_operations(db)

    db.commit()
