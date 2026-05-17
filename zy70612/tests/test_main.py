import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app, get_db
from database import Base

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

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

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "价签版本促销到期门店确认API"

def test_main_flow():
    store_response = client.post(
        "/api/v1/stores/",
        json={
            "store_code": "TEST001",
            "name": "测试门店1",
            "region": "测试区域",
            "manager_email": "test1@company.com"
        }
    )
    assert store_response.status_code == 200
    store_id = store_response.json()["id"]

    store2_response = client.post(
        "/api/v1/stores/",
        json={
            "store_code": "TEST002",
            "name": "测试门店2",
            "region": "测试区域",
            "manager_email": "test2@company.com"
        }
    )
    assert store2_response.status_code == 200
    store2_id = store2_response.json()["id"]

    version_response = client.post(
        "/api/v1/price-tag-versions/",
        json={
            "version_code": "TEST-PROMO-001",
            "name": "测试促销活动",
            "description": "这是一个测试促销活动",
            "promotion_start": "2024-06-01T00:00:00",
            "promotion_end": "2024-06-07T23:59:59",
            "created_by": "admin@company.com"
        }
    )
    assert version_response.status_code == 200
    version_id = version_response.json()["id"]

    item_response = client.post(
        f"/api/v1/price-tag-versions/{version_id}/items",
        json={
            "barcode": "6900000000001",
            "product_name": "测试商品1",
            "original_price": 10.00,
            "promotion_price": 8.00,
            "unit": "件"
        }
    )
    assert item_response.status_code == 200

    assign_response = client.post(
        f"/api/v1/price-tag-versions/{version_id}/stores",
        json={
            "store_ids": [store_id, store2_id],
            "assigned_by": "admin@company.com"
        }
    )
    assert assign_response.status_code == 200

    confirm_start_response = client.post(
        "/api/v1/confirmations/",
        json={
            "store_id": store_id,
            "version_id": version_id,
            "confirmation_type": "start",
            "confirmed_by": "store_manager@company.com",
            "photo_url": "https://example.com/photo1.jpg",
            "notes": "促销开始价签已更换"
        }
    )
    assert confirm_start_response.status_code == 200
    confirmation_id = confirm_start_response.json()["id"]

    status_response = client.get(f"/api/v1/price-tag-versions/{version_id}/status")
    assert status_response.status_code == 200
    status_data = status_response.json()
    assert status_data["total_stores"] == 2
    assert status_data["start_confirmed_count"] == 1

    export_response = client.get(f"/api/v1/price-tag-versions/{version_id}/export")
    assert export_response.status_code == 200

def test_duplicate_confirmation_conflict():
    store_response = client.post(
        "/api/v1/stores/",
        json={
            "store_code": "TEST003",
            "name": "测试门店3",
            "region": "测试区域",
            "manager_email": "test3@company.com"
        }
    )
    store_id = store_response.json()["id"]

    version_response = client.post(
        "/api/v1/price-tag-versions/",
        json={
            "version_code": "TEST-PROMO-002",
            "name": "测试促销活动2",
            "description": "这是一个测试促销活动",
            "promotion_start": "2024-06-01T00:00:00",
            "promotion_end": "2024-06-07T23:59:59",
            "created_by": "admin@company.com"
        }
    )
    version_id = version_response.json()["id"]

    client.post(
        f"/api/v1/price-tag-versions/{version_id}/stores",
        json={"store_ids": [store_id]}
    )

    first_response = client.post(
        "/api/v1/confirmations/",
        json={
            "store_id": store_id,
            "version_id": version_id,
            "confirmation_type": "start",
            "confirmed_by": "store_manager@company.com"
        }
    )
    assert first_response.status_code == 200

    duplicate_response = client.post(
        "/api/v1/confirmations/",
        json={
            "store_id": store_id,
            "version_id": version_id,
            "confirmation_type": "start",
            "confirmed_by": "another_user@company.com"
        }
    )
    assert duplicate_response.status_code == 409

    discrepancies = client.get(f"/api/v1/discrepancies/?version_id={version_id}")
    assert discrepancies.status_code == 200
    discrepancy_list = discrepancies.json()
    assert len(discrepancy_list) >= 1
    assert discrepancy_list[0]["discrepancy_type"] == "duplicate_confirmation"

def test_discrepancy_resolution():
    store_response = client.post(
        "/api/v1/stores/",
        json={
            "store_code": "TEST004",
            "name": "测试门店4",
            "region": "测试区域",
            "manager_email": "test4@company.com"
        }
    )
    store_id = store_response.json()["id"]

    discrepancy_response = client.post(
        "/api/v1/discrepancies/",
        json={
            "version_id": 1,
            "store_id": store_id,
            "discrepancy_type": "manual_error",
            "description": "门店提交的确认信息有误",
            "original_input": '{"wrong_data": "test"}',
            "detected_by": "admin@company.com"
        }
    )
    assert discrepancy_response.status_code == 200
    discrepancy_id = discrepancy_response.json()["id"]

    resolve_response = client.post(
        f"/api/v1/discrepancies/{discrepancy_id}/resolve",
        json={
            "resolution": "已联系门店重新确认，确认信息正确",
            "resolved_by": "admin@company.com",
            "correct_action": "reconfirm"
        }
    )
    assert resolve_response.status_code == 200
    resolved_data = resolve_response.json()
    assert resolved_data["status"] == "resolved"
    assert resolved_data["resolved_by"] == "admin@company.com"

def test_confirmation_revocation():
    store_response = client.post(
        "/api/v1/stores/",
        json={
            "store_code": "TEST005",
            "name": "测试门店5",
            "region": "测试区域",
            "manager_email": "test5@company.com"
        }
    )
    store_id = store_response.json()["id"]

    version_response = client.post(
        "/api/v1/price-tag-versions/",
        json={
            "version_code": "TEST-PROMO-003",
            "name": "测试促销活动3",
            "promotion_start": "2024-06-01T00:00:00",
            "promotion_end": "2024-06-07T23:59:59",
            "created_by": "admin@company.com"
        }
    )
    version_id = version_response.json()["id"]

    client.post(
        f"/api/v1/price-tag-versions/{version_id}/stores",
        json={"store_ids": [store_id]}
    )

    confirm_response = client.post(
        "/api/v1/confirmations/",
        json={
            "store_id": store_id,
            "version_id": version_id,
            "confirmation_type": "start",
            "confirmed_by": "store_manager@company.com"
        }
    )
    confirmation_id = confirm_response.json()["id"]

    revoke_response = client.delete(
        f"/api/v1/confirmations/{confirmation_id}?revoked_by=admin@company.com&reason=误操作需要重新确认"
    )
    assert revoke_response.status_code == 200

    discrepancies = client.get(f"/api/v1/discrepancies/?version_id={version_id}")
    discrepancy_list = discrepancies.json()
    assert any(d["discrepancy_type"] == "confirmation_revoked" for d in discrepancy_list)

def test_version_close():
    version_response = client.post(
        "/api/v1/price-tag-versions/",
        json={
            "version_code": "TEST-PROMO-004",
            "name": "测试促销活动4",
            "promotion_start": "2024-06-01T00:00:00",
            "promotion_end": "2024-06-07T23:59:59",
            "created_by": "admin@company.com"
        }
    )
    version_id = version_response.json()["id"]

    close_response = client.post(
        f"/api/v1/price-tag-versions/{version_id}/close",
        json={
            "closed_by": "admin@company.com",
            "notes": "促销活动已结束"
        }
    )
    assert close_response.status_code == 200
    closed_data = close_response.json()
    assert closed_data["status"] == "closed"
    assert closed_data["closed_by"] == "admin@company.com"

def test_duplicate_version_code():
    client.post(
        "/api/v1/price-tag-versions/",
        json={
            "version_code": "DUPLICATE-TEST",
            "name": "测试促销活动",
            "promotion_start": "2024-06-01T00:00:00",
            "promotion_end": "2024-06-07T23:59:59",
            "created_by": "admin@company.com"
        }
    )

    duplicate_response = client.post(
        "/api/v1/price-tag-versions/",
        json={
            "version_code": "DUPLICATE-TEST",
            "name": "另一个测试促销活动",
            "promotion_start": "2024-07-01T00:00:00",
            "promotion_end": "2024-07-07T23:59:59",
            "created_by": "admin@company.com"
        }
    )
    assert duplicate_response.status_code == 400

def test_invalid_store_assignment():
    version_response = client.post(
        "/api/v1/price-tag-versions/",
        json={
            "version_code": "TEST-PROMO-INVALID",
            "name": "测试促销活动",
            "promotion_start": "2024-06-01T00:00:00",
            "promotion_end": "2024-06-07T23:59:59",
            "created_by": "admin@company.com"
        }
    )
    version_id = version_response.json()["id"]

    invalid_assign = client.post(
        f"/api/v1/price-tag-versions/{version_id}/stores",
        json={
            "store_ids": [99999],
            "assigned_by": "admin@company.com"
        }
    )
    assert invalid_assign.status_code == 404
