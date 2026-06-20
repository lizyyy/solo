"""
Comprehensive verification script - test all API endpoints
"""
import requests
import json
import sys

BASE = "http://localhost:5060"
results = []


def check(name, condition, detail=""):
    status = "PASS" if condition else "FAIL"
    msg = f"[{status}] {name}"
    if detail:
        msg += f"  ({detail})"
    print(msg)
    results.append((name, status, detail))
    return condition


def main():
    print("=" * 70)
    print("Verification Script - Boundary Sample Management System")
    print("=" * 70)

    # =========== 1. Stats API ===========
    print("\n--- 1. Stats API ---")
    r = requests.get(f"{BASE}/api/stats")
    stats = r.json()["data"]
    check("1a. total=7", stats["total"] == 7, f"total={stats['total']}")
    check("1b. abnormal_count=7", stats["abnormal_count"] == 7, f"abnormal_count={stats['abnormal_count']}")
    pending = stats["status_counts"].get("pending_review", 0)
    check("1c. pending_review=7", pending == 7, f"pending_review={pending}")

    # ===========02. Samples API ===========
    print("\n--- 2. Samples API ---")
    r = requests.get(f"{BASE}/api/samples")
    samples_data = r.json()
    samples = samples_data["data"]
    total = samples_data["total"]
    check("2a. returns 7 samples", total == 7, f"total={total}")
    all_pending = all(s["status"] == "pending_review" for s in samples)
    check("2b. all status=pending_review", all_pending,
          f"statuses: {set(s['status'] for s in samples)}")
    all_dup = all("duplicate_train" in s["anomaly_types"] for s in samples)
    missing = [s['id'] for s in samples if 'duplicate_train' not in s['anomaly_types']]
    check("2c. all contain duplicate_train", all_dup,
          f"missing: {missing}")

    # ===========3. Self-check API ===========
    print("\n--- 3. Self-check API ---")
    r = requests.get(f"{BASE}/api/self-check")
    checks_list = r.json()["data"]
    dup_train_check = next(
        (c for c in checks_list if c["check_name"] == "\u540c\u4e00\u6279\u6570\u636e\u91cd\u590d\u8bad\u7ec3\u68c0\u67e5"), None
    )
    check("3a. duplicate_train check passed=false",
          dup_train_check is not None and dup_train_check["passed"] is False,
          f"passed={dup_train_check['passed'] if dup_train_check else 'NOT FOUND'}")
    check("3b. duplicate_train check problem_count > 0",
          dup_train_check is not None and dup_train_check["problem_count"] > 0,
          f"problem_count={dup_train_check['problem_count'] if dup_train_check else 'N/A'}")

    # ===========4. Sample detail API (sample 1) ============
    print("\n--- 4. Sample detail API (sample 1) ---")
    r = requests.get(f"{BASE}/api/samples/1")
    detail = r.json()
    sample1 = detail["data"]
    audit_logs = detail["audit_logs"]

    check("4a. sample1 has duplicate_train",
          "duplicate_train" in sample1["anomaly_types"],
          f"anomaly_types={sample1['anomaly_types']}")

    slice_count = len(sample1.get("slices", []))
    check("4b. sample1 has exactly 1 slice record",
          slice_count == 1, f"slice_count={slice_count}")

    fv_count = len(sample1.get("feature_versions", []))
    check("4c. sample1 has exactly 1 feature_version record",
          fv_count == 1, f"fv_count={fv_count}")

    add_anomaly_logs = [l for l in audit_logs if l.get("action") == "add_anomaly"]
    anomaly_remarks = [l.get("remark", "") for l in add_anomaly_logs]
    dup_train_logs = [l for l in add_anomaly_logs
                      if "duplicate_train" in (l.get("remark", "") + l.get("detail", ""))]
    dup_train_count = len(dup_train_logs)
    check("4d. add_anomaly for duplicate_train exactly 1 (not 2)",
          dup_train_count == 1, f"count={dup_train_count}, remarks={anomaly_remarks}")

    no_dup_anomalies = len(add_anomaly_logs) == len(set(
        l.get("remark", "") for l in add_anomaly_logs
    ))
    check("4e. no duplicate add_anomaly entries in audit_logs",
          no_dup_anomalies,
          f"add_anomaly entries: {len(add_anomaly_logs)}, unique: {len(set(l.get('remark', '') for l in add_anomaly_logs))}")

    # =========== 5. Feature versions (sample 1) ===========
    print("\n--- 5. Feature versions (sample 1) ---")
    fv_list = sample1.get("feature_versions", [])
    fv_versions = [fv["feature_version"] for fv in fv_list]
    check("5. sample1 feature_versions contains v20260610",
          "v20260610" in fv_versions, f"versions={fv_versions}")

    # =========== 6. Batch feature versions ===========
    print("\n--- 6. Batch feature versions ---")
    r = requests.get(f"{BASE}/api/samples", params={"batch_id": "batch_0615", "page_size": 100})
    batch_samples = r.json()["data"]
    batch_all_versions = set()
    for s in batch_samples:
        r2 = requests.get(f"{BASE}/api/samples/{s['id']}")
        sd = r2.json()["data"]
        for fv in sd.get("feature_versions", []):
            batch_all_versions.add(fv["feature_version"])
    has_v10 = "v20260610" in batch_all_versions
    has_v15 = "v20260615" in batch_all_versions
    check("6a. batch_0615 contains v20260610", has_v10, f"versions={batch_all_versions}")
    check("6b. batch_0615 contains v20260615", has_v15, f"versions={batch_all_versions}")

    # ============ 7. CSV Export =============
    print("\n--- 7. CSV Export ---")
    r = requests.get(f"{BASE}/api/export/csv")
    csv_text = r.text
    csv_lines = csv_text.strip().split("\n")
    data_rows = len(csv_lines) - 1
    check("7a. CSV has 7 data rows (8 lines including header)", data_rows == 7, f"data_rows={data_rows}")
    check("7b. CSV contains duplicate_train label",
          "\u91cd\u590d\u8bad\u7ec3" in csv_text)
    check("7c. CSV contains pending_review label",
          "\u5f85\u4ea7\u54c1\u590d\u6838" in csv_text)

    # ============ 8. JSON Export =============
    print("\n--- 8. JSON Export ---")
    r = requests.get(f"{BASE}/api/export/json")
    json_items = r.json()
    check("8a. JSON exports 7 items", len(json_items) == 7, f"count={len(json_items)}")
    all_pending_json = all(item["status"] == "pending_review" for item in json_items)
    check("8b. JSON all status=pending_review", all_pending_json)
    all_dup_json = all("duplicate_train" in item["anomaly_types"] for item in json_items)
    check("8c. JSON all contain duplicate_train", all_dup_json)

    # ============ 9. Consistency check =============
    print("\n--- 9. Consistency check ---")
    samples_count = total
    csv_count = data_rows
    json_count = len(json_items)
    check("9. samples/csv/json counts are consistent",
          samples_count == csv_count == json_count == 7,
          f"samples={samples_count}, csv={csv_count}, json={json_count}")

    # =========== 10. Audit log integrity ============
    print("\n--- 10. Audit log integrity (sample 1) ---")
    add_anomaly_dup = [l for l in audit_logs
                       if l.get("action") == "add_anomaly"
                       and "duplicate_train" in (l.get("remark", "") + l.get("detail", ""))]
    check("10. sample1 add_anomaly+duplicate_train exactly 1 (KEY CHECK)",
          len(add_anomaly_dup) == 1,
          f"count={len(add_anomaly_dup)}, entries={add_anomaly_dup}")

    # =========== Summary ============
    print("\n" + "=" * 70)
    pass_count = sum(1 for _, s, _ in results if s == "PASS")
    fail_count = sum(1 for _, s, _ in results if s == "FAIL")
    print(f"Total: {len(results)} items, PASS: {pass_count}, FAIL: {fail_count}")
    if fail_count > 0:
        print("\nFailed items:")
        for name, s, detail in results:
            if s == "FAIL":
                print(f"  X {name}  {detail}")
    print("=" * 70)

    if fail_count > 0:
        print("Overall result: FAIL")
        sys.exit(1)
    else:
        print("Overall result: ALL PASS")
        sys.exit(0)


if __name__ == "__main__":
    main()
