import pytest
import json
from tests.conftest import get_token


def create_test_ledger_data():
    return {
        "supplier_id": "SUP001",
        "supplier_name": "优质果蔬供应商",
        "batch_no": "BATCH20240101001",
        "product_name": "红富士苹果",
        "total_weight": 100.0,
        "loss_weight": 5.0,
        "loss_type": "bad_fruit",
        "remark": "测试台账",
        "data_sources": [
            {
                "source_type": "supplier_delivery",
                "source_no": "DEL001",
                "source_data": json.dumps({"delivery_no": "DEL001", "supplier_id": "SUP001", "delivery_date": "2024-01-01"})
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


def test_duplicate_loss_item_detection(client, db_session):
    sorter_token = get_token(client, "sorter1")
    
    ledger_data = create_test_ledger_data()
    ledger_data["loss_items"].append({
        "item_no": "ITEM003",
        "product_name": "红富士苹果",
        "weight": 3.0,
        "loss_reason": "表面碰伤",
        "source_type": "supplier_delivery",
        "deduplication_key": "ITEM001-红富士苹果-3.0-表面碰伤"
    })
    
    response = client.post(
        "/ledger",
        json=ledger_data,
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    assert response.status_code == 200
    loss_items = response.json()["loss_items"]
    invalid_items = [item for item in loss_items if item["record_status"] != "valid"]
    assert len(invalid_items) >= 1


def test_weight_validation(client, db_session):
    sorter_token = get_token(client, "sorter1")
    
    ledger_data = create_test_ledger_data()
    ledger_data["loss_weight"] = 150.0
    
    response = client.post(
        "/ledger",
        json=ledger_data,
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    assert response.status_code == 400
    assert "不能大于总重量" in response.json()["detail"]
    
    ledger_data["loss_weight"] = -5.0
    response = client.post(
        "/ledger",
        json=ledger_data,
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    assert response.status_code == 400
    assert "不能为负数" in response.json()["detail"]


def test_loss_item_weight_mismatch(client, db_session):
    sorter_token = get_token(client, "sorter1")
    
    ledger_data = create_test_ledger_data()
    ledger_data["loss_weight"] = 10.0
    
    response = client.post(
        "/ledger",
        json=ledger_data,
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    assert response.status_code == 400
    assert "不一致" in response.json()["detail"]


def test_invalid_data_source_format(client, db_session):
    sorter_token = get_token(client, "sorter1")
    
    ledger_data = create_test_ledger_data()
    ledger_data["data_sources"] = [
        {
            "source_type": "supplier_delivery",
            "source_no": "DEL001",
            "source_data": "invalid json {"
        }
    ]
    ledger_data["loss_items"] = []
    ledger_data["loss_weight"] = 0.0
    
    response = client.post(
        "/ledger",
        json=ledger_data,
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    assert response.status_code == 200
    data_sources = response.json()["data_sources"]
    invalid_sources = [s for s in data_sources if not s["is_valid"]]
    assert len(invalid_sources) >= 1


def test_data_source_missing_fields(client, db_session):
    sorter_token = get_token(client, "sorter1")
    
    ledger_data = create_test_ledger_data()
    ledger_data["data_sources"] = [
        {
            "source_type": "supplier_delivery",
            "source_no": "DEL001",
            "source_data": json.dumps({"delivery_no": "DEL001"})
        }
    ]
    ledger_data["loss_items"] = []
    ledger_data["loss_weight"] = 0.0
    
    response = client.post(
        "/ledger",
        json=ledger_data,
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    assert response.status_code == 200
    data_sources = response.json()["data_sources"]
    invalid_sources = [s for s in data_sources if not s["is_valid"]]
    assert len(invalid_sources) >= 1
    assert "缺少必填字段" in invalid_sources[0]["validation_message"]


def test_versioning_on_update(client, db_session):
    sorter_token = get_token(client, "sorter1")
    
    ledger_data = create_test_ledger_data()
    response = client.post(
        "/ledger",
        json=ledger_data,
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    ledger_id = response.json()["id"]
    ledger_no = response.json()["ledger_no"]
    assert response.json()["current_version"] == 1
    assert response.json()["is_latest"] == True
    
    response = client.put(
        f"/ledger/{ledger_id}",
        json={"remark": "更新备注"},
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    assert response.status_code == 200
    assert response.json()["current_version"] == 2
    assert response.json()["is_latest"] == True
    
    response = client.get(
        f"/ledger/{ledger_no}/versions",
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    assert response.status_code == 200
    versions = response.json()
    assert len(versions) == 2


def test_cannot_update_submitted_ledger(client, db_session):
    sorter_token = get_token(client, "sorter1")
    
    ledger_data = create_test_ledger_data()
    response = client.post(
        "/ledger",
        json=ledger_data,
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    ledger_id = response.json()["id"]
    
    client.post(
        f"/ledger/{ledger_id}/submit",
        json={"change_reason": "提交审核"},
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    
    response = client.put(
        f"/ledger/{ledger_id}",
        json={"remark": "尝试修改已提交台账"},
        headers={"Authorization": f"Bearer {sorter_token}"}
    )
    assert response.status_code == 400
    assert "只能在草稿或已驳回状态下修改" in response.json()["detail"]
