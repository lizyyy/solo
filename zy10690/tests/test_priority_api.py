import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestNormalFlow:
    def test_health_check(self):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_create_priority_request(self):
        request_data = {
            "model_name": "test-model",
            "tenant_id": "test-tenant",
            "queue_name": "test-queue",
            "original_priority": 5,
            "target_priority": 3,
            "reason": "测试正常提权",
            "applicant": "tester",
            "restore_hours": 4
        }
        response = client.post("/api/v1/priority", json=request_data)
        assert response.status_code == 200
        data = response.json()
        assert data["model_name"] == "test-model"
        assert data["status"] == "pending"
        return data["id"]

    def test_list_priority_requests(self):
        response = client.get("/api/v1/priority")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_review_priority_request(self):
        request_id = self.test_create_priority_request()
        review_data = {
            "reviewer": "admin",
            "approved": True,
            "comment": "同意提权"
        }
        response = client.post(f"/api/v1/priority/{request_id}/review", json=review_data)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        assert data["reviewer"] == "admin"

    def test_apply_priority(self):
        request_id = self.test_create_priority_request()
        review_data = {"reviewer": "admin", "approved": True, "comment": "同意"}
        client.post(f"/api/v1/priority/{request_id}/review", json=review_data)
        
        response = client.post(f"/api/v1/priority/{request_id}/apply")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"

    def test_restore_priority(self):
        request_id = self.test_create_priority_request()
        review_data = {"reviewer": "admin", "approved": True, "comment": "同意"}
        client.post(f"/api/v1/priority/{request_id}/review", json=review_data)
        client.post(f"/api/v1/priority/{request_id}/apply")
        
        restore_data = {"restorer": "tester", "reason": "测试完成，恢复优先级"}
        response = client.post(f"/api/v1/priority/{request_id}/restore", json=restore_data)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "restored"

    def test_get_history(self):
        request_id = self.test_create_priority_request()
        response = client.get(f"/api/v1/priority/{request_id}/history")
        assert response.status_code == 200
        data = response.json()
        assert "history" in data
        assert len(data["history"]) > 0

    def test_get_report(self):
        response = client.get("/api/v1/report/priority")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestAbnormalFlow:
    def test_invalid_priority_values(self):
        request_data = {
            "model_name": "test-model",
            "tenant_id": "test-tenant",
            "queue_name": "test-queue",
            "original_priority": 11,
            "target_priority": 0,
            "reason": "测试非法优先级",
            "applicant": "tester",
            "restore_hours": 4
        }
        response = client.post("/api/v1/priority", json=request_data)
        assert response.status_code == 422

    def test_review_non_existent_record(self):
        review_data = {"reviewer": "admin", "approved": True, "comment": "同意"}
        response = client.post("/api/v1/priority/nonexistent/review", json=review_data)
        assert response.status_code == 404

    def test_apply_without_review(self):
        request_data = {
            "model_name": "test-model",
            "tenant_id": "test-tenant",
            "queue_name": "test-queue",
            "original_priority": 5,
            "target_priority": 3,
            "reason": "测试",
            "applicant": "tester",
            "restore_hours": 4
        }
        create_response = client.post("/api/v1/priority", json=request_data)
        request_id = create_response.json()["id"]
        
        response = client.post(f"/api/v1/priority/{request_id}/apply")
        assert response.status_code == 400

    def test_high_risk_priority_blocked(self):
        request_data = {
            "model_name": "test-model",
            "tenant_id": "test-tenant",
            "queue_name": "test-queue",
            "original_priority": 9,
            "target_priority": 1,
            "reason": "大幅提权测试",
            "applicant": "tester",
            "restore_hours": 4
        }
        create_response = client.post("/api/v1/priority", json=request_data)
        request_id = create_response.json()["id"]
        
        review_data = {"reviewer": "admin", "approved": True, "comment": "同意"}
        client.post(f"/api/v1/priority/{request_id}/review", json=review_data)
        
        response = client.post(f"/api/v1/priority/{request_id}/apply")
        assert response.status_code == 403
        assert "高风险" in response.json()["detail"]

    def test_risk_check_endpoint(self):
        request_data = {
            "model_name": "test-model",
            "tenant_id": "test-tenant",
            "queue_name": "test-queue",
            "original_priority": 9,
            "target_priority": 1,
            "reason": "高风险提权",
            "applicant": "tester",
            "restore_hours": 4
        }
        create_response = client.post("/api/v1/priority", json=request_data)
        request_id = create_response.json()["id"]
        
        response = client.get(f"/api/v1/priority/{request_id}/risk")
        assert response.status_code == 200
        risk_data = response.json()
        assert risk_data["risk_level"] == "high"
        assert risk_data["needs_review"] == True


class TestDuplicateOperations:
    def test_duplicate_review(self):
        request_data = {
            "model_name": "test-model",
            "tenant_id": "test-tenant",
            "queue_name": "test-queue",
            "original_priority": 5,
            "target_priority": 4,
            "reason": "测试重复审批",
            "applicant": "tester",
            "restore_hours": 4
        }
        create_response = client.post("/api/v1/priority", json=request_data)
        request_id = create_response.json()["id"]
        
        review_data = {"reviewer": "admin", "approved": True, "comment": "第一次审批"}
        first_response = client.post(f"/api/v1/priority/{request_id}/review", json=review_data)
        assert first_response.status_code == 200
        
        second_response = client.post(f"/api/v1/priority/{request_id}/review", json=review_data)
        assert second_response.status_code == 400

    def test_duplicate_apply(self):
        request_data = {
            "model_name": "test-model",
            "tenant_id": "test-tenant",
            "queue_name": "test-queue",
            "original_priority": 5,
            "target_priority": 4,
            "reason": "测试重复生效",
            "applicant": "tester",
            "restore_hours": 4
        }
        create_response = client.post("/api/v1/priority", json=request_data)
        request_id = create_response.json()["id"]
        
        review_data = {"reviewer": "admin", "approved": True, "comment": "同意"}
        client.post(f"/api/v1/priority/{request_id}/review", json=review_data)
        
        first_response = client.post(f"/api/v1/priority/{request_id}/apply")
        assert first_response.status_code == 200
        
        second_response = client.post(f"/api/v1/priority/{request_id}/apply")
        assert second_response.status_code == 400

    def test_restore_non_active_record(self):
        request_data = {
            "model_name": "test-model",
            "tenant_id": "test-tenant",
            "queue_name": "test-queue",
            "original_priority": 5,
            "target_priority": 4,
            "reason": "测试恢复未生效记录",
            "applicant": "tester",
            "restore_hours": 4
        }
        create_response = client.post("/api/v1/priority", json=request_data)
        request_id = create_response.json()["id"]
        
        restore_data = {"restorer": "tester", "reason": "测试恢复"}
        response = client.post(f"/api/v1/priority/{request_id}/restore", json=restore_data)
        assert response.status_code == 400


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
