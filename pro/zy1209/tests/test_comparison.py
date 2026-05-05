import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session
import json


class TestComparisonAPI:
    
    @pytest.mark.asyncio
    async def test_compare_two_tasks(self, async_client: AsyncClient, test_db: Session):
        create1 = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "任务A - 优化前",
                "description": "优化前配置"
            }
        )
        task1_id = create1.json()["data"]["id"]
        
        await async_client.post(
            f"/api/v1/tasks/{task1_id}/snapshots",
            json={
                "snapshot_type": "db_profile",
                "content": json.dumps({
                    "max_connections": 100,
                    "current_connections": 95,
                    "wait_timeout": 100
                })
            }
        )
        
        await async_client.post(f"/api/v1/analysis/{task1_id}/run")
        
        create2 = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "任务B - 优化后",
                "description": "优化后配置"
            }
        )
        task2_id = create2.json()["data"]["id"]
        
        await async_client.post(
            f"/api/v1/tasks/{task2_id}/snapshots",
            json={
                "snapshot_type": "db_profile",
                "content": json.dumps({
                    "max_connections": 300,
                    "current_connections": 100,
                    "wait_timeout": 28800
                })
            }
        )
        
        await async_client.post(f"/api/v1/analysis/{task2_id}/run")
        
        response = await async_client.post(
            "/api/v1/comparisons",
            json={
                "task_ids": [task1_id, task2_id],
                "include_metrics": True,
                "include_recommendations": True
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "comparison_id" in data["data"]
        assert len(data["data"]["task_ids"]) == 2
        assert "summary" in data["data"]
    
    @pytest.mark.asyncio
    async def test_compare_single_task(self, async_client: AsyncClient, test_db: Session):
        response = await async_client.post(
            "/api/v1/comparisons",
            json={
                "task_ids": [1],
                "include_metrics": True
            }
        )
        
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_get_best_task(self, async_client: AsyncClient, test_db: Session):
        create1 = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "任务1",
                "description": "较差配置"
            }
        )
        task1_id = create1.json()["data"]["id"]
        
        await async_client.post(
            f"/api/v1/tasks/{task1_id}/snapshots",
            json={
                "snapshot_type": "db_profile",
                "content": json.dumps({
                    "max_connections": 100,
                    "current_connections": 95,
                    "wait_timeout": 50
                })
            }
        )
        
        await async_client.post(f"/api/v1/analysis/{task1_id}/run")
        
        create2 = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "任务2",
                "description": "较好配置"
            }
        )
        task2_id = create2.json()["data"]["id"]
        
        await async_client.post(
            f"/api/v1/tasks/{task2_id}/snapshots",
            json={
                "snapshot_type": "db_profile",
                "content": json.dumps({
                    "max_connections": 200,
                    "current_connections": 50,
                    "wait_timeout": 28800
                })
            }
        )
        
        await async_client.post(f"/api/v1/analysis/{task2_id}/run")
        
        response = await async_client.get(
            f"/api/v1/comparisons/best?task_ids={task1_id}&task_ids={task2_id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "has_best" in data["data"]
