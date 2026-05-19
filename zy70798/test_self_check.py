import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from database import Base, get_db
from services import TestMetadataParser, ExpiryCalculator, ResultMerger, QuarantineService
from schemas import QuarantinedTestCreate, TestResultUpdate, ResultStatus

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_quarantine_test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
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


class Test01_MetadataParser:
    def test_parse_pytest_style_test_path(self):
        result = TestMetadataParser.parse_test_name("tests/test_auth.py::TestAuth::test_login")
        assert result['module'] == "tests/test_auth.py"
        assert result['class'] == "TestAuth"
        assert result['test_name'] == "test_login"

    def test_parse_simple_test_path(self):
        result = TestMetadataParser.parse_test_name("test_file.py::test_function")
        assert result['module'] == "test_file.py"
        assert result['class'] is None
        assert result['test_name'] == "test_function"

    def test_categorize_flaky_reason(self):
        assert TestMetadataParser.categorize_reason("测试不稳定，随机失败") == "flaky"
        assert TestMetadataParser.categorize_reason("flaky test needs investigation") == "flaky"

    def test_categorize_timeout_reason(self):
        assert TestMetadataParser.categorize_reason("测试超时") == "timeout"
        assert TestMetadataParser.categorize_reason("timed out after 30s") == "timeout"

    def test_categorize_other_reason(self):
        assert TestMetadataParser.categorize_reason("未知原因") == "other"


class Test02_ExpiryCalculator:
    def test_days_until_expiry_future(self):
        future = datetime.utcnow() + timedelta(days=7, hours=1)
        days = ExpiryCalculator.days_until_expiry(future)
        assert days >= 6

    def test_days_until_expiry_past(self):
        past = datetime.utcnow() - timedelta(days=3)
        days = ExpiryCalculator.days_until_expiry(past)
        assert days == 0

    def test_is_expired_true(self):
        past = datetime.utcnow() - timedelta(days=1)
        assert ExpiryCalculator.is_expired(past) is True

    def test_is_expiring_soon_true(self):
        soon = datetime.utcnow() + timedelta(days=2)
        assert ExpiryCalculator.is_expiring_soon(soon) is True


class Test03_API_Import:
    def test_create_quarantined_test(self):
        response = client.post(
            "/api/quarantined-tests/",
            json={
                "test_name": "test_login_flow",
                "test_path": "tests/test_auth.py::TestAuth::test_login_flow",
                "quarantine_reason": "测试不稳定，随机失败",
                "owner": "张三",
                "owner_email": "zhangsan@example.com",
                "quarantine_date": datetime.utcnow().isoformat(),
                "expiry_date": (datetime.utcnow() + timedelta(days=7)).isoformat(),
                "notes": "需要修复"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data['test_name'] == "test_login_flow"
        assert data['owner'] == "张三"
        assert data['reason_category'] == "flaky"
        assert data['status'] == "active"
        return data['id']

    def test_create_test_with_invalid_expiry(self):
        response = client.post(
            "/api/quarantined-tests/",
            json={
                "test_name": "test_invalid",
                "test_path": "tests/test.py::test_invalid",
                "quarantine_reason": "超时",
                "owner": "李四",
                "quarantine_date": datetime.utcnow().isoformat(),
                "expiry_date": (datetime.utcnow() - timedelta(days=1)).isoformat()
            }
        )
        assert response.status_code == 400
        assert response.json()['error_code'] == "VALIDATION_ERROR"

    def test_create_test_missing_required_fields(self):
        response = client.post(
            "/api/quarantined-tests/",
            json={
                "test_name": "test_missing",
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert data['error_code'] == "MISSING_FIELD"
        assert 'missing_fields' in data['details']


class Test04_API_Filter:
    def test_list_all_tests(self):
        for i in range(3):
            client.post(
                "/api/quarantined-tests/",
                json={
                    "test_name": f"test_{i}",
                    "test_path": f"tests/test_{i}.py::test_{i}",
                    "quarantine_reason": "超时",
                    "owner": "王五",
                    "quarantine_date": datetime.utcnow().isoformat(),
                    "expiry_date": (datetime.utcnow() + timedelta(days=i)).isoformat()
                }
            )
        
        response = client.get("/api/quarantined-tests/")
        assert response.status_code == 200
        assert len(response.json()) >= 3

    def test_filter_by_owner(self):
        response = client.get("/api/quarantined-tests/?owner=王五")
        assert response.status_code == 200
        for test in response.json():
            assert test['owner'] == "王五"

    def test_filter_by_reason_category(self):
        response = client.get("/api/quarantined-tests/?reason_category=timeout")
        assert response.status_code == 200
        for test in response.json():
            assert test['reason_category'] == "timeout"


class Test05_API_ResultProcessing:
    def test_update_test_result_pass(self):
        create_response = client.post(
            "/api/quarantined-tests/",
            json={
                "test_name": "test_stable",
                "test_path": "tests/test_stable.py::test_stable",
                "quarantine_reason": "之前不稳定",
                "owner": "赵六",
                "quarantine_date": datetime.utcnow().isoformat(),
                "expiry_date": (datetime.utcnow() + timedelta(days=7)).isoformat()
            }
        )
        test_id = create_response.json()['id']

        for i in range(3):
            response = client.post(
                f"/api/quarantined-tests/{test_id}/result",
                json={
                    "result": "PASS",
                    "run_date": datetime.utcnow().isoformat(),
                    "build_url": f"http://ci/build/{i}"
                }
            )
            assert response.status_code == 200

        final_response = client.get(f"/api/quarantined-tests/{test_id}")
        data = final_response.json()
        assert data['consecutive_passes'] == 3
        assert data['status'] == "ready_for_cleanup"

    def test_update_test_result_fail(self):
        create_response = client.post(
            "/api/quarantined-tests/",
            json={
                "test_name": "test_unstable",
                "test_path": "tests/test_unstable.py::test_unstable",
                "quarantine_reason": "不稳定",
                "owner": "钱七",
                "quarantine_date": datetime.utcnow().isoformat(),
                "expiry_date": (datetime.utcnow() + timedelta(days=7)).isoformat()
            }
        )
        test_id = create_response.json()['id']

        client.post(
            f"/api/quarantined-tests/{test_id}/result",
            json={"result": "PASS", "run_date": datetime.utcnow().isoformat()}
        )
        client.post(
            f"/api/quarantined-tests/{test_id}/result",
            json={"result": "FAIL", "run_date": datetime.utcnow().isoformat()}
        )

        final_response = client.get(f"/api/quarantined-tests/{test_id}")
        data = final_response.json()
        assert data['consecutive_passes'] == 0


class Test06_API_CleanupSuggestions:
    def test_get_cleanup_suggestions(self):
        response = client.get("/api/cleanup-suggestions/")
        assert response.status_code == 200
        suggestions = response.json()
        assert isinstance(suggestions, list)
        if suggestions:
            assert 'test_id' in suggestions[0]
            assert 'suggestion' in suggestions[0]
            assert 'priority' in suggestions[0]

    def test_get_owner_summary(self):
        response = client.get("/api/owner-summary/")
        assert response.status_code == 200
        summaries = response.json()
        assert isinstance(summaries, list)
        if summaries:
            assert 'owner' in summaries[0]
            assert 'total_tests' in summaries[0]
            assert 'expired_count' in summaries[0]


class Test07_API_ErrorHandling:
    def test_mark_cleaned_wrong_status(self):
        create_response = client.post(
            "/api/quarantined-tests/",
            json={
                "test_name": "test_active",
                "test_path": "tests/test_active.py::test_active",
                "quarantine_reason": "不稳定",
                "owner": "孙八",
                "quarantine_date": datetime.utcnow().isoformat(),
                "expiry_date": (datetime.utcnow() + timedelta(days=7)).isoformat()
            }
        )
        test_id = create_response.json()['id']

        response = client.post(f"/api/quarantined-tests/{test_id}/mark-cleaned")
        assert response.status_code == 400
        assert response.json()['error_code'] == "INVALID_STATUS"

    def test_mark_cleaned_already_processed(self):
        create_response = client.post(
            "/api/quarantined-tests/",
            json={
                "test_name": "test_ready",
                "test_path": "tests/test_ready.py::test_ready",
                "quarantine_reason": "不稳定",
                "owner": "周九",
                "quarantine_date": datetime.utcnow().isoformat(),
                "expiry_date": (datetime.utcnow() + timedelta(days=7)).isoformat()
            }
        )
        test_id = create_response.json()['id']

        for _ in range(3):
            client.post(
                f"/api/quarantined-tests/{test_id}/result",
                json={"result": "PASS", "run_date": datetime.utcnow().isoformat()}
            )

        client.post(f"/api/quarantined-tests/{test_id}/mark-cleaned")
        response = client.post(f"/api/quarantined-tests/{test_id}/mark-cleaned")
        assert response.status_code == 400
        assert response.json()['error_code'] == "ALREADY_PROCESSED"

    def test_get_nonexistent_test(self):
        response = client.get("/api/quarantined-tests/99999")
        assert response.status_code == 404
        assert response.json()['detail']['error_code'] == "NOT_FOUND"

    def test_requires_manual_review_after_ready_failure(self):
        create_response = client.post(
            "/api/quarantined-tests/",
            json={
                "test_name": "test_flaky",
                "test_path": "tests/test_flaky.py::test_flaky",
                "quarantine_reason": "不稳定",
                "owner": "吴十",
                "quarantine_date": datetime.utcnow().isoformat(),
                "expiry_date": (datetime.utcnow() + timedelta(days=7)).isoformat()
            }
        )
        test_id = create_response.json()['id']

        for _ in range(3):
            client.post(
                f"/api/quarantined-tests/{test_id}/result",
                json={"result": "PASS", "run_date": datetime.utcnow().isoformat()}
            )

        test_response = client.get(f"/api/quarantined-tests/{test_id}")
        assert test_response.json()['status'] == "ready_for_cleanup"

        client.post(
            f"/api/quarantined-tests/{test_id}/result",
            json={"result": "FAIL", "run_date": datetime.utcnow().isoformat()}
        )

        test_response = client.get(f"/api/quarantined-tests/{test_id}")
        assert test_response.json()['status'] == "requires_manual_review"

    def test_mark_cleaned_requires_manual_review(self):
        create_response = client.post(
            "/api/quarantined-tests/",
            json={
                "test_name": "test_needs_review",
                "test_path": "tests/test_needs_review.py::test_needs_review",
                "quarantine_reason": "不稳定",
                "owner": "郑十一",
                "quarantine_date": datetime.utcnow().isoformat(),
                "expiry_date": (datetime.utcnow() + timedelta(days=7)).isoformat()
            }
        )
        test_id = create_response.json()['id']

        for _ in range(3):
            client.post(
                f"/api/quarantined-tests/{test_id}/result",
                json={"result": "PASS", "run_date": datetime.utcnow().isoformat()}
            )

        client.post(
            f"/api/quarantined-tests/{test_id}/result",
            json={"result": "FAIL", "run_date": datetime.utcnow().isoformat()}
        )

        response = client.post(f"/api/quarantined-tests/{test_id}/mark-cleaned")
        assert response.status_code == 400
        assert response.json()['error_code'] == "REQUIRES_MANUAL_REVIEW"


class Test08_API_ReportExport:
    def test_generate_cleanup_report(self):
        response = client.post("/api/cleanup-report/?generated_by=test_script")
        assert response.status_code == 200
        report = response.json()
        assert 'id' in report
        assert 'total_quarantined' in report
        assert 'expired' in report
        assert 'suggestions' in report
        assert 'by_owner' in report
        assert 'by_reason' in report

    def test_health_check(self):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()['status'] == "ok"


if __name__ == "__main__":
    print("=" * 60)
    print("开始运行测试隔离名单 API 自检脚本")
    print("=" * 60)
    
    pytest_args = [
        __file__,
        "-v",
        "--tb=short",
        "--color=yes"
    ]
    
    exit_code = pytest.main(pytest_args)
    
    print("\n" + "=" * 60)
    if exit_code == 0:
        print("✅ 所有测试通过！API 功能正常")
    else:
        print(f"❌ 测试失败，退出码: {exit_code}")
    print("=" * 60)
    
    if os.path.exists("./test_quarantine_test.db"):
        os.remove("./test_quarantine_test.db")
    
    sys.exit(exit_code)
