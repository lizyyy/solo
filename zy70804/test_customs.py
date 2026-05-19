import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import json

from main import app
from app.database import Base, get_db
from app.models import BatchStatus, DeclarationItemStatus

TEST_DATABASE_URL = "sqlite:///./test_customs.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
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
    if os.path.exists("./test_customs.db"):
        os.remove("./test_customs.db")


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "跨境电商关务系统"
    assert data["version"] == "1.0.0"


def test_import_hs_codes():
    hs_codes_data = json.dumps([
        {
            "code": "85171210",
            "name": "手机",
            "tax_rate": 13,
            "additional_tax_rate": 0,
            "unit": "台",
            "category_code": "3C",
            "category_name": "电子产品"
        }
    ])

    response = client.post(
        "/api/hs-codes/import",
        files={"json_file": ("hs_codes.json", hs_codes_data, "application/json")},
        data={"operator": "test_user"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["code"] == "85171210"
    assert data[0]["name"] == "手机"


def test_import_declaration_batch():
    csv_content = """item_no,sku,product_name,specification,hs_code,origin_country,quantity,unit,unit_price,total_price,currency,exchange_rate
001,IP15PRO,iPhone 15 Pro,128G 黑色,85171210,美国,10,台,7999,79990,CNY,1
002,LV-BAG01,LV手提包,经典款 棕色,42022100,法国,5,个,12000,60000,CNY,1
"""

    response = client.post(
        "/api/batches/import",
        files={"csv_file": ("declaration.csv", csv_content, "text/csv")},
        data={
            "batch_no": "BATCH001",
            "operator": "test_user",
            "declaration_port": "深圳",
            "currency": "CNY"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["batch_no"] == "BATCH001"
    assert data["status"] == BatchStatus.PENDING
    assert data["total_items"] == 2


def test_full_workflow():
    hs_codes_data = json.dumps([
        {
            "code": "85171210",
            "name": "手机",
            "tax_rate": 13,
            "additional_tax_rate": 0,
            "unit": "台",
            "category_code": "3C",
            "category_name": "电子产品"
        }
    ])
    client.post(
        "/api/hs-codes/import",
        files={"json_file": ("hs_codes.json", hs_codes_data, "application/json")},
        data={"operator": "test_user"}
    )

    csv_content = """item_no,sku,product_name,specification,hs_code,origin_country,quantity,unit,unit_price,total_price,currency,exchange_rate
001,IP15PRO,iPhone 15 Pro,128G 黑色,85171210,美国,10,台,7999,79990,CNY,1
"""
    batch_response = client.post(
        "/api/batches/import",
        files={"csv_file": ("declaration.csv", csv_content, "text/csv")},
        data={
            "batch_no": "BATCH001",
            "operator": "test_user"
        }
    )
    batch_data = batch_response.json()

    response = client.get(f"/api/batches/BATCH001")
    assert response.status_code == 200
    batch_detail = response.json()
    assert len(batch_detail["items"]) == 1
    item_id = batch_detail["items"][0]["id"]

    status_response = client.put(
        f"/api/items/{item_id}/status",
        params={
            "status": DeclarationItemStatus.APPROVED,
            "operator": "test_user",
            "remark": "审核通过"
        }
    )
    assert status_response.status_code == 200
    assert status_response.json()["status"] == DeclarationItemStatus.APPROVED

    return_response = client.put(
        f"/api/items/{item_id}/return",
        params={
            "operator": "test_user",
            "reason": "需要补充材料"
        }
    )
    assert return_response.status_code == 200
    assert return_response.json()["status"] == DeclarationItemStatus.NEEDS_CORRECTION

    tax_response = client.post(
        f"/api/items/{item_id}/supplement-tax",
        params={
            "certificate_no": "TAX001",
            "tax_amount": 1000,
            "reason": "税率调整补税",
            "operator": "test_user"
        }
    )
    assert tax_response.status_code == 200
    tax_data = tax_response.json()
    assert tax_data["certificate_no"] == "TAX001"
    assert tax_data["tax_amount"] == 1000

    trace_response = client.get(f"/api/tax-certificates/TAX001/trace")
    assert trace_response.status_code == 200
    trace_data = trace_response.json()
    assert trace_data["certificate"]["certificate_no"] == "TAX001"
    assert trace_data["item"] is not None
    assert trace_data["batch"] is not None
    assert len(trace_data["operations"]) > 0

    export_response = client.get("/api/items/export", params={"batch_id": batch_data["id"]})
    assert export_response.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in export_response.headers["content-type"]

    logs_response = client.get("/api/operation-logs", params={"batch_id": batch_data["id"]})
    assert logs_response.status_code == 200
    logs = logs_response.json()
    assert len(logs) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
