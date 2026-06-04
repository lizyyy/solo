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


def create_sample_notes() -> List[ManualInspectionNote]:
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


def build_workflow_demo():
    print("=" * 60)
    print("  太阳跟踪支架误差 - 质检工作流演示")
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

    print("📋 第一步：导入手写巡检备注")
    print("-" * 40)
    notes = create_sample_notes()
    result1 = workflow.step_1_import_notes(notes)
    for msg in result1.human_messages:
        print(msg)
    print()
    print("工作进度：", workflow.get_workflow_progress()["human_progress"])
    print()
    print("⏰ 质检员小白开会前10分钟快速看：")
    print(workflow.get_quick_pending_summary())
    print()

    print("🔍 第二步：质检员补看安全阈值表")
    print("-" * 40)
    pending_errors = import_service.get_pending_review_errors()
    target_error = None
    for e in pending_errors:
        if any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in e.boundary_violations):
            target_error = e
            break

    if target_error:
        result2 = workflow.step_2_review_threshold(target_error.error_id)
        for msg in result2.human_messages:
            print(msg)
    print()
    print("工作进度：", workflow.get_workflow_progress()["human_progress"])
    print()

    print("📊 第三步：实验复盘图更新（3D展示）")
    print("-" * 40)
    result3 = workflow.step_3_update_chart(ViewMode.CHART_3D)
    for msg in result3.human_messages:
        print(msg)
    print()
    print("工作进度：", workflow.get_workflow_progress()["human_progress"])
    print()

    print("🔧 演示：修改一条备注，看历史")
    print("-" * 40)
    if target_error:
        note = import_service.get_note(target_error.note_id)
        if note and note.sampling_start_time and note.sampling_end_time:
            new_start = note.sampling_start_time
            new_end = note.sampling_end_time + timedelta(minutes=25)
            fix_result = workflow.reviewer_fix_duration_issue(
                error_id=target_error.error_id,
                new_sampling_start=new_start,
                new_sampling_end=new_end,
                reviewer="质检员小白",
                review_comment="经核对原始巡检记录，实际采样到8:35才结束，之前少记了25分钟",
            )
            for msg in fix_result.human_messages:
                print(msg)
    print()

    print("🔄 演示：重复导入同一批备注，数量不翻倍")
    print("-" * 40)
    notes_again = create_sample_notes()
    result_dup = workflow.step_1_import_notes(notes_again)
    for msg in result_dup.human_messages:
        print(msg)
    print()

    print("↩️  演示：回滚刚才的修改")
    print("-" * 40)
    if target_error:
        rollback_result = workflow.rollback_modification(
            target_error.error_id,
            reviewer="质检员小白",
        )
        for msg in rollback_result.human_messages:
            print(msg)
    print()

    print("👆 演示：点击3D图上的点，跳转原始备注")
    print("-" * 40)
    all_errors = import_service.get_all_errors()
    if all_errors:
        click_result = viz_service.click_data_point(all_errors[0].error_id, ViewMode.CHART_3D)
        print(click_result.human_message)
        print()
        print("可跳转的复核链接：")
        for link in click_result.review_links:
            print(f"  → [{link.target_type}] {link.context}")
    print()
    print("=" * 60)
    print("  演示完成")
    print("=" * 60)


if __name__ == "__main__":
    build_workflow_demo()
