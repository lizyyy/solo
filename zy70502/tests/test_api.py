import os
import sys
import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import Base, get_db

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_openapi_verdict.db"

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


OLD_CONTRACT_DOC_ONLY = {
    "paths": {
        "/api/v1/users": {
            "get": {
                "summary": "获取用户列表",
                "description": "获取所有用户信息",
                "responses": {
                    "200": {
                        "description": "成功"
                    }
                }
            }
        }
    }
}

NEW_CONTRACT_DOC_ONLY = {
    "paths": {
        "/api/v1/users": {
            "get": {
                "summary": "获取用户列表V2",
                "description": "获取所有用户详细信息，支持分页",
                "responses": {
                    "200": {
                        "description": "请求成功"
                    }
                }
            }
        }
    }
}

OLD_CONTRACT_COMPATIBLE = {
    "paths": {
        "/api/v1/orders": {
            "post": {
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "order_id": {"type": "string"}
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

NEW_CONTRACT_COMPATIBLE = {
    "paths": {
        "/api/v1/orders": {
            "post": {
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "order_id": {"type": "string"},
                                    "quantity": {"type": "integer", "nullable": True}
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

OLD_CONTRACT_BREAKING = {
    "paths": {
        "/api/v1/products": {
            "put": {
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "product_id": {"type": "string"},
                                    "price": {"type": "number"}
                                },
                                "required": ["product_id"]
                            }
                        }
                    }
                }
            }
        }
    }
}

NEW_CONTRACT_BREAKING = {
    "paths": {
        "/api/v1/products": {
            "put": {
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "product_id": {"type": "integer"},
                                    "price": {"type": "number"}
                                },
                                "required": ["product_id", "price"]
                            }
                        }
                    }
                }
            }
        }
    }
}


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_create_change_documentation_only():
    response = client.post(
        "/api/v1/changes/",
        json={
            "api_path": "/api/v1/users",
            "http_method": "GET",
            "old_contract": OLD_CONTRACT_DOC_ONLY,
            "new_contract": NEW_CONTRACT_DOC_ONLY,
            "caller": "service_a"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["api_path"] == "/api/v1/users"
    assert data["http_method"] == "GET"
    assert data["caller"] == "service_a"
    assert data["risk_level"] == "safe"
    assert data["change_category"] == "documentation_only"
    assert data["status"] == "awaiting_confirmation"
    assert "文档变更" in data["verdict_opinion"]


def test_create_change_compatible():
    response = client.post(
        "/api/v1/changes/",
        json={
            "api_path": "/api/v1/orders",
            "http_method": "POST",
            "old_contract": OLD_CONTRACT_COMPATIBLE,
            "new_contract": NEW_CONTRACT_COMPATIBLE,
            "caller": "service_b"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["change_category"] == "compatible"


def test_create_change_breaking():
    response = client.post(
        "/api/v1/changes/",
        json={
            "api_path": "/api/v1/products",
            "http_method": "PUT",
            "old_contract": OLD_CONTRACT_BREAKING,
            "new_contract": NEW_CONTRACT_BREAKING,
            "caller": "service_c"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["change_category"] == "breaking"
    assert data["risk_level"] in ["medium", "high", "critical"]


def test_get_change():
    create_response = client.post(
        "/api/v1/changes/",
        json={
            "api_path": "/api/v1/users",
            "http_method": "GET",
            "old_contract": OLD_CONTRACT_DOC_ONLY,
            "new_contract": NEW_CONTRACT_DOC_ONLY,
            "caller": "service_a"
        }
    )
    change_id = create_response.json()["id"]

    get_response = client.get(f"/api/v1/changes/{change_id}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == change_id


def test_get_change_not_found():
    response = client.get("/api/v1/changes/99999")
    assert response.status_code == 404


def test_list_changes():
    for i in range(5):
        client.post(
            "/api/v1/changes/",
            json={
                "api_path": f"/api/v1/resource_{i}",
                "http_method": "GET",
                "old_contract": OLD_CONTRACT_DOC_ONLY,
                "new_contract": NEW_CONTRACT_DOC_ONLY,
                "caller": f"service_{i}"
            }
        )

    response = client.get("/api/v1/changes/")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 5
    assert len(data["items"]) == 5


def test_list_changes_with_filters():
    client.post(
        "/api/v1/changes/",
        json={
            "api_path": "/api/v1/users",
            "http_method": "GET",
            "old_contract": OLD_CONTRACT_DOC_ONLY,
            "new_contract": NEW_CONTRACT_DOC_ONLY,
            "caller": "service_a"
        }
    )

    client.post(
        "/api/v1/changes/",
        json={
            "api_path": "/api/v1/products",
            "http_method": "PUT",
            "old_contract": OLD_CONTRACT_BREAKING,
            "new_contract": NEW_CONTRACT_BREAKING,
            "caller": "service_c"
        }
    )

    response = client.get("/api/v1/changes/?risk_level=safe")
    assert response.status_code == 200
    assert response.json()["total"] == 1

    response = client.get("/api/v1/changes/?change_category=breaking")
    assert response.status_code == 200
    assert response.json()["total"] == 1

    response = client.get("/api/v1/changes/?caller=service_a")
    assert response.status_code == 200
    assert response.json()["total"] == 1


def test_update_status():
    create_response = client.post(
        "/api/v1/changes/",
        json={
            "api_path": "/api/v1/users",
            "http_method": "GET",
            "old_contract": OLD_CONTRACT_DOC_ONLY,
            "new_contract": NEW_CONTRACT_DOC_ONLY,
            "caller": "service_a"
        }
    )
    change_id = create_response.json()["id"]

    response = client.patch(
        f"/api/v1/changes/{change_id}/status",
        json={
            "new_status": "confirmed",
            "reason": "调用方确认无影响",
            "updated_by": "tester"
        }
    )
    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"
    assert response.json()["confirmed_at"] is not None


def test_manual_correction():
    create_response = client.post(
        "/api/v1/changes/",
        json={
            "api_path": "/api/v1/users",
            "http_method": "GET",
            "old_contract": OLD_CONTRACT_DOC_ONLY,
            "new_contract": NEW_CONTRACT_DOC_ONLY,
            "caller": "service_a"
        }
    )
    change_id = create_response.json()["id"]

    response = client.patch(
        f"/api/v1/changes/{change_id}/correct",
        json={
            "risk_level": "low",
            "verdict_opinion": "实际测试后确认这是低风险变更",
            "change_category": "compatible",
            "corrected_by": "admin",
            "reason": "经过实际联调确认"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] == "low"
    assert data["change_category"] == "compatible"
    assert data["status"] == "appealed"
    assert data["manual_override"] is not None


def test_defer_verdict():
    create_response = client.post(
        "/api/v1/changes/",
        json={
            "api_path": "/api/v1/users",
            "http_method": "GET",
            "old_contract": OLD_CONTRACT_DOC_ONLY,
            "new_contract": NEW_CONTRACT_DOC_ONLY,
            "caller": "service_a"
        }
    )
    change_id = create_response.json()["id"]

    response = client.post(
        f"/api/v1/changes/{change_id}/defer",
        json={
            "reason": "等待更多信息",
            "expiry_days": 7,
            "requested_by": "tester"
        }
    )
    assert response.status_code == 200
    assert response.json()["status"] == "deferred"
    assert response.json()["deferral_reason"] == "等待更多信息"
    assert response.json()["deferral_expiry"] is not None


def test_create_and_get_report():
    create_response = client.post(
        "/api/v1/changes/",
        json={
            "api_path": "/api/v1/users",
            "http_method": "GET",
            "old_contract": OLD_CONTRACT_DOC_ONLY,
            "new_contract": NEW_CONTRACT_DOC_ONLY,
            "caller": "service_a"
        }
    )
    change_id = create_response.json()["id"]

    report_response = client.post(f"/api/v1/changes/{change_id}/report")
    assert report_response.status_code == 200
    assert report_response.json()["report_type"] == "full"

    reports_response = client.get(f"/api/v1/changes/{change_id}/reports")
    assert reports_response.status_code == 200
    assert len(reports_response.json()) >= 1


def test_export_changes():
    for i in range(3):
        client.post(
            "/api/v1/changes/",
            json={
                "api_path": f"/api/v1/resource_{i}",
                "http_method": "GET",
                "old_contract": OLD_CONTRACT_DOC_ONLY,
                "new_contract": NEW_CONTRACT_DOC_ONLY,
                "caller": f"service_{i}"
            }
        )

    response = client.get("/api/v1/export/")
    assert response.status_code == 200
    data = response.json()
    assert "export_time" in data
    assert data["total_count"] == 3


def test_invalid_risk_level_filter():
    response = client.get("/api/v1/changes/?risk_level=invalid_level")
    assert response.status_code == 400
    assert "无效的风险等级" in response.json()["error_message"]


def test_invalid_status_filter():
    response = client.get("/api/v1/changes/?status_filter=invalid_status")
    assert response.status_code == 400
    assert "无效的状态" in response.json()["error_message"]


def test_duplicate_request():
    payload = {
        "api_path": "/api/v1/users",
        "http_method": "GET",
        "old_contract": OLD_CONTRACT_DOC_ONLY,
        "new_contract": NEW_CONTRACT_DOC_ONLY,
        "caller": "service_a"
    }

    response1 = client.post("/api/v1/changes/", json=payload)
    assert response1.status_code == 201

    response2 = client.post("/api/v1/changes/", json=payload)
    assert response2.status_code == 201

    list_response = client.get("/api/v1/changes/")
    assert list_response.json()["total"] == 2


def test_dirty_data_missing_fields():
    response = client.post(
        "/api/v1/changes/",
        json={
            "api_path": "/api/v1/users",
            "http_method": "GET",
            "caller": "service_a"
        }
    )
    assert response.status_code == 422


def test_dirty_data_empty_contract():
    response = client.post(
        "/api/v1/changes/",
        json={
            "api_path": "/api/v1/users",
            "http_method": "GET",
            "old_contract": {},
            "new_contract": {},
            "caller": "service_a"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["change_category"] == "unknown"


def test_manual_correction_partial():
    create_response = client.post(
        "/api/v1/changes/",
        json={
            "api_path": "/api/v1/users",
            "http_method": "GET",
            "old_contract": OLD_CONTRACT_DOC_ONLY,
            "new_contract": NEW_CONTRACT_DOC_ONLY,
            "caller": "service_a"
        }
    )
    change_id = create_response.json()["id"]
    original_risk = create_response.json()["risk_level"]

    response = client.patch(
        f"/api/v1/changes/{change_id}/correct",
        json={
            "risk_level": "high",
            "corrected_by": "admin",
            "reason": "只修正风险等级"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] == "high"
    assert data["change_category"] == "documentation_only"


def test_pagination():
    for i in range(15):
        client.post(
            "/api/v1/changes/",
            json={
                "api_path": f"/api/v1/resource_{i}",
                "http_method": "GET",
                "old_contract": OLD_CONTRACT_DOC_ONLY,
                "new_contract": NEW_CONTRACT_DOC_ONLY,
                "caller": f"service_{i}"
            }
        )

    response = client.get("/api/v1/changes/?page=1&page_size=5")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 15
    assert len(data["items"]) == 5
    assert data["page"] == 1

    response = client.get("/api/v1/changes/?page=2&page_size=5")
    assert response.status_code == 200
    assert len(response.json()["items"]) == 5


def test_raw_input_preserved():
    response = client.post(
        "/api/v1/changes/",
        json={
            "api_path": "/api/v1/users",
            "http_method": "GET",
            "old_contract": OLD_CONTRACT_DOC_ONLY,
            "new_contract": NEW_CONTRACT_DOC_ONLY,
            "caller": "service_a"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["raw_input"] is not None
    assert data["raw_input"]["api_path"] == "/api/v1/users"
    assert data["processing_basis"] is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
