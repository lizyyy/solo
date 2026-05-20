#!/usr/bin/env python3
"""测试对账功能"""

import sys
sys.path.insert(0, '.')

from datetime import date
from services.reconciliation_service import reconciliation_engine, review_service
from models.reconciliation import ReviewAction


def test_full_reconciliation():
    print("\n执行对账...")
    result = reconciliation_engine.run_reconciliation(
        name="2024年1月对账",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31)
    )

    print(f"对账任务ID: {result.id}")
    print(f"总库存数: {result.total_inventory_count}")
    print(f"总消耗数: {result.total_consumption_count}")
    print(f"总召回数: {result.total_recall_count}")
    print(f"差异总数: {result.discrepancy_count}")
    print(f"待复核差异: {result.unresolved_discrepancy_count}")
    print(f"召回批号: {result.recalled_batch_count}")
    print(f"近效期预警: {result.near_expiry_count}")
    print(f"已过期数: {result.expired_count}")
    print(f"调拨记录: {result.transfer_count}")

    return result


def test_discrepancy_explanation(result):
    print("\n" + "=" * 50)
    print("差异详情与解释:")
    print("=" * 50)

    for i, disc in enumerate(result.discrepancies, 1):
        print(f"\n[{i}] {disc.type}")
        print(f"    批号: {disc.batch_number}")
        print(f"    门店: {disc.store_name}")
        print(f"    物料: {disc.material_name}")
        print(f"    描述: {disc.description}")
        print(f"    解释: {disc.explanation}")
        print(f"    状态: {'已复核' if disc.is_reviewed else '待复核'}")


def test_review_process(result):
    print("\n" + "=" * 50)
    print("测试复核流程:")
    print("=" * 50)

    if result.discrepancies:
        disc = result.discrepancies[0]
        print(f"\n复核差异: {disc.batch_number}")
        print(f"操作: 确认差异")

        success, message = review_service.review_discrepancy(
            reconciliation_id=result.id,
            discrepancy_id=disc.id,
            action=ReviewAction.CONFIRM,
            notes="已确认该批次需要召回处理",
            reviewed_by="管理员"
        )

        print(f"复核结果: {message}")
        return success
    return True


if __name__ == '__main__':
    print("=" * 50)
    print("对账功能测试")
    print("=" * 50)

    result = test_full_reconciliation()
    test_discrepancy_explanation(result)
    test_review_process(result)

    print("\n" + "=" * 50)
    print("对账测试完成!")
    print("=" * 50)
