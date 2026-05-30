import requests
import json

BASE = "http://localhost:8900/api"

def sep(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

sep("1. 全流程处理 (run-all)")
r = requests.post(f"{BASE}/process/run-all?start_date=2026-06-01&end_date=2026-12-31")
data = r.json()

print("\n▶ 处理顺序:")
for step in data["processing_order"]:
    print(f"  {step}")

print("\n▶ 现金流排程:")
for item in data["cashflow_schedule"]["items"]:
    tag = "[!]" if item["quality_status"] != "normal" else "[OK]"
    notes = " | ".join(item["anomaly_notes"]) if item["anomaly_notes"] else ""
    print(f"  {tag} {item['date']} {item['bond_code']} {item['flow_type']} {item['amount']}万  {notes}")

print(f"\n  总流出: {data['cashflow_schedule']['total_outflow']}万")
print(f"  总流入: {data['cashflow_schedule']['total_inflow']}万")
print(f"  缺口/异常项: {len(data['cashflow_schedule']['gap_items'])}笔")

print("\n▶ 回执匹配:")
print(f"  已匹配: {len(data['receipt_match']['matched'])}笔")
for m in data["receipt_match"]["matched"]:
    print(f"    [OK] {m['bond_code']} 回执{m['receipt_date']} {m['receipt_amount']}万 -> {m['matched_to']}")

print(f"  缺少回执: {len(data['receipt_match']['missing_receipt'])}笔")
for mr in data["receipt_match"]["missing_receipt"]:
    print(f"    [!!] {mr['bond_code']} {mr['flow_type']} {mr['payment_date']} {mr['expected_amount']}万")

print(f"  回执无匹配: {len(data['receipt_match']['unmatched_receipt'])}笔")
for ur in data["receipt_match"]["unmatched_receipt"]:
    print(f"    [??] {ur['bond_code']} 回执{ur['receipt_date']} {ur['receipt_amount']}万 {ur['receipt_no']}")

print("\n▶ 新增预警汇总:")
for w in data["new_warnings"]:
    src = w["source"]
    bc = w.get("bond_code", "")
    extra = {k: v for k, v in w.items() if k not in ("source", "bond_id", "bond_code")}
    print(f"  [{src}] {bc} {json.dumps(extra, ensure_ascii=False)}")

sep("2. 异常概览 (anomaly-summary)")
r2 = requests.get(f"{BASE}/review/anomaly-summary")
summary = r2.json()
for k, v in summary.items():
    print(f"  {k}: {json.dumps(v, ensure_ascii=False)}")

sep("3. 预警单列表")
r3 = requests.get(f"{BASE}/review/warnings?limit=20")
warnings = r3.json()
for w in warnings:
    print(f"  #{w['id']} [{w['warning_type']}] {w['warning_level']} {w['description'][:60]}... status={w['status']}")

sep("4. 验证场景覆盖")
scenarios = {
    "票息重复": any("票息重复" in w.get("warning_type", "") or "票息去重" in str(w) for w in data["new_warnings"]),
    "公告偏晚": any("公告偏晚" in w.get("source", "") for w in data["new_warnings"]),
    "回执缺失": len(data["receipt_match"]["missing_receipt"]) > 0,
    "回执无匹配": len(data["receipt_match"]["unmatched_receipt"]) > 0,
    "资金缺口": any(g["quality_status"] != "normal" or True for g in data["cashflow_schedule"]["gap_items"]),
    "公告版本管理": any("公告版本" in s for s in data["processing_order"]),
}
for scenario, detected in scenarios.items():
    print(f"  {'[PASS]' if detected else '[FAIL]'} {scenario}")

sep("5. 复核流程测试")
if warnings:
    wid = warnings[0]["id"]
    print(f"  选取预警单 #{wid} 进行复核...")
    r4 = requests.put(f"{BASE}/review/warnings/{wid}/resolve", json={
        "resolution": "已确认，票息确实重复录入",
        "resolved_by": "资金岗张三",
    })
    resolved = r4.json()
    print(f"  复核结果: status={resolved['status']}, resolved_by={resolved.get('resolved_by')}")
    
    r5 = requests.get(f"{BASE}/review/impact/{wid}")
    impact = r5.json()
    print(f"  影响范围: {json.dumps(impact.get('affected_records', []), ensure_ascii=False)[:100]}")

sep("6. 导出接口检查")
exports = [
    ("现金流排程", "/export/cashflow-schedule"),
    ("预警明细", "/export/warning-detail"),
    ("回执匹配", "/export/receipt-match"),
    ("完整报告", "/export/full-report"),
]
for name, path in exports:
    r = requests.get(f"{BASE}{path}")
    ct = r.headers.get("content-type", "")
    ok = "spreadsheet" in ct and r.status_code == 200
    print(f"  {'[OK]' if ok else '[FAIL]'} {name}: {r.status_code} {ct[:40]}")

print("\n" + "="*60)
print("  全部验证完成")
print("="*60)
