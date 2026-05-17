import pytest
from fastapi.testclient import TestClient
from datetime import datetime
import sys
import os
import json

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
    
    def test_export_json_basic(self, client):
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
    
    def test_export_json_full_chain_fields(self, client):
        # 创建完整的异常处理链路
        client.post(
            "/api/boxes/",
            json={
                "box_code": "BOX-EXPORT-001",
                "batch_no": "BATCH-EXPORT-001",
                "product_name": "进口冷冻海鲜",
                "temperature_min": -25.0,
                "temperature_max": -15.0
            }
        )
        
        # 推进状态
        client.post(
            "/api/boxes/BOX-EXPORT-001/status",
            json={"target_status": "IN_TRANSIT", "operator": "物流员", "comment": "开始运输"}
        )
        client.post(
            "/api/boxes/BOX-EXPORT-001/status",
            json={"target_status": "ARRIVED", "operator": "门店"}
        )
        
        # 创建异常签收
        signoff_response = client.post(
            "/api/signoffs/",
            json={
                "box_code": "BOX-EXPORT-001",
                "store_code": "STORE-EXPORT-001",
                "store_name": "北京朝阳门店",
                "signoff_person": "李四",
                "signoff_time": datetime.now().isoformat(),
                "temperature_arrival": -5.0,
                "has_exception": True,
                "exception_desc": "箱体外有大量水珠，内部温度超标严重"
            }
        )
        signoff_id = signoff_response.json()["id"]
        
        # 确认签收
        client.post(f"/api/signoffs/{signoff_id}/status?target_status=SUBMITTED&operator=李四")
        client.post(f"/api/signoffs/{signoff_id}/status?target_status=CONFIRMED&operator=店长")
        
        # 异常复核
        review_response = client.post(
            "/api/reviews/",
            json={
                "box_code": "BOX-EXPORT-001",
                "signoff_id": signoff_id,
                "reviewer": "质量主管-王五",
                "original_input": "这是原始输入：现场拍摄照片显示冷链箱密封失效，温度计显示-2度",
                "review_result": "确认冷链中断",
                "review_comment": "运输过程中制冷机故障，建议全额赔付",
                "temperature_violation": True,
                "compensation_eligible": True
            }
        )
        review_id = review_response.json()["id"]
        
        # 赔付结论
        client.post(
            "/api/compensations/",
            json={
                "box_code": "BOX-EXPORT-001",
                "review_id": review_id,
                "compensation_amount": 8000.0,
                "compensation_reason": "冷链中断导致全部产品变质",
                "processor": "财务-赵六",
                "approved_by": "经理-钱七"
            }
        )
        
        # 导出并验证字段
        response = client.post(
            "/api/export/",
            json={"export_format": "json"}
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
        
        data = response.json()["data"]
        assert len(data) == 1
        
        box_data = data[0]
        assert box_data["box_code"] == "BOX-EXPORT-001"
        assert box_data["batch_no"] == "BATCH-EXPORT-001"
        # 创建赔付时状态自动推进到 COMPENSATED
        assert box_data["status"] == "COMPENSATED"
        
        # 验证签收字段完整
        assert len(box_data["signoffs"]) == 1
        signoff_data = box_data["signoffs"][0]
        assert signoff_data["store_code"] == "STORE-EXPORT-001"
        assert signoff_data["store_name"] == "北京朝阳门店"
        assert signoff_data["signoff_person"] == "李四"
        assert signoff_data["temperature_arrival"] == -5.0
        assert signoff_data["has_exception"] == True
        assert "箱体外有大量水珠" in signoff_data["exception_desc"]
        
        # 验证复核字段完整（核心修复点）
        assert len(box_data["reviews"]) == 1
        review_data = box_data["reviews"][0]
        assert review_data["reviewer"] == "质量主管-王五"
        assert review_data["original_input"] is not None
        assert review_data["review_result"] == "确认冷链中断"
        assert review_data["review_comment"] == "运输过程中制冷机故障，建议全额赔付"
        assert review_data["temperature_violation"] == True
        assert review_data["compensation_eligible"] == True
        
        # 验证原始输入确实保留了调用方内容
        original_input_json = json.loads(review_data["original_input"])
        assert "原始输入" in original_input_json["caller_input"]
        
        # 验证赔付字段完整（核心修复点）
        assert len(box_data["compensations"]) == 1
        compensation_data = box_data["compensations"][0]
        assert compensation_data["amount"] == 8000.0
        assert "冷链中断导致全部产品变质" in compensation_data["reason"]
        assert compensation_data["processor"] == "财务-赵六"
        assert compensation_data["approved_by"] == "经理-钱七"
        
        # 验证审计日志导出
        assert len(box_data["audit_logs"]) > 0
        status_transitions = [a for a in box_data["audit_logs"] if a["action_type"] == "STATUS_TRANSITION"]
        assert len(status_transitions) >= 2
        review_logs = [a for a in box_data["audit_logs"] if a["action_type"] == "EXCEPTION_REVIEW"]
        assert len(review_logs) >= 1


class TestHealthCheck:
    
    def test_health_check(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["success"] == True


class TestAuditTrail:
    
    def test_status_transition_audit_log(self, client):
        client.post(
            "/api/boxes/",
            json={"box_code": "BOX-AUDIT-001", "product_name": "测试产品"}
        )
        response = client.post(
            "/api/boxes/BOX-AUDIT-001/status",
            json={
                "target_status": "IN_TRANSIT",
                "operator": "测试员",
                "comment": "开始运输测试"
            }
        )
        assert response.status_code == 200
        
        audit_response = client.get("/api/boxes/BOX-AUDIT-001/audit-logs")
        assert audit_response.status_code == 200
        audit_logs = audit_response.json()
        assert len(audit_logs) >= 1
        
        status_log = next((log for log in audit_logs if log["action_type"] == "STATUS_TRANSITION"), None)
        assert status_log is not None
        assert status_log["operator"] == "测试员"
        assert status_log["old_status"] == "CREATED"
        assert status_log["new_status"] == "IN_TRANSIT"
        assert status_log["comment"] == "开始运输测试"
    
    def test_manual_correction_audit_log(self, client):
        client.post(
            "/api/boxes/",
            json={"box_code": "BOX-AUDIT-002", "product_name": "旧产品名"}
        )
        
        correction_response = client.post(
            "/api/boxes/BOX-AUDIT-002/correction",
            json={
                "field_name": "product_name",
                "old_value": "旧产品名",
                "new_value": "新产品名",
                "operator": "管理员",
                "reason": "录入错误修正"
            }
        )
        assert correction_response.status_code == 200
        
        audit_response = client.get("/api/boxes/BOX-AUDIT-002/audit-logs")
        assert audit_response.status_code == 200
        audit_logs = audit_response.json()
        
        correction_log = next((log for log in audit_logs if log["action_type"] == "MANUAL_CORRECTION"), None)
        assert correction_log is not None
        assert correction_log["operator"] == "管理员"
        assert correction_log["comment"] == "录入错误修正"
        assert correction_log["change_details"]["field_name"] == "product_name"
        assert correction_log["change_details"]["old_value"] == "旧产品名"
        assert correction_log["change_details"]["new_value"] == "新产品名"
    
    def test_exception_review_preserves_caller_input(self, client):
        # 先创建冷链箱
        client.post(
            "/api/boxes/",
            json={"box_code": "BOX-AUDIT-003", "product_name": "测试产品", "temperature_min": -25.0, "temperature_max": -15.0}
        )
        
        # 先推进状态到到货
        client.post(
            "/api/boxes/BOX-AUDIT-003/status",
            json={"target_status": "IN_TRANSIT", "operator": "测试员"}
        )
        client.post(
            "/api/boxes/BOX-AUDIT-003/status",
            json={"target_status": "ARRIVED", "operator": "测试员"}
        )
        
        # 创建签收
        signoff_response = client.post(
            "/api/signoffs/",
            json={
                "box_code": "BOX-AUDIT-003",
                "store_code": "STORE-001",
                "signoff_person": "张三",
                "signoff_time": datetime.now().isoformat(),
                "temperature_arrival": -5.0,
                "has_exception": True,
                "exception_desc": "温度超标异常"
            }
        )
        signoff_id = signoff_response.json()["id"]
        
        # 确认签收状态（这样才会自动推进到 SIGNED_OFF）
        client.post(
            f"/api/signoffs/{signoff_id}/status?target_status=SUBMITTED&operator=张三"
        )
        client.post(
            f"/api/signoffs/{signoff_id}/status?target_status=CONFIRMED&operator=店长"
        )
        
        review_response = client.post(
            "/api/reviews/",
            json={
                "box_code": "BOX-AUDIT-003",
                "signoff_id": signoff_id,
                "reviewer": "质量主管",
                "original_input": "这是调用方传入的原始输入：现场拍照显示箱体外有大量水珠，温度异常",
                "review_result": "确认异常",
                "temperature_violation": True,
                "compensation_eligible": True
            }
        )
        assert review_response.status_code == 200
        
        original_input_json = json.loads(review_response.json()["original_input"])
        assert "caller_input" in original_input_json
        assert "这是调用方传入的原始输入" in original_input_json["caller_input"]
        assert "system_snapshot" in original_input_json
        assert "signoff_data" in original_input_json["system_snapshot"]
        
        audit_response = client.get("/api/boxes/BOX-AUDIT-003/audit-logs")
        audit_logs = audit_response.json()
        review_log = next((log for log in audit_logs if log["action_type"] == "EXCEPTION_REVIEW"), None)
        assert review_log is not None
        assert review_log["operator"] == "质量主管"
        assert review_log["new_status"] == "UNDER_REVIEW"
