#!/usr/bin/env python3
"""添加退款冲正同步测试到测试文件"""

import os

test_file = 'tests/test_reconciliation.py'

with open(test_file, 'r') as f:
    lines = f.readlines()

# 找到 test_deposit_refund_correction 结束的位置（第389行后）
# 在第390行（索引390）之后插入新测试
insert_pos = 391  # 索引位置

new_test_lines = [
    '\n',
    '    def test_deposit_correction_sync_with_reconciliation(self, db_session):\n',
    '        """测试退款冲正后对账结果、押金历史、报告数据同步更新"""\n',
    '        order_data = {\n',
    '            "order_no": "CORR-SYNC-001",\n',
    '            "tenant_name": "冲正同步测试",\n',
    '            "room_no": "SYNC-001",\n',
    '            "check_in_date": "2024-01-01T00:00:00",\n',
    '            "check_out_date": "2024-01-05T00:00:00",\n',
    '            "rental_amount": 1500.0,\n',
    '            "deposit_amount": 2000.0\n',
    '        }\n',
    '        create_response = client.post("/api/orders", json=order_data)\n',
    '        order_id = create_response.json()["id"]\n',
    '\n',
    '        meter_csv_data = "order_no,meter_type,initial_reading,final_reading,unit\\nCORR-SYNC-001,electricity,100,150,kWh"\n',
    '        meter_file = "/tmp/test_corr_sync.csv"\n',
    '        with open(meter_file, "w", encoding="utf-8") as f:\n',
    '            f.write(meter_csv_data)\n',
    '\n',
    '        with open(meter_file, "rb") as f:\n',
    '            client.post(\n',
    '                "/api/orders/import/meter-csv",\n',
    '                files={"file": ("corr_sync.csv", f, "text/csv")}\n',
    '            )\n',
    '        os.remove(meter_file)\n',
    '\n',
    '        recon_before = client.post(f"/api/reconciliation/{order_id}")\n',
    '        result_before = recon_before.json()\n',
    '        balance_before = result_before["cost_summary"]["final_deposit_balance"]\n',
    '        differences_before = result_before["differences"]\n',
    '\n',
    '        action_data = {\n',
    '            "action": "refund_correction",\n',
    '            "target_type": "deposit",\n',
    '            "new_value": {\n',
    '                "order_id": order_id,\n',
    '                "correction_amount": 100.0\n',
    '            },\n',
    '            "reason": "测试冲正同步",\n',
    '            "reviewer": "测试员"\n',
    '        }\n',
    '        response = client.post("/api/review/action", json=action_data)\n',
    '        assert response.status_code == 200\n',
    '        result = response.json()\n',
    '        assert result["success"] is True\n',
    '\n',
    '        history_response = client.get(f"/api/reports/deposit/{order_id}/history")\n',
    '        history = history_response.json()\n',
    '        assert history["success"] is True\n',
    '        history_balance = history["current_balance"]\n',
    '\n',
    '        recon_after = client.post(f"/api/reconciliation/{order_id}")\n',
    '        result_after = recon_after.json()\n',
    '        balance_after = result_after["cost_summary"]["final_deposit_balance"]\n',
    '        differences_after = result_after["differences"]\n',
    '\n',
    '        assert abs(balance_after - (balance_before + 100.0)) < 0.01, \\\n',
    '            f"冲正后对账余额未同步更新: before={balance_before}, after={balance_after}"\n',
    '\n',
    '        assert abs(balance_after - history_balance) < 0.01, \\\n',
    '            f"对账余额与押金历史余额不一致: reconciliation={balance_after}, history={history_balance}"\n',
    '\n',
    '        assert len(differences_after) == 0, \\\n',
    '            f"冲正后仍存在差异: {differences_after}"\n',
    '\n',
    '        report_response = client.post(f"/api/reports/{order_id}/generate")\n',
    '        assert report_response.status_code == 200\n',
    '        report = report_response.json()\n',
    '        assert report["success"] is True\n',
    '\n',
    '        report_balance = report["report_data"]["cost_breakdown"]["final_balance"]\n',
    '        assert abs(report_balance - balance_after) < 0.01, \\\n',
    '            f"报告余额与对账结果不一致: report={report_balance}, reconciliation={balance_after}"\n',
]

# 插入新测试
lines = lines[:insert_pos] + new_test_lines + lines[insert_pos:]

with open(test_file, 'w') as f:
    f.writelines(lines)

print(f'✅ 成功在第 {insert_pos} 行插入新测试 test_deposit_correction_sync_with_reconciliation')
