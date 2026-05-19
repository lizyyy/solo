import pytest


def test_export_incident(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "服务连接超时",
            "description": "用户报告部分用户无法正常访问API服务"
        }
    )
    announcement = client.post(
        "/api/announcements",
        json={
            "incident_id": "INC-2024-001",
            "service_status": "服务部分不可用",
            "content": "正在调查数据库连接问题",
            "created_by": "运维团队"
        }
    ).json()
    subscriber = client.post(
        "/api/subscribers",
        json={
            "incident_id": "INC-2024-001",
            "name": "产品团队",
            "email": "product@example.com"
        }
    ).json()
    client.post(
        "/api/confirmations",
        json={
            "incident_id": "INC-2024-001",
            "announcement_id": announcement["id"],
            "subscriber_id": subscriber["id"],
            "notes": "已通知相关人员"
        }
    )
    client.post(
        "/api/correction-logs",
        json={
            "incident_id": "INC-2024-001",
            "original_input": "用户错误报告重复",
            "processed_by": "张三",
            "conclusion": "已合并重复报告，根因定位至数据库连接池",
            "correction_type": "数据修正"
        }
    )
    
    response = client.get("/api/incidents/INC-2024-001/export")
    assert response.status_code == 200
    data = response.json()
    assert data["incident_id"] == "INC-2024-001"
    assert len(data["announcements"]) == 1
    assert len(data["subscribers"]) == 1
    assert len(data["confirmations"]) == 1
    assert len(data["correction_logs"]) == 1
    assert "exported_at" in data


def test_correction_log(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "测试事故"
        }
    )
    response = client.post(
        "/api/correction-logs",
        json={
            "incident_id": "INC-2024-001",
            "original_input": "用户错误报告重复",
            "processed_by": "张三",
            "conclusion": "已合并重复报告",
            "correction_type": "数据修正"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["processed_by"] == "张三"
    assert data["original_input"] == "用户错误报告重复"


def test_get_correction_logs(client):
    client.post(
        "/api/incidents",
        json={
            "id": "INC-2024-001",
            "title": "测试事故"
        }
    )
    for i in range(2):
        client.post(
            "/api/correction-logs",
            json={
                "incident_id": "INC-2024-001",
                "original_input": f"错误输入{i}",
                "processed_by": "张三",
                "conclusion": f"处理结论{i}"
            }
        )
    response = client.get("/api/incidents/INC-2024-001/correction-logs")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert "status" in response.json()
