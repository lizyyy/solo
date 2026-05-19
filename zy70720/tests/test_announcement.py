import pytest


def test_create_announcement(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "测试事故"
        }
    )
    response = client.post(
        "/api/announcements",
        json={
            "incident_id": "INC-2024-001",
            "service_status": "服务部分不可用",
            "content": "正在调查数据库连接问题",
            "created_by": "运维团队"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == 1
    assert data["service_status"] == "服务部分不可用"


def test_announcement_version_increment(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "测试事故"
        }
    )
    for i in range(3):
        client.post(
            "/api/announcements",
            json={
                "incident_id": "INC-2024-001",
                "service_status": f"状态{i+1}",
                "content": f"公告内容{i+1}"
            }
        )
    announcements = client.get("/api/incidents/INC-2024-001/announcements").json()
    versions = [a["version"] for a in announcements]
    assert sorted(versions, reverse=True) == [3, 2, 1]


def test_get_announcements(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "测试事故"
        }
    )
    for i in range(3):
        client.post(
            "/api/announcements",
            json={
                "incident_id": "INC-2024-001",
                "service_status": f"状态{i+1}",
                "content": f"公告内容{i+1}"
            }
        )
    response = client.get("/api/incidents/INC-2024-001/announcements")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3


def test_create_subscriber(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "测试事故"
        }
    )
    response = client.post(
        "/api/subscribers",
        json={
            "incident_id": "INC-2024-001",
            "name": "产品团队",
            "email": "product@example.com"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "产品团队"
    assert data["status"] == "pending"


def test_duplicate_subscriber(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "测试事故"
        }
    )
    client.post(
        "/api/subscribers",
        json={
            "incident_id": "INC-2024-001",
            "name": "产品团队"
        }
    )
    response = client.post(
        "/api/subscribers",
        json={
            "incident_id": "INC-2024-001",
            "name": "产品团队"
        }
    )
    assert response.status_code == 200


def test_create_confirmation(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "测试事故"
        }
    )
    announcement = client.post(
        "/api/announcements",
        json={
            "incident_id": "INC-2024-001",
            "service_status": "服务不可用",
            "content": "公告内容"
        }
    ).json()
    subscriber = client.post(
        "/api/subscribers",
        json={
            "incident_id": "INC-2024-001",
            "name": "产品团队"
        }
    ).json()
    
    response = client.post(
        "/api/confirmations",
        json={
            "incident_id": "INC-2024-001",
            "announcement_id": announcement["id"],
            "subscriber_id": subscriber["id"],
            "notes": "已通知相关人员"
        }
    )
    assert response.status_code == 200
    assert "确认成功" in response.json()["message"]


def test_duplicate_confirmation(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "测试事故"
        }
    )
    announcement = client.post(
        "/api/announcements",
        json={
            "incident_id": "INC-2024-001",
            "service_status": "服务不可用",
            "content": "公告内容"
        }
    ).json()
    subscriber = client.post(
        "/api/subscribers",
        json={
            "incident_id": "INC-2024-001",
            "name": "产品团队"
        }
    ).json()
    
    client.post(
        "/api/confirmations",
        json={
            "incident_id": "INC-2024-001",
            "announcement_id": announcement["id"],
            "subscriber_id": subscriber["id"]
        }
    )
    response = client.post(
        "/api/confirmations",
        json={
            "incident_id": "INC-2024-001",
            "announcement_id": announcement["id"],
            "subscriber_id": subscriber["id"]
        }
    )
    assert response.status_code == 200
    assert "跳过重复确认" in response.json()["message"]


def test_confirmation_subscriber_status_update(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "测试事故"
        }
    )
    announcement = client.post(
        "/api/announcements",
        json={
            "incident_id": "INC-2024-001",
            "service_status": "服务不可用",
            "content": "公告内容"
        }
    ).json()
    subscriber = client.post(
        "/api/subscribers",
        json={
            "incident_id": "INC-2024-001",
            "name": "产品团队"
        }
    ).json()
    
    client.post(
        "/api/confirmations",
        json={
            "incident_id": "INC-2024-001",
            "announcement_id": announcement["id"],
            "subscriber_id": subscriber["id"]
        }
    )
    
    subscribers = client.get("/api/incidents/INC-2024-001/subscribers").json()
    assert subscribers[0]["status"] == "confirmed"
