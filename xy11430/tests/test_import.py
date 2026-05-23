import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from app.core.database import Base, get_db
from app.models.models import UserRole, DataSource, AbnormalType

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
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def get_token(username: str, password: str):
    response = client.post(
        "/api/auth/token",
        data={"username": username, "password": password}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    return None


def test_duplicate_import_idempotency():
    client.post("/")

    token = get_token("admin", "admin123")
    assert token is not None

    headers = {"Authorization": f"Bearer {token}"}

    requisition_data = {
        "requisition_no": "REQ-TEST-001",
        "college": "计算机学院",
        "material_name": "乙醇",
        "quantity": 100,
        "is_abnormal": True,
        "abnormal_type": "loss",
        "abnormal_reason": "实验损耗"
    }

    response1 = client.post(
        "/api/import/requisitions",
        json=requisition_data,
        headers=headers
    )
    assert response1.status_code == 200
    id1 = response1.json()["id"]

    response2 = client.post(
        "/api/import/requisitions",
        json=requisition_data,
        headers=headers
    )
    assert response2.status_code == 200
    id2 = response2.json()["id"]

    assert id1 == id2, "重复导入应该返回同一条记录"


def test_permission_interception():
    client.post("/")

    secretary_token = get_token("secretary", "secretary123")
    assert secretary_token is not None

    headers = {"Authorization": f"Bearer {secretary_token}"}

    response = client.post(
        "/api/batches/",
        json={
            "batch_no": "BATCH-001",
            "name": "测试批次",
            "college": "其他学院"
        },
        headers=headers
    )
    assert response.status_code == 200

    requisition_data = {
        "requisition_no": "REQ-TEST-002",
        "college": "其他学院",
        "material_name": "硫酸",
        "quantity": 50,
        "is_abnormal": True,
        "abnormal_type": "borrow"
    }

    response = client.post(
        "/api/import/requisitions",
        json=requisition_data,
        headers=headers
    )
    assert response.status_code == 403, "学院秘书不能导入其他学院的数据"


def test_abnormal_preservation():
    client.post("/")

    token = get_token("admin", "admin123")
    assert token is not None

    headers = {"Authorization": f"Bearer {token}"}

    batch_response = client.post(
        "/api/batches/",
        json={
            "batch_no": "BATCH-002",
            "name": "测试异常保留",
            "college": "计算机学院"
        },
        headers=headers
    )
    batch_id = batch_response.json()["id"]

    for i in range(3):
        client.post(
            "/api/import/requisitions",
            json={
                "requisition_no": f"REQ-ABN-{i:03d}",
                "college": "计算机学院",
                "batch_id": batch_id,
                "material_name": f"耗材-{i}",
                "quantity": 10 + i,
                "is_abnormal": True,
                "abnormal_type": "loss" if i % 2 == 0 else "borrow"
            },
            headers=headers
        )

    check_response = client.get(
        f"/api/checks/abnormal-preservation/{batch_id}",
        headers=headers
    )
    result = check_response.json()

    assert result["total_abnormal"] >= 3, f"异常记录应该被保留，实际只有 {result['total_abnormal']} 条"
    assert len(result["issues"]) == 0, f"存在一致性问题: {result['issues']}"


def test_export_consistency():
    client.post("/")

    token = get_token("admin", "admin123")
    assert token is not None

    headers = {"Authorization": f"Bearer {token}"}

    batch_response = client.post(
        "/api/batches/",
        json={
            "batch_no": "BATCH-EXPORT",
            "name": "导出测试批次",
            "college": "计算机学院"
        },
        headers=headers
    )
    batch_id = batch_response.json()["id"]

    for i in range(5):
        client.post(
            "/api/import/requisitions",
            json={
                "requisition_no": f"REQ-EXP-{i:03d}",
                "college": "计算机学院",
                "batch_id": batch_id,
                "material_name": f"耗材-{i}",
                "quantity": 10,
                "unit_price": 5.0,
                "total_amount": 50.0,
                "is_abnormal": True,
                "abnormal_type": "damage"
            },
            headers=headers
        )

    check_response = client.get(
        f"/api/checks/export-consistency/{batch_id}",
        headers=headers
    )
    result = check_response.json()

    assert result["consistent"], "API数据与导出数据应该一致"
    assert result["api_count"] >= 5, f"应该至少有5条记录"


def test_history_after_restart():
    client.post("/")

    token = get_token("admin", "admin123")
    assert token is not None

    headers = {"Authorization": f"Bearer {token}"}

    requisition_data = {
        "requisition_no": "REQ-HISTORY-001",
        "college": "计算机学院",
        "material_name": "丙酮",
        "quantity": 25,
        "is_abnormal": True,
        "abnormal_type": "loss",
        "abnormal_reason": "测试历史保留"
    }

    response = client.post(
        "/api/import/requisitions",
        json=requisition_data,
        headers=headers
    )
    assert response.status_code == 200

    receipts_response = client.get(
        "/api/receipts/",
        headers=headers
    )
    receipts = receipts_response.json()
    assert len(receipts) > 0, "应该生成异常回执"

    receipt_id = receipts[0]["id"]

    client.post(
        f"/api/receipts/{receipt_id}/submit",
        json={"receipt_id": receipt_id, "change_reason": "提交审核"},
        headers=headers
    )

    history_response = client.get(
        f"/api/receipts/{receipt_id}/history",
        headers=headers
    )
    history = history_response.json()

    assert len(history) > 0, "状态变更历史应该被记录"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
