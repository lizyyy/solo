import pytest
from app.config import settings
from app.models import BatchStatus


class TestStateMachineTransitions:
    def test_create_batch_initial_status(self, client, operator_auth_headers):
        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "TEST001", "transport_order_no": "TO001"},
            headers=operator_auth_headers
        )
        assert response.status_code == 200
        assert response.json()["current_status"] == BatchStatus.CREATED

    def test_valid_transition_created_to_attachments_uploaded(self, client, operator_auth_headers, reviewer_auth_headers):
        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "TEST002", "transport_order_no": "TO002"},
            headers=operator_auth_headers
        )
        batch_id = response.json()["id"]

        response = client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/status",
            json={"target_status": BatchStatus.ATTACHMENTS_UPLOADED, "reason": "附件上传完成"},
            headers=reviewer_auth_headers
        )
        assert response.status_code == 200
        assert response.json()["current_status"] == BatchStatus.ATTACHMENTS_UPLOADED

    def test_valid_transition_attachments_to_under_review(self, client, operator_auth_headers, reviewer_auth_headers):
        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "TEST003", "transport_order_no": "TO003"},
            headers=operator_auth_headers
        )
        batch_id = response.json()["id"]

        client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/status",
            json={"target_status": BatchStatus.ATTACHMENTS_UPLOADED, "reason": "附件上传完成"},
            headers=reviewer_auth_headers
        )

        response = client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/status",
            json={"target_status": BatchStatus.UNDER_REVIEW, "reason": "开始复核"},
            headers=reviewer_auth_headers
        )
        assert response.status_code == 200
        assert response.json()["current_status"] == BatchStatus.UNDER_REVIEW

    def test_valid_transition_under_review_to_reviewed(self, client, operator_auth_headers, reviewer_auth_headers):
        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "TEST004", "transport_order_no": "TO004"},
            headers=operator_auth_headers
        )
        batch_id = response.json()["id"]

        client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/status",
            json={"target_status": BatchStatus.ATTACHMENTS_UPLOADED, "reason": "附件上传完成"},
            headers=reviewer_auth_headers
        )
        client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/status",
            json={"target_status": BatchStatus.UNDER_REVIEW, "reason": "开始复核"},
            headers=reviewer_auth_headers
        )

        response = client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/status",
            json={"target_status": BatchStatus.REVIEWED, "reason": "复核通过"},
            headers=reviewer_auth_headers
        )
        assert response.status_code == 200
        assert response.json()["current_status"] == BatchStatus.REVIEWED

    def test_invalid_transition_created_to_reviewed(self, client, operator_auth_headers, reviewer_auth_headers):
        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "TEST005", "transport_order_no": "TO005"},
            headers=operator_auth_headers
        )
        batch_id = response.json()["id"]

        response = client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/status",
            json={"target_status": BatchStatus.REVIEWED, "reason": "跳过状态"},
            headers=reviewer_auth_headers
        )
        assert response.status_code == 400

    def test_freeze_and_revert_status(self, client, operator_auth_headers, reviewer_auth_headers):
        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "TEST006", "transport_order_no": "TO006"},
            headers=operator_auth_headers
        )
        batch_id = response.json()["id"]

        client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/status",
            json={"target_status": BatchStatus.ATTACHMENTS_UPLOADED, "reason": "附件上传完成"},
            headers=reviewer_auth_headers
        )

        freeze_response = client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/status",
            json={"target_status": BatchStatus.FROZEN, "reason": "数据异常，冻结结算"},
            headers=reviewer_auth_headers
        )
        assert freeze_response.status_code == 200
        assert freeze_response.json()["current_status"] == BatchStatus.FROZEN
        assert freeze_response.json()["status_before_frozen"] == BatchStatus.ATTACHMENTS_UPLOADED

        revert_response = client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/status",
            json={"target_status": BatchStatus.REVERTED, "reason": "异常已处理，恢复流程"},
            headers=reviewer_auth_headers
        )
        assert revert_response.status_code == 200
        assert revert_response.json()["current_status"] == BatchStatus.ATTACHMENTS_UPLOADED
        assert revert_response.json()["status_before_frozen"] is None

    def test_status_history_recorded(self, client, operator_auth_headers, reviewer_auth_headers):
        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "TEST007", "transport_order_no": "TO007"},
            headers=operator_auth_headers
        )
        batch_id = response.json()["id"]

        client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/status",
            json={"target_status": BatchStatus.ATTACHMENTS_UPLOADED, "reason": "附件上传完成"},
            headers=reviewer_auth_headers
        )

        response = client.get(
            f"{settings.API_V1_STR}/batches/{batch_id}",
            headers=operator_auth_headers
        )
        status_history = response.json()["status_history"]
        assert len(status_history) >= 2

        transitions = [(t["from_status"], t["to_status"]) for t in status_history]
        assert (None, BatchStatus.CREATED) in transitions
        assert (BatchStatus.CREATED, BatchStatus.ATTACHMENTS_UPLOADED) in transitions

    def test_get_valid_transitions(self, client, operator_auth_headers):
        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "TEST008", "transport_order_no": "TO008"},
            headers=operator_auth_headers
        )
        batch_id = response.json()["id"]

        response = client.get(
            f"{settings.API_V1_STR}/batches/{batch_id}/valid-transitions",
            headers=operator_auth_headers
        )
        assert response.status_code == 200
        valid_transitions = response.json()["valid_transitions"]
        assert BatchStatus.ATTACHMENTS_UPLOADED in valid_transitions
        assert BatchStatus.FROZEN in valid_transitions
