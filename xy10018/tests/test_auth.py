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

def test_register_success(client):
    response = client.post(
        "/api/auth/register",
        json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "newpass123",
            "full_name": "New User",
            "role": "cs"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "newuser"

def test_register_duplicate_username(client, test_user):
    response = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "email": "another@example.com",
            "password": "test12345",
            "full_name": "Test",
            "role": "cs"
        }
    )
    assert response.status_code == 400
