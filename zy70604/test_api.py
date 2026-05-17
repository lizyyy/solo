import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

from database import Base, get_db
from main import app
import models

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    try:
        coach1 = models.Coach(name="张教练", phone="13800138001", specialty="增肌")
        coach2 = models.Coach(name="李教练", phone="13800138002", specialty="减脂")
        db.add_all([coach1, coach2])
        db.commit()
        
        member = models.MemberCard(
            member_name="测试会员",
            member_phone="13900139001",
            card_number="TEST001",
            total_hours=48,
            used_hours=0,
            frozen_hours=0,
            remaining_hours=48
        )
        db.add(member)
        db.commit()
        
        package = models.CoursePackage(
            member_card_id=1,
            package_name="测试课程包",
            course_type="私教课",
            total_hours=48,
            used_hours=0,
            frozen_hours=0,
            remaining_hours=48,
            coach_id=1
        )
        db.add(package)
        db.commit()
        
        yield db
    finally:
        db.rollback()
        db.close()
        Base.metadata.drop_all(bind=engine)


def test_create_coach(db_session):
    response = client.post(
        "/coaches/",
        json={"name": "王教练", "phone": "13800138003", "specialty": "康复"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "王教练"
    assert data["phone"] == "13800138003"


def test_get_coaches(db_session):
    response = client.get("/coaches/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2


def test_create_member_card(db_session):
    response = client.post(
        "/member-cards/",
        json={
            "member_name": "新会员",
            "member_phone": "13900139002",
            "card_number": "TEST002",
            "total_hours": 24
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["member_name"] == "新会员"
    assert data["remaining_hours"] == 24


def test_create_booking(db_session):
    booking_date = (datetime.now() + timedelta(days=1)).isoformat()
    response = client.post(
        "/bookings/",
        json={
            "member_card_id": 1,
            "course_package_id": 1,
            "main_coach_id": 1,
            "booking_date": booking_date,
            "start_time": "10:00",
            "end_time": "11:00",
            "hours": 1,
            "created_by": "test"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "pending"


def test_confirm_booking(db_session):
    booking_date = (datetime.now() + timedelta(days=1)).isoformat()
    booking = client.post(
        "/bookings/",
        json={
            "member_card_id": 1,
            "course_package_id": 1,
            "main_coach_id": 1,
            "booking_date": booking_date,
            "start_time": "10:00",
            "end_time": "11:00",
            "hours": 1,
            "created_by": "test"
        }
    ).json()
    
    response = client.post(
        f"/bookings/{booking['id']}/confirm",
        params={"handler": "admin"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "confirmed"


def test_consume_booking(db_session):
    booking_date = (datetime.now() + timedelta(days=1)).isoformat()
    booking = client.post(
        "/bookings/",
        json={
            "member_card_id": 1,
            "course_package_id": 1,
            "main_coach_id": 1,
            "booking_date": booking_date,
            "start_time": "10:00",
            "end_time": "11:00",
            "hours": 1,
            "created_by": "test"
        }
    ).json()
    
    client.post(
        f"/bookings/{booking['id']}/confirm",
        params={"handler": "admin"}
    )
    
    response = client.post(
        f"/bookings/{booking['id']}/consume",
        params={"consumed_by": "admin", "notes": "正常消课"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "consumed"
    
    member = client.get("/member-cards/1").json()
    assert member["used_hours"] == 1
    assert member["remaining_hours"] == 47


def test_duplicate_consumption(db_session):
    booking_date = (datetime.now() + timedelta(days=1)).isoformat()
    booking = client.post(
        "/bookings/",
        json={
            "member_card_id": 1,
            "course_package_id": 1,
            "main_coach_id": 1,
            "booking_date": booking_date,
            "start_time": "10:00",
            "end_time": "11:00",
            "hours": 1,
            "created_by": "test"
        }
    ).json()
    
    client.post(
        f"/bookings/{booking['id']}/confirm",
        params={"handler": "admin"}
    )
    
    client.post(
        f"/bookings/{booking['id']}/consume",
        params={"consumed_by": "admin"}
    )
    
    response = client.post(
        f"/bookings/{booking['id']}/consume",
        params={"consumed_by": "admin"}
    )
    assert response.status_code == 400


def test_time_conflict(db_session):
    booking_date = (datetime.now() + timedelta(days=1)).isoformat()
    
    client.post(
        "/bookings/",
        json={
            "member_card_id": 1,
            "course_package_id": 1,
            "main_coach_id": 1,
            "booking_date": booking_date,
            "start_time": "10:00",
            "end_time": "11:00",
            "hours": 1,
            "created_by": "test"
        }
    )
    
    response = client.post(
        "/bookings/",
        json={
            "member_card_id": 1,
            "course_package_id": 1,
            "main_coach_id": 1,
            "booking_date": booking_date,
            "start_time": "10:30",
            "end_time": "11:30",
            "hours": 1,
            "created_by": "test"
        }
    )
    assert response.status_code == 400


def test_apply_leave(db_session):
    booking_date = (datetime.now() + timedelta(days=1)).isoformat()
    booking = client.post(
        "/bookings/",
        json={
            "member_card_id": 1,
            "course_package_id": 1,
            "main_coach_id": 1,
            "booking_date": booking_date,
            "start_time": "10:00",
            "end_time": "11:00",
            "hours": 1,
            "created_by": "test"
        }
    ).json()
    
    client.post(
        f"/bookings/{booking['id']}/confirm",
        params={"handler": "admin"}
    )
    
    response = client.post(
        "/leaves/",
        params={"handler": "member"},
        json={
            "booking_id": booking["id"],
            "reason": "身体不适",
            "freeze_hours": True
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "pending"


def test_approve_leave(db_session):
    booking_date = (datetime.now() + timedelta(days=1)).isoformat()
    booking = client.post(
        "/bookings/",
        json={
            "member_card_id": 1,
            "course_package_id": 1,
            "main_coach_id": 1,
            "booking_date": booking_date,
            "start_time": "10:00",
            "end_time": "11:00",
            "hours": 1,
            "created_by": "test"
        }
    ).json()
    
    client.post(
        f"/bookings/{booking['id']}/confirm",
        params={"handler": "admin"}
    )
    
    leave = client.post(
        "/leaves/",
        params={"handler": "member"},
        json={
            "booking_id": booking["id"],
            "reason": "身体不适",
            "freeze_hours": True
        }
    ).json()
    
    response = client.post(
        f"/leaves/{leave['id']}/approve",
        params={"handler": "admin"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "approved"
    
    member = client.get("/member-cards/1").json()
    assert member["frozen_hours"] == 1


def test_request_substitute(db_session):
    booking_date = (datetime.now() + timedelta(days=1)).isoformat()
    booking = client.post(
        "/bookings/",
        json={
            "member_card_id": 1,
            "course_package_id": 1,
            "main_coach_id": 1,
            "booking_date": booking_date,
            "start_time": "14:00",
            "end_time": "15:00",
            "hours": 1,
            "created_by": "test"
        }
    ).json()
    
    client.post(
        f"/bookings/{booking['id']}/confirm",
        params={"handler": "admin"}
    )
    
    response = client.post(
        "/substitutes/",
        params={"handler": "admin"},
        json={
            "booking_id": booking["id"],
            "substitute_coach_id": 2,
            "reason": "原教练有事"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "pending"


def test_confirm_substitute(db_session):
    booking_date = (datetime.now() + timedelta(days=1)).isoformat()
    booking = client.post(
        "/bookings/",
        json={
            "member_card_id": 1,
            "course_package_id": 1,
            "main_coach_id": 1,
            "booking_date": booking_date,
            "start_time": "14:00",
            "end_time": "15:00",
            "hours": 1,
            "created_by": "test"
        }
    ).json()
    
    client.post(
        f"/bookings/{booking['id']}/confirm",
        params={"handler": "admin"}
    )
    
    substitute = client.post(
        "/substitutes/",
        params={"handler": "admin"},
        json={
            "booking_id": booking["id"],
            "substitute_coach_id": 2,
            "reason": "原教练有事"
        }
    ).json()
    
    response = client.post(
        f"/substitutes/{substitute['id']}/confirm",
        params={"handler": "admin"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "confirmed"


def test_rollback_consumption(db_session):
    booking_date = (datetime.now() + timedelta(days=1)).isoformat()
    booking = client.post(
        "/bookings/",
        json={
            "member_card_id": 1,
            "course_package_id": 1,
            "main_coach_id": 1,
            "booking_date": booking_date,
            "start_time": "10:00",
            "end_time": "11:00",
            "hours": 1,
            "created_by": "test"
        }
    ).json()
    
    client.post(
        f"/bookings/{booking['id']}/confirm",
        params={"handler": "admin"}
    )
    
    client.post(
        f"/bookings/{booking['id']}/consume",
        params={"consumed_by": "admin"}
    )
    
    consumptions = client.get("/consumptions/").json()
    consumption_id = consumptions[0]["id"]
    
    response = client.post(
        f"/consumptions/{consumption_id}/rollback",
        params={"reason": "消课错误", "handler": "admin"}
    )
    assert response.status_code == 200
    
    member = client.get("/member-cards/1").json()
    assert member["used_hours"] == 0
    assert member["remaining_hours"] == 48


def test_manual_correction(db_session):
    response = client.post(
        "/manual-correction",
        json={
            "target_type": "member_card",
            "target_id": 1,
            "correction_type": "adjust_hours",
            "new_value": "10",
            "reason": "赠送课时",
            "handler": "admin"
        }
    )
    assert response.status_code == 200
    
    member = client.get("/member-cards/1").json()
    assert member["total_hours"] == 58
    assert member["remaining_hours"] == 58


def test_generate_report(db_session):
    booking_date = (datetime.now() + timedelta(days=1)).isoformat()
    booking = client.post(
        "/bookings/",
        json={
            "member_card_id": 1,
            "course_package_id": 1,
            "main_coach_id": 1,
            "booking_date": booking_date,
            "start_time": "10:00",
            "end_time": "11:00",
            "hours": 1,
            "created_by": "test"
        }
    ).json()
    
    client.post(
        f"/bookings/{booking['id']}/confirm",
        params={"handler": "admin"}
    )
    
    client.post(
        f"/bookings/{booking['id']}/consume",
        params={"consumed_by": "admin"}
    )
    
    response = client.post(
        "/report/",
        json={}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_records"] == 1
    assert data["total_hours"] == 1


def test_get_operation_logs(db_session):
    response = client.get("/operation-logs/")
    assert response.status_code == 200
