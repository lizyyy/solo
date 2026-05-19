import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

from main import app, get_db
from database import Base, init_db

TEST_DATABASE_URL = "sqlite:///./test_sql_erase.db"

engine = create_engine(
    TEST_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    from database import EraseRule
    if db.query(EraseRule).count() == 0:
        default_rules = [
            EraseRule(rule_name="手机号", pattern=r"^1[3-9]\d{9}$", replacement="[手机号]", risk_level="high"),
            EraseRule(rule_name="中文姓名", pattern=r"^[\u4e00-\u9fa5]{2,4}$", replacement="[姓名]", risk_level="high"),
            EraseRule(rule_name="身份证号", pattern=r"^\d{17}[\dXx]$", replacement="[身份证号]", risk_level="high"),
            EraseRule(rule_name="邮箱", pattern=r"^[\w.-]+@[\w.-]+\.\w+$", replacement="[邮箱]", risk_level="medium"),
            EraseRule(rule_name="银行卡号", pattern=r"^\d{16,19}$", replacement="[银行卡号]", risk_level="high")
        ]
        db.add_all(default_rules)
        db.commit()
    db.close()
    
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_sql_erase.db"):
        os.remove("./test_sql_erase.db")


def test_create_task(client):
    response = client.post(
        "/api/v1/tasks",
        json={
            "sql_content": "SELECT * FROM users WHERE name = '张三' AND phone = '13800138000'",
            "params": {"name": "张三", "phone": "13800138000"},
            "created_by": "admin"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "pending"
    assert data["created_by"] == "admin"
    return data["id"]


def test_list_tasks(client):
    test_create_task(client)
    response = client.get("/api/v1/tasks?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data
    assert len(data["items"]) > 0


def test_get_task_detail(client):
    task_id = test_create_task(client)
    response = client.get(f"/api/v1/tasks/{task_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == task_id
    assert "risk_fragments" in data
    assert "operation_logs" in data


def test_auto_process_task(client):
    task_id = test_create_task(client)
    response = client.post(
        f"/api/v1/tasks/{task_id}/auto-process",
        json={"processor": "system"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "processing"
    assert data["processed_sql"] is not None
    assert len(data["risk_fragments"]) > 0


def test_auto_process_wrong_status(client):
    task_id = test_create_task(client)
    client.post(
        f"/api/v1/tasks/{task_id}/auto-process",
        json={"processor": "system"}
    )
    response = client.post(
        f"/api/v1/tasks/{task_id}/auto-process",
        json={"processor": "system"}
    )
    assert response.status_code == 400


def test_manual_review_approved(client):
    task_id = test_create_task(client)
    client.post(
        f"/api/v1/tasks/{task_id}/auto-process",
        json={"processor": "system"}
    )
    response = client.post(
        f"/api/v1/tasks/{task_id}/manual-review",
        json={
            "processed_sql": "SELECT * FROM users WHERE name = '[姓名]' AND phone = '[手机号]'",
            "reviewer": "admin",
            "conclusion": "approved",
            "comments": "脱敏正确"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "reviewed"
    assert all(f["is_verified"] for f in data["risk_fragments"])


def test_manual_review_rejected(client):
    task_id = test_create_task(client)
    client.post(
        f"/api/v1/tasks/{task_id}/auto-process",
        json={"processor": "system"}
    )
    response = client.post(
        f"/api/v1/tasks/{task_id}/manual-review",
        json={
            "processed_sql": "SELECT * FROM users WHERE name = '张三' AND phone = '13800138000'",
            "reviewer": "admin",
            "conclusion": "rejected",
            "comments": "需要重新处理"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "processing"


def test_complete_task(client):
    task_id = test_create_task(client)
    client.post(
        f"/api/v1/tasks/{task_id}/auto-process",
        json={"processor": "system"}
    )
    client.post(
        f"/api/v1/tasks/{task_id}/manual-review",
        json={
            "processed_sql": "SELECT * FROM users WHERE name = '[姓名]'",
            "reviewer": "admin",
            "conclusion": "approved",
            "comments": "OK"
        }
    )
    response = client.post(f"/api/v1/tasks/{task_id}/complete?operator=admin")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"


def test_withdraw_task(client):
    task_id = test_create_task(client)
    response = client.post(
        f"/api/v1/tasks/{task_id}/withdraw",
        json={
            "operator": "admin",
            "reason": "数据有误"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "withdrawn"


def test_withdraw_completed_task(client):
    task_id = test_create_task(client)
    client.post(
        f"/api/v1/tasks/{task_id}/auto-process",
        json={"processor": "system"}
    )
    client.post(
        f"/api/v1/tasks/{task_id}/manual-review",
        json={
            "processed_sql": "SELECT * FROM users WHERE name = '[姓名]'",
            "reviewer": "admin",
            "conclusion": "approved",
            "comments": "OK"
        }
    )
    client.post(f"/api/v1/tasks/{task_id}/complete?operator=admin")
    
    response = client.post(
        f"/api/v1/tasks/{task_id}/withdraw",
        json={
            "operator": "admin",
            "reason": "测试"
        }
    )
    assert response.status_code == 400


def test_export_task(client):
    task_id = test_create_task(client)
    client.post(
        f"/api/v1/tasks/{task_id}/auto-process",
        json={"processor": "system"}
    )
    response = client.get(f"/api/v1/tasks/{task_id}/export")
    assert response.status_code == 200
    assert "application/vnd.openxmlformats" in response.headers["content-type"]


def test_get_nonexistent_task(client):
    response = client.get("/api/v1/tasks/99999")
    assert response.status_code == 404


def test_list_rules(client):
    response = client.get("/api/v1/rules")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0


def test_create_rule(client):
    response = client.post(
        "/api/v1/rules",
        json={
            "rule_name": "地址",
            "pattern": r"^.*[省市区街道].*$",
            "replacement": "[地址]",
            "rule_type": "regex",
            "risk_level": "medium"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["rule_name"] == "地址"


def test_toggle_rule(client):
    response = client.post(
        "/api/v1/rules",
        json={
            "rule_name": "测试规则",
            "pattern": r"\d+",
            "replacement": "[数字]",
            "rule_type": "regex",
            "risk_level": "low"
        }
    )
    rule_id = response.json()["id"]
    
    response = client.put(f"/api/v1/rules/{rule_id}/toggle")
    assert response.status_code == 200
    data = response.json()
    assert data["is_enabled"] == False
    
    response = client.put(f"/api/v1/rules/{rule_id}/toggle")
    assert response.status_code == 200
    data = response.json()
    assert data["is_enabled"] == True


def test_filter_tasks_by_status(client):
    response = client.get("/api/v1/tasks?status=pending")
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["status"] == "pending"
