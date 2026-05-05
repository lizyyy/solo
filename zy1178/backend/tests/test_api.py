import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


class TestProjectAPI:
    def test_create_project(self, client: TestClient):
        response = client.post(
            "/api/projects/",
            json={
                "name": "测试项目",
                "description": "这是一个测试项目",
                "location": "北京市",
                "latitude": 39.9042,
                "longitude": 116.4074
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "测试项目"
        assert data["id"] is not None
    
    def test_list_projects(self, client: TestClient):
        client.post(
            "/api/projects/",
            json={"name": "项目1"}
        )
        client.post(
            "/api/projects/",
            json={"name": "项目2"}
        )
        
        response = client.get("/api/projects/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
    
    def test_get_project(self, client: TestClient):
        create_response = client.post(
            "/api/projects/",
            json={"name": "测试获取项目"}
        )
        project_id = create_response.json()["id"]
        
        response = client.get(f"/api/projects/{project_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "测试获取项目"
    
    def test_get_nonexistent_project(self, client: TestClient):
        response = client.get("/api/projects/999999")
        assert response.status_code == 404
    
    def test_update_project(self, client: TestClient):
        create_response = client.post(
            "/api/projects/",
            json={"name": "旧名称", "description": "旧描述"}
        )
        project_id = create_response.json()["id"]
        
        update_response = client.put(
            f"/api/projects/{project_id}",
            json={"name": "新名称", "description": "新描述"}
        )
        
        assert update_response.status_code == 200
        assert update_response.json()["name"] == "新名称"
        assert update_response.json()["description"] == "新描述"
    
    def test_delete_project(self, client: TestClient):
        create_response = client.post(
            "/api/projects/",
            json={"name": "待删除项目"}
        )
        project_id = create_response.json()["id"]
        
        delete_response = client.delete(f"/api/projects/{project_id}")
        assert delete_response.status_code == 200
        
        get_response = client.get(f"/api/projects/{project_id}")
        assert get_response.status_code == 404


class TestRoofAPI:
    def test_create_roof(self, client: TestClient):
        project_response = client.post(
            "/api/projects/",
            json={"name": "屋顶测试项目"}
        )
        project_id = project_response.json()["id"]
        
        roof_response = client.post(
            "/api/projects/roofs/",
            json={
                "project_id": project_id,
                "name": "主屋顶",
                "coordinates": [
                    {"x": 0, "y": 0},
                    {"x": 20, "y": 0},
                    {"x": 20, "y": 15},
                    {"x": 0, "y": 15}
                ],
                "area": 300,
                "inclination": 0,
                "azimuth": 0
            }
        )
        
        assert roof_response.status_code == 200
        data = roof_response.json()
        assert data["area"] == 300
    
    def test_create_roof_invalid_project(self, client: TestClient):
        response = client.post(
            "/api/projects/roofs/",
            json={
                "project_id": 999999,
                "name": "无效屋顶",
                "coordinates": [{"x": 0, "y": 0}, {"x": 10, "y": 0}, {"x": 10, "y": 10}],
                "area": 100
            }
        )
        
        assert response.status_code == 404


class TestPanelAPI:
    def test_create_panel(self, client: TestClient):
        project_response = client.post(
            "/api/projects/",
            json={"name": "组件测试项目"}
        )
        project_id = project_response.json()["id"]
        
        panel_response = client.post(
            "/api/projects/panels/",
            json={
                "project_id": project_id,
                "model": "标准450W组件",
                "power": 450,
                "efficiency": 0.21,
                "width": 1.65,
                "height": 0.992,
                "temperature_coefficient": -0.38,
                "lifetime": 25,
                "degradation_rate": 0.5
            }
        )
        
        assert panel_response.status_code == 200
        data = panel_response.json()
        assert data["power"] == 450
        assert data["efficiency"] == 0.21


class TestLayoutAPI:
    def test_create_layout(self, client: TestClient):
        project_response = client.post(
            "/api/projects/",
            json={"name": "排布方案测试项目"}
        )
        project_id = project_response.json()["id"]
        
        layout_response = client.post(
            "/api/projects/layouts/",
            json={
                "project_id": project_id,
                "name": "方案1",
                "panel_positions": [
                    {"x": 1, "y": 1},
                    {"x": 3, "y": 1},
                    {"x": 1, "y": 3}
                ],
                "panel_count": 3,
                "total_power": 1350,
                "is_active": True
            }
        )
        
        assert layout_response.status_code == 200
        data = layout_response.json()
        assert data["panel_count"] == 3
        assert data["is_active"] == True


class TestHealthCheck:
    def test_health_check(self, client: TestClient):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
    
    def test_root_endpoint(self, client: TestClient):
        response = client.get("/")
        assert response.status_code == 200
        assert "message" in response.json()
