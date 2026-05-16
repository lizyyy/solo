import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from app.database import Base, get_db
from app.models import CompensationStatus, CompensationStrategy

TEST_DB_PATH = "test_compensation.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_PATH}"

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


@pytest.fixture(scope="module")
def test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)


def test_health_check(test_db):
    response = client.get("/api/v1/health/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "compensation-service"


def test_db_check(test_db):
    response = client.get("/api/v1/health/db")
    assert response.status_code == 200
    data = response.json()
    assert data["database"] == "connected"


def test_self_check(test_db):
    response = client.get("/api/v1/health/self-check")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "checks" in data
    assert "issues" in data


def test_create_compensation_record(test_db):
    response = client.post(
        "/api/v1/compensation/records",
        json={
            "queue_name": "order_queue",
            "message_id": "msg_001",
            "business_no": "ORD_20240101_001",
            "strategy": CompensationStrategy.RETRY_THREE,
            "original_input": {"order_id": "ORD_001", "amount": 100.0}
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["queue_name"] == "order_queue"
    assert data["message_id"] == "msg_001"
    assert data["business_no"] == "ORD_20240101_001"
    assert data["status"] == CompensationStatus.PENDING
    assert data["retry_count"] == 0
    assert data["max_retry"] == 3


def test_duplicate_record_check(test_db):
    response = client.post(
        "/api/v1/compensation/records",
        json={
            "queue_name": "order_queue",
            "message_id": "msg_001",
            "business_no": "ORD_20240101_001",
            "strategy": CompensationStrategy.RETRY_THREE,
            "original_input": {"order_id": "ORD_001", "amount": 100.0}
        }
    )
    assert response.status_code == 400
    assert "已存在" in response.json()["detail"]


def test_business_success_check(test_db):
    get_response = client.get("/api/v1/compensation/records/1")
    record = get_response.json()
    
    client.post(
        "/api/v1/compensation/records/1/success",
        params={
            "process_basis": "测试处理依据",
            "final_conclusion": "测试处理成功"
        }
    )
    
    response = client.post(
        "/api/v1/compensation/records",
        json={
            "queue_name": "order_queue",
            "message_id": "msg_002",
            "business_no": "ORD_20240101_001",
            "strategy": CompensationStrategy.RETRY_THREE,
            "original_input": {"order_id": "ORD_001", "amount": 100.0}
        }
    )
    assert response.status_code == 400
    assert "已成功处理" in response.json()["detail"]


def test_get_record(test_db):
    response = client.get("/api/v1/compensation/records/1")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["business_no"] == "ORD_20240101_001"


def test_get_record_by_business_no(test_db):
    response = client.get("/api/v1/compensation/records/business/ORD_20240101_001")
    assert response.status_code == 200
    data = response.json()
    assert data["business_no"] == "ORD_20240101_001"


def test_query_records(test_db):
    for i in range(5):
        client.post(
            "/api/v1/compensation/records",
            json={
                "queue_name": "order_queue",
                "message_id": f"msg_query_{i}",
                "business_no": f"ORD_QUERY_{i}",
                "strategy": CompensationStrategy.RETRY_THREE,
                "original_input": {"order_id": f"ORD_{i}"}
            }
        )
    
    response = client.post(
        "/api/v1/compensation/records/query",
        json={
            "queue_name": "order_queue",
            "page": 1,
            "page_size": 10
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 5
    assert len(data["items"]) >= 5


def test_process_record(test_db):
    create_response = client.post(
        "/api/v1/compensation/records",
        json={
            "queue_name": "process_queue",
            "message_id": "msg_process_001",
            "business_no": "ORD_PROCESS_001",
            "strategy": CompensationStrategy.RETRY_THREE,
            "original_input": {"test": "data"}
        }
    )
    record_id = create_response.json()["id"]
    
    response = client.post(f"/api/v1/compensation/records/{record_id}/process")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == CompensationStatus.PROCESSING
    assert data["retry_count"] == 1


def test_handle_success(test_db):
    create_response = client.post(
        "/api/v1/compensation/records",
        json={
            "queue_name": "success_queue",
            "message_id": "msg_success_001",
            "business_no": "ORD_SUCCESS_001",
            "strategy": CompensationStrategy.RETRY_THREE,
            "original_input": {"test": "data"}
        }
    )
    record_id = create_response.json()["id"]
    
    client.post(f"/api/v1/compensation/records/{record_id}/process")
    
    response = client.post(
        f"/api/v1/compensation/records/{record_id}/success",
        params={
            "process_basis": "根据业务规则处理",
            "final_conclusion": "订单补偿成功，金额已退还"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == CompensationStatus.SUCCESS
    assert data["process_basis"] == "根据业务规则处理"
    assert data["final_conclusion"] == "订单补偿成功，金额已退还"
    assert data["processed_at"] is not None


def test_handle_failure(test_db):
    create_response = client.post(
        "/api/v1/compensation/records",
        json={
            "queue_name": "failure_queue",
            "message_id": "msg_failure_001",
            "business_no": "ORD_FAILURE_001",
            "strategy": CompensationStrategy.RETRY_THREE,
            "original_input": {"test": "data"}
        }
    )
    record_id = create_response.json()["id"]
    
    client.post(f"/api/v1/compensation/records/{record_id}/process")
    
    response = client.post(
        f"/api/v1/compensation/records/{record_id}/failure",
        params={
            "error_message": "网络超时",
            "process_basis": "调用第三方接口失败"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == CompensationStatus.PENDING
    assert data["error_message"] == "网络超时"


def test_manual_fix(test_db):
    create_response = client.post(
        "/api/v1/compensation/records",
        json={
            "queue_name": "manual_queue",
            "message_id": "msg_manual_001",
            "business_no": "ORD_MANUAL_001",
            "strategy": CompensationStrategy.MANUAL,
            "original_input": {"test": "data"}
        }
    )
    
    response = client.post(
        "/api/v1/compensation/records/manual-fix",
        json={
            "business_no": "ORD_MANUAL_001",
            "final_conclusion": "人工处理完成，已联系客户解决",
            "process_basis": "根据客服记录处理",
            "operator": "admin"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == CompensationStatus.MANUAL_FIXED
    assert data["final_conclusion"] == "人工处理完成，已联系客户解决"


def test_skip_record(test_db):
    create_response = client.post(
        "/api/v1/compensation/records",
        json={
            "queue_name": "skip_queue",
            "message_id": "msg_skip_001",
            "business_no": "ORD_SKIP_001",
            "strategy": CompensationStrategy.SKIP,
            "original_input": {"test": "data"}
        }
    )
    record_id = create_response.json()["id"]
    
    response = client.post(
        f"/api/v1/compensation/records/{record_id}/skip",
        params={
            "operator": "system",
            "remark": "重复消息，跳过处理"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == CompensationStatus.SKIPPED


def test_record_history(test_db):
    create_response = client.post(
        "/api/v1/compensation/records",
        json={
            "queue_name": "history_queue",
            "message_id": "msg_history_001",
            "business_no": "ORD_HISTORY_001",
            "strategy": CompensationStrategy.RETRY_THREE,
            "original_input": {"test": "data"}
        }
    )
    record_id = create_response.json()["id"]
    
    client.post(f"/api/v1/compensation/records/{record_id}/process")
    
    response = client.get(f"/api/v1/compensation/records/{record_id}/history")
    assert response.status_code == 200
    histories = response.json()
    assert len(histories) >= 2
    
    create_history = next((h for h in histories if "创建" in h.get("remark", "")), None)
    assert create_history is not None
    assert create_history["from_status"] is None
    assert create_history["to_status"] == CompensationStatus.PENDING
    
    process_history = next((h for h in histories if "开始处理" in h.get("remark", "")), None)
    assert process_history is not None
    assert process_history["from_status"] == CompensationStatus.PENDING
    assert process_history["to_status"] == CompensationStatus.PROCESSING


def test_batch_create(test_db):
    response = client.post(
        "/api/v1/compensation/records/batch",
        json={
            "queue_name": "batch_queue",
            "records": [
                {
                    "queue_name": "batch_queue",
                    "message_id": "batch_msg_001",
                    "business_no": "BATCH_ORD_001",
                    "strategy": CompensationStrategy.RETRY_THREE,
                    "original_input": {"test": 1}
                },
                {
                    "queue_name": "batch_queue",
                    "message_id": "batch_msg_002",
                    "business_no": "BATCH_ORD_002",
                    "strategy": CompensationStrategy.RETRY_THREE,
                    "original_input": {"test": 2}
                },
                {
                    "queue_name": "batch_queue",
                    "message_id": "batch_msg_003",
                    "business_no": "BATCH_ORD_003",
                    "strategy": CompensationStrategy.RETRY_THREE,
                    "original_input": {"test": 3}
                }
            ]
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 3
    assert data["success_count"] == 3
    assert data["status"] == "completed"
    assert data["batch_id"] is not None


def test_get_batch(test_db):
    batch_response = client.post(
        "/api/v1/compensation/records/batch",
        json={
            "queue_name": "get_batch_queue",
            "records": [
                {
                    "queue_name": "get_batch_queue",
                    "message_id": "get_batch_msg_001",
                    "business_no": "GET_BATCH_ORD_001",
                    "strategy": CompensationStrategy.RETRY_THREE,
                    "original_input": {"test": 1}
                }
            ]
        }
    )
    batch_id = batch_response.json()["batch_id"]
    
    response = client.get(f"/api/v1/compensation/batches/{batch_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["batch_id"] == batch_id
    assert data["queue_name"] == "get_batch_queue"


def test_export_records(test_db):
    for i in range(3):
        client.post(
            "/api/v1/compensation/records",
            json={
                "queue_name": "export_queue",
                "message_id": f"export_msg_{i}",
                "business_no": f"EXPORT_ORD_{i}",
                "strategy": CompensationStrategy.RETRY_THREE,
                "original_input": {"test": i}
            }
        )
    
    response = client.post(
        "/api/v1/compensation/export",
        json={
            "queue_name": "export_queue"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == True
    assert data["total_count"] == 3
    assert os.path.exists(data["file_path"])


def test_create_report(test_db):
    response = client.post(
        "/api/v1/compensation/reports",
        json={
            "queue_name": "export_queue"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["report_id"] is not None
    assert data["total_count"] >= 3


def test_get_report(test_db):
    report_response = client.post(
        "/api/v1/compensation/reports",
        json={
            "queue_name": "export_queue"
        }
    )
    report_id = report_response.json()["report_id"]
    
    response = client.get(f"/api/v1/compensation/reports/{report_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["report_id"] == report_id


def test_stats(test_db):
    response = client.get("/api/v1/health/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "statistics" in data
    assert data["statistics"]["total_records"] > 0
    assert data["statistics"]["total_histories"] > 0


def test_consistency_check(test_db):
    create_response = client.post(
        "/api/v1/compensation/records",
        json={
            "queue_name": "consistency_queue",
            "message_id": "consistency_msg_001",
            "business_no": "CONSISTENCY_ORD_001",
            "strategy": CompensationStrategy.RETRY_THREE,
            "original_input": {"test": "data"}
        }
    )
    record_id = create_response.json()["id"]
    
    client.post(f"/api/v1/compensation/records/{record_id}/process")
    client.post(
        f"/api/v1/compensation/records/{record_id}/success",
        params={
            "process_basis": "一致性测试",
            "final_conclusion": "测试成功"
        }
    )
    
    record_response = client.get(f"/api/v1/compensation/records/{record_id}")
    record = record_response.json()
    
    history_response = client.get(f"/api/v1/compensation/records/{record_id}/history")
    histories = history_response.json()
    
    assert record["status"] == CompensationStatus.SUCCESS
    assert len(histories) >= 3
    
    success_history = next((h for h in histories if h["to_status"] == CompensationStatus.SUCCESS), None)
    assert success_history is not None
    assert record["status"] == success_history["to_status"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
