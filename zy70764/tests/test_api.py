import pytest
import json
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import Base, get_db
from app import models

SQLALCHEMY_DATABASE_URL = "sqlite:///./data/test.db"

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


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_upload_collection(db_session):
    sample_collection = {
        "info": {
            "name": "测试Collection",
            "_postman_id": "test-123",
            "schema": "v2.1"
        },
        "item": [
            {
                "name": "测试请求1",
                "event": [
                    {
                        "listen": "test",
                        "script": {
                            "exec": [
                                "pm.test(\"Status code is 200\", function () {",
                                "    pm.response.to.have.status(200);",
                                "});"
                            ]
                        }
                    }
                ],
                "request": {
                    "method": "GET",
                    "url": "https://api.example.com/users"
                },
                "response": [
                    {
                        "name": "成功响应",
                        "code": 200,
                        "body": "{\"status\":\"ok\"}"
                    }
                ]
            },
            {
                "name": "测试请求2-无断言",
                "request": {
                    "method": "POST",
                    "url": "https://api.example.com/users"
                },
                "response": []
            }
        ]
    }

    response = client.post(
        "/collections/upload",
        files={"file": ("collection.json", json.dumps(sample_collection), "application/json")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_requests"] == 2
    assert data["requests_without_assertions"] == 1
    assert data["requests_without_examples"] == 1


def test_list_collections(db_session):
    test_upload_collection(db_session)
    response = client.get("/collections")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_get_collection(db_session):
    test_upload_collection(db_session)
    collections = client.get("/collections").json()
    collection_id = collections[0]["id"]

    response = client.get(f"/collections/{collection_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "测试Collection"


def test_get_collection_requests(db_session):
    test_upload_collection(db_session)
    collections = client.get("/collections").json()
    collection_id = collections[0]["id"]

    response = client.get(f"/collections/{collection_id}/requests")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_get_requests_without_assertions(db_session):
    test_upload_collection(db_session)
    collections = client.get("/collections").json()
    collection_id = collections[0]["id"]

    response = client.get(f"/collections/{collection_id}/requests/no-assertions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "测试请求2-无断言"


def test_get_request_detail(db_session):
    test_upload_collection(db_session)
    collections = client.get("/collections").json()
    collection_id = collections[0]["id"]

    requests = client.get(f"/collections/{collection_id}/requests").json()
    request_id = requests[0]["id"]

    response = client.get(f"/requests/{request_id}")
    assert response.status_code == 200
    data = response.json()
    assert "assertions" in data
    assert "examples" in data
    assert "variables" in data


def test_update_request_status(db_session):
    test_upload_collection(db_session)
    collections = client.get("/collections").json()
    collection_id = collections[0]["id"]

    requests = client.get(f"/collections/{collection_id}/requests/no-assertions").json()
    request_id = requests[0]["id"]

    status_update = {
        "request_id": request_id,
        "new_status": "人工处理中",
        "handler": "测试用户",
        "conclusion": "该接口不需要断言",
        "raw_input": "手动标记无需断言"
    }

    response = client.put("/requests/status", json=status_update)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "人工处理中"

    logs_response = client.get(f"/requests/{request_id}/audit-logs")
    assert logs_response.status_code == 200
    logs = logs_response.json()
    assert len(logs) >= 1
    assert logs[0]["handler"] == "测试用户"


def test_get_coverage_stats(db_session):
    test_upload_collection(db_session)
    collections = client.get("/collections").json()
    collection_id = collections[0]["id"]

    response = client.get(f"/collections/{collection_id}/coverage")
    assert response.status_code == 200
    data = response.json()
    assert data["total_requests"] == 2
    assert data["assertion_coverage"] == 50.0
    assert data["example_coverage"] == 50.0


def test_generate_and_export_report(db_session):
    test_upload_collection(db_session)
    collections = client.get("/collections").json()
    collection_id = collections[0]["id"]

    response = client.post(f"/collections/{collection_id}/reports?generated_by=测试用户")
    assert response.status_code == 200
    report = response.json()
    assert report["generated_by"] == "测试用户"

    report_id = report["id"]
    export_response = client.get(f"/reports/{report_id}/export")
    assert export_response.status_code == 200
    export_data = export_response.json()
    assert "stats" in export_data
    assert "requests_without_assertions" in export_data


def test_delete_collection(db_session):
    test_upload_collection(db_session)
    collections = client.get("/collections").json()
    collection_id = collections[0]["id"]

    response = client.delete(f"/collections/{collection_id}")
    assert response.status_code == 200

    get_response = client.get(f"/collections/{collection_id}")
    assert get_response.status_code == 404


def test_upload_invalid_collection(db_session):
    response = client.post(
        "/collections/upload",
        files={"file": ("invalid.json", "not a json", "application/json")}
    )
    assert response.status_code == 400


def test_upload_environment(db_session):
    env_data = {
        "name": "测试环境",
        "id": "env-123",
        "values": [
            {"key": "base_url", "value": "https://api.example.com"},
            {"key": "token", "value": "test-token-123"}
        ]
    }

    response = client.post(
        "/environments/upload",
        files={"file": ("env.json", json.dumps(env_data), "application/json")}
    )
    assert response.status_code == 200


def test_list_environments(db_session):
    test_upload_environment(db_session)
    response = client.get("/environments")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_variable_extraction(db_session):
    collection_with_vars = {
        "info": {
            "name": "变量测试Collection",
            "_postman_id": "var-test-123",
            "schema": "v2.1"
        },
        "item": [
            {
                "name": "变量测试请求",
                "request": {
                    "method": "GET",
                    "url": "{{base_url}}/api/{{version}}/users?id={{user_id}}"
                },
                "response": []
            }
        ]
    }

    response = client.post(
        "/collections/upload",
        files={"file": ("collection.json", json.dumps(collection_with_vars), "application/json")}
    )
    assert response.status_code == 200

    collections = client.get("/collections").json()
    collection_id = collections[0]["id"]

    stats = client.get(f"/collections/{collection_id}/coverage").json()
    assert stats["total_variables"] >= 3
