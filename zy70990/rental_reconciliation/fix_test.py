import os

test_file = 'tests/test_reconciliation.py'

with open(test_file, 'r') as f:
    lines = f.readlines()

# 找到 test_deposit_refund_correction 结束的位置
insert_idx = None
for i, line in enumerate(lines):
    if 'assert result["success"] is True' in line and i > 380:
        # 找到这个断言之后的空行
        if i + 2 < len(lines) and lines[i+1].strip() == '' and lines[i+2].strip() == '':
            insert_idx = i + 2
            break

if insert_idx is None:
    print("Could not find insertion point")
else:
    new_test = [
        '\n',
        '    def test_deposit_correction_sync_with_reconciliation(self, db_session):\n',
        '        """测试退款冲正后对账结果同步更新"""\n',
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
        '        recon_after = client.post(f"/api/reconciliation/{order_id}")\n',
        '        result_after = recon_after.json()\n',
        '        balance_after = result_after["cost_summary"]["final_deposit_balance"]\n',
        '\n',
        '        assert abs(balance_after - (balance_before + 100.0)) < 0.01, \\\n',
        '            f"冲正后余额未同步更新: before={balance_before}, after={balance_after}"\n',
        '\n',
        '        history_response = client.get(f"/api/reports/deposit/{order_id}/history")\n',
        '        history = history_response.json()\n',
        '        assert history["success"] is True\n',
        '\n',
        '        report_response = client.post(f"/api/reports/{order_id}/generate")\n',
        '        assert report_response.status_code == 200\n',
        '        report = report_response.json()\n',
        '        assert report["success"] is True\n',
        '\n',
        '        report_balance = report["report_data"]["cost_breakdown"]["final_balance"]\n',
        '        assert abs(report_balance - balance_after) < 0.01, \\\n',
        '            f"报告余额与对账结果不一致: report={report_balance}, reconciliation={balance_after}"\n',
        '\n'
    ]
    
    lines = lines[:insert_idx] + new_test + lines[insert_idx:]
    
    with open(test_file, 'w') as f:
        f.writelines(lines)
    
    print(f'Successfully added new test at line {insert_idx}')