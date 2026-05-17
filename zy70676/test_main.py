import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json

from database import Base, get_db
from main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_water_quality.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            db_session.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    del app.dependency_overrides[get_db]


def setup_test_data(client):
    client.post("/units/", json={"unit_code": "MG_L", "unit_name": "毫克/升", "dimension": "浓度", "conversion_factor": 1000.0})
    client.post("/units/", json={"unit_code": "UG_L", "unit_name": "微克/升", "dimension": "浓度", "conversion_factor": 1.0})
    client.post("/units/", json={"unit_code": "PH", "unit_name": "pH值", "dimension": "pH", "conversion_factor": 1.0})

    units = client.get("/units/").json()
    mg_l_id = next(u["id"] for u in units if u["unit_code"] == "MG_L")
    ug_l_id = next(u["id"] for u in units if u["unit_code"] == "UG_L")
    ph_id = next(u["id"] for u in units if u["unit_code"] == "PH")

    client.post("/parameters/", json={"param_code": "DO", "param_name": "溶解氧", "default_unit_id": mg_l_id})
    client.post("/parameters/", json={"param_code": "COD", "param_name": "化学需氧量", "default_unit_id": mg_l_id})
    client.post("/parameters/", json={"param_code": "PH", "param_name": "pH值", "default_unit_id": ph_id})

    params = client.get("/parameters/").json()
    do_param_id = next(p["id"] for p in params if p["param_code"] == "DO")
    cod_param_id = next(p["id"] for p in params if p["param_code"] == "COD")
    ph_param_id = next(p["id"] for p in params if p["param_code"] == "PH")

    client.post("/thresholds/", json={"parameter_id": do_param_id, "water_grade": "Ⅰ类", "min_value": 7.5, "max_value": None, "unit_id": mg_l_id})
    client.post("/thresholds/", json={"parameter_id": do_param_id, "water_grade": "Ⅱ类", "min_value": 6.0, "max_value": 7.5, "unit_id": mg_l_id})
    client.post("/thresholds/", json={"parameter_id": do_param_id, "water_grade": "Ⅲ类", "min_value": 5.0, "max_value": 6.0, "unit_id": mg_l_id})

    client.post("/sampling-points/", json={"point_code": "W001", "point_name": "测试点位1", "location": "测试位置", "river_basin": "测试流域"})
    points = client.get("/sampling-points/").json()
    point_id = points[0]["id"]

    client.post("/field-records/", json={
        "record_code": "FR001",
        "sampling_point_id": point_id,
        "sampling_time": datetime(2024, 1, 15, 9, 0).isoformat(),
        "collector": "测试员",
        "weather": "晴",
        "temperature": 15.5
    })
    records = client.get("/field-records/").json()
    record_id = records[0]["id"]

    return {
        "mg_l_id": mg_l_id,
        "ug_l_id": ug_l_id,
        "ph_id": ph_id,
        "do_param_id": do_param_id,
        "cod_param_id": cod_param_id,
        "ph_param_id": ph_param_id,
        "point_id": point_id,
        "record_id": record_id
    }


class TestSamplingPoint:
    def test_create_sampling_point(self, client):
        response = client.post("/sampling-points/", json={
            "point_code": "W001",
            "point_name": "测试点位",
            "location": "测试位置",
            "river_basin": "测试流域"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["point_code"] == "W001"
        assert data["point_name"] == "测试点位"

    def test_create_duplicate_sampling_point(self, client):
        client.post("/sampling-points/", json={
            "point_code": "W001",
            "point_name": "测试点位"
        })
        response = client.post("/sampling-points/", json={
            "point_code": "W001",
            "point_name": "重复点位"
        })
        assert response.status_code == 400

    def test_list_sampling_points(self, client):
        client.post("/sampling-points/", json={"point_code": "W001", "point_name": "点位1"})
        client.post("/sampling-points/", json={"point_code": "W002", "point_name": "点位2"})
        response = client.get("/sampling-points/")
        assert response.status_code == 200
        assert len(response.json()) == 2


class TestUnitConversion:
    def test_convert_unit_success(self, client):
        client.post("/units/", json={"unit_code": "MG_L", "unit_name": "毫克/升", "dimension": "浓度", "conversion_factor": 1000.0})
        client.post("/units/", json={"unit_code": "UG_L", "unit_name": "微克/升", "dimension": "浓度", "conversion_factor": 1.0})
        units = client.get("/units/").json()
        mg_l_id = next(u["id"] for u in units if u["unit_code"] == "MG_L")
        ug_l_id = next(u["id"] for u in units if u["unit_code"] == "UG_L")

        response = client.get(f"/utils/convert-unit?value=6500&from_unit_id={ug_l_id}&to_unit_id={mg_l_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["converted_value"] == 6.5

    def test_convert_unit_invalid_dimension(self, client):
        client.post("/units/", json={"unit_code": "MG_L", "unit_name": "毫克/升", "dimension": "浓度", "conversion_factor": 1000.0})
        client.post("/units/", json={"unit_code": "PH", "unit_name": "pH值", "dimension": "pH", "conversion_factor": 1.0})
        units = client.get("/units/").json()
        mg_l_id = next(u["id"] for u in units if u["unit_code"] == "MG_L")
        ph_id = next(u["id"] for u in units if u["unit_code"] == "PH")

        response = client.get(f"/utils/convert-unit?value=7&from_unit_id={mg_l_id}&to_unit_id={ph_id}")
        assert response.status_code == 400


class TestLabResult:
    def test_create_lab_result(self, client):
        data = setup_test_data(client)
        response = client.post("/lab-results/", json={
            "field_record_id": data["record_id"],
            "parameter_id": data["do_param_id"],
            "raw_value": 6.5,
            "raw_unit_id": data["mg_l_id"],
            "analyst": "测试员"
        })
        assert response.status_code == 200
        result = response.json()
        assert result["raw_value"] == 6.5
        assert result["converted_value"] == 6.5

    def test_create_lab_result_with_unit_conversion(self, client):
        data = setup_test_data(client)
        response = client.post("/lab-results/", json={
            "field_record_id": data["record_id"],
            "parameter_id": data["do_param_id"],
            "raw_value": 6500.0,
            "raw_unit_id": data["ug_l_id"],
            "analyst": "测试员"
        })
        assert response.status_code == 200
        result = response.json()
        assert result["raw_value"] == 6500.0
        assert result["converted_value"] == 6.5

    def test_approve_lab_result(self, client):
        data = setup_test_data(client)
        result_response = client.post("/lab-results/", json={
            "field_record_id": data["record_id"],
            "parameter_id": data["do_param_id"],
            "raw_value": 6.5,
            "raw_unit_id": data["mg_l_id"],
            "analyst": "测试员"
        })
        result_id = result_response.json()["id"]

        approve_response = client.post(f"/lab-results/{result_id}/approve", json={
            "operator": "审核员A",
            "conclusion": "数据正常"
        })
        assert approve_response.status_code == 200
        assert approve_response.json()["is_approved"] == True
        assert approve_response.json()["approver"] == "审核员A"

    def test_double_approve_lab_result(self, client):
        data = setup_test_data(client)
        result_response = client.post("/lab-results/", json={
            "field_record_id": data["record_id"],
            "parameter_id": data["do_param_id"],
            "raw_value": 6.5,
            "raw_unit_id": data["mg_l_id"],
            "analyst": "测试员"
        })
        result_id = result_response.json()["id"]

        client.post(f"/lab-results/{result_id}/approve", json={
            "operator": "审核员A",
            "conclusion": "数据正常"
        })

        approve_response2 = client.post(f"/lab-results/{result_id}/approve", json={
            "operator": "审核员B",
            "conclusion": "再次审核"
        })
        assert approve_response2.status_code == 400

    def test_correct_lab_result(self, client):
        data = setup_test_data(client)
        result_response = client.post("/lab-results/", json={
            "field_record_id": data["record_id"],
            "parameter_id": data["do_param_id"],
            "raw_value": 10.0,
            "raw_unit_id": data["mg_l_id"],
            "analyst": "测试员"
        })
        result_id = result_response.json()["id"]

        correct_response = client.post(f"/lab-results/{result_id}/correct", json={
            "operator": "质控员",
            "conclusion": "原始数据录入错误，应为6.5",
            "raw_value": 6.5,
            "remark": "已修正"
        })
        assert correct_response.status_code == 200
        assert correct_response.json()["raw_value"] == 6.5
        assert correct_response.json()["remark"] == "已修正"

    def test_withdraw_lab_result(self, client):
        data = setup_test_data(client)
        result_response = client.post("/lab-results/", json={
            "field_record_id": data["record_id"],
            "parameter_id": data["do_param_id"],
            "raw_value": 6.5,
            "raw_unit_id": data["mg_l_id"],
            "analyst": "测试员"
        })
        result_id = result_response.json()["id"]

        client.post(f"/lab-results/{result_id}/approve", json={
            "operator": "审核员A",
            "conclusion": "数据正常"
        })

        withdraw_response = client.post(f"/lab-results/{result_id}/withdraw", json={
            "operator": "质控主管",
            "conclusion": "发现数据异常，撤回审核"
        })
        assert withdraw_response.status_code == 200
        assert withdraw_response.json()["is_approved"] == False


class TestThresholdCheck:
    def test_threshold_check_pass(self, client):
        data = setup_test_data(client)
        result_response = client.post("/lab-results/", json={
            "field_record_id": data["record_id"],
            "parameter_id": data["do_param_id"],
            "raw_value": 6.5,
            "raw_unit_id": data["mg_l_id"],
            "analyst": "测试员"
        })
        result_id = result_response.json()["id"]

        check_response = client.get(f"/lab-results/{result_id}/threshold-check")
        assert check_response.status_code == 200
        assert check_response.json()["passed"] == True
        assert check_response.json()["grade"] == "Ⅱ类"


class TestMissingSamples:
    def test_missing_samples_detection(self, client):
        data = setup_test_data(client)
        client.post("/lab-results/", json={
            "field_record_id": data["record_id"],
            "parameter_id": data["do_param_id"],
            "raw_value": 6.5,
            "raw_unit_id": data["mg_l_id"],
            "analyst": "测试员"
        })

        response = client.get(f"/utils/missing-samples?field_record_ids={data['record_id']}")
        assert response.status_code == 200
        result = response.json()
        assert result["has_missing"] == True
        assert len(result["details"]) > 0


class TestAuditLog:
    def test_audit_log_created_on_approve(self, client):
        data = setup_test_data(client)
        result_response = client.post("/lab-results/", json={
            "field_record_id": data["record_id"],
            "parameter_id": data["do_param_id"],
            "raw_value": 6.5,
            "raw_unit_id": data["mg_l_id"],
            "analyst": "测试员"
        })
        result_id = result_response.json()["id"]

        client.post(f"/lab-results/{result_id}/approve", json={
            "operator": "审核员A",
            "conclusion": "数据正常"
        })

        logs_response = client.get("/audit-logs/", params={"operation_type": "approve"})
        assert logs_response.status_code == 200
        logs = logs_response.json()
        assert len(logs) >= 1
        assert logs[0]["operator"] == "审核员A"
        assert logs[0]["conclusion"] == "数据正常"

    def test_audit_log_contains_original_data(self, client):
        data = setup_test_data(client)
        result_response = client.post("/lab-results/", json={
            "field_record_id": data["record_id"],
            "parameter_id": data["do_param_id"],
            "raw_value": 10.0,
            "raw_unit_id": data["mg_l_id"],
            "analyst": "测试员"
        })
        result_id = result_response.json()["id"]

        client.post(f"/lab-results/{result_id}/correct", json={
            "operator": "质控员",
            "conclusion": "修正数据",
            "raw_value": 6.5
        })

        logs_response = client.get("/audit-logs/", params={"operation_type": "correct"})
        logs = logs_response.json()
        log_id = logs[0]["id"]
        log_detail = client.get(f"/audit-logs/{log_id}").json()

        assert log_detail["original_data"]["raw_value"] == 10.0
        assert log_detail["modified_data"]["raw_value"] == 6.5


class TestReviewReport:
    def test_create_review_report(self, client):
        data = setup_test_data(client)
        client.post("/lab-results/", json={
            "field_record_id": data["record_id"],
            "parameter_id": data["do_param_id"],
            "raw_value": 6.5,
            "raw_unit_id": data["mg_l_id"],
            "analyst": "测试员"
        })

        report_response = client.post("/review-reports/", json={
            "report_code": "RPT001",
            "field_record_ids": [data["record_id"]],
            "reviewer": "复核员"
        })
        assert report_response.status_code == 200
        report = report_response.json()
        assert report["report_code"] == "RPT001"
        assert report["status"] == "draft"

    def test_finalize_review_report(self, client):
        data = setup_test_data(client)
        client.post("/lab-results/", json={
            "field_record_id": data["record_id"],
            "parameter_id": data["do_param_id"],
            "raw_value": 6.5,
            "raw_unit_id": data["mg_l_id"],
            "analyst": "测试员"
        })

        report_response = client.post("/review-reports/", json={
            "report_code": "RPT001",
            "field_record_ids": [data["record_id"]],
            "reviewer": "复核员"
        })
        report_id = report_response.json()["id"]

        finalize_response = client.post(
            f"/review-reports/{report_id}/finalize",
            params={"operator": "复核主管", "conclusion": "数据完整，符合要求"}
        )
        assert finalize_response.status_code == 200
        assert finalize_response.json()["status"] == "finalized"

    def test_double_finalize_report(self, client):
        data = setup_test_data(client)
        report_response = client.post("/review-reports/", json={
            "report_code": "RPT001",
            "field_record_ids": [data["record_id"]],
            "reviewer": "复核员"
        })
        report_id = report_response.json()["id"]

        client.post(
            f"/review-reports/{report_id}/finalize",
            params={"operator": "复核主管", "conclusion": "第一次完成"}
        )

        finalize_response2 = client.post(
            f"/review-reports/{report_id}/finalize",
            params={"operator": "复核主管", "conclusion": "第二次完成"}
        )
        assert finalize_response2.status_code == 400


class TestConflictScenarios:
    def test_sampling_point_code_conflict(self, client):
        client.post("/sampling-points/", json={"point_code": "W001", "point_name": "点位1"})
        response = client.post("/sampling-points/", json={"point_code": "W001", "point_name": "点位2"})
        assert response.status_code == 400

    def test_field_record_code_conflict(self, client):
        data = setup_test_data(client)
        response = client.post("/field-records/", json={
            "record_code": "FR001",
            "sampling_point_id": data["point_id"],
            "sampling_time": datetime(2024, 1, 15, 9, 0).isoformat(),
            "collector": "测试员"
        })
        assert response.status_code == 400

    def test_report_code_conflict(self, client):
        data = setup_test_data(client)
        client.post("/review-reports/", json={
            "report_code": "RPT001",
            "field_record_ids": [data["record_id"]],
            "reviewer": "复核员"
        })
        response = client.post("/review-reports/", json={
            "report_code": "RPT001",
            "field_record_ids": [data["record_id"]],
            "reviewer": "另一复核员"
        })
        assert response.status_code == 400
