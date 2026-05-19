import pytest
import uuid
import os
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import app, Base, get_db

TEST_DB = "./test_cleanup.db"

if os.path.exists(TEST_DB):
    os.remove(TEST_DB)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB}"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
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
def clean_db():
    db = TestingSessionLocal()
    try:
        from main import AuditLog, SandboxCleanup
        db.query(AuditLog).delete()
        db.query(SandboxCleanup).delete()
        db.commit()
    finally:
        db.close()
    yield

@pytest.fixture
def sample_cleanup():
    unique_id = str(uuid.uuid4())[:8]
    response = client.post(
        "/api/cleanup",
        json={
            "sandbox_id": f"SANDBOX-TEST-{unique_id}",
            "resources": [
                {"resource_type": "file", "resource_id": "file-001", "size": 1024},
                {"resource_type": "vm", "resource_id": "vm-001", "size": 1048576}
            ],
            "handler": "tester",
            "notes": "测试清理任务"
        }
    )
    return response.json()


class TestCreateCleanup:
    def test_create_cleanup_success(self):
        unique_id = str(uuid.uuid4())[:8]
        response = client.post(
            "/api/cleanup",
            json={
                "sandbox_id": f"SANDBOX-CREATE-{unique_id}",
                "resources": [
                    {"resource_type": "file", "resource_id": "file-001", "size": 1024}
                ],
                "handler": "tester"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert f"SANDBOX-CREATE-{unique_id}" in data["sandbox_id"]
        assert data["status"] == "pending"
        assert data["resource_inventory"]["total_count"] == 1
    
    def test_create_duplicate_sandbox_conflict(self, sample_cleanup):
        sandbox_id = sample_cleanup["sandbox_id"]
        response = client.post(
            "/api/cleanup",
            json={
                "sandbox_id": sandbox_id,
                "resources": [
                    {"resource_type": "file", "resource_id": "file-002"}
                ]
            }
        )
        assert response.status_code == 409


class TestStatusFlow:
    def test_normal_flow(self, sample_cleanup):
        cleanup_id = sample_cleanup["id"]
        
        response = client.patch(
            f"/api/cleanup/{cleanup_id}/status",
            json={"new_status": "inventory_done", "operator": "tester", "reason": "资源清点完成"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "inventory_done"
        
        response = client.patch(
            f"/api/cleanup/{cleanup_id}/status",
            json={"new_status": "preservation_checked", "operator": "tester", "reason": "保全检查通过"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "preservation_checked"
        
        response = client.patch(
            f"/api/cleanup/{cleanup_id}/status",
            json={"new_status": "ready_for_cleanup", "operator": "tester", "reason": "准备清理"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "ready_for_cleanup"
        
        response = client.patch(
            f"/api/cleanup/{cleanup_id}/status",
            json={"new_status": "cleanup_in_progress", "operator": "tester", "reason": "开始清理"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "cleanup_in_progress"
        
        response = client.patch(
            f"/api/cleanup/{cleanup_id}/summary",
            json={
                "cleanup_summary": {"cleaned_count": 2, "freed_size": 1049600, "status": "success"},
                "operator": "tester"
            }
        )
        assert response.status_code == 200
        assert response.json()["status"] == "cleanup_done"
    
    def test_invalid_status_transition(self, sample_cleanup):
        cleanup_id = sample_cleanup["id"]
        response = client.patch(
            f"/api/cleanup/{cleanup_id}/status",
            json={"new_status": "cleanup_done", "operator": "tester"}
        )
        assert response.status_code == 400


class TestPreservationInterception:
    def test_preservation_blocks_cleanup(self):
        unique_id = str(uuid.uuid4())[:8]
        response = client.post(
            "/api/cleanup",
            json={
                "sandbox_id": f"SANDBOX-PRESERVE-{unique_id}",
                "resources": [{"resource_type": "file", "resource_id": "file-001"}],
                "preservation_tag": "under_investigation",
                "handler": "tester"
            }
        )
        cleanup_id = response.json()["id"]
        
        client.patch(
            f"/api/cleanup/{cleanup_id}/status",
            json={"new_status": "inventory_done", "operator": "tester"}
        )
        client.patch(
            f"/api/cleanup/{cleanup_id}/status",
            json={"new_status": "preservation_checked", "operator": "tester"}
        )
        
        response = client.patch(
            f"/api/cleanup/{cleanup_id}/status",
            json={"new_status": "ready_for_cleanup", "operator": "tester"}
        )
        assert response.status_code == 403
        assert "保全状态" in response.json()["detail"]
    
    def test_update_preservation_tag(self, sample_cleanup):
        cleanup_id = sample_cleanup["id"]
        
        client.patch(
            f"/api/cleanup/{cleanup_id}/status",
            json={"new_status": "inventory_done", "operator": "tester"}
        )
        client.patch(
            f"/api/cleanup/{cleanup_id}/status",
            json={"new_status": "preservation_checked", "operator": "tester"}
        )
        client.patch(
            f"/api/cleanup/{cleanup_id}/status",
            json={"new_status": "ready_for_cleanup", "operator": "tester"}
        )
        
        response = client.patch(
            f"/api/cleanup/{cleanup_id}/preservation",
            json={
                "preservation_tag": "under_investigation",
                "operator": "security_team",
                "reason": "样本正在调查中，需要保全",
                "conclusion": "设置保全标签，阻止清理"
            }
        )
        assert response.status_code == 200
        assert response.json()["preservation_tag"] == "under_investigation"
        assert response.json()["status"] == "preservation_checked"


class TestRevokeCleanup:
    def test_revoke_from_ready(self, sample_cleanup):
        cleanup_id = sample_cleanup["id"]
        
        client.patch(
            f"/api/cleanup/{cleanup_id}/status",
            json={"new_status": "inventory_done", "operator": "tester"}
        )
        client.patch(
            f"/api/cleanup/{cleanup_id}/status",
            json={"new_status": "preservation_checked", "operator": "tester"}
        )
        client.patch(
            f"/api/cleanup/{cleanup_id}/status",
            json={"new_status": "ready_for_cleanup", "operator": "tester"}
        )
        
        response = client.patch(
            f"/api/cleanup/{cleanup_id}/revoke",
            json={
                "reason": "发现该沙箱包含重要证据，撤销清理",
                "operator": "security_team",
                "conclusion": "已撤销，转入保全流程"
            }
        )
        assert response.status_code == 200
        assert response.json()["status"] == "revoked"
        assert response.json()["revoke_reason"] == "发现该沙箱包含重要证据，撤销清理"
    
    def test_revoke_wrong_state(self, sample_cleanup):
        cleanup_id = sample_cleanup["id"]
        response = client.patch(
            f"/api/cleanup/{cleanup_id}/revoke",
            json={"reason": "测试", "operator": "tester"}
        )
        assert response.status_code == 400


class TestAuditLog:
    def test_audit_log_created(self, sample_cleanup):
        cleanup_id = sample_cleanup["id"]
        
        response = client.get(f"/api/cleanup/{cleanup_id}/audit")
        assert response.status_code == 200
        logs = response.json()
        assert len(logs) >= 1
        assert logs[0]["action"] == "CREATE"
        assert logs[0]["original_input"] is not None


class TestQueryAndExport:
    def test_list_cleanups(self, sample_cleanup):
        response = client.get("/api/cleanup")
        assert response.status_code == 200
        assert len(response.json()) >= 1
    
    def test_list_by_status(self, sample_cleanup):
        response = client.get("/api/cleanup?status=pending")
        assert response.status_code == 200
        for item in response.json():
            assert item["status"] == "pending"
    
    def test_export_cleanups(self, sample_cleanup):
        response = client.get("/api/export/cleanup")
        assert response.status_code == 200
        data = response.json()
        assert "export_time" in data
        assert "total_count" in data
        assert "data" in data
    
    def test_get_stats(self):
        response = client.get("/api/stats")
        assert response.status_code == 200
        data = response.json()
        assert "by_status" in data
        assert "by_preservation" in data


class TestCancelCleanup:
    def test_cancel_from_pending(self, sample_cleanup):
        cleanup_id = sample_cleanup["id"]
        response = client.patch(
            f"/api/cleanup/{cleanup_id}/cancel",
            json={"reason": "取消清理任务", "operator": "tester"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "cancelled"


class TestCleanupPlan:
    def test_update_plan(self, sample_cleanup):
        cleanup_id = sample_cleanup["id"]
        response = client.patch(
            f"/api/cleanup/{cleanup_id}/plan",
            json={
                "cleanup_plan": {
                    "steps": ["备份", "删除文件", "释放VM"],
                    "estimated_time": "10min",
                    "risk_level": "low"
                },
                "operator": "tester",
                "reason": "更新清理计划"
            }
        )
        assert response.status_code == 200
        assert response.json()["cleanup_plan"]["steps"] is not None
