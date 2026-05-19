import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from main import app
import tempfile

db_fd, db_path = tempfile.mkstemp()
SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_path}"
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

@pytest.fixture(scope="module")
def test_client():
    yield client
    os.close(db_fd)
    os.unlink(db_path)

def test_log_parser():
    from core import LogParser
    nginx_log = '192.168.1.1 - - [10/Jan/2024:12:00:00 +0800] "GET /test HTTP/1.1" 200 1234 "-" "Mozilla/5.0"'
    parsed = LogParser.parse_nginx_log(nginx_log)
    assert parsed is not None
    assert parsed["ip"] == "192.168.1.1"
    assert parsed["path"] == "/test"

def test_crawler_detection():
    from core import CrawlerDetector
    conf, reason = CrawlerDetector.check_user_agent("Googlebot/2.1")
    assert conf > 0.5
    assert reason is not None
    conf, reason = CrawlerDetector.check_user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
    assert conf < 0.5

def test_import_logs(test_client):
    log_content = '''192.168.1.100 - - [10/Jan/2024:12:00:00 +0800] "GET / HTTP/1.1" 200 1234 "-" "Mozilla/5.0 (compatible; Googlebot/2.1)"
192.168.2.1 - - [10/Jan/2024:12:01:00 +0800] "GET /products HTTP/1.1" 200 2345 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"'''
    response = test_client.post(
        "/api/logs/import?operator=test_user",
        files={"file": ("test.log", log_content, "text/plain")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == 2
    assert data["failed"] == 0

def test_list_logs(test_client):
    response = test_client.get("/api/logs")
    assert response.status_code == 200
    logs = response.json()
    assert len(logs) > 0

def test_filter_logs_by_crawler(test_client):
    response = test_client.get("/api/logs?is_crawler=true")
    assert response.status_code == 200
    crawler_logs = response.json()
    for log in crawler_logs:
        assert log["is_crawler"] == True

def test_get_log_detail(test_client):
    response = test_client.get("/api/logs")
    logs = response.json()
    log_id = logs[0]["id"]
    detail_response = test_client.get(f"/api/logs/{log_id}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert "log" in detail
    assert "audit_history" in detail

def test_manual_correction(test_client):
    response = test_client.get("/api/logs")
    logs = response.json()
    log_ids = [log["id"] for log in logs[:2]]
    correction_response = test_client.post(
        "/api/logs/manual-correction",
        json={
            "log_ids": log_ids,
            "is_crawler": False,
            "operator": "test_operator",
            "reason": "误判，实际是人类用户"
        }
    )
    assert correction_response.status_code == 200
    result = correction_response.json()
    assert result["success"] == 2

def test_withdraw_logs(test_client):
    response = test_client.get("/api/logs")
    logs = response.json()
    log_ids = [log["id"] for log in logs[:1]]
    withdraw_response = test_client.post(
        f"/api/logs/withdraw?operator=test_operator&reason=测试撤回",
        json=log_ids
    )
    assert withdraw_response.status_code == 200
    result = withdraw_response.json()
    assert result["success"] == 1

def test_export_samples(test_client):
    response = test_client.get("/api/logs/export/sample?sample_size=10")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]

def test_export_purified(test_client):
    response = test_client.get("/api/logs/export/purified")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]

def test_create_rule(test_client):
    response = test_client.post(
        "/api/rules",
        json={
            "name": "block_bad_ua",
            "rule_type": "user_agent",
            "pattern": "BadBot",
            "confidence": 1.0,
            "description": "阻止BadBot爬虫"
        }
    )
    assert response.status_code == 200
    rule = response.json()
    assert rule["name"] == "block_bad_ua"

def test_list_rules(test_client):
    response = test_client.get("/api/rules")
    assert response.status_code == 200
    rules = response.json()
    assert len(rules) > 0

def test_delete_rule(test_client):
    response = test_client.get("/api/rules")
    rules = response.json()
    rule_id = rules[0]["id"]
    delete_response = test_client.delete(f"/api/rules/{rule_id}")
    assert delete_response.status_code == 200

def test_list_reports(test_client):
    response = test_client.get("/api/reports")
    assert response.status_code == 200
    reports = response.json()
    assert len(reports) > 0

def test_get_report(test_client):
    response = test_client.get("/api/reports")
    reports = response.json()
    report_id = reports[0]["id"]
    detail_response = test_client.get(f"/api/reports/{report_id}")
    assert detail_response.status_code == 200

def test_advance_report_status(test_client):
    response = test_client.get("/api/reports")
    reports = response.json()
    report_id = reports[0]["id"]
    status_response = test_client.post(
        f"/api/reports/{report_id}/advance-status",
        json={
            "report_id": report_id,
            "status": "reviewing",
            "operator": "test_operator",
            "reason": "开始人工审核"
        }
    )
    assert status_response.status_code == 200

def test_close_report(test_client):
    response = test_client.get("/api/reports")
    reports = response.json()
    report_id = reports[0]["id"]
    close_response = test_client.post(
        f"/api/reports/{report_id}/close?operator=test_operator&reason=审核完成"
    )
    assert close_response.status_code == 200

def test_dashboard_stats(test_client):
    response = test_client.get("/api/statistics/dashboard")
    assert response.status_code == 200
    stats = response.json()
    assert "total_logs" in stats
    assert "crawler_logs" in stats
    assert "human_logs" in stats
    assert "crawler_ratio" in stats

def test_audit_logs(test_client):
    response = test_client.get("/api/audit-logs")
    assert response.status_code == 200
    logs = response.json()
    assert len(logs) > 0

def test_invalid_status_transition(test_client):
    response = test_client.get("/api/reports")
    reports = response.json()
    report_id = reports[0]["id"]
    bad_response = test_client.post(
        f"/api/reports/{report_id}/advance-status",
        json={
            "report_id": report_id,
            "status": "invalid_status",
            "operator": "test_operator"
        }
    )
    assert bad_response.status_code == 400

def test_get_nonexistent_log(test_client):
    response = test_client.get("/api/logs/999999")
    assert response.status_code == 404

def test_get_nonexistent_report(test_client):
    response = test_client.get("/api/reports/999999")
    assert response.status_code == 404
