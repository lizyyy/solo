#!/usr/bin/env python3
import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from database import init_db
import os


@pytest.fixture(autouse=True)
def setup_and_cleanup_db():
    if os.path.exists("marathon_supply.db"):
        os.remove("marathon_supply.db")
    init_db()
    yield
    if os.path.exists("marathon_supply.db"):
        os.remove("marathon_supply.db")


@pytest.mark.asyncio
async def test_root():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        assert "赛事补给" in response.json()["message"]


@pytest.mark.asyncio
async def test_create_station():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        data = {
            "name": "5公里测试站",
            "km_marker": 5.0,
            "type": "测试站",
            "max_capacity": 10000
        }
        response = await client.post("/api/stations/", json=data)
        assert response.status_code == 200
        result = response.json()
        assert result["name"] == "5公里测试站"
        assert result["km_marker"] == 5.0


@pytest.mark.asyncio
async def test_list_stations():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/stations/")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_create_race_config():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        data = {
            "race_name": "测试马拉松",
            "total_runners": 10000,
            "expected_dropout_rate": 0.05,
            "backup_ratio_water": 0.2,
            "backup_ratio_salt": 0.3,
            "backup_ratio_gel": 0.25
        }
        response = await client.post("/api/race-configs/", json=data)
        assert response.status_code == 200
        result = response.json()
        assert result["race_name"] == "测试马拉松"
        assert result["total_runners"] == 10000


@pytest.mark.asyncio
async def test_list_categories():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/categories/")
        assert response.status_code == 200
        categories = response.json()
        assert len(categories) >= 3
        names = [c["name"] for c in categories]
        assert "水" in names
        assert "盐丸" in names
        assert "能量胶" in names


@pytest.mark.asyncio
async def test_full_workflow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        config_response = await client.post("/api/race-configs/", json={
            "race_name": "完整流程测试",
            "total_runners": 5000,
            "expected_dropout_rate": 0.05,
            "backup_ratio_water": 0.2,
            "backup_ratio_salt": 0.3,
            "backup_ratio_gel": 0.25
        })
        config_id = config_response.json()["id"]
        
        station1 = await client.post("/api/stations/", json={
            "name": "测试站A",
            "km_marker": 10.0,
            "type": "测试",
            "max_capacity": 5000
        })
        station1_id = station1.json()["id"]
        
        station2 = await client.post("/api/stations/", json={
            "name": "测试站B",
            "km_marker": 15.0,
            "type": "测试",
            "max_capacity": 5000
        })
        station2_id = station2.json()["id"]
        
        categories = await client.get("/api/categories/")
        water_id = [c["id"] for c in categories.json() if c["name"] == "水"][0]
        
        await client.post("/api/supply-records/", json={
            "station_id": station1_id,
            "category_id": water_id,
            "allocated_quantity": 500
        })
        
        await client.post("/api/supply-records/", json={
            "station_id": station2_id,
            "category_id": water_id,
            "allocated_quantity": 100
        })
        
        calc_response = await client.post(f"/api/calculate/{config_id}")
        assert calc_response.status_code == 200
        result = calc_response.json()
        assert result["success"] == True
        assert result["total_gaps"] > 0
        
        gaps_response = await client.get("/api/gap-records/?status=open")
        gaps = gaps_response.json()
        assert len(gaps) > 0
        gap_id = gaps[0]["id"]
        
        advance_response = await client.post(f"/api/gap-records/{gap_id}/advance?handler=测试员")
        assert advance_response.status_code == 200
        assert advance_response.json()["new_status"] == "processing"
        
        update_response = await client.put(f"/api/gap-records/{gap_id}", json={
            "suggestion": "从A站调拨到B站",
            "conclusion": "已协调"
        })
        assert update_response.status_code == 200
        assert update_response.json()["suggestion"] == "从A站调拨到B站"
        
        close_response = await client.post(f"/api/gap-records/{gap_id}/close?handler=管理员&conclusion=测试完成")
        assert close_response.status_code == 200
        assert close_response.json()["success"] == True
        
        gaps_after = await client.get("/api/gap-records/?status=closed")
        assert len(gaps_after.json()) > 0


@pytest.mark.asyncio
async def test_gap_withdraw():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        config_response = await client.post("/api/race-configs/", json={
            "race_name": "撤回测试",
            "total_runners": 5000,
            "expected_dropout_rate": 0.05,
            "backup_ratio_water": 0.2,
            "backup_ratio_salt": 0.3,
            "backup_ratio_gel": 0.25
        })
        config_id = config_response.json()["id"]
        
        await client.post("/api/stations/", json={
            "name": "撤回测试站",
            "km_marker": 10.0,
            "type": "测试",
            "max_capacity": 5000
        })
        
        categories = await client.get("/api/categories/")
        water_id = [c["id"] for c in categories.json() if c["name"] == "水"][0]
        
        await client.post("/api/supply-records/", json={
            "station_id": 1,
            "category_id": water_id,
            "allocated_quantity": 100
        })
        
        await client.post(f"/api/calculate/{config_id}")
        
        gaps_response = await client.get("/api/gap-records/?status=open")
        gaps = gaps_response.json()
        
        if len(gaps) > 0:
            gap_id = gaps[0]["id"]
            withdraw_response = await client.post(f"/api/gap-records/{gap_id}/withdraw?handler=测试员&reason=数据有误")
            assert withdraw_response.status_code == 200
            assert withdraw_response.json()["success"] == True


@pytest.mark.asyncio
async def test_export_report():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        config_response = await client.post("/api/race-configs/", json={
            "race_name": "导出测试",
            "total_runners": 5000,
            "expected_dropout_rate": 0.05,
            "backup_ratio_water": 0.2,
            "backup_ratio_salt": 0.3,
            "backup_ratio_gel": 0.25
        })
        config_id = config_response.json()["id"]
        
        md_response = await client.get(f"/api/export/markdown/{config_id}")
        assert md_response.status_code == 200
        assert "补给调拨报告" in md_response.text
        
        json_response = await client.get(f"/api/export/json/{config_id}")
        assert json_response.status_code == 200
        data = json_response.json()
        assert "race_name" in data
        assert "gap_summary" in data


@pytest.mark.asyncio
async def test_csv_import():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        csv_content = """name,km_marker,type,max_capacity
CSV测试站1,5.0,普通站,10000
CSV测试站2,10.0,普通站,10000
"""
        files = {"file": ("test_stations.csv", csv_content, "text/csv")}
        response = await client.post("/api/import/stations/", files=files)
        assert response.status_code == 200
        result = response.json()
        assert result["success"] == True
        assert result["records_imported"] == 2


@pytest.mark.asyncio
async def test_exception_logs():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/exception-logs/")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_transfer_suggestions():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/transfer-suggestions/")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_update_supply_record():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/api/stations/", json={
            "name": "更新测试站",
            "km_marker": 5.0,
            "type": "测试",
            "max_capacity": 10000
        })
        
        categories = await client.get("/api/categories/")
        water_id = [c["id"] for c in categories.json() if c["name"] == "水"][0]
        
        create_response = await client.post("/api/supply-records/", json={
            "station_id": 1,
            "category_id": water_id,
            "allocated_quantity": 1000
        })
        record_id = create_response.json()["id"]
        
        update_response = await client.put(f"/api/supply-records/{record_id}", json={
            "allocated_quantity": 1500,
            "status": "confirmed"
        })
        assert update_response.status_code == 200
        assert update_response.json()["allocated_quantity"] == 1500
        assert update_response.json()["status"] == "confirmed"
