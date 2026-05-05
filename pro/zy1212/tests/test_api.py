import pytest
from fastapi.testclient import TestClient


class TestProjectAPI:
    def test_create_project_success(self, client: TestClient):
        response = client.post(
            "/api/v1/projects/",
            json={
                "name": "测试项目",
                "description": "这是一个测试项目",
                "service_name": "test-service",
                "environment": "staging",
            },
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "测试项目"
        assert data["service_name"] == "test-service"
        assert data["environment"] == "staging"
        assert data["id"] is not None
        
    def test_create_project_duplicate_name(self, client: TestClient):
        client.post(
            "/api/v1/projects/",
            json={
                "name": "重复项目",
                "service_name": "service1",
            },
        )
        
        response = client.post(
            "/api/v1/projects/",
            json={
                "name": "重复项目",
                "service_name": "service2",
            },
        )
        
        assert response.status_code == 400
        
    def test_create_project_validation_errors(self, client: TestClient):
        response = client.post(
            "/api/v1/projects/",
            json={
                "name": "",
                "service_name": "test",
            },
        )
        
        assert response.status_code == 422
        
    def test_list_projects(self, client: TestClient):
        for i in range(5):
            client.post(
                "/api/v1/projects/",
                json={
                    "name": f"项目 {i}",
                    "service_name": f"service-{i}",
                },
            )
        
        response = client.get("/api/v1/projects/")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert len(data["items"]) == 5
        
    def test_list_projects_pagination(self, client: TestClient):
        for i in range(15):
            client.post(
                "/api/v1/projects/",
                json={
                    "name": f"项目 {i}",
                    "service_name": f"service-{i}",
                },
            )
        
        response = client.get("/api/v1/projects/?skip=10&limit=5")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 15
        assert data["page"] == 3
        
    def test_get_project(self, client: TestClient):
        create_response = client.post(
            "/api/v1/projects/",
            json={
                "name": "获取测试",
                "service_name": "get-test",
            },
        )
        project_id = create_response.json()["id"]
        
        response = client.get(f"/api/v1/projects/{project_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "获取测试"
        
    def test_get_project_not_found(self, client: TestClient):
        response = client.get("/api/v1/projects/999999")
        assert response.status_code == 404
        
    def test_update_project(self, client: TestClient):
        create_response = client.post(
            "/api/v1/projects/",
            json={
                "name": "旧名称",
                "description": "旧描述",
                "service_name": "old-service",
            },
        )
        project_id = create_response.json()["id"]
        
        response = client.put(
            f"/api/v1/projects/{project_id}",
            json={
                "name": "新名称",
                "description": "新描述",
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "新名称"
        assert data["description"] == "新描述"
        assert data["service_name"] == "old-service"
        
    def test_delete_project(self, client: TestClient):
        create_response = client.post(
            "/api/v1/projects/",
            json={
                "name": "待删除",
                "service_name": "delete-test",
            },
        )
        project_id = create_response.json()["id"]
        
        response = client.delete(f"/api/v1/projects/{project_id}")
        assert response.status_code == 204
        
        get_response = client.get(f"/api/v1/projects/{project_id}")
        assert get_response.status_code == 404


class TestInterfaceAPI:
    def test_create_interface_success(self, client: TestClient):
        project_response = client.post(
            "/api/v1/projects/",
            json={
                "name": "接口测试项目",
                "service_name": "interface-test",
            },
        )
        project_id = project_response.json()["id"]
        
        response = client.post(
            f"/api/v1/projects/{project_id}/interfaces/",
            json={
                "name": "用户登录",
                "path": "/api/v1/auth/login",
                "method": "POST",
                "description": "用户登录接口",
                "tags": ["auth", "login"],
                "expected_qps": 1000,
                "expected_avg_latency_ms": 50,
            },
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "用户登录"
        assert data["path"] == "/api/v1/auth/login"
        assert data["method"] == "POST"
        
    def test_create_interface_validation_errors(self, client: TestClient):
        project_response = client.post(
            "/api/v1/projects/",
            json={
                "name": "测试项目",
                "service_name": "test",
            },
        )
        project_id = project_response.json()["id"]
        
        response = client.post(
            f"/api/v1/projects/{project_id}/interfaces/",
            json={
                "name": "无效路径",
                "path": "api/v1/test",
                "method": "GET",
            },
        )
        
        assert response.status_code == 422
        
        response2 = client.post(
            f"/api/v1/projects/{project_id}/interfaces/",
            json={
                "name": "无效方法",
                "path": "/api/v1/test",
                "method": "INVALID",
            },
        )
        
        assert response2.status_code == 422
        
    def test_batch_import_interfaces(self, client: TestClient):
        project_response = client.post(
            "/api/v1/projects/",
            json={
                "name": "批量导入项目",
                "service_name": "batch-import",
            },
        )
        project_id = project_response.json()["id"]
        
        response = client.post(
            f"/api/v1/projects/{project_id}/interfaces/batch-import",
            json={
                "interfaces": [
                    {
                        "name": "接口1",
                        "path": "/api/v1/1",
                        "method": "GET",
                    },
                    {
                        "name": "接口2",
                        "path": "/api/v1/2",
                        "method": "POST",
                    },
                ]
            },
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["imported_count"] == 2
        assert len(data["failed_items"]) == 0


class TestLoadTestBatchAPI:
    def test_create_batch_success(self, client: TestClient):
        project_response = client.post(
            "/api/v1/projects/",
            json={
                "name": "批次测试项目",
                "service_name": "batch-test",
            },
        )
        project_id = project_response.json()["id"]
        
        response = client.post(
            f"/api/v1/projects/{project_id}/load-test-batches/",
            json={
                "name": "V1.0.0 压测",
                "description": "第一轮压测",
                "test_type": "baseline",
                "status": "running",
                "qps": 500.0,
                "avg_response_time_ms": 100.0,
                "p50_response_time_ms": 80.0,
                "p95_response_time_ms": 200.0,
                "p99_response_time_ms": 400.0,
                "error_rate": 0.005,
                "is_baseline": True,
            },
        )
        
        assert response.status_code == 201
        
    def test_import_raw_data(self, client: TestClient):
        project_response = client.post(
            "/api/v1/projects/",
            json={
                "name": "原始数据测试",
                "service_name": "raw-data-test",
            },
        )
        project_id = project_response.json()["id"]
        
        response = client.post(
            f"/api/v1/projects/{project_id}/load-test-batches/import-raw",
            json={
                "name": "从原始数据导入",
                "description": "自动计算指标",
                "test_type": "regression",
                "raw_response_times": [50, 60, 70, 80, 90, 100, 150, 200, 300, 500],
                "duration_seconds": 60,
                "total_requests": 1000,
                "total_errors": 10,
                "bytes_sent": 1000000,
                "bytes_received": 5000000,
            },
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["qps"] > 0
        assert data["p50_response_time_ms"] > 0
        assert data["error_rate"] == 0.01


class TestHealthAndRoot:
    def test_root_endpoint(self, client: TestClient):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data
        assert "docs" in data
        
    def test_health_endpoint(self, client: TestClient):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}
