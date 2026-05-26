import csv
import io

import httpx

BASE = "http://127.0.0.1:8000"
c = httpx.Client(base_url=BASE, timeout=10)


def main():
    print("== health ==", c.get("/health").json())

    print("== create batch ==")
    r = c.post("/api/v1/batches", json={
        "name": "batch-2026-05-27-b",
        "operator": "zhangsan",
        "source": "csv",
        "remark": "示例批次",
    })
    print(r.status_code, r.json())
    batch_id = r.json()["id"]

    csv_text = (
        "agent_id,agent_name,deduction_item,deduction_score,original_score,final_score,call_date,call_id,recording_summary,note\n"
        "A001,张三,话术不规范,5,95,90,2026-05-20,C001,客户不满，未安抚,首检\n"
        "A002,李四,未登记客户信息,3,97,94,2026-05-21,C002,记录缺失,首检\n"
        "A003,王五,未使用标准用语,2,98,96,2026-05-21,C003,话术偏差,首检\n"
    )
    print("== import csv ==")
    r = c.post(f"/api/v1/batches/{batch_id}/import/csv",
               files={"file": ("qc.csv", csv_text, "text/csv")})
    print(r.status_code, r.json())

    print("== query all ==")
    r = c.post("/api/v1/items/query", json={})
    q1 = r.json()
    print("total:", q1["total"], "items:", len(q1["items"]))
    assert q1["total"] == len(q1["items"]) == 3

    print("== query by agent_id A001 ==")
    r = c.post("/api/v1/items/query", json={"agent_id": "A001"})
    q2 = r.json()
    print("total:", q2["total"], "items:", len(q2["items"]))
    item_id = q2["items"][0]["id"]
    assert q2["total"] == 1

    print("== mark processing ==")
    r = c.post(f"/api/v1/items/{item_id}/mark-processing", json={"handler": "lisi", "reason": "开始处理"})
    it = r.json()
    print("status:", it["status"])
    assert it["status"] == "processing"

    print("== return item ==")
    r = c.post(f"/api/v1/items/{item_id}/return", json={
        "handler": "lisi",
        "reason": "摘要不全，需补录音关键片段",
        "request_material": True,
    })
    it = r.json()
    print("status:", it["status"])
    assert it["status"] == "returned"

    print("== second review ==")
    r = c.post(f"/api/v1/items/{item_id}/second-review", json={
        "reviewer": "wangwu",
        "reason": "复核结论：扣分项属实但扣分过严，调整为 2 分",
        "adjust_score": 93,
    })
    it = r.json()
    print("final_score:", it["final_score"], "reviewed_by:", it["reviewed_by"])
    assert it["reviewed_by"] == "wangwu"

    print("== cancel deduction ==")
    r = c.post(f"/api/v1/items/{item_id}/cancel-deduction", json={
        "handler": "wangwu",
        "reason": "申诉通过，该扣分项撤回",
        "deduction_item": "话术不规范",
    })
    it = r.json()
    print("deduction_score:", it["deduction_score"], "final_score:", it["final_score"])
    assert it["deduction_score"] == 0.0

    print("== approve ==")
    r = c.post(f"/api/v1/items/{item_id}/approve", json={
        "reviewer": "wangwu",
        "reason": "复核后确认放行",
    })
    it = r.json()
    print("status:", it["status"])
    assert it["status"] == "approved"

    print("== trace ==")
    r = c.get(f"/api/v1/items/{item_id}/trace")
    trace = r.json()
    print("events:", len(trace["events"]), "appeals:", len(trace["appeals"]))
    for ev in trace["events"]:
        print(f"  seq={ev['seq']} {ev['action']} by {ev['actor']} [{ev.get('from_status')}->{ev.get('to_status')}] reason={ev.get('reason')}")

    print("== export items csv (same query) ==")
    r = c.post("/api/v1/exports/items/csv", json={"agent_id": "A001"})
    reader = list(csv.reader(io.StringIO(r.text)))
    print("rows (including header):", len(reader))
    assert len(reader) - 1 == 1, f"导出数量应等于查询结果数量 1，实际为 {len(reader) - 1}"

    print("== query by reviewed_by wangwu ==")
    r = c.post("/api/v1/items/query", json={"reviewed_by": "wangwu"})
    q3 = r.json()
    print("total:", q3["total"], "items:", len(q3["items"]))
    assert q3["total"] == len(q3["items"]) == 1

    print("== export trace csv ==")
    r = c.get(f"/api/v1/exports/items/{item_id}/trace/csv")
    print("trace csv head:")
    print("\n".join(r.text.splitlines()[:6]))

    print("\nALL CHECKS PASSED")


if __name__ == "__main__":
    main()
