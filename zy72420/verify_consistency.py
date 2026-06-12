#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""单独验证脚本：重点核对正常通过、已完成核销、待确认三者一致性"""

from sample_data import get_all_scenarios
from processor import DepositRefundProcessor
from models import RefundStatus

scenarios = get_all_scenarios()
processor = DepositRefundProcessor()

print("=" * 70)
print("  三者一致性专项验证：订单状态 / 核销单状态 / 历史末记录")
print("=" * 70)

all_passed = True

for name, order in scenarios.items():
    processor.step1_import_sign_in_photos(order)
    processor.step2_store_manager_review_tickets(order)
    if name == "场景四：签到照片与票务表矛盾":
        processor.resolve_conflict(order, "CON-001", confirm=True, manager_note="t1")
        processor.resolve_conflict(order, "CON-002", confirm=False, manager_note="t2")
        processor.resolve_conflict(order, "CON-003", confirm=True, manager_note="t3")
    processor.step3_update_verification(order)

    v = order.lesson_verifications[0]
    last = order.history_records[-1]

    passed = True
    status_icon = "✅"

    if order.status in [RefundStatus.NORMAL, RefundStatus.CONFIRMED, RefundStatus.SUPPLEMENTED]:
        if v.status != "已核销":
            passed = False
            status_icon = "❌"
        if "已完成核销" not in last.detail:
            passed = False
            status_icon = "❌"
    elif order.status in [RefundStatus.AREA_MISMATCH, RefundStatus.CALIBER_CONFLICT]:
        if v.status != "待确认":
            passed = False
            status_icon = "❌"
        if not ("待店长确认后核销" in last.detail or "待解决冲突后核销" in last.detail):
            passed = False
            status_icon = "❌"

    if not passed:
        all_passed = False

    print(f"\n{status_icon} {name}")
    print(f"    订单状态   : {order.status.value}")
    print(f"    核销单状态 : {v.status}")
    print(f"    历史末行   : ...{last.detail[-40:]}")

print("\n" + "=" * 70)
if all_passed:
    print("  🎉 全部场景通过一致性验证！")
else:
    print("  ❌ 存在不一致，请检查以上标红项")
print("=" * 70)
