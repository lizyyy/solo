import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import json
import os

from main import app

@pytest.fixture(scope="module")
def client():
    # 使用内存数据库进行测试
    test_client = TestClient(app)
    # 先创建基础数据
    test_client.post("/cabinets/", json={"cabinet_no": "TEST001", "location": "测试位置"})
    test_client.post("/skus/", json={"sku_code": "TESTSKU001", "name": "测试商品", "price": 10.0, "unit": "件"})
    yield test_client
    # 测试完成后清理
    if os.path.exists("smart_cabinet.db"):
        try:
            os.remove("smart_cabinet.db")
        except:
            pass

def test_read_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()

def test_create_cabinet(client):
    response = client.post(
        "/cabinets/",
        json={"cabinet_no": "TEST002", "location": "测试位置2"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["cabinet_no"] == "TEST002"

def test_create_duplicate_cabinet(client):
    response = client.post(
        "/cabinets/",
        json={"cabinet_no": "TEST001", "location": "测试位置2"}
    )
    assert response.status_code == 400

def test_list_cabinets(client):
    response = client.get("/cabinets/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_sku(client):
    response = client.post(
        "/skus/",
        json={"sku_code": "TESTSKU002", "name": "测试商品2", "price": 20.0, "unit": "件"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["sku_code"] == "TESTSKU002"

def test_list_skus(client):
    response = client.get("/skus/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_inventory_snapshot(client):
    response = client.post(
        "/inventory/snapshots/",
        json={
            "cabinet_no": "TEST001",
            "sku_code": "TESTSKU001",
            "quantity": 100,
            "batch_no": "BATCH001",
            "created_by": "tester"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["quantity"] == 100

def test_create_snapshot_nonexistent_cabinet(client):
    response = client.post(
        "/inventory/snapshots/",
        json={
            "cabinet_no": "NONEXIST",
            "sku_code": "TESTSKU001",
            "quantity": 100
        }
    )
    assert response.status_code == 404

def test_list_inventory_snapshots(client):
    response = client.get("/inventory/snapshots/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_replenishment(client):
    response = client.post(
        "/replenishments/",
        json={
            "cabinet_no": "TEST001",
            "replenishment_no": "TESTREP001",
            "items": [
                {"sku_code": "TESTSKU001", "quantity": 50, "batch_no": "BATCH002"}
            ],
            "remark": "测试补货",
            "operator_id": "OP001",
            "operator_name": "测试员"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["replenishment_no"] == "TESTREP001"

def test_confirm_replenishment(client):
    response = client.post(
        "/replenishments/TESTREP001/confirm",
        json={"operator_id": "OP001", "operator_name": "测试员"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "confirmed"

def test_confirm_already_confirmed_replenishment(client):
    response = client.post(
        "/replenishments/TESTREP001/confirm",
        json={"operator_id": "OP001", "operator_name": "测试员"}
    )
    assert response.status_code == 400

def test_list_replenishments(client):
    response = client.get("/replenishments/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_damage_record(client):
    response = client.post(
        "/damages/",
        json={
            "cabinet_no": "TEST001",
            "sku_code": "TESTSKU001",
            "quantity": 2,
            "damage_type": "测试货损",
            "reason": "测试原因",
            "reporter_id": "OP001",
            "reporter_name": "测试员"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "pending"
    return data["damage_no"]

def test_confirm_damage_record(client):
    # 先创建一个新的货损记录
    response = client.post(
        "/damages/",
        json={
            "cabinet_no": "TEST001",
            "sku_code": "TESTSKU001",
            "quantity": 3,
            "damage_type": "测试货损2",
            "reason": "测试原因2",
            "reporter_id": "OP002",
            "reporter_name": "测试员2"
        }
    )
    damage_no = response.json()["damage_no"]
    
    response = client.post(
        f"/damages/{damage_no}/confirm",
        json={"confirmer_id": "MGR001", "confirmer_name": "经理"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "confirmed"

def test_list_damage_records(client):
    response = client.get("/damages/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_expired_product(client):
    response = client.post(
        "/expired-products/",
        json={
            "cabinet_no": "TEST001",
            "sku_code": "TESTSKU001",
            "quantity": 3,
            "batch_no": "EXPIRED001",
            "operator_id": "OP001",
            "operator_name": "测试员"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "pending"
    return data["record_no"]

def test_confirm_expired_product(client):
    # 先创建一个新的临期下架记录
    response = client.post(
        "/expired-products/",
        json={
            "cabinet_no": "TEST001",
            "sku_code": "TESTSKU001",
            "quantity": 4,
            "batch_no": "EXPIRED002",
            "operator_id": "OP002",
            "operator_name": "测试员2"
        }
    )
    record_no = response.json()["record_no"]
    
    response = client.post(f"/expired-products/{record_no}/confirm")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "确认成功"

def test_list_expired_products(client):
    response = client.get("/expired-products/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_settlement(client):
    response = client.post(
        "/settlements/",
        json={
            "cabinet_no": "TEST001",
            "settlement_no": "TESTSET001",
            "period_start": (datetime.now() - timedelta(days=30)).isoformat(),
            "period_end": datetime.now().isoformat(),
            "created_by": "finance"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["settlement_no"] == "TESTSET001"

def test_confirm_settlement(client):
    # 先创建结算单再确认
    client.post(
        "/settlements/",
        json={
            "cabinet_no": "TEST001",
            "settlement_no": "TESTSET002",
            "period_start": (datetime.now() - timedelta(days=30)).isoformat(),
            "period_end": datetime.now().isoformat(),
            "created_by": "finance"
        }
    )
    response = client.post(
        "/settlements/TESTSET002/confirm",
        json={"confirmed_by": "finance"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "confirmed"

def test_close_settlement(client):
    response = client.post(
        "/settlements/TESTSET001/close",
        json={
            "settlement_no": "TESTSET001",
            "reason": "测试关闭",
            "operator_id": "ADMIN001",
            "operator_name": "管理员"
        }
    )
    assert response.status_code == 200

def test_list_settlements(client):
    response = client.get("/settlements/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_correction(client):
    response = client.post(
        "/corrections/",
        json={
            "cabinet_no": "TEST001",
            "sku_code": "TESTSKU001",
            "quantity": 95,
            "reason": "盘点修正",
            "operator_id": "OP001",
            "operator_name": "测试员"
        }
    )
    assert response.status_code == 200

def test_list_operation_logs(client):
    response = client.get("/operation-logs/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_idempotent_replenishment(client):
    response = client.post(
        "/replenishments/",
        json={
            "cabinet_no": "TEST001",
            "replenishment_no": "TESTREP001",
            "items": [
                {"sku_code": "TESTSKU001", "quantity": 50}
            ]
        }
    )
    assert response.status_code == 400
