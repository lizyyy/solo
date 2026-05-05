import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session
import json
import os

from app.models.enums import ExportFormat


class TestExportAPI:
    
    @pytest.mark.asyncio
    async def test_export_json(self, async_client: AsyncClient, test_db: Session):
        create_response = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "导出测试任务",
                "description": "测试导出功能"
            }
        )
        task_id = create_response.json()["data"]["id"]
        
        await async_client.post(
            f"/api/v1/tasks/{task_id}/snapshots",
            json={
                "snapshot_type": "db_profile",
                "content": json.dumps({
                    "max_connections": 100,
                    "current_connections": 80
                })
            }
        )
        
        await async_client.post(f"/api/v1/analysis/{task_id}/run")
        
        export_response = await async_client.post(
            "/api/v1/exports",
            json={
                "task_id": task_id,
                "format": "json",
                "include_metrics": True,
                "include_recommendations": True
            }
        )
        
        assert export_response.status_code == 201
        data = export_response.json()
        assert data["success"] is True
        assert data["data"]["format"] == "json"
        assert data["data"]["file_size"] > 0
    
    @pytest.mark.asyncio
    async def test_export_markdown(self, async_client: AsyncClient, test_db: Session):
        create_response = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "Markdown导出测试",
                "description": "测试Markdown导出"
            }
        )
        task_id = create_response.json()["data"]["id"]
        
        await async_client.post(
            f"/api/v1/tasks/{task_id}/snapshots",
            json={
                "snapshot_type": "db_profile",
                "content": json.dumps({
                    "max_connections": 150,
                    "current_connections": 140
                })
            }
        )
        
        await async_client.post(f"/api/v1/analysis/{task_id}/run")
        
        export_response = await async_client.post(
            "/api/v1/exports",
            json={
                "task_id": task_id,
                "format": "markdown"
            }
        )
        
        assert export_response.status_code == 201
        data = export_response.json()
        assert data["success"] is True
        assert data["data"]["format"] == "markdown"
    
    @pytest.mark.asyncio
    async def test_list_exports(self, async_client: AsyncClient, test_db: Session):
        create_response = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "导出列表测试",
                "description": "测试获取导出列表"
            }
        )
        task_id = create_response.json()["data"]["id"]
        
        await async_client.post(
            f"/api/v1/tasks/{task_id}/snapshots",
            json={
                "snapshot_type": "db_profile",
                "content": json.dumps({"max_connections": 100})
            }
        )
        
        await async_client.post(f"/api/v1/analysis/{task_id}/run")
        
        await async_client.post(
            "/api/v1/exports",
            json={
                "task_id": task_id,
                "format": "json"
            }
        )
        
        await async_client.post(
            "/api/v1/exports",
            json={
                "task_id": task_id,
                "format": "markdown"
            }
        )
        
        list_response = await async_client.get("/api/v1/exports?page=1&page_size=10")
        
        assert list_response.status_code == 200
        data = list_response.json()
        assert data["success"] is True
        assert data["data"]["total"] == 2
    
    @pytest.mark.asyncio
    async def test_export_invalid_task(self, async_client: AsyncClient, test_db: Session):
        response = await async_client.post(
            "/api/v1/exports",
            json={
                "task_id": 99999,
                "format": "json"
            }
        )
        
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_export_task_not_completed(self, async_client: AsyncClient, test_db: Session):
        create_response = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "未完成任务",
                "description": "测试导出未完成的任务"
            }
        )
        task_id = create_response.json()["data"]["id"]
        
        response = await async_client.post(
            "/api/v1/exports",
            json={
                "task_id": task_id,
                "format": "json"
            }
        )
        
        assert response.status_code == 400
