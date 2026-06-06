from orchestra_seat_adjustment import OrchestraSeatAdjustmentSystem
from models import AdjustmentStatus, ChangeType


def demo_three_step_workflow():
    print("=" * 60)
    print("管弦乐椅位调整系统 - 三步完整流程演示")
    print("=" * 60)

    system = OrchestraSeatAdjustmentSystem()

    print("\n【第一步】调音师留言第一次导入")
    print("-" * 60)
    tuner_data = [
        {
            "row_number": 3,
            "seat_number": "A-05",
            "instrument": "第一小提琴",
            "track_remark": "音准正常，椅位微调左移5cm",
        },
        {
            "row_number": 7,
            "seat_number": "B-12",
            "instrument": "大提琴",
            "track_remark": "返工：上次调音音准偏差，需重新调整椅位",
        },
        {
            "row_number": 11,
            "seat_number": "C-03",
            "instrument": "长笛",
            "track_remark": "正常，无需调整",
        },
    ]

    batch, adjustments = system.import_tuner_messages(
        tuner_data,
        source_file="调音师留言_20260606.xlsx",
        imported_by="老周",
    )

    print(f"导入批次: {batch.id}")
    print(f"导入文件: {batch.source_file}")
    print(f"导入记录数: {batch.record_count}")
    print(f"是否重复: {batch.is_duplicate}")
    print()

    for i, adj in enumerate(adjustments):
        msg = system.tuner_messages[adj.tuner_message_id]
        print(f"  调整记录 {i+1}: {adj.id}")
        print(f"    原始行号: {msg.original_row_number}")
        print(f"    座位: {adj.seat_number} | 乐器: {adj.instrument}")
        print(f"    状态: {adj.status.value}")
        print(f"    备注: {adj.current_remark}")
        print(f"    是否返工: {msg.is_rework}")
        if msg.is_rework:
            print(f"    返工原因: {msg.rework_reason}")
        print()

    print("\n【第二步】琴行店长老周补看排练群接龙")
    print("-" * 60)
    signup_data = {
        "group_name": "周六管弦乐排练群",
        "date": "2026-06-07",
        "attendees": ["小王", "小李", "老张"],
        "seat_conflict_note": "B-12座位大提琴手请假，临时换人为老赵",
    }

    adjustment_with_rework = None
    for adj in adjustments:
        if adj.status == AdjustmentStatus.REWORK_REVIEW:
            adjustment_with_rework = adj
            break

    if adjustment_with_rework:
        updated = system.update_rehearsal_signup(
            adjustment_with_rework.id,
            signup_data,
            operator="老周",
        )
        print(f"更新记录: {updated.id}")
        print(f"排练群接龙信息已补充: {updated.rehearsal_group_signup}")
        print(f"注意：该记录状态仍为 {updated.status.value}（待版权运营复核）")

    print("\n老周修改一条备注（演示改前改后差别）:")
    normal_adj = None
    for adj in adjustments:
        if adj.status == AdjustmentStatus.PENDING:
            normal_adj = adj
            break

    if normal_adj:
        print(f"  修改前: {normal_adj.current_remark}")
        edited = system.manager_edit_remark(
            normal_adj.id,
            "音准正常，椅位微调左移5cm，排练当天提前15分钟到场确认",
            editor="老周",
            edit_reason="补充排练注意事项",
        )
        print(f"  修改后: {edited.current_remark}")

        print("\n  变更历史:")
        for h in system.get_change_history(edited.id):
            if h.change_type == ChangeType.MANUAL_EDIT:
                print(f"    [{h.changed_at}] {h.changed_by} 修改了 {h.field_name}")
                print(f"      旧值: {h.old_value}")
                print(f"      新值: {h.new_value}")
                print(f"      原因: {h.reason}")

    print("\n【第三步】排练变更记录更新")
    print("-" * 60)
    change_record = {
        "change_type": "人员调整",
        "original_seat": "B-12",
        "new_player": "老赵",
        "change_time": "2026-06-06 16:30",
        "approved_by": "老周",
    }

    if adjustment_with_rework:
        updated = system.update_rehearsal_change(
            adjustment_with_rework.id,
            change_record,
            operator="老周",
        )
        print(f"更新记录: {updated.id}")
        print(f"排练变更记录已更新: {updated.rehearsal_change_record}")
        print(f"状态仍为: {updated.status.value}（留给版权运营复核）")

    print("\n【版权运营复核返工记录】")
    print("-" * 60)
    if adjustment_with_rework:
        reviewed = system.copyright_review_rework(
            adjustment_with_rework.id,
            approve=True,
            reviewer="版权运营-张姐",
            review_comment="返工原因属实，调音师已重新调整，确认通过",
        )
        print(f"记录 {reviewed.id} 复核完成")
        print(f"状态变更: {AdjustmentStatus.REWORK_REVIEW.value} -> {reviewed.status.value}")

    print("\n【演示重复导入不翻倍】")
    print("-" * 60)
    stats_before = system.get_statistics()
    print(f"重复导入前 - 调整记录总数: {stats_before['total_adjustments']}")

    batch2, adjustments2 = system.import_tuner_messages(
        tuner_data,
        source_file="调音师留言_20260606_副本.xlsx",
        imported_by="老周",
    )
    stats_after = system.get_statistics()
    print(f"重复导入后 - 调整记录总数: {stats_after['total_adjustments']}")
    print(f"批次是否标记重复: {batch2.is_duplicate}")
    print(f"重复的原批次: {batch2.duplicate_of_batch}")
    assert stats_before["total_adjustments"] == stats_after["total_adjustments"], "重复导入导致数量翻倍！"
    print("✓ 验证通过：重复导入不会翻倍记录数量")

    print("\n【证据链查询演示】")
    print("-" * 60)
    if adjustment_with_rework:
        evidence = system.get_adjustment_with_evidence(adjustment_with_rework.id)
        print(f"查询记录: {adjustment_with_rework.id}")
        print(f"  原始行号: {evidence['evidence_summary']['original_row_number']}")
        print(f"  原始文件: {evidence['evidence_summary']['original_source_file']}")
        print(f"  人工修改次数: {evidence['evidence_summary']['manual_edit_count']}")
        print(f"  状态变更轨迹:")
        for old, new, time, who in evidence['evidence_summary']['status_changes']:
            print(f"    {time} - {who}: {old} -> {new}")

    print("\n【回滚功能演示】")
    print("-" * 60)
    if normal_adj:
        print(f"回滚前备注: {normal_adj.current_remark}")
        rolled_back = system.rollback_adjustment(
            normal_adj.id,
            operator="老周",
            rollback_reason="误操作，撤销修改",
        )
        print(f"回滚后备注: {rolled_back.current_remark}")
        print(f"回滚后状态: {rolled_back.status.value}")

    print("\n" + "=" * 60)
    print("流程演示完成！系统统计概览:")
    stats = system.get_statistics()
    for k, v in stats.items():
        print(f"  {k}: {v}")
    print("=" * 60)

    return system


if __name__ == "__main__":
    demo_three_step_workflow()
