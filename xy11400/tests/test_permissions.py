import pytest
from app.config import settings


class TestPermissions:
    def test_unauthenticated_access_denied(self, client):
        response = client.get(f"{settings.API_V1_STR}/batches/")
        assert response.status_code == 401

    def test_viewer_can_read_but_not_create(self, client, viewer_auth_headers):
        response = client.get(
            f"{settings.API_V1_STR}/batches/",
            headers=viewer_auth_headers
        )
        assert response.status_code == 200

        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "PERM001", "transport_order_no": "TO001"},
            headers=viewer_auth_headers
        )
        assert response.status_code == 403

    def test_operator_can_create_but_not_change_status(self, client, operator_auth_headers):
        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "PERM002", "transport_order_no": "TO002"},
            headers=operator_auth_headers
        )
        assert response.status_code == 200
        batch_id = response.json()["id"]

        response = client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/status",
            json={"target_status": "attachments_uploaded", "reason": "测试"},
            headers=operator_auth_headers
        )
        assert response.status_code == 403

    def test_reviewer_can_change_status(self, client, operator_auth_headers, reviewer_auth_headers):
        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "PERM003", "transport_order_no": "TO003"},
            headers=operator_auth_headers
        )
        batch_id = response.json()["id"]

        response = client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/status",
            json={"target_status": "attachments_uploaded", "reason": "附件上传完成"},
            headers=reviewer_auth_headers
        )
        assert response.status_code == 200

    def test_only_supervisor_can_add_notes(self, client, operator_auth_headers, reviewer_auth_headers, auth_headers):
        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "PERM004", "transport_order_no": "TO004"},
            headers=operator_auth_headers
        )
        batch_id = response.json()["id"]

        response = client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/notes",
            json={"content": "主管批注", "is_approval": True},
            headers=operator_auth_headers
        )
        assert response.status_code == 403

        response = client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/notes",
            json={"content": "主管批注", "is_approval": True},
            headers=reviewer_auth_headers
        )
        assert response.status_code == 403

        response = client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/notes",
            json={"content": "主管批注", "is_approval": True},
            headers=auth_headers
        )
        assert response.status_code == 200

    def test_only_supervisor_can_export_summary(self, client, viewer_auth_headers, auth_headers):
        response = client.get(
            f"{settings.API_V1_STR}/exports/summary?format=json",
            headers=viewer_auth_headers
        )
        assert response.status_code == 403

        response = client.get(
            f"{settings.API_V1_STR}/exports/summary?format=json",
            headers=auth_headers
        )
        assert response.status_code == 200
