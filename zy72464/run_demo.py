#!/usr/bin/env python3
"""
公园夜跑路线安全 - 使用者路线实际复现

复现路线：
1. 启动项目
2. 夜间采样点第一次导入
3. 处理重复导入（看哪些复用、哪些真新增）
4. 负责人补看或补录投诉编号
5. 反查望京公园正门、东湖街道健身区
6. 补录街道（边界复核）
7. 保存、刷新重算
8. 统一导出 GeoJSON + CSV
9. 核对 CSV 不再保留旧空值
"""
import csv as csv_mod
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from park_night_run.database import init_db, get_point_history
from park_night_run.importer import (
    import_sampling_points, update_complaint_codes,
    get_all_points, get_point_by_id, lookup_point_with_history
)
from park_night_run.boundary_rules import (
    get_pending_boundary_points, confirm_boundary_point,
    reject_boundary_point
)
from park_night_run.exporter import export_all, generate_summary_report


def divider(title=""):
    print("\n" + "=" * 70)
    if title:
        print("  %s" % title)
        print("=" * 70)


def check(condition, label):
    tag = "PASS" if condition else "FAIL"
    print("[%s] %s" % (tag, label))
    if not condition:
        global _any_fail
        _any_fail = True


_any_fail = False


def main():
    global _any_fail
    divider("公园夜跑路线安全 - 使用者路线实际复现")

    if os.path.exists("data/park_night_run.db"):
        os.remove("data/park_night_run.db")
    init_db()
    print("[启动] 数据库初始化完成")

    # ===== 第1步：夜间采样点第一次导入 =====
    divider("第1步：夜间采样点第一次导入")
    csv_path = "data/sampling_points_demo.csv"
    r1 = import_sampling_points(csv_path, operator="阿宁")
    print("导入结果: %s" % r1["message"])
    print("批次ID: %d" % r1["batch_id"])
    print("真新增: %d, 复用更新: %d" % (r1["inserted"], r1["updated"]))
    print("新增点位: %s" % r1.get("new_codes", []))

    all_pts = get_all_points()
    print("\n逐点位核对（数据库直出）：")
    for p in all_pts:
        tag = " [边界-待复核]" if p["is_boundary"] == 1 else ""
        s2 = " (争议: %s)" % p["second_street_name"] if p["second_street_name"] else ""
        print("  ID:%d 行号:%d [%s] 街道=%s%s 状态=%s%s" % (
            p["id"], p["original_row_number"], p["remark"],
            p["street_name"] or "(空)", s2,
            p["boundary_review_status"], tag))

    check(r1["inserted"] == 8, "第一次导入新增8条")
    empty_db = [p for p in all_pts if not p["street_name"]]
    check(len(empty_db) == 0, "数据库无空街道（共%d条空）" % len(empty_db))
    non_boundary = [p for p in all_pts if p["is_boundary"] == 0]
    check(all(p["boundary_review_status"] == "confirmed" for p in non_boundary),
          "非边界点全部confirmed")

    wjgk = [p for p in all_pts if "望京公园正门" in (p["remark"] or "")]
    dhjs = [p for p in all_pts if "东湖街道健身区" in (p["remark"] or "")]
    check(len(wjgk) == 1 and wjgk[0]["street_name"] == "望京街道",
          "望京公园正门 街道=望京街道（实际=%s）" % (wjgk[0]["street_name"] if wjgk else "未找到"))
    check(len(dhjs) == 1 and dhjs[0]["street_name"] == "东湖街道",
          "东湖街道健身区 街道=东湖街道（实际=%s）" % (dhjs[0]["street_name"] if dhjs else "未找到"))

    summary1 = generate_summary_report()
    print("\n报告-街道分布:")
    for s in summary1["by_street"]:
        print("  %s: %d" % (s["street_name"], s["cnt"]))
    print("报告-空街道数: %d" % summary1["empty_street_count"])
    check(summary1["empty_street_count"] == 0, "报告：空街道=0")

    # ===== 第2步：重复导入同一批数据 =====
    divider("第2步：重复导入同一批数据")
    r2 = import_sampling_points(csv_path, operator="阿宁")
    print("第二次导入: %s" % r2["message"])
    print("是否跳过: %s" % r2["skipped"])
    print("详细: %s" % r2.get("detail", ""))
    print("复用记录: %s" % r2.get("reused_codes", []))
    print("真新增: %s" % r2.get("new_codes", []))

    check(r2["skipped"] is True, "同批重复导入被跳过")
    check(len(r2.get("reused_codes", [])) == 8, "8条全部复用")
    check(len(r2.get("new_codes", [])) == 0, "0条真新增")
    check(len(get_all_points()) == 8, "总数仍为8，未翻倍")

    # ===== 第2步补充：修改版CSV重复导入，验证历史留痕 =====
    divider("第2步补充：修改版CSV重复导入，验证历史留痕")
    modified_csv = "data/sampling_points_modified.csv"
    with open(modified_csv, 'w', encoding='utf-8-sig') as f:
        f.write("longitude,latitude,lighting,safety_level,remark,投诉编号\n")
        f.write("116.4700,39.9900,良好,high,望京公园正门(已安装路灯),\n")
        f.write("116.4785,39.9925,昏暗,medium,望京东湖交界路口,\n")
        f.write("116.4850,39.9950,良好,low,东湖街道健身区,\n")
        f.write("116.4650,39.9850,昏暗,medium,花家地北门口,\n")
        f.write("116.4600,39.9800,无灯,high,花家地地下通道入口,\n")
        f.write("116.4750,39.9875,良好,low,望京花家地边界拐角处,\n")
        f.write("116.4200,40.0000,良好,medium,大屯街道北园,\n")
        f.write("116.4450,39.9950,昏暗,high,大屯望京交界桥底,\n")

    r3 = import_sampling_points(modified_csv, operator="阿宁")
    print("修改版CSV导入: %s" % r3["message"])
    print("详细: %s" % r3.get("detail", ""))
    print("复用记录: %s" % r3.get("reused_codes", []))
    print("真新增: %s" % r3.get("new_codes", []))

    check(r3["skipped"] is False, "不同批次不跳过")
    check(len(r3.get("reused_codes", [])) == 8, "8条全部复用(同point_code)")
    check(len(r3.get("new_codes", [])) == 0, "0条真新增")

    lookup_wjgk = lookup_point_with_history("望京公园正门")
    if lookup_wjgk:
        p = lookup_wjgk[0]["point"]
        hist = lookup_wjgk[0]["history"]
        remark_hist = [h for h in hist if h["field_name"] == "remark"]
        print("\n望京公园正门 备注: %s" % p["remark"])
        print("备注历史条数: %d" % len(remark_hist))
        if remark_hist:
            h = remark_hist[0]
            print("  改前: %s" % (h["old_value"] or "(空)"))
            print("  改后: %s" % (h["new_value"] or "(空)"))
            print("  原话/原因: %s" % (h["change_reason"] or ""))
            check("原话" in (h["change_reason"] or ""), "历史记录保留原话")
        check(p["street_name"] == "望京街道", "修改版导入后街道仍=望京街道")

    # ===== 第3步：负责人补看或补录投诉编号 =====
    divider("第3步：阿宁补看/补录居民投诉编号")
    for p in get_all_points():
        result = update_complaint_codes(p["id"], "TS-2026-%03d" % p["id"], operator="阿宁")
        if result["success"]:
            print("  点位%d [%s]: %s -> %s" % (p["id"], p["remark"][:8],
                  result["old"] or "(空)", result["new"]))

    wjgk2 = get_point_by_id(wjgk[0]["id"]) if wjgk else None
    if wjgk2:
        check(wjgk2["process_status"] in ("complaint_added", "boundary_review"),
              "望京公园正门 补录后状态=%s" % wjgk2["process_status"])

    # ===== 第4步：反查望京公园正门、东湖街道健身区 =====
    divider("第4步：反查望京公园正门、东湖街道健身区")
    for kw in ["望京公园正门", "东湖街道健身区"]:
        print("\n反查: %s" % kw)
        items = lookup_point_with_history(kw)
        if not items:
            print("  未找到")
            continue
        p = items[0]["point"]
        print("  点位ID:%d 行号:%d" % (p["id"], p["original_row_number"]))
        print("  街道: %s" % p["street_name"])
        print("  当前备注: %s" % p["remark"])
        print("  处理状态: %s" % p["process_status"])
        print("  边界复核状态: %s" % p["boundary_review_status"])
        if items[0]["history"]:
            print("  改动历史:")
            for h in items[0]["history"]:
                print("    #%d [%s] %s: '%s' -> '%s'" % (
                    h["id"], h["changed_by"], h["field_name"],
                    h["old_value"] or "(空)", h["new_value"] or "(空)"))
                print("      原因: %s" % (h["change_reason"] or ""))

    # ===== 第5步：补录街道（边界复核）=====
    divider("第5步：补录街道（边界复核）")
    pending = get_pending_boundary_points()
    print("待复核边界点位: %d个" % len(pending))
    for p in pending:
        print("  ID:%d [%s] %s <-> %s" % (p["id"], p["point_code"],
              p["street_name"], p["second_street_name"]))

    if pending:
        first = pending[0]
        r = confirm_boundary_point(first["id"], first["street_name"], operator="阿宁")
        print("\n确认ID:%d归属%s: %s" % (first["id"], first["street_name"], r["message"]))

    if len(pending) > 1:
        second = pending[1]
        r = confirm_boundary_point(second["id"], second["street_name"], operator="阿宁")
        print("确认ID:%d归属%s: %s" % (second["id"], second["street_name"], r["message"]))

    # ===== 第6步：保存、刷新重算 =====
    divider("第6步：保存、刷新重算")
    summary2 = generate_summary_report()
    print("刷新后报告：")
    print("  总点位: %d" % summary2["total_points"])
    print("  空街道数: %d" % summary2["empty_street_count"])
    for s in summary2["by_street"]:
        print("  %s: %d" % (s["street_name"], s["cnt"]))
    for bs in summary2["boundary_stats"]:
        tag = "边界" if bs["is_boundary"] else "非边界"
        print("  %s/%s: %d" % (tag, bs["boundary_review_status"], bs["cnt"]))
    for ps in summary2["process_stats"]:
        print("  状态=%s: %d" % (ps["process_status"], ps["cnt"]))

    check(summary2["empty_street_count"] == 0, "刷新后报告：空街道=0")

    # ===== 第7步：统一导出 GeoJSON + CSV =====
    divider("第7步：统一导出 GeoJSON + CSV")
    geojson_path = "data/night_running_points.geojson"
    csv_out_path = "data/night_running_points_export.csv"

    exp = export_all(geojson_path, csv_out_path, include_pending_boundary=True, operator="阿宁")

    print("GeoJSON: %s" % exp["geojson_path"])
    print("CSV:     %s" % exp["csv_path"])
    print("导出总数: %d" % exp["total_exported"])
    print("GeoJSON空街道: %d" % exp["geojson_empty_streets"])
    print("CSV空街道: %d" % exp["csv_empty_streets"])

    check(exp["geojson_empty_streets"] == 0, "GeoJSON无空街道")
    check(exp["csv_empty_streets"] == 0, "CSV无空街道")

    # ===== 第8步：实际打开CSV文件逐行核对 =====
    divider("第8步：实际打开CSV文件逐行核对")
    with open(csv_out_path, 'r', encoding='utf-8-sig') as f:
        reader = csv_mod.DictReader(f)
        csv_rows = list(reader)

    print("CSV文件共%d行数据" % len(csv_rows))
    csv_empty = [r for r in csv_rows if not r.get("street_name")]
    print("CSV中street_name为空的行数: %d" % len(csv_empty))

    check(len(csv_rows) == 8, "CSV文件8行数据")
    check(len(csv_empty) == 0, "CSV中0条空街道（重点确认：CSV不再保留旧空值）")

    print("\n逐行核对CSV街道值：")
    for r in csv_rows:
        remark = r.get("remark", "")[:14]
        street = r.get("street_name", "")
        bs = r.get("boundary_review_status", "")
        ps = r.get("process_status", "")
        empty_flag = " *** 空街道 ***" if not street else ""
        print("  ID:%s [%s] street_name=%s boundary=%s process=%s%s" % (
            r.get("id", ""), remark, street or "(空)", bs, ps, empty_flag))

    # ===== 重点核对：望京公园正门、东湖街道健身区 =====
    divider("重点核对：望京公园正门、东湖街道健身区")
    for kw in ["望京公园正门", "东湖街道健身区"]:
        csv_match = [r for r in csv_rows if kw in r.get("remark", "")]
        if csv_match:
            r = csv_match[0]
            print("CSV - %s:" % kw)
            print("  street_name: %s" % r.get("street_name", ""))
            print("  process_status: %s" % r.get("process_status", ""))
            print("  boundary_review_status: %s" % r.get("boundary_review_status", ""))
            print("  complaint_codes: %s" % r.get("complaint_codes", ""))
            check(r.get("street_name", "") != "", "CSV中%s街道非空" % kw)
        else:
            check(False, "CSV中找到%s" % kw)

        with open(geojson_path, 'r', encoding='utf-8') as f:
            gj = json.load(f)
        gj_match = [f for f in gj["features"] if kw in f["properties"].get("remark", "")]
        if gj_match:
            props = gj_match[0]["properties"]
            print("GeoJSON - %s:" % kw)
            print("  street_name: %s" % props.get("street_name", ""))
            print("  process_status: %s" % props.get("process_status", ""))
            print("  boundary_status: %s" % props.get("boundary_status", ""))
            check(props.get("street_name", "") != "", "GeoJSON中%s街道非空" % kw)

        items = lookup_point_with_history(kw)
        if items:
            p = items[0]["point"]
            print("数据库 - %s:" % kw)
            print("  street_name: %s" % p["street_name"])
            print("  process_status: %s" % p["process_status"])
            check(p["street_name"] is not None and p["street_name"] != "",
                  "数据库中%s街道非空" % kw)
            if items[0]["history"]:
                print("  历史说明:")
                for h in items[0]["history"]:
                    print("    %s: '%s'->'%s' (%s)" % (
                        h["field_name"], h["old_value"] or "(空)",
                        h["new_value"] or "(空)", h["change_reason"] or ""))

    # ===== 最终汇总 =====
    divider("最终汇总")
    all_final = get_all_points()
    no_empty = all(p["street_name"] is not None and p["street_name"] != "" for p in all_final)
    non_b_confirmed = all(p["boundary_review_status"] == "confirmed"
                         for p in all_final if p["is_boundary"] == 0)

    check(no_empty, "数据库: 无空街道")
    check(non_b_confirmed, "数据库: 非边界点全部confirmed")
    check(len(csv_rows) == 8 and len(csv_empty) == 0, "CSV: 8行全有街道，0条空值")

    if os.path.exists(modified_csv):
        os.remove(modified_csv)

    divider("核对完成")
    if _any_fail:
        print("存在FAIL项，请检查上方输出")
        sys.exit(1)
    else:
        print("全部PASS")
        sys.exit(0)


if __name__ == "__main__":
    main()
