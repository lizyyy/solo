import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import date, timedelta
import json

from database import Base, get_db
from main import app

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
def test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


class TestEmployee:
    def test_create_employee(self, test_db):
        response = client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "department": "测试部",
                "position": "测试工程师",
                "status": "active"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["employee_id"] == "TEST001"
        assert data["name"] == "测试员工"

    def test_create_duplicate_employee(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        response = client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "重复员工",
                "status": "active"
            }
        )
        assert response.status_code == 400

    def test_get_employees(self, test_db):
        for i in range(3):
            client.post(
                "/employees/",
                json={
                    "employee_id": f"TEST00{i}",
                    "name": f"员工{i}",
                    "status": "active"
                }
            )
        response = client.get("/employees/")
        assert response.status_code == 200
        assert len(response.json()) == 3


class TestCertificate:
    def test_create_certificate_type(self, test_db):
        response = client.post(
            "/certificate-types/",
            json={
                "code": "CERT001",
                "name": "测试证书",
                "description": "测试用",
                "validity_period_months": 12
            }
        )
        assert response.status_code == 200
        assert response.json()["code"] == "CERT001"

    def test_create_employee_certificate(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        client.post(
            "/certificate-types/",
            json={
                "code": "CERT001",
                "name": "测试证书",
                "status": "active"
            }
        )
        today = date.today().isoformat()
        expiry = (date.today() + timedelta(days=365)).isoformat()
        response = client.post(
            "/employee-certificates/",
            json={
                "employee_id": 1,
                "certificate_type_id": 1,
                "certificate_number": "TESTCERT001",
                "issue_date": today,
                "expiry_date": expiry
            }
        )
        assert response.status_code == 200

    def test_expiring_certificates(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        client.post(
            "/certificate-types/",
            json={
                "code": "CERT001",
                "name": "测试证书",
                "status": "active"
            }
        )
        today = date.today().isoformat()
        expiry = (date.today() + timedelta(days=30)).isoformat()
        client.post(
            "/employee-certificates/",
            json={
                "employee_id": 1,
                "certificate_type_id": 1,
                "certificate_number": "TESTCERT001",
                "issue_date": today,
                "expiry_date": expiry
            }
        )
        response = client.get("/employee-certificates/expiring/?days=90")
        assert response.status_code == 200
        assert len(response.json()) >= 1


class TestCourseAndRetake:
    def test_create_passed_course_no_retake(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        response = client.post(
            "/course-scores/",
            json={
                "employee_id": 1,
                "course_code": "CS001",
                "course_name": "测试课程",
                "score": 85.0,
                "exam_date": date.today().isoformat()
            }
        )
        assert response.status_code == 200
        assert response.json()["status"] == "passed"

    def test_create_failed_course_with_retake(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        response = client.post(
            "/course-scores/",
            json={
                "employee_id": 1,
                "course_code": "CS001",
                "course_name": "测试课程",
                "score": 55.0,
                "exam_date": date.today().isoformat()
            }
        )
        assert response.status_code == 200
        assert response.json()["status"] == "failed"
        
        retake_response = client.get("/employees/TEST001/retakes/")
        assert retake_response.status_code == 200
        assert len(retake_response.json()) >= 1

    def test_update_retake_passed(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        client.post(
            "/course-scores/",
            json={
                "employee_id": 1,
                "course_code": "CS001",
                "course_name": "测试课程",
                "score": 55.0,
                "exam_date": date.today().isoformat()
            }
        )
        response = client.put(
            "/retake-records/1",
            json={
                "score": 75.0,
                "actual_date": date.today().isoformat()
            }
        )
        assert response.status_code == 200
        assert response.json()["status"] == "completed_passed"


class TestQualification:
    def test_create_position_requirement(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        response = client.post(
            "/position-requirements/",
            json={
                "employee_id": 1,
                "position_name": "测试岗位",
                "required_certificate_types": json.dumps(["CERT001"]),
                "required_courses": json.dumps(["CS001"])
            }
        )
        assert response.status_code == 200
        assert "qualification_match" in response.json()

    def test_evaluate_qualification_fully_matched(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        client.post(
            "/certificate-types/",
            json={
                "code": "CERT001",
                "name": "测试证书",
                "status": "active"
            }
        )
        expiry = (date.today() + timedelta(days=365)).isoformat()
        client.post(
            "/employee-certificates/",
            json={
                "employee_id": 1,
                "certificate_type_id": 1,
                "certificate_number": "TESTCERT001",
                "issue_date": date.today().isoformat(),
                "expiry_date": expiry
            }
        )
        client.post(
            "/course-scores/",
            json={
                "employee_id": 1,
                "course_code": "CS001",
                "course_name": "测试课程",
                "score": 85.0,
                "exam_date": date.today().isoformat()
            }
        )
        client.post(
            "/position-requirements/",
            json={
                "employee_id": 1,
                "position_name": "测试岗位",
                "required_certificate_types": json.dumps(["CERT001"]),
                "required_courses": json.dumps(["CS001"])
            }
        )
        response = client.put("/position-requirements/1/evaluate/")
        assert response.status_code == 200
        assert response.json()["qualification_match"] == "fully_matched"

    def test_qualification_recover_after_retake_passed(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        client.post(
            "/certificate-types/",
            json={
                "code": "CERT001",
                "name": "测试证书",
                "status": "active"
            }
        )
        expiry = (date.today() + timedelta(days=365)).isoformat()
        client.post(
            "/employee-certificates/",
            json={
                "employee_id": 1,
                "certificate_type_id": 1,
                "certificate_number": "TESTCERT001",
                "issue_date": date.today().isoformat(),
                "expiry_date": expiry
            }
        )
        client.post(
            "/course-scores/",
            json={
                "employee_id": 1,
                "course_code": "CS001",
                "course_name": "测试课程",
                "score": 55.0,
                "exam_date": date.today().isoformat()
            }
        )
        client.post(
            "/position-requirements/",
            json={
                "employee_id": 1,
                "position_name": "测试岗位",
                "required_certificate_types": json.dumps(["CERT001"]),
                "required_courses": json.dumps(["CS001"])
            }
        )
        
        initial_response = client.put("/position-requirements/1/evaluate/")
        assert initial_response.status_code == 200
        assert initial_response.json()["qualification_match"] == "partially_matched"
        
        client.put(
            "/retake-records/1",
            json={
                "score": 75.0,
                "actual_date": date.today().isoformat(),
                "status": "completed_passed"
            }
        )
        
        final_response = client.put("/position-requirements/1/evaluate/")
        assert final_response.status_code == 200
        assert final_response.json()["qualification_match"] == "fully_matched"
        
        match_details = json.loads(final_response.json()["match_details"])
        assert match_details["courses"][0]["pass_type"] == "retake"


class TestRenewal:
    def test_create_renewal_item(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        response = client.post(
            "/renewal-items/",
            json={
                "employee_id": 1,
                "renewal_batch": "BATCH001",
                "due_date": date.today().isoformat()
            }
        )
        assert response.status_code == 200
        assert response.json()["status"] == "pending"

    def test_idempotent_renewal_creation(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        client.post(
            "/certificate-types/",
            json={
                "code": "CERT001",
                "name": "测试证书",
                "status": "active"
            }
        )
        expiry = (date.today() + timedelta(days=365)).isoformat()
        client.post(
            "/employee-certificates/",
            json={
                "employee_id": 1,
                "certificate_type_id": 1,
                "certificate_number": "TESTCERT001",
                "issue_date": date.today().isoformat(),
                "expiry_date": expiry
            }
        )
        
        for _ in range(3):
            response = client.post(
                "/renewal-items/",
                json={
                    "employee_id": 1,
                    "employee_certificate_id": 1,
                    "renewal_batch": "BATCH001",
                    "due_date": date.today().isoformat()
                }
            )
            assert response.status_code == 200
        
        list_response = client.get("/renewal-items/?renewal_batch=BATCH001")
        assert len(list_response.json()) == 1

    def test_update_renewal_status(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        client.post(
            "/renewal-items/",
            json={
                "employee_id": 1,
                "renewal_batch": "BATCH001"
            }
        )
        response = client.put(
            "/renewal-items/1/status/?new_status=approved&operator=admin"
        )
        assert response.status_code == 200
        assert response.json()["status"] == "approved"

    def test_manual_correction(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        client.post(
            "/renewal-items/",
            json={
                "employee_id": 1,
                "renewal_batch": "BATCH001"
            }
        )
        response = client.post(
            "/renewal-items/1/manual-correction/",
            json={
                "operator": "HR_MANAGER",
                "original_status": "pending",
                "new_status": "approved",
                "reason": "特殊情况人工审批通过",
                "notes": "员工表现优异"
            }
        )
        assert response.status_code == 200
        assert response.json()["status"] == "approved"

    def test_withdraw_renewal(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        client.post(
            "/renewal-items/",
            json={
                "employee_id": 1,
                "renewal_batch": "BATCH001"
            }
        )
        response = client.put(
            "/renewal-items/1/withdraw/?operator=admin&reason=员工离职"
        )
        assert response.status_code == 200
        assert response.json()["status"] == "withdrawn"

    def test_close_renewal(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        client.post(
            "/renewal-items/",
            json={
                "employee_id": 1,
                "renewal_batch": "BATCH001"
            }
        )
        response = client.put(
            "/renewal-items/1/close/?operator=admin&reason=无需续期"
        )
        assert response.status_code == 200
        assert response.json()["status"] == "closed"

    def test_get_statistics(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        for i in range(3):
            client.post(
                "/renewal-items/",
                json={
                    "employee_id": 1,
                    "renewal_batch": f"BATCH00{i}"
                }
            )
        response = client.get("/renewal-items/statistics/")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "pending" in data

    def test_export_renewal_items(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        client.post(
            "/renewal-items/",
            json={
                "employee_id": 1,
                "renewal_batch": "BATCH001"
            }
        )
        response = client.get("/renewal-items/export/")
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers["content-type"]


class TestOperationLog:
    def test_operation_log_created_on_status_update(self, test_db):
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "status": "active"
            }
        )
        client.post(
            "/renewal-items/",
            json={
                "employee_id": 1,
                "renewal_batch": "BATCH001"
            }
        )
        client.put(
            "/renewal-items/1/status/?new_status=in_progress&operator=admin"
        )
        response = client.get("/operation-logs/?renewal_item_id=1")
        assert response.status_code == 200
        logs = response.json()
        assert len(logs) >= 1
        assert logs[0]["operation_type"] == "STATUS_UPDATE"
        assert logs[0]["operator"] == "admin"
