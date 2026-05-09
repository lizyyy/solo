def _create_reissue_via_api(client, token, order_no):
    response = client.post(
        "/api/reissues",
        json={
            "order_no": order_no,
            "customer_name": "Batch Test",
            "product_name": "Batch Product"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    return response.json()["id"]

def test_batch_assign(client, manager_token, auth_token, test_user):
    ids = []
    for i in range(3):
        ids.append(_create_reissue_via_api(client, auth_token, f"BATCHASSIGN{i}"))
    
    response = client.post(
        "/api/batch/assign",
        json={
            "ids": ids,
            "operation": "assign",
            "params": {"assignee_id": test_user.id}
        },
        headers={"Authorization": f"Bearer {manager_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success_count"] == 3
    assert data["failed_count"] == 0

def test_batch_cancel(client, manager_token, auth_token):
    ids = []
    for i in range(2):
        ids.append(_create_reissue_via_api(client, auth_token, f"BATCHCANCEL{i}"))
    
    response = client.post(
        "/api/batch/cancel",
        json={
            "ids": ids,
            "operation": "cancel",
            "params": {"remarks": "Batch cancelled"}
        },
        headers={"Authorization": f"Bearer {manager_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success_count"] == 2

def test_batch_requires_manager_role(client, auth_token):
    response = client.post(
        "/api/batch/assign",
        json={
            "ids": [1, 2, 3],
            "operation": "assign",
            "params": {"assignee_id": 1}
        },
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 403
