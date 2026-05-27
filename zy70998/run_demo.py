#!/usr/bin/env python3
"""
工会福利领取核销对账服务 —— 端到端演示脚本
演示完整流程：导入 → 自动比对 → 人工复核 → 重算 → 报告生成 → 差异解释
"""
import requests
import json
import sys
import time

BASE_URL = "http://127.0.0.1:8000"


def log(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def post(endpoint, data=None, files=None):
    url = f"{BASE_URL}{endpoint}"
    if files:
        resp = requests.post(url, files=files)
    elif data:
        resp = requests.post(url, json=data)
    else:
        resp = requests.post(url)
    return resp.json()


def get(endpoint):
    return requests.get(f"{BASE_URL}{endpoint}").json()


def main():
    log("步骤 1：导入员工 JSON")
    with open("sample_data/employees.json", "rb") as f:
        result = post("/api/import/employees", files={"file": ("employees.json", f, "application/json")})
    print(json.dumps(result, indent=2, ensure_ascii=False))

    log("步骤 2：导入券码 CSV")
    with open("sample_data/coupons.csv", "rb") as f:
        result = post("/api/import/coupons", files={"file": ("coupons.csv", f, "text/csv")})
    print(json.dumps(result, indent=2, ensure_ascii=False))

    log("步骤 3：导入领用 CSV")
    with open("sample_data/requisitions.csv", "rb") as f:
        result = post("/api/import/requisitions", files={"file": ("requisitions.csv", f, "text/csv")})
    print(json.dumps(result, indent=2, ensure_ascii=False))
    req_batch_no = result["batch_no"]

    log("步骤 4：执行自动比对")
    result = post(f"/api/reconcile/run?requisition_batch_no={req_batch_no}")
    print(json.dumps(result, indent=2, ensure_ascii=False))

    log("步骤 5：查看对账统计")
    stats = get(f"/api/reconcile/stats?batch_no={req_batch_no}")
    print(json.dumps(stats, indent=2, ensure_ascii=False))

    log("步骤 6：查看对账明细列表")
    records = get(f"/api/reconcile/records?batch_no={req_batch_no}&page_size=20")
    print(f"共 {records['total']} 条记录")
    for item in records["items"]:
        flags = item["anomaly_flags"]
        print(f"  ID={item['id']} {item['emp_no']}-{item['emp_name']} "
              f"券={item['coupon_code']} 方式={item['claim_type']} "
              f"金额={item['claim_amount']} 复核={item['review_status']} "
              f"异常={flags}")

    rec_ids = [item["id"] for item in records["items"]]

    log("步骤 7：人工复核 —— 单条放行")
    if rec_ids:
        result = post(f"/api/review/records/{rec_ids[0]}", data={
            "action": "approve",
            "comment": "张三本人领取，身份核实无误，券码状态正常，予以放行",
            "operator": "李干事",
        })
        print(json.dumps(result, indent=2, ensure_ascii=False))

    log("步骤 8：人工复核 —— 退回离职员工领取")
    resigned_rec = next((r for r in records["items"] if r["is_resigned"]), None)
    if resigned_rec:
        result = post(f"/api/review/records/{resigned_rec['id']}", data={
            "action": "reject",
            "comment": "王五已于2025年12月离职，不符合春节福利发放条件，予以退回",
            "operator": "李干事",
        })
        print(json.dumps(result, indent=2, ensure_ascii=False))

    log("步骤 9：人工复核 —— 要求补材料（代领）")
    proxy_rec = next((r for r in records["items"] if r["is_proxy"]), None)
    if proxy_rec:
        result = post(f"/api/review/records/{proxy_rec['id']}", data={
            "action": "return",
            "comment": "赵六由钱七代领，需补充代领授权书和双方身份证复印件",
            "operator": "李干事",
        })
        print(json.dumps(result, indent=2, ensure_ascii=False))

    log("步骤 10：查看某条记录的完整详情和差异解释")
    if rec_ids:
        detail = get(f"/api/reconcile/records/{rec_ids[0]}")
        print(json.dumps(detail, indent=2, ensure_ascii=False))

        log("步骤 10b：对外可解释说明")
        explanation = get(f"/api/report/explanation/{rec_ids[0]}")
        print(json.dumps(explanation, indent=2, ensure_ascii=False))

    log("步骤 11：重新计算汇总（复核改动后同步）")
    result = post("/api/review/recalculate", data={
        "batch_nos": [req_batch_no],
        "operator": "李干事",
    })
    print(json.dumps(result, indent=2, ensure_ascii=False))

    log("步骤 12：生成报告")
    result = post("/api/report/generate", data={
        "title": "2025年春节福利发放核销对账报告",
        "batch_nos": [req_batch_no],
        "generated_by": "李干事",
    })
    print(json.dumps(result, indent=2, ensure_ascii=False))
    report_id = result["report_id"]

    log("步骤 13：查看报告详情（含完整明细追溯）")
    report_detail = get(f"/api/report/{report_id}")
    print(f"报告 {report_detail['report']['report_no']} 包含 {len(report_detail['items'])} 条明细")
    for item in report_detail["items"][:3]:
        print(f"  {item['emp_no']}-{item['emp_name']} 最终状态={item['final_status']} "
              f"金额={item['final_amount']} 解释={item['explanation']}")

    log("步骤 14：离职员工领取记录的对外说明")
    if resigned_rec:
        explanation = get(f"/api/report/explanation/{resigned_rec['id']}")
        print(json.dumps(explanation, indent=2, ensure_ascii=False))

    log("步骤 15：代领记录的对外说明")
    if proxy_rec:
        explanation = get(f"/api/report/explanation/{proxy_rec['id']}")
        print(json.dumps(explanation, indent=2, ensure_ascii=False))

    log("演示完成！")


if __name__ == "__main__":
    main()
