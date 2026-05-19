import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid
import json

from main import app, get_db
from database import Base
from models import Role

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_cleaning.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

TEST_HEADERS = {
    "X-Operator-Id": "admin_001",
    "X-Operator-Name": "系统管理员",
    "X-Operator-Role": Role.ADMIN.value
}


def get_test_headers(role=Role.ADMIN):
    return {
        "X-Operator-Id": f"test_{role.value}_001",
        "X-Operator-Name": f"Test{role.value}",
        "X-Operator-Role": role.value
    }


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "民宿保洁管理系统 API"
    assert "version" in data


def test_create_order():
    idempotency_key = str(uuid.uuid4())
    response = client.post(
        "/api/orders",
        headers=get_test_headers(),
        json={
            "idempotency_key": idempotency_key,
            "room_number": "101",
            "room_type": "大床房",
            "guest_name": "张三",
            "guest_phone": "13800138000",
            "estimated_amount": 50.0,
            "remarks": "测试订单"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["room_number"] == "101"
    assert data["status"] == "pending"
    assert data["created_by"] == "test_admin_001"
    return data["id"]


def test_create_order_idempotency():
    idempotency_key = str(uuid.uuid4())

    response1 = client.post(
        "/api/orders",
        headers=get_test_headers(),
        json={
            "idempotency_key": idempotency_key,
            "room_number": "102",
            "room_type": "标准间",
            "estimated_amount": 45.0
        }
    )
    assert response1.status_code == 200
    data1 = response1.json()

    response2 = client.post(
        "/api/orders",
        headers=get_test_headers(),
        json={
            "idempotency_key": idempotency_key,
            "room_number": "102",
            "room_type": "标准间",
            "estimated_amount": 45.0
        }
    )
    assert response2.status_code == 200
    data2 = response2.json()

    assert data1["id"] == data2["id"]


def test_assign_order():
    order_id = test_create_order()

    response = client.put(
        f"/api/orders/{order_id}/assign",
        headers=get_test_headers(),
        json={
            "cleaner_id": 1,
            "cleaner_name": "李阿姨"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "assigned"
    assert data["cleaner_id"] == 1
    assert data["cleaner_name"] == "李阿姨"


def test_complete_order():
    idempotency_key = str(uuid.uuid4())
    order_response = client.post(
        "/api/orders",
        headers=get_test_headers(),
        json={
            "idempotency_key": idempotency_key,
            "room_number": "103",
            "room_type": "套房",
            "estimated_amount": 80.0
        }
    )
    order_id = order_response.json()["id"]

    client.put(
        f"/api/orders/{order_id}/assign",
        headers=get_test_headers(),
        json={"cleaner_id": 2, "cleaner_name": "王阿姨"}
    )

    response = client.put(
        f"/api/orders/{order_id}/complete",
        headers=get_test_headers(),
        json={}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    return order_id


def test_create_acceptance_passed():
    order_id = test_complete_order()

    idempotency_key = str(uuid.uuid4())
    response = client.post(
        "/api/acceptances",
        headers=get_test_headers(),
        json={
            "idempotency_key": idempotency_key,
            "order_id": order_id,
            "passed": True,
            "quality_score": 95,
            "inspector_id": "inspector_001",
            "inspector_name": "质检员A"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["passed"] == True


def test_create_acceptance_failed():
    idempotency_key = str(uuid.uuid4())
    order_response = client.post(
        "/api/orders",
        headers=get_test_headers(),
        json={
            "idempotency_key": idempotency_key,
            "room_number": "104",
            "room_type": "标准间",
            "estimated_amount": 45.0
        }
    )
    order_id = order_response.json()["id"]

    client.put(
        f"/api/orders/{order_id}/assign",
        headers=get_test_headers(),
        json={"cleaner_id": 3, "cleaner_name": "赵阿姨"}
    )
    client.put(
        f"/api/orders/{order_id}/complete",
        headers=get_test_headers(),
        json={}
    )

    idempotency_key2 = str(uuid.uuid4())
    response = client.post(
        "/api/acceptances",
        headers=get_test_headers(),
        json={
            "idempotency_key": idempotency_key2,
            "order_id": order_id,
            "passed": False,
            "issues_found": "卫生间有污渍",
            "inspector_id": "inspector_002",
            "inspector_name": "质检员B"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["passed"] == False
    return order_id, data["id"]


def test_create_and_complete_rework():
    order_id, acceptance_id = test_create_acceptance_failed()

    idempotency_key = str(uuid.uuid4())
    rework_response = client.post(
        "/api/reworks",
        headers=get_test_headers(),
        json={
            "idempotency_key": idempotency_key,
            "order_id": order_id,
            "acceptance_id": acceptance_id,
            "reason": "卫生间有污渍需要返工",
            "assigned_to": "cleaner_003",
            "assigned_name": "赵阿姨",
            "deadline": "2024-12-31T18:00:00"
        }
    )
    assert rework_response.status_code == 200
    rework_data = rework_response.json()
    assert rework_data["rework_count"] == 1

    rework_id = rework_data["id"]
    complete_response = client.put(
        f"/api/reworks/{rework_id}/complete",
        headers=get_test_headers(),
        json={}
    )
    assert complete_response.status_code == 200
    complete_data = complete_response.json()
    assert complete_data["completed"] == True


def test_create_and_approve_deduction():
    order_id = test_create_order()

    idempotency_key = str(uuid.uuid4())
    deduction_response = client.post(
        "/api/deductions",
        headers=get_test_headers(),
        json={
            "idempotency_key": idempotency_key,
            "order_id": order_id,
            "deduction_type": "quality",
            "amount": 20.0,
            "reason": "清洁质量不达标"
        }
    )
    assert deduction_response.status_code == 200
    deduction_data = deduction_response.json()
    assert deduction_data["approved"] == False

    deduction_id = deduction_data["id"]
    approve_response = client.put(
        f"/api/deductions/{deduction_id}/approve",
        headers=get_test_headers(),
        json={"approved": True}
    )
    assert approve_response.status_code == 200
    approve_data = approve_response.json()
    assert approve_data["approved"] == True


def test_create_settlement():
    idempotency_key = str(uuid.uuid4())
    order_response = client.post(
        "/api/orders",
        headers=get_test_headers(),
        json={
            "idempotency_key": idempotency_key,
            "room_number": "105",
            "room_type": "大床房",
            "estimated_amount": 50.0
        }
    )
    order_id = order_response.json()["id"]

    idempotency_key2 = str(uuid.uuid4())
    settlement_response = client.post(
        "/api/settlements",
        headers=get_test_headers(),
        json={
            "idempotency_key": idempotency_key2,
            "order_id": order_id,
            "cleaner_id": 4,
            "cleaner_name": "刘阿姨",
            "base_amount": 50.0,
            "settlement_month": "2024-12"
        }
    )
    assert settlement_response.status_code == 200
    settlement_data = settlement_response.json()
    assert settlement_data["final_settlement"] == 50.0
    assert settlement_data["paid"] == False
    return settlement_data["id"]


def test_pay_settlement():
    settlement_id = test_create_settlement()

    pay_response = client.put(
        f"/api/settlements/{settlement_id}/pay",
        headers=get_test_headers(),
        json={"paid": True}
    )
    assert pay_response.status_code == 200
    pay_data = pay_response.json()
    assert pay_data["paid"] == True


def test_batch_create_orders():
    orders = []
    for i in range(5):
        orders.append({
            "idempotency_key": str(uuid.uuid4()),
            "room_number": f"20{i + 1}",
            "room_type": "标准间",
            "estimated_amount": 45.0
        })

    response = client.post(
        "/api/orders/batch",
        headers=get_test_headers(),
        json=orders
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 5
    assert data["success_count"] == 5
    assert data["failed_count"] == 0


def test_query_orders():
    response = client.get(
        "/api/orders",
        params={
            "status": "pending",
            "limit": 10
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_query_deductions():
    response = client.get(
        "/api/deductions",
        params={
            "deduction_type": "quality",
            "approved": True
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_query_settlements():
    response = client.get(
        "/api/settlements",
        params={
            "settlement_month": "2024-12",
            "paid": True
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_query_audit_logs():
    response = client.get(
        "/api/audit-logs",
        params={
            "action": "CREATE",
            "entity_type": "Order"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_export_orders():
    response = client.get("/api/orders/export")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def test_export_deductions():
    response = client.get("/api/deductions/export")
    assert response.status_code == 200


def test_export_settlements():
    response = client.get("/api/settlements/export")
    assert response.status_code == 200


def test_export_audit_logs():
    response = client.get("/api/audit-logs/export")
    assert response.status_code == 200


def test_get_enums():
    response = client.get("/api/enums/order-status")
    assert response.status_code == 200
    data = response.json()
    assert "PENDING" in data
    assert "ASSIGNED" in data

    response = client.get("/api/enums/deduction-type")
    assert response.status_code == 200
    data = response.json()
    assert "QUALITY" in data

    response = client.get("/api/enums/role")
    assert response.status_code == 200
    data = response.json()
    assert "ADMIN" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
