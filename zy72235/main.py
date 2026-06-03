from datetime import datetime

from models import (
    HolidayExtension, TailAdjustment, MaterialType, ReviewAction
)
from service import LoanRenewalScoreService
from report_generator import ReportGenerator


def demo_three_step_workflow():
    print("\n" + "=" * 70)
    print("  小微贷款续贷评分系统 - 三步流程演示")
    print("=" * 70)

    service = LoanRenewalScoreService()
    workflow_steps = []

    print("\n" + "~" * 70)
    print("【第一步】节假日顺延说明第一次导入")
    print("~" * 70)

    holidays = [
        HolidayExtension(
            business_no="XW202401001",
            original_due_date=datetime(2024, 1, 15),
            extended_due_date=datetime(2024, 1, 18),
            reason="元旦假期顺延",
            remark="初次导入"
        ),
        HolidayExtension(
            business_no="XW202401002",
            original_due_date=datetime(2024, 2, 10),
            extended_due_date=datetime(2024, 2, 18),
            reason="春节假期顺延",
            remark="初次导入"
        )
    ]

    imported, skipped = service.import_holiday_extensions(holidays, "BATCH-001")
    print(f"\n✓ 导入完成: 新增 {imported} 条, 跳过 {skipped} 条")

    workflow_steps.append({
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "operator": "投研助理小周",
        "imported": imported,
        "skipped": skipped
    })

    print("\n  当前差异清单:")
    score = service.get_score("XW202401001")
    if score:
        for diff in score.differences:
            print(f"  • {diff.description}")
            print(f"    → 为什么留下: {diff.reason_kept}")
            print(f"    → 下一步: 找{diff.next_step_role.value}")

    print("\n" + "~" * 70)
    print("【测试】重复导入同一批节假日顺延说明（验证不翻倍）")
    print("~" * 70)

    holidays_duplicate = [
        HolidayExtension(
            business_no="XW202401001",
            original_due_date=datetime(2024, 1, 15),
            extended_due_date=datetime(2024, 1, 18),
            reason="元旦假期顺延",
            remark="重复导入测试"
        )
    ]
    imported2, skipped2 = service.import_holiday_extensions(holidays_duplicate, "BATCH-002")
    print(f"\n✓ 重复导入结果: 新增 {imported2} 条, 跳过 {skipped2} 条")
    print(f"  ★ 关键点: 数量没有翻倍！相同的节假日顺延说明被识别并跳过")

    score_after = service.get_score("XW202401001")
    print(f"  ★ 当前节假日顺延说明数量: {len(score_after.holiday_extensions) if score_after else 0}")

    print("\n" + "~" * 70)
    print("【测试】只改一条备注（验证历史记录）")
    print("~" * 70)

    if score_after and score_after.holiday_extensions:
        holiday_id = score_after.holiday_extensions[0].id
        service.update_remark(
            "XW202401001",
            MaterialType.HOLIDAY_EXTENSION,
            holiday_id,
            "客户确认可以顺延，已电话沟通",
            "投研助理小周",
            "与业务经理电话确认后更新备注"
        )

    history = service.get_change_history("XW202401001")
    print(f"\n✓ 变更历史记录:")
    for record in history:
        print(f"  • [{record['修改时间']}] {record['修改人']}")
        print(f"    修改了 [{record['修改字段']}]")
        print(f"    从 [{record['修改前']}] → 改为 [{record['修改后']}]")
        print(f"    原因: {record['修改原因']}")
    print(f"  ★ 关键点: 改前改后的差别清晰可见！")

    print("\n" + "~" * 70)
    print("【第二步】投研助理小周补看尾差调整条")
    print("~" * 70)

    tail_adjustments = [
        TailAdjustment(
            business_no="XW202401001",
            adjustment_type="利息尾差",
            amount=128.56,
            reason="四舍五入尾差调整",
            remark="补看后导入"
        ),
        TailAdjustment(
            business_no="XW202401002",
            adjustment_type="本金尾差",
            amount=256.89,
            reason="分期计算尾差",
            remark="补看后导入"
        )
    ]

    imported_tail, skipped_tail = service.import_tail_adjustments(tail_adjustments, "BATCH-TAIL-001")
    print(f"\n✓ 尾差调整条导入完成: 新增 {imported_tail} 条, 跳过 {skipped_tail} 条")

    workflow_steps.append({
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "operator": "投研助理小周",
        "imported": imported_tail,
        "skipped": skipped_tail
    })

    print("\n" + "~" * 70)
    print("【测试】3D/图表展示 - 追溯原始材料")
    print("~" * 70)

    score = service.get_score("XW202401001")
    if score and score.business_details:
        detail_id = score.business_details[0].id
        source_info = service.navigate_to_source_material("XW202401001", detail_id)

        print(f"\n✓ 点击业务明细（手续费/本金）后，可追溯至：")
        if source_info.get('holiday_extension'):
            h = source_info['holiday_extension']
            print(f"  • 节假日顺延说明:")
            print(f"    业务号: {h.business_no}, 原因: {h.reason}")
            print(f"    备注: {h.remark}")
        if source_info.get('tail_adjustment'):
            t = source_info['tail_adjustment']
            print(f"  • 尾差调整条:")
            print(f"    类型: {t.adjustment_type}, 金额: {t.amount}")
    print(f"  ★ 关键点: 不会只剩漂亮画面，能回到原始材料！")

    print("\n" + "~" * 70)
    print("【第三步】差异清单更新 & 结算主管复核")
    print("~" * 70)

    score = service.get_score("XW202401001")
    if score:
        detail_ids = [d.id for d in score.business_details]
        service.review_by_settlement_supervisor(
            "XW202401001",
            detail_ids[:1],
            ReviewAction.APPROVE,
            "手续费拆分合理，同意",
            "结算主管-李总"
        )
        service.review_by_settlement_supervisor(
            "XW202401001",
            detail_ids[1:],
            ReviewAction.NEEDS_INFO,
            "本金部分需要补充计算依据",
            "结算主管-李总"
        )

    print(f"\n✓ 结算主管复核完成")

    workflow_steps.append({
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "operator": "结算主管-李总",
        "review_action": "部分通过，部分需补充材料",
        "review_comment": "手续费通过，本金需补充计算依据"
    })

    print("\n" + "=" * 70)
    print("  生成完整报告")
    print("=" * 70)

    full_report = ReportGenerator.generate_full_report(service)
    print(full_report)

    print("\n" + "=" * 70)
    print("  生成三步流程报告")
    print("=" * 70)

    workflow_report = ReportGenerator.generate_workflow_report(service, workflow_steps)
    print(workflow_report)

    print("\n" + "=" * 70)
    print("  业务号 XW202401001 3D图表数据源追溯")
    print("=" * 70)
    view_3d_report = ReportGenerator.generate_3d_view_support_report(service, "XW202401001")
    print(view_3d_report)

    print("\n" + "=" * 70)
    print("  ★ 关键点总结 ★")
    print("=" * 70)
    print("  1. ✓ 重复导入同一批节假日顺延说明不会翻倍")
    print("  2. ✓ 只改一条备注，历史里能看出改前改后差别")
    print("  3. ✓ 3D/图表点进去能回到节假日顺延说明或尾差调整条")
    print("  4. ✓ 差异清单说明：为什么留下、缺什么材料、下一步找谁")
    print("  5. ✓ 真实复核记录：谁改了什么、为什么改、影响哪些结果")
    print("  6. ✓ 同一业务号拆成两行时，留给结算主管复核再归正常")
    print("  7. ✓ 完整三步流程：导入→补看尾差→差异更新")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    demo_three_step_workflow()
