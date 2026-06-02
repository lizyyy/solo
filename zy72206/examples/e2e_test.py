#!/usr/bin/env python3
import os
import shutil
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from forex_settlement import (
    SettlementRepository,
    SettlementStatus,
    ProcessingStep,
    BoundaryRules,
)


def run_e2e_test():
    print("=" * 60)
    print("外汇远期交割排程 - 端到端测试")
    print("=" * 60)

    test_data_dir = "./test_data"
    if os.path.exists(test_data_dir):
        shutil.rmtree(test_data_dir)

    repo = SettlementRepository(data_dir=test_data_dir)
    print("\n[测试1] 创建交割记录")
    print("-" * 60)

    record1 = repo.state_machine.create_record(
        original_row_number=2,
        trade_date="2024-01-15",
        settlement_date="2024-01-17",
        currency_pair="USD/CNY",
        amount=100000.00,
        rate=7.1850,
        remark="正常交割",
        operator="阿芬",
    )
    repo.add_record(record1)
    print(f"✓ 创建正常记录: {record1.id[:8]}...")

    record2 = repo.state_machine.create_record(
        original_row_number=4,
        trade_date="2024-01-15",
        settlement_date="2024-01-17",
        currency_pair="USD/CNY",
        amount=0.00,
        rate=7.1850,
        remark="已冲正 - 客户取消交易",
        operator="阿芬",
    )
    repo.add_record(record2)
    print(f"✓ 创建冲正记录: {record2.id[:8]}...")

    assert record2.has_zero_amount_with_reversal == True
    assert record2.risk_review_required == True
    assert record2.status == SettlementStatus.PENDING_RISK_REVIEW
    print("✓ 冲正记录正确标记了风控复核标志")

    print("\n[测试2] 验证边界规则")
    print("-" * 60)

    is_reversal = BoundaryRules.is_zero_amount_with_reversal(record2)
    assert is_reversal == True
    print(f"✓ BoundaryRules.is_zero_amount_with_reversal: {is_reversal}")

    should_escalate = BoundaryRules.should_escalate_to_risk(record2)
    assert should_escalate == True
    print(f"✓ BoundaryRules.should_escalate_to_risk: {should_escalate}")

    print("\n[测试3] 三步流程推进 (正常记录)")
    print("-" * 60)

    print(f"  初始状态: {record1.current_step}, {record1.status}")

    record1, ok = repo.state_machine.advance_step(record1, "阿芬")
    assert ok == True
    assert record1.current_step == ProcessingStep.STEP_2_TAX_REVIEW
    print(f"✓ 推进至第二步: {record1.current_step}")

    record1, ok = repo.state_machine.update_tax_rate(
        record1, 0.06, "增值税率6%，取自税务报告2024-01", "阿芬"
    )
    assert ok == True
    print(f"✓ 阿芬补充税率备注: {record1.tax_rate_remark}")

    record1, ok = repo.state_machine.advance_step(record1, "阿芬")
    assert ok == True
    assert record1.current_step == ProcessingStep.STEP_3_SUMMARY
    print(f"✓ 推进至第三步: {record1.current_step}")

    record1, ok = repo.state_machine.update_summary(
        record1, "2024年1月第一笔外汇交割", "张经理"
    )
    assert ok == True
    assert record1.status == SettlementStatus.SUMMARY_UPDATED
    print(f"✓ 负责人更新摘要: {record1.status}")

    print("\n[测试4] 冲正记录阻塞验证")
    print("-" * 60)

    print(f"  初始状态: {record2.current_step}, {record2.status}")

    record2, ok = repo.state_machine.advance_step(record2, "阿芬")
    assert ok == False
    print(f"✓ 冲正记录无法自动推进 (正确阻塞)")

    blocking_info = repo.state_machine.get_blocking_info(record2)
    assert blocking_info["is_blocked"] == True
    print(f"✓ 阻塞原因: {blocking_info['block_reason']}")
    print(f"✓ 下一步: {blocking_info['next_action']}")

    print("\n[测试5] 风控复核流程")
    print("-" * 60)

    record2, ok = repo.state_machine.risk_review(
        record2, True, "冲正记录已核实，原始单据齐全", "风控老王"
    )
    assert ok == True
    assert record2.status == SettlementStatus.RISK_APPROVED
    assert record2.risk_review_required == False
    print(f"✓ 风控复核通过: {record2.status}")

    record2, ok = repo.state_machine.advance_step(record2, "阿芬")
    assert ok == True
    print(f"✓ 风控通过后可以推进: {record2.current_step}")

    print("\n[测试6] 数据一致性验证")
    print("-" * 60)

    export_data = repo.get_records_for_export()
    display_data = repo.get_records_for_display()
    api_data = repo.get_record_for_api(record1.id)

    assert export_data[0]["amount"] == display_data[0]["amount"]
    print("✓ 导出数据 = 展示数据 (金额一致)")

    assert export_data[0]["status"] == display_data[0]["status"]
    print("✓ 导出数据 = 展示数据 (状态一致)")

    assert api_data["amount"] == record1.amount
    print("✓ API数据 = 原始数据 (金额一致)")

    print("\n[测试7] 审计日志验证")
    print("-" * 60)

    logs = repo.get_audit_logs(record2.id)
    assert len(logs) >= 2
    print(f"✓ 记录 {record2.id[:8]}... 有 {len(logs)} 条审计日志")

    for log in logs:
        print(f"  - {log.action}: {log.note}")

    print("\n[测试8] 数据持久化验证")
    print("-" * 60)

    repo2 = SettlementRepository(data_dir=test_data_dir)
    loaded_record = repo2.get_record(record1.id)
    assert loaded_record is not None
    assert loaded_record.amount == record1.amount
    print("✓ 数据持久化成功，重新加载后数据一致")

    print("\n" + "=" * 60)
    print("✓ 所有测试通过!")
    print("=" * 60)

    shutil.rmtree(test_data_dir)
    return True


if __name__ == "__main__":
    try:
        run_e2e_test()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
