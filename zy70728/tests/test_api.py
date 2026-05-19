import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, get_db
from app.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_api.db"

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
    data = response.json()
    assert data["status"] == "healthy"


def test_create_proxy_rule(db_session):
    response = client.post(
        "/api/rules/",
        json={
            "name": "测试规则",
            "path_pattern": "/api/v1/*",
            "method": "*",
            "target_url": "http://backend.example.com",
            "is_active": True,
            "priority": 10,
            "created_by": "tester",
            "description": "测试用的代理规则"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "测试规则"
    assert data["path_pattern"] == "/api/v1/*"
    assert data["id"] is not None


def test_list_proxy_rules(db_session):
    for i in range(3):
        client.post(
            "/api/rules/",
            json={
                "name": f"规则{i}",
                "path_pattern": f"/api/{i}/*",
                "method": "*",
                "is_active": True,
                "priority": i
            }
        )
    response = client.get("/api/rules/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3


def test_match_rule(db_session):
    client.post(
        "/api/rules/",
        json={
            "name": "匹配测试规则",
            "path_pattern": "/api/v1/users/*",
            "method": "GET",
            "target_url": "http://user-service",
            "is_active": True,
            "priority": 10
        }
    )
    response = client.post(
        "/api/rules/match/",
        json={
            "path": "/api/v1/users/123",
            "method": "GET"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["matched"] is True
    assert data["rule"]["name"] == "匹配测试规则"


def test_match_rule_not_found(db_session):
    response = client.post(
        "/api/rules/match/",
        json={
            "path": "/api/nonexistent",
            "method": "POST"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["matched"] is False


def test_create_sample_request(db_session):
    response = client.post(
        "/api/samples/",
        json={
            "path": "/api/v1/users/123",
            "method": "GET",
            "headers": {"Content-Type": "application/json"},
            "query_params": {"fields": "id,name"},
            "body": None,
            "source": "production_log",
            "expected_status": 200,
            "expected_response": '{"id": 123, "name": "test"}'
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["path"] == "/api/v1/users/123"
    assert data["method"] == "GET"
    assert data["id"] is not None


def test_list_samples(db_session):
    for i in range(5):
        client.post(
            "/api/samples/",
            json={
                "path": f"/api/v1/users/{i}",
                "method": "GET",
                "expected_status": 200
            }
        )
    response = client.get("/api/samples/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5


def test_create_batch(db_session):
    rule_response = client.post(
        "/api/rules/",
        json={
            "name": "批次测试规则",
            "path_pattern": "/api/*",
            "method": "*",
            "is_active": True
        }
    )
    rule_id = rule_response.json()["id"]

    response = client.post(
        "/api/batches/",
        json={
            "name": "测试批次",
            "created_by": "tester",
            "rule_ids": [rule_id],
            "description": "测试用的批次"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "测试批次"
    assert data["status"] == "pending"
    assert data["id"] is not None


def test_get_batch_status(db_session):
    rule_response = client.post(
        "/api/rules/",
        json={
            "name": "批次状态测试规则",
            "path_pattern": "/api/*",
            "method": "*",
            "is_active": True
        }
    )
    rule_id = rule_response.json()["id"]

    batch_response = client.post(
        "/api/batches/",
        json={
            "name": "状态测试批次",
            "rule_ids": [rule_id]
        }
    )
    batch_id = batch_response.json()["id"]

    response = client.get(f"/api/batches/{batch_id}/status/")
    assert response.status_code == 200
    data = response.json()
    assert data["batch_id"] == batch_id
    assert data["status"] == "pending"


def test_close_batch(db_session):
    batch_response = client.post(
        "/api/batches/",
        json={
            "name": "关闭测试批次",
            "rule_ids": []
        }
    )
    batch_id = batch_response.json()["id"]

    response = client.post(f"/api/batches/{batch_id}/close/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "批次已关闭"


def test_withdraw_batch(db_session):
    batch_response = client.post(
        "/api/batches/",
        json={
            "name": "撤回测试批次",
            "rule_ids": []
        }
    )
    batch_id = batch_response.json()["id"]

    response = client.post(f"/api/batches/{batch_id}/withdraw/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "批次已撤回"


def test_generate_report(db_session):
    batch_response = client.post(
        "/api/batches/",
        json={
            "name": "报告测试批次",
            "rule_ids": []
        }
    )
    batch_id = batch_response.json()["id"]

    response = client.post(f"/api/batches/{batch_id}/generate-report/")
    assert response.status_code == 200
    data = response.json()
    assert data["batch_id"] == batch_id
    assert "测试报告" in data["name"]


def test_manual_correction(db_session):
    client.post(
        "/api/rules/",
        json={
            "name": "修正测试规则",
            "path_pattern": "/api/*",
            "method": "*",
            "is_active": True
        }
    )
    sample_response = client.post(
        "/api/samples/",
        json={
            "path": "/api/test",
            "method": "GET",
            "expected_status": 200
        }
    )
    batch_response = client.post(
        "/api/batches/",
        json={
            "name": "修正测试批次",
            "rule_ids": []
        }
    )

    from app import crud, schemas
    db = TestingSessionLocal()
    hit = crud.create_hit_result(db, schemas.HitResultCreate(
        batch_id=batch_response.json()["id"],
        rule_id=1,
        sample_request_id=sample_response.json()["id"]
    ))
    db.close()

    response = client.post(
        "/api/manual-correction/",
        json={
            "hit_result_id": hit.id,
            "is_false_positive": True,
            "correction_note": "这是误报",
            "corrected_by": "tester"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "人工修正完成"


def test_list_exceptions(db_session):
    response = client.get("/api/exceptions/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_update_proxy_rule(db_session):
    create_response = client.post(
        "/api/rules/",
        json={
            "name": "更新测试规则",
            "path_pattern": "/api/v1/*",
            "method": "*",
            "is_active": True
        }
    )
    rule_id = create_response.json()["id"]

    update_response = client.put(
        f"/api/rules/{rule_id}",
        json={
            "name": "更新后的规则",
            "priority": 100
        }
    )
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["name"] == "更新后的规则"
    assert data["priority"] == 100


def test_delete_proxy_rule(db_session):
    create_response = client.post(
        "/api/rules/",
        json={
            "name": "删除测试规则",
            "path_pattern": "/api/delete/*",
            "method": "*",
            "is_active": True
        }
    )
    rule_id = create_response.json()["id"]

    delete_response = client.delete(f"/api/rules/{rule_id}")
    assert delete_response.status_code == 200

    get_response = client.get(f"/api/rules/{rule_id}")
    assert get_response.status_code == 404


def test_rule_not_found(db_session):
    response = client.get("/api/rules/999999")
    assert response.status_code == 404
