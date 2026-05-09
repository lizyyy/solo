import json

def _create_reissue(client, token, order_no, **kwargs):
    data = {
        "order_no": order_no,
        "customer_name": "Test Customer",
        "product_name": "Test Product",
        **kwargs
    }
    return client.post(
        "/api/reissues",
        json=data,
        headers={"Authorization": f"Bearer {token}"}
    )

def test_create_reissue(client, auth_token):
    response = _create_reissue(client, auth_token, "CREATE001")
    assert response.status_code == 201
    data = response.json()
    assert data["order_no"] == "CREATE001"
    assert data["status"] == "pending"
    assert data["version"] == 1

def test_create_reissue_duplicate_order(client, auth_token):
    _create_reissue(client, auth_token, "DUP001")
    response = _create_reissue(client, auth_token, "DUP001")
    assert response.status_code == 400

def test_list_reissues(client, auth_token):
    _create_reissue(client, auth_token, "LIST001")
    response = client.get(
        "/api/reissues",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data

def test_list_reissues_with_search(client, auth_token):
    _create_reissue(client, auth_token, "SEARCHTEST001", customer_name="SEARCH_CUSTOMER")
    response = client.get(
        "/api/reissues?search=SEARCH_CUSTOMER",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1

def test_get_reissue_detail(client, auth_token):
    create_resp = _create_reissue(client, auth_token, "DETAIL001")
    reissue_id = create_resp.json()["id"]
    
    response = client.get(
        f"/api/reissues/{reissue_id}",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == reissue_id
    assert data["order_no"] == "DETAIL001"

def test_get_nonexistent_reissue(client, auth_token):
    response = client.get(
        "/api/reissues/999999",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 404

def test_update_reissue(client, auth_token):
    create_resp = _create_reissue(client, auth_token, "UPDATE001")
    reissue_id = create_resp.json()["id"]
    
    response = client.put(
        f"/api/reissues/{reissue_id}",
        json={
            "description": "Updated description",
            "remarks": "Updated remarks"
        },
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == 2
    assert data["remarks"] == "Updated remarks"

def test_change_status_valid(client, auth_token):
    create_resp = _create_reissue(client, auth_token, "STATUS001")
    reissue_id = create_resp.json()["id"]
    
    response = client.post(
        f"/api/reissues/{reissue_id}/status",
        json={
            "status": "processing",
            "remarks": "Started processing"
        },
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "processing"
    assert data["version"] == 2

def test_change_status_invalid(client, db, test_user, auth_token):
    from app.models import Reissue, ReissueStatus
    reissue = Reissue(
        order_no="INVALIDSTATUS001",
        customer_name="Test",
        product_name="Product",
        status=ReissueStatus.COMPLETED,
        created_by=test_user.id,
        version=1
    )
    db.add(reissue)
    db.commit()
    db.refresh(reissue)
    
    response = client.post(
        f"/api/reissues/{reissue.id}/status",
        json={"status": "processing"},
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 400

def test_get_status_history(client, auth_token):
    create_resp = _create_reissue(client, auth_token, "HISTORY001")
    reissue_id = create_resp.json()["id"]
    
    response = client.get(
        f"/api/reissues/{reissue_id}/status-history",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_get_version_history(client, auth_token):
    create_resp = _create_reissue(client, auth_token, "VERSION001")
    reissue_id = create_resp.json()["id"]
    
    response = client.get(
        f"/api/reissues/{reissue_id}/history",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

def test_delete_reissue(client, auth_token):
    create_resp = _create_reissue(client, auth_token, "DELETE001")
    reissue_id = create_resp.json()["id"]
    
    response = client.delete(
        f"/api/reissues/{reissue_id}",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200

def test_operator_can_view_but_not_create(client, operator_token):
    response = client.get(
        "/api/reissues",
        headers={"Authorization": f"Bearer {operator_token}"}
    )
    assert response.status_code == 200
    
    response = client.post(
        "/api/reissues",
        json={
            "order_no": "OPTEST001",
            "customer_name": "Test",
            "product_name": "Product"
        },
        headers={"Authorization": f"Bearer {operator_token}"}
    )
    assert response.status_code == 403
