import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session
import json

from app.models import TaskStatus, AnalysisTask
from app.schemas import TaskCreate, TaskUpdate


class TestTaskAPI:
    
    @pytest.mark.asyncio
    async def test_create_task_success(self, async_client: AsyncClient, test_db: Session):
        response = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "测试任务",
                "description": "这是一个测试任务",
                "config": {"key": "value"}
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["data"]["name"] == "测试任务"
        assert data["data"]["status"] == "pending"
    
    @pytest.mark.asyncio
    async def test_create_task_invalid_name(self, async_client: AsyncClient, test_db: Session):
        response = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "",
                "description": "无效的任务名称"
            }
        )
        
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_list_tasks(self, async_client: AsyncClient, test_db: Session):
        for i in range(5):
            await async_client.post(
                "/api/v1/tasks",
                json={
                    "name": f"任务 {i+1}",
                    "description": f"描述 {i+1}"
                }
            )
        
        response = await async_client.get("/api/v1/tasks?page=1&page_size=10")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["total"] == 5
        assert len(data["data"]["items"]) == 5
    
    @pytest.mark.asyncio
    async def test_get_task_success(self, async_client: AsyncClient, test_db: Session):
        create_response = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "获取测试任务",
                "description": "测试获取任务详情"
            }
        )
        task_id = create_response.json()["data"]["id"]
        
        response = await async_client.get(f"/api/v1/tasks/{task_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["name"] == "获取测试任务"
    
    @pytest.mark.asyncio
    async def test_get_task_not_found(self, async_client: AsyncClient, test_db: Session):
        response = await async_client.get("/api/v1/tasks/99999")
        
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_update_task_success(self, async_client: AsyncClient, test_db: Session):
        create_response = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "原始任务名称",
                "description": "原始描述"
            }
        )
        task_id = create_response.json()["data"]["id"]
        
        response = await async_client.put(
            f"/api/v1/tasks/{task_id}",
            json={
                "name": "更新后的任务名称",
                "description": "更新后的描述"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["name"] == "更新后的任务名称"
        assert data["data"]["description"] == "更新后的描述"
    
    @pytest.mark.asyncio
    async def test_delete_task_success(self, async_client: AsyncClient, test_db: Session):
        create_response = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "要删除的任务",
                "description": "这个任务将被删除"
            }
        )
        task_id = create_response.json()["data"]["id"]
        
        response = await async_client.delete(f"/api/v1/tasks/{task_id}")
        
        assert response.status_code == 200
        
        get_response = await async_client.get(f"/api/v1/tasks/{task_id}")
        assert get_response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_add_snapshot_success(self, async_client: AsyncClient, test_db: Session):
        create_response = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "快照测试任务",
                "description": "测试添加快照"
            }
        )
        task_id = create_response.json()["data"]["id"]
        
        response = await async_client.post(
            f"/api/v1/tasks/{task_id}/snapshots",
            json={
                "snapshot_type": "db_profile",
                "content": json.dumps({"max_connections": 100, "current_connections": 50}),
                "metadata": {"source": "test"}
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["data"]["snapshot_type"] == "db_profile"
    
    @pytest.mark.asyncio
    async def test_add_snapshot_invalid_type(self, async_client: AsyncClient, test_db: Session):
        create_response = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "测试任务",
                "description": "测试无效的快照类型"
            }
        )
        task_id = create_response.json()["data"]["id"]
        
        response = await async_client.post(
            f"/api/v1/tasks/{task_id}/snapshots",
            json={
                "snapshot_type": "invalid_type",
                "content": "test content"
            }
        )
        
        assert response.status_code == 400
