from datetime import datetime
from sqlalchemy.orm import Session
from app.database import SessionLocal, init_db
from app.models import (
    User,
    Region,
    Store,
    MaintenanceProvider,
    Freezer,
    Part,
)


def init_data():
    init_db()
    db: Session = SessionLocal()
    try:
        print("开始初始化数据...")

        if db.query(User).count() == 0:
            print("创建用户数据...")
            admin = User(username="admin", name="系统管理员", phone="13800000001", email="admin@example.com", role="admin")
            region_manager = User(username="manager1", name="华东区域经理", phone="13800000002", email="rm1@example.com", role="region_manager")
            technician = User(username="tech1", name="维修工程师小王", phone="13800000003", email="tech1@example.com", role="technician")
            technician2 = User(username="tech2", name="维修工程师小李", phone="13800000004", email="tech2@example.com", role="technician")
            db.add_all([admin, region_manager, technician, technician2])
            db.flush()

        if db.query(Region).count() == 0:
            print("创建区域数据...")
            manager = db.query(User).filter(User.username == "manager1").first()
            east_region = Region(name="华东区", code="REG_EAST", manager_id=manager.id if manager else None)
            db.add(east_region)
            db.flush()

        if db.query(Store).count() == 0:
            print("创建门店数据...")
            region = db.query(Region).first()
            store1 = Store(name="上海五角场店", code="ST001", address="上海市杨浦区五角场", region_id=region.id if region else None, contact_phone="021-12345678")
            store2 = Store(name="上海人民广场店", code="ST002", address="上海市黄浦区人民广场", region_id=region.id if region else None, contact_phone="021-23456789")
            db.add_all([store1, store2])
            db.flush()

        if db.query(MaintenanceProvider).count() == 0:
            print("创建维修商数据...")
            region = db.query(Region).first()
            provider1 = MaintenanceProvider(name="诚信制冷维修", code="PROV001", contact_person="张经理", contact_phone="400-123-4567", region_id=region.id if region else None)
            provider2 = MaintenanceProvider(name="专业冷链服务", code="PROV002", contact_person="李经理", contact_phone="400-234-5678", region_id=region.id if region else None)
            db.add_all([provider1, provider2])
            db.flush()

        if db.query(Freezer).count() == 0:
            print("创建冷柜数据...")
            store1 = db.query(Store).filter(Store.code == "ST001").first()
            store2 = db.query(Store).filter(Store.code == "ST002").first()
            freezer1 = Freezer(name="饮料冷柜1", code="FZ001", store_id=store1.id if store1 else 1, model="HCR-100", min_temperature=-20.0, max_temperature=5.0)
            freezer2 = Freezer(name="冷冻柜1", code="FZ002", store_id=store1.id if store1 else 1, model="FC-50", min_temperature=-25.0, max_temperature=-10.0)
            freezer3 = Freezer(name="饮料冷柜2", code="FZ003", store_id=store2.id if store2 else 2, model="HCR-100", min_temperature=-20.0, max_temperature=5.0)
            freezer4 = Freezer(name="冰淇淋柜1", code="FZ004", store_id=store2.id if store2 else 2, model="IC-80", min_temperature=-30.0, max_temperature=-15.0)
            db.add_all([freezer1, freezer2, freezer3, freezer4])
            db.flush()

        if db.query(Part).count() == 0:
            print("创建配件数据...")
            parts = [
                Part(name="压缩机", code="P001", category="核心部件", unit="台", unit_price=1500.0, stock=10, description="制冷压缩机"),
                Part(name="温控器", code="P002", category="控制系统", unit="个", unit_price=120.0, stock=50, description="温度控制器"),
                Part(name="制冷剂R22", code="P003", category="耗材", unit="kg", unit_price=80.0, stock=100, description="空调制冷剂"),
                Part(name="过滤器", code="P004", category="耗材", unit="个", unit_price=35.0, stock=80, description="干燥过滤器"),
                Part(name="风机电机", code="P005", category="制冷系统", unit="台", unit_price=280.0, stock=20, description="蒸发器风机"),
            ]
            db.add_all(parts)
            db.flush()

        db.commit()
        print("数据初始化完成！")

    except Exception as e:
        db.rollback()
        print(f"初始化失败: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_data()
