import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import json
import io
import pandas as pd

from main import app
from database import Base, get_db
from cleaning_service import validate_passport, validate_phone, normalize_phone, normalize_passport


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


class TestValidationFunctions:
    def test_validate_passport_valid(self):
        valid_passports = ['E12345678', 'A98765432', 'AB12345678']
        for passport in valid_passports:
            is_valid, msg = validate_passport(passport)
            assert is_valid, f"Passport {passport} should be valid"

    def test_validate_passport_invalid(self):
        invalid_passports = ['12345', '', 'E1234567', 'ABCDEFGHIJ']
        for passport in invalid_passports:
            is_valid, msg = validate_passport(passport)
            assert not is_valid, f"Passport {passport} should be invalid"

    def test_validate_phone_valid(self):
        valid_phones = ['13800138000', '15912345678', '+8613800138000']
        for phone in valid_phones:
            is_valid, msg = validate_phone(phone)
            assert is_valid, f"Phone {phone} should be valid"

    def test_validate_phone_invalid(self):
        invalid_phones = ['1234', '', '021-12345678', '138001380']
        for phone in invalid_phones:
            is_valid, msg = validate_phone(phone)
            assert not is_valid, f"Phone {phone} should be invalid"

    def test_normalize_phone(self):
        test_cases = [
            ('+8613800138000', '13800138000'),
            (' 138 0013 8000 ', '13800138000'),
            ('138-0013-8000', '13800138000'),
        ]
        for input_phone, expected in test_cases:
            result = normalize_phone(input_phone)
            assert result == expected

    def test_normalize_passport(self):
        test_cases = [
            (' e12345678 ', 'E12345678'),
        ]
        for input_passport, expected in test_cases:
            result = normalize_passport(input_passport)
            assert result == expected


class TestTaskAPI:
    def test_create_task(self, db_session):
        response = client.post(
            "/api/tasks",
            json={
                "task_name": "测试游学报名",
                "source_teacher": "王老师",
                "remark": "测试任务"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["task_name"] == "测试游学报名"
        assert data["source_teacher"] == "王老师"
        assert data["status"] == "created"
        assert data["id"] > 0

    def test_list_tasks(self, db_session):
        client.post(
            "/api/tasks",
            json={"task_name": "任务1", "source_teacher": "王老师"}
        )
        client.post(
            "/api/tasks",
            json={"task_name": "任务2", "source_teacher": "李老师"}
        )
        
        response = client.get("/api/tasks")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2

    def test_get_task(self, db_session):
        create_response = client.post(
            "/api/tasks",
            json={"task_name": "测试任务", "source_teacher": "王老师"}
        )
        task_id = create_response.json()["id"]
        
        response = client.get(f"/api/tasks/{task_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == task_id
        assert data["task_name"] == "测试任务"

    def test_update_task(self, db_session):
        create_response = client.post(
            "/api/tasks",
            json={"task_name": "原始任务名", "source_teacher": "王老师"}
        )
        task_id = create_response.json()["id"]
        
        response = client.patch(
            f"/api/tasks/{task_id}",
            json={"task_name": "更新后的任务名", "handler": "管理员"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["task_name"] == "更新后的任务名"


class TestFileUploadAndClean:
    def test_upload_file(self, db_session):
        create_response = client.post(
            "/api/tasks",
            json={"task_name": "文件上传测试", "source_teacher": "王老师"}
        )
        task_id = create_response.json()["id"]
        
        df = pd.DataFrame([
            {
                "学生姓名": "张三",
                "护照号": "E12345678",
                "监护人电话": "13800138000",
                "监护人姓名": "张父"
            },
            {
                "学生姓名": "李四",
                "护照号": "E87654321",
                "监护人电话": "13912345678",
                "监护人姓名": "李母"
            }
        ])
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)
        
        response = client.post(
            f"/api/tasks/{task_id}/upload",
            files={"file": ("test.xlsx", output.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == task_id
        assert data["records_count"] == 2

    def test_clean_task(self, db_session):
        create_response = client.post(
            "/api/tasks",
            json={"task_name": "清洗测试", "source_teacher": "王老师"}
        )
        task_id = create_response.json()["id"]
        
        df = pd.DataFrame([
            {
                "学生姓名": "张三",
                "护照号": "E12345678",
                "监护人电话": "13800138000",
                "监护人姓名": "张父"
            },
            {
                "学生姓名": "李四",
                "护照号": "E87654321",
                "监护人电话": "13912345678",
                "监护人姓名": "李母"
            }
        ])
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)
        
        client.post(
            f"/api/tasks/{task_id}/upload",
            files={"file": ("test.xlsx", output.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        )
        
        response = client.post(f"/api/tasks/{task_id}/clean")
        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == task_id
        assert data["total_processed"] == 2
        assert data["valid_count"] == 2

    def test_exception_detection(self, db_session):
        create_response = client.post(
            "/api/tasks",
            json={"task_name": "异常检测测试", "source_teacher": "王老师"}
        )
        task_id = create_response.json()["id"]
        
        df = pd.DataFrame([
            {
                "学生姓名": "张三",
                "护照号": "12345",
                "监护人电话": "1234",
                "监护人姓名": "张父"
            }
        ])
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)
        
        client.post(
            f"/api/tasks/{task_id}/upload",
            files={"file": ("test.xlsx", output.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        )
        
        response = client.post(f"/api/tasks/{task_id}/clean")
        assert response.status_code == 200
        data = response.json()
        assert data["exception_count"] == 1


class TestRecordCorrection:
    def test_correct_record(self, db_session):
        create_response = client.post(
            "/api/tasks",
            json={"task_name": "修正测试", "source_teacher": "王老师"}
        )
        task_id = create_response.json()["id"]
        
        df = pd.DataFrame([
            {
                "学生姓名": "张三",
                "护照号": "12345",
                "监护人电话": "1234",
                "监护人姓名": "张父"
            }
        ])
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)
        
        client.post(
            f"/api/tasks/{task_id}/upload",
            files={"file": ("test.xlsx", output.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        )
        
        client.post(f"/api/tasks/{task_id}/clean")
        
        records_response = client.get(f"/api/tasks/{task_id}/exceptions")
        records = records_response.json()
        record_id = records[0]["id"]
        
        correction_response = client.patch(
            f"/api/records/{record_id}",
            json={
                "passport_number": "E12345678",
                "guardian_phone": "13800138000",
                "handler": "管理员",
                "conclusion": "修正护照和手机号"
            }
        )
        assert correction_response.status_code == 200
        corrected = correction_response.json()
        assert corrected["passport_number"] == "E12345678"
        assert corrected["guardian_phone"] == "13800138000"
        assert corrected["is_manual_corrected"] == True
        assert corrected["status"] == "valid"


class TestDuplicateHandling:
    def test_detect_duplicates(self, db_session):
        create_response = client.post(
            "/api/tasks",
            json={"task_name": "去重测试", "source_teacher": "王老师"}
        )
        task_id = create_response.json()["id"]
        
        df = pd.DataFrame([
            {
                "学生姓名": "张三",
                "护照号": "E11111111",
                "监护人电话": "13800000001",
                "监护人姓名": "张父"
            },
            {
                "学生姓名": "张三",
                "护照号": "E11111111",
                "监护人电话": "13800000001",
                "监护人姓名": "张父"
            }
        ])
        
        create_response = client.post(
            "/api/tasks",
            json={"task_name": "重复检测测试", "source_teacher": "王老师"}
        )
        task_id = create_response.json()["id"]
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)
        
        client.post(
            f"/api/tasks/{task_id}/upload",
            files={"file": ("test.xlsx", output.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        )
        
        client.post(f"/api/tasks/{task_id}/clean")
        
        response = client.get(f"/api/tasks/{task_id}/duplicates")
        assert response.status_code == 200


class TestExport:
    def test_export_xlsx(self, db_session):
        create_response = client.post(
            "/api/tasks",
            json={"task_name": "导出测试", "source_teacher": "王老师"}
        )
        task_id = create_response.json()["id"]
        
        df = pd.DataFrame([
            {
                "学生姓名": "张三",
                "护照号": "E12345678",
                "监护人电话": "13800138000",
                "监护人姓名": "张父"
            }
        ])
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)
        
        client.post(
            f"/api/tasks/{task_id}/upload",
            files={"file": ("test.xlsx", output.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        )
        
        client.post(f"/api/tasks/{task_id}/clean")
        
        export_response = client.get(f"/api/tasks/{task_id}/export?format=xlsx")
        assert export_response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in export_response.headers["content-type"]


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
