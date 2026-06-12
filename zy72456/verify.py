#!/usr/bin/env python3
"""
医院急诊入口疏导 - 全量验证脚本（含断点补实、关联回滚、溯源）
运行: python3 verify.py
核对点：
 1. 干净库首次导入 → 自动注入5对常见别名 → 阳光花园/阳光花园小区冲突被标记
 2. 老马审核 → 有冲突的记录 PENDING_INSPECTOR（留给巡检员），不直接归正常
 3. 巡检员复核是一次「操作原子」：同时改 name/has_alias_conflict/status
 4. rollback-op 整体回滚：三者同步恢复，不出现 name 回了 status 没回
 5. 导出明细 4 个文件：detailed / audit / conflict_index / pending_index
 6. 从阳光花园↔阳光花园小区、留给巡检员复核，能追回原始行号和原话
 7. 老马只改照片备注 → 街道摘要里 remark_only_list 单独列出当日受影响记录
"""
import os
import sys
import json
import csv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import init_db
from core import (
    add_community_alias, import_complaints, lao_ma_review_photo,
    inspector_resolve_alias, generate_daily_summary, get_single_source,
    get_audit_log, rollback_last_operation, build_export_package,
    seed_default_aliases
)


def step(msg):
    print("\n" + "=" * 66)
    print("▶ " + msg)
    print("=" * 66)


def assert_eq(actual, expected, hint):
    if actual == expected:
        print("  ✅ {}: {} == {}".format(hint, actual, expected))
    else:
        print("  ❌ {}: 期望 {} 实际 {}".format(hint, expected, actual))
        sys.exit(1)


def assert_contains(text, keyword, hint):
    if keyword in str(text):
        print("  ✅ {}: 包含「{}」".format(hint, keyword))
    else:
        print("  ❌ {}: 未找到「{}」 实际: {}".format(hint, keyword, text))
        sys.exit(1)


def main():
    DB = "diversion.db"
    if os.path.exists(DB):
        os.remove(DB)
    init_db()

    print("🏥 医院急诊入口疏导 - 全量断点核对")
    print("   核对：干净库冲突标记 / 待巡检员复核 / 关联回滚 / 导出明细断点")

    # ---------- 核对点 1：干净库自动注入别名 + 冲突被标记 ----------
    step("【核对点1】干净库首次导入 → 自动注入别名映射，阳光花园/丽景苑 被标记冲突")

    import csv as _csv
    records = []
    with open("sample_complaints.csv", encoding="utf-8") as f:
        reader = _csv.DictReader(f)
        for idx, row in enumerate(reader, start=1):
            records.append({
                "line_no": idx,
                "complaint_no": row["投诉编号"],
                "community_name": row["小区名称"],
                "address": row["地址"],
                "complaint_content": row["投诉内容"],
            })
    batch_id, info = import_complaints(records, "import_operator")
    print("  注入默认别名映射数: {}".format(info["seed_aliases_injected"]))
    assert_eq(info["seed_aliases_injected"], 5, "首次注入别名对数")
    assert_eq(info["conflicts_marked"], 4, "标记冲突条数（阳光花园小区/阳光花园/丽景苑/丽景苑小区共4条）")
    data = get_single_source(batch_id)
    yangguang = [r for r in data if "阳光花园" in r["community_name"]]
    print("  阳光花园系列记录数: {}, 全部标记冲突: {}".format(
        len(yangguang), all(r["has_alias_conflict"] for r in yangguang)))
    assert all(r["has_alias_conflict"] for r in yangguang), "阳光花园系列应全部有冲突标记"

    # ---------- 核对点 2：老马审核 → 有冲突→PENDING_INSPECTOR ----------
    step("【核对点2】老马补看路口照片 → 有冲突的不直接归正常，留给巡检员复核")

    lao_ma_review_photo("TS20260601001", batch_id, "入口右侧3辆违停，已劝离", "traffic_laoma")
    lao_ma_review_photo("TS20260601002", batch_id, "早高峰潮汐车道需调整", "traffic_laoma")
    lao_ma_review_photo("TS20260601003", batch_id, "人行通道有摊贩", "traffic_laoma")
    lao_ma_review_photo("TS20260601005", batch_id, "救护车通道有社会车辆，已贴单", "traffic_laoma")
    data = get_single_source(batch_id)
    pending = [r for r in data if r["status"] == "PENDING_INSPECTOR"]
    print("  PENDING_INSPECTOR 记录:")
    for r in pending:
        print("     · {} | 小区:{} | 冲突:{} | 备注:{}".format(
            r["complaint_no"], r["community_name"],
            r["has_alias_conflict"], (r["photo_remark"] or "")[:18]))
    assert_eq(len(pending), 3, "有冲突的3条记录 → PENDING_INSPECTOR 留给巡检员")
    xfl = next(r for r in data if r["complaint_no"] == "TS20260601005")
    assert_eq(xfl["status"], "PHOTO_REVIEWED", "幸福里无冲突 → PHOTO_REVIEWED（正常）")

    # ---------- 核对点 3：巡检员复核是操作原子，三字段一起改 ----------
    step("【核对点3】巡检员复核 TS20260601002（阳光花园→阳光花园小区）→ 三字段联动")

    rec_before = next(r for r in data if r["complaint_no"] == "TS20260601002")
    old_name = rec_before["community_name"]
    old_conflict = rec_before["has_alias_conflict"]
    old_status = rec_before["status"]
    print("  复核前: name={} conflict={} status={}".format(old_name, old_conflict, old_status))
    inspector_resolve_alias("TS20260601002", batch_id, use_new_name=True, operator="muni_inspector")
    data = get_single_source(batch_id)
    rec_after = next(r for r in data if r["complaint_no"] == "TS20260601002")
    print("  复核后: name={} conflict={} status={}".format(
        rec_after["community_name"], rec_after["has_alias_conflict"], rec_after["status"]))
    assert_eq(rec_after["community_name"], "阳光花园小区", "小区名改为新名")
    assert_eq(rec_after["has_alias_conflict"], 0, "冲突标记清除")
    assert_eq(rec_after["status"], "PHOTO_REVIEWED", "状态推进到 PHOTO_REVIEWED")

    # ---------- 核对点 4：整体回滚 → 三字段同步恢复 ----------
    step("【核对点4】rollback-op 整体回滚 TS20260601002 → name/conflict/status 三者一起还原")

    rid = rec_after["id"]
    result = rollback_last_operation(rid, "admin")
    print("  回滚结果:", result)
    assert result["success"], "回滚成功"
    assert set(["community_name", "has_alias_conflict", "status"]).issubset(
        set(result["fields_rolled_back"])), "三字段都被回滚"
    data = get_single_source(batch_id)
    rec_rolled = next(r for r in data if r["complaint_no"] == "TS20260601002")
    print("  回滚后: name={} conflict={} status={}".format(
        rec_rolled["community_name"], rec_rolled["has_alias_conflict"], rec_rolled["status"]))
    assert_eq(rec_rolled["community_name"], old_name, "小区名还原")
    assert_eq(rec_rolled["has_alias_conflict"], old_conflict, "冲突标记还原")
    assert_eq(rec_rolled["status"], old_status, "状态还原")

    # 审计日志能看到回滚痕迹
    audits = get_audit_log(rid)
    roll_audits = [a for a in audits if "回滚" in (a["change_reason"] or "")]
    print("  审计日志中回滚条目数:", len(roll_audits))
    assert_eq(len(roll_audits), 3, "3字段各有1条回滚审计")

    # ---------- 核对点 5：导出明细断点补实 ----------
    step("【核对点5】导出明细4个文件：原话历史+审计+冲突索引+待复核索引")

    pkg = build_export_package(batch_id)
    os.makedirs("exports", exist_ok=True)
    import csv as csv2

    def wc(path):
        with open(path, encoding="utf-8-sig") as f:
            return sum(1 for _ in f)

    base = "exports/_verify_check"
    # 1 detailed
    p1 = base + "_1detailed.csv"
    with open(p1, "w", encoding="utf-8-sig", newline="") as f:
        keys = list(pkg["detailed_rows"][0].keys())
        w = csv2.DictWriter(f, fieldnames=keys)
        w.writeheader()
        for r in pkg["detailed_rows"]:
            w.writerow(r)
    # 2 audit
    p2 = base + "_2audit.csv"
    with open(p2, "w", encoding="utf-8-sig", newline="") as f:
        keys = list(pkg["audit_rows"][0].keys())
        w = csv2.DictWriter(f, fieldnames=keys)
        w.writeheader()
        for r in pkg["audit_rows"]:
            w.writerow(r)
    # 3 conflict index
    p3 = base + "_3conflict_index.csv"
    with open(p3, "w", encoding="utf-8-sig", newline="") as f:
        if pkg["conflict_index"]:
            keys = list(pkg["conflict_index"][0].keys())
            w = csv2.DictWriter(f, fieldnames=keys)
            w.writeheader()
            for r in pkg["conflict_index"]:
                w.writerow(r)
    # 4 pending index
    p4 = base + "_4pending_index.csv"
    with open(p4, "w", encoding="utf-8-sig", newline="") as f:
        if pkg["pending_index"]:
            keys = list(pkg["pending_index"][0].keys())
            w = csv2.DictWriter(f, fieldnames=keys)
            w.writeheader()
            for r in pkg["pending_index"]:
                w.writerow(r)

    print("  生成文件:")
    for p in (p1, p2, p3, p4):
        print("     · {} ({} 行)".format(p, wc(p)))

    # detailed 包含历史列，原话没被覆盖
    yg_row = next(r for r in pkg["detailed_rows"] if r["complaint_no"] == "TS20260601001")
    print("  TS20260601001 detailed:")
    print("     community_name_final:", yg_row["community_name_final"])
    print("     photo_remark_final:", yg_row["photo_remark_final"])
    print("     photo_remark_history:", yg_row["photo_remark_history"][:100] + "...")
    print("     status_history:", yg_row["status_history"][:80] + "...")
    assert_contains(yg_row["photo_remark_history"], "入口右侧3辆违停",
                    "detailed.photo_remark_history 包含老马原话")
    assert_contains(yg_row["status_history"], "PENDING_INSPECTOR",
                    "detailed.status_history 包含转巡检员的状态流转")

    # audit 有修改人、修改原因、原值→新值
    print("  audit 抽样（前3条）:")
    for a in pkg["audit_rows"][:3]:
        print("     {} | {} | {}: {}→{} | {}".format(
            a["changed_at"], a["changed_by"], a["field_name"],
            a["old_value"], a["new_value"], a["change_reason"]))
    has_laoma = any(a["changed_by"] == "traffic_laoma" for a in pkg["audit_rows"])
    has_reason = any("巡检员复核" in a["change_reason"] for a in pkg["audit_rows"])
    assert has_laoma, "audit 中有 traffic_laoma 修改人"
    assert has_reason, "audit 中有「巡检员复核」原因"
    print("  ✅ audit.csv 含修改人、原因、原值、新值")

    # ---------- 核对点 6：从冲突分组/待复核追回原始行号 ----------
    step("【核对点6】从 阳光花园↔阳光花园小区、留给巡检员复核 → 可追回原始行号")

    print("  conflict_index（冲突分组索引）:")
    for c in pkg["conflict_index"]:
        print("     [{}] {} | 原始行号: {} | 状态: {}".format(
            c["conflict_pair"], c["complaint_no"],
            c["original_line_no"], c["status"]))
    yg_conflict = [c for c in pkg["conflict_index"] if "阳光花园" in c["conflict_pair"]]
    assert len(yg_conflict) >= 2, "至少2条阳光花园冲突记录"
    line_nums = [c["original_line_no"] for c in yg_conflict]
    assert 1 in line_nums and 2 in line_nums, "阳光花园冲突能追回原始行号1和2"
    print("  ✅ 阳光花园冲突追回原始行号:", sorted(line_nums))

    print("  pending_index（留给巡检员复核）:")
    for p in pkg["pending_index"]:
        print("     {} | 行{} | 备注:{}".format(
            p["complaint_no"], p["original_line_no"], p["photo_remark"][:20]))
    pending_nos = [p["complaint_no"] for p in pkg["pending_index"]]
    assert "TS20260601001" in pending_nos, "pending_index 含 TS20260601001"
    assert "TS20260601002" in pending_nos, "pending_index 含 TS20260601002（已整体回滚，回到待复核）"

    # ---------- 核对点 7：老马只改照片备注 → 摘要单独列出 ----------
    step("【核对点7】老马只改照片备注 → 街道摘要标记受影响记录")

    # 老马再补一条备注，不改变其他
    lao_ma_review_photo("TS20260601005", batch_id, "补充：下午4点又有2辆违停，已拖移", "traffic_laoma")
    summary = generate_daily_summary("summary_bot")
    print("  今日街道摘要:")
    print("     待巡检员复核: {} 条 → {}".format(
        summary["pending_inspector"], summary["pending_list"]))
    print("     仅改照片备注受影响: {} 条".format(summary["remark_only_affected"]))
    for it in summary["remark_only_list"]:
        print("       · {} [{}] 行{}: {}".format(
            it["complaint_no"], it["community_name"],
            it["original_line_no"], it["remark"] or ""))
    # 有阳光花园的待复核记录 + 幸福里只改备注
    pending_in_summary = summary["pending_list"]
    assert "TS20260601001" in pending_in_summary, "摘要含待复核的 TS20260601001（阳光花园冲突）"
    remark_only_nos = [i["complaint_no"] for i in summary["remark_only_list"]]
    assert "TS20260601005" in remark_only_nos, "摘要的「仅改备注」清单含幸福里 TS20260601005"
    # 冲突分组溯源 summary.conflict_groups
    print("  summary.conflict_groups 溯源:")
    for key, items in summary["conflict_groups"].items():
        print("     【{}】共{}条: {}".format(
            key, len(items), [i["complaint_no"] + "(行" + str(i["original_line_no"]) + ")" for i in items]))
    assert any("阳光花园" in k for k in summary["conflict_groups"].keys()), \
        "摘要 conflict_groups 含阳光花园分组"

    # ---------- 最终 ----------
    step("✅ 所有 7 个核对点通过")
    print("\n📌 关键文件：")
    for p in (p1, p2, p3, p4):
        print("   · " + os.path.abspath(p))
    print("\n📌 日常命令（实际可重跑）：")
    print("   1. python3 cli.py seed-aliases              # 首次初始化别名")
    print("   2. python3 cli.py import-data --csv sample_complaints.csv")
    print("   3. python3 cli.py lao-ma-review TS20260601001 <批次号> \"备注\"")
    print("   4. python3 cli.py inspector-review TS20260601002 <批次号> --use-new-name")
    print("   5. python3 cli.py rollback-op <记录ID>       # 整体回滚")
    print("   6. python3 cli.py summary                    # 街道会摘要")
    print("   7. python3 cli.py export                     # 导出明细4文件")
    print("   8. python3 cli.py audit <记录ID>             # 回查证据")


if __name__ == "__main__":
    main()
