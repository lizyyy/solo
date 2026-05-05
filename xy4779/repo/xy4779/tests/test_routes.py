import pytest
from httpx import AsyncClient
from fastapi.testclient import TestClient
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import Base, engine, get_db, Service, Route
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture
def test_db():
    TEST_DATABASE_URL = "sqlite:///:memory:"
    
    test_engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    
    Base.metadata.create_all(bind=test_engine)
    
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    
    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()
    
    app.dependency_overrides[get_db] = override_get_db
    
    yield TestingSessionLocal
    
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def async_client():
    return AsyncClient(app=app, base_url="http://testserver")


class TestServiceCRUD:
    def test_create_service_success(self, client, test_db):
        service_data = {
            "name": "test-service",
            "routes": [
                {"path": "/users/{user_id}", "method": "GET", "order_index": 0},
                {"path": "/users/me", "method": "GET", "order_index": 1}
            ]
        }
        
        response = client.post("/services", json=service_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "test-service"
        assert len(data["routes"]) == 2
    
    def test_create_service_duplicate_name(self, client, test_db):
        service_data = {
            "name": "duplicate-service",
            "routes": [
                {"path": "/health", "method": "GET", "order_index": 0}
            ]
        }
        
        client.post("/services", json=service_data)
        response = client.post("/services", json=service_data)
        
        assert response.status_code == 400
        assert "已存在" in response.json()["detail"]
    
    def test_list_services(self, client, test_db):
        for i in range(3):
            service_data = {
                "name": f"service-{i}",
                "routes": [{"path": "/health", "method": "GET", "order_index": 0}]
            }
            client.post("/services", json=service_data)
        
        response = client.get("/services")
        
        assert response.status_code == 200
        assert len(response.json()) == 3
    
    def test_get_service(self, client, test_db):
        service_data = {
            "name": "get-test-service",
            "routes": [
                {"path": "/api/v1/users", "method": "GET", "order_index": 0},
                {"path": "/api/v1/posts", "method": "POST", "order_index": 1}
            ]
        }
        
        create_response = client.post("/services", json=service_data)
        service_id = create_response.json()["id"]
        
        get_response = client.get(f"/services/{service_id}")
        
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["name"] == "get-test-service"
        assert len(data["routes"]) == 2
    
    def test_get_service_not_found(self, client, test_db):
        response = client.get("/services/99999")
        
        assert response.status_code == 404
    
    def test_delete_service(self, client, test_db):
        service_data = {
            "name": "delete-test-service",
            "routes": [{"path": "/health", "method": "GET", "order_index": 0}]
        }
        
        create_response = client.post("/services", json=service_data)
        service_id = create_response.json()["id"]
        
        delete_response = client.delete(f"/services/{service_id}")
        
        assert delete_response.status_code == 204
        
        get_response = client.get(f"/services/{service_id}")
        assert get_response.status_code == 404


class TestHealthCheck:
    def test_health_check_dynamic_param_capture(self, client, test_db):
        service_data = {
            "name": "dynamic-capture-test",
            "routes": [
                {"path": "/users/{user_id}", "method": "GET", "order_index": 0},
                {"path": "/users/me", "method": "GET", "order_index": 1}
            ]
        }
        
        create_response = client.post("/services", json=service_data)
        service_id = create_response.json()["id"]
        
        health_response = client.post(f"/services/{service_id}/health-check")
        
        assert health_response.status_code == 201
        data = health_response.json()
        
        assert data["status"] == "completed"
        
        capture_issues = [
            i for i in data["issues"] 
            if i["issue_type"] == "dynamic_param_capture"
        ]
        
        assert len(capture_issues) > 0
        
        me_issue = next(
            (i for i in capture_issues if i["path"] == "/users/me"),
            None
        )
        assert me_issue is not None
        assert me_issue["severity"] == "critical"
    
    def test_health_check_duplicate_path(self, client, test_db):
        service_data = {
            "name": "duplicate-path-test",
            "routes": [
                {"path": "/api/health", "method": "GET", "order_index": 0},
                {"path": "/api/health", "method": "GET", "order_index": 1}
            ]
        }
        
        create_response = client.post("/services", json=service_data)
        service_id = create_response.json()["id"]
        
        health_response = client.post(f"/services/{service_id}/health-check")
        
        assert health_response.status_code == 201
        data = health_response.json()
        
        duplicate_issues = [
            i for i in data["issues"]
            if i["issue_type"] == "duplicate_path"
        ]
        
        assert len(duplicate_issues) > 0
    
    def test_health_check_method_conflict(self, client, test_db):
        service_data = {
            "name": "method-conflict-test",
            "routes": [
                {"path": "/orders/{id}", "method": "DELETE", "order_index": 0},
                {"path": "/orders/{id}", "method": "DELETE", "order_index": 1}
            ]
        }
        
        create_response = client.post("/services", json=service_data)
        service_id = create_response.json()["id"]
        
        health_response = client.post(f"/services/{service_id}/health-check")
        
        assert health_response.status_code == 201
        data = health_response.json()
        
        conflict_issues = [
            i for i in data["issues"]
            if i["issue_type"] == "method_conflict"
        ]
        
        assert len(conflict_issues) > 0
    
    def test_health_check_unreachable_route(self, client, test_db):
        service_data = {
            "name": "unreachable-test",
            "routes": [
                {"path": "/{any}", "method": "GET", "order_index": 0},
                {"path": "/specific", "method": "GET", "order_index": 1}
            ]
        }
        
        create_response = client.post("/services", json=service_data)
        service_id = create_response.json()["id"]
        
        health_response = client.post(f"/services/{service_id}/health-check")
        
        assert health_response.status_code == 201
        data = health_response.json()
        
        unreachable_issues = [
            i for i in data["issues"]
            if i["issue_type"] == "unreachable"
        ]
        
        assert len(unreachable_issues) > 0
    
    def test_health_check_healthy_service(self, client, test_db):
        service_data = {
            "name": "healthy-service",
            "routes": [
                {"path": "/users/me", "method": "GET", "order_index": 0},
                {"path": "/users/{user_id}", "method": "GET", "order_index": 1},
                {"path": "/reports/latest", "method": "GET", "order_index": 2},
                {"path": "/reports/{date}", "method": "GET", "order_index": 3}
            ]
        }
        
        create_response = client.post("/services", json=service_data)
        service_id = create_response.json()["id"]
        
        health_response = client.post(f"/services/{service_id}/health-check")
        
        assert health_response.status_code == 201
        data = health_response.json()
        
        assert data["status"] == "completed"
        assert len(data["issues"]) == 0
    
    def test_list_health_checks(self, client, test_db):
        service_data = {
            "name": "multi-check-service",
            "routes": [
                {"path": "/health", "method": "GET", "order_index": 0}
            ]
        }
        
        create_response = client.post("/services", json=service_data)
        service_id = create_response.json()["id"]
        
        for _ in range(3):
            client.post(f"/services/{service_id}/health-check")
        
        list_response = client.get(f"/services/{service_id}/health-checks")
        
        assert list_response.status_code == 200
        assert len(list_response.json()) == 3


class TestFixSuggestions:
    def test_get_fix_suggestions(self, client, test_db):
        service_data = {
            "name": "fix-suggestions-test",
            "routes": [
                {"path": "/users/{user_id}", "method": "GET", "order_index": 0},
                {"path": "/users/me", "method": "GET", "order_index": 1},
                {"path": "/reports/{date}", "method": "GET", "order_index": 2},
                {"path": "/reports/latest", "method": "GET", "order_index": 3}
            ]
        }
        
        create_response = client.post("/services", json=service_data)
        service_id = create_response.json()["id"]
        
        health_response = client.post(f"/services/{service_id}/health-check")
        health_check_id = health_response.json()["id"]
        
        suggestions_response = client.get(f"/health-checks/{health_check_id}/fix-suggestions")
        
        assert suggestions_response.status_code == 200
        suggestions = suggestions_response.json()
        
        assert len(suggestions) > 0
        
        for i, s in enumerate(suggestions[1:], 1):
            assert suggestions[i-1]["priority"] < s["priority"]


class TestExport:
    def test_export_json(self, client, test_db):
        service_data = {
            "name": "export-json-test",
            "routes": [
                {"path": "/users/{user_id}", "method": "GET", "order_index": 0},
                {"path": "/users/me", "method": "GET", "order_index": 1}
            ]
        }
        
        create_response = client.post("/services", json=service_data)
        service_id = create_response.json()["id"]
        
        health_response = client.post(f"/services/{service_id}/health-check")
        health_check_id = health_response.json()["id"]
        
        export_response = client.get(
            f"/health-checks/{health_check_id}/export",
            params={"format": "json"}
        )
        
        assert export_response.status_code == 200
        data = export_response.json()
        
        assert data["format"] == "json"
        
        content = json.loads(data["content"])
        assert "export_metadata" in content
        assert "service" in content
        assert "health_check" in content
    
    def test_export_markdown(self, client, test_db):
        service_data = {
            "name": "export-md-test",
            "routes": [
                {"path": "/users/{user_id}", "method": "GET", "order_index": 0},
                {"path": "/users/me", "method": "GET", "order_index": 1}
            ]
        }
        
        create_response = client.post("/services", json=service_data)
        service_id = create_response.json()["id"]
        
        health_response = client.post(f"/services/{service_id}/health-check")
        health_check_id = health_response.json()["id"]
        
        export_response = client.get(
            f"/health-checks/{health_check_id}/export",
            params={"format": "markdown"}
        )
        
        assert export_response.status_code == 200
        data = export_response.json()
        
        assert data["format"] == "markdown"
        assert "路由体检报告" in data["content"]
        assert "# " in data["content"]


class TestSummary:
    def test_get_health_check_summary(self, client, test_db):
        service_data = {
            "name": "summary-test",
            "routes": [
                {"path": "/users/{user_id}", "method": "GET", "order_index": 0},
                {"path": "/users/me", "method": "GET", "order_index": 1},
                {"path": "/reports/{date}", "method": "GET", "order_index": 2},
                {"path": "/reports/latest", "method": "GET", "order_index": 3}
            ]
        }
        
        create_response = client.post("/services", json=service_data)
        service_id = create_response.json()["id"]
        
        health_response = client.post(f"/services/{service_id}/health-check")
        health_check_id = health_response.json()["id"]
        
        summary_response = client.get(f"/health-checks/{health_check_id}/summary")
        
        assert summary_response.status_code == 200
        summary = summary_response.json()
        
        assert summary["service_name"] == "summary-test"
        assert summary["total_routes"] == 4
        assert summary["total_issues"] > 0
        assert summary["critical_issues"] > 0


class TestEdgeCases:
    def test_empty_routes_service(self, client, test_db):
        service_data = {
            "name": "empty-routes-service",
            "routes": []
        }
        
        create_response = client.post("/services", json=service_data)
        service_id = create_response.json()["id"]
        
        health_response = client.post(f"/services/{service_id}/health-check")
        
        assert health_response.status_code == 201
        data = health_response.json()
        assert len(data["issues"]) == 0
    
    def test_path_with_converters(self, client, test_db):
        service_data = {
            "name": "converter-test",
            "routes": [
                {"path": "/items/{item_id:int}", "method": "GET", "order_index": 0},
                {"path": "/items/search", "method": "GET", "order_index": 1}
            ]
        }
        
        create_response = client.post("/services", json=service_data)
        service_id = create_response.json()["id"]
        
        health_response = client.post(f"/services/{service_id}/health-check")
        
        assert health_response.status_code == 201
    
    def test_mixed_http_methods(self, client, test_db):
        service_data = {
            "name": "mixed-methods-test",
            "routes": [
                {"path": "/users", "method": "GET", "order_index": 0},
                {"path": "/users", "method": "POST", "order_index": 1},
                {"path": "/users/{id}", "method": "GET", "order_index": 2},
                {"path": "/users/new", "method": "GET", "order_index": 3}
            ]
        }
        
        create_response = client.post("/services", json=service_data)
        service_id = create_response.json()["id"]
        
        health_response = client.post(f"/services/{service_id}/health-check")
        
        assert health_response.status_code == 201
        data = health_response.json()
        
        capture_issues = [
            i for i in data["issues"]
            if i["issue_type"] == "dynamic_param_capture"
        ]
        
        assert len(capture_issues) > 0
        assert any(i["path"] == "/users/new" for i in capture_issues)
    
    def test_invalid_format_parameter(self, client, test_db):
        service_data = {
            "name": "invalid-format-test",
            "routes": [
                {"path": "/health", "method": "GET", "order_index": 0}
            ]
        }
        
        create_response = client.post("/services", json=service_data)
        service_id = create_response.json()["id"]
        
        health_response = client.post(f"/services/{service_id}/health-check")
        health_check_id = health_response.json()["id"]
        
        export_response = client.get(
            f"/health-checks/{health_check_id}/export",
            params={"format": "xml"}
        )
        
        assert export_response.status_code == 422
