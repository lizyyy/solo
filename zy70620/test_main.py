import pytest
from httpx import AsyncClient
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app
from app.models import RepairOrderStatus, UrgencyLevel

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


@pytest.fixture(autouse=True)
def setup_and_teardown():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_create_handler():
    response = client.post(
        "/api/handlers/",
        json={"name": "张师傅", "phone": "13800138001", "department": "工程部", "is_outsourcer": False}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "张师傅"
    assert data["department"] == "工程部"
    assert "id" in data


def test_get_handlers():
    client.post(
        "/api/handlers/",
        json={"name": "张师傅", "phone": "13800138001", "department": "工程部", "is_outsourcer": False}
    )
    client.post(
        "/api/handlers/",
        json={"name": "王工", "phone": "13800138003", "department": "水电维修", "is_outsourcer": True}
    )
    
    response = client.get("/api/handlers/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2


def test_create_repair_order():
    response = client.post(
        "/api/repair-orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "contact_name": "王先生",
            "contact_phone": "13900139001",
            "issue_type": "水电维修",
            "description": "厨房水龙头漏水",
            "urgency": "high",
            "timeout_hours": 24
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["building"] == "1号楼"
    assert data["room_number"] == "101"
    assert data["status"] == "pending"
    assert "order_no" in data
    assert "id" in data


def test_get_repair_orders():
    for i in range(3):
        client.post(
            "/api/repair-orders/",
            json={
                "building": f"{i+1}号楼",
                "room_number": "101",
                "contact_name": "王先生",
                "contact_phone": f"1390013900{i}",
                "issue_type": "水电维修",
                "description": "需要维修",
                "urgency": "medium",
                "timeout_hours": 24
            }
        )
    
    response = client.get("/api/repair-orders/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3


def test_get_repair_order_by_id():
    create_response = client.post(
        "/api/repair-orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "contact_name": "王先生",
            "contact_phone": "13900139001",
            "issue_type": "水电维修",
            "description": "厨房水龙头漏水",
            "urgency": "high",
            "timeout_hours": 24
        }
    )
    order_id = create_response.json()["id"]
    
    response = client.get(f"/api/repair-orders/{order_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == order_id
    assert data["building"] == "1号楼"


def test_get_nonexistent_order():
    response = client.get("/api/repair-orders/99999")
    assert response.status_code == 404


def test_status_transition_pending_to_processing():
    create_response = client.post(
        "/api/repair-orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "contact_name": "王先生",
            "contact_phone": "13900139001",
            "issue_type": "水电维修",
            "description": "厨房水龙头漏水",
            "urgency": "medium",
            "timeout_hours": 24
        }
    )
    order_id = create_response.json()["id"]
    
    response = client.put(
        f"/api/repair-orders/{order_id}/status",
        json={"target_status": "processing", "operator": "管理员", "remarks": "开始处理"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "processing"


def test_invalid_status_transition():
    create_response = client.post(
        "/api/repair-orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "contact_name": "王先生",
            "contact_phone": "13900139001",
            "issue_type": "水电维修",
            "description": "厨房水龙头漏水",
            "urgency": "medium",
            "timeout_hours": 24
        }
    )
    order_id = create_response.json()["id"]
    
    response = client.put(
        f"/api/repair-orders/{order_id}/status",
        json={"target_status": "completed", "operator": "管理员", "remarks": "直接完成"}
    )
    assert response.status_code == 400


def test_create_reminder():
    order_response = client.post(
        "/api/repair-orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "contact_name": "王先生",
            "contact_phone": "13900139001",
            "issue_type": "水电维修",
            "description": "厨房水龙头漏水",
            "urgency": "medium",
            "timeout_hours": 24
        }
    )
    order_id = order_response.json()["id"]
    
    response = client.post(
        "/api/reminders/",
        json={
            "repair_order_id": order_id,
            "reminder_method": "电话",
            "reminder_content": "催尽快处理",
            "operator": "物业管理员"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["repair_order_id"] == order_id
    assert "id" in data


def test_merge_reminders():
    order_response = client.post(
        "/api/repair-orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "contact_name": "王先生",
            "contact_phone": "13900139001",
            "issue_type": "水电维修",
            "description": "厨房水龙头漏水",
            "urgency": "medium",
            "timeout_hours": 24
        }
    )
    order_id = order_response.json()["id"]
    
    for i in range(3):
        client.post(
            "/api/reminders/",
            json={
                "repair_order_id": order_id,
                "reminder_method": "电话",
                "reminder_content": f"第{i+1}次催办",
                "operator": "物业管理员"
            }
        )
    
    response = client.post(f"/api/reminders/merge/{order_id}?operator=管理员")
    assert response.status_code == 200
    data = response.json()
    assert data["merged_count"] == 2


def test_create_outsourcing():
    order_response = client.post(
        "/api/repair-orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "contact_name": "王先生",
            "contact_phone": "13900139001",
            "issue_type": "水电维修",
            "description": "厨房水龙头漏水",
            "urgency": "medium",
            "timeout_hours": 24
        }
    )
    order_id = order_response.json()["id"]
    
    client.put(
        f"/api/repair-orders/{order_id}/status",
        json={"target_status": "processing", "operator": "管理员"}
    )
    
    response = client.post(
        "/api/outsourcings/",
        json={
            "repair_order_id": order_id,
            "outsourcer_name": "专业水电维修公司",
            "outsourcer_contact": "13800138888",
            "cost": 150.0,
            "remarks": "需要专业工具"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["outsourcer_name"] == "专业水电维修公司"
    assert data["status"] == "dispatched"


def test_create_completion_proof():
    order_response = client.post(
        "/api/repair-orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "contact_name": "王先生",
            "contact_phone": "13900139001",
            "issue_type": "水电维修",
            "description": "厨房水龙头漏水",
            "urgency": "medium",
            "timeout_hours": 24
        }
    )
    order_id = order_response.json()["id"]
    
    response = client.post(
        "/api/completion-proofs/",
        json={
            "repair_order_id": order_id,
            "proof_type": "照片+文字说明",
            "proof_content": "已完成维修，运行正常",
            "image_urls": "http://example.com/img1.jpg",
            "submitter": "张师傅"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["proof_content"] == "已完成维修，运行正常"
    assert data["is_verified"] == False


def test_verify_completion_proof():
    order_response = client.post(
        "/api/repair-orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "contact_name": "王先生",
            "contact_phone": "13900139001",
            "issue_type": "水电维修",
            "description": "厨房水龙头漏水",
            "urgency": "medium",
            "timeout_hours": 24
        }
    )
    order_id = order_response.json()["id"]
    
    proof_response = client.post(
        "/api/completion-proofs/",
        json={
            "repair_order_id": order_id,
            "proof_type": "照片+文字说明",
            "proof_content": "已完成维修",
            "submitter": "张师傅"
        }
    )
    proof_id = proof_response.json()["id"]
    
    response = client.post(
        f"/api/completion-proofs/{proof_id}/verify",
        json={"verifier": "物业主管", "is_verified": True, "verify_remarks": "复核通过"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_verified"] == True
    assert data["verifier"] == "物业主管"


def test_manual_correction():
    order_response = client.post(
        "/api/repair-orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "contact_name": "王先生",
            "contact_phone": "13900139001",
            "issue_type": "水电维修",
            "description": "厨房水龙头漏水",
            "urgency": "medium",
            "timeout_hours": 24
        }
    )
    order_id = order_response.json()["id"]
    
    response = client.put(
        f"/api/repair-orders/{order_id}/correct",
        json={
            "field_name": "contact_phone",
            "old_value": "13900139001",
            "new_value": "13999999999",
            "operator": "管理员",
            "reason": "用户电话更正"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["contact_phone"] == "13999999999"


def test_close_order():
    order_response = client.post(
        "/api/repair-orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "contact_name": "王先生",
            "contact_phone": "13900139001",
            "issue_type": "水电维修",
            "description": "厨房水龙头漏水",
            "urgency": "medium",
            "timeout_hours": 24
        }
    )
    order_id = order_response.json()["id"]
    
    response = client.post(f"/api/repair-orders/{order_id}/close?operator=管理员&reason=用户自行解决")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "closed"


def test_cancel_order():
    order_response = client.post(
        "/api/repair-orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "contact_name": "王先生",
            "contact_phone": "13900139001",
            "issue_type": "水电维修",
            "description": "厨房水龙头漏水",
            "urgency": "medium",
            "timeout_hours": 24
        }
    )
    order_id = order_response.json()["id"]
    
    response = client.post(f"/api/repair-orders/{order_id}/cancel?operator=管理员&reason=重复报单")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "cancelled"


def test_get_statistics():
    for i in range(5):
        client.post(
            "/api/repair-orders/",
            json={
                "building": f"{i+1}号楼",
                "room_number": "101",
                "contact_name": "王先生",
                "contact_phone": f"1390013900{i}",
                "issue_type": "水电维修",
                "description": "需要维修",
                "urgency": "medium",
                "timeout_hours": 24
            }
        )
    
    response = client.get("/api/statistics/")
    assert response.status_code == 200
    data = response.json()
    assert "total_orders" in data
    assert "status_distribution" in data
    assert data["total_orders"] >= 5


def test_export_orders():
    for i in range(3):
        client.post(
            "/api/repair-orders/",
            json={
                "building": f"{i+1}号楼",
                "room_number": "101",
                "contact_name": "王先生",
                "contact_phone": f"1390013900{i}",
                "issue_type": "水电维修",
                "description": "需要维修",
                "urgency": "medium",
                "timeout_hours": 24
            }
        )
    
    response = client.post("/api/export/", json={})
    assert response.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers["content-type"]


def test_filter_orders_by_status():
    for i in range(3):
        client.post(
            "/api/repair-orders/",
            json={
                "building": f"{i+1}号楼",
                "room_number": "101",
                "contact_name": "王先生",
                "contact_phone": f"1390013900{i}",
                "issue_type": "水电维修",
                "description": "需要维修",
                "urgency": "medium",
                "timeout_hours": 24
            }
        )
    
    response = client.get("/api/repair-orders/?status=pending")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3
    for order in data:
        assert order["status"] == "pending"


def test_get_exception_records():
    order_response = client.post(
        "/api/repair-orders/",
        json={
            "building": "1号楼",
            "room_number": "101",
            "contact_name": "王先生",
            "contact_phone": "13900139001",
            "issue_type": "水电维修",
            "description": "厨房水龙头漏水",
            "urgency": "medium",
            "timeout_hours": 24
        }
    )
    order_id = order_response.json()["id"]
    
    client.put(
        f"/api/repair-orders/{order_id}/correct",
        json={
            "field_name": "description",
            "old_value": "厨房水龙头漏水",
            "new_value": "浴室水龙头漏水",
            "operator": "管理员",
            "reason": "更正描述"
        }
    )
    
    response = client.get(f"/api/exception-records/{order_id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["operation_type"] == "manual_correction"
