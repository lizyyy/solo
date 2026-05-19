import pytest
from fastapi.testclient import TestClient
import os
import sys


@pytest.fixture
def client():
    test_db = "test_feature_flag.db"
    if os.path.exists(test_db):
        os.remove(test_db)
    
    original_env = os.environ.get("DB_PATH")
    os.environ["DB_PATH"] = test_db
    
    for module in list(sys.modules.keys()):
        if "database" in module or "main" in module:
            del sys.modules[module]
    
    from database import init_db
    init_db()
    
    from main import app as test_app
    
    with TestClient(test_app) as c:
        yield c
    
    if os.path.exists(test_db):
        os.remove(test_db)
    if original_env:
        os.environ["DB_PATH"] = original_env
    else:
        os.environ.pop("DB_PATH", None)


class TestFeatureFlagAPI:
    def test_create_feature_flag(self, client):
        response = client.post(
            "/api/feature-flags/",
            json={
                "name": "test_flag",
                "description": "测试开关",
                "conditions": {"region": "北京", "level": 3},
                "priority": 50,
                "user_group": "vip"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "test_flag"
        assert data["priority"] == 50

    def test_list_feature_flags(self, client):
        client.post(
            "/api/feature-flags/",
            json={
                "name": "flag1",
                "conditions": {"region": "北京"},
                "priority": 50
            }
        )
        client.post(
            "/api/feature-flags/",
            json={
                "name": "flag2",
                "conditions": {"region": "上海"},
                "priority": 60
            }
        )

        response = client.get("/api/feature-flags/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2

    def test_get_feature_flag(self, client):
        create_response = client.post(
            "/api/feature-flags/",
            json={
                "name": "get_test",
                "conditions": {},
                "priority": 50
            }
        )
        flag_id = create_response.json()["id"]

        response = client.get(f"/api/feature-flags/{flag_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "get_test"

    def test_update_feature_flag(self, client):
        create_response = client.post(
            "/api/feature-flags/",
            json={
                "name": "update_test",
                "conditions": {},
                "priority": 50
            }
        )
        flag_id = create_response.json()["id"]

        response = client.put(
            f"/api/feature-flags/{flag_id}",
            json={"priority": 100, "description": "更新了"}
        )
        assert response.status_code == 200
        assert response.json()["priority"] == 100

    def test_delete_feature_flag(self, client):
        create_response = client.post(
            "/api/feature-flags/",
            json={
                "name": "delete_test",
                "conditions": {},
                "priority": 50
            }
        )
        flag_id = create_response.json()["id"]

        response = client.delete(f"/api/feature-flags/{flag_id}")
        assert response.status_code == 200

        get_response = client.get(f"/api/feature-flags/{flag_id}")
        assert get_response.json()["is_active"] is False


class TestConflictAPI:
    def test_evaluate_no_conflict(self, client):
        client.post(
            "/api/feature-flags/",
            json={
                "name": "flag1",
                "conditions": {"region": "北京"},
                "priority": 50
            }
        )
        client.post(
            "/api/feature-flags/",
            json={
                "name": "flag2",
                "conditions": {"region": "上海"},
                "priority": 60
            }
        )

        response = client.post(
            "/api/conflicts/evaluate",
            json={
                "user_id": "user1",
                "user_context": {"region": "北京"}
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["has_conflict"] is False

    def test_evaluate_has_conflict(self, client):
        client.post(
            "/api/feature-flags/",
            json={
                "name": "flag1",
                "conditions": {"region": "北京"},
                "priority": 50
            }
        )
        client.post(
            "/api/feature-flags/",
            json={
                "name": "flag2",
                "conditions": {"region": "北京"},
                "priority": 80
            }
        )

        response = client.post(
            "/api/conflicts/evaluate",
            json={
                "user_id": "user1",
                "user_context": {"region": "北京"}
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["has_conflict"] is True
        assert "conflict_id" in data

    def test_list_conflicts(self, client):
        client.post(
            "/api/feature-flags/",
            json={
                "name": "flag1",
                "conditions": {"region": "北京"},
                "priority": 50
            }
        )
        client.post(
            "/api/feature-flags/",
            json={
                "name": "flag2",
                "conditions": {"region": "北京"},
                "priority": 80
            }
        )
        client.post(
            "/api/conflicts/evaluate",
            json={
                "user_id": "user1",
                "user_context": {"region": "北京"}
            }
        )

        response = client.get("/api/conflicts/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_resolve_conflict(self, client):
        flag1 = client.post(
            "/api/feature-flags/",
            json={
                "name": "flag1",
                "conditions": {"region": "北京"},
                "priority": 50
            }
        ).json()
        flag2 = client.post(
            "/api/feature-flags/",
            json={
                "name": "flag2",
                "conditions": {"region": "北京"},
                "priority": 80
            }
        ).json()

        eval_result = client.post(
            "/api/conflicts/evaluate",
            json={
                "user_id": "user1",
                "user_context": {"region": "北京"}
            }
        ).json()
        conflict_id = eval_result["conflict_id"]

        response = client.post(
            "/api/conflicts/resolve",
            json={
                "conflict_id": conflict_id,
                "resolution": "使用flag1",
                "operator": "客服1",
                "selected_flag_id": flag1["id"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "resolved"

    def test_withdraw_conflict(self, client):
        client.post(
            "/api/feature-flags/",
            json={
                "name": "flag1",
                "conditions": {"region": "北京"},
                "priority": 50
            }
        )
        client.post(
            "/api/feature-flags/",
            json={
                "name": "flag2",
                "conditions": {"region": "北京"},
                "priority": 80
            }
        )

        eval_result = client.post(
            "/api/conflicts/evaluate",
            json={
                "user_id": "user1",
                "user_context": {"region": "北京"}
            }
        ).json()
        conflict_id = eval_result["conflict_id"]

        response = client.post(
            f"/api/conflicts/{conflict_id}/withdraw",
            params={"operator": "客服1", "reason": "数据有误"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "withdrawn"

    def test_close_conflict(self, client):
        client.post(
            "/api/feature-flags/",
            json={
                "name": "flag1",
                "conditions": {"region": "北京"},
                "priority": 50
            }
        )
        client.post(
            "/api/feature-flags/",
            json={
                "name": "flag2",
                "conditions": {"region": "北京"},
                "priority": 80
            }
        )

        eval_result = client.post(
            "/api/conflicts/evaluate",
            json={
                "user_id": "user1",
                "user_context": {"region": "北京"}
            }
        ).json()
        conflict_id = eval_result["conflict_id"]

        response = client.post(
            f"/api/conflicts/{conflict_id}/close",
            params={"operator": "主管1", "reason": "用户注销"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "closed"

    def test_get_conflict_report(self, client):
        client.post(
            "/api/feature-flags/",
            json={
                "name": "flag1",
                "conditions": {"region": "北京"},
                "priority": 50
            }
        )
        client.post(
            "/api/feature-flags/",
            json={
                "name": "flag2",
                "conditions": {"region": "北京"},
                "priority": 80
            }
        )

        eval_result = client.post(
            "/api/conflicts/evaluate",
            json={
                "user_id": "user1",
                "user_context": {"region": "北京"}
            }
        ).json()
        conflict_id = eval_result["conflict_id"]

        response = client.get(f"/api/conflicts/{conflict_id}/report")
        assert response.status_code == 200
        report = response.json()
        assert "conflict_id" in report
        assert "conflicting_flags" in report

    def test_export_conflict_report(self, client):
        client.post(
            "/api/feature-flags/",
            json={
                "name": "flag1",
                "conditions": {"region": "北京"},
                "priority": 50
            }
        )
        client.post(
            "/api/feature-flags/",
            json={
                "name": "flag2",
                "conditions": {"region": "北京"},
                "priority": 80
            }
        )

        eval_result = client.post(
            "/api/conflicts/evaluate",
            json={
                "user_id": "user1",
                "user_context": {"region": "北京"}
            }
        ).json()
        conflict_id = eval_result["conflict_id"]

        response = client.get(f"/api/conflicts/{conflict_id}/export")
        assert response.status_code == 200


class TestHealthAPI:
    def test_health_check(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "timestamp" in data
