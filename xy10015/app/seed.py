import sys
from decimal import Decimal
from datetime import datetime

from app.database import SessionLocal, engine, Base
from app.services.auth_service import get_password_hash
from app.models.user import User
from app.models.role import Role, Permission, RolePermission, UserRole
from app.models.store import Store, Product
from app.models.inventory import Inventory


def init_database():
    Base.metadata.create_all(bind=engine)


def seed_permissions(db):
    permissions_data = [
        {"name": "用户管理", "code": "user:manage", "module": "auth"},
        {"name": "角色管理", "code": "role:manage", "module": "auth"},
        {"name": "门店查看", "code": "store:view", "module": "store"},
        {"name": "门店管理", "code": "store:manage", "module": "store"},
        {"name": "商品查看", "code": "product:view", "module": "product"},
        {"name": "商品管理", "code": "product:manage", "module": "product"},
        {"name": "库存查看", "code": "inventory:view", "module": "inventory"},
        {"name": "库存调整", "code": "inventory:adjust", "module": "inventory"},
        {"name": "改价创建", "code": "price_change:create", "module": "price_change"},
        {"name": "改价审核", "code": "price_change:approve", "module": "price_change"},
        {"name": "改价执行", "code": "price_change:execute", "module": "price_change"},
        {"name": "调拨创建", "code": "transfer:create", "module": "transfer"},
        {"name": "调拨审核", "code": "transfer:approve", "module": "transfer"},
        {"name": "调拨执行", "code": "transfer:execute", "module": "transfer"},
        {"name": "导入导出", "code": "import_export:all", "module": "import_export"},
        {"name": "查看日志", "code": "log:view", "module": "audit"},
        {"name": "系统管理", "code": "system:manage", "module": "system"},
    ]

    existing_codes = [p.code for p in db.query(Permission).all()]

    for perm_data in permissions_data:
        if perm_data["code"] not in existing_codes:
            perm = Permission(**perm_data)
            db.add(perm)

    db.commit()


def seed_roles(db):
    roles_data = [
        {
            "name": "超级管理员",
            "code": "admin",
            "description": "拥有所有权限",
            "is_system": True
        },
        {
            "name": "门店经理",
            "code": "store_manager",
            "description": "管理本门店所有业务",
            "is_system": True
        },
        {
            "name": "库存管理员",
            "code": "inventory_manager",
            "description": "负责库存管理、调拨、改价",
            "is_system": True
        },
        {
            "name": "业务员",
            "code": "sales",
            "description": "查看库存、查看商品信息",
            "is_system": True
        },
    ]

    existing_codes = [r.code for r in db.query(Role).all()]

    for role_data in roles_data:
        if role_data["code"] not in existing_codes:
            role = Role(**role_data)
            db.add(role)

    db.commit()

    all_permissions = {p.code: p for p in db.query(Permission).all()}
    admin_role = db.query(Role).filter(Role.code == "admin").first()
    store_manager_role = db.query(Role).filter(Role.code == "store_manager").first()
    inventory_role = db.query(Role).filter(Role.code == "inventory_manager").first()
    sales_role = db.query(Role).filter(Role.code == "sales").first()

    admin_role_perms = all_permissions.keys()
    store_manager_perms = [
        "store:view", "store:manage",
        "product:view", "product:manage",
        "inventory:view", "inventory:adjust",
        "price_change:create", "price_change:approve", "price_change:execute",
        "transfer:create", "transfer:approve", "transfer:execute",
        "import_export:all", "log:view"
    ]
    inventory_perms = [
        "store:view",
        "product:view", "product:manage",
        "inventory:view", "inventory:adjust",
        "price_change:create", "price_change:execute",
        "transfer:create", "transfer:execute",
        "import_export:all", "log:view"
    ]
    sales_perms = [
        "store:view",
        "product:view",
        "inventory:view",
    ]

    def assign_perms(role, codes):
        existing = db.query(RolePermission).filter(RolePermission.role_id == role.id).count()
        if existing > 0:
            return

        for code in codes:
            perm = all_permissions.get(code)
            if perm:
                rp = RolePermission(role_id=role.id, permission_id=perm.id)
                db.add(rp)

    if admin_role:
        assign_perms(admin_role, admin_role_perms)
    if store_manager_role:
        assign_perms(store_manager_role, store_manager_perms)
    if inventory_role:
        assign_perms(inventory_role, inventory_perms)
    if sales_role:
        assign_perms(sales_role, sales_perms)

    db.commit()


def seed_users(db):
    existing_users = [u.username for u in db.query(User).all()]

    admin_role = db.query(Role).filter(Role.code == "admin").first()
    store_manager_role = db.query(Role).filter(Role.code == "store_manager").first()
    inventory_role = db.query(Role).filter(Role.code == "inventory_manager").first()
    sales_role = db.query(Role).filter(Role.code == "sales").first()

    users_data = [
        {
            "username": "admin",
            "email": "admin@example.com",
            "password": "admin123",
            "full_name": "系统管理员",
            "phone": "13800000000",
            "role": admin_role
        },
        {
            "username": "manager1",
            "email": "manager1@example.com",
            "password": "manager123",
            "full_name": "张三（门店经理）",
            "phone": "13800000001",
            "role": store_manager_role
        },
        {
            "username": "inventory1",
            "email": "inventory1@example.com",
            "password": "inventory123",
            "full_name": "李四（库管）",
            "phone": "13800000002",
            "role": inventory_role
        },
        {
            "username": "sales1",
            "email": "sales1@example.com",
            "password": "sales123",
            "full_name": "王五（业务员）",
            "phone": "13800000003",
            "role": sales_role
        },
    ]

    for user_data in users_data:
        if user_data["username"] not in existing_users:
            user = User(
                username=user_data["username"],
                email=user_data["email"],
                password_hash=get_password_hash(user_data["password"]),
                full_name=user_data["full_name"],
                phone=user_data["phone"],
                is_active=True
            )
            db.add(user)
            db.flush()

            if user_data["role"]:
                ur = UserRole(user_id=user.id, role_id=user_data["role"].id)
                db.add(ur)

    db.commit()


def seed_stores(db):
    existing_codes = [s.code for s in db.query(Store).all()]

    stores_data = [
        {
            "name": "北京朝阳店",
            "code": "ST001",
            "address": "北京市朝阳区建国路88号",
            "phone": "010-12345678",
            "description": "核心商圈旗舰店"
        },
        {
            "name": "北京海淀店",
            "code": "ST002",
            "address": "北京市海淀区中关村大街100号",
            "phone": "010-87654321",
            "description": "科技园区店"
        },
        {
            "name": "上海浦东店",
            "code": "ST003",
            "address": "上海市浦东新区陆家嘴环路500号",
            "phone": "021-12345678",
            "description": "金融中心店"
        },
        {
            "name": "广州天河店",
            "code": "ST004",
            "address": "广州市天河区体育西路200号",
            "phone": "020-12345678",
            "description": "华南区域店"
        },
    ]

    for store_data in stores_data:
        if store_data["code"] not in existing_codes:
            store = Store(**store_data)
            db.add(store)

    db.commit()


def seed_products(db):
    existing_skus = [p.sku for p in db.query(Product).all()]

    products_data = [
        {
            "name": "农夫山泉矿泉水500ml",
            "sku": "SKU001",
            "barcode": "6901234567891",
            "category": "饮料",
            "unit": "瓶",
            "default_cost": Decimal("1.20"),
            "default_sale_price": Decimal("2.50"),
            "min_stock": 100,
            "description": "农夫山泉天然矿泉水"
        },
        {
            "name": "康师傅红烧牛肉面",
            "sku": "SKU002",
            "barcode": "6901234567892",
            "category": "方便食品",
            "unit": "桶",
            "default_cost": Decimal("3.50"),
            "default_sale_price": Decimal("6.00"),
            "min_stock": 50,
            "description": "康师傅经典红烧牛肉面"
        },
        {
            "name": "乐事薯片原味104g",
            "sku": "SKU003",
            "barcode": "6901234567893",
            "category": "零食",
            "unit": "袋",
            "default_cost": Decimal("4.80"),
            "default_sale_price": Decimal("9.90"),
            "min_stock": 30,
            "description": "乐事原味薯片"
        },
        {
            "name": "蒙牛纯牛奶250ml*12",
            "sku": "SKU004",
            "barcode": "6901234567894",
            "category": "乳制品",
            "unit": "箱",
            "default_cost": Decimal("32.00"),
            "default_sale_price": Decimal("48.00"),
            "min_stock": 20,
            "description": "蒙牛纯牛奶整箱装"
        },
        {
            "name": "金龙鱼调和油5L",
            "sku": "SKU005",
            "barcode": "6901234567895",
            "category": "粮油",
            "unit": "桶",
            "default_cost": Decimal("45.00"),
            "default_sale_price": Decimal("69.90"),
            "min_stock": 15,
            "description": "金龙鱼黄金比例调和油"
        },
        {
            "name": "维达抽纸3层150抽*3包",
            "sku": "SKU006",
            "barcode": "6901234567896",
            "category": "日用品",
            "unit": "提",
            "default_cost": Decimal("8.50"),
            "default_sale_price": Decimal("15.90"),
            "min_stock": 40,
            "description": "维达软抽纸巾"
        },
        {
            "name": "飘柔洗发水400ml",
            "sku": "SKU007",
            "barcode": "6901234567897",
            "category": "洗护",
            "unit": "瓶",
            "default_cost": Decimal("18.00"),
            "default_sale_price": Decimal("32.80"),
            "min_stock": 25,
            "description": "飘柔柔顺洗发水"
        },
        {
            "name": "德芙巧克力丝滑牛奶",
            "sku": "SKU008",
            "barcode": "6901234567898",
            "category": "零食",
            "unit": "盒",
            "default_cost": Decimal("22.00"),
            "default_sale_price": Decimal("39.90"),
            "min_stock": 20,
            "description": "德芙丝滑牛奶巧克力"
        },
        {
            "name": "奥利奥原味夹心饼干97g",
            "sku": "SKU009",
            "barcode": "6901234567899",
            "category": "零食",
            "unit": "盒",
            "default_cost": Decimal("5.20"),
            "default_sale_price": Decimal("9.90"),
            "min_stock": 35,
            "description": "奥利奥原味夹心饼干"
        },
        {
            "name": "可口可乐330ml*24",
            "sku": "SKU010",
            "barcode": "6901234567900",
            "category": "饮料",
            "unit": "箱",
            "default_cost": Decimal("48.00"),
            "default_sale_price": Decimal("72.00"),
            "min_stock": 20,
            "description": "可口可乐罐装整箱"
        },
    ]

    for product_data in products_data:
        if product_data["sku"] not in existing_skus:
            product = Product(**product_data)
            db.add(product)

    db.commit()


def seed_inventory(db):
    existing_count = db.query(Inventory).count()
    if existing_count > 0:
        print("  库存数据已存在，跳过")
        return

    stores = db.query(Store).all()
    products = db.query(Product).all()

    import random
    random.seed(42)

    for store in stores:
        for product in products:
            quantity = random.randint(20, 200)
            inventory = Inventory(
                store_id=store.id,
                product_id=product.id,
                quantity=quantity,
                reserved_quantity=0,
                available_quantity=quantity,
                cost_price=product.default_cost,
                sale_price=product.default_sale_price
            )
            db.add(inventory)

    db.commit()


def run_seed():
    print("开始初始化数据库...")
    init_database()

    db = SessionLocal()
    try:
        print("1. 初始化权限...")
        seed_permissions(db)
        print("   完成")

        print("2. 初始化角色...")
        seed_roles(db)
        print("   完成")

        print("3. 初始化用户...")
        seed_users(db)
        print("   完成")

        print("4. 初始化门店...")
        seed_stores(db)
        print("   完成")

        print("5. 初始化商品...")
        seed_products(db)
        print("   完成")

        print("6. 初始化库存...")
        seed_inventory(db)
        print("   完成")

        print("\n" + "="*50)
        print("种子数据初始化完成！")
        print("="*50)
        print("\n默认账号：")
        print("  管理员: admin / admin123")
        print("  门店经理: manager1 / manager123")
        print("  库存管理员: inventory1 / inventory123")
        print("  业务员: sales1 / sales123")
        print("\n门店: ST001-ST004 (4个门店)")
        print("商品: SKU001-SKU010 (10个商品)")
        print("库存: 每个门店每个商品均有库存")

    except Exception as e:
        print(f"初始化失败: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
