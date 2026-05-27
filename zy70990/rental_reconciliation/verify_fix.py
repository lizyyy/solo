import os
import sys
import tempfile

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db

TEST_DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///:memory:")

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def main():
    print("=" * 60)
    print("退款冲正后余额同步验证脚本")
    print("=" * 60)
    print()

    try:
        print("【步骤1】创建订单，押金 2000")
        order_data = {
            "order_no": "VERIFY-FIX-001",
            "tenant_name": "验证测试用户",
            "tenant_phone": "13800138000",
            "room_no": "TEST-101",
            "check_in_date": "2024-01-01T00:00:00",
            "check_out_date": "2024-01-05T00:00:00",
            "rental_amount": 1500.0,
            "deposit_amount": 2000.0
        }
        create_response = client.post("/api/orders", json=order_data)
        assert create_response.status_code == 200, f"创建订单失败: {create_response.text}"
        order_id = create_response.json()["id"]
        print(f"  订单创建成功，订单ID: {order_id}")
        print()

        print("【步骤2】导入 50 度电的抄表数据")
        meter_csv_data = "order_no,meter_type,initial_reading,final_reading,unit\nVERIFY-FIX-001,electricity,100,150,kWh"
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(meter_csv_data)
            meter_file = f.name

        with open(meter_file, "rb") as f:
            import_response = client.post(
                "/api/orders/import/meter-csv",
                files={"file": ("meter.csv", f, "text/csv")}
            )
        os.unlink(meter_file)
        assert import_response.status_code == 200, f"导入抄表数据失败: {import_response.text}"
        import_result = import_response.json()
        assert import_result["success"] is True, f"导入失败: {import_result}"
        print(f"  抄表数据导入成功，导入数量: {import_result['imported_count']}")
        print()

        print("【步骤3】执行对账，记录 balance_before")
        recon_before = client.post(f"/api/reconciliation/{order_id}")
        assert recon_before.status_code == 200, f"对账失败: {recon_before.text}"
        result_before = recon_before.json()
        balance_before = result_before["cost_summary"]["final_deposit_balance"]
        print(f"  对账完成，余额 (balance_before): {balance_before}")
        print()

        print("【步骤4】执行 refund_correction +100")
        action_data = {
            "action": "refund_correction",
            "target_type": "deposit",
            "new_value": {
                "order_id": order_id,
                "correction_amount": 100.0
            },
            "reason": "验证退款冲正余额同步",
            "reviewer": "验证管理员"
        }
        correction_response = client.post("/api/review/action", json=action_data)
        assert correction_response.status_code == 200, f"退款冲正失败: {correction_response.text}"
        correction_result = correction_response.json()
        assert correction_result["success"] is True, f"退款冲正失败: {correction_result}"
        print(f"  退款冲正成功，冲正金额: +100")
        print()

        print("【步骤5】查询押金历史，记录 history_balance")
        history_response = client.get(f"/api/reports/deposit/{order_id}/history")
        assert history_response.status_code == 200, f"查询押金历史失败: {history_response.text}"
        history = history_response.json()
        assert history["success"] is True, f"查询押金历史失败: {history}"

        history_records = history.get("history", [])
        if history_records:
            latest_record = history_records[-1]
            history_balance = latest_record.get("balance")
        else:
            history_balance = history.get("current_balance")

        print(f"  押金历史查询成功，历史余额 (history_balance): {history_balance}")
        print()

        print("【步骤6】再次对账，记录 recon_balance 和 recon_diff")
        recon_after = client.post(f"/api/reconciliation/{order_id}")
        assert recon_after.status_code == 200, f"再次对账失败: {recon_after.text}"
        result_after = recon_after.json()
        recon_balance = result_after["cost_summary"]["final_deposit_balance"]
        recon_diff = result_after["differences"]
        print(f"  对账完成，对账余额 (recon_balance): {recon_balance}")
        print(f"  差异数量 (len(recon_diff)): {len(recon_diff)}")
        if len(recon_diff) > 0:
            for diff in recon_diff:
                print(f"     - {diff}")
        print()

        print("【步骤7】生成报告，记录 report_balance")
        report_response = client.post(f"/api/reports/{order_id}/generate")
        assert report_response.status_code == 200, f"生成报告失败: {report_response.text}"
        report_result = report_response.json()
        assert report_result["success"] is True, f"生成报告失败: {report_result}"

        report_data = report_result.get("report_data", {})
        cost_breakdown = report_data.get("cost_breakdown", {})
        report_balance = cost_breakdown.get("final_balance")

        if report_balance is None:
            report_balance = report_data.get("final_balance")

        print(f"  报告生成成功，报告余额 (report_balance): {report_balance}")
        print()

        print("=" * 60)
        print("验证结果")
        print("=" * 60)
        print()

        print(f"数据汇总:")
        print(f"  balance_before = {balance_before}")
        print(f"  history_balance = {history_balance}")
        print(f"  recon_balance = {recon_balance}")
        print(f"  report_balance = {report_balance}")
        print(f"  len(recon_diff) = {len(recon_diff)}")
        print()

        condition1_passed = abs(recon_balance - (balance_before + 100)) < 0.01
        condition2_passed = abs(recon_balance - history_balance) < 0.01
        condition3_passed = len(recon_diff) == 0
        condition4_passed = abs(report_balance - recon_balance) < 0.01

        all_passed = condition1_passed and condition2_passed and condition3_passed and condition4_passed

        print("验证条件:")
        print(f"  1. recon_balance == balance_before + 100")
        print(f"     预期: {balance_before + 100}, 实际: {recon_balance}")
        print(f"     结果: {'通过' if condition1_passed else '失败'}")
        print()

        print(f"  2. recon_balance == history_balance")
        print(f"     预期: {history_balance}, 实际: {recon_balance}")
        print(f"     结果: {'通过' if condition2_passed else '失败'}")
        print()

        print(f"  3. len(recon_diff) == 0")
        print(f"     预期: 0, 实际: {len(recon_diff)}")
        print(f"     结果: {'通过' if condition3_passed else '失败'}")
        print()

        print(f"  4. report_balance == recon_balance")
        print(f"     预期: {recon_balance}, 实际: {report_balance}")
        print(f"     结果: {'通过' if condition4_passed else '失败'}")
        print()

        print("=" * 60)
        if all_passed:
            print("所有验证条件全部通过！")
        else:
            print("部分验证条件未通过！")
        print("=" * 60)

        return 0 if all_passed else 1

    except Exception as e:
        print(f"执行过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
