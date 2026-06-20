import os

content = r'''#!/usr/bin/env python3
"""
城中村门牌归并 - 端到端幂等性测试脚本

验证场景：
1. 首次运行：3 条记录、2 个点位
2. 直接重跑：仍是 3 条记录、2 个点位（幂等性）
3. 交叉核对：会话 JSON / summary 命令 / Markdown 报告 三者一致
4. 重跑脚本可执行，且最终统计来自实际会话数据
"""
import subprocess
import json
import os
import sys
import glob
import re
import shutil

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
    m = re.search(r"新增\s*(\d+)\s*条.*跳过重复\s*(\d+)\s*条", output)
    if not m:
        print("  ERROR: parse Step1 failed", flush=True)
        sys.exit(1)
    return int(m.group(1)), int(m.group(2))


def extract_step2_stats(output):
    m = re.search(r"更新\s*(\d+)\s*条.*跳过\s*(\d+)\s*条", output)
    if not m:
        print("  ERROR: parse Step2 failed", flush=True)
        sys.exit(1)
    return int(m.group(1)), int(m.group(2))


def extract_step3_stats(output):
    m = re.search(
        r"正常归并\s*(\d+)\s*条.*临时改道待复核\s*(\d+)\s*条.*旧口径补录\s*(\d+)\s*条.*冲突待确认\s*(\d+)\s*条",
        output,
    )
    if not m:
        print("  ERROR: parse Step3 failed", flush=True)
        sys.exit(1)
    return int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))


def parse_summary_counts(summary_output):
    counts = {}
    for line in summary_output.splitlines():
        m = re.search(r"(已归并|待居民代表复核|已补录|冲突待确认|已驳回|已导入|待审核路口照片)\s*[:：]\s*(\d+)\s*条", line)
        if m:
            counts[m.group(1)] = int(m.group(2))
    points_count = len(re.findall(r"•\s*P-\d+", summary_output))
    counts["点位总数"] = points_count
    return counts


def parse_md_stats(md_content):
    counts = {}
    for line in md_content.splitlines():
        m = re.search(r"\*\*(已归并|待居民代表复核|已补录|冲突待确认|已驳回|已导入|待审核路口照片)\*\*\s*[:：]\s*(\d+)\s*条", line)
        if m:
            counts[m.group(1)] = int(m.group(2))
    points_count = len(re.findall(r"^\|\s*P-\d+", md_content, re.MULTILINE))
    counts["点位总数"] = points_count
    return counts


def parse_session_stats(session):
    counts = {}
    for r in session["records"]:
        status = r.get("status", "")
        counts[status] = counts.get(status, 0) + 1
    counts["点位总数"] = len(session["points"])
    return counts


def get_record_status_map(session):
    status_map = {}
    for r in session["records"]:
        status_map[r["record_id"]] = r.get("status", "")
    return status_map


def main():
    print("=" * 70, flush=True)
    print("  城中村门牌归并 - 端到端幂等性测试", flush=True)
    print("=" * 70, flush=True)

    sessions_dir = os.path.join(WORK_DIR, "sessions")
    output_dir = os.path.join(WORK_DIR, "output")

    print()
    print("--- Scene 0: 清理环境并初始化会话 ---", flush=True)
    if os.path.exists(sessions_dir):
        shutil.rmtree(sessions_dir)
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(sessions_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    print("  已清理 sessions/ 和 output/", flush=True)

    run('python3 main.py init --session ' + SESSION_ID + ' --name "归并重放测试"')
    session = load_session_json(SESSION_ID)
    assert_eq("init: records 为空", len(session["records"]), 0)
    assert_eq("init: points 为空", len(session["points"]), 0)

    print()
    print("--- Scene 1: Step1 导入居民投诉（首次） ---", flush=True)
    out = run("python3 main.py import --session " + SESSION_ID + " --data all")
    new_imported, skipped = extract_step1_stats(out)
    assert_eq("Step1 首次: 新增数", new_imported, 3)
    assert_eq("Step1 首次: 跳过重数", skipped, 0)

    session = load_session_json(SESSION_ID)
    assert_eq("Step1 后: 记录数", len(session["records"]), 3)

    print()
    print("--- Scene 2: Step2 审核路口照片（首次） ---", flush=True)
    out = run("python3 main.py review-photos --session " + SESSION_ID + " --data all --reviewer 周姐")
    updated, skipped = extract_step2_stats(out)
    assert_eq("Step2 首次: 更新数", updated, 3)
    assert_eq("Step2 首次: 跳过重数", skipped, 0)

    session = load_session_json(SESSION_ID)
    for r in session["records"]:
        assert_eq("Step2 后: " + r["record_id"] + " 有关联照片", r["intersection_photo_id"] is not None, True)

    print()
    print("--- Scene 3: Step3 更新点位清单（首次） ---", flush=True)
    out = run("python3 main.py update-points --session " + SESSION_ID)
    normal, detour, supplementary, conflict = extract_step3_stats(out)
    assert_eq("Step3 首次: 正常归并", normal, 1)
    assert_eq("Step3 首次: 施工改道待复核", detour, 1)
    assert_eq("Step3 首次: 旧口径补录", supplementary, 1)
    assert_eq("Step3 首次: 冲突待确认", conflict, 0)

    session = load_session_json(SESSION_ID)
    assert_eq("Step3 后: 记录数", len(session["records"]), 3)
    assert_eq("Step3 后: 点位数", len(session["points"]), 2)

    point_ids = sorted([p["point_id"] for p in session["points"]])
    assert_eq("Step3 后: 点位 ID 列表", point_ids, ["P-001", "P-002"])

    print()
    print("--- Scene 4: 生成报告和重跑脚本 ---", flush=True)
    run("python3 main.py generate-report --session " + SESSION_ID)

    md_files = glob.glob(os.path.join(output_dir, "复盘记录_*.md"))
    sh_files = glob.glob(os.path.join(output_dir, "重跑命令_*.sh"))
    assert_eq("生成后: .md 存在", len(md_files) >= 1, True)
    assert_eq("生成后: .sh 存在", len(sh_files) >= 1, True)

    latest_md = max(md_files, key=os.path.getmtime)
    latest_sh = max(sh_files, key=os.path.getmtime)
    print("  复盘记录: " + latest_md, flush=True)
    print("  重跑命令: " + latest_sh, flush=True)

    print()
    print("--- Scene 5: 交叉核对（JSON / summary / markdown） ---", flush=True)

    session = load_session_json(SESSION_ID)
    json_stats = parse_session_stats(session)

    summary_out = run("python3 main.py summary --session " + SESSION_ID)
    summary_stats = parse_summary_counts(summary_out)

    with open(latest_md, "r", encoding="utf-8") as f:
        md_content = f.read()
    md_stats = parse_md_stats(md_content)

    assert_eq("JSON: 已归并", json_stats.get("已归并", 0), 1)
    assert_eq("JSON: 已补录", json_stats.get("已补录", 0), 1)
    assert_eq("JSON: 待居民代表复核", json_stats.get("待居民代表复核", 0), 1)
    assert_eq("JSON: 点位总数", json_stats.get("点位总数", 0), 2)

    assert_eq("Summary 与 JSON 一致: 已归并", summary_stats.get("已归并", 0), json_stats.get("已归并", 0))
    assert_eq("Summary 与 JSON 一致: 已补录", summary_stats.get("已补录", 0), json_stats.get("已补录", 0))
    assert_eq("Summary 与 JSON 一致: 待居民代表复核", summary_stats.get("待居民代表复核", 0), json_stats.get("待居民代表复核", 0))
    assert_eq("Summary 与 JSON 一致: 点位总数", summary_stats.get("点位总数", 0), json_stats.get("点位总数", 0))

    assert_eq("Markdown 与 JSON 一致: 已归并", md_stats.get("已归并", 0), json_stats.get("已归并", 0))
    assert_eq("Markdown 与 JSON 一致: 已补录", md_stats.get("已补录", 0), json_stats.get("已补录", 0))
    assert_eq("Markdown 与 JSON 一致: 待居民代表复核", md_stats.get("待居民代表复核", 0), json_stats.get("待居民代表复核", 0))

    print()
    print("--- Scene 6: 已有会话上直接重跑三步（幂等性核心验证） ---", flush=True)

    before_records = len(session["records"])
    before_points = len(session["points"])
    before_point_ids = sorted(p["point_id"] for p in session["points"])
    before_status_map = get_record_status_map(session)

    out1 = run("python3 main.py import --session " + SESSION_ID + " --data all")
    new1, skip1 = extract_step1_stats(out1)
    assert_eq("重跑 Step1: 新增数", new1, 0)
    assert_eq("重跑 Step1: 跳过重数", skip1, 3)

    out2 = run("python3 main.py review-photos --session " + SESSION_ID + " --data all --reviewer 周姐")
    upd2, skip2 = extract_step2_stats(out2)
    assert_eq("重跑 Step2: 更新数", upd2, 0)
    assert_eq("重跑 Step2: 跳过重数", skip2, 3)

    out3 = run("python3 main.py update-points --session " + SESSION_ID)
    n3, d3, s3, c3 = extract_step3_stats(out3)
    assert_eq("重跑 Step3: 正常归并", n3, 0)
    assert_eq("重跑 Step3: 施工改道待复核", d3, 0)
    assert_eq("重跑 Step3: 旧口径补录", s3, 0)
    assert_eq("重跑 Step3: 冲突待确认", c3, 0)

    session_after = load_session_json(SESSION_ID)
    after_records = len(session_after["records"])
    after_points = len(session_after["points"])
    after_point_ids = sorted(p["point_id"] for p in session_after["points"])
    after_status_map = get_record_status_map(session_after)

    assert_eq("重跑后: 记录数不变", after_records, before_records)
    assert_eq("重跑后: 记录数仍为 3", after_records, 3)
    assert_eq("重跑后: 点位数不变", after_points, before_points)
    assert_eq("重跑后: 点位数仍为 2", after_points, 2)
    assert_eq("重跑后: 点位 ID 不变", after_point_ids, before_point_ids)
    assert_eq("重跑后: 点位 ID 仍是 P-001,P-002", after_point_ids, ["P-001", "P-002"])
    assert_eq("重跑后: 各记录状态不变", after_status_map, before_status_map)

    for rid, status in after_status_map.items():
        assert_eq("重跑后: " + rid + " 不是'已导入'", status != "已导入", True)
        assert_eq("重跑后: " + rid + " 不是'待审核路口照片'", status != "待审核路口照片", True)

    print()
    print("--- Scene 7: 执行重跑脚本并验证结果 ---", flush=True)

    script_out = run("bash " + latest_sh)

    assert_eq("脚本输出含'归并流程重跑完成'", "归并流程重跑完成" in script_out, True)
    assert_eq("脚本输出含'来自实际会话数据'", "来自实际会话数据" in script_out, True)

    session_final = load_session_json(SESSION_ID)
    assert_eq("脚本重跑后: 记录数仍为 3", len(session_final["records"]), 3)
    assert_eq("脚本重跑后: 点位数仍为 2", len(session_final["points"]), 2)

    final_point_ids = sorted(p["point_id"] for p in session_final["points"])
    assert_eq("脚本重跑后: 点位 ID 仍是 P-001,P-002", final_point_ids, ["P-001", "P-002"])

    final_status = {r["record_id"]: r["status"] for r in session_final["records"]}
    assert_eq("脚本重跑后: R-001 已归并", final_status.get("R-001"), "已归并")
    assert_eq("脚本重跑后: R-002 待居民代表复核", final_status.get("R-002"), "待居民代表复核")
    assert_eq("脚本重跑后: R-003 已补录", final_status.get("R-003"), "已补录")

    print()
    print("=" * 70, flush=True)
    print("  ALL TESTS PASSED! 全部测试通过", flush=True)
    print("=" * 70, flush=True)


if __name__ == "__main__":
    main()
'''

target_path = "/Users/lzy/pro/solo/workspaces/zy72499/test_e2e_idempotency.py"
with open(target_path, "w", encoding="utf-8") as f:
    f.write(content)

print("File written successfully to", target_path)
print("Line count:", content.count("\n") + 1)
