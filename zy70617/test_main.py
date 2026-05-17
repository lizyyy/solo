#!/usr/bin/env python3
"""
pytest测试文件
包含正常路径和异常路径测试
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import date, timedelta
import json

from app.database import Base, get_db
from app.main import app
from app.models import RenewalStatus

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


@pytest.fixture(autouse=True)
def setup_and_teardown():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


class TestEmployee:
    """员工管理测试"""

    def test_create_employee_success(self):
        """正常路径：创建员工成功"""
        response = client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "department": "测试部",
                "position": "测试员",
                "email": "test@example.com",
                "phone": "13800000001"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["employee_id"] == "TEST001"
        assert data["name"] == "测试员工"

    def test_create_employee_duplicate_id(self):
        """异常路径：员工编号重复"""
        client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工1",
                "department": "测试部"
            }
        )
        response = client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工2",
                "department": "测试部"
            }
        )
        assert response.status_code == 400
        assert "员工编号已存在" in response.json()["detail"]

    def test_get_employee_not_found(self):
        """异常路径：获取不存在的员工"""
        response = client.get("/employees/99999")
        assert response.status_code == 404
        assert "员工不存在" in response.json()["detail"]

    def test_update_employee_success(self):
        """正常路径：更新员工信息"""
        create_response = client.post(
            "/employees/",
            json={
                "employee_id": "TEST001",
                "name": "测试员工",
                "department": "测试部"
            }
        )
        employee_id = create_response.json()["id"]
        
        response = client.put(
            f"/employees/{employee_id}",
            json={
                "name": "修改后的员工",
                "department": "研发部"
            }
        )
        assert response.status_code == 200
        assert response.json()["name"] == "修改后的员工"
        assert response.json()["department"] == "研发部"


class TestCertificateType:
    """证书类型测试"""

    def test_create_certificate_type_success(self):
        """正常路径：创建证书类型成功"""
        response = client.post(
            "/certificate-types/",
            json={
                "type_code": "TEST_CERT",
                "name": "测试证书",
                "description": "测试用证书类型",
                "validity_period_months": 24,
                "required_score": 60.0
            }
        )
        assert response.status_code == 200
        assert response.json()["type_code"] == "TEST_CERT"

    def test_create_certificate_type_duplicate_code(self):
        """异常路径：证书类型编码重复"""
        client.post(
            "/certificate-types/",
            json={
                "type_code": "TEST_CERT",
                "name": "测试证书1",
                "required_score": 60.0
            }
        )
        response = client.post(
            "/certificate-types/",
            json={
                "type_code": "TEST_CERT",
                "name": "测试证书2",
                "required_score": 60.0
            }
        )
        assert response.status_code == 400
        assert "证书类型编码已存在" in response.json()["detail"]


class TestCourseScoreAndRetake:
    """课程成绩和补考记录测试"""

    def test_create_course_score_passed(self):
        """正常路径：课程成绩通过"""
        client.post(
            "/employees/",
            json={"employee_id": "TEST001", "name": "测试员工"}
        )
        client.post(
            "/certificate-types/",
            json={"type_code": "TEST_CERT", "name": "测试证书", "required_score": 60.0}
        )
        
        response = client.post(
            "/course-scores/",
            json={
                "employee_id": 1,
                "certificate_type_id": 1,
                "course_name": "测试课程",
                "score": 85.0,
                "exam_date": date.today().isoformat()
            }
        )
        assert response.status_code == 200
        assert response.json()["is_passed"] == True

    def test_create_course_score_failed_creates_retake(self):
        """正常路径：成绩不通过，自动创建补考记录"""
        client.post(
            "/employees/",
            json={"employee_id": "TEST001", "name": "测试员工"}
        )
        client.post(
            "/certificate-types/",
            json={"type_code": "TEST_CERT", "name": "测试证书", "required_score": 60.0}
        )
        
        response = client.post(
            "/course-scores/",
            json={
                "employee_id": 1,
                "certificate_type_id": 1,
                "course_name": "测试课程",
                "score": 55.0,
                "exam_date": date.today().isoformat()
            }
        )
        assert response.status_code == 200
        assert response.json()["is_passed"] == False
        
        retake_response = client.get("/retake-records/?employee_id=1")
        assert retake_response.status_code == 200
        assert len(retake_response.json()) == 1
        assert retake_response.json()[0]["status"] == "未开始"

    def test_update_retake_record_passed(self):
        """正常路径：补考通过"""
        client.post(
            "/employees/",
            json={"employee_id": "TEST001", "name": "测试员工"}
        )
        client.post(
            "/certificate-types/",
            json={"type_code": "TEST_CERT", "name": "测试证书", "required_score": 60.0}
        )
        client.post(
            "/course-scores/",
            json={
                "employee_id": 1,
                "certificate_type_id": 1,
                "course_name": "测试课程",
                "score": 55.0,
                "exam_date": date.today().isoformat()
            }
        )
        
        retake_response = client.get("/retake-records/?employee_id=1")
        retake_id = retake_response.json()[0]["id"]
        
        update_response = client.put(
            f"/retake-records/{retake_id}",
            json={
                "retake_date": date.today().isoformat(),
                "retake_score": 75.0
            }
        )
        assert update_response.status_code == 200
        assert update_response.json()["is_passed"] == True
        assert update_response.json()["status"] == "已通过"

    def test_update_retake_record_not_found(self):
        """异常路径：更新不存在的补考记录"""
        response = client.put(
            "/retake-records/99999",
            json={"retake_score": 75.0}
        )
        assert response.status_code == 404
        assert "补考记录不存在" in response.json()["detail"]


class TestRenewalItem:
    """续期清单测试"""

    def test_create_renewal_item_success(self):
        """正常路径：创建续期项成功"""
        client.post(
            "/employees/",
            json={"employee_id": "TEST001", "name": "测试员工"}
        )
        client.post(
            "/certificate-types/",
            json={"type_code": "TEST_CERT", "name": "测试证书"}
        )
        
        response = client.post(
            "/renewal-items/",
            json={
                "employee_id": 1,
                "certificate_type_id": 1,
                "priority": 1,
                "due_date": (date.today() + timedelta(days=30)).isoformat()
            }
        )
        assert response.status_code == 200
        assert response.json()["status"] == "待处理"
        assert response.json()["renewal_code"].startswith("R")

    def test_create_renewal_item_idempotent(self):
        """幂等性测试：同一员工同一证书类型待处理续期项不重复创建"""
        client.post(
            "/employees/",
            json={"employee_id": "TEST001", "name": "测试员工"}
        )
        client.post(
            "/certificate-types/",
            json={"type_code": "TEST_CERT", "name": "测试证书"}
        )
        
        first_response = client.post(
            "/renewal-items/",
            json={
                "employee_id": 1,
                "certificate_type_id": 1,
                "priority": 1
            }
        )
        first_code = first_response.json()["renewal_code"]
        
        second_response = client.post(
            "/renewal-items/",
            json={
                "employee_id": 1,
                "certificate_type_id": 1,
                "priority": 2
            }
        )
        second_code = second_response.json()["renewal_code"]
        
        assert first_code == second_code
        
        all_renewals = client.get("/renewal-items/")
        assert len(all_renewals.json()) == 1

    def test_advance_renewal_status_success(self):
        """正常路径：状态推进成功"""
        client.post(
            "/employees/",
            json={"employee_id": "TEST001", "name": "测试员工"}
        )
        client.post(
            "/certificate-types/",
            json={"type_code": "TEST_CERT", "name": "测试证书"}
        )
        create_response = client.post(
            "/renewal-items/",
            json={"employee_id": 1, "certificate_type_id": 1}
        )
        renewal_id = create_response.json()["id"]
        
        assert create_response.json()["status"] == "待处理"
        
        advance_response = client.put(f"/renewal-items/{renewal_id}/advance")
        assert advance_response.status_code == 200
        assert advance_response.json()["status"] == "处理中"
        
        advance_response2 = client.put(f"/renewal-items/{renewal_id}/advance")
        assert advance_response2.status_code == 200
        assert advance_response2.json()["status"] == "已完成"

    def test_advance_renewal_status_cannot_advance_completed(self):
        """异常路径：已完成状态无法继续推进"""
        client.post(
            "/employees/",
            json={"employee_id": "TEST001", "name": "测试员工"}
        )
        client.post(
            "/certificate-types/",
            json={"type_code": "TEST_CERT", "name": "测试证书"}
        )
        create_response = client.post(
            "/renewal-items/",
            json={"employee_id": 1, "certificate_type_id": 1}
        )
        renewal_id = create_response.json()["id"]
        
        client.put(f"/renewal-items/{renewal_id}/advance")
        client.put(f"/renewal-items/{renewal_id}/advance")
        
        advance_response = client.put(f"/renewal-items/{renewal_id}/advance")
        assert advance_response.status_code == 400
        assert "当前状态无法推进" in advance_response.json()["detail"]

    def test_manual_correct_renewal(self):
        """正常路径：人工修正续期项"""
        client.post(
            "/employees/",
            json={"employee_id": "TEST001", "name": "测试员工"}
        )
        client.post(
            "/certificate-types/",
            json={"type_code": "TEST_CERT", "name": "测试证书"}
        )
        create_response = client.post(
            "/renewal-items/",
            json={"employee_id": 1, "certificate_type_id": 1}
        )
        renewal_id = create_response.json()["id"]
        
        correct_response = client.post(
            f"/renewal-items/{renewal_id}/correct",
            json={
                "handler": "管理员",
                "conclusion": "特殊情况处理",
                "new_status": "已关闭",
                "remarks": "测试备注"
            }
        )
        assert correct_response.status_code == 200
        assert correct_response.json()["status"] == "已关闭"
        
        logs_response = client.get("/exception-logs/?operation_type=人工修正")
        assert logs_response.status_code == 200
        assert len(logs_response.json()) >= 1

    def test_cancel_renewal(self):
        """正常路径：取消续期项"""
        client.post(
            "/employees/",
            json={"employee_id": "TEST001", "name": "测试员工"}
        )
        client.post(
            "/certificate-types/",
            json={"type_code": "TEST_CERT", "name": "测试证书"}
        )
        create_response = client.post(
            "/renewal-items/",
            json={"employee_id": 1, "certificate_type_id": 1}
        )
        renewal_id = create_response.json()["id"]
        
        cancel_response = client.post(
            f"/renewal-items/{renewal_id}/cancel?handler=管理员&reason=员工已离职"
        )
        assert cancel_response.status_code == 200
        assert cancel_response.json()["status"] == "已取消"

    def test_close_renewal(self):
        """正常路径：关闭续期项"""
        client.post(
            "/employees/",
            json={"employee_id": "TEST001", "name": "测试员工"}
        )
        client.post(
            "/certificate-types/",
            json={"type_code": "TEST_CERT", "name": "测试证书"}
        )
        create_response = client.post(
            "/renewal-items/",
            json={"employee_id": 1, "certificate_type_id": 1}
        )
        renewal_id = create_response.json()["id"]
        
        close_response = client.post(
            f"/renewal-items/{renewal_id}/close?handler=管理员&conclusion=续期完成，无需继续跟踪"
        )
        assert close_response.status_code == 200
        assert close_response.json()["status"] == "已关闭"

    def test_get_renewal_statistics(self):
        """正常路径：获取续期统计"""
        for i in range(3):
            client.post(
                "/employees/",
                json={"employee_id": f"TEST00{i+1}", "name": f"测试员工{i+1}"}
            )
        client.post(
            "/certificate-types/",
            json={"type_code": "TEST_CERT", "name": "测试证书"}
        )
        
        for i in range(3):
            client.post(
                "/renewal-items/",
                json={"employee_id": i+1, "certificate_type_id": 1}
            )
        
        stats_response = client.get("/renewal-statistics/")
        assert stats_response.status_code == 200
        stats = stats_response.json()
        assert stats["total"] == 3
        assert stats["pending"] == 3
        assert stats["in_progress"] == 0
        assert stats["completed"] == 0


class TestQualificationCheck:
    """岗位资格检查测试"""

    def test_qualification_check_qualified(self):
        """正常路径：资格检查通过"""
        emp_response = client.post(
            "/employees/",
            json={"employee_id": "TEST001", "name": "测试员工", "position": "测试岗位"}
        )
        employee_id = emp_response.json()["id"]
        
        cert_type_response = client.post(
            "/certificate-types/",
            json={"type_code": "TEST_CERT", "name": "测试证书", "required_score": 60.0}
        )
        cert_type_id = cert_type_response.json()["id"]
        
        client.post(
            "/position-requirements/",
            json={
                "position_name": "测试岗位",
                "certificate_type_id": cert_type_id,
                "is_required": True
            }
        )
        
        client.post(
            "/employee-certificates/",
            json={
                "employee_id": employee_id,
                "certificate_type_id": cert_type_id,
                "issue_date": date.today().isoformat(),
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "score": 85.0
            }
        )
        
        client.post(
            "/course-scores/",
            json={
                "employee_id": employee_id,
                "certificate_type_id": cert_type_id,
                "course_name": "测试课程",
                "score": 85.0,
                "exam_date": date.today().isoformat()
            }
        )
        
        check_response = client.get(f"/qualification-check/{employee_id}/测试岗位")
        assert check_response.status_code == 200
        results = check_response.json()
        assert len(results) >= 1
        assert results[0]["is_qualified"] == True

    def test_qualification_check_no_certificate(self):
        """异常路径：无对应证书，资格不通过"""
        emp_response = client.post(
            "/employees/",
            json={"employee_id": "TEST001", "name": "测试员工", "position": "测试岗位"}
        )
        employee_id = emp_response.json()["id"]
        
        cert_type_response = client.post(
            "/certificate-types/",
            json={"type_code": "TEST_CERT", "name": "测试证书", "required_score": 60.0}
        )
        cert_type_id = cert_type_response.json()["id"]
        
        client.post(
            "/position-requirements/",
            json={
                "position_name": "测试岗位",
                "certificate_type_id": cert_type_id,
                "is_required": True
            }
        )
        
        check_response = client.get(f"/qualification-check/{employee_id}/测试岗位")
        assert check_response.status_code == 200
        results = check_response.json()
        assert len(results) >= 1
        assert results[0]["is_qualified"] == False
        assert "无对应证书" in results[0]["remarks"]


class TestCertificateExpiryAlerts:
    """证书过期提醒测试"""

    def test_certificate_expiry_alerts(self):
        """正常路径：获取过期提醒列表"""
        client.post(
            "/employees/",
            json={"employee_id": "TEST001", "name": "测试员工"}
        )
        client.post(
            "/certificate-types/",
            json={"type_code": "TEST_CERT", "name": "测试证书"}
        )
        
        client.post(
            "/employee-certificates/",
            json={
                "employee_id": 1,
                "certificate_type_id": 1,
                "certificate_number": "TEST001",
                "issue_date": (date.today() - timedelta(days=365)).isoformat(),
                "expiry_date": (date.today() + timedelta(days=30)).isoformat(),
                "score": 85.0
            }
        )
        
        alerts_response = client.get("/certificate-expiry-alerts/?days_threshold=90")
        assert alerts_response.status_code == 200
        alerts = alerts_response.json()
        assert len(alerts) >= 1
        assert alerts[0]["days_until_expiry"] <= 90


class TestExport:
    """导出功能测试"""

    def test_export_renewal_items(self):
        """正常路径：导岀续期清单"""
        client.post(
            "/employees/",
            json={"employee_id": "TEST001", "name": "测试员工"}
        )
        client.post(
            "/certificate-types/",
            json={"type_code": "TEST_CERT", "name": "测试证书"}
        )
        client.post(
            "/renewal-items/",
            json={"employee_id": 1, "certificate_type_id": 1}
        )
        
        export_response = client.get("/export/renewal-items/")
        assert export_response.status_code == 200
        assert "text/csv" in export_response.headers["content-type"]
        assert "续期编号" in export_response.text

    def test_export_certificate_expiry_alerts(self):
        """正常路径：导岀过期提醒"""
        client.post(
            "/employees/",
            json={"employee_id": "TEST001", "name": "测试员工"}
        )
        client.post(
            "/certificate-types/",
            json={"type_code": "TEST_CERT", "name": "测试证书"}
        )
        client.post(
            "/employee-certificates/",
            json={
                "employee_id": 1,
                "certificate_type_id": 1,
                "certificate_number": "TEST001",
                "issue_date": date.today().isoformat(),
                "expiry_date": (date.today() + timedelta(days=30)).isoformat(),
                "score": 85.0
            }
        )
        
        export_response = client.get("/export/certificate-expiry-alerts/?days_threshold=90")
        assert export_response.status_code == 200
        assert "text/csv" in export_response.headers["content-type"]
        assert "员工编号" in export_response.text
