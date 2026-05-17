import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import json

from main import app, get_db
from database import Base
import models

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_attendance.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    del app.dependency_overrides[get_db]


def test_create_student(client):
    response = client.post(
        "/api/students/",
        json={"student_id": "S001", "name": "张三", "email": "zhangsan@example.com"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["student_id"] == "S001"
    assert data["name"] == "张三"


def test_create_session(client):
    response = client.post(
        "/api/sessions/",
        json={
            "session_code": "CLASS001",
            "course_name": "Python基础班",
            "session_date": datetime.now().isoformat(),
            "total_hours": 4.0
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["session_code"] == "CLASS001"


def test_create_attendance(client):
    client.post(
        "/api/students/",
        json={"student_id": "S001", "name": "张三"}
    )
    client.post(
        "/api/sessions/",
        json={
            "session_code": "CLASS001",
            "course_name": "Python基础班",
            "session_date": datetime.now().isoformat(),
            "total_hours": 4.0
        }
    )
    
    response = client.post(
        "/api/attendance/",
        json={
            "session_code": "CLASS001",
            "student_id": "S001",
            "sign_in_time": datetime.now().isoformat(),
            "sign_out_time": (datetime.now() + timedelta(hours=4)).isoformat(),
            "status": "present",
            "source": "machine"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["student_id"] == "S001"


def test_create_makeup(client):
    client.post(
        "/api/students/",
        json={"student_id": "S001", "name": "张三"}
    )
    client.post(
        "/api/sessions/",
        json={
            "session_code": "CLASS001",
            "course_name": "Python基础班",
            "session_date": datetime.now().isoformat(),
            "total_hours": 4.0
        }
    )
    
    response = client.post(
        "/api/makeup/",
        json={
            "session_code": "CLASS001",
            "student_id": "S001",
            "teacher_id": "T001",
            "teacher_name": "王老师",
            "reason": "学员生病请假",
            "sign_date": datetime.now().isoformat(),
            "status": "pending"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["student_id"] == "S001"


def test_conflict_detection(client, db):
    client.post(
        "/api/students/",
        json={"student_id": "S001", "name": "张三"}
    )
    client.post(
        "/api/sessions/",
        json={
            "session_code": "CLASS001",
            "course_name": "Python基础班",
            "session_date": datetime.now().isoformat(),
            "total_hours": 4.0
        }
    )
    
    client.post(
        "/api/attendance/",
        json={
            "session_code": "CLASS001",
            "student_id": "S001",
            "sign_in_time": datetime.now().isoformat(),
            "sign_out_time": (datetime.now() + timedelta(hours=4)).isoformat(),
            "status": "absent",
            "source": "machine"
        }
    )
    
    client.post(
        "/api/makeup/",
        json={
            "session_code": "CLASS001",
            "student_id": "S001",
            "teacher_id": "T001",
            "teacher_name": "王老师",
            "reason": "学员生病请假",
            "sign_date": datetime.now().isoformat(),
            "status": "pending"
        }
    )
    
    conflicts = db.query(models.ConflictRecord).all()
    assert len(conflicts) > 0
    assert conflicts[0].conflict_type == "absent_vs_makeup"


def test_resolve_conflict(client, db):
    client.post(
        "/api/students/",
        json={"student_id": "S001", "name": "张三"}
    )
    client.post(
        "/api/sessions/",
        json={
            "session_code": "CLASS001",
            "course_name": "Python基础班",
            "session_date": datetime.now().isoformat(),
            "total_hours": 4.0
        }
    )
    
    client.post(
        "/api/attendance/",
        json={
            "session_code": "CLASS001",
            "student_id": "S001",
            "sign_in_time": datetime.now().isoformat(),
            "sign_out_time": (datetime.now() + timedelta(hours=4)).isoformat(),
            "status": "absent",
            "source": "machine"
        }
    )
    
    client.post(
        "/api/makeup/",
        json={
            "session_code": "CLASS001",
            "student_id": "S001",
            "teacher_id": "T001",
            "teacher_name": "王老师",
            "reason": "学员生病请假",
            "sign_date": datetime.now().isoformat(),
            "status": "pending"
        }
    )
    
    conflict = db.query(models.ConflictRecord).first()
    assert conflict is not None
    
    response = client.put(
        f"/api/conflicts/{conflict.id}/resolve",
        json={
            "resolved_by": "管理员",
            "resolution": "同意补签",
            "choose_makeup": True
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "resolved"


def test_merge_records(client):
    client.post(
        "/api/students/",
        json={"student_id": "S001", "name": "张三"}
    )
    client.post(
        "/api/sessions/",
        json={
            "session_code": "CLASS001",
            "course_name": "Python基础班",
            "session_date": datetime.now().isoformat(),
            "total_hours": 4.0
        }
    )
    
    client.post(
        "/api/attendance/",
        json={
            "session_code": "CLASS001",
            "student_id": "S001",
            "sign_in_time": datetime.now().isoformat(),
            "sign_out_time": (datetime.now() + timedelta(hours=4)).isoformat(),
            "status": "present",
            "source": "machine"
        }
    )
    
    response = client.post(
        "/api/merge/",
        params={"session_code": "CLASS001", "student_id": "S001"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["student_id"] == "S001"


def test_attendance_stats(client):
    for i in range(3):
        client.post(
            f"/api/students/",
            json={"student_id": f"S00{i+1}", "name": f"学生{i+1}"}
        )
    
    for i in range(5):
        client.post(
            f"/api/sessions/",
            json={
                "session_code": f"CLASS00{i+1}",
                "course_name": "Python基础班",
                "session_date": (datetime.now() - timedelta(days=i)).isoformat(),
                "total_hours": 4.0
            }
        )
    
    response = client.get("/api/stats/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_graduation_report(client):
    client.post(
        "/api/students/",
        json={"student_id": "S001", "name": "张三"}
    )
    for i in range(5):
        client.post(
            f"/api/sessions/",
            json={
                "session_code": f"CLASS00{i+1}",
                "course_name": "Python基础班",
                "session_date": (datetime.now() - timedelta(days=i)).isoformat(),
                "total_hours": 4.0
            }
        )
    
    for i in range(4):
        client.post(
            "/api/attendance/",
            json={
                "session_code": f"CLASS00{i+1}",
                "student_id": "S001",
                "sign_in_time": datetime.now().isoformat(),
                "sign_out_time": (datetime.now() + timedelta(hours=4)).isoformat(),
                "status": "present",
                "source": "machine"
            }
        )
    
    response = client.post(
        "/api/graduation-report/",
        json={"generated_by": "管理员"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_withdraw_makeup(client, db):
    client.post(
        "/api/students/",
        json={"student_id": "S001", "name": "张三"}
    )
    client.post(
        "/api/sessions/",
        json={
            "session_code": "CLASS001",
            "course_name": "Python基础班",
            "session_date": datetime.now().isoformat(),
            "total_hours": 4.0
        }
    )
    
    client.post(
        "/api/makeup/",
        json={
            "session_code": "CLASS001",
            "student_id": "S001",
            "teacher_id": "T001",
            "teacher_name": "王老师",
            "reason": "学员生病请假",
            "sign_date": datetime.now().isoformat(),
            "status": "pending"
        }
    )
    
    makeup = db.query(models.MakeUpSign).first()
    assert makeup is not None
    
    response = client.put(f"/api/makeup/{makeup.id}/withdraw")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "withdrawn"


def test_export_data(client):
    response = client.post(
        "/api/export/",
        json={"export_format": "json"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "attendance_stats" in data


def test_exception_logs(client, db):
    client.post(
        "/api/students/",
        json={"student_id": "S001", "name": "张三"}
    )
    
    try:
        client.post(
            "/api/students/",
            json={"student_id": "S001", "name": "重复"}
        )
    except:
        pass
    
    response = client.get("/api/exception-logs/")
    assert response.status_code == 200


def test_pending_conflicts(client):
    client.post(
        "/api/students/",
        json={"student_id": "S001", "name": "张三"}
    )
    client.post(
        "/api/sessions/",
        json={
            "session_code": "CLASS001",
            "course_name": "Python基础班",
            "session_date": datetime.now().isoformat(),
            "total_hours": 4.0
        }
    )
    
    client.post(
        "/api/attendance/",
        json={
            "session_code": "CLASS001",
            "student_id": "S001",
            "sign_in_time": datetime.now().isoformat(),
            "sign_out_time": (datetime.now() + timedelta(hours=4)).isoformat(),
            "status": "absent",
            "source": "machine"
        }
    )
    
    client.post(
        "/api/makeup/",
        json={
            "session_code": "CLASS001",
            "student_id": "S001",
            "teacher_id": "T001",
            "teacher_name": "王老师",
            "reason": "学员生病请假",
            "sign_date": datetime.now().isoformat(),
            "status": "pending"
        }
    )
    
    response = client.get("/api/conflicts/pending")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
