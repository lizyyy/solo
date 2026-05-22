import pytest
from app.config import settings
from app.models import BatchStatus


class TestIdempotency:
    def test_create_duplicate_batch_no_fails(self, client, operator_auth_headers):
        client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "IDEMP001", "transport_order_no": "TO001"},
            headers=operator_auth_headers
        )

        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "IDEMP001", "transport_order_no": "TO002"},
            headers=operator_auth_headers
        )
        assert response.status_code == 400

    def test_same_status_transition_is_idempotent(self, client, operator_auth_headers, reviewer_auth_headers):
        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "IDEMP002", "transport_order_no": "TO002"},
            headers=operator_auth_headers
        )
        batch_id = response.json()["id"]

        response1 = client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/status",
            json={"target_status": BatchStatus.ATTACHMENTS_UPLOADED, "reason": "附件上传完成"},
            headers=reviewer_auth_headers
        )
        assert response1.status_code == 200
        initial_updated_at = response1.json()["updated_at"]

        response2 = client.post(
            f"{settings.API_V1_STR}/batches/{batch_id}/status",
            json={"target_status": BatchStatus.ATTACHMENTS_UPLOADED, "reason": "附件上传完成"},
            headers=reviewer_auth_headers
        )
        assert response2.status_code == 400

    def test_get_batch_idempotent(self, client, operator_auth_headers):
        create_response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "IDEMP003", "transport_order_no": "TO003"},
            headers=operator_auth_headers
        )
        batch_id = create_response.json()["id"]

        response1 = client.get(
            f"{settings.API_V1_STR}/batches/{batch_id}",
            headers=operator_auth_headers
        )
        response2 = client.get(
            f"{settings.API_V1_STR}/batches/{batch_id}",
            headers=operator_auth_headers
        )

        assert response1.json()["id"] == response2.json()["id"]
        assert response1.json()["batch_no"] == response2.json()["batch_no"]
        assert response1.json()["current_status"] == response2.json()["current_status"]

    def test_list_batches_pagination_idempotent(self, client, operator_auth_headers):
        for i in range(5):
            client.post(
                f"{settings.API_V1_STR}/batches/",
                json={"batch_no": f"IDEMP00{i+4}", "transport_order_no": f"TO00{i+4}"},
                headers=operator_auth_headers
            )

        response1 = client.get(
            f"{settings.API_V1_STR}/batches/?page=1&page_size=2",
            headers=operator_auth_headers
        )
        response2 = client.get(
            f"{settings.API_V1_STR}/batches/?page=1&page_size=2",
            headers=operator_auth_headers
        )

        assert response1.json()["total"] == response2.json()["total"]
        assert len(response1.json()["batches"]) == len(response2.json()["batches"])

    def test_multiple_resolve_same_dirty_record(self, client, operator_auth_headers, reviewer_auth_headers):
        response = client.post(
            f"{settings.API_V1_STR}/batches/",
            json={"batch_no": "IDEMP009"},
            headers=operator_auth_headers
        )
        batch_id = response.json()["id"]

        dirty_records = client.get(
            f"{settings.API_V1_STR}/batches/{batch_id}/dirty-records",
            headers=operator_auth_headers
        ).json()

        if dirty_records:
            record_id = dirty_records[0]["id"]

            resolve1 = client.post(
                f"{settings.API_V1_STR}/batches/{batch_id}/dirty-records/{record_id}/resolve",
                json={"resolution_note": "已补充信息"},
                headers=reviewer_auth_headers
            )
            assert resolve1.json()["is_resolved"] == True

            resolve2 = client.post(
                f"{settings.API_V1_STR}/batches/{batch_id}/dirty-records/{record_id}/resolve",
                json={"resolution_note": "再次确认"},
                headers=reviewer_auth_headers
            )
            assert resolve2.json()["is_resolved"] == True
