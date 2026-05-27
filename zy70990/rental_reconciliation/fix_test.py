#!/usr/bin/env python3
import os

test_file = 'tests/test_reconciliation.py'

# 读取文件
with open(test_file, 'r') as f:
    content = f.read()

# 1. 添加 differences_before
old1 = '''        balance_before = result_before["cost_summary"]["final_deposit_balance"]

        action_data'''

new1 = '''        balance_before = result_before["cost_summary"]["final_deposit_balance"]
        differences_before = result_before["differences"]

        action_data'''

content = content.replace(old1, new1)

# 2. 重新排序并强化断言
old2 = '''        assert result["success"] is True

        recon_after = client.post(f"/api/reconciliation/{order_id}")
        result_after = recon_after.json()
        balance_after = result_after["cost_summary"]["final_deposit_balance"]

        assert abs(balance_after - (balance_before + 100.0)) < 0.01, \\
            f"冲正后余额未同步更新: before={balance_before}, after={balance_after}"

        history_response = client.get(f"/api/reports/deposit/{order_id}/history")
        history = history_response.json()
        assert history["success"] is True

        report_response = client.post(f"/api/reports/{order_id}/generate")
        assert report_response.status_code == 200
        report = report_response.json()
        assert report["success"] is True

        report_balance = report["report_data"]["cost_breakdown"]["final_balance"]
        assert abs(report_balance - balance_after) < 0.01, \\
            f"报告余额与对账结果不一致: report={report_balance}, reconciliation={balance_after}"'''

new2 = '''        assert result["success"] is True

        history_response = client.get(f"/api/reports/deposit/{order_id}/history")
        history = history_response.json()
        assert history["success"] is True
        history_balance = history["current_balance"]

        recon_after = client.post(f"/api/reconciliation/{order_id}")
        result_after = recon_after.json()
        balance_after = result_after["cost_summary"]["final_deposit_balance"]
        differences_after = result_after["differences"]

        assert abs(balance_after - (balance_before + 100.0)) < 0.01, \\
            f"冲正后对账余额未同步更新: before={balance_before}, after={balance_after}"

        assert abs(balance_after - history_balance) < 0.01, \\
            f"对账余额与押金历史余额不一致: reconciliation={balance_after}, history={history_balance}"

        assert len(differences_after) == 0, \\
            f"冲正后仍存在差异: {differences_after}"

        report_response = client.post(f"/api/reports/{order_id}/generate")
        assert report_response.status_code == 200
        report = report_response.json()
        assert report["success"] is True

        report_balance = report["report_data"]["cost_breakdown"]["final_balance"]
        assert abs(report_balance - balance_after) < 0.01, \\
            f"报告余额与对账结果不一致: report={report_balance}, reconciliation={balance_after}"'''

content = content.replace(old2, new2)

# 写回文件
with open(test_file, 'w') as f:
    f.write(content)

print('✅ 测试已更新')

# 语法检查
import ast
ast.parse(open(test_file).read())
print('✅ 语法检查通过')
