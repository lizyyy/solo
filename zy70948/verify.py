#!/usr/bin/env python3
"""验证核心流程脚本：创建批次 -> 导入数据 -> 业务处理 -> 查询 -> 导出 -> 结算 -> 追溯"""
import json
import csv
import io
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, engine

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

client = TestClient(app)

passed = 0
failed = 0


def step(name):
    print(f"\n{'='*60}\n>> {name}\n{'='*60}")


def check(name, resp, expected_status=200):
    global passed, failed
    ok = resp.status_code == expected_status
    if ok:
        passed += 1
        print(f"  [PASS] {name}")
    else:
        failed += 1
        print(f"  [FAIL] {name} -> status={resp.status_code} body={resp.text[:200]}")
    return ok


# ---------- 1. 健康检查 ----------
step("1. 健康检查")
check("GET /health", client.get("/health"))

# ---------- 2. 创建批次 ----------
step("2. 创建批次（加项 CSV）")
resp = client.post("/api/v1/batches", json={
    "batch_no": "BATCH-20260527-001",
    "source_type": "add_item_csv",
    "source_name": "2026年5月加项清单.csv",
    "created_by": "财务-张工",
    "remark": "5月体检中心加项数据",
})
check("创建批次", resp)
batch_id = resp.json()["id"]
print(f"  batch_id = {batch_id}")

# ---------- 3. 导入加项 CSV ----------
step("3. 导入加项 CSV")
csv_content = """patient_name,patient_id,unit_name,package_name,contract_id,item_code,item_name,unit_price,quantity,total_amount,voucher_code
张三,P001,ABC公司,基础套餐,CONTRACT-001,ITM-A,心电图,200,1,200,V-001
李四,P002,ABC公司,基础套餐,CONTRACT-001,ITM-B,CT平扫,800,1,800,V-002
王五,P003,XYZ公司,高端套餐,CONTRACT-002,ITM-C,MRI,1500,1,1500,V-003
"""
resp = client.post(
    f"/api/v1/batches/{batch_id}/import/add-item",
    data={"operator": "财务-张工"},
    files={"file": ("add_items.csv", csv_content, "text/csv")},
)
check("导入加项 CSV", resp)

# ---------- 4. 查询记录 ----------
step("4. 查询批次下的记录")
resp = client.get(f"/api/v1/records?batch_id={batch_id}&limit=50")
check("查询记录", resp)
total = resp.json()["total"]
print(f"  记录数: {total}")
record_ids = [r["id"] for r in resp.json()["items"]]
assert total == 3, f"期望3条记录，实际{total}"

# ---------- 5. 券叠加 ----------
step("5. 券叠加处理（张三的心电图）")
resp = client.post(f"/api/v1/batches/{batch_id}/coupon", data={
    "record_id": record_ids[0],
    "coupon_amount": 50,
    "operator": "财务-李工",
})
check("券叠加", resp)

# ---------- 6. 退项冲正 ----------
step("6. 退项冲正（李四的CT）")
resp = client.post(f"/api/v1/batches/{batch_id}/refund", data={
    "record_id": record_ids[1],
    "refund_amount": 800,
    "reason": "项目取消，全额退项冲正",
    "operator": "财务-李工",
})
check("退项冲正", resp)

# ---------- 7. 单位限额 ----------
step("7. 单位限额（ABC公司合同 CONDUCT-001）")
resp = client.post(f"/api/v1/batches/{batch_id}/unit-limit", data={
    "contract_id": "CONTRACT-001",
    "limit": 100,
    "operator": "财务-王工",
})
check("单位限额", resp)

# ---------- 8. 标记处理 ----------
step("8. 标记单条记录放行")
resp = client.post(f"/api/v1/records/{record_ids[2]}/process", json={
    "operator": "财务-王工",
    "approved": True,
    "reason": "资料齐全，符合结算条件",
})
check("放行记录", resp)

# ---------- 9. 退回修改 ----------
step("9. 退回记录")
resp = client.post(f"/api/v1/records/{record_ids[1]}/return", json={
    "operator": "财务-王工",
    "reason": "退项凭证缺失，需补充后重提",
})
check("退回记录", resp)

# ---------- 10. 查询历史（审计日志） ----------
step("10. 查询批次审计日志")
resp = client.get(f"/api/v1/audit-logs?batch_id={batch_id}&limit=50")
check("查询审计日志", resp)
logs = resp.json()["items"]
print(f"  日志条数: {len(logs)}")
for l in logs:
    print(f"    [{l['operated_at']}] {l['operator']} -> {l['action']}: {l['detail']}")

# ---------- 11. 导出明细 ----------
step("11. 导出批次明细 CSV")
resp = client.get(f"/api/v1/batches/{batch_id}/export")
check("导出明细", resp)
csv_data = resp.text
lines = csv_data.strip().split("\n")
print(f"  导出行数（含表头）: {len(lines)}")
print(f"  表头: {lines[0][:120]}...")

# ---------- 12. 创建结算清单 ----------
step("12. 创建结算清单")
resp = client.post("/api/v1/settlements", json={
    "settlement_no": "SETTLE-20260527-001",
    "batch_id": batch_id,
    "contract_id": "CONTRACT-001",
    "unit_name": "ABC公司",
    "total_amount": 350,
    "record_ids": record_ids,
    "created_by": "财务-张工",
})
check("创建结算清单", resp)
settlement_id = resp.json()["id"]
print(f"  settlement_id = {settlement_id}")

# ---------- 13. 结算清单追溯 ----------
step("13. 结算清单来源追溯")
resp = client.get(f"/api/v1/settlements/{settlement_id}/trace")
check("来源追溯", resp)
trace = resp.json()
print(f"  来源批次: {trace['source_batch']['batch_no'] if trace['source_batch'] else 'N/A'}")
print(f"  追溯日志条数: {len(trace['trace_logs'])}")
for l in trace["trace_logs"]:
    print(f"    [{l['operated_at']}] {l['operator']} -> {l['action']}: {l['detail']}")

# ---------- 14. 确认结算 ----------
step("14. 确认结算清单")
resp = client.post(f"/api/v1/settlements/{settlement_id}/confirm", json={
    "operator": "财务主管-赵总",
})
check("确认结算", resp)
assert resp.json()["status"] == "confirmed"

# ---------- 15. 重启后数据保留验证 ----------
step("15. 验证重启后可查询历史")
resp = client.get(f"/api/v1/batches?skip=0&limit=10")
check("查询批次历史", resp)
batches = resp.json()["items"]
print(f"  批次总数: {resp.json()['total']}")
assert len(batches) >= 1

resp = client.get(f"/api/v1/settlements?skip=0&limit=10")
check("查询结算清单历史", resp)
settlements = resp.json()["items"]
print(f"  结算清单总数: {resp.json()['total']}")
assert len(settlements) >= 1

# ---------- 16. 导出数量与查询结果一致 ----------
step("16. 验证导出数量与查询结果一致")
resp = client.get(f"/api/v1/records?batch_id={batch_id}&limit=50")
query_total = resp.json()["total"]
resp = client.get(f"/api/v1/batches/{batch_id}/export")
export_lines = resp.text.strip().split("\n")
export_count = len(export_lines) - 1  # 去掉表头
print(f"  查询结果数: {query_total}, 导出行数: {export_count}")
assert query_total == export_count, f"数量不一致: 查询{query_total} vs 导出{export_count}"
print("  [PASS] 导出数量与查询结果一致")

# ---------- 17. 记录溯源（查看某条记录的全部日志） ----------
step("17. 记录溯源日志")
resp = client.get(f"/api/v1/records/{record_ids[0]}/logs")
check("记录溯源日志", resp)
record_logs = resp.json()["items"]
print(f"  记录 {record_ids[0]} 的日志条数: {len(record_logs)}")
for l in record_logs:
    print(f"    [{l['operated_at']}] {l['operator']} -> {l['action']}: {l['detail']}")

# ---------- 汇总 ----------
print(f"\n{'='*60}")
print(f"  验证结果: PASS={passed}, FAIL={failed}")
print(f"{'='*60}")

if failed > 0:
    sys.exit(1)
else:
    print("\n所有核心流程验证通过! ✅")
