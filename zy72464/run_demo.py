#!/usr/bin/env python3
"""
公园夜跑路线安全 - 使用者路线实际复现

复现路线：
1. 启动项目
2. 夜间采样点第一次导入
3. 处理重复导入（看哪些复用、哪些真新增）
4. 反查望京公园正门、东湖街道健身区的改前改后和状态
5. 核对所有点位处理状态
"""
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
    reject_boundary_point, rollback_point
)
from park_night_run.exporter import export_to_geojson, export_to_csv, generate_summary_report


def divider(title=""):
    print("\n" + "=" * 70)
    if title:
        print("  %s" % title)
        print("=" * 70)


def main():
    divider("公园夜跑路线安全 - 使用者路线实际复现")

    if os.path.exists("data/park_night_run.db"):
        os.remove("data/park_night_run.db")
    init_db()
    print("[启动] 数据库初始化完成\n")

    divider("第1步: 夜间采样点第一次导入")
    csv_path = "data/sampling_points_demo.csv"
    result = import_sampling_points(csv_path, operator="阿宁")
    print("导入结果: %s" % result["message"])
    print("批次ID: %s" % result["batch_id"])
    print("真新增: %d条, 复用更新: %d条" % (result["inserted"], result["updated"]))
    print("新增点位: %s" % result.get("new_codes", []))

    print("\n逐个点位核对街道归属和处理状态:")
    all_points = get_all_points()
    for p in all_points:
        boundary_tag = " [边界点-待复核]" if p["is_boundary"] == 1 else ""
        second_info = " (争议: %s)" % p["second_street_name"] if p["second_street_name"] else ""
        print("  ID:%d 行号:%d [%s] 街道=%s%s 状态=%s%s" % (
            p["id"], p["original_row_number"], p["remark"],
            p["street_name"], second_info,
            p["boundary_review_status"], boundary_tag))

    summary = generate_summary_report()
    print("\n街道分布:")
    for s in summary["by_street"]:
        print("  %s: %d个" % (s["street_name"], s["cnt"]))
    print("边界统计:")
    for bs in summary["boundary_stats"]:
        tag = "边界" if bs["is_boundary"] else "非边界"
        print("  %s/%s: %d个" % (tag, bs["boundary_review_status"], bs["cnt"]))

    divider("第2步: 重复导入同一批数据")
    result2 = import_sampling_points(csv_path, operator="阿宁")
    print("第二次导入: %s" % result2["message"])
    print("是否跳过: %s" % result2["skipped"])
    print("详细: %s" % result2.get("detail", ""))
    print("复用记录点位编号: %s" % result2.get("reused_codes", []))
    print("真新增点位编号: %s" % result2.get("new_codes", []))

    summary2 = generate_summary_report()
    print("\n总数核对: 第一次=%d, 第二次=%d (应不变)" % (summary["total_points"], summary2["total_points"]))

    divider("第2步(补充): 用修改过的CSV重复导入，看历史留痕")
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

    result3 = import_sampling_points(modified_csv, operator="阿宁")
    print("修改版CSV导入: %s" % result3["message"])
    print("详细: %s" % result3.get("detail", ""))
    print("真新增: %s" % result3.get("new_codes", []))
    print("复用记录: %s" % result3.get("reused_codes", []))

    print("\n查看望京公园正门(被修改了备注)的历史记录:")
    lookup = lookup_point_with_history("望京公园正门")
    for item in lookup:
        p = item["point"]
        print("  点位ID:%d [%s] 当前备注: %s" % (p["id"], p["remark"], p["remark"]))
        print("  当前处理状态: %s" % p["process_status"])
        for h in item["history"]:
            print("    历史 #%d: %s 修改了[%s]" % (h["id"], h["changed_by"], h["field_name"]))
            print("      改前: %s" % (h["old_value"] or "(空)"))
            print("      改后: %s" % (h["new_value"] or "(空)"))
            print("      原因: %s" % (h["change_reason"] or ""))
            print()

    divider("第3步: 阿宁补看居民投诉编号")
    complaint_map = {}
    for p in get_all_points():
        complaint_map[p["id"]] = "TS-2026-%03d" % p["id"]

    print("补录投诉编号...")
    for pid, codes in complaint_map.items():
        result = update_complaint_codes(pid, codes, operator="阿宁")
        if result["success"]:
            print("  点位%d: %s -> %s" % (pid, result["old"] or "(空)", result["new"]))

    divider("第4步: 反查望京公园正门、东湖街道健身区")
    for keyword in ["望京公园正门", "东湖街道健身区"]:
        print("\n反查关键词: %s" % keyword)
        lookup = lookup_point_with_history(keyword)
        if not lookup:
            print("  未找到")
            continue
        for item in lookup:
            p = item["point"]
            print("  点位ID:%d 行号:%d" % (p["id"], p["original_row_number"]))
            print("  街道: %s" % p["street_name"])
            print("  当前备注: %s" % p["remark"])
            print("  当前处理状态: %s" % p["process_status"])
            print("  边界复核状态: %s" % p["boundary_review_status"])
            if item["history"]:
                print("  改动历史:")
                for h in item["history"]:
                    print("    #%d [%s] %s: '%s' -> '%s'" % (
                        h["id"], h["changed_by"], h["field_name"],
                        h["old_value"] or "(空)", h["new_value"] or "(空)"))
                    print("      原话/原因: %s" % (h["change_reason"] or ""))
            else:
                print("  无改动历史")

    divider("第5步: 处理边界点位复核")
    pending = get_pending_boundary_points()
    print("待复核边界点位: %d个" % len(pending))
    for p in pending:
        print("  ID:%d [%s] %s <-> %s" % (
            p["id"], p["point_code"], p["street_name"], p["second_street_name"]))

    if pending:
        first = pending[0]
        result = confirm_boundary_point(first["id"], first["street_name"], operator="阿宁")
        print("\n确认点位%d归属%s: %s" % (first["id"], first["street_name"], result["message"]))

    divider("第6步: 地图导出")
    geojson_path = "data/night_running_points.geojson"
    export_result = export_to_geojson(geojson_path, include_pending_boundary=True, operator="阿宁")
    print("导出总数: %d" % export_result["total_exported"])
    print("边界点位: %d" % export_result["boundary_points"])
    print("待复核: %d" % export_result["pending_review"])

    with open(geojson_path, 'r', encoding='utf-8') as f:
        geojson = json.load(f)
    empty_streets = [f for f in geojson["features"] if not f["properties"]["street_name"]]
    print("空街道点位: %d (应为0)" % len(empty_streets))

    confirmed_count = sum(1 for f in geojson["features"]
                         if f["properties"]["boundary_status"] == "confirmed" and not f["properties"]["is_boundary"])
    print("非边界点confirmed: %d (应为6)" % confirmed_count)

    divider("最终核对: 所有8个采样点状态")
    all_points = get_all_points()
    print("%-4s %-6s %-16s %-10s %-12s %-10s %-8s" % (
        "ID", "行号", "备注", "街道", "边界状态", "处理状态", "边界点"))
    print("-" * 70)
    for p in all_points:
        print("%-4s %-6s %-16s %-10s %-12s %-10s %-8s" % (
            p["id"], p["original_row_number"], p["remark"][:14],
            p["street_name"] or "(空)",
            p["boundary_review_status"],
            p["process_status"],
            "是" if p["is_boundary"] else "否"))

    print("\n核对结论:")
    no_empty = all(p["street_name"] is not None and p["street_name"] != "" for p in all_points)
    non_boundary_confirmed = all(
        p["boundary_review_status"] == "confirmed"
        for p in all_points if p["is_boundary"] == 0
    )
    print("  无空街道: %s" % ("通过" if no_empty else "失败"))
    print("  非边界点全部confirmed: %s" % ("通过" if non_boundary_confirmed else "失败"))

    if os.path.exists(modified_csv):
        os.remove(modified_csv)


if __name__ == "__main__":
    main()
