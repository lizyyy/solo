from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from main import app
import json
import os

TEST_DATABASE_URL = "sqlite:///./test_yoga_waitlist.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
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


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "endpoints" in data


def test_valid_samples_endpoint():
    response = client.get("/api/samples/valid")
    assert response.status_code == 200
    samples = response.json()
    assert len(samples) == 2
    assert "waitlist_no" in samples[0]
    assert "class_name" in samples[0]
    assert "member_name" in samples[0]


def test_import_valid_records():
    valid_data = [
        {
            "waitlist_no": "WLTEST001",
            "class_name": "流瑜伽测试",
            "class_date": "2024-05-20",
            "start_time": "09:00",
            "instructor": "李老师",
            "member_no": "MT001",
            "member_name": "测试会员1",
            "phone": "13800000001",
            "waitlist_order": 1,
            "status": "等待候补",
            "apply_time": "2024-05-17 10:30:00",
            "confirm_deadline": "2024-05-19 18:00:00",
            "operator": "测试员",
            "quota_source": ""
        }
    ]
    response = client.post("/api/waitlist/import?operator=测试员", json=valid_data)
    assert response.status_code == 200
    data = response.json()
    assert data["success_count"] == 1
    assert data["failed_count"] == 0
    assert data["review_count"] == 0


def test_import_duplicate_records():
    duplicate_data = [
        {
            "waitlist_no": "WLTEST002",
            "class_name": "阴瑜伽测试",
            "class_date": "2024-05-21",
            "start_time": "10:00",
            "instructor": "王老师",
            "member_no": "MT002",
            "member_name": "测试会员2",
            "phone": "13800000002",
            "waitlist_order": 1,
            "status": "等待候补",
            "apply_time": "2024-05-18 08:00:00",
            "confirm_deadline": "2024-05-20 18:00:00",
            "operator": "测试员",
            "quota_source": ""
        },
        {
            "waitlist_no": "WLTEST002",
            "class_name": "阴瑜伽测试",
            "class_date": "2024-05-21",
            "start_time": "10:00",
            "instructor": "王老师",
            "member_no": "MT002",
            "member_name": "测试会员2",
            "phone": "13800000002",
            "waitlist_order": 1,
            "status": "等待候补",
            "apply_time": "2024-05-18 08:00:00",
            "confirm_deadline": "2024-05-20 18:00:00",
            "operator": "测试员",
            "quota_source": ""
        }
    ]
    response = client.post("/api/waitlist/import?operator=测试员", json=duplicate_data)
    assert response.status_code == 200
    data = response.json()
    assert data["success_count"] == 1
    assert data["review_count"] == 1
    assert len(data["bad_rows"]) == 1
    assert data["bad_rows"][0]["error_reason"] == "重复记录"


def test_import_missing_fields():
    bad_data = [
        {
            "waitlist_no": "WLTEST003",
            "class_name": "",
            "class_date": "2024-05-22",
            "start_time": "11:00",
            "instructor": "赵老师",
            "member_no": "MT003",
            "member_name": "",
            "phone": "13800000003",
            "waitlist_order": 1,
            "status": "已确认转正",
            "apply_time": "2024-05-18 09:00:00",
            "confirm_deadline": "",
            "operator": "",
            "quota_source": ""
        }
    ]
    response = client.post("/api/waitlist/import?operator=测试员", json=bad_data)
    assert response.status_code == 200
    data = response.json()
    assert data["failed_count"] == 1
    assert len(data["bad_rows"]) == 1
    assert "缺少必填字段" in data["bad_rows"][0]["error_detail"]
    assert "suggestion" in data["bad_rows"][0]


def test_import_invalid_status():
    invalid_status_data = [
        {
            "waitlist_no": "WLTEST004",
            "class_name": "修复瑜伽测试",
            "class_date": "2024-05-23",
            "start_time": "14:00",
            "instructor": "孙老师",
            "member_no": "MT004",
            "member_name": "测试会员4",
            "phone": "13800000004",
            "waitlist_order": 1,
            "status": "无效状态值",
            "apply_time": "2024-05-18 10:00:00",
            "confirm_deadline": "2024-05-22 18:00:00",
            "operator": "测试员",
            "quota_source": ""
        }
    ]
    response = client.post("/api/waitlist/import?operator=测试员", json=invalid_status_data)
    assert response.status_code == 200
    data = response.json()
    assert data["failed_count"] == 1
    assert len(data["bad_rows"]) == 1
    assert data["bad_rows"][0]["error_reason"] == "状态无效"


def test_import_order_mismatch_with_quota_issue():
    first_record = {
        "waitlist_no": "WLTEST005",
        "class_name": "阿斯汤加测试",
        "class_date": "2024-05-24",
        "start_time": "07:00",
        "instructor": "陈老师",
        "member_no": "MT005",
        "member_name": "测试会员5",
        "phone": "13800000005",
        "waitlist_order": 1,
        "status": "等待候补",
        "apply_time": "2024-05-18 11:00:00",
        "confirm_deadline": "2024-05-23 18:00:00",
        "operator": "测试员",
        "quota_source": ""
    }
    client.post("/api/waitlist/import?operator=测试员", json=[first_record])

    mismatch_data = [
        {
            "waitlist_no": "WLTEST006",
            "class_name": "阿斯汤加测试",
            "class_date": "2024-05-24",
            "start_time": "07:00",
            "instructor": "陈老师",
            "member_no": "MT006",
            "member_name": "测试会员6",
            "phone": "13800000006",
            "waitlist_order": 1,
            "status": "等待候补",
            "apply_time": "2024-05-18 12:00:00",
            "confirm_deadline": "2024-05-23 18:00:00",
            "operator": "测试员",
            "quota_source": "候补顺序应为1，存在不一致"
        }
    ]
    response = client.post("/api/waitlist/import?operator=测试员", json=mismatch_data)
    assert response.status_code == 200
    data = response.json()
    assert data["review_count"] == 1
    assert len(data["bad_rows"]) == 1
    assert data["bad_rows"][0]["error_reason"] == "候补顺序不一致"
    assert "名额未按顺序释放" in data["bad_rows"][0]["error_detail"]


def test_get_waitlist_records():
    response = client.get("/api/waitlist/records")
    assert response.status_code == 200
    records = response.json()
    assert isinstance(records, list)


def test_get_audit_logs():
    response = client.get("/api/audit/logs")
    assert response.status_code == 200
    logs = response.json()
    assert isinstance(logs, list)
    if logs:
        assert "action" in logs[0]
        assert "operation_time" in logs[0]


def test_get_bad_rows():
    response = client.get("/api/bad-rows")
    assert response.status_code == 200
    rows = response.json()
    assert isinstance(rows, list)
    if rows:
        assert "original_data" in rows[0]
        assert "error_reason" in rows[0]
        assert "suggestion" in rows[0]


def test_review_bad_row():
    bad_rows = client.get("/api/bad-rows").json()
    if bad_rows:
        bad_row_id = bad_rows[0]["id"]
        review_request = {
            "bad_row_id": bad_row_id,
            "manual_remark": "已人工审核确认数据无误，继续推进",
            "operator": "审核员"
        }
        response = client.post("/api/bad-rows/review", json=review_request)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "已审核通过"
        assert data["manual_remark"] == review_request["manual_remark"]


def test_mixed_sample_import():
    mixed_response = client.get("/api/samples/mixed")
    mixed_data = mixed_response.json()
    response = client.post("/api/waitlist/import?operator=测试员", json=mixed_data)
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 4
    assert "bad_rows" in data


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
