import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
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
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def test_create_student(db_session):
    response = client.post(
        "/students/",
        json={"student_id": "2024001", "name": "测试学生", "grade": "2024级", "major": "计算机科学与技术"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["student_id"] == "2024001"
    assert data["name"] == "测试学生"


def test_create_activity_type(db_session):
    response = client.post(
        "/activity-types/",
        json={"code": "lecture", "name": "讲座", "max_credit": 2.0, "description": "学术讲座"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "lecture"
    assert data["name"] == "讲座"


def test_create_credit_application(db_session):
    client.post(
        "/students/",
        json={"student_id": "2024001", "name": "测试学生", "grade": "2024级", "major": "计算机科学与技术"},
    )
    client.post(
        "/activity-types/",
        json={"code": "lecture", "name": "讲座", "max_credit": 2.0, "description": "学术讲座"},
    )
    
    response = client.post(
        "/credit-applications/",
        json={
            "student_id": "2024001",
            "activity_type_code": "lecture",
            "activity_name": "测试讲座",
            "credit": 0.5,
            "proof_material": "test.pdf",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["activity_name"] == "测试讲座"
    assert data["credit"] == 0.5
    assert data["status"] == "pending"


def test_duplicate_application_rejection(db_session):
    client.post(
        "/students/",
        json={"student_id": "2024001", "name": "测试学生", "grade": "2024级", "major": "计算机科学与技术"},
    )
    client.post(
        "/activity-types/",
        json={"code": "lecture", "name": "讲座", "max_credit": 2.0, "description": "学术讲座"},
    )
    
    client.post(
        "/credit-applications/",
        json={
            "student_id": "2024001",
            "activity_type_code": "lecture",
            "activity_name": "重复讲座",
            "credit": 0.5,
        },
    )
    
    response = client.post(
        "/credit-applications/",
        json={
            "student_id": "2024001",
            "activity_type_code": "lecture",
            "activity_name": "重复讲座",
            "credit": 0.5,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "rejected"
    assert data["is_duplicate"] == True


def test_update_application_status(db_session):
    client.post(
        "/students/",
        json={"student_id": "2024001", "name": "测试学生", "grade": "2024级", "major": "计算机科学与技术"},
    )
    client.post(
        "/activity-types/",
        json={"code": "lecture", "name": "讲座", "max_credit": 2.0, "description": "学术讲座"},
    )
    
    app_response = client.post(
        "/credit-applications/",
        json={
            "student_id": "2024001",
            "activity_type_code": "lecture",
            "activity_name": "测试讲座",
            "credit": 0.5,
        },
    )
    app_id = app_response.json()["id"]
    
    response = client.put(
        f"/credit-applications/{app_id}/status",
        json={
            "new_status": "approved",
            "handler": "admin",
            "comment": "审核通过",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "approved"


def test_reject_application_with_reason(db_session):
    client.post(
        "/students/",
        json={"student_id": "2024001", "name": "测试学生", "grade": "2024级", "major": "计算机科学与技术"},
    )
    client.post(
        "/activity-types/",
        json={"code": "lecture", "name": "讲座", "max_credit": 2.0, "description": "学术讲座"},
    )
    
    app_response = client.post(
        "/credit-applications/",
        json={
            "student_id": "2024001",
            "activity_type_code": "lecture",
            "activity_name": "测试讲座",
            "credit": 0.5,
        },
    )
    app_id = app_response.json()["id"]
    
    response = client.put(
        f"/credit-applications/{app_id}/status",
        json={
            "new_status": "rejected",
            "handler": "admin",
            "comment": "材料不全",
            "rejection_reason": "证明材料不符合要求",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "rejected"


def test_manual_correction(db_session):
    client.post(
        "/students/",
        json={"student_id": "2024001", "name": "测试学生", "grade": "2024级", "major": "计算机科学与技术"},
    )
    client.post(
        "/activity-types/",
        json={"code": "lecture", "name": "讲座", "max_credit": 2.0, "description": "学术讲座"},
    )
    
    app_response = client.post(
        "/credit-applications/",
        json={
            "student_id": "2024001",
            "activity_type_code": "lecture",
            "activity_name": "测试讲座",
            "credit": 0.5,
        },
    )
    app_id = app_response.json()["id"]
    
    response = client.put(
        f"/credit-applications/{app_id}/manual-correction",
        json={
            "new_credit": 1.0,
            "handler": "admin",
            "comment": "根据实际参与时长调整",
            "original_input": "学生申诉：实际参与了完整讲座",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["credit"] == 1.0


def test_withdraw_application(db_session):
    client.post(
        "/students/",
        json={"student_id": "2024001", "name": "测试学生", "grade": "2024级", "major": "计算机科学与技术"},
    )
    client.post(
        "/activity-types/",
        json={"code": "lecture", "name": "讲座", "max_credit": 2.0, "description": "学术讲座"},
    )
    
    app_response = client.post(
        "/credit-applications/",
        json={
            "student_id": "2024001",
            "activity_type_code": "lecture",
            "activity_name": "测试讲座",
            "credit": 0.5,
        },
    )
    app_id = app_response.json()["id"]
    
    response = client.put(
        f"/credit-applications/{app_id}/withdraw?handler=student"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "withdrawn"


def test_credit_summary_with_cap(db_session):
    client.post(
        "/students/",
        json={"student_id": "2024001", "name": "测试学生", "grade": "2024级", "major": "计算机科学与技术"},
    )
    client.post(
        "/activity-types/",
        json={"code": "lecture", "name": "讲座", "max_credit": 1.0, "description": "学术讲座"},
    )
    
    for i in range(5):
        app_response = client.post(
            "/credit-applications/",
            json={
                "student_id": "2024001",
                "activity_type_code": "lecture",
                "activity_name": f"讲座{i}",
                "credit": 0.5,
            },
        )
        app_id = app_response.json()["id"]
        client.put(
            f"/credit-applications/{app_id}/status",
            json={"new_status": "approved", "handler": "admin"},
        )
    
    response = client.get("/students/2024001/credit-summary")
    assert response.status_code == 200
    data = response.json()
    assert data["lecture_credit"] == 1.0
    assert data["total_credit"] == 1.0


def test_generate_report(db_session):
    client.post(
        "/students/",
        json={"student_id": "2024001", "name": "测试学生", "grade": "2024级", "major": "计算机科学与技术"},
    )
    client.post(
        "/activity-types/",
        json={"code": "lecture", "name": "讲座", "max_credit": 2.0, "description": "学术讲座"},
    )
    
    app_response = client.post(
        "/credit-applications/",
        json={
            "student_id": "2024001",
            "activity_type_code": "lecture",
            "activity_name": "测试讲座",
            "credit": 0.5,
        },
    )
    app_id = app_response.json()["id"]
    client.put(
        f"/credit-applications/{app_id}/status",
        json={"new_status": "approved", "handler": "admin"},
    )
    
    response = client.post(
        "/credit-reports/",
        json={"student_id": "2024001", "generated_by": "admin"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_credit"] == 0.5
    assert len(data["details"]) > 0


def test_export_report(db_session):
    client.post(
        "/students/",
        json={"student_id": "2024001", "name": "测试学生", "grade": "2024级", "major": "计算机科学与技术"},
    )
    client.post(
        "/activity-types/",
        json={"code": "lecture", "name": "讲座", "max_credit": 2.0, "description": "学术讲座"},
    )
    
    app_response = client.post(
        "/credit-applications/",
        json={
            "student_id": "2024001",
            "activity_type_code": "lecture",
            "activity_name": "测试讲座",
            "credit": 0.5,
        },
    )
    app_id = app_response.json()["id"]
    client.put(
        f"/credit-applications/{app_id}/status",
        json={"new_status": "approved", "handler": "admin"},
    )
    
    report_response = client.post(
        "/credit-reports/",
        json={"student_id": "2024001", "generated_by": "admin"},
    )
    report_id = report_response.json()["id"]
    
    response = client.get(f"/credit-reports/{report_id}/export")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "二课学分报告" in response.text


def test_audit_logs(db_session):
    client.post(
        "/students/",
        json={"student_id": "2024001", "name": "测试学生", "grade": "2024级", "major": "计算机科学与技术"},
    )
    client.post(
        "/activity-types/",
        json={"code": "lecture", "name": "讲座", "max_credit": 2.0, "description": "学术讲座"},
    )
    
    app_response = client.post(
        "/credit-applications/",
        json={
            "student_id": "2024001",
            "activity_type_code": "lecture",
            "activity_name": "测试讲座",
            "credit": 0.5,
        },
    )
    app_id = app_response.json()["id"]
    
    client.put(
        f"/credit-applications/{app_id}/status",
        json={"new_status": "approved", "handler": "admin", "comment": "审核通过"},
    )
    
    response = client.get(f"/credit-applications/{app_id}/audit-logs")
    assert response.status_code == 200
    logs = response.json()
    assert len(logs) >= 2
    actions = [log["action"] for log in logs]
    assert "create" in actions
    assert "status_update" in actions
