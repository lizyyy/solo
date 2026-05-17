import pytest
from fastapi.testclient import TestClient
from datetime import datetime
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.database import Base, engine, get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

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


@pytest.fixture(scope="function")
def client():
    Base.metadata.create_all(bind=engine)
    yield TestClient(app)
    Base.metadata.drop_all(bind=engine)


class TestBoxApi:
    
    def test_create_box(self, client):
        response = client.post(
            "/api/boxes/",
            json={
                "box_code": "BOX-PYTEST-001",
                "batch_no": "BATCH-TEST-001",
                "product_name": "测试产品",
                "temperature_min": -25.0,
                "temperature_max": -15.0
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["box_code"] == "BOX-PYTEST-001"
        assert data["status"] == "CREATED"
    
    def test_create_duplicate_box(self, client):
        client.post(
            "/api/boxes/",
            json={"box_code": "BOX-PYTEST-001", "product_name": "测试产品"}
        )
        response = client.post(
            "/api/boxes/",
            json={"box_code": "BOX-PYTEST-001", "product_name": "重复产品"}
        )
        assert response.status_code == 409
    
    def test_list_boxes(self, client):
        for i in range(3):
            client.post(
                "/api/boxes/",
                json={"box_code": f"BOX-PYTEST-00{i+1}", "product_name": f"产品{i+1}"}
            )
        response = client.get("/api/boxes/")
        assert response.status_code == 200
        assert len(response.json()) == 3
    
    def test_get_box_detail(self, client):
        client.post(
            "/api/boxes/",
            json={"box_code": "BOX-PYTEST-001", "product_name": "测试产品"}
        )
        response = client.get("/api/boxes/BOX-PYTEST-001")
        assert response.status_code == 200
        assert response.json()["box_code"] == "BOX-PYTEST-001"
    
    def test_get_box_not_found(self, client):
        response = client.get("/api/boxes/NONEXIST")
        assert response.status_code == 404


class TestStatusTransition:
    
    def test_valid_status_transition(self, client):
        client.post(
            "/api/boxes/",
            json={"box_code": "BOX-PYTEST-001", "product_name": "测试产品"}
        )
        response = client.post(
            "/api/boxes/BOX-PYTEST-001/status",
            json={"target_status": "IN_TRANSIT", "operator": "测试员", "comment": "开始运输"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "IN_TRANSIT"
    
    def test_invalid_status_transition(self, client):
        client.post(
            "/api/boxes/",
            json={"box_code": "BOX-PYTEST-001", "product_name": "测试产品"}
        )
        response = client.post(
            "/api/boxes/BOX-PYTEST-001/status",
            json={"target_status": "CLOSED", "operator": "测试员"}
        )
        assert response.status_code == 400


class TestTemperatureSample:
    
    def test_create_normal_temperature(self, client):
        client.post(
            "/api/boxes/",
            json={
                "box_code": "BOX-PYTEST-001",
                "temperature_min": -25.0,
                "temperature_max": -15.0
            }
        )
        response = client.post(
            "/api/temperature/",
            json={
                "box_code": "BOX-PYTEST-001",
                "sample_time": datetime.now().isoformat(),
                "temperature": -20.0,
                "probe_id": "PROBE-TEST"
            }
        )
        assert response.status_code == 200
        assert response.json()["is_anomaly"] == False
    
    def test_create_anomaly_temperature(self, client):
        client.post(
            "/api/boxes/",
            json={
                "box_code": "BOX-PYTEST-001",
                "temperature_min": -25.0,
                "temperature_max": -15.0
            }
        )
        response = client.post(
            "/api/temperature/",
            json={
                "box_code": "BOX-PYTEST-001",
                "sample_time": datetime.now().isoformat(),
                "temperature": -10.0,
                "probe_id": "PROBE-TEST"
            }
        )
        assert response.status_code == 200
        assert response.json()["is_anomaly"] == True


class TestPhotoEvidence:
    
    def test_create_photo(self, client):
        client.post(
            "/api/boxes/",
            json={"box_code": "BOX-PYTEST-001", "product_name": "测试产品"}
        )
        response = client.post(
            "/api/photos/",
            json={
                "box_code": "BOX-PYTEST-001",
                "photo_key": "PHOTO-TEST-001",
                "photo_type": "ARRIVAL",
                "uploader": "测试员"
            }
        )
        assert response.status_code == 200
    
    def test_duplicate_photo(self, client):
        client.post(
            "/api/boxes/",
            json={"box_code": "BOX-PYTEST-001", "product_name": "测试产品"}
        )
        client.post(
            "/api/photos/",
            json={
                "box_code": "BOX-PYTEST-001",
                "photo_key": "PHOTO-TEST-001",
                "uploader": "测试员"
            }
        )
        response = client.post(
            "/api/photos/",
            json={
                "box_code": "BOX-PYTEST-001",
                "photo_key": "PHOTO-TEST-001",
                "uploader": "测试员2"
            }
        )
        assert response.status_code == 409


class TestSignoffAndReview:
    
    def test_full_exception_flow(self, client):
        client.post(
            "/api/boxes/",
            json={"box_code": "BOX-PYTEST-001", "product_name": "测试产品"}
        )
        
        signoff_response = client.post(
            "/api/signoffs/",
            json={
                "box_code": "BOX-PYTEST-001",
                "store_code": "STORE-TEST",
                "signoff_person": "张三",
                "signoff_time": datetime.now().isoformat(),
                "temperature_arrival": -5.0,
                "has_exception": True,
                "exception_desc": "温度超标异常"
            }
        )
        assert signoff_response.status_code == 200
        signoff_id = signoff_response.json()["id"]
        
        review_response = client.post(
            "/api/reviews/",
            json={
                "box_code": "BOX-PYTEST-001",
                "signoff_id": signoff_id,
                "reviewer": "质量主管",
                "temperature_violation": True,
                "compensation_eligible": True
            }
        )
        assert review_response.status_code == 200
        assert review_response.json()["status"] == "PENDING"
        review_id = review_response.json()["id"]
        
        compensation_response = client.post(
            "/api/compensations/",
            json={
                "box_code": "BOX-PYTEST-001",
                "review_id": review_id,
                "compensation_amount": 1000.0,
                "compensation_reason": "温度超标导致产品变质",
                "processor": "财务",
                "approved_by": "经理"
            }
        )
        assert compensation_response.status_code == 200
        assert compensation_response.json()["status"] == "CONFIRMED"


class TestManualCorrection:
    
    def test_manual_correction(self, client):
        client.post(
            "/api/boxes/",
            json={"box_code": "BOX-PYTEST-001", "product_name": "原产品名", "batch_no": "OLD-BATCH"}
        )
        response = client.post(
            "/api/boxes/BOX-PYTEST-001/correction",
            json={
                "field_name": "product_name",
                "old_value": "原产品名",
                "new_value": "修正后产品名",
                "operator": "管理员",
                "reason": "产品名称录入错误"
            }
        )
        assert response.status_code == 200
        assert response.json()["product_name"] == "修正后产品名"


class TestExport:
    
    def test_export_json(self, client):
        client.post(
            "/api/boxes/",
            json={"box_code": "BOX-PYTEST-001", "product_name": "测试产品"}
        )
        response = client.post(
            "/api/export/",
            json={"export_format": "json"}
        )
        assert response.status_code == 200
        assert response.json()["success"] == True


class TestHealthCheck:
    
    def test_health_check(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["success"] == True
