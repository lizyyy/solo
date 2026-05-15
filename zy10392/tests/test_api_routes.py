import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.base import (
    BatchPhase,
    ObservationMetric,
    NotificationType,
    NotificationChannel,
)
from app.models.schemas import CreateBatchRequest


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def valid_batch_data():
    return {
        "name": "Test Batch",
        "description": "Test Description",
        "phases": [
            {
                "phase_number": 1,
                "interface_ids": ["api-1", "api-2"],
                "customer_group_ids": ["group-1"],
            }
        ],
        "metrics": [
            {
                "id": "metric-1",
                "name": "Error Rate",
                "threshold": 100.0,
            }
        ],
        "created_by": "test-user",
    }


class TestErrorResponses:
    def test_start_nonexistent_batch_returns_404(self, client: TestClient):
        response = client.post(
            "/api/v1/batches/non-existent-id/start",
            json={"advanced_by": "test-user"},
        )
        assert response.status_code == 404
        data = response.json()
        assert "error_code" in data["detail"]
        assert "message" in data["detail"]

    def test_validate_nonexistent_batch_returns_404(self, client: TestClient):
        response = client.post(
            "/api/v1/batches/non-existent-id/validate",
            json={"validated_by": "test-user"},
        )
        assert response.status_code == 404

    def test_draft_batch_direct_start_returns_400(self, client: TestClient, valid_batch_data):
        response = client.post("/api/v1/batches", json=valid_batch_data)
        assert response.status_code == 201
        batch_id = response.json()["data"]["id"]

        response = client.post(
            f"/api/v1/batches/{batch_id}/start",
            json={"advanced_by": "test-user"},
        )
        assert response.status_code == 400
        data = response.json()
        assert "error_code" in data["detail"]
        assert "draft" in data["detail"]["message"].lower()

    def test_get_nonexistent_batch_returns_404(self, client: TestClient):
        response = client.get("/api/v1/batches/non-existent-id")
        assert response.status_code == 404

    def test_complete_nonexistent_batch_returns_404(self, client: TestClient):
        response = client.post(
            "/api/v1/batches/non-existent-id/complete",
            json={
                "conclusion_type": "success",
                "summary": "test",
                "archived_by": "test-user",
            },
        )
        assert response.status_code == 404

    def test_cancel_nonexistent_batch_returns_404(self, client: TestClient):
        response = client.post(
            "/api/v1/batches/non-existent-id/cancel",
            params={"cancelled_by": "test-user"},
        )
        assert response.status_code == 404

    def test_get_nonexistent_history_returns_404(self, client: TestClient):
        response = client.get("/api/v1/batches/non-existent-id/history")
        assert response.status_code == 404


class TestBatchLifecycle:
    def test_full_batch_lifecycle(self, client: TestClient, valid_batch_data):
        response = client.post("/api/v1/batches", json=valid_batch_data)
        assert response.status_code == 201
        batch_id = response.json()["data"]["id"]

        response = client.post(
            f"/api/v1/batches/{batch_id}/validate",
            json={"validated_by": "test-user"},
        )
        assert response.status_code == 200

        response = client.post(
            f"/api/v1/batches/{batch_id}/start",
            json={"advanced_by": "test-user"},
        )
        assert response.status_code == 200

        response = client.post(
            f"/api/v1/batches/{batch_id}/observe",
            json={"advanced_by": "test-user"},
        )
        assert response.status_code == 200

    def test_list_batches(self, client: TestClient, valid_batch_data):
        client.post("/api/v1/batches", json=valid_batch_data)
        client.post("/api/v1/batches", json=valid_batch_data)

        response = client.get("/api/v1/batches")
        assert response.status_code == 200
        data = response.json()
        assert "batches" in data
        assert data["total"] >= 2

    def test_get_batch(self, client: TestClient, valid_batch_data):
        response = client.post("/api/v1/batches", json=valid_batch_data)
        batch_id = response.json()["data"]["id"]

        response = client.get(f"/api/v1/batches/{batch_id}")
        assert response.status_code == 200
        assert response.json()["data"]["id"] == batch_id

    def test_batch_history(self, client: TestClient, valid_batch_data):
        response = client.post("/api/v1/batches", json=valid_batch_data)
        batch_id = response.json()["data"]["id"]

        client.post(
            f"/api/v1/batches/{batch_id}/validate",
            json={"validated_by": "test-user"},
        )

        response = client.get(f"/api/v1/batches/{batch_id}/history")
        assert response.status_code == 200
        data = response.json()
        assert data["batch_id"] == batch_id
        assert len(data["history"]) >= 2


class TestNotificationEndpoints:
    def test_create_notification(self, client: TestClient, valid_batch_data):
        response = client.post("/api/v1/batches", json=valid_batch_data)
        batch_id = response.json()["data"]["id"]

        notification_data = {
            "phase_id": 1,
            "customer_group_id": "group-1",
            "notification_type": "phase_start",
            "channel": "email",
            "subject": "Test Subject",
            "content": "Test Content",
        }
        response = client.post(
            f"/api/v1/batches/{batch_id}/notifications",
            json=notification_data,
        )
        assert response.status_code == 201
        assert response.json()["data"]["subject"] == "Test Subject"

    def test_list_notifications(self, client: TestClient, valid_batch_data):
        response = client.post("/api/v1/batches", json=valid_batch_data)
        batch_id = response.json()["data"]["id"]

        notification_data = {
            "phase_id": 1,
            "customer_group_id": "group-1",
            "notification_type": "phase_start",
            "channel": "email",
            "subject": "Test Subject",
            "content": "Test Content",
        }
        client.post(
            f"/api/v1/batches/{batch_id}/notifications",
            json=notification_data,
        )

        response = client.get(f"/api/v1/batches/{batch_id}/notifications")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

    def test_auto_create_notification(self, client: TestClient, valid_batch_data):
        response = client.post("/api/v1/batches", json=valid_batch_data)
        batch_id = response.json()["data"]["id"]

        response = client.post(
            f"/api/v1/batches/{batch_id}/phases/1/auto-notify",
            params={"notification_type": "phase_start"},
        )
        assert response.status_code == 200

    def test_update_notification_status(self, client: TestClient, valid_batch_data):
        response = client.post("/api/v1/batches", json=valid_batch_data)
        batch_id = response.json()["data"]["id"]

        notification_data = {
            "phase_id": 1,
            "customer_group_id": "group-1",
            "notification_type": "phase_start",
            "channel": "email",
            "subject": "Test Subject",
            "content": "Test Content",
        }
        response = client.post(
            f"/api/v1/batches/{batch_id}/notifications",
            json=notification_data,
        )
        notification_id = response.json()["data"]["id"]

        update_data = {
            "status": "sent",
            "updated_by": "test-user",
        }
        response = client.put(
            f"/api/v1/batches/{batch_id}/notifications/{notification_id}/status",
            json=update_data,
        )
        assert response.status_code == 200
        assert response.json()["data"]["status"] == "sent"

    def test_create_notification_nonexistent_batch_returns_404(self, client: TestClient):
        notification_data = {
            "phase_id": 1,
            "customer_group_id": "group-1",
            "notification_type": "phase_start",
            "channel": "email",
            "subject": "Test",
            "content": "Test",
        }
        response = client.post(
            "/api/v1/batches/non-existent-id/notifications",
            json=notification_data,
        )
        assert response.status_code == 404

    def test_get_nonexistent_notification_returns_404(self, client: TestClient, valid_batch_data):
        response = client.post("/api/v1/batches", json=valid_batch_data)
        batch_id = response.json()["data"]["id"]

        response = client.get(
            f"/api/v1/batches/{batch_id}/notifications/non-existent-id",
        )
        assert response.status_code == 404


class TestIdempotency:
    def test_create_batch_with_same_idempotency_key(self, client: TestClient, valid_batch_data):
        key = "test-idempotency-key-123"
        
        response1 = client.post(
            "/api/v1/batches",
            json=valid_batch_data,
            headers={"x-idempotency-key": key},
        )
        assert response1.status_code == 201
        batch_id1 = response1.json()["data"]["id"]

        response2 = client.post(
            "/api/v1/batches",
            json=valid_batch_data,
            headers={"x-idempotency-key": key},
        )
        assert response2.status_code == 201
        batch_id2 = response2.json()["data"]["id"]

        assert batch_id1 == batch_id2


class TestMetricEndpoints:
    def test_update_metric(self, client: TestClient, valid_batch_data):
        response = client.post("/api/v1/batches", json=valid_batch_data)
        batch_id = response.json()["data"]["id"]

        response = client.post(
            f"/api/v1/batches/{batch_id}/validate",
            json={"validated_by": "test-user"},
        )

        response = client.put(
            f"/api/v1/batches/{batch_id}/metrics/metric-1",
            json={"current_value": 50.0},
        )
        assert response.status_code == 200
        assert response.json()["data"]["metrics"][0]["current_value"] == 50.0

    def test_update_nonexistent_metric_returns_404(self, client: TestClient, valid_batch_data):
        response = client.post("/api/v1/batches", json=valid_batch_data)
        batch_id = response.json()["data"]["id"]

        response = client.put(
            f"/api/v1/batches/{batch_id}/metrics/non-existent-metric",
            json={"current_value": 50.0},
        )
        assert response.status_code == 404


class TestRestoreRequestEndpoints:
    def test_create_and_approve_restore_request(self, client: TestClient, valid_batch_data):
        response = client.post("/api/v1/batches", json=valid_batch_data)
        batch_id = response.json()["data"]["id"]

        client.post(
            f"/api/v1/batches/{batch_id}/validate",
            json={"validated_by": "test-user"},
        )
        client.post(
            f"/api/v1/batches/{batch_id}/start",
            json={"advanced_by": "test-user"},
        )
        client.post(
            f"/api/v1/batches/{batch_id}/observe",
            json={"advanced_by": "test-user"},
        )

        restore_data = {
            "interface_ids": ["api-1"],
            "reason": "Emergency restore",
            "requester": "test-user",
        }
        response = client.post(
            f"/api/v1/batches/{batch_id}/restore-requests",
            json=restore_data,
        )
        assert response.status_code == 200
        restore_id = response.json()["data"]["id"]

        response = client.post(
            f"/api/v1/batches/{batch_id}/restore-requests/{restore_id}/approve",
            json={"approver": "manager"},
        )
        assert response.status_code == 200
