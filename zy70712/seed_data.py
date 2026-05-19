from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import Base, Customer, EquityPackage, CallEvent, DeductionDetail

DATABASE_URL = "sqlite:///./equity.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_data():
    db = SessionLocal()
    
    try:
        print("开始造数...")
        
        customer = Customer(id="CUST001", name="测试企业客户")
        db.add(customer)
        
        now = datetime.utcnow()
        pkg = EquityPackage(
            id="PKG001",
            customer_id="CUST001",
            package_type="API调用套餐",
            total_quota=10000.0,
            remaining_quota=10000.0,
            start_time=now,
            end_time=now + timedelta(days=365)
        )
        db.add(pkg)
        
        for i in range(1, 4):
            event = CallEvent(
                id=f"EVENT00{i}",
                event_idempotent_key=f"idempotent_{i}_{int(now.timestamp())}",
                customer_id="CUST001",
                package_id="PKG001",
                api_name="人脸识别接口",
                request_body=f'{{"image": "base64_{i}"}}'
            )
            db.add(event)
            
            deduction = DeductionDetail(
                id=f"DEDUCT00{i}",
                event_id=f"EVENT00{i}",
                package_id="PKG001",
                customer_id="CUST001",
                deduct_amount=100.0 * i,
                deduct_reason=f"人脸识别V{i}接口调用"
            )
            db.add(deduction)
            
            pkg.used_quota += 100.0 * i
            pkg.remaining_quota -= 100.0 * i
        
        db.commit()
        print("造数完成!")
        print(f"- 客户: CUST001")
        print(f"- 权益包: PKG001 (总额: 10000, 已用: {pkg.used_quota}, 剩余: {pkg.remaining_quota})")
        print(f"- 扣减记录: 3条 (100, 200, 300)")
        
    except Exception as e:
        print(f"造数失败: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
