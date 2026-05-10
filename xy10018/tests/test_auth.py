def test_login_success(client, test_user):
    response = client.post(
        "/api/auth/login",
        data={"username": "testuser", "password": "testpass123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_wrong_password(client, test_user):
    response = client.post(
        "/api/auth/login",
        data={"username": "testuser", "password": "wrongpass"}
    )
    assert response.status_code == 401

def test_login_nonexistent_user(client):
    response = client.post(
        "/api/auth/login",
        data={"username": "nonexistent", "password": "test"}
    )
    assert response.status_code == 401

def test_get_current_user(client, auth_token):
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"

def test_get_current_user_no_token(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401

def test_register_endpoint_not_available(client):
    response = client.post(
        "/api/auth/register",
        json={
            "username": "hacker",
            "email": "hacker@example.com",
            "password": "hack123",
            "full_name": "Hacker",
            "role": "admin"
        }
    )
    assert response.status_code == 404

def test_admin_can_create_user(client, admin_token):
    response = client.post(
        "/api/users",
        json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "newpass123",
            "full_name": "New User",
            "role": "cs"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "newuser"
    assert data["role"] == "cs"

def test_non_admin_cannot_create_user(client, auth_token):
    response = client.post(
        "/api/users",
        json={
            "username": "newuser2",
            "email": "new2@example.com",
            "password": "pass123",
            "full_name": "Test",
            "role": "admin"
        },
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 403

def test_admin_can_create_manager_user(client, admin_token):
    response = client.post(
        "/api/users",
        json={
            "username": "newmanager",
            "email": "manager2@example.com",
            "password": "pass123",
            "full_name": "New Manager",
            "role": "manager"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "manager"
