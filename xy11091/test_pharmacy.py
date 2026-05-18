import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import json

from main import app
from models import Base
from database import engine, SessionLocal
from init_data import init_sample_data

client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def sample_data(db_session):
    init_sample_data()
    yield


class TestMedicineAPI:
    def test_create_medicine_normal(self, db_session):
        response = client.post(
            "/medicines/",
            json={
                "medicine_code": "MED999",
                "medicine_name": "测试药品",
                "generic_name": "Test Medicine",
                "specification": "10mg*10片/盒",
                "dosage_form": "片剂",
                "manufacturer": "测试药厂",
                "batch_number": "TEST2024001",
                "expiry_date": (datetime.utcnow() + timedelta(days=365)).isoformat(),
                "storage_condition": "密封保存",
                "category": "测试分类"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["medicine_code"] == "MED999"
        assert data["medicine_name"] == "测试药品"
        assert data["version"] == 1

    def test_create_medicine_duplicate_code(self, sample_data):
        response = client.post(
            "/medicines/",
            json={
                "medicine_code": "MED001",
                "medicine_name": "重复药品"
            }
        )
        assert response.status_code == 409
        data = response.json()
        assert data["error_code"] == "MEDICINE_CODE_EXISTS"
        assert "已存在" in data["error_message"]


class TestInventoryCheckAPI:
    def test_create_inventory_check_normal(self, sample_data, db_session):
        medicines = client.get("/medicines/").json()
        inventories = client.get("/inventories/").json()

        orders = client.get("/doctor-orders/").json()
        for order in orders:
            if order["is_stopped"] and not order["inventory_synced"]:
                client.put(
                    f"/doctor-orders/{order['id']}/sync-inventory?synced_by=管理员&current_version={order['version']}"
                )

        response = client.post(
            "/inventory-checks/",
            json={
                "check_no": "CHECK2024001",
                "check_type": "月盘",
                "check_date": datetime.utcnow().isoformat(),
                "checker": "张药师",
                "supervisor": "李主任",
                "check_area": "A区",
                "status": "draft",
                "created_by": "系统",
                "details": [
                    {
                        "medicine_id": m["id"],
                        "medicine_code": m["medicine_code"],
                        "medicine_name": m["medicine_name"],
                        "specification": m["specification"],
                        "batch_number": m["batch_number"],
                        "system_quantity": inv["quantity"],
                        "actual_quantity": inv["quantity"],
                        "unit": inv["unit"]
                    }
                    for m, inv in zip(medicines[:3], inventories[:3])
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["check_no"] == "CHECK2024001"
        assert data["total_items"] == 3
        assert data["matched_items"] == 3

    def test_create_check_with_unsynced_stopped_orders(self, sample_data):
        medicines = client.get("/medicines/").json()
        inventories = client.get("/inventories/").json()

        response = client.post(
            "/inventory-checks/",
            json={
                "check_no": "CHECK2024002",
                "check_type": "周盘",
                "check_date": datetime.utcnow().isoformat(),
                "checker": "王药师",
                "details": [
                    {
                        "medicine_id": medicines[0]["id"],
                        "medicine_code": medicines[0]["medicine_code"],
                        "medicine_name": medicines[0]["medicine_name"],
                        "specification": medicines[0]["specification"],
                        "batch_number": medicines[0]["batch_number"],
                        "system_quantity": inventories[0]["quantity"],
                        "actual_quantity": inventories[0]["quantity"],
                        "unit": inventories[0]["unit"]
                    }
                ]
            }
        )
        assert response.status_code == 409
        data = response.json()
        assert data["error_code"] == "UNSYNCED_STOPPED_ORDERS"
        assert "停药医嘱未同步" in data["error_message"]


class TestImportValidation:
    def test_import_validation_with_bad_rows(self, sample_data):
        test_data = [
            {
                "medicine_code": "MED001",
                "actual_quantity": 50
            },
            {
                "medicine_code": "MED999",
                "actual_quantity": 30
            },
            {
                "medicine_code": "MED002",
                "actual_quantity": -5
            },
            {
                "medicine_code": "",
                "actual_quantity": 10
            }
        ]

        response = client.post("/import/validate/", json=test_data)
        assert response.status_code == 200
        data = response.json()
        assert data["total_rows"] == 4
        assert data["error_count"] == 3
        assert data["success"] == False

        errors = data["errors"]
        error_rows = [e["row"] for e in errors]
        assert 2 in error_rows
        assert 3 in error_rows
        assert 4 in error_rows


class TestConcurrentModification:
    def test_concurrent_update_with_version_check(self, db_session, sample_data):
        medicines = client.get("/medicines/").json()
        medicine_id = medicines[0]["id"]
        initial_version = medicines[0]["version"]

        response1 = client.put(
            f"/medicines/{medicine_id}?current_version={initial_version}&operator=用户A",
            json={"medicine_name": "用户A修改后的名称"}
        )
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["version"] == initial_version + 1
        assert data1["medicine_name"] == "用户A修改后的名称"

        response2 = client.put(
            f"/medicines/{medicine_id}?current_version={initial_version}&operator=用户B",
            json={"medicine_name": "用户B修改后的名称"}
        )
        assert response2.status_code == 409
        data2 = response2.json()
        assert data2["error_code"] == "VERSION_CONFLICT"
        assert "已被其他用户修改" in data2["error_message"]

        logs = client.get(f"/operation-logs/?business_type=MEDICINE&business_id={medicine_id}").json()
        assert len(logs) >= 1

        log = logs[0]
        assert log["operation_type"] == "UPDATE"
        assert log["operator"] == "用户A"

        original_data = json.loads(log["original_data"])
        new_data = json.loads(log["new_data"])
        assert original_data["medicine_name"] != new_data["medicine_name"]
        assert new_data["medicine_name"] == "用户A修改后的名称"

    def test_concurrent_check_detail_update(self, sample_data, db_session):
        medicines = client.get("/medicines/").json()
        inventories = client.get("/inventories/").json()

        orders = client.get("/doctor-orders/").json()
        for order in orders:
            if order["is_stopped"] and not order["inventory_synced"]:
                client.put(
                    f"/doctor-orders/{order['id']}/sync-inventory?synced_by=管理员&current_version={order['version']}"
                )

        check_response = client.post(
            "/inventory-checks/",
            json={
                "check_no": "CHECK2024003",
                "check_type": "临时盘",
                "check_date": datetime.utcnow().isoformat(),
                "checker": "测试药师",
                "details": [
                    {
                        "medicine_id": medicines[0]["id"],
                        "medicine_code": medicines[0]["medicine_code"],
                        "medicine_name": medicines[0]["medicine_name"],
                        "specification": medicines[0]["specification"],
                        "batch_number": medicines[0]["batch_number"],
                        "system_quantity": inventories[0]["quantity"],
                        "actual_quantity": inventories[0]["quantity"],
                        "unit": inventories[0]["unit"]
                    }
                ]
            }
        )
        assert check_response.status_code == 200
        check_data = check_response.json()
        check_id = check_data["id"]
        detail_id = check_data["details"][0]["id"]
        initial_version = check_data["version"]

        response1 = client.put(
            f"/inventory-checks/{check_id}/details/{detail_id}?current_version={initial_version}&operator=用户A",
            json={"actual_quantity": 60, "difference_reason": "正常损耗"}
        )
        assert response1.status_code == 200

        response2 = client.put(
            f"/inventory-checks/{check_id}/details/{detail_id}?current_version={initial_version}&operator=用户B",
            json={"actual_quantity": 55, "difference_reason": "盘点差异"}
        )
        assert response2.status_code == 409
        data2 = response2.json()
        assert data2["error_code"] == "VERSION_CONFLICT"

        logs = client.get(f"/operation-logs/?business_type=INVENTORY_CHECK&business_id={check_id}").json()
        assert len(logs) >= 2

        operations = [log["operation_type"] for log in logs]
        assert "CREATE" in operations
        assert "UPDATE_DETAIL" in operations

        update_logs = [log for log in logs if log["operation_type"] == "UPDATE_DETAIL"]
        assert len(update_logs) == 1
        assert update_logs[0]["operator"] == "用户A"


class TestErrorResponses:
    def test_404_error_response(self, db_session):
        response = client.get("/medicines/99999")
        assert response.status_code == 404
        data = response.json()
        assert "error_code" in data
        assert "error_message" in data
        assert "timestamp" in data
        assert data["success"] == False

    def test_validation_error_response(self, db_session):
        response = client.post(
            "/medicines/",
            json={"medicine_code": "TEST001"}
        )
        assert response.status_code == 422
        data = response.json()
        assert data["error_code"] == "VALIDATION_ERROR"
        assert "请求参数验证失败" in data["error_message"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
