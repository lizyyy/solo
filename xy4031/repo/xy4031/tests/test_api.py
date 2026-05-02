import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models import Base, BatteryPack
from app.core.database import get_db


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


class TestBatteryEndpoints:
    def test_create_battery(self, client):
        response = client.post("/batteries/", json={
            "battery_id": "BAT001",
            "name": "测试电池1号",
            "initial_cycles": 0,
            "cell_count": 6,
            "capacity_mah": 16000,
            "status": "active"
        })
        
        assert response.status_code == 201
        data = response.json()
        assert data["battery_id"] == "BAT001"
        assert data["name"] == "测试电池1号"
    
    def test_list_batteries(self, client, db_session):
        battery1 = BatteryPack(battery_id="BAT001", status="active")
        battery2 = BatteryPack(battery_id="BAT002", status="active")
        db_session.add_all([battery1, battery2])
        db_session.commit()
        
        response = client.get("/batteries/")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
    
    def test_get_battery_not_found(self, client):
        response = client.get("/batteries/NONEXISTENT")
        
        assert response.status_code == 404


class TestHealthEndpoint:
    def test_health_check(self, client):
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_root_endpoint(self, client):
        response = client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data
        assert "docs" in data


class TestReleaseCheckEndpoint:
    def test_release_check_with_invalid_battery(self, client):
        mission_date = (datetime.utcnow() + timedelta(days=1)).isoformat()
        
        response = client.post("/release-check/", json={
            "mission_date": mission_date,
            "min_temperature": 15.0,
            "expected_flights": 2,
            "battery_ids": ["NONEXISTENT"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]) == 1
        assert data["results"][0]["status"] == "禁止使用"
        assert any("BATTERY_NOT_FOUND" in h["rule_code"] for h in data["results"][0]["rule_hits"])
