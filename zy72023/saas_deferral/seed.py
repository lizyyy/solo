import requests
import json
import sys

BASE = "http://127.0.0.1:8000"

def seed():
    records = [
        {
            "batch_id": "DEF-2026-001",
            "customer_name": "深圳锐信科技有限公司",
            "contract_no": "RX-SaaS-2025-0089",
            "subscription_period_start": "2025-07-01",
            "subscription_period_end": "2026-06-30",
            "total_amount": 120000.00,
            "deferred_amount": 60000.00,
            "recognized_amount": 60000.00,
            "source_type": "银行回单",
            "has_voucher": 1,
            "voucher_source": "银行回单-招商银行2025年7月3日到账120000元",
            "contract_scan_note": "",
            "imported_data_note": "",
            "operator": "老曹",
        },
        {
            "batch_id": "DEF-2026-001",
            "customer_name": "杭州云帆数据服务有限公司",
            "contract_no": "YF-SaaS-2025-0142",
            "subscription_period_start": "2025-09-01",
            "subscription_period_end": "2026-08-31",
            "total_amount": 88000.00,
            "deferred_amount": 73333.33,
            "recognized_amount": 14666.67,
            "source_type": "业务台账",
            "has_voucher": 0,
            "voucher_source": "",
            "contract_scan_note": "",
            "imported_data_note": "台账记录2025年9月收到88000元，按12个月分摊，已确认1个月",
            "operator": "老曹",
        },
        {
            "batch_id": "DEF-2026-001",
            "customer_name": "广州博远信息技术有限公司",
            "contract_no": "BY-SaaS-2024-0076",
            "subscription_period_start": "2024-10-01",
            "subscription_period_end": "2025-09-30",
            "total_amount": 96000.00,
            "deferred_amount": 24000.00,
            "recognized_amount": 72000.00,
            "source_type": "群截图+补说明",
            "has_voucher": 1,
            "voucher_source": "群截图-财务群2025年1月聊天记录",
            "contract_scan_note": "合同扫描件显示签约日期2024年10月1日，年费96000元，按月确认，原口径按12个月均摊，每月8000元，已确认9个月共72000元，剩余24000元递延",
            "imported_data_note": "台账记录年费96000元，但入职交接时前任按季度确认（每季度24000元），已确认3个季度共72000元，剩余1个季度24000元递延",
            "operator": "老曹",
        },
    ]

    print("=== 插入样例数据 ===")
    for i, rec in enumerate(records, 1):
        resp = requests.post(f"{BASE}/api/records", json=rec)
        if resp.status_code == 200:
            data = resp.json()
            print(f"  记录{i}: id={data['id']}, 自动状态={data['status']}")
        else:
            print(f"  记录{i}: 创建失败 - {resp.text}")

    print("\n=== 查看汇总 ===")
    resp = requests.get(f"{BASE}/api/summary", params={"batch_id": "DEF-2026-001"})
    if resp.status_code == 200:
        summary = resp.json()
        print(json.dumps(summary, ensure_ascii=False, indent=2))

    print("\n=== 查看各记录详情和建议 ===")
    resp = requests.get(f"{BASE}/api/records", params={"batch_id": "DEF-2026-001"})
    if resp.status_code == 200:
        for rec in resp.json()["records"]:
            print(f"\n--- ID={rec['id']} | {rec['customer_name']} | 状态={rec['status']} ---")
            print(f"  合同号: {rec['contract_no']}")
            print(f"  递延金额: {rec['deferred_amount']}")
            print(f"  处理建议:\n{rec['suggestion']}")

    print("\n=== 确认第1条顺利记录 ===")
    resp = requests.get(f"{BASE}/api/records", params={"batch_id": "DEF-2026-001"})
    records_data = resp.json()["records"]
    smooth_rec = records_data[0]
    resp = requests.put(
        f"{BASE}/api/records/{smooth_rec['id']}/confirm",
        json={"operator": "老曹", "note": "银行回单已核对，金额与合同一致，确认"},
    )
    print(f"  结果: {resp.json()}")

    print("\n=== 再次查看汇总（确认后） ===")
    resp = requests.get(f"{BASE}/api/summary", params={"batch_id": "DEF-2026-001"})
    if resp.status_code == 200:
        summary = resp.json()
        print(json.dumps(summary, ensure_ascii=False, indent=2))

    print("\n=== 为第2条补充凭证后确认 ===")
    suspended_rec = records_data[1]
    resp = requests.put(
        f"{BASE}/api/records/{suspended_rec['id']}/add-voucher",
        json={"operator": "老曹", "note": "银行回单-工商银行2025年9月5日到账88000元"},
    )
    print(f"  补凭证: {resp.json()}")
    resp = requests.put(
        f"{BASE}/api/records/{suspended_rec['id']}/confirm",
        json={"operator": "老曹", "note": "凭证已补齐，按月分摊，确认"},
    )
    print(f"  确认: {resp.json()}")

    print("\n=== 解决第3条冲突：选择合同扫描件口径 ===")
    conflict_rec = records_data[2]
    resp = requests.put(
        f"{BASE}/api/records/{conflict_rec['id']}/resolve-conflict",
        json={
            "operator": "老曹",
            "chosen_side": "contract_scan",
            "note": "合同扫描件为原始签约版本，按月均摊口径更合规，按合同扫描件为准",
        },
    )
    print(f"  解决冲突: {resp.json()}")

    print("\n=== 最终汇总 ===")
    resp = requests.get(f"{BASE}/api/summary", params={"batch_id": "DEF-2026-001"})
    if resp.status_code == 200:
        summary = resp.json()
        print(json.dumps(summary, ensure_ascii=False, indent=2))

    print("\n=== 查看第3条完整审计日志（交接参考） ===")
    resp = requests.get(f"{BASE}/api/records/{conflict_rec['id']}")
    if resp.status_code == 200:
        detail = resp.json()
        print(f"客户: {detail['customer_name']}")
        print(f"状态: {detail['status']}")
        print(f"操作人备注: {detail['operator_note']}")
        print("审计日志:")
        for log in detail["audit_log"]:
            print(f"  [{log['created_at']}] {log['action']} by {log['operator']}: {log['detail']}")

    print("\n=== 导出CSV报告 ===")
    resp = requests.get(f"{BASE}/api/records/export/csv", params={"batch_id": "DEF-2026-001"})
    if resp.status_code == 200:
        print(f"  CSV导出成功，共 {len(resp.text.splitlines())} 行")
        for line in resp.text.splitlines()[:4]:
            print(f"  {line[:120]}...")

    print("\n✅ 样例数据走通完成！")

if __name__ == "__main__":
    try:
        seed()
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接服务，请先启动: uvicorn saas_deferral.main:app --reload")
        sys.exit(1)
