import pytest
from httpx import AsyncClient
from datetime import date, timedelta


pytestmark = pytest.mark.asyncio


async def create_delayed_work(client: AsyncClient, days_ago: int = 3):
    today = date.today()
    response = await client.post(
        "/api/v1/works",
        json={
            "student_name": f"延期学员_{days_ago}天前",
            "dryness_status": "dry",
            "glaze_type": "lead_based",
            "expected_pickup_date": (today - timedelta(days=days_ago)).isoformat(),
            "temperature_zone": "mid"
        }
    )
    return response.json()


async def create_future_work(client: AsyncClient, days_ahead: int = 7):
    today = date.today()
    response = await client.post(
        "/api/v1/works",
        json={
            "student_name": f"未来学员_{days_ahead}天后",
            "dryness_status": "dry",
            "glaze_type": "lead_based",
            "expected_pickup_date": (today + timedelta(days=days_ahead)).isoformat(),
            "temperature_zone": "mid"
        }
    )
    return response.json()


async def test_get_delayed_works_empty(client: AsyncClient):
    await create_future_work(client, days_ahead=7)
    
    response = await client.get("/api/v1/reports/delayed-works")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0


async def test_get_delayed_works_with_data(client: AsyncClient):
    await create_delayed_work(client, days_ago=3)
    await create_delayed_work(client, days_ago=5)
    await create_future_work(client, days_ahead=7)
    
    response = await client.get("/api/v1/reports/delayed-works")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    
    for work in data:
        assert work["is_delayed"] == True
        assert work["delay_days"] > 0


async def test_handover_report_generation(client: AsyncClient):
    await create_delayed_work(client, days_ago=2)
    await create_future_work(client, days_ahead=5)
    
    today = date.today()
    await client.post(
        "/api/v1/kiln-sessions",
        json={
            "session_name": "待安排窑次",
            "target_temperature_zone": "mid",
            "scheduled_firing_date": (today + timedelta(days=2)).isoformat(),
            "max_capacity": 50
        }
    )
    
    response = await client.get("/api/v1/reports/handover")
    assert response.status_code == 200
    
    content = response.text
    assert "# 陶艺工作室烧窑交接报告" in content
    assert "## 一、今日统计" in content
    assert "## 二、待安排窑次" in content
    assert "## 三、延期作品名单" in content
    assert "## 四、未干透作品" in content
    assert "## 五、近期已完成窑次" in content
    
    assert "总作品数" in content
    assert "未干透作品" in content


async def test_handover_report_with_fired_session(client: AsyncClient):
    work_response = await client.post(
        "/api/v1/works",
        json={
            "student_name": "烧成测试学员",
            "dryness_status": "dry",
            "glaze_type": "lead_based",
            "expected_pickup_date": (date.today() + timedelta(days=7)).isoformat(),
            "temperature_zone": "mid"
        }
    )
    work = work_response.json()
    
    session_response = await client.post(
        "/api/v1/kiln-sessions",
        json={
            "session_name": "已完成窑次",
            "target_temperature_zone": "mid",
            "scheduled_firing_date": (date.today() - timedelta(days=1)).isoformat(),
            "max_capacity": 50
        }
    )
    session = session_response.json()
    
    await client.post(
        "/api/v1/kiln-sessions/load-work",
        json={
            "work_id": work["id"],
            "kiln_session_id": session["id"],
            "loading_order": 1
        }
    )
    
    await client.post(f"/api/v1/kiln-sessions/{session['id']}/start-firing")
    
    await client.post(
        f"/api/v1/kiln-sessions/{session['id']}/complete-firing",
        json={
            "firing_result": "success",
            "notes": "测试烧成成功"
        }
    )
    
    response = await client.get("/api/v1/reports/handover")
    assert response.status_code == 200
    content = response.text
    
    assert "已完成窑次" in content
    assert "成功" in content


async def test_delayed_work_delay_days_calculation(client: AsyncClient):
    await create_delayed_work(client, days_ago=5)
    
    response = await client.get("/api/v1/reports/delayed-works")
    data = response.json()
    
    assert len(data) == 1
    assert data[0]["delay_days"] >= 5


async def test_handover_report_table_format(client: AsyncClient):
    await create_delayed_work(client, days_ago=3)
    
    response = await client.get("/api/v1/reports/handover")
    content = response.text
    
    assert "| 作品ID | 学员姓名 | 期望取件日 | 延期天数 | 干燥状态 | 温区 | 安排状态 |" in content
