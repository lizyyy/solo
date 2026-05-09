from datetime import datetime, timedelta
from database import SessionLocal, engine
from models import Base, ChargingPile, Reservation, ChargingSession
from services import generate_code


def init_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def seed_piles(db):
    piles_data = [
        {
            "pile_code": "P001",
            "station_name": "市中心快充站",
            "location": "北京市朝阳区国贸地下停车场B2层",
            "power": 120
        },
        {
            "pile_code": "P002",
            "station_name": "市中心快充站",
            "location": "北京市朝阳区国贸地下停车场B2层",
            "power": 120
        },
        {
            "pile_code": "P003",
            "station_name": "科技园快充站",
            "location": "北京市海淀区中关村软件园",
            "power": 180
        }
    ]
    
    for data in piles_data:
        pile = ChargingPile(**data, status="AVAILABLE")
        db.add(pile)
    
    db.commit()
    print(f"✅ 已注册 {len(piles_data)} 个充电桩")


def seed_reservations(db):
    pile_p001 = db.query(ChargingPile).filter(ChargingPile.pile_code == "P001").first()
    pile_p002 = db.query(ChargingPile).filter(ChargingPile.pile_code == "P002").first()
    
    now = datetime.utcnow()
    
    reservations_data = [
        {
            "pile_id": pile_p001.id,
            "user_id": "U001",
            "user_name": "张三",
            "phone": "13800138001",
            "reserved_start": now + timedelta(hours=1),
            "reserved_end": now + timedelta(hours=2),
            "status": "CONFIRMED"
        },
        {
            "pile_id": pile_p001.id,
            "user_id": "U002",
            "user_name": "李四",
            "phone": "13800138002",
            "reserved_start": now + timedelta(hours=3),
            "reserved_end": now + timedelta(hours=4),
            "status": "CONFIRMED"
        },
        {
            "pile_id": pile_p002.id,
            "user_id": "U003",
            "user_name": "王五",
            "phone": "13800138003",
            "reserved_start": now + timedelta(hours=2),
            "reserved_end": now + timedelta(hours=3),
            "status": "CONFIRMED"
        }
    ]
    
    for data in reservations_data:
        reservation = Reservation(
            reservation_code=generate_code("RES"),
            **data,
            is_frozen=False
        )
        db.add(reservation)
    
    db.commit()
    print(f"✅ 已创建 {len(reservations_data)} 个预约")


def seed_charging_session(db):
    pile_p002 = db.query(ChargingPile).filter(ChargingPile.pile_code == "P002").first()
    
    session = ChargingSession(
        session_code=generate_code("CHG"),
        pile_id=pile_p002.id,
        user_id="U004",
        start_time=datetime.utcnow() - timedelta(minutes=30),
        start_kwh=100.5,
        status="CHARGING",
        is_truncated=False
    )
    db.add(session)
    pile_p002.status = "IN_USE"
    db.commit()
    print(f"✅ 已创建 1 个进行中的充电会话")


def main():
    db = SessionLocal()
    try:
        print("=" * 60)
        print("🔧 开始初始化数据库和样例数据")
        print("=" * 60)
        
        init_database()
        print("✅ 数据库初始化完成")
        
        seed_piles(db)
        seed_reservations(db)
        seed_charging_session(db)
        
        print("=" * 60)
        print("✨ 样例数据初始化完成！")
        print("=" * 60)
        print("📋 已准备的测试数据：")
        print("  - 3个充电桩 (P001, P002, P003)")
        print("  - 3个预约 (2个在P001, 1个在P002)")
        print("  - 1个进行中的充电会话 (在P002)")
        print("=" * 60)
        
    finally:
        db.close()


if __name__ == "__main__":
    main()
