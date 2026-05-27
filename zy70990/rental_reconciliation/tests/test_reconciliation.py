import pytest
import json
import os
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db
from app.config import settings

TEST_DATABASE_URL = "sqlite:///./test_rental_reconciliation.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.rollback()
    db.close()
    Base.metadata.drop_all(bind=engine)


class TestOrderManagement:
    def test_create_order(self, db_session):
        order_data = {
            "order_no": "TEST-001",
            "tenant_name": "张三",
            "tenant_phone": "13800138000",
            "room_no": "A101",
            "check_in_date": "2024-01-01T00:00:00",
            "check_out_date": "2024-01-05T00:00:00",
            "rental_amount": 1500.0,
            "deposit_amount": 2000.0
        }
        response = client.post("/api/orders", json=order_data)
        assert response.status_code == 200
        data = response.json()
        assert data["order_no"] == "TEST-001"
        assert data["deposit_status"] == "pending"

    def test_list_orders(self, db_session):
        for i in range(3):
            order_data = {
                "order_no": f"TEST-00{i+1}",
                "tenant_name": f"租客{i+1}",
                "room_no": f"A10{i+1}",
                "check_in_date": "2024-01-01T00:00:00",
                "check_out_date": "2024-01-05T00:00:00",
                "rental_amount": 1500.0,
                "deposit_amount": 2000.0
            }
            client.post("/api/orders", json=order_data)

        response = client.get("/api/orders")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    def test_get_order(self, db_session):
        order_data = {
            "order_no": "TEST-001",
            "tenant_name": "张三",
            "room_no": "A101",
            "check_in_date": "2024-01-01T00:00:00",
            "check_out_date": "2024-01-05T00:00:00",
            "rental_amount": 1500.0,
            "deposit_amount": 2000.0
        }
        create_response = client.post("/api/orders", json=order_data)
        order_id = create_response.json()["id"]

        response = client.get(f"/api/orders/{order_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["order_no"] == "TEST-001"

    def test_import_order_json(self, db_session):
        import_data = [
            {
                "order_no": "IMPORT-001",
                "tenant_name": "导入租客1",
                "room_no": "B201",
                "check_in_date": "2024-02-01T00:00:00",
                "check_out_date": "2024-02-05T00:00:00",
                "rental_amount": 2000.0,
                "deposit_amount": 3000.0
            },
            {
                "order_no": "IMPORT-002",
                "tenant_name": "导入租客2",
                "room_no": "B202",
                "check_in_date": "2024-02-10T00:00:00",
                "check_out_date": "2024-02-15T00:00:00",
                "rental_amount": 1800.0,
                "deposit_amount": 2500.0
            }
        ]

        import_file = "/tmp/test_import.json"
        with open(import_file, "w", encoding="utf-8") as f:
            json.dump(import_data, f, ensure_ascii=False)

        with open(import_file, "rb") as f:
            response = client.post(
                "/api/orders/import/json",
                files={"file": ("test.json", f, "application/json")}
            )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["imported_count"] == 2

        os.remove(import_file)


class TestReconciliation:
    def test_reconcile_order(self, db_session):
        order_data = {
            "order_no": "RECON-001",
            "tenant_name": "对账测试",
            "room_no": "C301",
            "check_in_date": "2024-01-01T00:00:00",
            "check_out_date": "2024-01-05T00:00:00",
            "rental_amount": 1500.0,
            "deposit_amount": 2000.0
        }
        create_response = client.post("/api/orders", json=order_data)
        order_id = create_response.json()["id"]

        meter_csv_data = "order_no,meter_type,initial_reading,final_reading,unit\nRECON-001,electricity,100,150,kWh\nRECON-001,water,10,15,tons"

        meter_file = "/tmp/test_meter.csv"
        with open(meter_file, "w", encoding="utf-8") as f:
            f.write(meter_csv_data)

        with open(meter_file, "rb") as f:
            meter_response = client.post(
                "/api/orders/import/meter-csv",
                files={"file": ("meter.csv", f, "text/csv")}
            )
        assert meter_response.status_code == 200

        os.remove(meter_file)

        response = client.post(f"/api/reconciliation/{order_id}")
        assert response.status_code == 200
        result = response.json()

        assert result["order_id"] == order_id
        assert result["cost_summary"]["electricity_cost"] > 0
        assert result["cost_summary"]["water_cost"] > 0
        assert result["cost_summary"]["utility_total"] > 0

    def test_electricity_tiered_pricing(self, db_session):
        order_data = {
            "order_no": "TIER-001",
            "tenant_name": "阶梯电价测试",
            "room_no": "D401",
            "check_in_date": "2024-01-01T00:00:00",
            "check_out_date": "2024-01-05T00:00:00",
            "rental_amount": 1500.0,
            "deposit_amount": 2000.0
        }
        create_response = client.post("/api/orders", json=order_data)
        order_id = create_response.json()["id"]

        meter_csv_data = "order_no,meter_type,initial_reading,final_reading,unit\nTIER-001,electricity,0,200,kWh"

        meter_file = "/tmp/test_tier.csv"
        with open(meter_file, "w", encoding="utf-8") as f:
            f.write(meter_csv_data)

        with open(meter_file, "rb") as f:
            meter_response = client.post(
                "/api/orders/import/meter-csv",
                files={"file": ("tier.csv", f, "text/csv")}
            )

        os.remove(meter_file)

        response = client.post(f"/api/reconciliation/{order_id}")
        result = response.json()

        elec_detail = result["electricity_details"][0]
        assert elec_detail["consumption"] == 200

        t1 = min(200, settings.ELECTRICITY_TIER_THRESHOLD_1)
        t1_cost = t1 * settings.ELECTRICITY_TIER_RATE_1

        remaining = 200 - t1
        t2 = min(remaining, settings.ELECTRICITY_TIER_THRESHOLD_2 - settings.ELECTRICITY_TIER_THRESHOLD_1) if remaining > 0 else 0
        t2_cost = t2 * settings.ELECTRICITY_TIER_RATE_2

        remaining -= t2
        t3 = max(0, remaining)
        t3_cost = t3 * settings.ELECTRICITY_TIER_RATE_3

        expected_total = t1_cost + t2_cost + t3_cost

        assert abs(elec_detail["total_cost"] - expected_total) < 0.01

    def test_difference_detection(self, db_session):
        order_data = {
            "order_no": "DIFF-001",
            "tenant_name": "差异测试",
            "room_no": "E501",
            "check_in_date": "2024-01-01T00:00:00",
            "check_out_date": "2024-01-05T00:00:00",
            "rental_amount": 1500.0,
            "deposit_amount": 2000.0
        }
        create_response = client.post("/api/orders", json=order_data)
        order_id = create_response.json()["id"]

        meter_csv_data = "order_no,meter_type,initial_reading,final_reading,unit\nDIFF-001,electricity,200,100,kWh"

        meter_file = "/tmp/test_diff.csv"
        with open(meter_file, "w", encoding="utf-8") as f:
            f.write(meter_csv_data)

        with open(meter_file, "rb") as f:
            client.post(
                "/api/orders/import/meter-csv",
                files={"file": ("diff.csv", f, "text/csv")}
            )

        os.remove(meter_file)

        response = client.post(f"/api/reconciliation/{order_id}")
        result = response.json()

        assert len(result["differences"]) > 0
        assert result["needs_review"] is True


class TestReview:
    def test_verify_deduction(self, db_session):
        order_data = {
            "order_no": "REVIEW-001",
            "tenant_name": "复核测试",
            "room_no": "F601",
            "check_in_date": "2024-01-01T00:00:00",
            "check_out_date": "2024-01-05T00:00:00",
            "rental_amount": 1500.0,
            "deposit_amount": 2000.0
        }
        create_response = client.post("/api/orders", json=order_data)
        order_id = create_response.json()["id"]

        ded_data = {
            "order_no": "REVIEW-001",
            "deduction_type": "damage",
            "amount": 200.0,
            "description": "墙面损坏"
        }

        ded_file = "/tmp/test_ded.json"
        with open(ded_file, "w", encoding="utf-8") as f:
            json.dump([ded_data], f, ensure_ascii=False)

        with open(ded_file, "rb") as f:
            ded_response = client.post(
                "/api/orders/import/deduction-batch",
                files={"file": ("ded.json", f, "application/json")}
            )

        assert ded_response.status_code == 200

        os.remove(ded_file)

        from app.models import Deduction
        db = TestingSessionLocal()
        deduction = db.query(Deduction).filter(Deduction.order_id == order_id).first()
        ded_id = deduction.id if deduction else None
        db.close()

        if ded_id:
            action_data = {
                "action": "verify",
                "target_type": "deduction",
                "target_id": ded_id,
                "reason": "损坏情况属实，同意扣款",
                "reviewer": "运营管理员"
            }

            response = client.post("/api/review/action", json=action_data)
            assert response.status_code == 200
            result = response.json()
            assert result["success"] is True

    def test_reject_deduction(self, db_session):
        order_data = {
            "order_no": "REJECT-001",
            "tenant_name": "驳回测试",
            "room_no": "G701",
            "check_in_date": "2024-01-01T00:00:00",
            "check_out_date": "2024-01-05T00:00:00",
            "rental_amount": 1500.0,
            "deposit_amount": 2000.0
        }
        create_response = client.post("/api/orders", json=order_data)
        order_id = create_response.json()["id"]

        ded_data = {
            "order_no": "REJECT-001",
            "deduction_type": "damage",
            "amount": 500.0,
            "description": "地板划痕"
        }

        ded_file = "/tmp/test_reject.json"
        with open(ded_file, "w", encoding="utf-8") as f:
            json.dump([ded_data], f, ensure_ascii=False)

        with open(ded_file, "rb") as f:
            client.post(
                "/api/orders/import/deduction-batch",
                files={"file": ("reject.json", f, "application/json")}
            )

        os.remove(ded_file)

        from app.models import Deduction
        db = TestingSessionLocal()
        deduction = db.query(Deduction).filter(Deduction.order_id == order_id).first()
        ded_id = deduction.id if deduction else None
        db.close()

        if ded_id:
            action_data = {
                "action": "reject",
                "target_type": "deduction",
                "target_id": ded_id,
                "reason": "证据不足，无法确认损坏",
                "reviewer": "运营管理员"
            }

            response = client.post("/api/review/action", json=action_data)
            assert response.status_code == 200
            result = response.json()
            assert result["success"] is True

    def test_deposit_refund_correction(self, db_session):
        order_data = {
            "order_no": "CORR-001",
            "tenant_name": "退款冲正测试",
            "room_no": "H801",
            "check_in_date": "2024-01-01T00:00:00",
            "check_out_date": "2024-01-05T00:00:00",
            "rental_amount": 1500.0,
            "deposit_amount": 2000.0
        }
        create_response = client.post("/api/orders", json=order_data)
        order_id = create_response.json()["id"]

        action_data = {
            "action": "refund_correction",
            "target_type": "deposit",
            "new_value": {
                "order_id": order_id,
                "correction_amount": 100.0
            },
            "reason": "之前多扣了费用，需要退款冲正",
            "reviewer": "财务主管"
        }

        response = client.post("/api/review/action", json=action_data)
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True

    def test_deposit_correction_sync_with_reconciliation(self, db_session):
        """测试退款冲正后对账结果同步更新"""
        order_data = {
            "order_no": "CORR-SYNC-001",
            "tenant_name": "冲正同步测试",
            "room_no": "SYNC-001",
            "check_in_date": "2024-01-01T00:00:00",
            "check_out_date": "2024-01-05T00:00:00",
            "rental_amount": 1500.0,
            "deposit_amount": 2000.0
        }
        create_response = client.post("/api/orders", json=order_data)
        order_id = create_response.json()["id"]

        meter_csv_data = "order_no,meter_type,initial_reading,final_reading,unit\nCORR-SYNC-001,electricity,100,150,kWh"
        meter_file = "/tmp/test_corr_sync.csv"
        with open(meter_file, "w", encoding="utf-8") as f:
            f.write(meter_csv_data)

        with open(meter_file, "rb") as f:
            client.post(
                "/api/orders/import/meter-csv",
                files={"file": ("corr_sync.csv", f, "text/csv")}
            )
        os.remove(meter_file)

        recon_before = client.post(f"/api/reconciliation/{order_id}")
        result_before = recon_before.json()
        balance_before = result_before["cost_summary"]["final_deposit_balance"]
        differences_before = result_before["differences"]

        action_data = {
            "action": "refund_correction",
            "target_type": "deposit",
            "new_value": {
                "order_id": order_id,
                "correction_amount": 100.0
            },
            "reason": "测试冲正同步",
            "reviewer": "测试员"
        }
        response = client.post("/api/review/action", json=action_data)
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True

        recon_after = client.post(f"/api/reconciliation/{order_id}")
        result_after = recon_after.json()
        balance_after = result_after["cost_summary"]["final_deposit_balance"]

        assert abs(balance_after - (balance_before + 100.0)) < 0.01, \
            f"冲正后余额未同步更新: before={balance_before}, after={balance_after}"

        history_response = client.get(f"/api/reports/deposit/{order_id}/history")
        history = history_response.json()
        assert history["success"] is True

        report_response = client.post(f"/api/reports/{order_id}/generate")
        assert report_response.status_code == 200
        report = report_response.json()
        assert report["success"] is True

        report_balance = report["report_data"]["cost_breakdown"]["final_balance"]
        assert abs(report_balance - balance_after) < 0.01, \
            f"报告余额与对账结果不一致: report={report_balance}, reconciliation={balance_after}"


class TestDepositHistory:
    def test_deposit_history(self, db_session):
        order_data = {
            "order_no": "HISTORY-001",
            "tenant_name": "历史追溯测试",
            "room_no": "I901",
            "check_in_date": "2024-01-01T00:00:00",
            "check_out_date": "2024-01-05T00:00:00",
            "rental_amount": 1500.0,
            "deposit_amount": 2000.0
        }
        create_response = client.post("/api/orders", json=order_data)
        order_id = create_response.json()["id"]

        meter_csv_data = "order_no,meter_type,initial_reading,final_reading,unit\nHISTORY-001,electricity,100,130,kWh"

        meter_file = "/tmp/test_history.csv"
        with open(meter_file, "w", encoding="utf-8") as f:
            f.write(meter_csv_data)

        with open(meter_file, "rb") as f:
            client.post(
                "/api/orders/import/meter-csv",
                files={"file": ("history.csv", f, "text/csv")}
            )

        os.remove(meter_file)

        response = client.get(f"/api/reports/deposit/{order_id}/history")
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert "history" in result
        assert "current_balance" in result

    def test_deposit_trace(self, db_session):
        order_data = {
            "order_no": "TRACE-001",
            "tenant_name": "押金追溯测试",
            "room_no": "J001",
            "check_in_date": "2024-01-01T00:00:00",
            "check_out_date": "2024-01-05T00:00:00",
            "rental_amount": 1500.0,
            "deposit_amount": 2000.0
        }
        create_response = client.post("/api/orders", json=order_data)
        order_id = create_response.json()["id"]

        response = client.get(f"/api/reports/deposit/{order_id}/trace")
        assert response.status_code == 200
        result = response.json()
        assert "transactions" in result
        assert "audit_trail" in result


class TestReport:
    def test_generate_report(self, db_session):
        order_data = {
            "order_no": "REPORT-001",
            "tenant_name": "报告测试",
            "room_no": "K101",
            "check_in_date": "2024-01-01T00:00:00",
            "check_out_date": "2024-01-05T00:00:00",
            "rental_amount": 1500.0,
            "deposit_amount": 2000.0
        }
        create_response = client.post("/api/orders", json=order_data)
        order_id = create_response.json()["id"]

        meter_csv_data = "order_no,meter_type,initial_reading,final_reading,unit\nREPORT-001,electricity,100,120,kWh\nREPORT-001,water,5,8,tons"

        meter_file = "/tmp/test_report.csv"
        with open(meter_file, "w", encoding="utf-8") as f:
            f.write(meter_csv_data)

        with open(meter_file, "rb") as f:
            client.post(
                "/api/orders/import/meter-csv",
                files={"file": ("report.csv", f, "text/csv")}
            )

        os.remove(meter_file)

        response = client.post(f"/api/reports/{order_id}/generate")
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert "report_no" in result
        assert "report_data" in result
        assert result["report_data"]["cost_breakdown"]["electricity"] > 0

    def test_export_report(self, db_session):
        order_data = {
            "order_no": "EXPORT-001",
            "tenant_name": "导出测试",
            "room_no": "L201",
            "check_in_date": "2024-01-01T00:00:00",
            "check_out_date": "2024-01-05T00:00:00",
            "rental_amount": 1500.0,
            "deposit_amount": 2000.0
        }
        create_response = client.post("/api/orders", json=order_data)
        order_id = create_response.json()["id"]

        gen_response = client.post(f"/api/reports/{order_id}/generate")
        report_no = gen_response.json()["report_no"]

        export_response = client.post(f"/api/reports/{report_no}/export?format=text")
        assert export_response.status_code == 200
        result = export_response.json()
        assert result["success"] is True
        assert "content" in result

    def test_list_reports(self, db_session):
        for i in range(2):
            order_data = {
                "order_no": f"LIST-{i+1:03d}",
                "tenant_name": f"列表测试{i+1}",
                "room_no": f"M{i+1:03d}",
                "check_in_date": "2024-01-01T00:00:00",
                "check_out_date": "2024-01-05T00:00:00",
                "rental_amount": 1500.0,
                "deposit_amount": 2000.0
            }
            create_response = client.post("/api/orders", json=order_data)
            order_id = create_response.json()["id"]
            client.post(f"/api/reports/{order_id}/generate")

        response = client.get("/api/reports/list")
        assert response.status_code == 200
        data = response.json()
        assert len(data["reports"]) == 2


class TestEndToEnd:
    def test_full_reconciliation_workflow(self, db_session):
        order_data = {
            "order_no": "E2E-001",
            "tenant_name": "端到端测试",
            "room_no": "N101",
            "check_in_date": "2024-01-01T00:00:00",
            "check_out_date": "2024-01-05T00:00:00",
            "rental_amount": 2000.0,
            "deposit_amount": 3000.0
        }
        create_response = client.post("/api/orders", json=order_data)
        order_id = create_response.json()["id"]

        meter_csv_data = "order_no,meter_type,initial_reading,final_reading,unit\nE2E-001,electricity,50,100,kWh\nE2E-001,water,20,30,tons"

        meter_file = "/tmp/test_e2e.csv"
        with open(meter_file, "w", encoding="utf-8") as f:
            f.write(meter_csv_data)

        with open(meter_file, "rb") as f:
            client.post(
                "/api/orders/import/meter-csv",
                files={"file": ("e2e.csv", f, "text/csv")}
            )

        os.remove(meter_file)

        ded_data = [
            {
                "order_no": "E2E-001",
                "deduction_type": "cleaning",
                "amount": 150.0,
                "description": "清洁费"
            },
            {
                "order_no": "E2E-001",
                "deduction_type": "damage",
                "amount": 300.0,
                "description": "家具损坏"
            }
        ]

        ded_file = "/tmp/test_e2e_ded.json"
        with open(ded_file, "w", encoding="utf-8") as f:
            json.dump(ded_data, f, ensure_ascii=False)

        with open(ded_file, "rb") as f:
            client.post(
                "/api/orders/import/deduction-batch",
                files={"file": ("e2e_ded.json", f, "application/json")}
            )

        os.remove(ded_file)

        recon_response = client.post(f"/api/reconciliation/{order_id}")
        recon_result = recon_response.json()
        assert recon_result["needs_review"] is True

        from app.models import Deduction
        db = TestingSessionLocal()
        deductions = db.query(Deduction).filter(Deduction.order_id == order_id).all()

        for ded in deductions:
            action_data = {
                "action": "verify",
                "target_type": "deduction",
                "target_id": ded.id,
                "reason": "费用合理，同意扣款",
                "reviewer": "运营管理员"
            }
            client.post("/api/review/action", json=action_data)

        db.close()

        recon_response2 = client.post(f"/api/reconciliation/{order_id}")
        recon_result2 = recon_response2.json()

        assert recon_result2["cost_summary"]["deduction_total"] == 450.0

        report_response = client.post(f"/api/reports/{order_id}/generate")
        assert report_response.status_code == 200
        report_result = report_response.json()
        assert report_result["success"] is True
        report_no = report_result["report_no"]

        export_response = client.post(f"/api/reports/{report_no}/export?format=text")
        assert export_response.status_code == 200

        history_response = client.get(f"/api/reports/deposit/{order_id}/trace")
        assert history_response.status_code == 200
        trace_result = history_response.json()
        assert len(trace_result["audit_trail"]) >= 2

        assert recon_result2["cost_summary"]["deposit_refund"] >= 0


class TestVerifyFix:
    """验证退款冲正后的余额同步 - 四个条件"""
    
    def test_verify_four_conditions(self, db_session):
        """验证退款冲正后的余额同步 - 四个条件"""
        import tempfile
        
        print()
        print("=" * 60)
        print("VERIFICATION RESULTS")
        print("=" * 60)
        print()
        
        # Step 1: Create order
        print("Step 1: Creating order (deposit=2000)...")
        order_data = {
            "order_no": "VERIFY-FIX-001",
            "tenant_name": "Test",
            "tenant_phone": "13800138000",
            "room_no": "101",
            "check_in_date": "2024-01-01T00:00:00",
            "check_out_date": "2024-01-05T00:00:00",
            "rental_amount": 1500.0,
            "deposit_amount": 2000.0
        }
        r = client.post("/api/orders", json=order_data)
        order_id = r.json()["id"]
        print(f"  order_id={order_id}")
        
        # Step 2: Import meter data (50 kWh)
        print("Step 2: Importing 50 kWh meter data...")
        meter_csv = "order_no,meter_type,initial_reading,final_reading,unit\nVERIFY-FIX-001,electricity,100,150,kWh"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(meter_csv)
            meter_file = f.name
        with open(meter_file, "rb") as f:
            r = client.post("/api/orders/import/meter-csv", files={"file": ("meter.csv", f, "text/csv")})
        os.unlink(meter_file)
        imported = r.json().get("imported_count", 0)
        print(f"  imported={imported}")
        
        # Step 3: First reconciliation
        print("Step 3: Running first reconciliation...")
        r = client.post(f"/api/reconciliation/{order_id}")
        balance_before = r.json()["cost_summary"]["final_deposit_balance"]
        print(f"  balance_before = {balance_before}")
        
        # Step 4: Refund correction +100
        print("Step 4: Executing refund_correction +100...")
        action_data = {
            "action": "refund_correction",
            "target_type": "deposit",
            "new_value": {"order_id": order_id, "correction_amount": 100.0},
            "reason": "Verify fix",
            "reviewer": "Admin"
        }
        r = client.post("/api/review/action", json=action_data)
        success = r.json().get("success", False)
        print(f"  success={success}")
        
        # Step 5: Deposit history
        print("Step 5: Querying deposit history...")
        r = client.get(f"/api/reports/deposit/{order_id}/history")
        h = r.json()
        records = h.get("history", [])
        if records:
            history_balance = records[-1].get("balance")
        else:
            history_balance = h.get("current_balance")
        print(f"  history_balance = {history_balance}")
        
        # Step 6: Second reconciliation
        print("Step 6: Running second reconciliation...")
        r = client.post(f"/api/reconciliation/{order_id}")
        res = r.json()
        recon_balance = res["cost_summary"]["final_deposit_balance"]
        recon_diff = res["differences"]
        print(f"  recon_balance = {recon_balance}")
        print(f"  len(recon_diff) = {len(recon_diff)}")
        
        # Step 7: Generate report
        print("Step 7: Generating report...")
        r = client.post(f"/api/reports/{order_id}/generate")
        rep = r.json()
        rd = rep.get("report_data", {})
        cb = rd.get("cost_breakdown", {})
        report_balance = cb.get("final_balance", rd.get("final_balance"))
        print(f"  report_balance = {report_balance}")
        
        print()
        print("Data Summary:")
        print(f"  balance_before  = {balance_before}")
        print(f"  history_balance = {history_balance}")
        print(f"  recon_balance   = {recon_balance}")
        print(f"  report_balance  = {report_balance}")
        print(f"  len(recon_diff) = {len(recon_diff)}")
        print()
        
        # Verify conditions
        c1 = abs(recon_balance - (balance_before + 100)) < 0.01
        c2 = abs(recon_balance - history_balance) < 0.01
        c3 = len(recon_diff) == 0
        c4 = abs(report_balance - recon_balance) < 0.01
        all_pass = c1 and c2 and c3 and c4
        
        pt1 = "PASS" if c1 else "FAIL"
        pt2 = "PASS" if c2 else "FAIL"
        pt3 = "PASS" if c3 else "FAIL"
        pt4 = "PASS" if c4 else "FAIL"
        apt = "PASSED" if all_pass else "FAILED"
        
        print("Conditions:")
        print(f"  1. recon_balance == balance_before + 100")
        print(f"     Expected: {balance_before + 100}, Actual: {recon_balance}")
        print(f"     Result: {pt1}")
        print()
        print(f"  2. recon_balance == history_balance")
        print(f"     Expected: {history_balance}, Actual: {recon_balance}")
        print(f"     Result: {pt2}")
        print()
        print(f"  3. len(recon_diff) == 0")
        print(f"     Expected: 0, Actual: {len(recon_diff)}")
        print(f"     Result: {pt3}")
        print()
        print(f"  4. report_balance == recon_balance")
        print(f"     Expected: {recon_balance}, Actual: {report_balance}")
        print(f"     Result: {pt4}")
        print()
        
        print("=" * 60)
        print(f"ALL CONDITIONS: {apt}")
        print("=" * 60)
        print()
        
        assert c1, f"Condition 1 failed: recon_balance({recon_balance}) != balance_before + 100({balance_before + 100})"
        assert c2, f"Condition 2 failed: recon_balance({recon_balance}) != history_balance({history_balance})"
        assert c3, f"Condition 3 failed: len(recon_diff) = {len(recon_diff)}"
        assert c4, f"Condition 4 failed: report_balance({report_balance}) != recon_balance({recon_balance})"
        assert recon_result2["cost_summary"]["deposit_refund"] >= 0
        assert recon_result2["cost_summary"]["deposit_refund"] >= 0