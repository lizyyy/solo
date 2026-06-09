from datetime import datetime, timedelta
from typing import List

from models import (
    SafetyThreshold,
    ManualInspectionNote,
    SolarTrackingBracketError,
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


def create_main_batch_notes() -> List[ManualInspectionNote]:
    """主演示批次：NOTE_001~NOTE_004，贯穿修改/回滚/导出全链路"""
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


def create_separate_duplicate_batch_notes() -> List[ManualInspectionNote]:
    """重复导入演示专用批次：独立note_id，内容故意重复以演示去重"""
    base_date = datetime(2026, 6, 2)
    notes: List[ManualInspectionNote] = []

    notes.append(ManualInspectionNote(
        note_id="NOTE_DUP_01",
        inspection_date="2026-06-02",
        inspector="巡检员重复",
        bracket_id="BRACKET_DUP_01",
        azimuth_error=0.9,
        elevation_error=0.4,
        sampling_start_time=base_date.replace(hour=9, minute=0),
        sampling_end_time=base_date.replace(hour=9, minute=40),
        tracking_accuracy=96.0,
        raw_content="6月2日重复批次，DUP01号支架，正常数据",
    ))
    notes.append(ManualInspectionNote(
        note_id="NOTE_DUP_02",
        inspection_date="2026-06-02",
        inspector="巡检员重复",
        bracket_id="BRACKET_DUP_02",
        azimuth_error=1.1,
        elevation_error=0.6,
        sampling_start_time=base_date.replace(hour=10, minute=0),
        sampling_end_time=base_date.replace(hour=10, minute=35),
        tracking_accuracy=95.5,
        raw_content="6月2日重复批次，DUP02号支架，正常数据",
    ))
    return notes


def print_list_sync(workflow: QualityInspectionWorkflow, import_service: ImportService,
                     viz_service: VisualizationReviewService,
                     focus_error_id: str, focus_bracket: str, stage_tag: str):
    """打印列表/详情/摘要/历史 同步展示，强调聚焦的那条记录"""
    print()
    print("=" * 60)
    print(f"  📡 【{stage_tag}】数据一致性检查 · 聚焦 支架{focus_bracket}")
    print("=" * 60)

    print(f"\n①  待复核列表（共 {len(import_service.get_pending_review_errors())} 条）")
    print("-" * 50)
    for e in import_service.get_pending_review_errors():
        marker = "  ← 就是这条" if e.error_id == focus_error_id else ""
        duration_info = ""
        if e.sampling_duration_minutes is not None:
            duration_info = f" | 采样{e.sampling_duration_minutes:.0f}分钟"
        print(f"  · [{e.status.value}] 支架{e.bracket_id}{duration_info}{marker}")

    print(f"\n②  摘要概览")
    print("-" * 50)
    s = viz_service.get_visualization_summary()
    print(f"  {s['human_summary']}")

    print(f"\n③  全链路详情 · 支架{focus_bracket}")
    print("-" * 50)
    detail_lines = workflow.render_error_detail_for_humans(focus_error_id)
    for line in detail_lines:
        print(f"  {line}")

    print(f"\n④  3D图表数据点状态")
    print("-" * 50)
    chart = viz_service.prepare_chart_data(ViewMode.CHART_3D)
    for dp in chart["data_points"]:
        marker = "  ← 就是这条" if dp["error_id"] == focus_error_id else ""
        print(f"  · ({dp['x']:.1f}, {dp['y']:.1f}, {dp.get('z', 0):.1f}) "
              f"[{dp['status']}] {dp['label']}{marker}")
    print("=" * 60)
    print()


def build_workflow_demo():
    print("=" * 60)
    print("  太阳跟踪支架误差 - 质检工作流演示")
    print("  （同一份数据贯穿到底：导入→修改→同步→回滚→导出）")
    print("=" * 60)
    print()

    threshold = SafetyThreshold(
        azimuth_max=2.0,
        elevation_max=1.5,
        tracking_accuracy_min=95.0,
    )

    rule_engine = BoundaryRuleEngine(threshold)
    import_service = ImportService(rule_engine)
    viz_service = VisualizationReviewService(import_service, threshold)
    workflow = QualityInspectionWorkflow(rule_engine, import_service, viz_service)

    # ===============================================================
    # 场景A：第一步 导入手写巡检备注（主批次）
    # ===============================================================
    print("📋 场景A：第一步 导入手写巡检备注（主批次 NOTE_001~NOTE_004）")
    print("-" * 50)
    notes_main = create_main_batch_notes()
    result1 = workflow.step_1_import_notes(notes_main)
    for msg in result1.human_messages:
        print(msg)

    pending_errors = import_service.get_pending_review_errors()
    target_error = next(
        e for e in pending_errors
        if any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in e.boundary_violations)
    )
    focus_error_id = target_error.error_id
    focus_bracket = target_error.bracket_id
    print(f"\n🎯 全程聚焦记录：{focus_bracket}（{focus_error_id}）")

    # 第一次一致性检查：刚导入后
    print_list_sync(workflow, import_service, viz_service,
                    focus_error_id, focus_bracket, stage_tag="导入后")

    print("⏰ 质检员小白开会前10分钟快速看：")
    print(workflow.get_quick_pending_summary())
    print()

    # ===============================================================
    # 场景B：第二步 补看安全阈值表
    # ===============================================================
    print("🔍 场景B：第二步 质检员补看安全阈值表（聚焦支架A01）")
    print("-" * 50)
    result2 = workflow.step_2_review_threshold(focus_error_id)
    for msg in result2.human_messages:
        print(msg)
    print("工作进度：", workflow.get_workflow_progress()["human_progress"])
    print()

    # ===============================================================
    # 场景C：第三步 实验复盘图更新（3D展示）
    # ===============================================================
    print("📊 场景C：第三步 实验复盘图更新（3D展示）")
    print("-" * 50)
    result3 = workflow.step_3_update_chart(ViewMode.CHART_3D)
    for msg in result3.human_messages:
        print(msg)
    print("工作进度：", workflow.get_workflow_progress()["human_progress"])

    # 点击图表数据点，追溯回原始备注/阈值表
    print(f"\n👆 点3D图上的{focus_bracket}数据点：")
    click_result = viz_service.click_data_point(focus_error_id, ViewMode.CHART_3D)
    print(f"   {click_result.human_message}")
    print(f"   可跳转复核链接：")
    for link in click_result.review_links:
        print(f"     → [{link.target_type}] {link.context}")
    print()

    # ===============================================================
    # 场景D：修改补全采样时间（关键！必须基于同一份focus_error_id）
    # ===============================================================
    print("🔧 场景D：修改补全采样时间（聚焦记录全链路同步）")
    print("-" * 50)
    note = import_service.get_note(target_error.note_id)
    assert note and note.sampling_start_time and note.sampling_end_time

    new_start = note.sampling_start_time
    new_end = note.sampling_end_time + timedelta(minutes=25)  # 10分钟 → 35分钟
    fix_result = workflow.reviewer_fix_duration_issue(
        error_id=focus_error_id,
        new_sampling_start=new_start,
        new_sampling_end=new_end,
        reviewer="质检员小白",
        review_comment="经核对原始巡检记录，实际采样到8:35才结束，之前少记了25分钟",
    )
    for msg in fix_result.human_messages:
        print(msg)

    # 第二次一致性检查：修改后（列表、详情、摘要、3D图 必须全同步）
    print_list_sync(workflow, import_service, viz_service,
                    focus_error_id, focus_bracket, stage_tag="修改补全后")

    # ===============================================================
    # 场景E：回滚刚才的修改（基于同一份focus_error_id）
    # ===============================================================
    print("↩️  场景E：回滚刚才的修改（同一份记录）")
    print("-" * 50)
    rollback_result = workflow.rollback_modification(
        focus_error_id,
        reviewer="质检员小白",
    )
    for msg in rollback_result.human_messages:
        print(msg)

    # 第三次一致性检查：回滚后（列表、详情、摘要、3D图 必须全同步）
    print_list_sync(workflow, import_service, viz_service,
                    focus_error_id, focus_bracket, stage_tag="回滚后")

    # ===============================================================
    # 场景F：导出质检报告（包含同一条记录完整历史）
    # ===============================================================
    print("📤 场景F：导出质检报告（包含全链路历史）")
    print("-" * 50)
    import os
    report_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "quality_report_demo.txt"
    )
    saved_path = workflow.save_report_to_file(report_path, error_ids=[focus_error_id])
    print(f"✅ 质检报告已导出：{saved_path}")
    report = workflow.export_report(error_ids=[focus_error_id])
    print(f"   报告摘要：{report['record_count']}条记录，"
          f"其中采样缺半小时{report['summary']['duration_issues_count']}条")
    print(f"   报告前20行预览：")
    for line in report["lines"][:20]:
        print(f"   | {line}")
    print()

    # ===============================================================
    # 场景G：单独演示 重复导入不翻倍（独立批次 NOTE_DUP_01~02）
    # ===============================================================
    print("🔄 场景G：重复导入同一批手写巡检备注（独立批次演示，不影响上面的主数据）")
    print("-" * 50)
    dup_batch_1 = create_separate_duplicate_batch_notes()
    count_before = len(import_service.get_all_errors())
    r_first = workflow.step_1_import_notes(dup_batch_1)
    count_after_first = len(import_service.get_all_errors())
    print(f"第1次导入独立批次：新增 {count_after_first - count_before} 条误差记录 "
          f"（共{count_after_first}条）")

    dup_batch_2 = create_separate_duplicate_batch_notes()
    r_second = workflow.step_1_import_notes(dup_batch_2)
    count_after_second = len(import_service.get_all_errors())
    print(f"第2次导入同一批（独立批次）：新增 {count_after_second - count_after_first} 条误差记录 "
          f"（共{count_after_second}条，不翻倍！）")
    for msg in r_second.human_messages:
        if "数量不会翻倍" in msg or "重复" in msg:
            print(f"   {msg}")

    # ===============================================================
    # 最终核对：主数据（支架A01）没被独立批次影响
    # ===============================================================
    print()
    print("✅ 最终核对：主数据（支架A01）未被独立批次干扰")
    print("-" * 50)
    final_error = import_service.get_error(focus_error_id)
    if final_error:
        print(f"   支架{final_error.bracket_id}："
              f"状态={final_error.status.value}，"
              f"采样时长={final_error.sampling_duration_minutes}分钟，"
              f"版本=v{final_error.version}，"
              f"历史条数={len(import_service.get_error_history(focus_error_id))}")
        print(f"   人工复核信息包：")
        detail = workflow.get_full_error_detail(focus_error_id)
        for k, v in detail["manual_review_packet"].items():
            print(f"     · {k}：{v}")
    print()
    print("=" * 60)
    print("  演示完成 · 同一条记录全链路一致")
    print("=" * 60)


if __name__ == "__main__":
    build_workflow_demo()
