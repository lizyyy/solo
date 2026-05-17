import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime

import sys
sys.path.append('.')

from main import app
from database import Base, get_db
from models import AuditType

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

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


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


class TestCustomer:
    def test_create_customer(self):
        response = client.post(
            "/api/customers/",
            json={"name": "测试客户", "phone": "13800138000", "contact": "测试人", "address": "测试地址"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["data"]["customer"]["name"] == "测试客户"

    def test_list_customers(self):
        client.post("/api/customers/", json={"name": "客户1", "phone": "13800000001"})
        client.post("/api/customers/", json={"name": "客户2", "phone": "13800000002"})
        response = client.get("/api/customers/")
        assert response.status_code == 200
        assert len(response.json()) >= 2


class TestCategory:
    def test_create_category(self):
        response = client.post(
            "/api/categories/",
            json={"name": "玉米", "code": "CORN001", "description": "测试玉米"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["data"]["category"]["code"] == "CORN001"

    def test_duplicate_category_code(self):
        client.post("/api/categories/", json={"name": "玉米", "code": "CORN001"})
        response = client.post("/api/categories/", json={"name": "玉米2", "code": "CORN001"})
        assert response.status_code == 400


class TestPrice:
    def test_create_price_with_version(self):
        cat = client.post("/api/categories/", json={"name": "玉米", "code": "CORN001"}).json()
        cat_id = cat["data"]["category"]["id"]
        
        response1 = client.post(
            "/api/prices/",
            json={"category_id": cat_id, "price": 2.5, "effective_date": datetime.now().isoformat(), "created_by": "测试"}
        )
        assert response1.status_code == 200
        assert response1.json()["data"]["price"]["version"] == 1
        
        response2 = client.post(
            "/api/prices/",
            json={"category_id": cat_id, "price": 2.8, "effective_date": datetime.now().isoformat(), "created_by": "测试"}
        )
        assert response2.status_code == 200
        assert response2.json()["data"]["price"]["version"] == 2


class TestWeighing:
    def test_create_weighing_success(self):
        customer = client.post("/api/customers/", json={"name": "测试客户", "phone": "13800000000"}).json()
        category = client.post("/api/categories/", json={"name": "玉米", "code": "CORN001"}).json()
        
        customer_id = customer["data"]["customer"]["id"]
        category_id = category["data"]["category"]["id"]
        
        response = client.post(
            "/api/weighings/",
            json={
                "record_no": "W20240101001",
                "customer_id": customer_id,
                "category_id": category_id,
                "gross_weight": 1000,
                "tare_weight": 300,
                "weigher": "测试员",
                "created_by": "管理员"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["weighing"]["net_weight"] == 700
        assert data["data"]["weighing"]["status"] == AuditType.WEIGHED

    def test_weighing_weight_validation(self):
        customer = client.post("/api/customers/", json={"name": "测试客户", "phone": "13800000000"}).json()
        category = client.post("/api/categories/", json={"name": "玉米", "code": "CORN001"}).json()
        
        customer_id = customer["data"]["customer"]["id"]
        category_id = category["data"]["category"]["id"]
        
        response = client.post(
            "/api/weighings/",
            json={
                "record_no": "W20240101001",
                "customer_id": customer_id,
                "category_id": category_id,
                "gross_weight": 300,
                "tare_weight": 1000,
                "weigher": "测试员",
                "created_by": "管理员"
            }
        )
        assert response.status_code == 400

    def test_set_price(self):
        customer = client.post("/api/customers/", json={"name": "测试客户", "phone": "13800000000"}).json()
        category = client.post("/api/categories/", json={"name": "玉米", "code": "CORN001"}).json()
        
        customer_id = customer["data"]["customer"]["id"]
        category_id = category["data"]["category"]["id"]
        
        price = client.post(
            "/api/prices/",
            json={"category_id": category_id, "price": 2.5, "effective_date": datetime.now().isoformat(), "created_by": "测试"}
        ).json()
        price_id = price["data"]["price"]["id"]
        
        weighing = client.post(
            "/api/weighings/",
            json={
                "record_no": "W20240101001",
                "customer_id": customer_id,
                "category_id": category_id,
                "gross_weight": 1000,
                "tare_weight": 300,
                "weigher": "测试员",
                "created_by": "管理员"
            }
        ).json()
        weighing_id = weighing["data"]["weighing"]["id"]
        
        response = client.post(
            f"/api/weighings/{weighing_id}/set-price",
            json={"price_id": price_id, "operator": "测试员"}
        )
        assert response.status_code == 200
        assert response.json()["data"]["weighing"]["status"] == AuditType.PRICED

    def test_manual_correction(self):
        customer = client.post("/api/customers/", json={"name": "测试客户", "phone": "13800000000"}).json()
        category = client.post("/api/categories/", json={"name": "玉米", "code": "CORN001"}).json()
        
        customer_id = customer["data"]["customer"]["id"]
        category_id = category["data"]["category"]["id"]
        
        weighing = client.post(
            "/api/weighings/",
            json={
                "record_no": "W20240101001",
                "customer_id": customer_id,
                "category_id": category_id,
                "gross_weight": 1000,
                "tare_weight": 300,
                "weigher": "测试员",
                "created_by": "管理员"
            }
        ).json()
        weighing_id = weighing["data"]["weighing"]["id"]
        
        response = client.post(
            f"/api/weighings/{weighing_id}/manual-correction",
            json={
                "gross_weight": 1100,
                "tare_weight": 300,
                "operator": "主管",
                "reason": "设备校准"
            }
        )
        assert response.status_code == 200
        assert response.json()["data"]["weighing"]["net_weight"] == 800


class TestSettlement:
    def test_settlement_success(self):
        customer = client.post("/api/customers/", json={"name": "测试客户", "phone": "13800000000"}).json()
        category = client.post("/api/categories/", json={"name": "玉米", "code": "CORN001"}).json()
        
        customer_id = customer["data"]["customer"]["id"]
        category_id = category["data"]["category"]["id"]
        
        price = client.post(
            "/api/prices/",
            json={"category_id": category_id, "price": 2.5, "effective_date": datetime.now().isoformat(), "created_by": "测试"}
        ).json()
        price_id = price["data"]["price"]["id"]
        
        deduction = client.post(
            "/api/deductions/",
            json={"category_id": category_id, "name": "扣杂", "ratio": 0.02, "effective_date": datetime.now().isoformat(), "created_by": "测试"}
        ).json()
        deduction_id = deduction["data"]["deduction"]["id"]
        
        weighing = client.post(
            "/api/weighings/",
            json={
                "record_no": "W20240101001",
                "customer_id": customer_id,
                "category_id": category_id,
                "gross_weight": 1000,
                "tare_weight": 300,
                "weigher": "测试员",
                "created_by": "管理员"
            }
        ).json()
        weighing_id = weighing["data"]["weighing"]["id"]
        
        client.post(f"/api/weighings/{weighing_id}/set-price", json={"price_id": price_id, "operator": "测试员"})
        client.post(f"/api/weighings/{weighing_id}/set-deduction", json={"deduction_id": deduction_id, "operator": "测试员"})
        
        response = client.post(
            "/api/settlements/",
            json={
                "settlement_no": "S20240101001",
                "customer_id": customer_id,
                "weighing_ids": [weighing_id],
                "settled_by": "结算员"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["total_weight"] == 686
        assert data["data"]["total_amount"] == 686 * 2.5

    def test_duplicate_settlement_block(self):
        customer = client.post("/api/customers/", json={"name": "测试客户", "phone": "13800000000"}).json()
        category = client.post("/api/categories/", json={"name": "玉米", "code": "CORN001"}).json()
        
        customer_id = customer["data"]["customer"]["id"]
        category_id = category["data"]["category"]["id"]
        
        price = client.post(
            "/api/prices/",
            json={"category_id": category_id, "price": 2.5, "effective_date": datetime.now().isoformat(), "created_by": "测试"}
        ).json()
        price_id = price["data"]["price"]["id"]
        
        deduction = client.post(
            "/api/deductions/",
            json={"category_id": category_id, "name": "扣杂", "ratio": 0.02, "effective_date": datetime.now().isoformat(), "created_by": "测试"}
        ).json()
        deduction_id = deduction["data"]["deduction"]["id"]
        
        weighing = client.post(
            "/api/weighings/",
            json={
                "record_no": "W20240101001",
                "customer_id": customer_id,
                "category_id": category_id,
                "gross_weight": 1000,
                "tare_weight": 300,
                "weigher": "测试员",
                "created_by": "管理员"
            }
        ).json()
        weighing_id = weighing["data"]["weighing"]["id"]
        
        client.post(f"/api/weighings/{weighing_id}/set-price", json={"price_id": price_id, "operator": "测试员"})
        client.post(f"/api/weighings/{weighing_id}/set-deduction", json={"deduction_id": deduction_id, "operator": "测试员"})
        
        client.post(
            "/api/settlements/",
            json={
                "settlement_no": "S20240101001",
                "customer_id": customer_id,
                "weighing_ids": [weighing_id],
                "settled_by": "结算员"
            }
        )
        
        response = client.post(
            "/api/settlements/",
            json={
                "settlement_no": "S20240101002",
                "customer_id": customer_id,
                "weighing_ids": [weighing_id],
                "settled_by": "结算员"
            }
        )
        assert response.status_code == 400


class TestAuditLog:
    def test_audit_log_created(self):
        customer = client.post("/api/customers/", json={"name": "测试客户", "phone": "13800000000"}).json()
        category = client.post("/api/categories/", json={"name": "玉米", "code": "CORN001"}).json()
        
        customer_id = customer["data"]["customer"]["id"]
        category_id = category["data"]["category"]["id"]
        
        weighing = client.post(
            "/api/weighings/",
            json={
                "record_no": "W20240101001",
                "customer_id": customer_id,
                "category_id": category_id,
                "gross_weight": 1000,
                "tare_weight": 300,
                "weigher": "测试员",
                "created_by": "管理员"
            }
        ).json()
        weighing_id = weighing["data"]["weighing"]["id"]
        
        response = client.get(f"/api/audits/", params={"weighing_id": weighing_id})
        assert response.status_code == 200
        audit_logs = response.json()
        assert len(audit_logs) >= 1
        assert audit_logs[0]["operation_type"] == "create"
        assert audit_logs[0]["is_success"] == 1

    def test_failed_weight_validation_audit_logged(self):
        customer = client.post("/api/customers/", json={"name": "测试客户", "phone": "13800000000"}).json()
        category = client.post("/api/categories/", json={"name": "玉米", "code": "CORN001"}).json()
        
        customer_id = customer["data"]["customer"]["id"]
        category_id = category["data"]["category"]["id"]
        
        client.post(
            "/api/weighings/",
            json={
                "record_no": "W20240101001",
                "customer_id": customer_id,
                "category_id": category_id,
                "gross_weight": 300,
                "tare_weight": 1000,
                "weigher": "测试员",
                "created_by": "管理员"
            }
        )
        
        response = client.get(f"/api/audits/")
        audit_logs = response.json()
        
        failed_audit = [log for log in audit_logs if log["is_success"] == 0]
        assert len(failed_audit) >= 1
        assert "毛重必须大于皮重" in failed_audit[0]["error_message"]
        assert failed_audit[0]["operator"] == "管理员"
        assert failed_audit[0]["original_data"] is not None

    def test_duplicate_settlement_block_audit_logged(self):
        customer = client.post("/api/customers/", json={"name": "测试客户", "phone": "13800000000"}).json()
        category = client.post("/api/categories/", json={"name": "玉米", "code": "CORN001"}).json()
        
        customer_id = customer["data"]["customer"]["id"]
        category_id = category["data"]["category"]["id"]
        
        price = client.post(
            "/api/prices/",
            json={"category_id": category_id, "price": 2.5, "effective_date": "2024-01-01T00:00:00", "created_by": "测试"}
        ).json()
        price_id = price["data"]["price"]["id"]
        
        deduction = client.post(
            "/api/deductions/",
            json={"category_id": category_id, "name": "扣杂", "ratio": 0.02, "effective_date": "2024-01-01T00:00:00", "created_by": "测试"}
        ).json()
        deduction_id = deduction["data"]["deduction"]["id"]
        
        weighing = client.post(
            "/api/weighings/",
            json={
                "record_no": "W20240101001",
                "customer_id": customer_id,
                "category_id": category_id,
                "gross_weight": 1000,
                "tare_weight": 300,
                "weigher": "测试员",
                "created_by": "管理员"
            }
        ).json()
        weighing_id = weighing["data"]["weighing"]["id"]
        
        client.post(f"/api/weighings/{weighing_id}/set-price", json={"price_id": price_id, "operator": "测试员"})
        client.post(f"/api/weighings/{weighing_id}/set-deduction", json={"deduction_id": deduction_id, "operator": "测试员"})
        
        client.post(
            "/api/settlements/",
            json={
                "settlement_no": "S20240101001",
                "customer_id": customer_id,
                "weighing_ids": [weighing_id],
                "settled_by": "结算员"
            }
        )
        
        client.post(
            "/api/settlements/",
            json={
                "settlement_no": "S20240101002",
                "customer_id": customer_id,
                "weighing_ids": [weighing_id],
                "settled_by": "结算员"
            }
        )
        
        response = client.get(f"/api/audits/", params={"weighing_id": weighing_id})
        audit_logs = response.json()
        
        failed_audit = [log for log in audit_logs if log["is_success"] == 0 and "已结算，重复结算拦截" in log["error_message"]]
        assert len(failed_audit) >= 1
        assert failed_audit[0]["weighing_id"] == weighing_id
        assert failed_audit[0]["operator"] == "结算员"

    def test_set_price_before_deduction_failure_audited(self):
        customer = client.post("/api/customers/", json={"name": "测试客户", "phone": "13800000000"}).json()
        category = client.post("/api/categories/", json={"name": "玉米", "code": "CORN001"}).json()
        
        customer_id = customer["data"]["customer"]["id"]
        category_id = category["data"]["category"]["id"]
        
        deduction = client.post(
            "/api/deductions/",
            json={"category_id": category_id, "name": "扣杂", "ratio": 0.02, "effective_date": "2024-01-01T00:00:00", "created_by": "测试"}
        ).json()
        deduction_id = deduction["data"]["deduction"]["id"]
        
        weighing = client.post(
            "/api/weighings/",
            json={
                "record_no": "W20240101001",
                "customer_id": customer_id,
                "category_id": category_id,
                "gross_weight": 1000,
                "tare_weight": 300,
                "weigher": "测试员",
                "created_by": "管理员"
            }
        ).json()
        weighing_id = weighing["data"]["weighing"]["id"]
        
        client.post(
            f"/api/weighings/{weighing_id}/set-deduction",
            json={"deduction_id": deduction_id, "operator": "测试员"}
        )
        
        response = client.get(f"/api/audits/", params={"weighing_id": weighing_id})
        audit_logs = response.json()
        
        failed_audit = [log for log in audit_logs if log["is_success"] == 0 and "请先设置价格" in log["error_message"]]
        assert len(failed_audit) >= 1
        assert failed_audit[0]["operator"] == "测试员"

    def test_manual_correction_after_settlement_blocked(self):
        customer = client.post("/api/customers/", json={"name": "测试客户", "phone": "13800000000"}).json()
        category = client.post("/api/categories/", json={"name": "玉米", "code": "CORN001"}).json()
        
        customer_id = customer["data"]["customer"]["id"]
        category_id = category["data"]["category"]["id"]
        
        price = client.post(
            "/api/prices/",
            json={"category_id": category_id, "price": 2.5, "effective_date": "2024-01-01T00:00:00", "created_by": "测试"}
        ).json()
        price_id = price["data"]["price"]["id"]
        
        deduction = client.post(
            "/api/deductions/",
            json={"category_id": category_id, "name": "扣杂", "ratio": 0.02, "effective_date": "2024-01-01T00:00:00", "created_by": "测试"}
        ).json()
        deduction_id = deduction["data"]["deduction"]["id"]
        
        weighing = client.post(
            "/api/weighings/",
            json={
                "record_no": "W20240101001",
                "customer_id": customer_id,
                "category_id": category_id,
                "gross_weight": 1000,
                "tare_weight": 300,
                "weigher": "测试员",
                "created_by": "管理员"
            }
        ).json()
        weighing_id = weighing["data"]["weighing"]["id"]
        
        client.post(f"/api/weighings/{weighing_id}/set-price", json={"price_id": price_id, "operator": "测试员"})
        client.post(f"/api/weighings/{weighing_id}/set-deduction", json={"deduction_id": deduction_id, "operator": "测试员"})
        
        client.post(
            "/api/settlements/",
            json={
                "settlement_no": "S20240101001",
                "customer_id": customer_id,
                "weighing_ids": [weighing_id],
                "settled_by": "结算员"
            }
        )
        
        client.post(
            f"/api/weighings/{weighing_id}/manual-correction",
            json={
                "gross_weight": 1200,
                "operator": "主管",
                "reason": "修正重量"
            }
        )
        
        response = client.get(f"/api/audits/", params={"weighing_id": weighing_id})
        audit_logs = response.json()
        
        failed_audit = [log for log in audit_logs if log["is_success"] == 0 and "已结算，无法修改" in log["error_message"]]
        assert len(failed_audit) >= 1
        assert failed_audit[0]["operator"] == "主管"


class TestExport:
    def test_export_settlement(self):
        customer = client.post("/api/customers/", json={"name": "测试客户", "phone": "13800000000"}).json()
        category = client.post("/api/categories/", json={"name": "玉米", "code": "CORN001"}).json()
        
        customer_id = customer["data"]["customer"]["id"]
        category_id = category["data"]["category"]["id"]
        
        price = client.post(
            "/api/prices/",
            json={"category_id": category_id, "price": 2.5, "effective_date": datetime.now().isoformat(), "created_by": "测试"}
        ).json()
        price_id = price["data"]["price"]["id"]
        
        deduction = client.post(
            "/api/deductions/",
            json={"category_id": category_id, "name": "扣杂", "ratio": 0.02, "effective_date": datetime.now().isoformat(), "created_by": "测试"}
        ).json()
        deduction_id = deduction["data"]["deduction"]["id"]
        
        weighing = client.post(
            "/api/weighings/",
            json={
                "record_no": "W20240101001",
                "customer_id": customer_id,
                "category_id": category_id,
                "gross_weight": 1000,
                "tare_weight": 300,
                "weigher": "测试员",
                "created_by": "管理员"
            }
        ).json()
        weighing_id = weighing["data"]["weighing"]["id"]
        
        client.post(f"/api/weighings/{weighing_id}/set-price", json={"price_id": price_id, "operator": "测试员"})
        client.post(f"/api/weighings/{weighing_id}/set-deduction", json={"deduction_id": deduction_id, "operator": "测试员"})
        
        settlement = client.post(
            "/api/settlements/",
            json={
                "settlement_no": "S20240101001",
                "customer_id": customer_id,
                "weighing_ids": [weighing_id],
                "settled_by": "结算员"
            }
        ).json()
        settlement_id = settlement["data"]["settlement"]["id"]
        
        response = client.get(f"/api/export/settlement/{settlement_id}")
        assert response.status_code == 200
        assert "report_type" in response.json()
        assert response.json()["report_type"] == "结算报告"
