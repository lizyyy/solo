#!/usr/bin/env python3
import json
import urllib.request
import sys

BASE = "http://127.0.0.1:5001"


def http(method, path, data=None, headers=None):
    url = BASE + path
    body = None
    hs = {"Accept": "application/json"}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        hs["Content-Type"] = "application/json"
    if headers:
        hs.update(headers)
    req = urllib.request.Request(url, data=body, method=method, headers=hs)
    with urllib.request.urlopen(req) as r:
        text = r.read().decode("utf-8")
        ct = r.headers.get("Content-Type", "")
        if "application/json" in ct:
            return json.loads(text)
        return text


def main():
    print("=== 1. reset + 导入样例数据 ===")
    http("POST", "/api/reset")
    state = http("POST", "/api/import/sample")
    print("summary:", json.dumps(state["summary"], ensure_ascii=False))
    pending_dz = [r for r in state["evidence"] if r["anomaly_type"] == "denominator_zero_empty_string" and r["current_status"] in ("pending_review", "auto_flagged")]
    print(f"分母=0空串 待复核: {len(pending_dz)} 条, cleaned: {len(state['cleaned_rows'])} 条")
    assert len(pending_dz) >= 1
    eid = pending_dz[0]["evidence_id"]
    print("target:", eid)

    print("\n=== 2. 证据详情 ===")
    detail = http("GET", f"/api/evidence/{eid}")
    rec = detail["record"]
    print(f"原始行号: {rec['original_row']}, 当前状态: {rec['current_status']}")
    print(f"detail: {rec['detail']}")

    print("\n=== 3. 实验助理补录（不应提前归正常）===")
    state2 = http("POST", "/api/supplement", {
        "evidence_id": eid,
        "new_values": {"count_a": "3", "count_b": "4", "denominator": "7"},
        "supplemented_by": "实验助理小穆",
    })
    rec2 = next(r for r in state2["evidence"] if r["evidence_id"] == eid)
    print(f"状态: {rec2['current_status']} (应为 supplemented)")
    print(f"补录人: {rec2['supplemented_by']}")
    print(f"原始说法存在: {bool(rec2.get('original_statement'))}")
    print(f"next_step: {rec2['next_step']}")
    still_anomaly = any(r.get("_original_row") == rec2["original_row"] for r in state2["anomaly_rows"])
    in_cleaned = any(r.get("_original_row") == rec2["original_row"] for r in state2["cleaned_rows"])
    print(f"仍在异常列表: {still_anomaly} (应 True), 已在正常列表: {in_cleaned} (应 False)")
    assert rec2["current_status"] == "supplemented"
    assert still_anomaly is True
    assert in_cleaned is False

    print("\n=== 4. 复核人确认移入正常 ===")
    state3 = http("POST", "/api/review", {
        "evidence_id": eid,
        "confirmed_normal": True,
        "note": "对照原始问卷第3页，A组Q3共7人",
        "reviewer": "数据复核人老K",
    })
    rec3 = next(r for r in state3["evidence"] if r["evidence_id"] == eid)
    print(f"状态: {rec3['current_status']} (应 confirmed_normal)")
    print(f"复核人: {rec3['reviewer']}")
    print(f"review_reason: {rec3['review_reason']}")
    print(f"corrected_value: {rec3['corrected_value']}")
    print(f"next_step: {rec3['next_step']}")
    in_cleaned = any(r.get("_original_row") == rec3["original_row"] for r in state3["cleaned_rows"])
    out_anomaly = not any(r.get("_original_row") == rec3["original_row"] for r in state3["anomaly_rows"])
    print(f"已在正常列表: {in_cleaned} (T), 已离开异常列表: {out_anomaly} (T)")
    print(f"chi_square: {state3['chi_square_result']}")
    assert rec3["current_status"] == "confirmed_normal"
    assert in_cleaned is True
    assert out_anomaly is True

    print("\n=== 5. 四路一致性 (display/api/export/json报告) ===")
    api_s = http("GET", "/api/state")
    req = urllib.request.Request(BASE + "/api/export/result_json", method="GET", headers={"Accept": "application/json"})
    with urllib.request.urlopen(req) as r:
        export = json.loads(r.read().decode("utf-8"))
    assert api_s["cleaned_rows"] == export["result"]["cleaned_rows"], "cleaned mismatch"
    assert api_s["anomaly_rows"] == export["result"]["anomaly_rows"], "anomaly mismatch"
    assert api_s["chi_square_result"] == export["result"]["chi_square_result"], "chi mismatch"
    assert api_s["summary"] == export["result"]["summary"], "summary mismatch"
    print("✅ display/api/export/json 四路完全一致")

    print("\n=== 6. 自检 ===")
    checks = http("GET", "/api/selfcheck")["checks"]
    for c in checks:
        print(f"  [{c['status']:4s}] {c['check']:30s}: {c['detail']}")
    failed = [c for c in checks if c["status"] == "FAIL"]
    assert not failed, f"自检失败: {failed}"

    print("\n=== 7. 报告前10行 ===")
    req = urllib.request.Request(BASE + "/api/export/report", method="GET")
    with urllib.request.urlopen(req) as r:
        report = r.read().decode("utf-8")
    for line in report.splitlines()[:10]:
        print("  ", line)
    assert "# 卡方检验问卷清洗报告" in report
    assert "证据列表" in report

    print("\n🎉 全部端到端检查通过")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)
