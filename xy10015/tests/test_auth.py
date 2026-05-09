def test_login_success(client, test_user):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "testuser", "password": "test123456"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client, test_user):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "testuser", "password": "wrongpassword"}
    )
    assert response.status_code == 401


def test_login_non_existent_user(client):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "nonexistent", "password": "test123456"}
    )
    assert response.status_code == 401


def test_get_current_user(client, auth_headers):
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"


def test_get_current_user_no_token(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_list_users(client, auth_headers):
    response = client.get("/api/v1/auth/users", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "total" in data


def test_list_roles(client, auth_headers):
    response = client.get("/api/v1/auth/roles", headers=auth_headers)
    assert response.status_code == 200
