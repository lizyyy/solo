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


def test_status_transition_invalid_draft_to_approved(client):
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
        f"/api/v1/checklists/{checklist_id}/status?new_status=approved&operator=admin"
    )
    assert response.status_code == 400
    assert "Invalid status transition" in response.json()["detail"]


def test_status_transition_valid_path(client):
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
        f"/api/v1/checklists/{checklist_id}/status?new_status=pending_review&operator=admin"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "pending_review"

    response = client.patch(
        f"/api/v1/checklists/{checklist_id}/status?new_status=reviewing&operator=admin"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "reviewing"

    response = client.patch(
        f"/api/v1/checklists/{checklist_id}/status?new_status=approved&operator=admin"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "approved"


def test_cannot_change_status_from_closed(client):
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

    client.post(f"/api/v1/checklists/{checklist_id}/close?operator=manager&reason=test")

    response = client.patch(
        f"/api/v1/checklists/{checklist_id}/status?new_status=pending_review&operator=admin"
    )
    assert response.status_code == 400


def test_parse_checklist_text(client):
    raw_checklist = """
# 发布清单 v1.0.0

## 制品
- /deploy/app-v1.0.0.jar
- /deploy/payment-service-v2.1.0.war

## 迁移脚本
- /sql/20240101_create_users.sql 有回滚方案
- /sql/20240102_add_index.sql

## 回滚步骤
1. 停止服务 负责人: zhangsan
2. 恢复数据库备份 负责人: lisi
3. 启动旧版本
"""
    create_response = client.post(
        "/api/v1/checklists/",
        json={
            "version": "v1.0.0",
            "title": "测试发布",
            "owner": "tester",
            "raw_input": raw_checklist,
            "artifacts": [],
            "migration_scripts": [],
            "rollback_steps": [],
        },
    )
    checklist_id = create_response.json()["id"]

    parse_response = client.post(
        f"/api/v1/checklists/{checklist_id}/parse?operator=system"
    )
    assert parse_response.status_code == 200
    data = parse_response.json()
    
    assert len(data["artifacts"]) >= 2
    assert len(data["migration_scripts"]) >= 2
    assert len(data["rollback_steps"]) >= 3
    
    artifact_names = [a["name"] for a in data["artifacts"]]
    assert "app-v1.0.0.jar" in artifact_names
    
    step_owners = [s["owner"] for s in data["rollback_steps"]]
    assert "zhangsan" in step_owners


def test_parse_checklist_no_raw_input(client):
    create_response = client.post(
        "/api/v1/checklists/",
        json={
            "version": "v1.0.0",
            "title": "测试发布",
            "owner": "tester",
            "raw_input": None,
            "artifacts": [],
            "migration_scripts": [],
            "rollback_steps": [],
        },
    )
    checklist_id = create_response.json()["id"]

    parse_response = client.post(
        f"/api/v1/checklists/{checklist_id}/parse?operator=system"
    )
    assert parse_response.status_code == 400
    assert "No raw_input available" in parse_response.json()["detail"]


def test_rejected_can_go_back_to_draft(client):
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

    client.patch(
        f"/api/v1/checklists/{checklist_id}/status?new_status=pending_review&operator=admin"
    )
    client.patch(
        f"/api/v1/checklists/{checklist_id}/status?new_status=reviewing&operator=admin"
    )
    response = client.patch(
        f"/api/v1/checklists/{checklist_id}/status?new_status=rejected&operator=admin"
    )
    assert response.status_code == 200

    response = client.patch(
        f"/api/v1/checklists/{checklist_id}/status?new_status=draft&operator=admin"
    )
    assert response.status_code == 200
    assert response.json()["status"] == "draft"
