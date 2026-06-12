import json
import sys
from datetime import datetime

from models import RecordSource, ConflictResolution, ImportStatus
from core import (
    create_session,
    import_inspection_points,
    import_records,
    detect_conflicts,
    resolve_conflict,
    get_pending_conflicts,
)
from checks import run_all_checks, generate_map_export
from workflow import (
    format_conflict_evidence,
    generate_handover_report,
    advance_step,
    get_step_description,
    trace_record_to_export,
    trace_conflict_to_source,
)
from persistence import (
    save_session,
    list_saved_sessions,
    write_handover_report,
    write_handover_report_text,
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


def print_import_details(details):
    for d in details:
        tag = "新增" if d.status == ImportStatus.NEW else "复用"
        extra = ""
        if d.status == ImportStatus.REUSED and d.existing_record_id:
            extra = f"（已有记录 {d.existing_record_id}）"
        print(f"    [{tag}] {d.record_id} / 点位 {d.point_id} | {d.source_value_preview}{extra}")


def interactive_resolve(session, pending_conflicts, inspector="小付"):
    if not pending_conflicts:
        return session

    print(f"\n  当前有 {len(pending_conflicts)} 个待处理冲突，请逐一确认或驳回：")

    for conflict in pending_conflicts:
        evidence = format_conflict_evidence(session, conflict)
        point_name = evidence["point_info"]["name"]
        field = evidence["conflict_field"]

        print(f"\n  --- 冲突 {conflict.conflict_id} ---")
        print(f"  点位: {point_name} ({conflict.point_id})")
        print(f"  字段: {field}")
        print(f"  证据对比：")
        for ev in evidence["evidence"]:
            print(f"    [{ev['source']}] {ev['inspector']} @ {ev['inspect_time']}: {ev['value']}")
            if ev.get("ramp_note"):
                print(f"      备注: {ev['ramp_note']}")
            if ev.get("remarks"):
                print(f"      备注: {ev['remarks']}")

        while True:
            choice = input(f"  请选择处理方式 (1=确认/以夜间采样为准, 2=驳回/维持坡道普查, 3=跳过): ").strip()
            if choice == "1":
                reason = input(f"  确认原因（可留空）: ").strip()
                session, resolved = resolve_conflict(
                    session,
                    conflict.conflict_id,
                    ConflictResolution.CONFIRMED,
                    inspector,
                    reason=reason or None,
                )
                print(f"  → 已确认冲突 {conflict.conflict_id}")
                break
            elif choice == "2":
                reason = input(f"  驳回原因（可留空）: ").strip()
                session, resolved = resolve_conflict(
                    session,
                    conflict.conflict_id,
                    ConflictResolution.REJECTED,
                    inspector,
                    reason=reason or None,
                )
                print(f"  → 已驳回冲突 {conflict.conflict_id}")
                break
            elif choice == "3":
                print(f"  → 跳过，稍后处理")
                break
            else:
                print(f"  无效输入，请输入 1/2/3")

    return session


def demo_supplementary_with_duplicate():
    print_separator("场景：补录材料 + 重复导入验证 + 交互式确认/驳回")

    session = create_session("VERIFY-001")
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

    ramp_records_batch1 = [
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
    print(f"\n  第一次导入坡道记录：")
    session, imported, skipped, details = import_records(
        session, ramp_records_batch1, RecordSource.RAMP_SURVEY, actor="小付"
    )
    print(f"  导入 {imported} 条，跳过 {len(skipped)} 条")
    print_import_details(details)

    print(f"\n  第二次导入同一批坡道记录（测试重复导入区分）：")
    session, imported2, skipped2, details2 = import_records(
        session, ramp_records_batch1, RecordSource.RAMP_SURVEY, actor="小付"
    )
    print(f"  导入 {imported2} 条，跳过（复用）{len(skipped2)} 条")
    print_import_details(details2)
    if imported2 == 0 and len(skipped2) == 2:
        print(f"  ✓ 重复导入正确识别：全部为复用记录，无真新增")

    print(f"\n  先导一次初始地图（补录前）")
    session, export1 = generate_map_export(session, "小付")
    print(f"  导出ID: {export1.export_id}")
    print(f"  文件路径: {export1.file_path}")
    print(f"  哈希: {export1.file_hash}")

    session, check_results = run_all_checks(session)
    print(f"\n  自检结果（补录前）：")
    print_check_results(check_results)

    save_session(session)
    print(f"  会话已保存到持久化历史")

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
    session, imported_s, skipped_s, details_s = import_records(
        session,
        supplementary_night_records,
        RecordSource.NIGHT_SAMPLING,
        is_supplementary=True,
        actor="周工",
    )
    print(f"  补录夜间采样记录 {imported_s} 条")
    print_import_details(details_s)

    session, new_conflicts = detect_conflicts(session, actor="系统")
    print(f"  检测到新冲突 {len(new_conflicts)} 个")

    pending = get_pending_conflicts(session)
    if pending:
        print(f"\n  冲突列表：")
        for conflict in pending:
            evidence = format_conflict_evidence(session, conflict)
            print(f"    {conflict.conflict_id}: {evidence['point_info']['name']} - {evidence['conflict_field']}")

    session = interactive_resolve(session, pending, inspector="小付")

    save_session(session)

    session, check_results = run_all_checks(session)
    print(f"\n  自检结果（补录后重算）：")
    print_check_results(check_results)

    session = advance_step(session)
    print(f"\n[步骤 {session.current_step}] {get_step_description(session.current_step)}")

    session, export2 = generate_map_export(session, "小付")
    print(f"  重新导出地图成功")
    print(f"  导出ID: {export2.export_id}")
    print(f"  文件路径: {export2.file_path}")
    print(f"  哈希: {export2.file_hash}")

    if export1.file_hash != export2.file_hash:
        print(f"  ✓ 补录后地图导出哈希不同，数据变化已反映")
    else:
        print(f"  ⚠ 哈希未变，请检查")

    session, check_results = run_all_checks(session)
    print(f"\n  自检结果（两次导出比对）：")
    print_check_results(check_results)

    report = generate_handover_report(session)
    report_path = write_handover_report(session, report)
    report_txt_path = write_handover_report_text(session, report)
    print(f"\n  交接报告已写出：")
    print(f"    JSON: {report_path}")
    print(f"    TXT:  {report_txt_path}")

    save_session(session)

    print_separator("审计追溯验证")
    print(f"\n  --- 从坡道记录反查到导出 ---")
    trace = trace_record_to_export(session, "R005")
    print(f"  记录 R005 的审计条目: {len(trace['audit_entries'])}")
    print(f"  关联导出: {len(trace['related_exports'])}")
    print(f"  关联冲突: {len(trace['related_conflicts'])}")

    print(f"\n  --- 从冲突反查到原始材料 ---")
    for conflict in session.conflicts:
        trace = trace_conflict_to_source(session, conflict.conflict_id)
        print(f"  冲突 {conflict.conflict_id}:")
        print(f"    改前: {json.dumps(trace['before_state'], ensure_ascii=False) if trace['before_state'] else '无'}")
        print(f"    改后: {json.dumps(trace['after_state'], ensure_ascii=False) if trace['after_state'] else '无'}")
        print(f"    坡道记录: {trace['ramp_record']['record_id'] if trace['ramp_record'] else '无'}")
        print(f"    夜间记录: {trace['night_record']['record_id'] if trace['night_record'] else '无'}")
        print(f"    关联导出: {len(trace['related_exports'])}")

    print(f"\n  --- 持久化历史 ---")
    saved = list_saved_sessions()
    for s in saved:
        print(f"  会话 {s['session_id']}: {s['task_name']} | 记录 {s['record_count']} | 冲突 {s['conflict_count']} | 导出 {s['export_count']} | 审计 {s['audit_count']}")

    return session


def demo_wrong_caliber_interactive():
    print_separator("场景：错口径材料（交互式确认/驳回）")

    session = create_session("WRONG-INT-001")
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
    session, imported, skipped, details = import_records(
        session, ramp_records, RecordSource.RAMP_SURVEY, actor="王工"
    )
    print(f"  导入无障碍坡道记录 {imported} 条")
    print_import_details(details)

    session, check_results = run_all_checks(session)
    print(f"\n  自检结果：")
    print_check_results(check_results)

    save_session(session)

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
    session, imported, skipped, details = import_records(
        session, night_records, RecordSource.NIGHT_SAMPLING, actor="赵工"
    )
    print(f"  导入夜间采样记录 {imported} 条")
    print_import_details(details)

    session, new_conflicts = detect_conflicts(session, actor="系统")
    print(f"\n  检测到新冲突 {len(new_conflicts)} 个！")

    pending = get_pending_conflicts(session)
    session = interactive_resolve(session, pending, inspector="小付")

    save_session(session)

    session, check_results = run_all_checks(session)
    print(f"\n  自检结果：")
    print_check_results(check_results)

    session = advance_step(session)
    print(f"\n[步骤 {session.current_step}] {get_step_description(session.current_step)}")

    session, export = generate_map_export(session, "小付")
    print(f"  导出地图成功，导出ID: {export.export_id}")
    print(f"  文件路径: {export.file_path}")

    report = generate_handover_report(session)
    report_path = write_handover_report(session, report)
    report_txt_path = write_handover_report_text(session, report)
    print(f"\n  交接报告已写出：")
    print(f"    JSON: {report_path}")
    print(f"    TXT:  {report_txt_path}")

    save_session(session)

    print(f"\n  --- 审计追溯 ---")
    for conflict in session.conflicts:
        trace = trace_conflict_to_source(session, conflict.conflict_id)
        print(f"  冲突 {conflict.conflict_id} ({conflict.point_id}/{conflict.field_name}):")
        print(f"    状态: {trace['resolution']} | 处理人: {trace['resolved_by']}")
        if trace['before_state']:
            print(f"    改前: {json.dumps(trace['before_state'], ensure_ascii=False)}")
        if trace['after_state']:
            print(f"    改后: {json.dumps(trace['after_state'], ensure_ascii=False)}")
        print(f"    关联导出: {len(trace['related_exports'])}")

    return session


def verify_alignment(session):
    print_separator("对齐验证：确认/驳回、发现记录、坡道记录 ↔ 地图导出")

    ok = True
    issues = []

    for export in session.export_history:
        if not export.file_path:
            ok = False
            issues.append(f"导出 {export.export_id} 无文件路径")
            continue

        import os
        if not os.path.exists(export.file_path):
            ok = False
            issues.append(f"导出 {export.export_id} 文件不存在: {export.file_path}")
            continue

        with open(export.file_path, "r", encoding="utf-8") as f:
            export_data = json.load(f)

        export_records = export_data.get("records_snapshot", [])
        if not export_records:
            ok = False
            issues.append(f"导出 {export.export_id} 记录快照为空")

        export_conflicts = export_data.get("conflicts_snapshot", [])
        export_audit = export_data.get("audit_snapshot", [])
        if not export_audit:
            ok = False
            issues.append(f"导出 {export.export_id} 审计快照为空")

        snapshot_record_count = len(export_records)
        snapshot_conflict_count = len(export_conflicts)
        mem_record_count = len(export.records_snapshot)
        mem_conflict_count = len(export.conflicts_snapshot)
        if snapshot_record_count != mem_record_count:
            ok = False
            issues.append(
                f"导出 {export.export_id} 文件记录 {snapshot_record_count} 条 vs 内存快照 {mem_record_count} 条"
            )
        if snapshot_conflict_count != mem_conflict_count:
            ok = False
            issues.append(
                f"导出 {export.export_id} 文件冲突 {snapshot_conflict_count} 个 vs 内存快照 {mem_conflict_count} 个"
            )

        txt_path = export.file_path.replace(".json", ".txt")
        if not os.path.exists(txt_path):
            ok = False
            issues.append(f"导出 {export.export_id} 缺少文本地图文件: {txt_path}")

    for conflict in session.conflicts:
        trace = trace_conflict_to_source(session, conflict.conflict_id)
        if not trace.get("ramp_record"):
            ok = False
            issues.append(f"冲突 {conflict.conflict_id} 无法追回坡道记录 {conflict.ramp_record_id}")
        if not trace.get("night_record"):
            ok = False
            issues.append(f"冲突 {conflict.conflict_id} 无法追回夜间记录 {conflict.night_sampling_id}")
        if conflict.resolution != ConflictResolution.PENDING:
            if not trace.get("before_state"):
                ok = False
                issues.append(f"冲突 {conflict.conflict_id} 已处理但无改前状态")
            if not trace.get("after_state"):
                ok = False
                issues.append(f"冲突 {conflict.conflict_id} 已处理但无改后状态")

    for record in session.records:
        trace = trace_record_to_export(session, record.record_id)
        if not trace["audit_entries"]:
            ok = False
            issues.append(f"记录 {record.record_id} 无审计条目")

    if ok:
        print(f"\n  ✓ 全部对齐验证通过！")
        print(f"    - 每次导出都有实际文件（JSON+TXT）")
        print(f"    - 导出文件快照与内存快照一致")
        print(f"    - 每个冲突都能追回坡道记录和夜间记录")
        print(f"    - 已处理冲突都有改前改后状态")
        print(f"    - 每条记录都有审计条目")
    else:
        print(f"\n  ⚠ 发现 {len(issues)} 个对齐问题：")
        for issue in issues:
            print(f"    - {issue}")

    return ok


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("  雨水花园积水复核 - 增强版完整流程")
    print("  新增：持久化历史 / 可下载地图导出 / 交互式确认驳回")
    print("        重复导入区分 / 审计追踪 / 对齐验证")
    print("=" * 70)

    auto_mode = "--auto" in sys.argv

    if auto_mode:
        print("\n  [自动模式] 跳过交互，使用默认选择")

        from models import ConflictResolution
        from core import resolve_conflict, get_pending_conflicts

        session = create_session("AUTO-VERIFY-001")

        points_data = [
            {"point_id": "P005", "name": "徐家汇公园雨水花园", "lat": 31.1987, "lng": 121.4382, "street": "徐家汇街道", "is_boundary": False},
            {"point_id": "P006", "name": "衡山路雨水花园", "lat": 31.2078, "lng": 121.4375, "street": "天平路街道", "is_boundary": True, "adjacent_streets": ["湖南路街道"]},
        ]
        session, _ = import_inspection_points(session, points_data)

        ramp_batch = [
            {"record_id": "R005", "point_id": "P005", "inspector": "孙工", "inspect_time": "2026-06-04T10:00:00", "has_waterlogging": False, "ramp_accessible": True, "ramp_note": "正常"},
            {"record_id": "R006", "point_id": "P006", "inspector": "孙工", "inspect_time": "2026-06-04T11:00:00", "has_waterlogging": False, "ramp_accessible": True, "ramp_note": "正常"},
        ]
        session, imp1, skip1, det1 = import_records(session, ramp_batch, RecordSource.RAMP_SURVEY, actor="小付")
        print(f"  第一次导入坡道记录: 新增 {imp1} 条，复用 {len(skip1)} 条")
        print_import_details(det1)

        session, imp2, skip2, det2 = import_records(session, ramp_batch, RecordSource.RAMP_SURVEY, actor="小付")
        print(f"  第二次导入同一批: 新增 {imp2} 条，复用 {len(skip2)} 条")
        print_import_details(det2)

        session, export1 = generate_map_export(session, "小付")
        print(f"  补录前导出: {export1.export_id} → {export1.file_path}")

        session = advance_step(session)

        night_records = [
            {"record_id": "N005", "point_id": "P005", "inspector": "周工", "inspect_time": "2026-06-05T01:30:00", "has_waterlogging": True, "water_depth_cm": 6.0, "ramp_accessible": True, "remarks": "补录：夜间短时降雨，有积水但坡道仍可用"},
        ]
        session, imp_s, skip_s, det_s = import_records(session, night_records, RecordSource.NIGHT_SAMPLING, is_supplementary=True, actor="周工")
        print(f"  补录夜间采样: {imp_s} 条")

        session, conflicts = detect_conflicts(session, actor="系统")
        print(f"  检测到冲突 {len(conflicts)} 个")

        for c in conflicts:
            if c.field_name == "has_waterlogging":
                session, _ = resolve_conflict(session, c.conflict_id, ConflictResolution.CONFIRMED, "小付", reason="以夜间采样为准")
            else:
                session, _ = resolve_conflict(session, c.conflict_id, ConflictResolution.REJECTED, "小付", reason="坡道状态以普查为准")

        session, checks = run_all_checks(session)
        print(f"\n  自检结果：")
        print_check_results(checks)

        session = advance_step(session)
        session, export2 = generate_map_export(session, "小付")
        print(f"  补录后导出: {export2.export_id} → {export2.file_path}")
        print(f"  哈希对比: {export1.file_hash} → {export2.file_hash} ({'有变化 ✓' if export1.file_hash != export2.file_hash else '无变化 ⚠'})")

        save_session(session)

        report = generate_handover_report(session)
        report_path = write_handover_report(session, report)
        report_txt_path = write_handover_report_text(session, report)
        print(f"\n  交接报告: {report_path}")
        print(f"  交接报告(TXT): {report_txt_path}")

        print_separator("审计追溯验证")
        for conflict in session.conflicts:
            trace = trace_conflict_to_source(session, conflict.conflict_id)
            print(f"  冲突 {conflict.conflict_id} ({conflict.field_name}):")
            if trace['before_state']:
                print(f"    改前: {json.dumps(trace['before_state'], ensure_ascii=False)}")
            if trace['after_state']:
                print(f"    改后: {json.dumps(trace['after_state'], ensure_ascii=False)}")
            print(f"    关联导出: {len(trace['related_exports'])}")

        for record in session.records:
            trace = trace_record_to_export(session, record.record_id)
            print(f"  记录 {record.record_id}: 审计 {len(trace['audit_entries'])} 条, 关联导出 {len(trace['related_exports'])} 个")

        verify_alignment(session)

        saved = list_saved_sessions()
        print(f"\n  持久化历史：{len(saved)} 个会话")
        for s in saved:
            print(f"    {s['session_id']}: {s['task_name']} | 记录 {s['record_count']} | 审计 {s['audit_count']}")

    else:
        session1 = demo_supplementary_with_duplicate()
        verify_alignment(session1)

        session2 = demo_wrong_caliber_interactive()
        verify_alignment(session2)

        saved = list_saved_sessions()
        print_separator("所有持久化会话")
        for s in saved:
            print(f"  {s['session_id']}: {s['task_name']} | 步骤 {s['current_step']} | 记录 {s['record_count']} | 冲突 {s['conflict_count']} | 导出 {s['export_count']} | 审计 {s['audit_count']}")

    print_separator()
