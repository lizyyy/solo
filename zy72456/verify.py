#!/usr/bin/env python3
"""
医院急诊入口疏导 - 端到端验证（两个业务断点闭合）
运行: python3 verify.py

场景链路（全部接在同一条真实样例上）:
  A. 初始化 → 导入新旧名记录 → 老马首次审核 → 巡检员采用新名 → 回滚 → 四字段同步恢复
  B. 老马首次审核（不进remark_only） → 老马二次改备注（进remark_only） → 摘要核对
  C. 导出明细 → 核对展示小区名/标准化小区名/冲突标记/处理状态/历史/原因/处理人

核对清单:
  □ 回滚后 community_name_normalized 同步恢复（不会旧名配新标准名）
  □ 首次照片审核不在 remark_only_affected 清单中
  □ 二次备注修改在 remark_only_affected 清单中
  □ 导出 detailed 含 normalized_name_history
  □ 全部触发动作/处理判断/当前状态/历史记录/摘要报告/导出明细 能互相解释
"""
import os
import sys
import json
import csv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import init_db
from core import (
    import_complaints, lao_ma_review_photo, inspector_resolve_alias,
    generate_daily_summary, get_single_source, get_audit_log,
    rollback_last_operation, build_export_package, seed_default_aliases
)

DB = "diversion.db"
PASS = 0
FAIL = 0


def step(msg):
    print("\n" + "=" * 70)
    print("▶ " + msg)
    print("=" * 70)


def check(condition, hint):
    global PASS, FAIL
    if condition:
        PASS += 1
        print("  ✅ {}".format(hint))
    else:
        FAIL += 1
        print("  ❌ {}".format(hint))


def rec_field(records, complaint_no, field):
    r = next((r for r in records if r["complaint_no"] == complaint_no), None)
    return r[field] if r else "NOT_FOUND"


def rec_obj(records, complaint_no):
    return next((r for r in records if r["complaint_no"] == complaint_no), None)


def main():
    global PASS, FAIL
    if os.path.exists(DB):
        os.remove(DB)
    if os.path.exists("exports"):
        import shutil
        shutil.rmtree("exports")
    init_db()

    # ====================================================================
    # 场景 A：导入 → 首次审核 → 巡检员采用新名 → 保存 → 回滚 → 刷新 → 四字段同步
    # ====================================================================
    step("A1. 干净库导入含新旧名的投诉记录")

    records = []
    with open("sample_complaints.csv", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader, start=1):
            records.append({
                "line_no": idx,
                "complaint_no": row["投诉编号"],
                "community_name": row["小区名称"],
                "address": row["地址"],
                "complaint_content": row["投诉内容"],
            })
    batch_id, info = import_complaints(records, "import_op")
    data = get_single_source(batch_id)

    check(info["seed_aliases_injected"] == 5, "首次注入5对别名映射")
    check(info["conflicts_marked"] == 4, "4条新旧名冲突被标记")
    r002 = rec_obj(data, "TS20260601002")
    check(r002 is not None, "TS20260601002 存在")
    check(r002["community_name"] == "阳光花园", "导入时展示名=阳光花园")
    check(r002["community_name_normalized"] == "阳光花园", "导入时标准名=阳光花园")
    check(r002["has_alias_conflict"] == 1, "阳光花园 被标记冲突")
    check(r002["status"] == "IMPORTED", "初始状态=IMPORTED")
    rid002 = r002["id"]

    step("A2. 老马首次审核 TS20260601002 → 有冲突应转 PENDING_INSPECTOR")

    ok = lao_ma_review_photo("TS20260601002", batch_id, "早高峰潮汐车道需调整，建议7-9点启用", "traffic_laoma")
    check(ok, "老马审核成功")
    data = get_single_source(batch_id)
    r002 = rec_obj(data, "TS20260601002")
    check(r002["status"] == "PENDING_INSPECTOR", "有冲突→PENDING_INSPECTOR（留给巡检员）")
    check(r002["has_alias_conflict"] == 1, "冲突标记仍为1")

    # 在巡检员复核前保存快照（回滚应回到这个状态，不是IMPORTED）
    snap_before = {
        "name": r002["community_name"],
        "normalized": r002["community_name_normalized"],
        "conflict": r002["has_alias_conflict"],
        "status": r002["status"],
    }
    print("  📸 复核前快照: name={} normalized={} conflict={} status={}".format(
        snap_before["name"], snap_before["normalized"],
        snap_before["conflict"], snap_before["status"]))

    step("A3. 巡检员复核采用新名 → 四字段联动（name + normalized + conflict + status）")

    ok = inspector_resolve_alias("TS20260601002", batch_id, use_new_name=True, operator="muni_inspector")
    check(ok, "巡检员复核成功")
    data = get_single_source(batch_id)
    r002 = rec_obj(data, "TS20260601002")
    check(r002["community_name"] == "阳光花园小区", "展示名→阳光花园小区")
    check(r002["community_name_normalized"] == "阳光花园小区", "标准名→阳光花园小区（同步更新）")
    check(r002["has_alias_conflict"] == 0, "冲突标记→0")
    check(r002["status"] == "PHOTO_REVIEWED", "状态→PHOTO_REVIEWED")

    # 审计日志有4条（不是3条）
    audits = get_audit_log(rid002)
    inspector_audits = [a for a in audits if a["changed_by"] == "muni_inspector"
                        and "回滚" not in (a["change_reason"] or "")]
    fields_in_atom = set(a["field_name"] for a in inspector_audits)
    check("community_name" in fields_in_atom, "审计含 community_name")
    check("community_name_normalized" in fields_in_atom, "审计含 community_name_normalized（修复！以前漏了）")
    check("has_alias_conflict" in fields_in_atom, "审计含 has_alias_conflict")
    check("status" in fields_in_atom, "审计含 status")
    check(len(inspector_audits) == 4, "巡检员操作原子共4条审计（以前只有3条）")

    step("A4. rollback-op 整体回滚 → 四字段同步恢复（不会旧名配新标准名）")

    result = rollback_last_operation(rid002, "admin")
    check(result["success"], "回滚成功")
    check("community_name" in result["fields_rolled_back"], "回滚含 community_name")
    check("community_name_normalized" in result["fields_rolled_back"],
          "回滚含 community_name_normalized（修复！以前回滚漏了这个）")
    check("has_alias_conflict" in result["fields_rolled_back"], "回滚含 has_alias_conflict")
    check("status" in result["fields_rolled_back"], "回滚含 status")

    data = get_single_source(batch_id)
    r002 = rec_obj(data, "TS20260601002")
    check(r002["community_name"] == snap_before["name"],
          "展示名恢复={} (期望{})".format(r002["community_name"], snap_before["name"]))
    check(r002["community_name_normalized"] == snap_before["normalized"],
          "标准名恢复={} (期望{})  ← 关键修复：不会旧名配新标准名".format(
              r002["community_name_normalized"], snap_before["normalized"]))
    check(r002["has_alias_conflict"] == snap_before["conflict"],
          "冲突标记恢复={}".format(r002["has_alias_conflict"]))
    check(r002["status"] == snap_before["status"],
          "状态恢复={}".format(r002["status"]))

    # 回滚后审计日志也有 normalized 的回滚条
    roll_audits = [a for a in get_audit_log(rid002) if "回滚" in (a["change_reason"] or "")]
    roll_fields = [a["field_name"] for a in roll_audits]
    check("community_name_normalized" in roll_fields,
          "回滚审计含 community_name_normalized（修复！以前没有）")

    # ====================================================================
    # 场景 B：首次照片审核 vs 二次备注修改 → remark_only 清单
    # ====================================================================
    step("B1. 老马首次审核 TS20260601001（阳光花园小区，有冲突）和 TS20260601005（幸福里，无冲突）")

    ok1 = lao_ma_review_photo("TS20260601001", batch_id, "入口右侧3辆违停，已劝离", "traffic_laoma")
    ok2 = lao_ma_review_photo("TS20260601005", batch_id, "救护车通道有社会车辆，已贴单", "traffic_laoma")
    check(ok1 and ok2, "两条首次审核成功")

    # TS20260601001 的首次审核: status IMPORTED→PENDING_INSPECTOR（old_status==IMPORTED）
    audits_001 = get_audit_log(rec_obj(get_single_source(batch_id), "TS20260601001")["id"])
    first_review_status = [a for a in audits_001
                           if a["field_name"] == "status" and a["old_value"] == "IMPORTED"]
    check(len(first_review_status) > 0,
          "TS20260601001 首次审核的 status 旧值=IMPORTED → 这是首次审核不是二次改备注")

    step("B2. 生成摘要 → 首次审核不应进入 remark_only 清单")

    summary = generate_daily_summary("summary_bot")
    remark_only_nos = [i["complaint_no"] for i in summary["remark_only_list"]]
    print("  remark_only_list:", remark_only_nos)
    print("  remark_only_affected:", summary["remark_only_affected"])

    check("TS20260601001" not in remark_only_nos,
          "TS20260601001 首次审核 不在remark_only中（修复！以前误收）")
    check("TS20260601005" not in remark_only_nos,
          "TS20260601005 首次审核 不在remark_only中（修复！以前误收）")

    step("B3. 老马二次修改 TS20260601005 的照片备注 → 应进入 remark_only 清单")

    ok = lao_ma_review_photo("TS20260601005", batch_id,
                             "补充：下午4点又有2辆违停，已拖移", "traffic_laoma")
    check(ok, "二次修改备注成功")
    data = get_single_source(batch_id)
    r005 = rec_obj(data, "TS20260601005")
    check(r005["photo_remark"] == "补充：下午4点又有2辆违停，已拖移", "备注已更新")
    check(r005["status"] == "PHOTO_REVIEWED", "状态仍为PHOTO_REVIEWED（不是IMPORTED→）")

    # 二次修改的审计: status 不是从 IMPORTED 开始
    audits_005 = get_audit_log(r005["id"])
    second_remark_audits = [a for a in audits_005 if a["field_name"] == "photo_remark"
                           and "补充" in (a["new_value"] or "")]
    check(len(second_remark_audits) > 0, "二次备注修改有审计记录")

    step("B4. 重新生成摘要 → TS20260601005 应在 remark_only，TS20260601001 仍不在")

    summary2 = generate_daily_summary("summary_bot")
    remark_only_nos2 = [i["complaint_no"] for i in summary2["remark_only_list"]]
    print("  remark_only_list:", remark_only_nos2)
    print("  remark_only_affected:", summary2["remark_only_affected"])

    check("TS20260601005" in remark_only_nos2,
          "TS20260601005 二次改备注 → 在remark_only中 ✅")
    check("TS20260601001" not in remark_only_nos2,
          "TS20260601001 首次审核 → 不在remark_only中（修复！以前误收） ✅")

    # ====================================================================
    # 场景 C：导出明细核对
    # ====================================================================
    step("C1. 导出明细 → 展示小区名/标准化小区名/冲突标记/处理状态/历史/原因/处理人")

    pkg = build_export_package(batch_id)
    os.makedirs("exports", exist_ok=True)

    p1 = "exports/verify_1detailed.csv"
    p2 = "exports/verify_2audit.csv"
    p3 = "exports/verify_3conflict_index.csv"
    p4 = "exports/verify_4pending_index.csv"
    for path, key in [(p1, "detailed_rows"), (p2, "audit_rows"),
                      (p3, "conflict_index"), (p4, "pending_index")]:
        rows = pkg[key]
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            if rows:
                w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
                w.writeheader()
                for r in rows:
                    w.writerow(r)
            else:
                f.write("（无数据）\n")

    # 核对 TS20260601002 的导出明细
    d002 = next((r for r in pkg["detailed_rows"] if r["complaint_no"] == "TS20260601002"), None)
    check(d002 is not None, "导出含 TS20260601002")
    check(d002["community_name_final"] == snap_before["name"],
          "导出 展示名={}（回滚后恢复）".format(d002["community_name_final"]))
    check(d002["community_name_normalized_final"] == snap_before["normalized"],
          "导出 标准名={}（回滚后同步恢复，不是旧名配新标准名）".format(
              d002["community_name_normalized_final"]))
    check(d002["has_alias_conflict_final"] == "是",
          "导出 冲突标记=是（回滚后恢复）")
    check(d002["status_final"] == snap_before["status"],
          "导出 状态={}（回滚后恢复）".format(d002["status_final"]))

    # 导出含 normalized_name_history
    norm_hist = d002.get("normalized_name_history", "")
    check("阳光花园" in norm_hist and "阳光花园小区" in norm_hist,
          "导出 normalized_name_history 含新旧标准名变更轨迹")

    # 导出含 community_name_history + 修改人 + 原因
    name_hist = d002.get("community_name_history", "")
    check("muni_inspector" in name_hist,
          "导出 community_name_history 含修改人 muni_inspector")
    check("巡检员复核" in name_hist,
          "导出 community_name_history 含原因「巡检员复核」")

    # audit.csv 含 normalized 的回滚记录
    norm_roll_audits = [a for a in pkg["audit_rows"]
                       if a["field_name"] == "community_name_normalized"
                       and "回滚" in (a["change_reason"] or "")]
    check(len(norm_roll_audits) > 0,
          "audit.csv 含 community_name_normalized 回滚记录（修复！以前没有）")

    # conflict_index 含阳光花园分组
    yg_conflicts = [c for c in pkg["conflict_index"] if "阳光花园" in c.get("conflict_pair", "")]
    check(len(yg_conflicts) >= 1, "conflict_index 含阳光花园分组")

    # ====================================================================
    # 场景 D：摘要 + 导出互相解释
    # ====================================================================
    step("D1. 摘要 pending_trace / conflict_groups / remark_only_list 与导出互相解释")

    check(len(summary2["pending_trace"]) == summary2["pending_inspector"],
          "摘要 pending_trace 条数 == pending_inspector")
    check(summary2["remark_only_affected"] == len(summary2["remark_only_list"]),
          "摘要 remark_only_affected == remark_only_list 条数")
    check(len(summary2["conflict_groups"]) > 0,
          "摘要 conflict_groups 非空")

    # 摘要的 remark_only_list 含原始行号
    for item in summary2["remark_only_list"]:
        check("original_line_no" in item and item["original_line_no"],
              "remark_only 条目 {} 含原始行号={}".format(
                  item["complaint_no"], item.get("original_line_no")))

    # 摘要 conflict_groups 能追回原始行号
    yg_group = None
    for key, items in summary2["conflict_groups"].items():
        if key.startswith("阳光花园↔"):
            yg_group = items
            break
    check(yg_group is not None and len(yg_group) >= 1,
          "摘要 conflict_groups 阳光花园↔阳光花园小区分组有记录")
    if yg_group:
        line_nos = [it["original_line_no"] for it in yg_group]
        check(2 in line_nos, "阳光花园分组含原始行号2（TS20260601002）")

    # ====================================================================
    # 最终结果
    # ====================================================================
    step("验证结果")
    print("  通过: {}  失败: {}".format(PASS, FAIL))
    if FAIL > 0:
        print("  ❌ 有断点未通过！")
        sys.exit(1)
    else:
        print("  ✅ 全部断点通过！")

    print("\n📌 可重跑命令：")
    print("   python3 verify.py   # 本验证脚本")
    print("   python3 cli.py import-data --csv sample_complaints.csv")
    print("   python3 cli.py lao-ma-review <投诉号> <批次号> <备注>")
    print("   python3 cli.py inspector-review <投诉号> <批次号> --use-new-name")
    print("   python3 cli.py rollback-op <记录ID>")
    print("   python3 cli.py summary")
    print("   python3 cli.py export")
    print("   python3 cli.py audit <记录ID>")


if __name__ == "__main__":
    main()
