import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from main import app, Base, engine, SessionLocal, Vehicle, Salesperson, Customer, Appointment, Maintenance, ExceptionLog

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    yield db
    db.rollback()
    db.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client():
    return TestClient(app)

@pytest.fixture(scope="function")
def test_data(db_session):
    vehicle = Vehicle(plate_number="京A11111", model="Model Y", brand="Tesla", year=2023, current_mileage=1000.0)
    salesperson = Salesperson(name="张销售", phone="13800000001", employee_id="TEST001")
    customer = Customer(name="李客户", phone="13900000001", license_number="C11111111")
    db_session.add_all([vehicle, salesperson, customer])
    db_session.commit()
    return {"vehicle": vehicle, "salesperson": salesperson, "customer": customer}

def test_create_vehicle(client, db_session):
    response = client.post("/vehicles/", json={
        "plate_number": "京A22222",
        "model": "Model 3",
        "brand": "Tesla",
        "year": 2024,
        "current_mileage": 5000.0
    })
    assert response.status_code == 200
    data = response.json()
    assert data["plate_number"] == "京A22222"
    assert data["status"] == "available"

def test_create_appointment_success(client, db_session, test_data):
    tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
    end_time = (datetime.now() + timedelta(days=1, hours=1)).isoformat()
    response = client.post("/appointments/", json={
        "vehicle_id": test_data["vehicle"].id,
        "salesperson_id": test_data["salesperson"].id,
        "customer_id": test_data["customer"].id,
        "start_time": tomorrow,
        "end_time": end_time,
        "notes": "试驾测试"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "confirmed"

def test_create_appointment_conflict_overlap(client, db_session, test_data):
    tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
    end_time = (datetime.now() + timedelta(days=1, hours=1)).isoformat()
    client.post("/appointments/", json={
        "vehicle_id": test_data["vehicle"].id,
        "salesperson_id": test_data["salesperson"].id,
        "customer_id": test_data["customer"].id,
        "start_time": tomorrow,
        "end_time": end_time
    })
    response = client.post("/appointments/", json={
        "vehicle_id": test_data["vehicle"].id,
        "salesperson_id": test_data["salesperson"].id,
        "customer_id": test_data["customer"].id,
        "start_time": (datetime.now() + timedelta(days=1, minutes=30)).isoformat(),
        "end_time": (datetime.now() + timedelta(days=1, hours=1, minutes=30)).isoformat()
    })
    assert response.status_code == 409
    assert "冲突" in response.json()["detail"]["message"]

def test_appointment_status_flow(client, db_session, test_data):
    tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
    end_time = (datetime.now() + timedelta(days=1, hours=1)).isoformat()
    apt_response = client.post("/appointments/", json={
        "vehicle_id": test_data["vehicle"].id,
        "salesperson_id": test_data["salesperson"].id,
        "customer_id": test_data["customer"].id,
        "start_time": tomorrow,
        "end_time": end_time
    })
    apt_id = apt_response.json()["id"]
    response = client.patch(f"/appointments/{apt_id}/status?status=in_progress")
    assert response.status_code == 200
    db_session.refresh(test_data["vehicle"])
    assert test_data["vehicle"].status == "in_test_drive"
    response = client.post(f"/appointments/{apt_id}/archive-mileage?end_mileage=1050.0&recorded_by=测试员")
    assert response.status_code == 200
    db_session.refresh(test_data["vehicle"])
    assert test_data["vehicle"].status == "available"
    assert test_data["vehicle"].current_mileage == 1050.0
    apt = db_session.query(Appointment).filter(Appointment.id == apt_id).first()
    assert apt.status == "completed"

def test_cancel_appointment(client, db_session, test_data):
    tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
    end_time = (datetime.now() + timedelta(days=1, hours=1)).isoformat()
    apt_response = client.post("/appointments/", json={
        "vehicle_id": test_data["vehicle"].id,
        "salesperson_id": test_data["salesperson"].id,
        "customer_id": test_data["customer"].id,
        "start_time": tomorrow,
        "end_time": end_time
    })
    apt_id = apt_response.json()["id"]
    response = client.post(f"/appointments/{apt_id}/cancel?handler=测试员")
    assert response.status_code == 200
    apt = db_session.query(Appointment).filter(Appointment.id == apt_id).first()
    assert apt.status == "cancelled"
    vehicle = db_session.query(Vehicle).filter(Vehicle.id == test_data["vehicle"].id).first()
    assert vehicle.status == "available"

def test_manual_correction(client, db_session, test_data):
    tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
    end_time = (datetime.now() + timedelta(days=1, hours=1)).isoformat()
    apt_response = client.post("/appointments/", json={
        "vehicle_id": test_data["vehicle"].id,
        "salesperson_id": test_data["salesperson"].id,
        "customer_id": test_data["customer"].id,
        "start_time": tomorrow,
        "end_time": end_time
    })
    apt_id = apt_response.json()["id"]
    new_start = (datetime.now() + timedelta(days=2)).isoformat()
    new_end = (datetime.now() + timedelta(days=2, hours=1)).isoformat()
    response = client.post(f"/appointments/{apt_id}/correct", json={
        "handler": "店长",
        "conclusion": "客户改期",
        "new_start_time": new_start,
        "new_end_time": new_end,
        "new_status": "confirmed"
    })
    assert response.status_code == 200
    log = db_session.query(ExceptionLog).filter(ExceptionLog.appointment_id == apt_id).first()
    assert log is not None
    assert log.handler == "店长"
    assert log.conclusion == "客户改期"

def test_maintenance_conflict(client, db_session, test_data):
    maintenance_start = (datetime.now() + timedelta(days=1)).isoformat()
    maintenance_end = (datetime.now() + timedelta(days=1, hours=3)).isoformat()
    client.post("/maintenances/", json={
        "vehicle_id": test_data["vehicle"].id,
        "start_time": maintenance_start,
        "end_time": maintenance_end,
        "type": "常规保养"
    })
    response = client.post("/appointments/", json={
        "vehicle_id": test_data["vehicle"].id,
        "salesperson_id": test_data["salesperson"].id,
        "customer_id": test_data["customer"].id,
        "start_time": (datetime.now() + timedelta(days=1, hours=1)).isoformat(),
        "end_time": (datetime.now() + timedelta(days=1, hours=2)).isoformat()
    })
    assert response.status_code == 409
    assert "保养" in response.json()["detail"]["conflicts"][0]

def test_vehicle_lock_unlock(client, db_session, test_data):
    response = client.post(f"/vehicles/{test_data['vehicle'].id}/lock")
    assert response.status_code == 200
    db_session.refresh(test_data["vehicle"])
    assert test_data["vehicle"].status == "locked"
    response = client.post(f"/vehicles/{test_data['vehicle'].id}/unlock")
    assert response.status_code == 200
    db_session.refresh(test_data["vehicle"])
    assert test_data["vehicle"].status == "available"

def test_export_report_json(client, db_session, test_data):
    tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
    end_time = (datetime.now() + timedelta(days=1, hours=1)).isoformat()
    client.post("/appointments/", json={
        "vehicle_id": test_data["vehicle"].id,
        "salesperson_id": test_data["salesperson"].id,
        "customer_id": test_data["customer"].id,
        "start_time": tomorrow,
        "end_time": end_time
    })
    response = client.get("/reports/export?format=json")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert "vehicle" in data[0]

def test_exception_logs(client, db_session, test_data):
    vehicle = Vehicle(plate_number="京A33333", model="Model X", brand="Tesla", year=2024, current_mileage=2000.0, status="locked")
    db_session.add(vehicle)
    db_session.commit()
    tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
    end_time = (datetime.now() + timedelta(days=1, hours=1)).isoformat()
    response = client.post("/appointments/", json={
        "vehicle_id": vehicle.id,
        "salesperson_id": test_data["salesperson"].id,
        "customer_id": test_data["customer"].id,
        "start_time": tomorrow,
        "end_time": end_time
    })
    assert response.status_code == 409
    apt_id = response.json()["detail"]["appointment_id"]
    logs_response = client.get(f"/exception-logs/?appointment_id={apt_id}")
    assert logs_response.status_code == 200
    logs = logs_response.json()
    assert len(logs) >= 1
    assert logs[0]["handler"] == "system"

def test_list_appointments_with_filters(client, db_session, test_data):
    for i in range(3):
        start = (datetime.now() + timedelta(days=i+1)).isoformat()
        end = (datetime.now() + timedelta(days=i+1, hours=1)).isoformat()
        client.post("/appointments/", json={
            "vehicle_id": test_data["vehicle"].id,
            "salesperson_id": test_data["salesperson"].id,
            "customer_id": test_data["customer"].id,
            "start_time": start,
            "end_time": end
        })
    response = client.get("/appointments/")
    assert response.status_code == 200
    assert len(response.json()) == 3
    response = client.get(f"/appointments/?vehicle_id={test_data['vehicle'].id}")
    assert response.status_code == 200
    assert len(response.json()) == 3

def test_seed_data(client, db_session):
    response = client.post("/seed-data")
    assert response.status_code == 200
    data = response.json()
    assert data["vehicles"] == 2
    assert data["salespersons"] == 2
    assert data["customers"] == 2
