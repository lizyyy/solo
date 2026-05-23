import pytest
import json
from tests.conftest import get_token


def create_test_ledger_data(loss_weight=5.0):
    return {
        "supplier_id": "SUP001",
        "supplier_name": "优质果蔬供应商",
        "batch_no": "BATCH20240101001",
        "product_name": "红富士苹果",
        "total_weight": 100.0,
        "loss_weight": loss_weight,
        "loss_type": "bad_fruit",
        "remark": "测试台账",
        "data_sources": [
            {
                "source_type": "supplier_delivery",
                "source_no": "DEL001",
                "source_data": json.dumps({"delivery_no": "DEL001", "supplier_id": "SUP001", "delivery_date": "2024-01-01"})
            },
            {
                "source_type": "weighing_record",
                "source_no": "WEIGH001",
                "source_data": json.dumps({"weighing_no": "WEIGH001", "weighing_time": "2024-01-01 08:00:00", "operator": "张三"})
            }
        ],
        "loss_items": [
            {
                "item_no": "ITEM001",
                "product_name": "红富士苹果",
                "weight": 3.0,
                "loss_reason": "表面碰伤",
                "source_type": "supplier_delivery",
                "deduplication_key": "ITEM001-红富士苹果-3.0-表面碰伤"
            },
            {
                "item_no": "ITEM002",
                "product_name": "红富士苹果",
                "weight": 2.0,
                "loss_reason": "腐烂",
                "source_type": "weighing_record",
                "deduplication_key": "ITEM002-红富士苹果-2.0-腐烂"
            }
        ]
    }


def test_complete_status_flow(client, db_session):
    sorter_token = get_token(client, "sorter1")
    supervisor_token = get_token(client, "supervisor1")
    manager_token = get_token(client, "manager1")
    
    ledger_data = create_test_ledger_data()
    response = client.post(
        "/ledger",
        json=ledger_data,
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    assert response.status_code == 200
    ledger_id = response.json()["id"]
    assert response.json()["status"] == "draft"
    assert len(response.json()["status_histories"]) == 1
    
    response = client.post(
        f"/ledger/{ledger_id}/submit",
        json={"change_reason": "数据核对无误，提交审核"},
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "submitted"
    assert len(response.json()["status_histories"]) == 2
    
    response = client.post(
        f"/ledger/{ledger_id}/reject",
        json={"change_reason": "损耗原因描述不详细，请补充说明"},
        headers={"Authorization": f"Bearer {supervisor_token}"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
    
    response = client.post(
        f"/ledger/{ledger_id}/submit",
        json={"change_reason": "已补充损耗原因，重新提交"},
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "submitted"
    
    response = client.post(
        f"/ledger/{ledger_id}/secondary-confirm",
        json={"change_reason": "二次确认无误，损耗属实"},
        headers={"Authorization": f"Bearer {supervisor_token}"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "secondary_confirmed"
    
    response = client.post(
        f"/ledger/{ledger_id}/audit-only",
        json={"change_reason": "审计完成，归档"},
        headers={"Authorization": f"Bearer {manager_token}"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "audit_only"
    
    response = client.get(
        f"/ledger/{ledger_id}",
        headers={"Authorization": f"Bearer {manager_token}"}
    )
    assert response.status_code == 200
    histories = response.json()["status_histories"]
    assert len(histories) >= 6
    for h in histories:
        assert h["change_reason"]
        assert h["change_time"]


def test_invalid_status_transition(client, db_session):
    sorter_token = get_token(client, "sorter1")
    supervisor_token = get_token(client, "supervisor1")
    
    ledger_data = create_test_ledger_data()
    response = client.post(
        "/ledger",
        json=ledger_data,
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    ledger_id = response.json()["id"]
    
    response = client.post(
        f"/ledger/{ledger_id}/secondary-confirm",
        json={"change_reason": "跳过提交直接确认"},
        headers={"Authorization": f"Bearer {supervisor_token}"}
    )
    assert response.status_code == 400
    assert "无法从" in response.json()["detail"]


def test_role_permission_control(client, db_session):
    sorter_token = get_token(client, "sorter1")
    manager_token = get_token(client, "manager1")
    
    ledger_data = create_test_ledger_data()
    response = client.post(
        "/ledger",
        json=ledger_data,
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    ledger_id = response.json()["id"]
    
    response = client.post(
        f"/ledger/{ledger_id}/secondary-confirm",
        json={"change_reason": "分拣员尝试直接确认"},
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    assert response.status_code == 403
    
    response = client.post(
        f"/ledger/{ledger_id}/submit",
        json={"change_reason": "提交审核"},
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    assert response.status_code == 200
    
    response = client.post(
        f"/ledger/{ledger_id}/reject",
        json={"change_reason": "采购经理驳回"},
        headers={"Authorization": f"Bearer {manager_token}"}
    )
    assert response.status_code == 200


def test_audit_only_no_further_changes(client, db_session):
    sorter_token = get_token(client, "sorter1")
    manager_token = get_token(client, "manager1")
    auditor_token = get_token(client, "auditor1")
    
    ledger_data = create_test_ledger_data()
    response = client.post(
        "/ledger",
        json=ledger_data,
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    ledger_id = response.json()["id"]
    
    client.post(f"/ledger/{ledger_id}/submit", json={"change_reason": "提交"}, headers={"Authorization": f"Bearer {sorter_token}"})
    client.post(f"/ledger/{ledger_id}/secondary-confirm", json={"change_reason": "确认"}, headers={"Authorization": f"Bearer {manager_token}"})
    client.post(f"/ledger/{ledger_id}/audit-only", json={"change_reason": "审计归档"}, headers={"Authorization": f"Bearer {auditor_token}"})
    
    response = client.post(
        f"/ledger/{ledger_id}/secondary-confirm",
        json={"change_reason": "尝试重复确认"},
        headers={"Authorization": f"Bearer {manager_token}"}
    )
    assert response.status_code == 400
