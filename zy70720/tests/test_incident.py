import pytest


def test_create_incident(client):
    response = client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "服务连接超时",
            "description": "用户报告部分用户无法正常访问API服务"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "INC-2024-001"
    assert data["title"] == "服务连接超时"
    assert data["current_status"] == "investigating"


def test_create_duplicate_incident(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "测试事故"
        }
    )
    response = client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "重复事故"
        }
    )
    assert response.status_code == 400


def test_get_incident(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "测试事故"
        }
    )
    response = client.get("/api/incidents/INC-2024-001")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "INC-2024-001"


def test_get_incident_not_found(client):
    response = client.get("/api/incidents/NOT-EXISTS")
    assert response.status_code == 404


def test_update_incident_status(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "测试事故"
        }
    )
    response = client.post(
        "/api/incidents/INC-2024-001/status",
        json={"status": "identified"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["current_status"] == "identified"


def test_close_incident(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "测试事故"
        }
    )
    response = client.post("/api/incidents/INC-2024-001/close")
    assert response.status_code == 200
    data = response.json()
    assert data["current_status"] == "closed"
    assert data["is_active"] == False


def test_cannot_update_status_on_closed_incident(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "测试事故"
        }
    )
    client.post("/api/incidents/INC-2024-001/close")
    response = client.post(
        "/api/incidents/INC-2024-001/status",
        json={"status": "monitoring"}
    )
    assert response.status_code == 400


def test_list_incidents(client):
    for i in range(3):
        client.post(
            "/api/incidents",
            json={
                "id": f"INC-2024-00{i+1}",
                "title": f"事故{i+1}"
            }
        )
    response = client.get("/api/incidents")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3


def test_list_incidents_active_filter(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "活跃事故"
        }
    )
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-002",
            "title": "已关闭事故"
        }
    )
    client.post("/api/incidents/INC-2024-002/close")
    
    response = client.get("/api/incidents?is_active=true")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == "INC-2024-001"
