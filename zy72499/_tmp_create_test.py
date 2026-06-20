content = '''#!/usr/bin/env python3
import subprocess
import json
import os
import sys
import glob
import re
import shutil
from datetime import datetime

SESSION_ID = "TEST-REPLAY"
WORK_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(WORK_DIR)


def run(cmd, check=True):
    print()
    print("$ " + cmd, flush=True)
    result = subprocess.run(
        cmd, shell=True, capture_output=True, text=True, cwd=WORK_DIR,
    )
    if result.stdout:
        print(result.stdout, flush=True)
    if result.stderr:
        print(result.stderr, file=sys.stderr, flush=True)
    if check and result.returncode != 0:
        print("ERROR: Command failed: " + cmd, flush=True)
        sys.exit(1)
    return result.stdout


def load_session_json(session_id):
    path = os.path.join(WORK_DIR, "sessions", session_id + ".json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def assert_eq(label, actual, expected):
    ok = actual == expected
    status = "PASS" if ok else "FAIL"
    print("  [" + status + "] " + label + ": expected=" + str(expected) + ", actual=" + str(actual), flush=True)
    if not ok:
        print("  ASSERTION FAILED: " + label, flush=True)
        sys.exit(1)


def extract_step1_stats(output):
    m = re.search(r"新增\\s*(\\d+)\\s*条.*跳过重复\\s*(\\d+)\\s*条", output)
    if not m:
        print("  ERROR: parse Step1 failed", flush=True)
        sys.exit(1)
    return int(m.group(1)), int(m.group(2))


def extract_step2_stats(output):
    m = re.search(r"更新\\s*(\\d+)\\s*条.*跳过\\s*(\\d+)\\s*条", output)
    if not m:
        print("  ERROR: parse Step2 failed", flush=True)
        sys.exit(1)
    return int(m.group(1)), int(m.group(2))


def extract_step3_stats(output):
    m = re.search(
        r"正常归并\\s*(\\d+)\\s*条.*临时改道待复核\\s*(\\d+)\\s*条.*旧口径补录\\s*(\\d+)\\s*条.*冲突待确认\\s*(\\d+)\\s*条",
        output,
    )
    if not m:
        print("  ERROR: parse Step3 failed", flush=True)
        sys.exit(1)
    return int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))


def parse_summary_counts(summary_output):
    counts = {}
    for line in summary_output.splitlines():
        m = re.search(r"(已归并|待居民代表复核|已补录|冲突待确认|已驳回|已导入|待审核路口照片)\\s*[:：]\\s*(\\d+)\\s*条", line)
        if m:
            counts[m.group(1)] = int(m.group(2))
    points_count = len(re.findall(r"•\\s*P-\\d+", summary_output))
    counts["点位总数"] = points_count
    return counts


def parse_md_stats(md_content):
    counts = {}
    for line in md_content.splitlines():
        m = re.search(r"\\*\\*(已归并|待居民代表复核|已补录|冲突待确认|已驳回|已导入|待审核路口照片)\\*\\*\\s*[:：]\\s*(\\d+)\\s*条", line)
        if m:
            counts[m.group(1)] = int(m.group(2))
    return counts


def parse_md_points(md_content):
    section = md_content.split("## 二、点位清单")[1].split("## 三、记录明细与历史轨迹")[0]
    point_ids = re.findall(r"\\|\\s*(P-\\d+)\\s*\\|", section)
    return sorted(point_ids)


def parse_md_records(md_content):
    section = md_content.split("## 三、记录明细与历史轨迹")[1].split("## 四、点位清单与历史记录核对")[0]
    records = {}
    pattern = r"### (R-\\d+) - [^\\n]+\\n.*?- \\*\\*当前状态\\*\\*: ([^\\n]+)\\n"
    for m in re.finditer(pattern, section, re.DOTALL):
        records[m.group(1)] = m.group(2).strip()
    return records


def get_session_state(session_json):
    record_ids = sorted([r["record_id"] for r in session_json["records"]])
    record_statuses = {r["record_id"]: r["status"] for r in session_json["records"]}
    point_ids = sorted([p["point_id"] for p in session_json["points"]])
    return {
        "record_count": len(session_json["records"]),
        "record_ids": record_ids,
        "record_statuses": record_statuses,
        "point_count": len(session_json["points"]),
        "point_ids": point_ids,
    }


def assert_state_eq(label, s1, s2):
    assert_eq(label + ": record_count", s1["record_count"], s2["record_count"])
    assert_eq(label + ": record_ids", s1["record_ids"], s2["record_ids"])
    assert_eq(label + ": record_statuses", s1["record_statuses"], s2["record_statuses"])
    assert_eq(label + ": point_count", s1["point_count"], s2["point_count"])
    assert_eq(label + ": point_ids", s1["point_ids"], s2["point_ids"])


def main():
    print("=" * 70, flush=True)
    print("  E2E Idempotency Test", flush=True)
    print("=" * 70, flush=True)

    print()
    print("--- Step 1: Cleanup environment ---", flush=True)
    sessions_dir = os.path.join(WORK_DIR, "sessions")
    output_dir = os.path.join(WORK_DIR, "output")
    if os.path.exists(sessions_dir):
        shutil.rmtree(sessions_dir)
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(sessions_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    print("  Cleaned sessions/ and output/", flush=True)

    print()
    print("--- Step 2: First run ---", flush=True)
    run('python3 main.py init --session ' + SESSION_ID + ' --name "归并重放测试"')
    out = run("python3 main.py import --session " + SESSION_ID + " --data all")
    new_imported, skipped = extract_step1_stats(out)
    assert_eq("Step1 first: new count", new_imported, 3)
    assert_eq("Step1 first: skipped count", skipped, 0)

    out = run("python3 main.py review-photos --session " + SESSION_ID + " --data all --reviewer 周姐")
    updated, skipped = extract_step2_stats(out)
    assert_eq("Step2 first: updated count", updated, 3)
    assert_eq("Step2 first: skipped count", skipped, 0)

    out = run("python3 main.py update-points --session " + SESSION_ID)
    normal, detour, supplementary, conflict = extract_step3_stats(out)
    assert_eq("Step3 first: normal merged", normal, 1)
    assert_eq("Step3 first: pending review (detour)", detour, 1)
    assert_eq("Step3 first: supplemented (old)", supplementary, 1)
    assert_eq("Step3 first: conflict", conflict, 0)

    print()
    print("--- Step 3: Record state S1 ---", flush=True)
    session_s1 = load_session_json(SESSION_ID)
    s1 = get_session_state(session_s1)
    assert_eq("S1: record_count", s1["record_count"], 3)
    assert_eq("S1: record_ids", s1["record_ids"], ["R-001", "R-002", "R-003"])
    assert_eq("S1: record_statuses", s1["record_statuses"], {
        "R-001": "已归并",
        "R-002": "待居民代表复核",
        "R-003": "已补录",
    })
    assert_eq("S1: point_count", s1["point_count"], 2)
    assert_eq("S1: point_ids", s1["point_ids"], ["P-001", "P-002"])
    print("  S1 recorded successfully", flush=True)

    print()
    print("--- Step 4: Generate report and replay script ---", flush=True)
    run("python3 main.py generate-report --session " + SESSION_ID)

    md_files = glob.glob(os.path.join(output_dir, "复盘记录_*.md"))
    sh_files = glob.glob(os.path.join(output_dir, "重跑命令_*.sh"))
    assert_eq("After generate: .md exists", len(md_files) >= 1, True)
    assert_eq("After generate: .sh exists", len(sh_files) >= 1, True)

    latest_md = max(md_files, key=os.path.getmtime)
    latest_sh = max(sh_files, key=os.path.getmtime)
    print("  MD: " + latest_md, flush=True)
    print("  SH: " + latest_sh, flush=True)

    with open(latest_md, "r", encoding="utf-8") as f:
        md_content = f.read()
    with open(latest_sh, "r", encoding="utf-8") as f:
        sh_content = f.read()

    print()
    print("--- Step 5: Re-run all 3 steps on existing session ---", flush=True)
    out = run("python3 main.py import --session " + SESSION_ID + " --data all")
    new_imported, skipped = extract_step1_stats(out)
    assert_eq("Re-run Step1: new count", new_imported, 0)
    assert_eq("Re-run Step1: skipped count", skipped, 3)

    out = run("python3 main.py review-photos --session " + SESSION_ID + " --data all --reviewer 周姐")
    updated, skipped = extract_step2_stats(out)
    assert_eq("Re-run Step2: updated count", updated, 0)
    assert_eq("Re-run Step2: skipped count", skipped, 3)

    out = run("python3 main.py update-points --session " + SESSION_ID)
    normal, detour, supplementary, conflict = extract_step3_stats(out)
    assert_eq("Re-run Step3: normal merged", normal, 0)
    assert_eq("Re-run Step3: pending review", detour, 0)
    assert_eq("Re-run Step3: supplemented", supplementary, 0)
    assert_eq("Re-run Step3: conflict", conflict, 0)

    print()
    print("--- Step 6: Record state S2 and verify S2 == S1 ---", flush=True)
    session_s2 = load_session_json(SESSION_ID)
    s2 = get_session_state(session_s2)
    assert_state_eq("S2 == S1", s1, s2)
    print("  S2 matches S1", flush=True)

    print()
    print("--- Step 7: Check MD report statistics ---", flush=True)
    md_stats = parse_md_stats(md_content)
    assert_eq("MD: 已归并 count", md_stats.get("已归并", 0), 1)
    assert_eq("MD: 待居民代表复核 count", md_stats.get("待居民代表复核", 0), 1)
    assert_eq("MD: 已补录 count", md_stats.get("已补录", 0), 1)
    print("  MD statistics match actual data", flush=True)

    print()
    print("--- Step 8: Check replay script ends with summary command ---", flush=True)
    expected_summary_cmd = "python3 main.py summary --session " + SESSION_ID
    sh_lines = [line.strip() for line in sh_content.strip().splitlines()]
    last_non_empty_line = ""
    for line in reversed(sh_lines):
        if line.strip() and not line.strip().startswith("#") and not line.strip().startswith("echo"):
            last_non_empty_line = line.strip()
            break

    assert_eq(
        "SH: ends with summary command",
        expected_summary_cmd in last_non_empty_line,
        True,
    )
    print("  Replay script calls summary with session parameter correctly", flush=True)

    print()
    print("--- Step 9: Execute replay script and verify output ---", flush=True)
    shutil.rmtree(sessions_dir)
    shutil.rmtree(output_dir)
    os.makedirs(sessions_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    print("  Cleaned again for replay test", flush=True)

    script_out = run("bash " + latest_sh)

    summary_out = run("python3 main.py summary --session " + SESSION_ID)

    script_counts = parse_summary_counts(summary_out)
    assert_eq("Script output: 已归并 count", script_counts.get("已归并", 0), 1)
    assert_eq("Script output: 待居民代表复核 count", script_counts.get("待居民代表复核", 0), 1)
    assert_eq("Script output: 已补录 count", script_counts.get("已补录", 0), 1)
    assert_eq("Script output: 点位总数", script_counts.get("点位总数", 0), 2)
    print("  Script output matches summary command", flush=True)

    print()
    print("--- Step 10: Cross-check 5 data sources ---", flush=True)

    session_final = load_session_json(SESSION_ID)
    final_state = get_session_state(session_final)

    md_points = parse_md_points(md_content)
    md_records = parse_md_records(md_content)

    expected_record_statuses_from_md = {k: v for k, v in sorted(md_records.items())}
    expected_point_ids_from_md = md_points

    summary_counts = parse_summary_counts(summary_out)

    assert_eq("Cross-check: record count", final_state["record_count"], 3)
    assert_eq("Cross-check: point count", final_state["point_count"], 2)
    assert_eq("Cross-check: point IDs (session vs MD)", final_state["point_ids"], expected_point_ids_from_md)
    assert_eq("Cross-check: record IDs (session vs MD)", final_state["record_ids"], sorted(expected_record_statuses_from_md.keys()))

    for rid in final_state["record_ids"]:
        assert_eq(
            f"Cross-check: {rid} status (session vs MD)",
            final_state["record_statuses"][rid],
            expected_record_statuses_from_md.get(rid, ""),
        )
        assert_eq(
            f"Cross-check: {rid} status is valid",
            final_state["record_statuses"][rid] in ["已归并", "待居民代表复核", "已补录"],
            True,
        )

    assert_eq("Cross-check: 已归并 count (MD vs summary)", md_stats.get("已归并", 0), summary_counts.get("已归并", 0))
    assert_eq("Cross-check: 待居民代表复核 count (MD vs summary)", md_stats.get("待居民代表复核", 0), summary_counts.get("待居民代表复核", 0))
    assert_eq("Cross-check: 已补录 count (MD vs summary)", md_stats.get("已补录", 0), summary_counts.get("已补录", 0))

    print()
    print("TEST E2E IDEMPOTENCY PASSED")
    print("  记录数: 3（前后一致）")
    print("  点位: 2（前后一致）")
    print("  统计: 已归并 1 / 待复核 1 / 已补录 1（与实际数据一致）")
    print("  重跑脚本: 调用 summary 命令（无固定值）")

    sys.exit(0)


if __name__ == "__main__":
    main()
'''

with open('test_e2e_idempotency.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("File written successfully!")
print(f"Size: {len(content)} bytes")
