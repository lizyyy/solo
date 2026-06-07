#!/usr/bin/env python3
"""
公园夜跑路线安全 - 完整流程演示

演示内容：
1. 初始化数据库
2. 第一步：导入夜间采样点（含边界点位自动识别）
3. 查看待复核的边界点位
4. 第二步：城更项目经理阿宁补录居民投诉编号
5. 边界点位复核（确认/驳回）
6. 第三步：导出地图更新数据（GeoJSON）
7. 验证重复导入不翻倍
8. 查看单条点位的完整历史记录
9. 演示回滚操作
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from park_night_run.database import init_db, get_point_history
from park_night_run.importer import import_sampling_points, update_complaint_codes, get_all_points, get_point_by_id
from park_night_run.boundary_rules import (
    get_pending_boundary_points, confirm_boundary_point,
    reject_boundary_point, rollback_point
)
from park_night_run.exporter import export_to_geojson, export_to_csv, generate_summary_report


def print_divider(title=""):
    print("\n" + "=" * 70)
    if title:
        print(f"  {title}")
        print("=" * 70)


def main():
    print_divider("公园夜跑路线安全 - 城更项目管理系统演示")
    print("项目经理: 阿宁")
    print("项目名称: 公园夜跑路线安全")

    if os.path.exists("data/park_night_run.db"):
        os.remove("data/park_night_run.db")
        print("\n[清理] 已重置数据库用于演示")

    init_db()
    print("[初始化] 数据库初始化完成")

    print_divider("【第一步】夜间采样点第一次导入")
    csv_path = "data/sampling_points_demo.csv"
    result = import_sampling_points(csv_path, operator="阿宁")
    print(f"导入结果: {result['message']}")
    print(f"批次ID: {result['batch_id']}")

    summary = generate_summary_report()
    print(f"\n导入后总点位: {summary['total_points']}")
    print("按街道分布:")
    for s in summary["by_street"]:
        print(f"  - {s['street_name']}: {s['cnt']}个")

    print("\n边界点位统计:")
    for bs in summary["boundary_stats"]:
        status = "边界点" if bs["is_boundary"] else "非边界点"
        print(f"  - {status} / {bs['boundary_review_status']}: {bs['cnt']}个")

    print_divider("【查看】待项目经理复核的边界点位")
    pending = get_pending_boundary_points()
    print(f"发现 {len(pending)} 个边界点位待复核:")
    for p in pending:
        print(f"  点位ID:{p['id']} [{p['point_code']}] 原始行号:{p['original_row_number']}")
        print(f"    位置: ({p['longitude']}, {p['latitude']})")
        print(f"    争议街道: {p['street_name']} ↔ {p['second_street_name']}")
        print(f"    处理状态: {p['process_status']}")
        print()

    print_divider("【验证】重复导入同一批数据不翻倍")
    result2 = import_sampling_points(csv_path, operator="阿宁")
    print(f"第二次导入结果: {result2['message']}")
    print(f"跳过: {result2['skipped']}")

    summary2 = generate_summary_report()
    print(f"总点位数量不变: {summary2['total_points']} (预期: {summary['total_points']})")

    print_divider("【第二步】阿宁补看居民投诉编号")
    all_points = get_all_points()
    complaint_map = {
        1: "TS-2026-001,TS-2026-015",
        2: "TS-2026-003",
        3: "TS-2026-007,TS-2026-008,TS-2026-012",
        4: "TS-2026-005",
        5: "TS-2026-002,TS-2026-009",
        6: "TS-2026-010",
        7: "TS-2026-004",
        8: "TS-2026-006,TS-2026-011",
    }

    print("正在补录投诉编号...")
    for pid, codes in complaint_map.items():
        result = update_complaint_codes(pid, codes, operator="阿宁")
        if result["success"]:
            print(f"  点位{pid}: {result['old'] or '(空)'} → {result['new']}")

    print_divider("【细节】阿宁只改了一条备注，历史里能看出差别")
    print("场景: 阿宁修改点位5的备注，补充现场情况")
    point5 = get_point_by_id(5)
    old_remark = point5["remark"]

    from park_night_run.database import get_connection, record_history
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        UPDATE sampling_points SET remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        """, ("地下通道入口，夜间无照明，居民反映有抢劫风险，需优先安装路灯", 5))
        record_history(conn, 5, "remark", old_remark,
                       "地下通道入口，夜间无照明，居民反映有抢劫风险，需优先安装路灯",
                       "现场复核补充备注", "阿宁")

    print(f"\n点位5备注修改前: {old_remark}")
    print(f"点位5备注修改后: {get_point_by_id(5)['remark']}")

    print("\n点位5的完整历史记录:")
    history = get_point_history(5)
    for h in history:
        print(f"  [{h['changed_at']}] {h['changed_by']} 修改了[{h['field_name']}]")
        print(f"    旧值: {h['old_value'] or '(空)'}")
        print(f"    新值: {h['new_value'] or '(空)'}")
        print(f"    原因: {h['change_reason']}")
        print()

    print_divider("【边界复核】阿宁处理边界点位")
    pending = get_pending_boundary_points()
    for p in pending:
        if p["id"] == 2:
            result = confirm_boundary_point(p["id"], "望京街道", operator="阿宁")
            print(f"点位{p['id']} (望京东湖交界路口): {result['message']}")
        elif p["id"] == 6:
            result = confirm_boundary_point(p["id"], "花家地街道", operator="阿宁")
            print(f"点位{p['id']} (望京花家地边界拐角处): {result['message']}")
        elif p["id"] == 8:
            result = reject_boundary_point(p["id"], "经现场核实，该点位完全位于大屯街道范围内", operator="阿宁")
            print(f"点位{p['id']} (大屯望京交界桥底): {result['message']}")

    print_divider("【第三步】地图导出更新")
    geojson_path = "data/night_running_points.geojson"
    export_result = export_to_geojson(geojson_path, include_pending_boundary=True, operator="阿宁")
    print(f"GeoJSON导出完成: {export_result['output_path']}")
    print(f"导出总数: {export_result['total_exported']}")
    print(f"其中边界点位: {export_result['boundary_points']}")
    print(f"待复核标记: {export_result['pending_review']} (已在GeoJSON中标注needs_review=true)")

    csv_path = "data/night_running_points_export.csv"
    export_to_csv(csv_path, operator="阿宁")
    print(f"CSV导出完成: {csv_path}")

    print_divider("【回滚演示】阿宁发现改错了，回滚点位5的备注")
    history = get_point_history(5)
    remark_history = [h for h in history if h["field_name"] == "remark" and "现场复核" in (h["change_reason"] or "")]
    if remark_history:
        h = remark_history[0]
        print(f"回滚到历史ID: {h['id']}")
        result = rollback_point(5, h["id"], "阿宁备注写错了，需要修正", operator="阿宁")
        print(f"回滚结果: {result['message']}")
        print(f"回滚后点位5备注: {get_point_by_id(5)['remark']}")

    print_divider("【最终汇总报告】")
    final_summary = generate_summary_report()
    print(f"总点位: {final_summary['total_points']}")
    print("\n各街道点位:")
    for s in final_summary["by_street"]:
        print(f"  {s['street_name']}: {s['cnt']}")
    print("\n处理状态分布:")
    for ps in final_summary["process_stats"]:
        status_cn = {
            "initial": "初始导入",
            "complaint_added": "已补录投诉",
            "map_exported": "已导出地图",
            "boundary_review": "已完成边界复核"
        }.get(ps["process_status"], ps["process_status"])
        print(f"  {status_cn}: {ps['cnt']}")

    print_divider("演示完成")
    print("\n项目经理阿宁可以随时追溯的证据:")
    print("  - 每个点位的原始Excel行号 (original_row_number)")
    print("  - 每条修改的历史记录 (谁、什么时候、改了什么、为什么改)")
    print("  - 边界点位的复核过程 (待复核→确认/驳回)")
    print("  - 导入批次去重记录 (不会数量翻倍)")
    print("  - 回滚日志 (有据可查)")
    print("\n注意: 边界点位在导出时会标记 needs_review=true，不会被汇总数字盖过去")


if __name__ == "__main__":
    main()
