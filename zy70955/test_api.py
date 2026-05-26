import json
import subprocess
import sys


BASE = "http://127.0.0.1:8000"


def post(path, data):
    r = subprocess.run(
        ["curl", "-s", "-X", "POST", f"{BASE}{path}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps(data, ensure_ascii=False)],
        capture_output=True, text=True,
    )
    return r.stdout


def get(path):
    r = subprocess.run(
        ["curl", "-s", f"{BASE}{path}"],
        capture_output=True, text=True,
    )
    return r.stdout


def section(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def main():
    section("1. 创建批次 BATCH-2026-001")
    resp = post("/api/batches", {
        "batch_no": "BATCH-2026-001",
        "submitter": "张明",
        "department": "展陈部",
        "source_type": "excel_upload",
    })
    print(resp)
    batch_id = json.loads(resp)["id"]

    section("2. 上传材料（含：正常、缺字段、时间矛盾、重复编号）")
    resp = post(f"/api/batches/{batch_id}/materials", {
        "items": [
            {
                "line_no": 1,
                "artifact_no": "BR-001",
                "artifact_name": "商代青铜鼎",
                "borrower": "中国国家博物馆",
                "lender": "故宫博物院",
                "loan_start": "2026-06-01",
                "loan_end": "2026-08-31",
                "insurance_value": "5,000,000",
                "insurance_type": "综合一切险",
                "condition": "完好",
                "location": "地下文物库",
                "remark": "国宝级",
            },
            {
                "line_no": 2,
                "artifact_no": "BR-002",
                "artifact_name": "唐代鎏金佛像",
                "borrower": "上海博物馆",
                "lender": "故宫博物院",
                "loan_start": "2026-07-01",
                "loan_end": "2026-05-15",
                "insurance_value": "3,200,000",
                "insurance_type": "综合一切险",
                "condition": "完好",
                "location": "珍宝馆",
            },
            {
                "line_no": 3,
                "artifact_no": "BR-001",
                "artifact_name": "宋代汝窑青瓷碗",
                "borrower": "南京博物院",
                "lender": "故宫博物院",
                "loan_start": "2026-09-01",
                "loan_end": "2026-11-30",
                "insurance_value": "8,000,000",
                "insurance_type": "综合一切险",
                "condition": "轻微磨损",
                "location": "瓷器馆",
            },
            {
                "line_no": 4,
                "artifact_no": "BR-004",
                "artifact_name": "元代青花瓷瓶",
                "borrower": "",
                "lender": "",
                "loan_start": "",
                "loan_end": "",
                "insurance_value": "",
                "insurance_type": "",
                "condition": "完好",
                "location": "瓷器馆",
            },
        ]
    })
    print(resp)

    section("3. 查询明细（按类别过滤）")
    for cat in ["normal", "pending", "intercepted"]:
        print(f"--- category={cat} ---")
        print(get(f"/api/batches/{batch_id}/details?category={cat}"))

    section("4. 处理明细 ID 列表")
    details = json.loads(get(f"/api/batches/{batch_id}/details"))
    for d in details:
        print(f"  detail_id={d['id']}  line 对应于 detail_id, 类别={d['category']}  原因={d['reason_code']}")

    section("5. 查询第一条明细的轨迹")
    detail_1_id = details[0]["id"]
    print(get(f"/api/details/{detail_1_id}/trajectory"))

    section("6. 复核：审批第1条")
    print(post(f"/api/details/{detail_1_id}/review", {
        "operator": "李华（复核员）",
        "review_result": "approve",
        "reason": "材料齐全，同意进入报告生成",
    }))

    section("7. 修改第2条的结论（从 intercepted 改为 pending）")
    detail_2_id = details[1]["id"]
    print(post(f"/api/details/{detail_2_id}/review", {
        "operator": "李华（复核员）",
        "review_result": "change",
        "change_target": "category",
        "change_value": "pending",
        "reason": "时间矛盾为录入错误，需展陈部重新核对后补录",
    }))

    section("8. 查询第2条的审计日志（谁改了结论、为什么、改动前是什么）")
    print(get(f"/api/details/{detail_2_id}/audit"))

    section("9. 关键字段溯源：第1条 BR-001")
    print(get(f"/api/details/{detail_1_id}/trace"))

    section("10. 回到原始材料位置：第2条 BR-002")
    print(get(f"/api/details/{detail_2_id}/trajectory"))


if __name__ == "__main__":
    main()
