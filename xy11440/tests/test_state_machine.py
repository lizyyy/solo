import pytest


def create_test_batch(client, token, batch_no="TEST-001"):
    response = client.post(
        "/batches",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "batch_no": batch_no,
            "supplier_name": "测试供应商",
            "delivery_date": "2024-01-15T10:00:00"
        }
    )
    return response


class TestStateMachineTransitions:
    def test_draft_to_pending_review(self, client, entry_token):
        batch = create_test_batch(client, entry_token)
        assert batch.status_code == 200
        batch_id = batch.json()["id"]
        
        response = client.post(
            f"/batches/{batch_id}/submit",
            headers={"Authorization": f"Bearer {entry_token}"},
            json={"reason": "提交复核"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "pending_review"

    def test_pending_review_to_reviewed(self, client, entry_token, review_token):
        batch = create_test_batch(client, entry_token)
        batch_id = batch.json()["id"]
        
        client.post(
            f"/batches/{batch_id}/submit",
            headers={"Authorization": f"Bearer {entry_token}"},
            json={"reason": "提交复核"}
        )
        
        response = client.post(
            f"/batches/{batch_id}/review",
            headers={"Authorization": f"Bearer {review_token}"},
            json={"reason": "复核通过"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "reviewed"

    def test_pending_review_to_rejected(self, client, entry_token, review_token):
        batch = create_test_batch(client, entry_token)
        batch_id = batch.json()["id"]
        
        client.post(
            f"/batches/{batch_id}/submit",
            headers={"Authorization": f"Bearer {entry_token}"},
            json={"reason": "提交复核"}
        )
        
        response = client.post(
            f"/batches/{batch_id}/reject",
            headers={"Authorization": f"Bearer {review_token}"},
            json={"reason": "资料不全，退回修改"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "rejected"

    def test_reviewed_to_frozen(self, client, entry_token, review_token, supervisor_token):
        batch = create_test_batch(client, entry_token)
        batch_id = batch.json()["id"]
        
        client.post(
            f"/batches/{batch_id}/submit",
            headers={"Authorization": f"Bearer {entry_token}"},
            json={"reason": "提交复核"}
        )
        
        client.post(
            f"/batches/{batch_id}/review",
            headers={"Authorization": f"Bearer {review_token}"},
            json={"reason": "复核通过"}
        )
        
        response = client.post(
            f"/batches/{batch_id}/freeze",
            headers={"Authorization": f"Bearer {supervisor_token}"},
            json={"reason": "确认冻结结算"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "frozen"

    def test_frozen_to_reviewed_unfreeze(self, client, entry_token, review_token, supervisor_token):
        batch = create_test_batch(client, entry_token)
        batch_id = batch.json()["id"]
        
        client.post(f"/batches/{batch_id}/submit", headers={"Authorization": f"Bearer {entry_token}"}, json={})
        client.post(f"/batches/{batch_id}/review", headers={"Authorization": f"Bearer {review_token}"}, json={})
        client.post(f"/batches/{batch_id}/freeze", headers={"Authorization": f"Bearer {supervisor_token}"}, json={})
        
        response = client.post(
            f"/batches/{batch_id}/unfreeze",
            headers={"Authorization": f"Bearer {supervisor_token}"},
            json={"reason": "需要调整数据"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "reviewed"

    def test_invalid_transition_draft_to_frozen(self, client, entry_token, supervisor_token):
        batch = create_test_batch(client, entry_token)
        batch_id = batch.json()["id"]
        
        response = client.post(
            f"/batches/{batch_id}/freeze",
            headers={"Authorization": f"Bearer {supervisor_token}"},
            json={"reason": "直接冻结"}
        )
        assert response.status_code == 400

    def test_full_workflow(self, client, entry_token, review_token, supervisor_token):
        batch = create_test_batch(client, entry_token, "FULL-001")
        batch_id = batch.json()["id"]
        
        response = client.post(f"/batches/{batch_id}/submit", headers={"Authorization": f"Bearer {entry_token}"}, json={})
        assert response.json()["status"] == "pending_review"
        
        response = client.post(f"/batches/{batch_id}/review", headers={"Authorization": f"Bearer {review_token}"}, json={})
        assert response.json()["status"] == "reviewed"
        
        response = client.post(f"/batches/{batch_id}/freeze", headers={"Authorization": f"Bearer {supervisor_token}"}, json={})
        assert response.json()["status"] == "frozen"
        
        response = client.post(f"/batches/{batch_id}/archive", headers={"Authorization": f"Bearer {supervisor_token}"}, json={})
        assert response.json()["status"] == "archived"

    def test_status_trail_created(self, client, entry_token, review_token):
        batch = create_test_batch(client, entry_token)
        batch_id = batch.json()["id"]
        
        client.post(f"/batches/{batch_id}/submit", headers={"Authorization": f"Bearer {entry_token}"}, json={"reason": "第一次提交"})
        client.post(f"/batches/{batch_id}/review", headers={"Authorization": f"Bearer {review_token}"}, json={"reason": "第一次复核"})
        
        trails = client.get(
            f"/batches/{batch_id}/trails",
            headers={"Authorization": f"Bearer {entry_token}"}
        )
        assert trails.status_code == 200
        trail_list = trails.json()
        assert len(trail_list) >= 3
        
        statuses = [t["to_status"] for t in trail_list]
        assert "draft" in statuses
        assert "pending_review" in statuses
        assert "reviewed" in statuses


class TestIdempotency:
    def test_create_duplicate_batch_no(self, client, entry_token):
        create_test_batch(client, entry_token, "IDEMPOTENT-001")
        response = create_test_batch(client, entry_token, "IDEMPOTENT-001")
        assert response.status_code == 400

    def test_create_duplicate_record(self, client, entry_token):
        batch = create_test_batch(client, entry_token, "RECORD-001")
        batch_id = batch.json()["id"]
        
        record_data = {
            "batch_id": batch_id,
            "record_type": "delivery_note",
            "external_ref_no": "DEL-001",
            "raw_content": "测试送货单",
            "product_name": "苹果",
            "quantity": 100,
            "unit_price": 5.0,
            "amount": 500.0,
            "record_date": "2024-01-15T10:00:00",
            "supplier_name_in_record": "测试供应商"
        }
        
        response1 = client.post(
            "/records",
            headers={"Authorization": f"Bearer {entry_token}"},
            json=record_data
        )
        assert response1.status_code == 200
        
        response2 = client.post(
            "/records",
            headers={"Authorization": f"Bearer {entry_token}"},
            json=record_data
        )
        assert response2.status_code == 400

    def test_repeat_status_change_idempotent_effect(self, client, entry_token, review_token):
        batch = create_test_batch(client, entry_token, "REPEAT-001")
        batch_id = batch.json()["id"]
        
        client.post(f"/batches/{batch_id}/submit", headers={"Authorization": f"Bearer {entry_token}"}, json={})
        
        response1 = client.post(
            f"/batches/{batch_id}/review",
            headers={"Authorization": f"Bearer {review_token}"},
            json={"reason": "复核通过"}
        )
        assert response1.status_code == 200
        
        response2 = client.post(
            f"/batches/{batch_id}/review",
            headers={"Authorization": f"Bearer {review_token}"},
            json={"reason": "再次复核"}
        )
        assert response2.status_code == 400
        
        trails = client.get(
            f"/batches/{batch_id}/trails",
            headers={"Authorization": f"Bearer {entry_token}"}
        )
        trail_list = trails.json()
        reviewed_count = sum(1 for t in trail_list if t["to_status"] == "reviewed")
        assert reviewed_count == 1
