import pytest


def test_entry_user_can_create_batch(client, entry_token):
    response = client.post(
        "/batches",
        headers={"Authorization": f"Bearer {entry_token}"},
        json={
            "batch_no": "PERM-001",
            "supplier_name": "测试供应商",
            "delivery_date": "2024-01-15T10:00:00"
        }
    )
    assert response.status_code == 200


def test_readonly_user_cannot_create_batch(client, readonly_token):
    response = client.post(
        "/batches",
        headers={"Authorization": f"Bearer {readonly_token}"},
        json={
            "batch_no": "PERM-002",
            "supplier_name": "测试供应商",
            "delivery_date": "2024-01-15T10:00:00"
        }
    )
    assert response.status_code == 403


def test_entry_user_cannot_freeze(client, entry_token):
    response = client.post(
        "/batches/1/freeze",
        headers={"Authorization": f"Bearer {entry_token}"},
        json={"reason": "尝试冻结"}
    )
    assert response.status_code in [400, 403]


def test_supervisor_can_freeze(client, entry_token, review_token, supervisor_token):
    batch = client.post(
        "/batches",
        headers={"Authorization": f"Bearer {entry_token}"},
        json={
            "batch_no": "FREEZE-001",
            "supplier_name": "测试供应商",
            "delivery_date": "2024-01-15T10:00:00"
        }
    )
    batch_id = batch.json()["id"]
    
    client.post(f"/batches/{batch_id}/submit", headers={"Authorization": f"Bearer {entry_token}"}, json={})
    client.post(f"/batches/{batch_id}/review", headers={"Authorization": f"Bearer {review_token}"}, json={})
    
    response = client.post(
        f"/batches/{batch_id}/freeze",
        headers={"Authorization": f"Bearer {supervisor_token}"},
        json={"reason": "主管冻结"}
    )
    assert response.status_code == 200


def test_readonly_can_view_batches(client, readonly_token):
    response = client.get(
        "/batches",
        headers={"Authorization": f"Bearer {readonly_token}"}
    )
    assert response.status_code == 200


def test_review_user_can_export(client, review_token):
    response = client.get(
        "/export/batches",
        headers={"Authorization": f"Bearer {review_token}"}
    )
    assert response.status_code == 200


def test_entry_user_cannot_export(client, entry_token):
    response = client.get(
        "/export/batches",
        headers={"Authorization": f"Bearer {entry_token}"}
    )
    assert response.status_code == 403


def test_supervisor_can_access_dashboard(client, supervisor_token):
    response = client.get(
        "/manager/dashboard",
        headers={"Authorization": f"Bearer {supervisor_token}"}
    )
    assert response.status_code == 200


def test_review_user_cannot_access_dashboard(client, review_token):
    response = client.get(
        "/manager/dashboard",
        headers={"Authorization": f"Bearer {review_token}"}
    )
    assert response.status_code == 403
