#!/usr/bin/env python3
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import Base, get_db
from app import schemas

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_create_handler(db_session):
    response = client.post(
        "/api/handlers/",
        json={"name": "张工", "phone": "13800138000", "department": "工程部", "role": "维修工", "is_outsource": False}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "张工"
    assert data["is_outsource"] == False


def test_create_repair_order(db_session):
    response = client.post(
        "/api/orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "repair_type": "水电维修",
            "description": "水龙头漏水",
            "contact_name": "业主A",
            "contact_phone": "13900139000",
            "priority": "normal",
            "sla_hours": 24
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["order_no"].startswith("WO")
    assert data["status"] == "pending"
    assert data["building_room"]["building"] == "1号楼"
    assert data["building_room"]["room_number"] == "101"


def test_query_orders(db_session):
    for i in range(5):
        client.post(
            "/api/orders/",
            json={
                "building": f"{i+1}号楼",
                "room_number": "101",
                "repair_type": "水电维修",
                "description": "测试报修",
                "contact_name": "业主",
                "contact_phone": "13900139000",
                "priority": "normal",
                "sla_hours": 24
            }
        )
    
    response = client.post(
        "/api/orders/query",
        json={"page": 1, "page_size": 10}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 5
    assert len(data["data"]) == 5


def test_add_reminder(db_session):
    order_response = client.post(
        "/api/orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "repair_type": "水电维修",
            "description": "水龙头漏水",
            "contact_name": "业主A",
            "contact_phone": "13900139000",
            "priority": "normal",
            "sla_hours": 24
        }
    )
    order_id = order_response.json()["id"]
    
    response = client.post(
        f"/api/orders/{order_id}/reminders",
        json={
            "reminder_type": "normal",
            "content": "请尽快处理",
            "reminded_by": "业主A"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "请尽快处理"
    assert data["repair_order_id"] == order_id


def test_status_flow_assignment(db_session):
    handler_response = client.post(
        "/api/handlers/",
        json={"name": "张工", "phone": "13800138000", "department": "工程部", "role": "维修工", "is_outsource": False}
    )
    handler_id = handler_response.json()["id"]
    
    order_response = client.post(
        "/api/orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "repair_type": "水电维修",
            "description": "水龙头漏水",
            "contact_name": "业主A",
            "contact_phone": "13900139000",
            "priority": "normal",
            "sla_hours": 24
        }
    )
    order_id = order_response.json()["id"]
    
    response = client.post(
        f"/api/orders/{order_id}/advance/assign",
        json={
            "operated_by": "物业管理员",
            "handler_id": handler_id,
            "notes": "已派单给张工"
        }
    )
    assert response.status_code == 200
    assert response.json()["status"] == "assigned"
    
    response = client.post(
        f"/api/orders/{order_id}/advance/start",
        json={"operated_by": "张工", "notes": "开始维修"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "processing"
    
    response = client.post(
        f"/api/orders/{order_id}/advance/complete",
        json={"operated_by": "张工", "notes": "维修完成"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "completed"


def test_manual_correction(db_session):
    order_response = client.post(
        "/api/orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "repair_type": "水电维修",
            "description": "水龙头漏水",
            "contact_name": "业主A",
            "contact_phone": "13900139000",
            "priority": "normal",
            "sla_hours": 24
        }
    )
    order_id = order_response.json()["id"]
    
    response = client.post(
        f"/api/orders/{order_id}/correct",
        json={
            "operated_by": "管理员",
            "new_status": "processing",
            "notes": "特殊情况，直接开始处理",
            "conclusion": "人工修正状态"
        }
    )
    assert response.status_code == 200
    assert response.json()["status"] == "processing"


def test_close_order(db_session):
    order_response = client.post(
        "/api/orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "repair_type": "水电维修",
            "description": "水龙头漏水",
            "contact_name": "业主A",
            "contact_phone": "13900139000",
            "priority": "normal",
            "sla_hours": 24
        }
    )
    order_id = order_response.json()["id"]
    
    response = client.post(
        f"/api/orders/{order_id}/close",
        json={
            "operated_by": "管理员",
            "reason": "业主自行解决",
            "conclusion": "工单关闭"
        }
    )
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


def test_outsource_flow(db_session):
    outsource_response = client.post(
        "/api/handlers/",
        json={"name": "快修公司", "phone": "4008008888", "department": "外包", "role": "外包商", "is_outsource": True}
    )
    outsource_id = outsource_response.json()["id"]
    
    order_response = client.post(
        "/api/orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "repair_type": "水电维修",
            "description": "电路故障",
            "contact_name": "业主A",
            "contact_phone": "13900139000",
            "priority": "high",
            "sla_hours": 8
        }
    )
    order_id = order_response.json()["id"]
    
    response = client.post(
        f"/api/orders/{order_id}/outsource?operated_by=管理员",
        json={
            "outsource_company_id": outsource_id,
            "estimated_cost": 200.0,
            "notes": "专业电路维修"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["outsource_order_no"].startswith("OS")
    assert data["status"] == "dispatched"
    
    order = client.get(f"/api/orders/{order_id}")
    assert order.json()["status"] == "outsourced"


def test_export_orders(db_session):
    for i in range(3):
        client.post(
            "/api/orders/",
            json={
                "building": f"{i+1}号楼",
                "room_number": "101",
                "repair_type": "水电维修",
                "description": "测试报修",
                "contact_name": "业主",
                "contact_phone": "13900139000",
                "priority": "normal",
                "sla_hours": 24
            }
        )
    
    response = client.post(
        "/api/orders/export",
        json={"export_type": "excel"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert len(data["data"]) == 3


def test_invalid_status_transition(db_session):
    order_response = client.post(
        "/api/orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "repair_type": "水电维修",
            "description": "水龙头漏水",
            "contact_name": "业主A",
            "contact_phone": "13900139000",
            "priority": "normal",
            "sla_hours": 24
        }
    )
    order_id = order_response.json()["id"]
    
    response = client.post(
        f"/api/orders/{order_id}/advance/complete",
        json={"operated_by": "张工"}
    )
    assert response.status_code == 400


def test_get_order_not_found(db_session):
    response = client.get("/api/orders/999999")
    assert response.status_code == 404


def test_merge_orders(db_session):
    order1 = client.post(
        "/api/orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "repair_type": "水电维修",
            "description": "水龙头漏水需要维修",
            "contact_name": "业主A",
            "contact_phone": "13900139000",
            "priority": "normal",
            "sla_hours": 24
        }
    ).json()
    
    order2 = client.post(
        "/api/orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "repair_type": "水电维修",
            "description": "水龙头漏水报修",
            "contact_name": "业主A",
            "contact_phone": "13900139000",
            "priority": "normal",
            "sla_hours": 24
        }
    ).json()
    
    response = client.post(
        f"/api/orders/{order2['id']}/merge",
        json={
            "operated_by": "管理员",
            "merge_into_order_id": order1["id"],
            "notes": "重复工单合并"
        }
    )
    assert response.status_code == 200