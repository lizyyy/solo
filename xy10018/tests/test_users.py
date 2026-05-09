def test_list_users_requires_admin(client, auth_token):
    response = client.get(
        "/api/users",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 403

def test_list_users_as_admin(client, admin_token, test_user):
    response = client.get(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1

def test_create_user_as_admin(client, admin_token):
    response = client.post(
        "/api/users",
        json={
            "username": "newuser2",
            "email": "new2@example.com",
            "password": "password123",
            "full_name": "New User 2",
            "role": "operator"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "newuser2"

def test_update_user(client, admin_token, test_user):
    response = client.put(
        f"/api/users/{test_user.id}",
        json={
            "full_name": "Updated Name",
            "is_active": True
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Updated Name"

def test_cannot_delete_self(client, admin_token, test_admin):
    response = client.delete(
        f"/api/users/{test_admin.id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 400
