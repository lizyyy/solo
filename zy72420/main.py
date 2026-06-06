#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
乐器租赁押金退款系统 - 主程序入口
演示三种场景的处理结果差异
"""

from sample_data import get_all_scenarios
from processor import DepositRefundProcessor


def print_separator(title=""):
    print("\n" + "=" * 80)
    if title:
        print(f"  {title}")
        print("=" * 80)


def print_scenario_header(scenario_name, order):
    print_separator()
    print(f"  【{scenario_name}】")
    print(f"  退款单号: {order.refund_id}  |  学员: {order.student_name}  |  乐器: {order.instrument_type}")
    print(f"  押金金额: {order.deposit_amount}元  |  授权城市: {order.authorized_cities}")
    print(f"  签到照片: {len(order.sign_in_photos)}张  |  票务记录: {len(order.ticket_records)}条")


def print_step_result(step_num, step_name, result):
    print(f"\n  ▶ 第{step_num}步：{step_name}")
    print(f"     {result}")


def print_conflicts(order):
    if order.conflicts:
        print(f"\n  ⚠  冲突证据列表（共{len(order.conflicts)}处，请店长老周选择确认或驳回）：")
        for c in order.conflicts:
            print(f"     - 冲突{c.conflict_id}【{c.field_name}】")
            print(f"       照片({c.photo_source}): {c.photo_value}")
            print(f"       票务({c.ticket_source}): {c.ticket_value}")
            print(f"       说明: {c.description}")
    else:
        print("\n  ✓ 无冲突")


def print_history(order):
    print(f"\n  📋 历史记录（共{len(order.history_records)}条）：")
    for h in order.history_records:
        source = f" [{h.data_source.value}]" if h.data_source else ""
        print(f"     [{h.record_id}] {h.timestamp.strftime('%H:%M:%S')} | {h.operator}{source}")
        print(f"         操作: {h.action}")
        print(f"         详情: {h.detail}")


def print_verification(order):
    if order.lesson_verifications:
        v = order.lesson_verifications[0]
        print(f"\n  📄 课时核销单：")
        print(f"     核销单号: {v.verification_id}")
        print(f"     核销课时: {v.verified_count}节")
        print(f"     总课时费: {v.total_fee}元")
        print(f"     应退押金: {v.deposit_refund_amount}元")
        print(f"     核销状态: {v.status}")
        print(f"     核销时间: {v.verification_time.strftime('%Y-%m-%d %H:%M:%S') if v.verification_time else 'N/A'}")

        if v.params:
            print(f"\n     🔧 专业计算参数（版本{v.params[0].param_version}）：")
            for p in v.params:
                print(f"       - {p.param_name}: {p.param_value}")
                print(f"         取舍理由: {p.trade_off_reason}")


def print_final_status(order):
    status_icon = {
        "正常通过": "✓",
        "授权地区待确认": "⚠",
        "口径冲突待确认": "✗",
        "补录完成": "📎",
        "店长已确认": "✓",
        "店长已驳回": "✗",
        "待店长复核": "⏳"
    }
    icon = status_icon.get(order.status.value, "?")
    print(f"\n  🏁 最终状态: {icon} {order.status.value}")
    print(f"     当前步骤: 第{order.current_step}步/共3步")


def run_normal_scenario():
    """场景一：正常顺利记录"""
    scenarios = get_all_scenarios()
    order = scenarios["场景一：正常顺利记录"]
    processor = DepositRefundProcessor()

    print_scenario_header("场景一：正常顺利记录", order)

    print_step_result(1, "课时签到照片第一次导入",
                      processor.step1_import_sign_in_photos(order))

    print_step_result(2, "琴行店长老周补看票务导出表",
                      processor.step2_store_manager_review_tickets(order))

    print_step_result(3, "课时核销单更新",
                      processor.step3_update_verification(order))

    print_conflicts(order)
    print_verification(order)
    print_history(order)
    print_final_status(order)


def run_area_mismatch_scenario():
    """场景二：授权地区少写了一个城市"""
    scenarios = get_all_scenarios()
    order = scenarios["场景二：授权地区少写了一个城市"]
    processor = DepositRefundProcessor()

    print_scenario_header("场景二：授权地区少写了一个城市", order)
    print(f"  注意：签到照片中有「深圳」，但授权城市列表漏掉了深圳")

    print_step_result(1, "课时签到照片第一次导入",
                      processor.step1_import_sign_in_photos(order))
    print(f"     → 关键：检测到深圳不在授权列表中，标记为【授权地区待确认】")
    print(f"     → 关键：未自动归一化，留给店长老周复核")

    print_step_result(2, "琴行店长老周补看票务导出表",
                      processor.step2_store_manager_review_tickets(order))

    print_step_result(3, "课时核销单更新",
                      processor.step3_update_verification(order))
    print(f"     → 核销单状态为「待确认」，等店长确认地区问题后再完成")

    print_conflicts(order)
    print_verification(order)
    print_history(order)
    print_final_status(order)


def run_old_caliber_scenario():
    """场景三：票务导出表补来的旧口径"""
    scenarios = get_all_scenarios()
    order = scenarios["场景三：票务导出表补来的旧口径"]
    processor = DepositRefundProcessor()

    print_scenario_header("场景三：票务导出表补来的旧口径", order)
    old_count = sum(1 for t in order.ticket_records if t.is_old_caliber)
    print(f"  注意：票务记录中有{old_count}条旧口径(v1.0)补录记录")

    print_step_result(1, "课时签到照片第一次导入",
                      processor.step1_import_sign_in_photos(order))

    print_step_result(2, "琴行店长老周补看票务导出表",
                      processor.step2_store_manager_review_tickets(order))
    print(f"     → 识别到旧口径补录记录，标记来源追溯")

    print_step_result(3, "课时核销单更新",
                      processor.step3_update_verification(order))
    print(f"     → 旧口径记录一并纳入核销范围，标注【补录完成】")

    print_conflicts(order)
    print_verification(order)
    print_history(order)
    print_final_status(order)


def run_conflict_scenario():
    """场景四：签到照片与票务导出表矛盾"""
    scenarios = get_all_scenarios()
    order = scenarios["场景四：签到照片与票务表矛盾"]
    processor = DepositRefundProcessor()

    print_scenario_header("场景四：签到照片与票务导出表矛盾", order)
    print("  注意：此场景演示冲突检测 - 列出证据，不替业务自动拍板")

    print_step_result(1, "课时签到照片第一次导入",
                      processor.step1_import_sign_in_photos(order))

    print_step_result(2, "琴行店长老周补看票务导出表",
                      processor.step2_store_manager_review_tickets(order))

    print_conflicts(order)
    print("\n  🤝 请店长老周选择：")
    print("     1. 确认采纳照片数据")
    print("     2. 驳回，采纳票务数据")

    print("\n  👉 模拟店长操作：确认冲突CON-001，驳回CON-002")
    print(processor.resolve_conflict(order, "CON-001", confirm=True,
                                     manager_note="照片有学员签字，以照片为准"))
    print(processor.resolve_conflict(order, "CON-002", confirm=False,
                                     manager_note="日期录入错误，票务系统日期正确"))

    print_conflicts(order)

    print_step_result(3, "课时核销单更新",
                      processor.step3_update_verification(order))

    print_verification(order)
    print_history(order)
    print_final_status(order)


def print_summary_comparison():
    """打印三种场景的结果对比总结"""
    print_separator("三种场景处理结果对比总结")
    print("\n  ┌──────────────────────┬──────────────────┬──────────────────────────────────────┐")
    print("  │       场景           │   最终状态       │          关键差异点                  │")
    print("  ├──────────────────────┼──────────────────┼──────────────────────────────────────┤")
    print("  │ 1. 正常顺利记录      │ 正常通过         │ 所有数据一致，三步流程顺畅走完       │")
    print("  │ 2. 授权地区缺城市    │ 授权地区待确认   │ 检测到异常但不自动归一化，留店长复核 │")
    print("  │ 3. 旧口径补录        │ 补录完成         │ 识别票务表旧口径，追溯来源并入核销   │")
    print("  │ 4. 数据矛盾          │ 口径冲突待确认   │ 列出冲突证据，店长选确认/驳回        │")
    print("  └──────────────────────┴──────────────────┴──────────────────────────────────────┘")

    print("\n  📌 核心设计要点：")
    print("     1. 授权地区少写城市 → 不急着归正常，留给店长复核 ✓")
    print("     2. 照片与票务矛盾 → 列出冲突证据，不自动拍板 ✓")
    print("     3. 专业计算参数 → 版本号和取舍理由附在核销单旁 ✓")
    print("     4. 三步流程完整 → 导入签到→店长看票务→更新核销单 ✓")
    print("     5. 历史记录可追溯 → 每步操作都留痕 ✓")
    print("     6. 旧口径补录 → 来源清晰标记 ✓")


def main():
    print("\n" + "🎸" * 20)
    print("  乐器租赁押金退款系统 - 多场景演示")
    print("  重点验证：课时核销单 ↔ 历史记录 一致性")
    print("🎸" * 20)

    run_normal_scenario()
    run_area_mismatch_scenario()
    run_old_caliber_scenario()
    run_conflict_scenario()

    print_summary_comparison()

    print_separator()
    print("  演示完成！请检查上述四种场景的处理结果是否符合预期。")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
