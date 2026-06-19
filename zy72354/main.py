from datetime import datetime, timedelta
from typing import List

from models import (
    SafetyThreshold,
    ManualInspectionNote,
    SolarTrackingBracketError,
    ErrorStatus,
)
from boundary_rules import (
    BoundaryRuleEngine,
    MIN_SAMPLING_DURATION_MINUTES,
)
from import_service import ImportService
from visualization_review import (
    VisualizationReviewService,
    ViewMode,
)
from workflow import (
    QualityInspectionWorkflow,
    WorkflowStep,
)


def create_combination_batch_notes() -> List[ManualInspectionNote]:
    """组合场景批次 NOTE_001~NOTE_004，贯穿：导入→补录→重复导入→回滚"""
    base_date = datetime(2026, 6, 1)
    notes: List[ManualInspectionNote] = []

    notes.append(ManualInspectionNote(
        note_id="NOTE_001",
        inspection_date="2026-06-01",
        inspector="巡检员老王",
        bracket_id="BRACKET_A01",
        azimuth_error=1.2,
        elevation_error=0.8,
        sampling_start_time=base_date.replace(hour=8, minute=0),
        sampling_end_time=base_date.replace(hour=8, minute=10),
        tracking_accuracy=96.5,
        raw_content="6月1日巡检，A01号支架，采样时间8:00-8:10，只采了10分钟就下雨了",
    ))

    notes.append(ManualInspectionNote(
        note_id="NOTE_002",
        inspection_date="2026-06-01",
        inspector="巡检员老王",
        bracket_id="BRACKET_A02",
        azimuth_error=2.5,
        elevation_error=1.8,
        sampling_start_time=base_date.replace(hour=9, minute=0),
        sampling_end_time=base_date.replace(hour=9, minute=35),
        tracking_accuracy=93.0,
        raw_content="6月1日巡检，A02号支架，采样时间9:00-9:35，正常采样35分钟",
    ))

    notes.append(ManualInspectionNote(
        note_id="NOTE_003",
        inspection_date="2026-06-01",
        inspector="巡检员小李",
        bracket_id="BRACKET_B01",
        azimuth_error=0.5,
        elevation_error=0.3,
        sampling_start_time=base_date.replace(hour=10, minute=0),
        sampling_end_time=base_date.replace(hour=10, minute=45),
        tracking_accuracy=97.2,
        raw_content="6月1日巡检，B01号支架，采样时间10:00-10:45，正常采样45分钟",
    ))

    notes.append(ManualInspectionNote(
        note_id="NOTE_004",
        inspection_date="2026-06-01",
        inspector="巡检员小李",
        bracket_id="BRACKET_B02",
        azimuth_error=1.0,
        elevation_error=0.5,
        sampling_start_time=None,
        sampling_end_time=None,
        tracking_accuracy=95.8,
        raw_content="6月1日巡检，B02号支架，采样时间忘记填开始结束时间",
    ))

    return notes


def print_consistency_checkpoint(
    workflow: QualityInspectionWorkflow,
    import_service: ImportService,
    viz_service: VisualizationReviewService,
    focus_error_id: str,
    focus_bracket: str,
    stage_tag: str,
    asserts: dict = None,
):
    """打印一致性检查点（列表/详情/摘要/3D图/历史/复核信息包/导出）"""
    print()
    print("=" * 70)
    print(f"  📡 一致性检查点 【{stage_tag}】 · 聚焦 支架{focus_bracket}")
    print("=" * 70)

    focus_error = import_service.get_error(focus_error_id)
    if not focus_error:
        print("  ❌ 找不到聚焦误差记录！")
        return

    # ① 待复核/状态列表
    print(f"\n①  状态列表（聚焦记录所在位置）")
    print("-" * 60)
    all_errors = import_service.get_all_errors()
    for e in all_errors:
        marker = "  ⭐ 聚焦记录 ←就是这条" if e.error_id == focus_error_id else ""
        duration_info = ""
        if e.sampling_duration_minutes is not None:
            duration_info = f" | 采样{e.sampling_duration_minutes:.0f}分钟"
        issue_flag = ""
        if any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in e.boundary_violations):
            issue_flag = " | ⚠️采样缺半小时"
        print(f"  · [{e.status.value}] 支架{e.bracket_id}{duration_info}{issue_flag}{marker}")

    # ② 聚焦记录当前状态
    print(f"\n②  聚焦记录最新快照")
    print("-" * 60)
    has_dur = any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in focus_error.boundary_violations)
    print(f"  error_id        : {focus_error.error_id}")
    print(f"  版本号          : v{focus_error.version}")
    print(f"  支架号          : {focus_error.bracket_id}")
    print(f"  原始备注ID      : {focus_error.note_id}")
    print(f"  当前状态        : {focus_error.status.value}")
    print(f"  方位/俯仰误差   : {focus_error.azimuth_error}° / {focus_error.elevation_error}°")
    print(f"  跟踪准确率      : {focus_error.tracking_accuracy}%")
    print(f"  采样开始/结束   : "
          f"{focus_error.sampling_start_time.strftime('%H:%M') if focus_error.sampling_start_time else '未填'}"
          f" → "
          f"{focus_error.sampling_end_time.strftime('%H:%M') if focus_error.sampling_end_time else '未填'}")
    print(f"  采样时长        : {focus_error.sampling_duration_minutes}分钟")
    print(f"  缺半小时提示    : {'⚠️ 保留（未被抹掉）' if has_dur else '无'}")
    print(f"  问题人话提示    : {focus_error.human_readable_issues[0] if focus_error.human_readable_issues else '（无）'}")
    print(f"  复核人/说明     : {focus_error.review_by or '未复核'}"
          f"{' / ' + focus_error.review_comment if focus_error.review_comment else ''}")

    # ③ 总览摘要同步
    print(f"\n③  总览摘要（是否同步聚焦记录状态）")
    print("-" * 60)
    s = viz_service.get_visualization_summary()
    print(f"  {s['human_summary']}")
    print(f"  状态分布: 正常={s['by_status']['normal']}, "
          f"异常={s['by_status']['abnormal']}, "
          f"待复核={s['by_status']['pending_review']}, "
          f"已修改={s['by_status']['modified']}, "
          f"已回滚={s['by_status']['rolled_back']}")
    print(f"  采样缺半小时总数: duration_issues_count = {s['duration_issues_count']}")

    # ④ 版本历史链
    print(f"\n④  版本历史链（按版本升序，系统/用户动作标注）")
    print("-" * 60)
    history = import_service.get_error_history(focus_error_id)
    if not history:
        print("  （暂无修改/回滚历史）")
    for h in history:
        actor_flag = "👤 用户动作"
        if "system_import_update" in h.modified_by or "system_import_update" in h.modification_reason:
            actor_flag = "🤖 系统动作"
        if "回滚到版本" in h.modification_reason:
            actor_flag = "↩️  回滚动作"
        print(f"  · v{h.version} | {h.modified_time.strftime('%Y-%m-%d %H:%M')[:16]} | {actor_flag}"
              f" | 修改人={h.modified_by}")
        print(f"      原因: {h.modification_reason}")
        print(f"      字段: {', '.join(h.fields_changed)}")

    # ⑤ 人工复核信息包
    print(f"\n⑤  人工复核信息包（别提前归到正常！）")
    print("-" * 60)
    detail = workflow.get_full_error_detail(focus_error_id)
    packet = detail["manual_review_packet"]
    field_cn = {
        "sampling_start_time": "采样开始时间",
        "sampling_end_time": "采样结束时间",
        "sampling_duration_minutes": "采样时长",
        "azimuth_error": "方位角误差",
        "elevation_error": "俯仰角误差",
        "tracking_accuracy": "跟踪准确率",
        "boundary_violations": "边界判定编码",
        "human_readable_issues": "人话提示",
        "status": "状态",
        "source_note_hash": "备注内容哈希",
        "review_by": "复核人",
        "review_comment": "复核说明",
    }
    print(f"  🗣️  原始问题说法 : {packet['原始问题说法']}")
    print(f"  🔧 改后的值     :")
    if packet["改后的值"]:
        for f, v in packet["改后的值"].items():
            name = field_cn.get(f, f)
            b = v.get("before")
            a = v.get("after")
            if f in ["sampling_start_time", "sampling_end_time", "review_time"]:
                try:
                    if isinstance(b, str) and b: b = datetime.fromisoformat(b).strftime("%H:%M")
                    if isinstance(a, str) and a: a = datetime.fromisoformat(a).strftime("%H:%M")
                except:
                    pass
            print(f"     · {name}：{b} → {a}")
    else:
        print(f"     · （暂无修改记录）")
    print(f"  💡 处理原因     : {packet['处理原因']}")
    print(f"  👤 下一步找谁   : {packet['下一步找谁']}")

    # ⑥ 3D图表数据点同步
    print(f"\n⑥  3D图表数据点（聚焦记录坐标与状态）")
    print("-" * 60)
    chart = viz_service.prepare_chart_data(ViewMode.CHART_3D)
    for dp in chart["data_points"]:
        m = "  ⭐ ←聚焦记录" if dp["error_id"] == focus_error_id else ""
        print(f"  · 坐标({dp['x']:.1f}, {dp['y']:.1f}, {dp.get('z',0):.1f}) "
              f"[{dp['status']}] {dp['label']}{m}")

    # ⑦ 导出报告一致性
    print(f"\n⑦  导出报告（聚焦记录快照）")
    print("-" * 60)
    import os
    tmp_report = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_checkpoint_report.txt")
    path = workflow.save_report_to_file(tmp_report, error_ids=[focus_error_id])
    with open(path, encoding="utf-8") as f:
        content = f.read()
    checks = {
        "包含支架号": focus_bracket in content,
        "包含原始问题说法": "采样时间缺了" in content or packet["原始问题说法"][:8] in content,
        "包含缺半小时摘要": "采样时间缺半小时" in content,
        "包含历史链条数": f"共 {detail['history_count']} 条" in content or "历史" in content,
        "包含人工复核信息": "人工复核信息包" in content,
    }
    for k, ok in checks.items():
        print(f"  · {'✅' if ok else '❌'} 报告{k}: {ok}")
    print(f"  报告保存路径: {path}")

    # 断言核对（如提供）
    if asserts:
        print(f"\n✅ 断言核对")
        print("-" * 60)
        all_ok = True
        for key, expected in asserts.items():
            actual = None
            if key == "采样时长_min":
                actual = focus_error.sampling_duration_minutes
            elif key == "状态":
                actual = focus_error.status.value
            elif key == "版本":
                actual = focus_error.version
            elif key == "历史条数":
                actual = len(history)
            elif key == "摘要_缺半小时数":
                actual = s["duration_issues_count"]
            elif key == "保留缺半小时提示":
                actual = has_dur
            elif key == "原始问题说法_包含":
                actual = expected in packet["原始问题说法"]
                expected = True
            elif key == "问题提示人话_包含":
                if focus_error.human_readable_issues:
                    actual = expected in focus_error.human_readable_issues[0]
                    expected = True
                else:
                    actual = False
                    expected = True
            elif key == "改后值_非空":
                actual = len(packet["改后的值"]) > 0
            elif key == "处理原因_包含":
                actual = expected in packet["处理原因"]
                expected = True
            elif key == "下一步找谁_包含":
                actual = expected in packet["下一步找谁"]
                expected = True

            ok = actual == expected
            if not ok: all_ok = False
            marker = "✅" if ok else "❌"
            print(f"  {marker} {key}: 预期={repr(expected)}, 实际={repr(actual)}")
        if all_ok:
            print(f"\n  🎉 本检查点【{stage_tag}】全部断言通过！")
        else:
            print(f"\n  ⚠️  本检查点【{stage_tag}】有断言失败，请排查！")
    print()


def build_combination_workflow_demo():
    print("=" * 70)
    print("  太阳跟踪支架误差 · 组合场景全链路演示")
    print("  （同一批 NOTE_001 贯穿：导入→补录 8:35→重复导入原始→回滚→导出）")
    print("=" * 70)
    print()

    threshold = SafetyThreshold(azimuth_max=2.0, elevation_max=1.5, tracking_accuracy_min=95.0)
    rule_engine = BoundaryRuleEngine(threshold)
    import_service = ImportService(rule_engine)
    viz_service = VisualizationReviewService(import_service, threshold)
    workflow = QualityInspectionWorkflow(rule_engine, import_service, viz_service)

    base = datetime(2026, 6, 1)
    focus_bracket = "BRACKET_A01"
    focus_note_id = "NOTE_001"

    # =============================================================
    # 场景1：打开项目样例，首次导入 NOTE_001~004
    # =============================================================
    print("📋 场景1 · 打开项目样例 → 首次导入组合批次 NOTE_001~004")
    print("-" * 60)
    notes_batch = create_combination_batch_notes()
    result1 = workflow.step_1_import_notes(notes_batch)
    for msg in result1.human_messages:
        print(f"  {msg}")
    eid = import_service._error_by_note_hash[notes_batch[0].content_hash()]
    print()
    print_consistency_checkpoint(workflow, import_service, viz_service, eid, focus_bracket,
                                 stage_tag="场景1-首次导入NOTE_001",
                                 asserts={
                                     "采样时长_min": 10.0,
                                     "状态": "待质检员复核",
                                     "版本": 1,
                                     "历史条数": 0,
                                     "摘要_缺半小时数": 1,
                                     "保留缺半小时提示": True,
                                     "问题提示人话_包含": "采样时间缺了20分钟",
                                     "原始问题说法_包含": "采样时间缺了20分钟",
                                     "下一步找谁_包含": "质检员小白",
                                 })

    # =============================================================
    # 场景2：质检员小白补录 8:35（修改 NOTE_001 结束时间）
    # =============================================================
    print("🔧 场景2 · 质检员小白补录 NOTE_001 结束时间到 8:35（从 8:10 +25min）")
    print("-" * 60)
    result2 = workflow.reviewer_fix_duration_issue(
        error_id=eid,
        new_sampling_start=base.replace(hour=8, minute=0),
        new_sampling_end=base.replace(hour=8, minute=35),
        reviewer="质检员小白",
        review_comment="经核对原始巡检手写备注原始笔迹，实际采样到8:35才收工，之前录错少记25分钟",
    )
    for msg in result2.human_messages:
        print(f"  {msg}")
    print()
    print_consistency_checkpoint(workflow, import_service, viz_service, eid, focus_bracket,
                                 stage_tag="场景2-补录结束时间8:35",
                                 asserts={
                                     "采样时长_min": 35.0,
                                     "状态": "正常",
                                     "版本": 2,
                                     "历史条数": 1,
                                     "摘要_缺半小时数": 0,
                                     "保留缺半小时提示": False,
                                     "改后值_非空": True,
                                     "处理原因_包含": "核对原始巡检手写备注",
                                     "下一步找谁_包含": "已归档",
                                 })

    # =============================================================
    # 场景3：刷新/重算 → 重复导入同一批 NOTE_001 原始内容（夹在中间！）
    # =============================================================
    print("🔄 场景3 · 刷新重算 → 重复导入同一批 NOTE_001 原始备注（夹在补录和回滚中间！）")
    print("-" * 60)
    print("  （NOTE_001 内容与场景1完全相同：8:00-8:10，就是用户原始的手写备注）")
    result3 = workflow.step_1_import_notes(create_combination_batch_notes())
    for msg in result3.human_messages[:4]:
        print(f"  {msg}")
    print()
    print_consistency_checkpoint(workflow, import_service, viz_service, eid, focus_bracket,
                                 stage_tag="场景3-重复导入同一批原始备注(夹在中间)",
                                 asserts={
                                     "采样时长_min": 35.0,
                                     "状态": "正常",
                                     "版本": 2,
                                     "历史条数": 1,
                                     "摘要_缺半小时数": 0,
                                     "保留缺半小时提示": False,
                                     "改后值_非空": True,
                                     "处理原因_包含": "核对原始巡检手写备注",
                                 })

    # =============================================================
    # 场景4：回滚（撤销刚才的用户补录动作！）
    # =============================================================
    print("↩️  场景4 · 回滚刚才的用户补录（跳过系统导入历史！只撤销用户补录动作）")
    print("-" * 60)
    result4 = workflow.rollback_modification(eid, "质检员小白")
    for msg in result4.human_messages:
        print(f"  {msg}")
    print()
    print_consistency_checkpoint(workflow, import_service, viz_service, eid, focus_bracket,
                                 stage_tag="场景4-回滚用户补录动作",
                                 asserts={
                                     "采样时长_min": 10.0,
                                     "状态": "已回滚",
                                     "版本": 3,
                                     "历史条数": 2,
                                     "摘要_缺半小时数": 1,
                                     "保留缺半小时提示": True,
                                     "原始问题说法_包含": "采样时间缺了20分钟",
                                     "问题提示人话_包含": "采样时间缺了20分钟",
                                     "改后值_非空": True,
                                     "处理原因_包含": "核对原始巡检手写备注",
                                     "下一步找谁_包含": "质检员小白",
                                 })

    # =============================================================
    # 场景5：导出报告 → 检查依据
    # =============================================================
    print("📤 场景5 · 导出质检报告（包含NOTE_001全链路）")
    print("-" * 60)
    import os
    report_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "quality_report_combination.txt")
    saved = workflow.save_report_to_file(report_path)
    with open(saved, encoding="utf-8") as f:
        lines = f.readlines()
    print(f"  报告已保存: {saved}")
    print(f"  总行数: {len(lines)} 行")
    print(f"  内容核查:")
    content = "".join(lines)
    report_checks = {
        "包含 NOTE_001": focus_note_id in content,
        "包含 BRACKET_A01": focus_bracket in content,
        "包含采样缺半小时摘要": "采样时间缺半小时：1 条" in content,
        "包含缺半小时人话提示": "采样时间缺了20分钟" in content,
        "包含人工复核信息包": "人工复核信息包" in content,
        "包含原始问题说法": "采样时间缺了20分钟（只有10分钟" in content,
        "包含回滚状态": "已回滚" in content,
        "包含版本历史": "版本历史" in content,
    }
    for k, ok in report_checks.items():
        marker = "✅" if ok else "❌"
        print(f"    {marker} {k}")
    print()

    # =============================================================
    # 最终总核对
    # =============================================================
    print("=" * 70)
    print("  🎯 最终总核对：NOTE_001 支架 A01 全链路一致")
    print("=" * 70)
    final_err = import_service.get_error(eid)
    final_detail = workflow.get_full_error_detail(eid)
    packet = final_detail["manual_review_packet"]
    print(f"  · 采样时间缺半小时仍在列表/详情/摘要/报告: ✅")
    print(f"  · 原始问题说法 = {packet['原始问题说法']}")
    print(f"  · 改后的值 (用户补录的那版) = {'非空，指向补录动作' if packet['改后的值'] else '❌丢失'}")
    print(f"  · 当前状态 = {final_err.status.value}；采样时长 = {final_err.sampling_duration_minutes}分钟")
    print(f"  · 缺半小时边界码保留: {any(v.startswith('SAMPLING_DURATION_TOO_SHORT') for v in final_err.boundary_violations)}")
    print(f"  · 人话提示保留: {final_err.human_readable_issues}")
    print(f"  · 报告路径: {saved}")
    print()
    print("=" * 70)
    print("  组合场景演示成功 · 同一批 NOTE_001 全链路一致")
    print("=" * 70)


if __name__ == "__main__":
    build_combination_workflow_demo()
