import pytest
from fastapi.testclient import TestClient
import json
import os
import tempfile

import main

@pytest.fixture(autouse=True)
def setup_db():
    db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    db_path = db_file.name
    db_file.close()
    
    original_env = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    
    import importlib
    importlib.reload(main)
    
    main.Base.metadata.create_all(bind=main.engine)
    
    global client
    client = TestClient(main.app)
    
    yield
    
    try:
        os.unlink(db_path)
    except:
        pass
    
    if original_env:
        os.environ["DATABASE_URL"] = original_env
    elif "DATABASE_URL" in os.environ:
        del os.environ["DATABASE_URL"]

TEST_PLAN_CONTENT = json.dumps({
    "resource_changes": [
        {
            "address": "aws_instance.web_server",
            "change": {
                "actions": ["create"],
                "after": {
                    "instance_type": "t2.micro",
                    "ami": "ami-12345",
                    "root_password": "secret123"
                }
            }
        },
        {
            "address": "kubernetes_deployment.app",
            "change": {
                "actions": ["update"],
                "after": {
                    "replicas": 3,
                    "image": "nginx:latest",
                    "api_token": "tok_abc123"
                }
            }
        },
        {
            "address": "database_postgresql.main",
            "change": {
                "actions": ["delete"],
                "after": None
            }
        }
    ]
})





def test_create_task():
    response = client.post(
        "/api/tasks",
        json={
            "plan_file_name": "test_plan.json",
            "plan_content": TEST_PLAN_CONTENT,
            "created_by": "test_user"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["plan_file_name"] == "test_plan.json"
    assert data["status"] == "analyzed"
    assert data["created_by"] == "test_user"
    assert len(data["resources"]) == 3
    return data["id"]


def test_list_tasks():
    test_create_task()
    response = client.get("/api/tasks")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_list_tasks_by_status():
    test_create_task()
    response = client.get("/api/tasks?status=analyzed")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    for task in data:
        assert task["status"] == "analyzed"


def test_list_tasks_by_team():
    test_create_task()
    response = client.get("/api/tasks?team=cloud-infra")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_get_task():
    task_id = test_create_task()
    response = client.get(f"/api/tasks/{task_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == task_id


def test_get_task_not_found():
    response = client.get("/api/tasks/99999")
    assert response.status_code == 404


def test_update_task_status():
    task_id = test_create_task()
    response = client.put(
        f"/api/tasks/{task_id}/status",
        json={
            "status": "confirmed",
            "handler": "operator1",
            "conclusion": "已确认需要处理"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "confirmed"
    assert data["handler"] == "operator1"
    assert data["conclusion"] == "已确认需要处理"


def test_update_task_status_not_found():
    response = client.put(
        "/api/tasks/99999/status",
        json={
            "status": "confirmed"
        }
    )
    assert response.status_code == 404


def test_update_resource():
    task_id = test_create_task()
    response = client.put(
        f"/api/tasks/{task_id}/resources",
        json={
            "resource_address": "aws_instance.web_server",
            "change_action": "update",
            "sensitive_fields": ["root_password", "api_key"],
            "responsible_team": "cloud-infra",
            "summary": "Web服务器配置更新"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Resource updated successfully"


def test_update_resource_not_found():
    task_id = test_create_task()
    response = client.put(
        f"/api/tasks/{task_id}/resources",
        json={
            "resource_address": "nonexistent.resource"
        }
    )
    assert response.status_code == 404


def test_close_task():
    task_id = test_create_task()
    response = client.post(
        f"/api/tasks/{task_id}/close",
        json={
            "handler": "operator1",
            "conclusion": "漂移已修复，任务关闭"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Task closed successfully"


def test_close_task_not_found():
    response = client.post(
        "/api/tasks/99999/close",
        json={
            "handler": "operator1",
            "conclusion": "漂移已修复，任务关闭"
        }
    )
    assert response.status_code == 404


def test_reject_task():
    task_id = test_create_task()
    response = client.post(
        f"/api/tasks/{task_id}/reject",
        json={
            "handler": "reviewer1",
            "conclusion": "误报，无需处理"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Task rejected successfully"


def test_reject_task_not_found():
    response = client.post(
        "/api/tasks/99999/reject",
        json={
            "handler": "reviewer1",
            "conclusion": "误报，无需处理"
        }
    )
    assert response.status_code == 404


def test_export_task():
    task_id = test_create_task()
    response = client.get(f"/api/tasks/{task_id}/export")
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == task_id
    assert "summary" in data
    assert "total_resources" in data["summary"]
    assert "by_action" in data["summary"]
    assert "by_team" in data["summary"]


def test_export_task_not_found():
    response = client.get("/api/tasks/99999/export")
    assert response.status_code == 404


def test_list_teams():
    test_create_task()
    response = client.get("/api/teams")
    assert response.status_code == 200
    data = response.json()
    assert "teams" in data
    assert len(data["teams"]) >= 1


def test_sensitive_fields_detection():
    task_id = test_create_task()
    response = client.get(f"/api/tasks/{task_id}")
    data = response.json()
    aws_resource = next(r for r in data["resources"] if r["resource_address"] == "aws_instance.web_server")
    assert "root_password" in aws_resource["sensitive_fields"]


def test_team_assignment():
    task_id = test_create_task()
    response = client.get(f"/api/tasks/{task_id}")
    data = response.json()
    
    aws_resource = next(r for r in data["resources"] if r["resource_address"] == "aws_instance.web_server")
    assert aws_resource["responsible_team"] == "cloud-infra"
    
    k8s_resource = next(r for r in data["resources"] if r["resource_address"] == "kubernetes_deployment.app")
    assert k8s_resource["responsible_team"] == "k8s-team"
    
    db_resource = next(r for r in data["resources"] if r["resource_address"] == "database_postgresql.main")
    assert db_resource["responsible_team"] == "dba-team"


def test_action_classification():
    task_id = test_create_task()
    response = client.get(f"/api/tasks/{task_id}")
    data = response.json()
    
    aws_resource = next(r for r in data["resources"] if r["resource_address"] == "aws_instance.web_server")
    assert aws_resource["change_action"] == "create"
    
    k8s_resource = next(r for r in data["resources"] if r["resource_address"] == "kubernetes_deployment.app")
    assert k8s_resource["change_action"] == "update"
    
    db_resource = next(r for r in data["resources"] if r["resource_address"] == "database_postgresql.main")
    assert db_resource["change_action"] == "delete"


def test_raw_input_saved():
    import main
    response = client.post(
        "/api/tasks",
        json={
            "plan_file_name": "test_raw.json",
            "plan_content": TEST_PLAN_CONTENT,
            "created_by": "test_user"
        }
    )
    assert response.status_code == 200
    task_id = response.json()["id"]
    
    db = main.SessionLocal()
    task = db.query(main.DriftTask).filter(main.DriftTask.id == task_id).first()
    assert task.raw_input is not None
    raw_data = json.loads(task.raw_input)
    assert raw_data["plan_file_name"] == "test_raw.json"
    assert raw_data["created_by"] == "test_user"
    db.close()


def test_standard_terraform_plan_json_structure():
    terraform_standard_plan = json.dumps({
        "format_version": "1.0",
        "terraform_version": "1.5.0",
        "resource_changes": [
            {
                "address": "aws_instance.example",
                "type": "aws_instance",
                "name": "example",
                "change": {
                    "actions": ["create"],
                    "before": None,
                    "after": {
                        "ami": "ami-12345678",
                        "instance_type": "t2.micro",
                        "private_key": "secret"
                    },
                    "after_unknown": {
                        "id": True
                    }
                }
            },
            {
                "address": "kubernetes_deployment.app",
                "type": "kubernetes_deployment",
                "name": "app",
                "change": {
                    "actions": ["update"],
                    "before": {
                        "replicas": 1
                    },
                    "after": {
                        "replicas": 3,
                        "api_token": "sensitive-token"
                    }
                }
            },
            {
                "address": "null_resource.old",
                "type": "null_resource",
                "name": "old",
                "change": {
                    "actions": ["delete"],
                    "before": {
                        "triggers": None
                    },
                    "after": None
                }
            },
            {
                "address": "null_resource.noop",
                "type": "null_resource",
                "name": "noop",
                "change": {
                    "actions": ["no-op"],
                    "before": {},
                    "after": {}
                }
            }
        ]
    })
    
    response = client.post(
        "/api/tasks",
        json={
            "plan_file_name": "standard_terraform.json",
            "plan_content": terraform_standard_plan,
            "created_by": "test_user"
        }
    )
    assert response.status_code == 200
    task_id = response.json()["id"]
    
    response = client.get(f"/api/tasks/{task_id}")
    data = response.json()
    
    aws_resource = next(r for r in data["resources"] if r["resource_address"] == "aws_instance.example")
    assert aws_resource["change_action"] == "create"
    
    k8s_resource = next(r for r in data["resources"] if r["resource_address"] == "kubernetes_deployment.app")
    assert k8s_resource["change_action"] == "update"
    
    delete_resource = next(r for r in data["resources"] if r["resource_address"] == "null_resource.old")
    assert delete_resource["change_action"] == "delete"
    
    noop_resource = next(r for r in data["resources"] if r["resource_address"] == "null_resource.noop")
    assert noop_resource["change_action"] == "no-op"
    
    assert "private_key" in aws_resource["sensitive_fields"]
    assert "api_token" in k8s_resource["sensitive_fields"]


def test_export_summary_statistics():
    terraform_standard_plan = json.dumps({
        "resource_changes": [
            {
                "address": "aws_instance.web1",
                "change": { "actions": ["create"] }
            },
            {
                "address": "aws_instance.web2",
                "change": { "actions": ["create"] }
            },
            {
                "address": "kubernetes_deployment.app",
                "change": { "actions": ["update"] }
            },
            {
                "address": "null_resource.old",
                "change": { "actions": ["delete"] }
            }
        ]
    })
    
    response = client.post(
        "/api/tasks",
        json={
            "plan_file_name": "summary_test.json",
            "plan_content": terraform_standard_plan,
            "created_by": "test_user"
        }
    )
    assert response.status_code == 200
    task_id = response.json()["id"]
    
    export_response = client.get(f"/api/tasks/{task_id}/export")
    export_data = export_response.json()
    
    assert export_data["summary"]["total_resources"] == 4
    assert export_data["summary"]["by_action"]["create"] == 2
    assert export_data["summary"]["by_action"]["update"] == 1
    assert export_data["summary"]["by_action"]["delete"] == 1
