from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.database import Base, get_db
from app.models import Store

TEST_DATABASE_URL = "sqlite:///./test_inspection.db"

engine = create_engine(
    TEST_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def test_inspection_persistence():
    """测试巡检数据是否能正确持久化"""
    
    db = TestingSessionLocal()
    
    # 先创建一个门店
    store = Store(name="测试门店", code="TEST001", region="华南", address="测试地址", is_active=True)
    db.add(store)
    db.commit()
    db.refresh(store)
    store_id = store.id
    db.close()
    
    print(f"创建门店成功，ID: {store_id}")
    
    # 创建巡检
    response = client.post(
        "/api/inspections",
        json={
            "store_id": store_id,
            "inspector": "张测试",
            "inspection_date": "2024-01-15",
            "status": "pending",
            "remark": "测试巡检"
        }
    )
    
    print(f"创建巡检响应: {response.status_code}")
    assert response.status_code == 201, f"创建巡检失败: {response.text}"
    
    inspection_data = response.json()
    inspection_id = inspection_data["id"]
    print(f"创建巡检成功，ID: {inspection_id}")
    
    # 打开新会话查询，验证数据是否持久化
    db2 = TestingSessionLocal()
    from app.models import Inspection
    inspections = db2.query(Inspection).all()
    print(f"新会话查询到的巡检数量: {len(inspections)}")
    
    for insp in inspections:
        print(f"  - ID: {insp.id}, 门店: {insp.store_id}, 状态: {insp.status}")
    
    assert len(inspections) >= 1, "数据没有正确持久化！"
    
    db2.close()
    
    print("\n✅ 持久化测试通过！")
    
    # 清理测试数据库
    if os.path.exists("./test_inspection.db"):
        os.remove("./test_inspection.db")

if __name__ == "__main__":
    test_inspection_persistence()
