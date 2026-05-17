import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from main import app
from models import Farmer, Plot, Project, GPSRecord, Confirmation, SettlementStatus

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture
def test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    farmer = Farmer(name="测试农户", phone="13800000000", id_card="11010119900000000", village="测试村")
    db.add(farmer)
    db.flush()
    
    plot = Plot(farmer_id=farmer.id, plot_code="TEST001", plot_name="测试地块1", location="测试区域", standard_area=10.0, land_type="水田")
    db.add(plot)
    db.flush()
    
    project = Project(project_code="TESTP001", project_name="测试作业", unit_price=50.0, unit="mu")
    db.add(project)
    db.flush()
    
    gps_record = GPSRecord(plot_id=plot.id, project_id=project.id, gps_area=10.0, batch_no="TESTBATCH")
    db.add(gps_record)
    db.flush()
    
    confirmation = Confirmation(plot_id=plot.id, farmer_id=farmer.id, project_id=project.id, confirmed_area=10.5, confirmed_by="测试确认员", batch_no="TESTBATCH")
    db.add(confirmation)
    
    db.commit()
    yield db
    db.rollback()
    db.close()
    Base.metadata.drop_all(bind=engine)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_create_farmer():
    response = client.post(
        "/farmers/",
        json={"name": "新农户", "phone": "13900000000", "id_card": "110101199012345678", "village": "新村"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "新农户"

def test_create_plot():
    farmer_response = client.post(
        "/farmers/",
        json={"name": "地块农户", "phone": "13700000000", "id_card": "110101199011111111", "village": "地块村"}
    )
    farmer_id = farmer_response.json()["id"]
    
    response = client.post(
        "/plots/",
        json={
            "farmer_id": farmer_id,
            "plot_code": "PLOT001",
            "plot_name": "新地块",
            "location": "新区",
            "standard_area": 15.0,
            "land_type": "旱地"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["plot_code"] == "PLOT001"

def test_create_project():
    response = client.post(
        "/projects/",
        json={
            "project_code": "PROJ001",
            "project_name": "测试项目",
            "unit_price": 60.0,
            "unit": "mu"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["project_code"] == "PROJ001"

def test_create_gps_record(test_db):
    farmer = test_db.query(Farmer).first()
    plot = test_db.query(Plot).first()
    project = test_db.query(Project).first()
    
    response = client.post(
        "/gps-records/",
        json={
            "plot_id": plot.id,
            "project_id": project.id,
            "gps_area": 12.5,
            "batch_no": "TESTBATCH2"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["gps_area"] == 12.5

def test_create_confirmation(test_db):
    farmer = test_db.query(Farmer).first()
    plot = test_db.query(Plot).first()
    project = test_db.query(Project).first()
    
    response = client.post(
        "/confirmations/",
        json={
            "plot_id": plot.id,
            "farmer_id": farmer.id,
            "project_id": project.id,
            "confirmed_area": 12.0,
            "confirmed_by": "测试员"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["confirmed_area"] == 12.0

def test_create_settlement_normal(test_db):
    farmer = test_db.query(Farmer).first()
    
    response = client.post(
        "/settlements/",
        json={
            "farmer_id": farmer.id,
            "notes": "测试结算"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "settlement_no" in data
    assert data["total_gps_area"] > 0

def test_create_settlement_with_duplicate(test_db):
    farmer = test_db.query(Farmer).first()
    plot = test_db.query(Plot).first()
    project = test_db.query(Project).first()
    
    for i in range(3):
        gps_record = GPSRecord(
            plot_id=plot.id,
            project_id=project.id,
            gps_area=10.0 + i * 0.01,
            batch_no="DUPTEST"
        )
        test_db.add(gps_record)
    test_db.commit()
    
    response = client.post(
        "/settlements/",
        json={
            "farmer_id": farmer.id,
            "notes": "重复地块测试结算"
        }
    )
    assert response.status_code == 200
    data = response.json()
    has_duplicate = any(item["is_duplicate"] for item in data["items"])
    assert has_duplicate is True

def test_list_settlements(test_db):
    farmer = test_db.query(Farmer).first()
    
    client.post(
        "/settlements/",
        json={"farmer_id": farmer.id, "notes": "结算1"}
    )
    client.post(
        "/settlements/",
        json={"farmer_id": farmer.id, "notes": "结算2"}
    )
    
    response = client.get("/settlements/")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2

def test_update_settlement_status(test_db):
    farmer = test_db.query(Farmer).first()
    
    settlement_response = client.post(
        "/settlements/",
        json={"farmer_id": farmer.id, "notes": "状态测试"}
    )
    settlement_id = settlement_response.json()["id"]
    
    response = client.put(
        f"/settlements/{settlement_id}/status",
        json={"status": "processing", "processed_by": "管理员", "notes": "开始处理"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "processing"

def test_cancel_settlement(test_db):
    farmer = test_db.query(Farmer).first()
    
    settlement_response = client.post(
        "/settlements/",
        json={"farmer_id": farmer.id, "notes": "取消测试"}
    )
    settlement_id = settlement_response.json()["id"]
    
    response = client.put(
        f"/settlements/{settlement_id}/cancel?processed_by=管理员&reason=测试取消"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "cancelled"

def test_export_settlement(test_db):
    farmer = test_db.query(Farmer).first()
    
    settlement_response = client.post(
        "/settlements/",
        json={"farmer_id": farmer.id, "notes": "导出测试"}
    )
    settlement_id = settlement_response.json()["id"]
    
    response = client.get(f"/settlements/{settlement_id}/export")
    assert response.status_code == 200
    data = response.json()
    assert "settlement_no" in data
    assert "farmer" in data
    assert "items" in data

def test_manual_correction(test_db):
    farmer = test_db.query(Farmer).first()
    plot = test_db.query(Plot).first()
    project = test_db.query(Project).first()
    
    gps_record = GPSRecord(plot_id=plot.id, project_id=project.id, gps_area=10.0)
    test_db.add(gps_record)
    test_db.flush()
    
    confirmation = Confirmation(
        plot_id=plot.id,
        farmer_id=farmer.id,
        project_id=project.id,
        confirmed_area=15.0,
        confirmed_by="测试员"
    )
    test_db.add(confirmation)
    test_db.commit()
    
    settlement_response = client.post(
        "/settlements/",
        json={"farmer_id": farmer.id, "notes": "修正测试"}
    )
    settlement_id = settlement_response.json()["id"]
    items = settlement_response.json()["items"]
    
    response = client.post(
        "/settlements/manual-correction",
        json={
            "settlement_id": settlement_id,
            "processed_by": "审核员",
            "corrections": [
                {"settlement_item_id": items[0]["id"], "final_area": 12.0, "notes": "人工修正面积"}
            ],
            "notes": "人工审核通过"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "confirmed"

def test_settlement_not_found():
    response = client.get("/settlements/99999")
    assert response.status_code == 404
