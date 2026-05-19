import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, get_db
import models


@pytest.fixture(scope="function")
def db_session():
    db_file = f"./test_{os.getpid()}.db"
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_file}"
    
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)
    
    if os.path.exists(db_file):
        os.remove(db_file)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    from main import app
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    del app.dependency_overrides[get_db]


class TestFailureCase:
    def test_create_failure_case(self, client):
        response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/page",
                "browser_matrix": {"chrome": "<90", "ie": "11"},
                "failure_cases": [
                    {"case_id": "TEST-001", "description": "测试失败", "browser": "ie", "browser_version": "11"}
                ],
                "reporter": "qa001"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["page_path"] == "/test/page"
        assert data["conclusion"] == "pending"
        assert data["exemption_status"] == "none"
    
    def test_list_failure_cases(self, client):
        for i in range(3):
            client.post(
                "/api/v1/failures",
                json={
                    "page_path": f"/test/page{i}",
                    "browser_matrix": {"chrome": "<90"},
                    "failure_cases": [{"case_id": f"TEST-{i:03d}", "description": "测试失败"}],
                    "reporter": "qa001"
                }
            )
        
        response = client.get("/api/v1/failures")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3
    
    def test_get_failure_case(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/single",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001", "description": "测试失败"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        get_response = client.get(f"/api/v1/failures/{failure_id}")
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["page_path"] == "/test/single"
    
    def test_get_nonexistent_failure_case(self, client):
        response = client.get("/api/v1/failures/99999")
        assert response.status_code == 404
    
    def test_update_conclusion(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/conclusion",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        update_response = client.put(
            f"/api/v1/failures/{failure_id}/conclusion",
            json={
                "conclusion": "fixed",
                "conclusion_note": "已修复",
                "operator": "dev001"
            }
        )
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["conclusion"] == "fixed"
        assert data["conclusion_note"] == "已修复"


class TestExemption:
    def test_create_exemption(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/exemption",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试豁免",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        assert exemption_response.status_code == 200
        data = exemption_response.json()
        assert data["status"] == "pending"
        assert data["is_expired"] == False
    
    def test_create_exemption_for_nonexistent_failure(self, client):
        response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": 99999,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        assert response.status_code == 404
    
    def test_review_exemption_approved(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/review",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = exemption_response.json()["id"]
        
        review_response = client.put(
            f"/api/v1/exemptions/{exemption_id}/review",
            json={
                "review_result": "approved",
                "review_comment": "同意",
                "reviewer": "leader001"
            }
        )
        assert review_response.status_code == 200
        data = review_response.json()
        assert data["status"] == "approved"
        
        failure_check = client.get(f"/api/v1/failures/{failure_id}")
        assert failure_check.json()["conclusion"] == "exempted"
    
    def test_review_exemption_rejected(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/reject",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = exemption_response.json()["id"]
        
        review_response = client.put(
            f"/api/v1/exemptions/{exemption_id}/review",
            json={
                "review_result": "rejected",
                "review_comment": "驳回",
                "reviewer": "leader001"
            }
        )
        assert review_response.status_code == 200
        assert review_response.json()["status"] == "rejected"
        
        failure_check = client.get(f"/api/v1/failures/{failure_id}")
        assert failure_check.json()["conclusion"] == "pending"
    
    def test_withdraw_exemption(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/withdraw",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = exemption_response.json()["id"]
        
        withdraw_response = client.delete(
            f"/api/v1/exemptions/{exemption_id}?operator=dev001"
        )
        assert withdraw_response.status_code == 200
        assert withdraw_response.json()["status"] == "withdrawn"
    
    def test_list_exemptions(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/list",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        for i in range(2):
            client.post(
                "/api/v1/exemptions",
                json={
                    "failure_id": failure_id,
                    "exemption_reason": f"测试{i}",
                    "exempt_browsers": ["ie"],
                    "expire_days": 30,
                    "applicant": "dev001"
                }
            )
        
        response = client.get("/api/v1/exemptions")
        assert response.status_code == 200
        assert len(response.json()) >= 2


class TestConflictPaths:
    def test_duplicate_exemption_creation(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/duplicate",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "第一个",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        
        first_exemption = client.get(f"/api/v1/exemptions?failure_id={failure_id}").json()[0]
        
        client.put(
            f"/api/v1/exemptions/{first_exemption['id']}/review",
            json={
                "review_result": "approved",
                "review_comment": "同意",
                "reviewer": "leader001"
            }
        )
        
        duplicate_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "第二个",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        assert duplicate_response.status_code == 409
    
    def test_double_review_exemption(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/double",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = exemption_response.json()["id"]
        
        client.put(
            f"/api/v1/exemptions/{exemption_id}/review",
            json={
                "review_result": "approved",
                "review_comment": "同意",
                "reviewer": "leader001"
            }
        )
        
        second_review = client.put(
            f"/api/v1/exemptions/{exemption_id}/review",
            json={
                "review_result": "rejected",
                "review_comment": "驳回",
                "reviewer": "leader002"
            }
        )
        assert second_review.status_code == 409
    
    def test_double_withdraw_exemption(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/double_withdraw",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = exemption_response.json()["id"]
        
        client.delete(f"/api/v1/exemptions/{exemption_id}?operator=dev001")
        
        second_withdraw = client.delete(f"/api/v1/exemptions/{exemption_id}?operator=dev001")
        assert second_withdraw.status_code == 409


class TestStateValidation:
    def test_invalid_review_result_rejected(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/invalid_review",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = exemption_response.json()["id"]
        
        invalid_review = client.put(
            f"/api/v1/exemptions/{exemption_id}/review",
            json={
                "review_result": "nonsense",
                "review_comment": "无效审核",
                "reviewer": "leader001"
            }
        )
        assert invalid_review.status_code == 422
        assert "无效的审核结果" in invalid_review.json()["detail"][0]["msg"]
    
    def test_invalid_conclusion_rejected(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/invalid_conclusion",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        invalid_update = client.put(
            f"/api/v1/failures/{failure_id}/conclusion",
            json={
                "conclusion": "not_a_valid_conclusion",
                "conclusion_note": "无效结论",
                "operator": "dev001"
            }
        )
        assert invalid_update.status_code == 422
        assert "无效的结论" in invalid_update.json()["detail"][0]["msg"]
    
    def test_review_result_case_insensitive(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/case_insensitive",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = exemption_response.json()["id"]
        
        review_response = client.put(
            f"/api/v1/exemptions/{exemption_id}/review",
            json={
                "review_result": "APPROVED",
                "review_comment": "大写审核",
                "reviewer": "leader001"
            }
        )
        assert review_response.status_code == 200
        assert review_response.json()["status"] == "approved"
        assert review_response.json()["review_result"] == "approved"
    
    def test_conclusion_case_insensitive(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/conclusion_case",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        update_response = client.put(
            f"/api/v1/failures/{failure_id}/conclusion",
            json={
                "conclusion": "FIXED",
                "conclusion_note": "大写结论",
                "operator": "dev001"
            }
        )
        assert update_response.status_code == 200
        assert update_response.json()["conclusion"] == "fixed"
    
    def test_empty_review_result_rejected(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/empty_review",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = exemption_response.json()["id"]
        
        invalid_review = client.put(
            f"/api/v1/exemptions/{exemption_id}/review",
            json={
                "review_result": "",
                "review_comment": "空审核结果",
                "reviewer": "leader001"
            }
        )
        assert invalid_review.status_code == 422
    
    def test_state_consistency_after_failed_review(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/consistency",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = exemption_response.json()["id"]
        
        client.put(
            f"/api/v1/exemptions/{exemption_id}/review",
            json={
                "review_result": "invalid_status",
                "review_comment": "无效审核",
                "reviewer": "leader001"
            }
        )
        
        exemption_check = client.get(f"/api/v1/exemptions/{exemption_id}")
        assert exemption_check.json()["status"] == "pending"
        
        failure_check = client.get(f"/api/v1/failures/{failure_id}")
        assert failure_check.json()["conclusion"] == "pending"


class TestExceptionPathAuditLog:
    def test_duplicate_exemption_creation_audit_log(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/duplicate_audit",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        first_exemption = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "第一个申请",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        first_exemption_id = first_exemption.json()["id"]
        
        client.put(
            f"/api/v1/exemptions/{first_exemption_id}/review",
            json={
                "review_result": "approved",
                "review_comment": "同意",
                "reviewer": "leader001"
            }
        )
        
        logs_before = client.get("/api/v1/audit-logs").json()
        count_before = len([log for log in logs_before if log["operation_type"] == "create_failed"])
        
        duplicate_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "重复申请",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev002"
            }
        )
        assert duplicate_response.status_code == 409
        
        logs_after = client.get("/api/v1/audit-logs").json()
        failed_create_logs = [log for log in logs_after if log["operation_type"] == "create_failed"]
        
        assert len(failed_create_logs) == count_before + 1
        assert failed_create_logs[-1]["operator"] == "dev002"
        assert failed_create_logs[-1]["process_result"]["status"] == "conflict"
        assert "已有生效中的豁免" in failed_create_logs[-1]["process_result"]["error"]
        assert failed_create_logs[-1]["original_input"]["exemption_reason"] == "重复申请"
    
    def test_duplicate_review_audit_log(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/duplicate_review_audit",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = exemption_response.json()["id"]
        
        client.put(
            f"/api/v1/exemptions/{exemption_id}/review",
            json={
                "review_result": "approved",
                "review_comment": "第一次审核同意",
                "reviewer": "leader001"
            }
        )
        
        logs_before = client.get("/api/v1/audit-logs").json()
        count_before = len([log for log in logs_before if log["operation_type"] == "review_failed"])
        
        second_review = client.put(
            f"/api/v1/exemptions/{exemption_id}/review",
            json={
                "review_result": "approved",
                "review_comment": "重复审核",
                "reviewer": "leader002"
            }
        )
        assert second_review.status_code == 409
        
        logs_after = client.get("/api/v1/audit-logs").json()
        failed_review_logs = [log for log in logs_after if log["operation_type"] == "review_failed"]
        
        assert len(failed_review_logs) == count_before + 1
        assert failed_review_logs[-1]["operator"] == "leader002"
        assert failed_review_logs[-1]["process_result"]["status"] == "conflict"
        assert "豁免申请已处理" in failed_review_logs[-1]["process_result"]["error"]
        assert failed_review_logs[-1]["original_input"]["review_comment"] == "重复审核"
    
    def test_duplicate_withdraw_audit_log(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/duplicate_withdraw_audit",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = exemption_response.json()["id"]
        
        client.delete(f"/api/v1/exemptions/{exemption_id}?operator=dev001")
        
        logs_before = client.get("/api/v1/audit-logs").json()
        count_before = len([log for log in logs_before if log["operation_type"] == "withdraw_failed"])
        
        second_withdraw = client.delete(f"/api/v1/exemptions/{exemption_id}?operator=dev002")
        assert second_withdraw.status_code == 409
        
        logs_after = client.get("/api/v1/audit-logs").json()
        failed_withdraw_logs = [log for log in logs_after if log["operation_type"] == "withdraw_failed"]
        
        assert len(failed_withdraw_logs) == count_before + 1
        assert failed_withdraw_logs[-1]["operator"] == "dev002"
        assert failed_withdraw_logs[-1]["process_result"]["status"] == "conflict"
        assert "豁免已撤回" in failed_withdraw_logs[-1]["process_result"]["error"]
    
    def test_exception_path_audit_log_complete_tracking(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/complete_tracking",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        first_exemption = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "第一次",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = first_exemption.json()["id"]
        
        client.put(
            f"/api/v1/exemptions/{exemption_id}/review",
            json={
                "review_result": "approved",
                "review_comment": "同意",
                "reviewer": "leader001"
            }
        )
        
        for i in range(3):
            client.post(
                "/api/v1/exemptions",
                json={
                    "failure_id": failure_id,
                    "exemption_reason": f"重复申请{i}",
                    "exempt_browsers": ["ie"],
                    "expire_days": 30,
                    "applicant": f"dev{i+2:03d}"
                }
            )
        
        client.put(
            f"/api/v1/exemptions/{exemption_id}/review",
            json={
                "review_result": "rejected",
                "review_comment": "重复审核",
                "reviewer": "leader002"
            }
        )
        
        client.delete(f"/api/v1/exemptions/{exemption_id}?operator=dev003")
        
        client.delete(f"/api/v1/exemptions/{exemption_id}?operator=dev004")
        
        all_logs = client.get("/api/v1/audit-logs").json()
        
        create_failed_logs = [log for log in all_logs if log["operation_type"] == "create_failed"]
        review_failed_logs = [log for log in all_logs if log["operation_type"] == "review_failed"]
        withdraw_failed_logs = [log for log in all_logs if log["operation_type"] == "withdraw_failed"]
        
        assert len(create_failed_logs) == 3
        assert len(review_failed_logs) == 1
        assert len(withdraw_failed_logs) == 1
        
        for i, log in enumerate(create_failed_logs):
            assert log["operator"] == f"dev{i+2:03d}"
            assert log["process_result"]["status"] == "conflict"
        
        assert review_failed_logs[0]["operator"] == "leader002"
        assert withdraw_failed_logs[0]["operator"] == "dev004"


class TestBrowserMatrix:
    def test_validate_browser_matrix_compatible(self, client):
        response = client.post(
            "/api/v1/matrix/validate?browser=chrome&version=91",
            json={"chrome": "<90", "ie": "11"}
        )
        assert response.status_code == 200
        assert response.json()["is_compatible"] == False
    
    def test_validate_browser_matrix_incompatible(self, client):
        response = client.post(
            "/api/v1/matrix/validate?browser=ie&version=11",
            json={"chrome": "<90", "ie": "11"}
        )
        assert response.status_code == 200
        assert response.json()["is_compatible"] == True
    
    def test_validate_browser_not_in_matrix(self, client):
        response = client.post(
            "/api/v1/matrix/validate?browser=unknown&version=1",
            json={"chrome": "<90"}
        )
        assert response.status_code == 200
        assert response.json()["is_compatible"] == True


class TestAuditLog:
    def test_audit_log_created_on_failure_creation(self, client):
        client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/audit",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        
        log_response = client.get("/api/v1/audit-logs?resource_type=failure_case")
        assert log_response.status_code == 200
        logs = log_response.json()
        assert len(logs) >= 1
        assert logs[0]["operation_type"] == "create"
    
    def test_audit_log_created_on_conclusion_update(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/audit_conclusion",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        client.put(
            f"/api/v1/failures/{failure_id}/conclusion",
            json={
                "conclusion": "fixed",
                "conclusion_note": "已修复",
                "operator": "dev001"
            }
        )
        
        log_response = client.get("/api/v1/audit-logs")
        logs = log_response.json()
        assert any(log["operation_type"] == "update_conclusion" for log in logs)


class TestExport:
    def test_export_report(self, client):
        client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/export",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        
        response = client.get("/api/v1/export")
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers["content-type"]
