import json
import pytest


def test_create_checklist(client):
    response = client.post(
        "/api/v1/checklists/",
        json={
            "version": "v1.0.0",
            "title": "测试发布",
            "description": "测试描述",
            "owner": "tester",
            "artifacts": [],
            "migration_scripts": [],
            "rollback_steps": [],
            "raw_input": "原始输入",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["version"] == "v1.0.0"
    assert data["title"] == "测试发布"
    assert data["status"] == "draft"
    assert data["owner"] == "tester"


def test_get_checklist(client):
    create_response = client.post(
        "/api/v1/checklists/",
        json={
            "version": "v1.0.0",
            "title": "测试发布",
            "description": "测试描述",
            "owner": "tester",
            "artifacts": [],
            "migration_scripts": [],
            "rollback_steps": [],
        },
    )
    checklist_id = create_response.json()["id"]

    get_response = client.get(f"/api/v1/checklists/{checklist_id}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == checklist_id


def test_get_checklist_not_found(client):
    response = client.get("/api/v1/checklists/9999")
    assert response.status_code == 404


def test_list_checklists(client):
    for i in range(3):
        client.post(
            "/api/v1/checklists/",
            json={
                "version": f"v1.0.{i}",
                "title": f"测试发布{i}",
                "owner": "tester",
                "artifacts": [],
                "migration_scripts": [],
                "rollback_steps": [],
            },
        )

    response = client.get("/api/v1/checklists/")
    assert response.status_code == 200
    assert len(response.json()) == 3


def test_update_checklist_status(client):
    create_response = client.post(
        "/api/v1/checklists/",
        json={
            "version": "v1.0.0",
            "title": "测试发布",
            "owner": "tester",
            "artifacts": [],
            "migration_scripts": [],
            "rollback_steps": [],
        },
    )
    checklist_id = create_response.json()["id"]

    response = client.patch(
        f"/api/v1/checklists/{checklist_id}/status?new_status=pending_review&operator=admin&conclusion=准备审核"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "pending_review"


def test_withdraw_checklist(client):
    create_response = client.post(
        "/api/v1/checklists/",
        json={
            "version": "v1.0.0",
            "title": "测试发布",
            "owner": "tester",
            "artifacts": [],
            "migration_scripts": [],
            "rollback_steps": [],
        },
    )
    checklist_id = create_response.json()["id"]

    response = client.post(
        f"/api/v1/checklists/{checklist_id}/withdraw?operator=manager&reason=发现问题"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "withdrawn"


def test_close_checklist(client):
    create_response = client.post(
        "/api/v1/checklists/",
        json={
            "version": "v1.0.0",
            "title": "测试发布",
            "owner": "tester",
            "artifacts": [],
            "migration_scripts": [],
            "rollback_steps": [],
        },
    )
    checklist_id = create_response.json()["id"]

    response = client.post(
        f"/api/v1/checklists/{checklist_id}/close?operator=manager&reason=发布完成"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "closed"


def test_update_checklist(client):
    create_response = client.post(
        "/api/v1/checklists/",
        json={
            "version": "v1.0.0",
            "title": "测试发布",
            "owner": "tester",
            "artifacts": [],
            "migration_scripts": [],
            "rollback_steps": [],
        },
    )
    checklist_id = create_response.json()["id"]

    response = client.put(
        f"/api/v1/checklists/{checklist_id}?operator=admin",
        json={
            "title": "更新后的标题",
            "artifacts": [{"name": "新制品", "path": "/path/to/file.jar"}],
        },
    )
    assert response.status_code == 200
    assert response.json()["title"] == "更新后的标题"
    assert len(response.json()["artifacts"]) == 1


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
