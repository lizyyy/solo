import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, get_db
from app.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_shadow_flow.db"

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
    yield
    Base.metadata.drop_all(bind=engine)


def test_single_sample_high_priority_rule(db_session):
    """测试一个样本命中多个规则时，只选择优先级最高的规则"""
    client.post(
        "/api/rules/",
        json={
            "name": "高优先级规则",
            "path_pattern": "/api/v1/users/*",
            "method": "*",
            "target_url": "http://high-priority-service",
            "rewrite_path": "/api/v2/users/",
            "is_active": True,
            "priority": 200
        }
    )
    
    client.post(
        "/api/rules/",
        json={
            "name": "低优先级规则",
            "path_pattern": "/api/v1/*",
            "method": "*",
            "target_url": "http://low-priority-service",
            "is_active": True,
            "priority": 100
        }
    )
    
    for i in range(5):
        client.post(
            "/api/samples/",
            json={
                "path": f"/api/v1/users/{i}",
                "method": "GET",
                "expected_status": 200,
                "expected_response": f'{{"id": {i}, "name": "test"}}'
            }
        )
    
    batch_response = client.post(
        "/api/batches/",
        json={
            "name": "优先级测试批次",
            "created_by": "tester",
            "rule_ids": [1, 2],
            "description": "测试规则优先级选择"
        }
    )
    batch_id = batch_response.json()["id"]
    
    execute_response = client.post(f"/api/batches/{batch_id}/execute/")
    assert execute_response.status_code == 200
    
    import time
    time.sleep(0.1)
    
    status_response = client.get(f"/api/batches/{batch_id}/status/")
    status_data = status_response.json()
    
    assert status_data["progress"] <= 100.0
    assert status_data["total_samples"] == 5
    assert status_data["processed_count"] <= 5
    
    hits_response = client.get(f"/api/hits/?batch_id={batch_id}&limit=100")
    hits = hits_response.json()
    
    assert len(hits) <= 5
    
    hit_rule_ids = [h["rule_id"] for h in hits]
    for rule_id in hit_rule_ids:
        assert rule_id == 1, "应命中高优先级规则(rule_id=1)而非低优先级规则"


def test_progress_not_exceed_100(db_session):
    """测试进度统计不会超过100%"""
    for i in range(3):
        client.post(
            "/api/rules/",
            json={
                "name": f"规则{i}",
                "path_pattern": "/api/*",
                "method": "*",
                "is_active": True,
                "priority": 100 - i
            }
        )
    
    for i in range(10):
        client.post(
            "/api/samples/",
            json={
                "path": f"/api/test/{i}",
                "method": "GET",
                "expected_status": 200
            }
        )
    
    batch_response = client.post(
        "/api/batches/",
        json={
            "name": "进度测试批次",
            "rule_ids": [1, 2, 3]
        }
    )
    batch_id = batch_response.json()["id"]
    
    client.post(f"/api/batches/{batch_id}/execute/")
    
    import time
    time.sleep(0.1)
    
    status_response = client.get(f"/api/batches/{batch_id}/status/")
    status_data = status_response.json()
    
    assert status_data["progress"] <= 100.0
    assert status_data["processed_count"] <= status_data["total_samples"]


def test_report_pass_rate_not_exceed_100(db_session):
    """测试报告通过率不会超过100%"""
    client.post(
        "/api/rules/",
        json={
            "name": "测试规则",
            "path_pattern": "/api/*",
            "method": "*",
            "rewrite_path": "/api/v2/",
            "is_active": True,
            "priority": 100
        }
    )
    
    for i in range(5):
        client.post(
            "/api/samples/",
            json={
                "path": f"/api/{i}",
                "method": "GET",
                "expected_status": 200,
                "expected_response": '{"status": "ok"}'
            }
        )
    
    batch_response = client.post(
        "/api/batches/",
        json={
            "name": "通过率测试批次",
            "rule_ids": [1]
        }
    )
    batch_id = batch_response.json()["id"]
    
    client.post(f"/api/batches/{batch_id}/execute/")
    
    import time
    time.sleep(0.1)
    
    report_response = client.post(f"/api/batches/{batch_id}/generate-report/")
    report_data = report_response.json()
    
    assert report_data["content"]["statistics"]["pass_rate"] <= 100.0
    assert report_data["content"]["statistics"]["total_samples"] == 5


def test_diff_reason_generation(db_session):
    """测试差异原因能够正确生成"""
    client.post(
        "/api/rules/",
        json={
            "name": "重写规则",
            "path_pattern": "/api/v1/*",
            "method": "*",
            "rewrite_path": "/api/v2/",
            "target_url": "http://backend",
            "is_active": True,
            "priority": 100
        }
    )
    
    for i in range(3):
        client.post(
            "/api/samples/",
            json={
                "path": f"/api/v1/resource/{i}",
                "method": "GET",
                "expected_status": 200,
                "expected_response": '{"data": {"value": "original"}}'
            }
        )
    
    batch_response = client.post(
        "/api/batches/",
        json={
            "name": "差异测试批次",
            "rule_ids": [1]
        }
    )
    batch_id = batch_response.json()["id"]
    
    client.post(f"/api/batches/{batch_id}/execute/")
    
    import time
    time.sleep(0.1)
    
    diffs_response = client.get("/api/diffs/?limit=100")
    diffs = diffs_response.json()
    
    for diff in diffs:
        assert diff["category"] in [
            "status_code_mismatch", 
            "response_body_mismatch", 
            "path_rewrite_applied",
            "response_error",
            "redirect_detected"
        ]
        assert diff["severity"] in ["high", "medium", "low", "info"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
