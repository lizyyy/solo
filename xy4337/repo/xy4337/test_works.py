import pytest
from httpx import AsyncClient
from datetime import date, timedelta


pytestmark = pytest.mark.asyncio


async def test_create_work_success(client: AsyncClient):
    today = date.today()
    response = await client.post(
        "/api/v1/works",
        json={
            "student_name": "测试学员",
            "work_description": "测试作品",
            "dryness_status": "dry",
            "glaze_type": "lead_based",
            "expected_pickup_date": (today + timedelta(days=7)).isoformat(),
            "temperature_zone": "mid"
        }
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["student_name"] == "测试学员"
    assert data["dryness_status"] == "dry"
    assert data["is_dry"] == True


async def test_create_work_missing_fields(client: AsyncClient):
    today = date.today()
    response = await client.post(
        "/api/v1/works",
        json={
            "student_name": "测试学员",
        }
    )
    
    assert response.status_code == 422


async def test_list_works(client: AsyncClient):
    today = date.today()
    
    for i in range(5):
        await client.post(
            "/api/v1/works",
            json={
                "student_name": f"学员{i}",
                "dryness_status": "dry",
                "glaze_type": "lead_based",
                "expected_pickup_date": (today + timedelta(days=7)).isoformat(),
                "temperature_zone": "mid"
            }
        )
    
    response = await client.get("/api/v1/works")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 5
    assert len(data["items"]) == 5


async def test_list_works_filter_by_dryness(client: AsyncClient):
    today = date.today()
    
    await client.post(
        "/api/v1/works",
        json={
            "student_name": "干燥学员",
            "dryness_status": "dry",
            "glaze_type": "lead_based",
            "expected_pickup_date": (today + timedelta(days=7)).isoformat(),
            "temperature_zone": "mid"
        }
    )
    
    await client.post(
        "/api/v1/works",
        json={
            "student_name": "未干燥学员",
            "dryness_status": "not_dry",
            "glaze_type": "lead_based",
            "expected_pickup_date": (today + timedelta(days=7)).isoformat(),
            "temperature_zone": "mid"
        }
    )
    
    response = await client.get("/api/v1/works?is_dry=true")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["student_name"] == "干燥学员"


async def test_get_work_by_id(client: AsyncClient):
    today = date.today()
    
    create_response = await client.post(
        "/api/v1/works",
        json={
            "student_name": "查询测试",
            "dryness_status": "dry",
            "glaze_type": "lead_based",
            "expected_pickup_date": (today + timedelta(days=7)).isoformat(),
            "temperature_zone": "mid"
        }
    )
    work_id = create_response.json()["id"]
    
    response = await client.get(f"/api/v1/works/{work_id}")
    assert response.status_code == 200
    assert response.json()["student_name"] == "查询测试"


async def test_get_work_not_found(client: AsyncClient):
    response = await client.get("/api/v1/works/999999")
    assert response.status_code == 404


async def test_update_work(client: AsyncClient):
    today = date.today()
    
    create_response = await client.post(
        "/api/v1/works",
        json={
            "student_name": "原姓名",
            "dryness_status": "not_dry",
            "glaze_type": "lead_based",
            "expected_pickup_date": (today + timedelta(days=7)).isoformat(),
            "temperature_zone": "mid"
        }
    )
    work_id = create_response.json()["id"]
    
    update_response = await client.put(
        f"/api/v1/works/{work_id}",
        json={
            "student_name": "新姓名",
            "dryness_status": "dry"
        }
    )
    
    assert update_response.status_code == 200
    updated_data = update_response.json()
    assert updated_data["student_name"] == "新姓名"
    assert updated_data["dryness_status"] == "dry"
    assert updated_data["is_dry"] == True


async def test_delete_work(client: AsyncClient):
    today = date.today()
    
    create_response = await client.post(
        "/api/v1/works",
        json={
            "student_name": "待删除",
            "dryness_status": "dry",
            "glaze_type": "lead_based",
            "expected_pickup_date": (today + timedelta(days=7)).isoformat(),
            "temperature_zone": "mid"
        }
    )
    work_id = create_response.json()["id"]
    
    delete_response = await client.delete(f"/api/v1/works/{work_id}")
    assert delete_response.status_code == 204
    
    get_response = await client.get(f"/api/v1/works/{work_id}")
    assert get_response.status_code == 404
