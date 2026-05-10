import pytest


@pytest.mark.asyncio
async def test_health_check(client):
    """测试健康检查"""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_root(client):
    """测试根路径"""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert "version" in data
    assert "docs" in data


@pytest.mark.asyncio
async def test_crud_race(client):
    """测试赛事 CRUD"""
    create_response = await client.post(
        "/api/v1/races/",
        json={
            "name": "测试马拉松",
            "description": "一场测试赛事",
            "race_date": "2026-05-15T08:00:00",
            "is_published": False,
        },
    )
    assert create_response.status_code == 201
    race_id = create_response.json()["id"]

    get_response = await client.get(f"/api/v1/races/{race_id}")
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "测试马拉松"

    list_response = await client.get("/api/v1/races/")
    assert list_response.status_code == 200
    assert len(list_response.json()) >= 1

    update_response = await client.put(
        f"/api/v1/races/{race_id}",
        json={"name": "更新后的测试马拉松"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "更新后的测试马拉松"

    publish_response = await client.post(f"/api/v1/races/{race_id}/publish")
    assert publish_response.status_code == 200
    assert publish_response.json()["is_published"] is True
