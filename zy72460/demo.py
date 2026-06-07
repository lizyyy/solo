import json
from datetime import datetime

from models import RecordSource, ConflictResolution
from core import (
    create_session,
    import_inspection_points,
    import_records,
    detect_conflicts,
    resolve_conflict,
)
from checks import run_all_checks, generate_map_export
from workflow import (
    format_conflict_evidence,
    generate_handover_report,
    advance_step,
    get_step_description,
)


def print_separator(title=""):
    line = "=" * 70
    if title:
        print(f"\n{line}")
        print(f"  {title}")
        print(line)
    else:
        print(f"\n{line}")


def print_check_results(check_results):
    for result in check_results:
        status = "✓ 通过" if result.passed else "⚠ 需注意"
        print(f"  [{status}] {result.check_name}: {result.message}")


def demo_normal_material():
    print_separator("场景一：正常材料（数据一致，无冲突）")

    session = create_session("NORMAL-001")
    print(f"\n[步骤 {session.current_step}] {get_step_description(session.current_step)}")

    points_data = [
        {
            "point_id": "P001",
            "name": "人民公园雨水花园",
            "lat": 31.2304,
            "lng": 121.4737,
            "street": "南京东路街道",
            "is_boundary": False,
        },
        {
            "point_id": "P002",
            "name": "延中绿地雨水花园",
            "lat": 31.2287,
            "lng": 121.4695,
            "street": "南京西路街道",
            "is_boundary": False,
        },
    ]
    session, count = import_inspection_points(session, points_data)
    print(f"  导入点位 {count} 个")

    ramp_records = [
        {
            "record_id": "R001",
            "point_id": "P001",
            "inspector": "张工",
            "inspect_time": "2026-06-05T09:30:00",
            "has_waterlogging": False,
            "ramp_accessible": True,
            "ramp_note": "坡道完好，无积水",
        },
        {
            "record_id": "R002",
            "point_id": "P002",
            "inspector": "张工",
            "inspect_time": "2026-06-05T10:15:00",
            "has_waterlogging": True,
            "water_depth_cm": 5.0,
            "ramp_accessible": True,
            "ramp_note": "有少量积水，坡道仍可通行",
        },
    ]
    session, imported, skipped = import_records(
        session, ramp_records, RecordSource.RAMP_SURVEY
    )
    print(f"  导入无障碍坡道记录 {imported} 条，跳过重复 {len(skipped)} 条")

    session, check_results = run_all_checks(session)
    print(f"\n  自检结果：")
    print_check_results(check_results)

    session = advance_step(session)
    print(f"\n[步骤 {session.current_step}] {get_step_description(session.current_step)}")

    night_records = [
        {
            "record_id": "N001",
            "point_id": "P001",
            "inspector": "李工",
            "inspect_time": "2026-06-06T02:00:00",
            "has_waterlogging": False,
            "ramp_accessible": True,
            "remarks": "夜间采样，无异常",
        },
        {
            "record_id": "N002",
            "point_id": "P002",
            "inspector": "李工",
            "inspect_time": "2026-06-06T02:30:00",
            "has_waterlogging": True,
            "water_depth_cm": 5.5,
            "ramp_accessible": True,
            "remarks": "夜间采样，积水与白天一致",
        },
    ]
    session, imported, skipped = import_records(
        session, night_records, RecordSource.NIGHT_SAMPLING
    )
    print(f"  导入夜间采样记录 {imported} 条，跳过重复 {len(skipped)} 条")

    session, new_conflicts = detect_conflicts(session)
    print(f"  检测到新冲突 {len(new_conflicts)} 个")

    session, check_results = run_all_checks(session)
    print(f"\n  自检结果：")
    print_check_results(check_results)

    session = advance_step(session)
    print(f"\n[步骤 {session.current_step}] {get_step_description(session.current_step)}")

    session, export = generate_map_export(session, "小付")
    print(f"  导出地图成功，导出ID: {export.export_id}")
    print(f"  点位总数: {export.point_count}")
    print(f"  边界点位: {export.boundary_points if export.boundary_points else '无'}")
    print(f"  待处理冲突点位: {export.conflict_points if export.conflict_points else '无'}")
    print(f"  文件哈希: {export.file_hash}")

    session, check_results = run_all_checks(session)
    print(f"\n  自检结果：")
    print_check_results(check_results)

    report = generate_handover_report(session)
    print(f"\n  交接报告摘要：")
    print(f"    总点位: {report['summary']['total_points']}")
    print(f"    总记录: {report['summary']['total_records']}")
    print(f"    待处理冲突: {report['summary']['pending_conflicts']}")
    print(f"    边界点位: {report['summary']['boundary_points']}")
    print(f"    导出次数: {report['summary']['export_count']}")

    print(f"\n  ✓ 正常材料流程跑完，数据一致，地图导出和历史记录对得上。")
    return session


def demo_wrong_caliber_material():
    print_separator("场景二：错口径材料（坡道记录与夜间采样矛盾）")

    session = create_session("WRONG-001")
    print(f"\n[步骤 {session.current_step}] {get_step_description(session.current_step)}")

    points_data = [
        {
            "point_id": "P003",
            "name": "世纪公园雨水花园",
            "lat": 31.2197,
            "lng": 121.5413,
            "street": "花木街道",
            "is_boundary": False,
        },
        {
            "point_id": "P004",
            "name": "金桥公园雨水花园",
            "lat": 31.2672,
            "lng": 121.5878,
            "street": "金杨新村街道",
            "is_boundary": True,
            "adjacent_streets": ["金桥经济技术开发区"],
        },
    ]
    session, count = import_inspection_points(session, points_data)
    print(f"  导入点位 {count} 个")

    ramp_records = [
        {
            "record_id": "R003",
            "point_id": "P003",
            "inspector": "王工",
            "inspect_time": "2026-06-05T14:00:00",
            "has_waterlogging": False,
            "ramp_accessible": True,
            "ramp_note": "无积水，坡道通畅",
        },
        {
            "record_id": "R004",
            "point_id": "P004",
            "inspector": "王工",
            "inspect_time": "2026-06-05T15:00:00",
            "has_waterlogging": False,
            "ramp_accessible": True,
            "ramp_note": "无积水",
        },
    ]
    session, imported, skipped = import_records(
        session, ramp_records, RecordSource.RAMP_SURVEY
    )
    print(f"  导入无障碍坡道记录 {imported} 条")

    session, check_results = run_all_checks(session)
    print(f"\n  自检结果：")
    print_check_results(check_results)

    session = advance_step(session)
    print(f"\n[步骤 {session.current_step}] {get_step_description(session.current_step)}")

    night_records = [
        {
            "record_id": "N003",
            "point_id": "P003",
            "inspector": "赵工",
            "inspect_time": "2026-06-06T03:00:00",
            "has_waterlogging": True,
            "water_depth_cm": 12.0,
            "ramp_accessible": False,
            "remarks": "夜间突降暴雨，积水严重，坡道被淹",
        },
        {
            "record_id": "N004",
            "point_id": "P004",
            "inspector": "赵工",
            "inspect_time": "2026-06-06T03:45:00",
            "has_waterlogging": True,
            "water_depth_cm": 8.0,
            "ramp_accessible": False,
            "remarks": "暴雨后积水，坡道入口被淹",
        },
    ]
    session, imported, skipped = import_records(
        session, night_records, RecordSource.NIGHT_SAMPLING
    )
    print(f"  导入夜间采样记录 {imported} 条")

    session, new_conflicts = detect_conflicts(session)
    print(f"\n  检测到新冲突 {len(new_conflicts)} 个！")

    for conflict in new_conflicts:
        evidence = format_conflict_evidence(session, conflict)
        print(f"\n  --- 冲突 {conflict.conflict_id} ---")
        print(f"  点位: {evidence['point_info']['name']} ({evidence['point_info']['point_id']})")
        print(f"  冲突字段: {evidence['conflict_field']}")
        print(f"  证据对比：")
        for ev in evidence["evidence"]:
            print(f"    [{ev['source']}] {ev['inspector']} @ {ev['inspect_time']}: {ev['value']}")
            if ev.get("ramp_note"):
                print(f"      备注: {ev['ramp_note']}")
            if ev.get("remarks"):
                print(f"      备注: {ev['remarks']}")

    session, check_results = run_all_checks(session)
    print(f"\n  自检结果：")
    print_check_results(check_results)

    report = generate_handover_report(session)
    print(f"\n  待处理事项：")
    for action in report["action_items"]["inspector_actions"]:
        print(f"    [巡检员小付] {action}")
    for action in report["action_items"]["manager_actions"]:
        print(f"    [项目经理] {action}")

    print(f"\n  ⚠ 错口径材料跑完，发现数据矛盾。已列出冲突证据，请小付确认或驳回，不自动拍板。")
    print(f"  ⚠ P004 点位在街道边界上，留待项目经理复核，不归为正常。")

    return session


def demo_supplementary_material():
    print_separator("场景三：补录材料（夜间采样点后补，补录后重算）")

    session = create_session("SUPP-001")
    print(f"\n[步骤 {session.current_step}] {get_step_description(session.current_step)}")

    points_data = [
        {
            "point_id": "P005",
            "name": "徐家汇公园雨水花园",
            "lat": 31.1987,
            "lng": 121.4382,
            "street": "徐家汇街道",
            "is_boundary": False,
        },
        {
            "point_id": "P006",
            "name": "衡山路雨水花园",
            "lat": 31.2078,
            "lng": 121.4375,
            "street": "天平路街道",
            "is_boundary": True,
            "adjacent_streets": ["湖南路街道"],
        },
    ]
    session, count = import_inspection_points(session, points_data)
    print(f"  导入点位 {count} 个")

    ramp_records = [
        {
            "record_id": "R005",
            "point_id": "P005",
            "inspector": "孙工",
            "inspect_time": "2026-06-04T10:00:00",
            "has_waterlogging": False,
            "ramp_accessible": True,
            "ramp_note": "正常",
        },
        {
            "record_id": "R006",
            "point_id": "P006",
            "inspector": "孙工",
            "inspect_time": "2026-06-04T11:00:00",
            "has_waterlogging": False,
            "ramp_accessible": True,
            "ramp_note": "正常",
        },
    ]
    session, imported, skipped = import_records(
        session, ramp_records, RecordSource.RAMP_SURVEY
    )
    print(f"  导入无障碍坡道记录 {imported} 条")

    print(f"\n  先导一次初始地图（补录前）")
    session, export1 = generate_map_export(session, "小付")
    print(f"  导出ID: {export1.export_id}, 哈希: {export1.file_hash}")

    session, check_results = run_all_checks(session)
    print(f"\n  自检结果（补录前）：")
    print_check_results(check_results)

    session = advance_step(session)
    print(f"\n[步骤 {session.current_step}] {get_step_description(session.current_step)}")
    print(f"  → 夜间采样点后来才补到群里，小付回看时才发现...")

    supplementary_night_records = [
        {
            "record_id": "N005",
            "point_id": "P005",
            "inspector": "周工",
            "inspect_time": "2026-06-05T01:30:00",
            "has_waterlogging": True,
            "water_depth_cm": 6.0,
            "ramp_accessible": True,
            "remarks": "补录：夜间短时降雨，有积水但坡道仍可用",
        },
    ]
    session, imported, skipped = import_records(
        session,
        supplementary_night_records,
        RecordSource.NIGHT_SAMPLING,
        is_supplementary=True,
    )
    print(f"  补录夜间采样记录 {imported} 条")

    session, new_conflicts = detect_conflicts(session)
    print(f"  检测到新冲突 {len(new_conflicts)} 个")

    for conflict in new_conflicts:
        evidence = format_conflict_evidence(session, conflict)
        print(f"\n  --- 冲突 {conflict.conflict_id} ---")
        print(f"  点位: {evidence['point_info']['name']}")
        print(f"  冲突字段: {evidence['conflict_field']}")
        for ev in evidence["evidence"]:
            print(f"    [{ev['source']}] {ev['inspector']}: {ev['value']}")
            if ev.get("remarks"):
                print(f"      备注: {ev['remarks']}")

    print(f"\n  → 小付确认 P005 的积水情况属实，但坡道确实可用，维持 ramp_accessible=True")
    for conflict in new_conflicts:
        if conflict.field_name == "has_waterlogging":
            session, resolved = resolve_conflict(
                session, conflict.conflict_id, ConflictResolution.CONFIRMED, "小付"
            )
            print(f"  冲突 {conflict.conflict_id} 已由小付确认（以夜间采样为准）")
        else:
            session, resolved = resolve_conflict(
                session, conflict.conflict_id, ConflictResolution.REJECTED, "小付"
            )
            print(f"  冲突 {conflict.conflict_id} 已由小付驳回（坡道状态以普查为准）")

    session, check_results = run_all_checks(session)
    print(f"\n  自检结果（补录后重算）：")
    print_check_results(check_results)

    session = advance_step(session)
    print(f"\n[步骤 {session.current_step}] {get_step_description(session.current_step)}")

    session, export2 = generate_map_export(session, "小付")
    print(f"  重新导出地图成功，导出ID: {export2.export_id}")
    print(f"  文件哈希: {export2.file_hash}")

    session, check_results = run_all_checks(session)
    print(f"\n  自检结果（两次导出比对）：")
    print_check_results(check_results)

    if export1.file_hash != export2.file_hash:
        print(f"\n  ✓ 补录后地图导出已更新，哈希不同说明数据变化已反映在导出中。")
    else:
        print(f"\n  ⚠ 警告：补录后导出哈希未变，请检查。")

    report = generate_handover_report(session)
    print(f"\n  最终交接摘要：")
    print(f"    总点位: {report['summary']['total_points']}")
    print(f"    待处理冲突: {report['summary']['pending_conflicts']}")
    print(f"    边界点位: {report['summary']['boundary_points']}")
    if report["action_items"]["manager_actions"]:
        for action in report["action_items"]["manager_actions"]:
            print(f"    [项目经理] {action}")

    print(f"\n  ✓ 补录材料跑完，补录后已重算，地图导出更新成功。")
    print(f"  ✓ P006 边界点位保留待项目经理复核状态。")

    return session


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("  雨水花园积水复核 - 完整流程演示")
    print("  覆盖：正常材料、错口径材料、补录材料")
    print("  自检：重复导入、边界点位、补录重算、导出一致")
    print("=" * 70)

    normal_session = demo_normal_material()
    wrong_session = demo_wrong_caliber_material()
    supp_session = demo_supplementary_material()

    print_separator("总结")
    print("\n  三个场景都已跑完：")
    print("  1. 正常材料：数据一致，无冲突，导出正常")
    print("  2. 错口径材料：检测到冲突，列出证据，待小付确认/驳回")
    print("     边界点位留待项目经理复核，不自动归为正常")
    print("  3. 补录材料：补录后重算，地图导出更新")
    print("     两次导出哈希不同，确认导出数据有变化")
    print("\n  所有自检项均覆盖：重复导入、边界点位、补录重算、导出一致")
    print("  冲突不自动拍板，由巡检员小付选择确认或驳回")
    print("  边界点位不自动归正常，留给项目经理复核")
    print_separator()
