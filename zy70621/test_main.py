import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

from app.database import Base, get_db
from app.models import RepairStatus, UrgencyLevel
from main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "version" in data


def test_create_building():
    response = client.post(
        "/buildings/",
        json={
            "building_name": "1号楼",
            "unit_number": "1单元",
            "room_number": "101",
            "owner_name": "张三",
            "owner_phone": "13800138001"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["building_name"] == "1号楼"
    assert data["room_number"] == "101"
    assert "id" in data


def test_read_buildings():
    client.post(
        "/buildings/",
        json={
            "building_name": "1号楼",
            "unit_number": "1单元",
            "room_number": "101",
            "owner_name": "张三"
        }
    )
    client.post(
        "/buildings/",
        json={
            "building_name": "1号楼",
            "unit_number": "1单元",
            "room_number": "102",
            "owner_name": "李四"
        }
    )
    
    response = client.get("/buildings/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2


def test_create_handler():
    response = client.post(
        "/handlers/",
        json={
            "name": "张维修",
            "phone": "13900139001",
            "department": "工程部",
            "is_outsourcer": False
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "张维修"
    assert data["is_outsourcer"] == False


def test_read_handlers():
    client.post(
        "/handlers/",
        json={
            "name": "张维修",
            "is_outsourcer": False
        }
    )
    client.post(
        "/handlers/",
        json={
            "name": "王师傅",
            "is_outsourcer": True,
            "company_name": "诚信维修"
        }
    )
    
    response = client.get("/handlers/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    
    response = client.get("/handlers/?is_outsourcer=true")
    assert response.status_code == 200
    data = response.json()
    assert all(h["is_outsourcer"] == True for h in data)


def test_create_repair_order():
    building_response = client.post(
        "/buildings/",
        json={
            "building_name": "1号楼",
            "unit_number": "1单元",
            "room_number": "101",
            "owner_name": "张三"
        }
    )
    building_id = building_response.json()["id"]
    
    response = client.post(
        "/repairs/",
        json={
            "building_id": building_id,
            "reporter_name": "张三",
            "reporter_phone": "13800138001",
            "repair_type": "水管漏水",
            "description": "厨房水管漏水",
            "urgency": "high"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["repair_type"] == "水管漏水"
    assert data["urgency"] == "high"
    assert "order_no" in data


def test_read_repair_orders():
    building_response = client.post(
        "/buildings/",
        json={
            "building_name": "1号楼",
            "unit_number": "1单元",
            "room_number": "101",
            "owner_name": "张三"
        }
    )
    building_id = building_response.json()["id"]
    
    client.post(
        "/repairs/",
        json={
            "building_id": building_id,
            "repair_type": "水管漏水",
            "urgency": "high"
        }
    )
    client.post(
        "/repairs/",
        json={
            "building_id": building_id,
            "repair_type": "电路故障",
            "urgency": "medium"
        }
    )
    
    response = client.get("/repairs/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2


def test_update_order_status():
    building_response = client.post(
        "/buildings/",
        json={
            "building_name": "1号楼",
            "unit_number": "1单元",
            "room_number": "101",
            "owner_name": "张三"
        }
    )
    building_id = building_response.json()["id"]
    
    order_response = client.post(
        "/repairs/",
        json={
            "building_id": building_id,
            "repair_type": "水管漏水",
            "urgency": "high"
        }
    )
    order_id = order_response.json()["id"]
    
    update_response = client.patch(
        f"/repairs/{order_id}/status",
        json={
            "new_status": "assigned",
            "operator": "管理员",
            "reason": "已分配给维修人员",
            "conclusion": "任务已分配"
        }
    )
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["status"] == "assigned"


def test_add_reminder():
    building_response = client.post(
        "/buildings/",
        json={
            "building_name": "1号楼",
            "unit_number": "1单元",
            "room_number": "101",
            "owner_name": "张三"
        }
    )
    building_id = building_response.json()["id"]
    
    order_response = client.post(
        "/repairs/",
        json={
            "building_id": building_id,
            "repair_type": "水管漏水",
            "urgency": "high"
        }
    )
    order_id = order_response.json()["id"]
    
    reminder_response = client.post(
        f"/repairs/{order_id}/reminders",
        json={
            "reminder_method": "电话",
            "reminder_content": "请尽快处理",
            "reminder_by": "张三"
        }
    )
    assert reminder_response.status_code == 200
    data = reminder_response.json()
    assert data["reminder_by"] == "张三"


def test_outsourcing():
    building_response = client.post(
        "/buildings/",
        json={
            "building_name": "1号楼",
            "unit_number": "1单元",
            "room_number": "101",
            "owner_name": "张三"
        }
    )
    building_id = building_response.json()["id"]
    
    handler_response = client.post(
        "/handlers/",
        json={
            "name": "王师傅",
            "is_outsourcer": True,
            "company_name": "诚信维修"
        }
    )
    handler_id = handler_response.json()["id"]
    
    order_response = client.post(
        "/repairs/",
        json={
            "building_id": building_id,
            "repair_type": "空调维修",
            "urgency": "high"
        }
    )
    order_id = order_response.json()["id"]
    
    outsourcing_response = client.post(
        f"/repairs/{order_id}/outsourcing?operator=管理员",
        json={
            "outsourcer_id": handler_id,
            "cost_estimate": 200,
            "notes": "需要加氟"
        }
    )
    assert outsourcing_response.status_code == 200
    data = outsourcing_response.json()
    assert data["cost_estimate"] == 200
    
    order_detail = client.get(f"/repairs/{order_id}")
    assert order_detail.json()["status"] == "outsourced"


def test_close_order():
    building_response = client.post(
        "/buildings/",
        json={
            "building_name": "1号楼",
            "unit_number": "1单元",
            "room_number": "101",
            "owner_name": "张三"
        }
    )
    building_id = building_response.json()["id"]
    
    order_response = client.post(
        "/repairs/",
        json={
            "building_id": building_id,
            "repair_type": "水管漏水",
            "urgency": "high"
        }
    )
    order_id = order_response.json()["id"]
    
    close_response = client.post(
        f"/repairs/{order_id}/close?operator=管理员&reason=维修已完成"
    )
    assert close_response.status_code == 200
    data = close_response.json()
    assert data["status"] == "closed"


def test_cancel_order():
    building_response = client.post(
        "/buildings/",
        json={
            "building_name": "1号楼",
            "unit_number": "1单元",
            "room_number": "101",
            "owner_name": "张三"
        }
    )
    building_id = building_response.json()["id"]
    
    order_response = client.post(
        "/repairs/",
        json={
            "building_id": building_id,
            "repair_type": "水管漏水",
            "urgency": "high"
        }
    )
    order_id = order_response.json()["id"]
    
    cancel_response = client.post(
        f"/repairs/{order_id}/cancel?operator=管理员&reason=业主自行解决"
    )
    assert cancel_response.status_code == 200
    data = cancel_response.json()
    assert data["status"] == "cancelled"


def test_audit_logs():
    building_response = client.post(
        "/buildings/",
        json={
            "building_name": "1号楼",
            "unit_number": "1单元",
            "room_number": "101",
            "owner_name": "张三"
        }
    )
    building_id = building_response.json()["id"]
    
    order_response = client.post(
        "/repairs/",
        json={
            "building_id": building_id,
            "repair_type": "水管漏水",
            "urgency": "high"
        }
    )
    order_id = order_response.json()["id"]
    
    client.patch(
        f"/repairs/{order_id}/status",
        json={
            "new_status": "assigned",
            "operator": "管理员",
            "reason": "已分配"
        }
    )
    
    logs_response = client.get(f"/repairs/{order_id}/audit-logs")
    assert logs_response.status_code == 200
    data = logs_response.json()
    assert len(data) >= 1
    assert any(log["action"] == "status_update" for log in data)


def test_export_repairs():
    building_response = client.post(
        "/buildings/",
        json={
            "building_name": "1号楼",
            "unit_number": "1单元",
            "room_number": "101",
            "owner_name": "张三"
        }
    )
    building_id = building_response.json()["id"]
    
    client.post(
        "/repairs/",
        json={
            "building_id": building_id,
            "repair_type": "水管漏水",
            "urgency": "high"
        }
    )
    
    response = client.get("/export/repairs")
    assert response.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers["content-type"]


def test_export_statistics():
    building_response = client.post(
        "/buildings/",
        json={
            "building_name": "1号楼",
            "unit_number": "1单元",
            "room_number": "101",
            "owner_name": "张三"
        }
    )
    building_id = building_response.json()["id"]
    
    client.post(
        "/repairs/",
        json={
            "building_id": building_id,
            "repair_type": "水管漏水",
            "urgency": "high"
        }
    )
    
    response = client.get("/export/statistics")
    assert response.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers["content-type"]


def test_manual_correction():
    building_response = client.post(
        "/buildings/",
        json={
            "building_name": "1号楼",
            "unit_number": "1单元",
            "room_number": "101",
            "owner_name": "张三"
        }
    )
    building_id = building_response.json()["id"]
    
    order_response = client.post(
        "/repairs/",
        json={
            "building_id": building_id,
            "repair_type": "水管漏水",
            "urgency": "high"
        }
    )
    order_id = order_response.json()["id"]
    
    correction_response = client.post(
        f"/repairs/{order_id}/manual-correction",
        json={
            "field_name": "repair_type",
            "old_value": "水管漏水",
            "new_value": "下水道堵塞",
            "operator": "管理员",
            "reason": "报修类型录入错误"
        }
    )
    assert correction_response.status_code == 200


def test_order_not_found():
    response = client.get("/repairs/99999")
    assert response.status_code == 404


def test_building_not_found():
    response = client.get("/buildings/99999")
    assert response.status_code == 404
