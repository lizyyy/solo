import pytest
from httpx import AsyncClient
from datetime import date, timedelta


pytestmark = pytest.mark.asyncio


async def create_test_work(client: AsyncClient, dryness: str = "dry", temp_zone: str = "mid", glaze: str = "lead_based"):
    today = date.today()
    response = await client.post(
        "/api/v1/works",
        json={
            "student_name": f"测试学员_{temp_zone}_{glaze}",
            "dryness_status": dryness,
            "glaze_type": glaze,
            "expected_pickup_date": (today + timedelta(days=7)).isoformat(),
            "temperature_zone": temp_zone
        }
    )
    return response.json()


async def create_test_session(client: AsyncClient, temp_zone: str = "mid", capacity: int = 50):
    today = date.today()
    response = await client.post(
        "/api/v1/kiln-sessions",
        json={
            "session_name": f"测试窑次_{temp_zone}",
            "target_temperature_zone": temp_zone,
            "scheduled_firing_date": (today + timedelta(days=2)).isoformat(),
            "max_capacity": capacity
        }
    )
    return response.json()


async def test_create_kiln_session(client: AsyncClient):
    today = date.today()
    response = await client.post(
        "/api/v1/kiln-sessions",
        json={
            "session_name": "测试窑次",
            "target_temperature_zone": "mid",
            "scheduled_firing_date": (today + timedelta(days=2)).isoformat(),
            "max_capacity": 50
        }
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["session_name"] == "测试窑次"
    assert data["is_fired"] == False
    assert data["current_load"] == 0


async def test_list_kiln_sessions(client: AsyncClient):
    today = date.today()
    
    for i in range(3):
        await client.post(
            "/api/v1/kiln-sessions",
            json={
                "session_name": f"窑次{i}",
                "target_temperature_zone": "mid",
                "scheduled_firing_date": (today + timedelta(days=i+1)).isoformat(),
                "max_capacity": 50
            }
        )
    
    response = await client.get("/api/v1/kiln-sessions")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3


async def test_validate_temperature_zone_conflict(client: AsyncClient):
    work = await create_test_work(client, temp_zone="mid")
    session = await create_test_session(client, temp_zone="high")
    
    response = await client.post(
        "/api/v1/kiln-sessions/load-work",
        json={
            "work_id": work["id"],
            "kiln_session_id": session["id"],
            "loading_order": 1
        }
    )
    
    assert response.status_code == 400
    error_detail = response.json()["detail"]
    assert "温区" in error_detail["message"] or any("温区" in e["message"] for e in error_detail.get("errors", []))


async def test_validate_not_dry_work(client: AsyncClient):
    work = await create_test_work(client, dryness="not_dry")
    session = await create_test_session(client, temp_zone="mid")
    
    response = await client.post(
        "/api/v1/kiln-sessions/load-work",
        json={
            "work_id": work["id"],
            "kiln_session_id": session["id"],
            "loading_order": 1
        }
    )
    
    assert response.status_code == 400


async def test_validate_glaze_incompatibility(client: AsyncClient):
    work1 = await create_test_work(client, glaze="lead_based")
    work2 = await create_test_work(client, glaze="copper_based")
    session = await create_test_session(client, temp_zone="mid")
    
    await client.post(
        "/api/v1/kiln-sessions/load-work",
        json={
            "work_id": work1["id"],
            "kiln_session_id": session["id"],
            "loading_order": 1
        }
    )
    
    response = await client.post(
        "/api/v1/kiln-sessions/load-work",
        json={
            "work_id": work2["id"],
            "kiln_session_id": session["id"],
            "loading_order": 2
        }
    )
    
    assert response.status_code == 400
    error_detail = response.json()["detail"]
    assert "釉料" in error_detail["message"] or any("釉料" in e["message"] for e in error_detail.get("errors", []))


async def test_validate_overload(client: AsyncClient):
    work1 = await create_test_work(client)
    work2 = await create_test_work(client)
    session = await create_test_session(client, capacity=1)
    
    response1 = await client.post(
        "/api/v1/kiln-sessions/load-work",
        json={
            "work_id": work1["id"],
            "kiln_session_id": session["id"],
            "loading_order": 1
        }
    )
    assert response1.status_code == 201
    
    response2 = await client.post(
        "/api/v1/kiln-sessions/load-work",
        json={
            "work_id": work2["id"],
            "kiln_session_id": session["id"],
            "loading_order": 2
        }
    )
    
    assert response2.status_code == 400


async def test_successful_load_work(client: AsyncClient):
    work = await create_test_work(client)
    session = await create_test_session(client)
    
    response = await client.post(
        "/api/v1/kiln-sessions/load-work",
        json={
            "work_id": work["id"],
            "kiln_session_id": session["id"],
            "loading_order": 1
        }
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["work_id"] == work["id"]
    assert data["kiln_session_id"] == session["id"]


async def test_start_firing(client: AsyncClient):
    work = await create_test_work(client)
    session = await create_test_session(client)
    
    await client.post(
        "/api/v1/kiln-sessions/load-work",
        json={
            "work_id": work["id"],
            "kiln_session_id": session["id"],
            "loading_order": 1
        }
    )
    
    response = await client.post(
        f"/api/v1/kiln-sessions/{session['id']}/start-firing"
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["firing_start_time"] is not None


async def test_start_firing_empty_session(client: AsyncClient):
    session = await create_test_session(client)
    
    response = await client.post(
        f"/api/v1/kiln-sessions/{session['id']}/start-firing"
    )
    
    assert response.status_code == 400


async def test_complete_firing(client: AsyncClient):
    work = await create_test_work(client)
    session = await create_test_session(client)
    
    await client.post(
        "/api/v1/kiln-sessions/load-work",
        json={
            "work_id": work["id"],
            "kiln_session_id": session["id"],
            "loading_order": 1
        }
    )
    
    await client.post(f"/api/v1/kiln-sessions/{session['id']}/start-firing")
    
    response = await client.post(
        f"/api/v1/kiln-sessions/{session['id']}/complete-firing",
        json={
            "firing_result": "success",
            "notes": "烧成效果良好"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["is_fired"] == True
    assert data["firing_result"] == "success"
    assert data["firing_end_time"] is not None


async def test_validate_session_consolidation(client: AsyncClient):
    work = await create_test_work(client)
    session = await create_test_session(client)
    
    await client.post(
        "/api/v1/kiln-sessions/load-work",
        json={
            "work_id": work["id"],
            "kiln_session_id": session["id"],
            "loading_order": 1
        }
    )
    
    response = await client.post(
        f"/api/v1/kiln-sessions/{session['id']}/validate"
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] == True
    assert len(data["errors"]) == 0
