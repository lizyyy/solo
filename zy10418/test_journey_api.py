import pytest
from fastapi.testclient import TestClient
from datetime import datetime
import json
import os

if os.path.exists("./journey_registry.db"):
    os.remove("./journey_registry.db")

from main import app

client = TestClient(app)


SAMPLE_JOURNEY = {
    "name": "用户登录流程巡检",
    "description": "端到端测试用户从登录到查看 dashboard 的完整流程",
    "steps": [
        {
            "step_id": "step_001",
            "name": "访问登录页",
            "action": "navigate_to_url",
            "params": {"url": "https://example.com/login"},
            "expected_result": "页面加载成功",
            "timeout": 30
        },
        {
            "step_id": "step_002",
            "name": "输入用户名",
            "action": "input_text",
            "params": {"selector": "#username", "text": "test_user"},
            "expected_result": "用户名输入成功",
            "timeout": 10
        },
        {
            "step_id": "step_003",
            "name": "提交登录",
            "action": "click_button",
            "params": {"selector": "#submit"},
            "expected_result": "登录成功跳转",
            "timeout": 30
        }
    ],
    "dependent_services": [
        {
            "service_name": "auth_service",
            "service_type": "authentication",
            "endpoint": "https://auth.example.com",
            "health_check": "/health"
        },
        {
            "service_name": "dashboard_service",
            "service_type": "ui_service",
            "endpoint": "https://dashboard.example.com"
        }
    ],
    "run_frequency": "hourly"
}


DIRTY_DATA_CASES = [
    {
        "name": "空步骤名称",
        "data": {
            **SAMPLE_JOURNEY,
            "name": "无效旅程_空步骤",
            "steps": [{**SAMPLE_JOURNEY["steps"][0], "name": ""}
        ],
        "expected_status": 200,
        "expected_validation_status": "invalid"
    },
    {
        "name": "重复步骤ID",
        "data": {
            **SAMPLE_JOURNEY,
            "name": "无效旅程_重复ID",
            "steps": [
                SAMPLE_JOURNEY["steps"][0],
                {**SAMPLE_JOURNEY["steps"][0], "name": "重复步骤"}
            ]
        },
        "expected_status": 200,
        "expected_validation_status": "invalid"
    },
    {
        "name": "空操作字段",
        "data": {
            **SAMPLE_JOURNEY,
            "name": "无效旅程_空操作",
            "steps": [{**SAMPLE_JOURNEY["steps"][0], "action": ""}
        ],
        "expected_status": 200,
        "expected_validation_status": "invalid"
    }
]


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data


def test_create_journey_normal_flow():
    response = client.post("/api/journeys", json=SAMPLE_JOURNEY)
    assert response.status_code == 200
    data = response.json()
    
    assert data["name"] == SAMPLE_JOURNEY["name"]
    assert data["status"] == "valid"
    assert len(data["steps"]) == 3
    
    assert "step_validation_status" in data
    assert data["step_validation_status"]["overall_status"] == "valid"
    
    assert "dependency_map" in data
    assert "service_to_steps" in data["dependency_map"]
    
    assert "registration_report" in data
    assert data["registration_report"]["validation_summary"]["valid_steps"] == 3
    
    return data["id"]


def test_create_journey_duplicate_name():
    response = client.post("/api/journeys", json=SAMPLE_JOURNEY)
    assert response.status_code == 409
    data = response.json()
    assert "detail" in data
    assert "已存在" in data["detail"]["message"]
    assert "raw_input" in data["detail"]


@pytest.mark.parametrize("case", DIRTY_DATA_CASES)
def test_dirty_data_cases(case):
    response = client.post("/api/journeys", json=case["data"])
    assert response.status_code == case["expected_status"]
    
    if case["expected_status"] == 200:
        data = response.json()
        assert data["status"] == case["expected_validation_status"]
        assert data["step_validation_status"]["overall_status"] == case["expected_validation_status"]


def test_list_journeys():
    response = client.get("/api/journeys")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_get_journey():
    create_response = client.post("/api/journeys", json={
        **SAMPLE_JOURNEY,
        "name": "获取测试旅程"
    })
    journey_id = create_response.json()["id"]
    
    response = client.get(f"/api/journeys/{journey_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == journey_id
    assert data["name"] == "获取测试旅程"


def test_get_journey_not_found():
    response = client.get("/api/journeys/99999")
    assert response.status_code == 404


def test_update_journey_status():
    create_response = client.post("/api/journeys", json={
        **SAMPLE_JOURNEY,
        "name": "状态更新测试旅程"
    })
    journey_id = create_response.json()["id"]
    
    response = client.put(f"/api/journeys/{journey_id}/status?new_status=active")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "active"


def test_update_journey_invalid_status():
    create_response = client.post("/api/journeys", json={
        **SAMPLE_JOURNEY,
        "name": "无效状态测试旅程"
    })
    journey_id = create_response.json()["id"]
    
    response = client.put(f"/api/journeys/{journey_id}/status?new_status=invalid_status")
    assert response.status_code == 400
    data = response.json()
    assert "valid_statuses" in data["detail"]


def test_validate_journey():
    create_response = client.post("/api/journeys", json={
        **SAMPLE_JOURNEY,
        "name": "重新验证测试旅程"
    })
    journey_id = create_response.json()["id"]
    
    response = client.post(f"/api/journeys/{journey_id}/validate")
    assert response.status_code == 200
    data = response.json()
    assert "step_validation_status" in data


def test_add_failure_sample():
    create_response = client.post("/api/journeys", json={
        **SAMPLE_JOURNEY,
        "name": "失败样本测试旅程"
    })
    journey_id = create_response.json()["id"]
    
    failure_sample = {
        "timestamp": datetime.utcnow().isoformat(),
        "error_type": "timeout_error",
        "error_message": "页面加载超时",
        "context": {"url": "https://example.com"},
        "step_id": "step_001"
    }
    
    response = client.post(f"/api/journeys/{journey_id}/failure-sample", json=failure_sample)
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "失败样本已归档"
    assert data["sample_count"] == 1


def test_manual_correction_and_recalculate():
    invalid_journey = {
        "name": "人工修正测试旅程",
        "description": "初始状态无效的旅程",
        "steps": [
            {
                "step_id": "step_001",
                "name": "",
                "action": "navigate_to_url",
                "params": {"url": "https://example.com"}
            }
        ],
        "run_frequency": "daily"
    }
    
    create_response = client.post("/api/journeys", json=invalid_journey)
    assert create_response.status_code == 200
    journey_id = create_response.json()["id"]
    initial_data = create_response.json()
    assert initial_data["status"] == "invalid"
    
    corrected_steps = [
        {
            "step_id": "step_001",
            "name": "访问登录页",
            "action": "navigate_to_url",
            "params": {"url": "https://example.com"},
            "expected_result": "页面加载成功",
            "timeout": 30
        }
    ]
    
    correction = {
        "correction_type": "step_fix",
        "field": "steps",
        "old_value": initial_data["steps"],
        "new_value": corrected_steps,
        "reason": "修正了空的步骤名称",
        "corrected_by": "运维工程师"
    }
    
    response = client.post(f"/api/journeys/{journey_id}/manual-correction", json=correction)
    assert response.status_code == 200
    corrected_data = response.json()
    
    assert corrected_data["status"] == "valid"
    assert len(corrected_data["manual_corrections"]) == 1
    assert corrected_data["step_validation_status"]["overall_status"] == "valid"


def test_export_journey():
    create_response = client.post("/api/journeys", json={
        **SAMPLE_JOURNEY,
        "name": "导出测试旅程"
    })
    journey_id = create_response.json()["id"]
    
    response = client.get(f"/api/journeys/{journey_id}/export")
    assert response.status_code == 200
    data = response.json()
    
    assert "journey" in data
    assert "export_metadata" in data
    assert data["export_metadata"]["export_format"] == "json"


def test_frequency_conflict_detection():
    response1 = client.post("/api/journeys", json={
        **SAMPLE_JOURNEY,
        "name": "频率冲突测试1"
    })
    assert response1.status_code == 200
    
    response2 = client.post("/api/journeys", json={
        **SAMPLE_JOURNEY,
        "name": "频率冲突测试2"
    })
    assert response2.status_code == 200
    data = response2.json()
    
    assert len(data["frequency_conflicts"]) >= 1


def test_delete_journey():
    create_response = client.post("/api/journeys", json={
        **SAMPLE_JOURNEY,
        "name": "删除测试旅程"
    })
    journey_id = create_response.json()["id"]
    
    response = client.delete(f"/api/journeys/{journey_id}")
    assert response.status_code == 200
    
    get_response = client.get(f"/api/journeys/{journey_id}")
    assert get_response.status_code == 404


def test_filter_journeys_by_status():
    client.post("/api/journeys", json={
        **SAMPLE_JOURNEY,
        "name": "过滤测试旅程_active"
    })
    
    response = client.get("/api/journeys?status=valid")
    assert response.status_code == 200
    data = response.json()
    for journey in data:
        assert journey["status"] == "valid"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
