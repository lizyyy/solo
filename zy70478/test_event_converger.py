import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
from main import app, get_db

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

models.Base.metadata.drop_all(bind=engine)
models.Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


def test_submit_batch_with_null_values():
    batch_data = {
        "batch_id": "BATCH-001",
        "source": "高峰药房配送系统",
        "description": "测试批次 - 包含空值场景",
        "events": [
            {
                "event_id": "EVT-001",
                "original_data": {
                    "order_id": "ORD-001",
                    "pharmacy_id": "PHARM-001",
                    "delivery_status": None,
                    "receipt_status": ""
                }
            },
            {
                "event_id": "EVT-002",
                "original_data": {
                    "order_id": "ORD-002",
                    "pharmacy_id": "PHARM-001",
                    "delivery_status": "success",
                    "receipt_status": "已送达"
                }
            },
            {
                "event_id": "EVT-003",
                "original_data": {
                    "order_id": "ORD-003",
                    "pharmacy_id": "PHARM-002",
                    "delivery_status": "failed",
                    "receipt_status": "失败"
                }
            },
            {
                "event_id": "EVT-004",
                "original_data": {
                    "order_id": "ORD-004",
                    "pharmacy_id": "PHARM-002",
                    "delivery_status": "unknown_status",
                    "receipt_status": None
                }
            }
        ]
    }
    
    response = client.post("/api/batches/submit", json=batch_data)
    assert response.status_code == 200
    result = response.json()
    assert result["batch_id"] == "BATCH-001"
    assert result["is_duplicate"] == False
    print("✓ 批次提交成功")


def test_duplicate_batch_detection():
    batch_data = {
        "batch_id": "BATCH-002",
        "source": "高峰药房配送系统",
        "description": "测试重复批次检测",
        "events": [
            {
                "event_id": "EVT-005",
                "original_data": {
                    "order_id": "ORD-005",
                    "delivery_status": "success"
                }
            }
        ]
    }
    
    response1 = client.post("/api/batches/submit", json=batch_data)
    assert response1.status_code == 200
    
    batch_data["batch_id"] = "BATCH-003"
    response2 = client.post("/api/batches/submit", json=batch_data)
    assert response2.status_code == 200
    result = response2.json()
    assert result["is_duplicate"] == True
    assert "复用旧结果" in result["message"]
    print("✓ 重复批次检测成功")


def test_get_batch_detail():
    response = client.get("/api/batches/BATCH-001")
    assert response.status_code == 200
    batch_detail = response.json()
    assert batch_detail["batch_id"] == "BATCH-001"
    assert len(batch_detail["events"]) == 4
    print("✓ 获取批次详情成功")


def test_risk_level_query():
    response = client.get("/api/events/risk/high")
    assert response.status_code == 200
    result = response.json()
    assert result["risk_level"] == "high"
    print(f"✓ 高风险事件查询成功，共 {result['total_count']} 条")


def test_get_processing_report():
    response = client.get("/api/batches/BATCH-001/report")
    assert response.status_code == 200
    reports = response.json()
    assert len(reports) > 0
    report = reports[0]
    assert "before_summary" in report
    assert "after_summary" in report
    assert "next_steps" in report
    assert "execution_time_ms" in report
    print("✓ 处理报告查询成功")


def test_export_batch_result():
    response = client.get("/api/batches/BATCH-001/export")
    assert response.status_code == 200
    export_result = response.json()
    assert export_result["batch_id"] == "BATCH-001"
    assert "outsourcing_acceptances" in export_result["data"]
    print("✓ 批次结果导出成功")


def test_get_rules():
    response = client.get("/api/rules")
    assert response.status_code == 200
    rules = response.json()
    assert len(rules) > 0
    print(f"✓ 获取规则列表成功，共 {len(rules)} 个版本")


def test_get_active_rule():
    response = client.get("/api/rules/active")
    assert response.status_code == 200
    rule = response.json()
    assert rule["is_active"] == True
    print(f"✓ 当前活跃规则版本: {rule['version']}")


def test_event_with_merged():
    batch_data = {
        "batch_id": "BATCH-MERGE",
        "source": "测试合并",
        "events": [
            {
                "event_id": "MERGE-001",
                "original_data": {
                    "order_id": "MERGE-ORD",
                    "pharmacy_id": "PHARM-001",
                    "delivery_date": "2024-01-01",
                    "delivery_status": "success"
                }
            },
            {
                "event_id": "MERGE-002",
                "original_data": {
                    "order_id": "MERGE-ORD",
                    "pharmacy_id": "PHARM-001",
                    "delivery_date": "2024-01-01",
                    "delivery_status": "success"
                }
            }
        ]
    }
    
    client.post("/api/batches/submit", json=batch_data)
    
    batch_response = client.get("/api/batches/BATCH-MERGE")
    events = batch_response.json()["events"]
    
    for event in events:
        if event["is_merged"]:
            parent_id = event["merged_into_event_id"]
            response = client.get(f"/api/events/{parent_id}")
            assert response.status_code == 200
            event_detail = response.json()
            assert "merged_events" in event_detail
            print("✓ 合并事件追溯成功")
            break


def test_outsourcing_by_risk():
    response = client.get("/api/outsourcing/risk/high")
    assert response.status_code == 200
    records = response.json()
    print(f"✓ 按风险等级查询外包验收记录成功，共 {len(records)} 条")


def test_audit_logs():
    response = client.get("/api/audit-logs")
    assert response.status_code == 200
    logs = response.json()
    print(f"✓ 获取审计日志成功，共 {len(logs)} 条")


def test_list_all_batches():
    response = client.get("/api/batches")
    assert response.status_code == 200
    batches = response.json()
    print(f"✓ 获取批次列表成功，共 {len(batches)} 个批次")


if __name__ == "__main__":
    print("=" * 60)
    print("开始测试事件收敛器后端服务...")
    print("=" * 60)
    
    test_submit_batch_with_null_values()
    test_duplicate_batch_detection()
    test_get_batch_detail()
    test_list_all_batches()
    test_risk_level_query()
    test_get_processing_report()
    test_export_batch_result()
    test_get_rules()
    test_get_active_rule()
    test_event_with_merged()
    test_outsourcing_by_risk()
    test_audit_logs()
    
    print("=" * 60)
    print("所有测试通过！✓")
    print("=" * 60)
