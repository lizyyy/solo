import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import Base, get_db, User
from app.config import UserRole, ApplicationStatus

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
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
    db = TestingSessionLocal()
    users = [
        User(id=1, username="researcher1", name="张三", role=UserRole.RESEARCHER, department="心内科"),
        User(id=2, username="ethics1", name="王伦理", role=UserRole.ETHICS_COMMITTEE, department="伦理委员会"),
        User(id=3, username="dataman1", name="钱数据", role=UserRole.DATA_MANAGER, department="数据中心"),
        User(id=4, username="admin1", name="周主任", role=UserRole.ADMIN, department="科研办"),
    ]
    for user in users:
        db.add(user)
    db.commit()
    db.close()
    
    yield
    
    Base.metadata.drop_all(bind=engine)


class TestApplicationCRUD:
    def test_create_application(self):
        response = client.post(
            "/api/applications",
            json={
                "applicant_id": 1,
                "applicant_name": "张三",
                "department": "心内科",
                "project_name": "冠心病危险因素研究",
                "project_description": "分析冠心病患者的危险因素",
                "dataset_id": "DS001",
                "dataset_name": "心血管疾病患者数据集"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["applicant_name"] == "张三"
        assert data["status"] == "draft"
        assert data["version"] == 1

    def test_get_application(self):
        create_response = client.post(
            "/api/applications",
            json={
                "applicant_id": 1,
                "applicant_name": "张三",
                "department": "心内科",
                "project_name": "测试项目",
                "dataset_id": "DS001",
                "dataset_name": "测试数据集"
            }
        )
        app_id = create_response.json()["id"]
        
        get_response = client.get(f"/api/applications/{app_id}")
        assert get_response.status_code == 200
        assert get_response.json()["id"] == app_id

    def test_get_nonexistent_application(self):
        response = client.get("/api/applications/9999")
        assert response.status_code == 404
        assert response.json()["error_code"] == "APPLICATION_NOT_FOUND"

    def test_update_application_in_draft(self):
        create_response = client.post(
            "/api/applications",
            json={
                "applicant_id": 1,
                "applicant_name": "张三",
                "project_name": "旧项目名",
                "dataset_id": "DS001",
                "dataset_name": "测试数据集"
            }
        )
        app_id = create_response.json()["id"]
        
        update_response = client.put(
            f"/api/applications/{app_id}?operator_id=1",
            json={
                "project_name": "新项目名",
                "ethics_approval_file_id": 1001
            }
        )
        assert update_response.status_code == 200
        assert update_response.json()["project_name"] == "新项目名"
        assert update_response.json()["ethics_approval_file_id"] == 1001
        assert update_response.json()["version"] == 2


class TestStatusTransitions:
    def test_submit_without_ethics_approval(self):
        create_response = client.post(
            "/api/applications",
            json={
                "applicant_id": 1,
                "applicant_name": "张三",
                "project_name": "测试项目",
                "dataset_id": "DS001",
                "dataset_name": "测试数据集"
            }
        )
        app_id = create_response.json()["id"]
        
        submit_response = client.post(
            f"/api/applications/{app_id}/submit",
            json={
                "operator_id": 1,
                "operator_name": "张三",
                "operator_role": "researcher",
                "idempotent_key": "submit-001",
                "current_version": 1
            }
        )
        assert submit_response.status_code == 400
        assert submit_response.json()["error_code"] == "MISSING_ETHICS_APPROVAL"

    def test_submit_with_ethics_approval(self):
        create_response = client.post(
            "/api/applications",
            json={
                "applicant_id": 1,
                "applicant_name": "张三",
                "project_name": "测试项目",
                "dataset_id": "DS001",
                "dataset_name": "测试数据集"
            }
        )
        app_id = create_response.json()["id"]
        
        client.put(
            f"/api/applications/{app_id}?operator_id=1",
            json={"ethics_approval_file_id": 1001}
        )
        
        submit_response = client.post(
            f"/api/applications/{app_id}/submit",
            json={
                "operator_id": 1,
                "operator_name": "张三",
                "operator_role": "researcher",
                "idempotent_key": "submit-002",
                "current_version": 2
            }
        )
        assert submit_response.status_code == 200
        assert submit_response.json()["status"] == "pending_ethics_review"

    def test_ethics_review_approved(self):
        create_response = client.post(
            "/api/applications",
            json={
                "applicant_id": 1,
                "applicant_name": "张三",
                "project_name": "测试项目",
                "dataset_id": "DS001",
                "dataset_name": "测试数据集"
            }
        )
        app_id = create_response.json()["id"]
        
        client.put(
            f"/api/applications/{app_id}?operator_id=1",
            json={"ethics_approval_file_id": 1001}
        )
        
        client.post(
            f"/api/applications/{app_id}/submit",
            json={
                "operator_id": 1,
                "operator_name": "张三",
                "operator_role": "researcher",
                "idempotent_key": "submit-003",
                "current_version": 2
            }
        )
        
        review_response = client.post(
            f"/api/applications/{app_id}/ethics-review",
            json={
                "operator_id": 2,
                "operator_name": "王伦理",
                "operator_role": "ethics_committee",
                "approved": True,
                "reviewer_comments": "伦理审核通过",
                "idempotent_key": "ethics-001",
                "current_version": 3
            }
        )
        assert review_response.status_code == 200
        assert review_response.json()["status"] == "pending_deidentification_review"
        assert review_response.json()["ethics_reviewer_name"] == "王伦理"

    def test_ethics_review_rejected(self):
        create_response = client.post(
            "/api/applications",
            json={
                "applicant_id": 1,
                "applicant_name": "张三",
                "project_name": "测试项目",
                "dataset_id": "DS001",
                "dataset_name": "测试数据集"
            }
        )
        app_id = create_response.json()["id"]
        
        client.put(
            f"/api/applications/{app_id}?operator_id=1",
            json={"ethics_approval_file_id": 1001}
        )
        
        client.post(
            f"/api/applications/{app_id}/submit",
            json={
                "operator_id": 1,
                "operator_name": "张三",
                "operator_role": "researcher",
                "idempotent_key": "submit-004",
                "current_version": 2
            }
        )
        
        review_response = client.post(
            f"/api/applications/{app_id}/ethics-review",
            json={
                "operator_id": 2,
                "operator_name": "王伦理",
                "operator_role": "ethics_committee",
                "approved": False,
                "reviewer_comments": "研究设计存在问题",
                "idempotent_key": "ethics-002",
                "current_version": 3
            }
        )
        assert review_response.status_code == 200
        assert review_response.json()["status"] == "rejected"

    def test_deidentification_review_passed(self):
        create_response = client.post(
            "/api/applications",
            json={
                "applicant_id": 1,
                "applicant_name": "张三",
                "project_name": "测试项目",
                "dataset_id": "DS001",
                "dataset_name": "测试数据集"
            }
        )
        app_id = create_response.json()["id"]
        
        client.put(
            f"/api/applications/{app_id}?operator_id=1",
            json={"ethics_approval_file_id": 1001}
        )
        
        client.post(
            f"/api/applications/{app_id}/submit",
            json={
                "operator_id": 1,
                "operator_name": "张三",
                "operator_role": "researcher",
                "idempotent_key": "submit-005",
                "current_version": 2
            }
        )
        
        client.post(
            f"/api/applications/{app_id}/ethics-review",
            json={
                "operator_id": 2,
                "operator_name": "王伦理",
                "operator_role": "ethics_committee",
                "approved": True,
                "idempotent_key": "ethics-003",
                "current_version": 3
            }
        )
        
        deid_response = client.post(
            f"/api/applications/{app_id}/deidentification-review",
            json={
                "operator_id": 3,
                "operator_name": "钱数据",
                "operator_role": "data_manager",
                "passed": True,
                "deidentification_report_id": 2001,
                "reviewer_comments": "脱敏处理符合规范",
                "idempotent_key": "deid-001",
                "current_version": 4
            }
        )
        assert deid_response.status_code == 200
        assert deid_response.json()["status"] == "available_for_download"
        assert deid_response.json()["deidentification_passed"] == 1

    def test_revoke_application(self):
        create_response = client.post(
            "/api/applications",
            json={
                "applicant_id": 1,
                "applicant_name": "张三",
                "project_name": "测试项目",
                "dataset_id": "DS001",
                "dataset_name": "测试数据集"
            }
        )
        app_id = create_response.json()["id"]
        
        revoke_response = client.post(
            f"/api/applications/{app_id}/revoke",
            json={
                "operator_id": 1,
                "operator_name": "张三",
                "operator_role": "researcher",
                "reason": "项目终止",
                "idempotent_key": "revoke-001",
                "current_version": 1
            }
        )
        assert revoke_response.status_code == 200
        assert revoke_response.json()["status"] == "revoked"


class TestIdempotency:
    def test_same_idempotent_key_twice(self):
        create_response = client.post(
            "/api/applications",
            json={
                "applicant_id": 1,
                "applicant_name": "张三",
                "project_name": "测试项目",
                "dataset_id": "DS001",
                "dataset_name": "测试数据集"
            }
        )
        app_id = create_response.json()["id"]
        
        client.put(
            f"/api/applications/{app_id}?operator_id=1",
            json={"ethics_approval_file_id": 1001}
        )
        
        response1 = client.post(
            f"/api/applications/{app_id}/revoke",
            json={
                "operator_id": 1,
                "operator_name": "张三",
                "operator_role": "researcher",
                "reason": "测试撤销",
                "idempotent_key": "revoke-idemp-001",
                "current_version": 2
            }
        )
        
        response2 = client.post(
            f"/api/applications/{app_id}/revoke",
            json={
                "operator_id": 1,
                "operator_name": "张三",
                "operator_role": "researcher",
                "reason": "测试撤销",
                "idempotent_key": "revoke-idemp-001",
                "current_version": 2
            }
        )
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        assert response1.json()["version"] == response2.json()["version"]


class TestPermissions:
    def test_researcher_cannot_do_ethics_review(self):
        create_response = client.post(
            "/api/applications",
            json={
                "applicant_id": 1,
                "applicant_name": "张三",
                "project_name": "测试项目",
                "dataset_id": "DS001",
                "dataset_name": "测试数据集"
            }
        )
        app_id = create_response.json()["id"]
        
        client.put(
            f"/api/applications/{app_id}?operator_id=1",
            json={"ethics_approval_file_id": 1001}
        )
        
        client.post(
            f"/api/applications/{app_id}/submit",
            json={
                "operator_id": 1,
                "operator_name": "张三",
                "operator_role": "researcher",
                "idempotent_key": "submit-perm-001",
                "current_version": 2
            }
        )
        
        review_response = client.post(
            f"/api/applications/{app_id}/ethics-review",
            json={
                "operator_id": 1,
                "operator_name": "张三",
                "operator_role": "researcher",
                "approved": True,
                "idempotent_key": "ethics-perm-001",
                "current_version": 3
            }
        )
        assert review_response.status_code == 403
        assert review_response.json()["error_code"] == "PERMISSION_DENIED"


class TestAuditLog:
    def test_audit_log_created(self):
        create_response = client.post(
            "/api/applications",
            json={
                "applicant_id": 1,
                "applicant_name": "张三",
                "project_name": "测试项目",
                "dataset_id": "DS001",
                "dataset_name": "测试数据集"
            }
        )
        app_id = create_response.json()["id"]
        
        logs_response = client.get(f"/api/applications/{app_id}/audit-logs")
        assert logs_response.status_code == 200
        logs = logs_response.json()
        assert len(logs) > 0
        assert logs[0]["action"] == "CREATE_APPLICATION"
