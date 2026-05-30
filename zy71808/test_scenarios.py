from datetime import datetime, timedelta
import sys

from models import (
    AssetPool, CreditLine, FreezeRecord, DataSourceStatus,
    ConclusionStatus, ChangeType, RiskFlag, UserFriendlyError
)
from repository import DataRepository
from gap_calculator import PressureGapCalculator


def setup_test_data(repo: DataRepository) -> str:
    pool = AssetPool(
        pool_id="POOL001",
        pool_name="2024年对公信贷资产池",
        total_asset=5000000000,
        total_liability=600000000
    )
    repo.save_asset_pool(pool)

    credits = [
        CreditLine(
            credit_id="CR001",
            customer_id="CUST001",
            customer_name="甲公司",
            total_amount=200000000,
            used_amount=150000000,
            available_amount=50000000,
            effective_date=datetime(2024, 1, 1),
            expiry_date=datetime(2025, 12, 31)
        ),
        CreditLine(
            credit_id="CR002",
            customer_id="CUST002",
            customer_name="乙公司",
            total_amount=300000000,
            used_amount=180000000,
            available_amount=120000000,
            effective_date=datetime(2024, 3, 15),
            expiry_date=datetime(2025, 3, 14)
        ),
        CreditLine(
            credit_id="CR003",
            customer_id="CUST003",
            customer_name="丙公司",
            total_amount=150000000,
            used_amount=100000000,
            available_amount=50000000,
            effective_date=datetime(2024, 6, 1),
            expiry_date=datetime(2025, 5, 31)
        ),
        CreditLine(
            credit_id="CR004",
            customer_id="CUST004",
            customer_name="丁公司",
            total_amount=250000000,
            used_amount=160000000,
            available_amount=90000000,
            effective_date=datetime(2024, 2, 1),
            expiry_date=datetime(2026, 1, 31)
        )
    ]
    for c in credits:
        repo.save_credit_line(c)

    return pool.pool_id


def print_separator(title: str) -> None:
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70 + "\n")


def test_scenario_1_normal_calculation():
    """场景1：正常计算，无特殊情况"""
    print_separator("场景1：正常压力缺口计算（无特殊情况）")

    repo = DataRepository()
    pool_id = setup_test_data(repo)
    calc = PressureGapCalculator(repo)
    calc.set_operator("张经理")

    report_date = datetime(2024, 10, 15)
    calc.upload_review_report(
        asset_pool_id=pool_id,
        report_date=report_date,
        content="日常复核，资产质量稳定",
        total_asset=1000000000,
        total_liability=600000000,
        pressure_gap=290000000,
        conclusion="压力缺口处于安全区间",
        reviewer="李复核",
        data_source=DataSourceStatus.ORIGINAL
    )

    result = calc.calculate_gap(pool_id, report_date)
    print(calc.format_result_for_display(result))

    assert result.status == ConclusionStatus.NORMAL
    assert abs(result.pressure_gap_ratio - 0.058) < 0.001
    assert len(result.pending_confirmations) == 0
    print("✅ 测试通过：正常计算结果正确")


def test_scenario_2_freeze_not_released():
    """场景2：冻结额度未释放"""
    print_separator("场景2：冻结额度未释放（应标记为待确认）")

    repo = DataRepository()
    pool_id = setup_test_data(repo)
    calc = PressureGapCalculator(repo)
    calc.set_operator("王运营")

    freeze1 = FreezeRecord(
        freeze_id="FRZ001",
        credit_id="CR001",
        amount=30000000,
        freeze_reason="涉及诉讼保全",
        freeze_date=datetime(2024, 9, 1),
        is_released=False
    )
    freeze2 = FreezeRecord(
        freeze_id="FRZ002",
        credit_id="CR003",
        amount=20000000,
        freeze_reason="逾期欠息冻结",
        freeze_date=datetime(2024, 8, 15),
        is_released=False
    )
    repo.save_freeze_record(freeze1)
    repo.save_freeze_record(freeze2)

    report_date = datetime(2024, 10, 15)
    calc.upload_review_report(
        asset_pool_id=pool_id,
        report_date=report_date,
        content="日常复核",
        total_asset=1000000000,
        total_liability=600000000,
        pressure_gap=290000000,
        conclusion="压力缺口处于安全区间",
        reviewer="李复核"
    )

    result = calc.calculate_gap(pool_id, report_date)
    print(calc.format_result_for_display(result))

    assert result.status == ConclusionStatus.PENDING
    assert RiskFlag.FREEZE_NOT_RELEASED in result.risk_flags
    assert len(result.pending_confirmations) == 1
    assert result.adjusted_gap == result.base_gap + 50000000
    assert "有2笔冻结额度还没处理释放" in str(result.human_readable_notes)
    assert "（待确认）" in result.conclusion
    print("✅ 测试通过：冻结额度未释放正确标记为待确认")


def test_scenario_3_duplicate_credit():
    """场景3：重复授信"""
    print_separator("场景3：客户重复授信（应标记为待确认）")

    repo = DataRepository()
    pool_id = setup_test_data(repo)
    calc = PressureGapCalculator(repo)
    calc.set_operator("刘运营")

    dup_credit = CreditLine(
        credit_id="CR005",
        customer_id="CUST001",
        customer_name="甲公司",
        total_amount=100000000,
        used_amount=60000000,
        available_amount=40000000,
        effective_date=datetime(2024, 5, 1),
        expiry_date=datetime(2025, 4, 30),
        data_source=DataSourceStatus.MANUAL_MODIFIED
    )
    repo.save_credit_line(dup_credit)

    report_date = datetime(2024, 10, 15)
    calc.upload_review_report(
        asset_pool_id=pool_id,
        report_date=report_date,
        content="日常复核",
        total_asset=5100000000,
        total_liability=600000000,
        pressure_gap=250000000,
        conclusion="压力缺口处于安全区间",
        reviewer="李复核"
    )

    result = calc.calculate_gap(pool_id, report_date)
    print(calc.format_result_for_display(result))

    assert result.status == ConclusionStatus.PENDING
    assert RiskFlag.DUPLICATE_CREDIT in result.risk_flags
    assert len(result.pending_confirmations) == 1
    assert "发现1位客户存在重复授信" in str(result.human_readable_notes)
    assert "（待确认）" in result.conclusion
    print("✅ 测试通过：重复授信正确标记为待确认")


def test_scenario_4_manual_note_override():
    """场景4：人工备注覆盖系统结论"""
    print_separator("场景4：人工备注覆盖旧结论（应标记为待确认）")

    repo = DataRepository()
    pool_id = setup_test_data(repo)
    calc = PressureGapCalculator(repo)
    calc.set_operator("陈主管")

    credit = repo.get_credit_line("CR002")
    credit.manual_note = "客户为国企背景，虽有逾期但风险可控，下调分类"
    credit.previous_conclusion = "正常类"
    credit.data_source = DataSourceStatus.MANUAL_MODIFIED
    repo.save_credit_line(credit)

    report_date = datetime(2024, 10, 15)
    calc.upload_review_report(
        asset_pool_id=pool_id,
        report_date=report_date,
        content="客户资质良好，风险可控",
        total_asset=1000000000,
        total_liability=600000000,
        pressure_gap=290000000,
        conclusion="压力缺口处于安全区间",
        reviewer="李复核",
        manual_note="已核实客户背景"
    )

    result = calc.calculate_gap(pool_id, report_date)
    print(calc.format_result_for_display(result))

    assert result.status == ConclusionStatus.PENDING
    assert RiskFlag.MANUAL_NOTE_OVERRIDE in result.risk_flags
    assert len(result.pending_confirmations) == 1
    assert "有1条记录用人工备注盖掉了之前的系统结论" in str(result.human_readable_notes)
    assert "（待确认）" in result.conclusion
    print("✅ 测试通过：人工备注覆盖正确标记为待确认")


def test_scenario_5_missing_review_report():
    """场景5：缺少复核日报"""
    print_separator("场景5：缺少复核日报（应标记为待确认）")

    repo = DataRepository()
    pool_id = setup_test_data(repo)
    calc = PressureGapCalculator(repo)
    calc.set_operator("周运营")

    report_date = datetime(2024, 10, 15)
    result = calc.calculate_gap(pool_id, report_date)
    print(calc.format_result_for_display(result))

    assert result.status == ConclusionStatus.PENDING
    assert RiskFlag.MISSING_REVIEW_REPORT in result.risk_flags
    assert len(result.pending_confirmations) == 1
    assert "缺少复核日报，无法生成最终结论" in result.conclusion
    assert "当天的复核日报还没上传哦" in str(result.human_readable_notes)
    print("✅ 测试通过：缺少复核日报正确标记为待确认")


def test_scenario_6_late_supplement():
    """场景6：补充邮件早到，复核日报晚补"""
    print_separator("场景6：补充邮件早到，复核日报晚补（后补材料）")

    repo = DataRepository()
    pool_id = setup_test_data(repo)
    calc = PressureGapCalculator(repo)
    calc.set_operator("吴运营")

    report_date = datetime(2024, 10, 15)
    email_date = datetime(2024, 10, 14)
    report_create_date = datetime(2024, 10, 16)

    report, result = calc.upload_review_report(
        asset_pool_id=pool_id,
        report_date=report_date,
        content="补充客户丙公司的最新财报",
        total_asset=5000000000,
        total_liability=600000000,
        pressure_gap=290000000,
        conclusion="压力缺口处于安全区间",
        reviewer="李复核",
        data_source=DataSourceStatus.SUPPLEMENTED,
        supplementary_email_date=email_date,
        created_at=report_create_date
    )

    print(calc.format_result_for_display(result))

    assert RiskFlag.LATE_SUPPLEMENT in result.risk_flags
    assert "这份复核日报是后补的" in str(result.human_readable_notes)
    print("✅ 测试通过：后补材料正确标记")


def test_scenario_7_report_version_comparison():
    """场景7：复核日报多版本对比，区分补材料和改结论"""
    print_separator("场景7：复核日报多版本对比（仅补材料 vs 改结论）")

    repo = DataRepository()
    pool_id = setup_test_data(repo)
    calc = PressureGapCalculator(repo)
    calc.set_operator("郑运营")

    report_date = datetime(2024, 10, 15)

    print("--- 上传第一版日报（原始）---")
    report1, result1 = calc.upload_review_report(
        asset_pool_id=pool_id,
        report_date=report_date,
        content="初步复核，资产质量稳定",
        total_asset=5000000000,
        total_liability=600000000,
        pressure_gap=290000000,
        conclusion="压力缺口处于安全区间",
        reviewer="李复核"
    )
    print(f"第一版状态：{result1.status.value}")
    print(f"第一版结论：{result1.conclusion}")
    print()

    print("--- 上传第二版日报（仅补材料，结论不变）---")
    report2, result2 = calc.upload_review_report(
        asset_pool_id=pool_id,
        report_date=report_date,
        content="补充客户甲公司的担保函",
        total_asset=5000000000,
        total_liability=600000000,
        pressure_gap=290000000,
        conclusion="压力缺口处于安全区间",
        reviewer="李复核",
        data_source=DataSourceStatus.SUPPLEMENTED
    )
    print(f"第二版变更类型：{result2.change_type.value}")
    print(f"第二版结论：{result2.conclusion}")
    print(f"版本差异：{result2.version_diffs}")
    print()

    assert result2.change_type == ChangeType.MATERIAL_ONLY
    assert "仅补材料" in result2.change_type.value
    print("✅ 测试通过：仅补材料正确识别")

    print("--- 上传第三版日报（改结论，内容不变）---")
    report3, result3 = calc.upload_review_report(
        asset_pool_id=pool_id,
        report_date=report_date,
        content="补充客户甲公司的担保函",
        total_asset=5000000000,
        total_liability=600000000,
        pressure_gap=290000000,
        conclusion="压力缺口处于关注区间，需加强监控",
        reviewer="李复核"
    )
    print(f"第三版变更类型：{result3.change_type.value}")
    print(f"第三版结论：{result3.conclusion}")
    print(f"版本差异：{result3.version_diffs}")
    print()

    assert result3.change_type == ChangeType.CONCLUSION_CHANGED
    assert "注意！这次复核日报的结论和上一版不一样" in str(result3.human_readable_notes)
    print("✅ 测试通过：改结论正确识别并提醒")

    print("--- 上传第四版日报（混合变更：既补材料又改结论）---")
    report4, result4 = calc.upload_review_report(
        asset_pool_id=pool_id,
        report_date=report_date,
        content="补充乙公司最新授信合同，同时调整分类",
        total_asset=5050000000,
        total_liability=600000000,
        pressure_gap=240000000,
        conclusion="压力缺口处于安全区间",
        reviewer="李复核"
    )
    print(f"第四版变更类型：{result4.change_type.value}")
    print(f"第四版结论：{result4.conclusion}")
    print(f"版本差异数：{len(result4.version_diffs)}")
    print()

    assert result4.change_type == ChangeType.MIXED
    print("✅ 测试通过：混合变更正确识别")

    print("\n完整结果展示：")
    print(calc.format_result_for_display(result4))


def test_scenario_8_complex_mixed_scenario():
    """场景8：复杂混合场景（冻结+重复+人工备注+后补日报）"""
    print_separator("场景8：复杂混合场景（多种问题同时存在）")

    repo = DataRepository()
    pool_id = setup_test_data(repo)
    calc = PressureGapCalculator(repo)
    calc.set_operator("冯主管")

    freeze = FreezeRecord(
        freeze_id="FRZ003",
        credit_id="CR004",
        amount=50000000,
        freeze_reason="贷款分类下调冻结",
        freeze_date=datetime(2024, 10, 1),
        is_released=False
    )
    repo.save_freeze_record(freeze)

    dup_credit = CreditLine(
        credit_id="CR006",
        customer_id="CUST002",
        customer_name="乙公司",
        total_amount=80000000,
        used_amount=50000000,
        available_amount=30000000,
        effective_date=datetime(2024, 4, 1),
        expiry_date=datetime(2025, 3, 31)
    )
    repo.save_credit_line(dup_credit)

    credit = repo.get_credit_line("CR001")
    credit.manual_note = "客户还款意愿良好，暂不列入关注"
    credit.previous_conclusion = "关注类"
    credit.data_source = DataSourceStatus.MANUAL_MODIFIED
    repo.save_credit_line(credit)

    report_date = datetime(2024, 10, 15)
    email_date = datetime(2024, 10, 10)
    report_create_date = datetime(2024, 10, 12)

    report, result = calc.upload_review_report(
        asset_pool_id=pool_id,
        report_date=report_date,
        content="后补客户丁公司的风险缓释材料",
        total_asset=5080000000,
        total_liability=600000000,
        pressure_gap=260000000,
        conclusion="压力缺口处于安全区间",
        reviewer="李复核",
        data_source=DataSourceStatus.SUPPLEMENTED,
        supplementary_email_date=email_date,
        created_at=report_create_date
    )

    print(calc.format_result_for_display(result))

    assert result.status == ConclusionStatus.PENDING
    assert RiskFlag.FREEZE_NOT_RELEASED in result.risk_flags
    assert RiskFlag.DUPLICATE_CREDIT in result.risk_flags
    assert RiskFlag.MANUAL_NOTE_OVERRIDE in result.risk_flags
    assert RiskFlag.LATE_SUPPLEMENT in result.risk_flags
    assert len(result.pending_confirmations) == 4
    assert "（待确认）" in result.conclusion

    print("\n待确认项列表：")
    for i, pc in enumerate(result.pending_confirmations, 1):
        print(f"{i}. {pc.risk_flag.value}: {pc.description}")

    print("\n✅ 测试通过：复杂混合场景正确识别所有风险点")
    print(f"   共识别 {len(result.pending_confirmations)} 个待确认事项")


def test_scenario_9_confirm_pending_items():
    """场景9：确认待处理项流程"""
    print_separator("场景9：待确认项复核流程")

    repo = DataRepository()
    pool_id = setup_test_data(repo)
    calc = PressureGapCalculator(repo)
    calc.set_operator("褚运营")

    freeze = FreezeRecord(
        freeze_id="FRZ004",
        credit_id="CR002",
        amount=25000000,
        freeze_reason="临时冻结，待核实",
        freeze_date=datetime(2024, 10, 10),
        is_released=False
    )
    repo.save_freeze_record(freeze)

    report_date = datetime(2024, 10, 15)
    calc.upload_review_report(
        asset_pool_id=pool_id,
        report_date=report_date,
        content="日常复核",
        total_asset=1000000000,
        total_liability=600000000,
        pressure_gap=290000000,
        conclusion="压力缺口处于安全区间",
        reviewer="李复核"
    )

    result = calc.calculate_gap(pool_id, report_date)
    print("=== 确认前 ===")
    print(f"状态：{result.status.value}")
    print(f"待确认数：{len(result.pending_confirmations)}")
    print()

    pc_id = result.pending_confirmations[0].confirm_id
    updated_result = calc.confirm_pending_item(pc_id, "风控主管-王")

    print("=== 确认后 ===")
    print(f"状态：{updated_result.status.value}")
    print(f"待确认数（未确认）：{len([p for p in updated_result.pending_confirmations if not p.is_confirmed])}")
    print()

    assert updated_result.status == ConclusionStatus.NORMAL
    assert updated_result.pending_confirmations[0].is_confirmed
    assert updated_result.pending_confirmations[0].confirmed_by == "风控主管-王"
    assert "所有待确认项已复核通过" in updated_result.conclusion
    assert "（待确认）" not in updated_result.conclusion

    print(calc.format_result_for_display(updated_result))
    print("✅ 测试通过：待确认项复核流程正常")


def test_scenario_10_user_friendly_errors():
    """场景10：人性化错误提示"""
    print_separator("场景10：人性化错误提示（不是吐堆栈）")

    repo = DataRepository()
    pool_id = setup_test_data(repo)
    calc = PressureGapCalculator(repo)
    calc.set_operator("卫运营")

    bad_credit = CreditLine(
        credit_id="CR007",
        customer_id="CUST005",
        customer_name="戊公司",
        total_amount=-1000000,
        used_amount=500000,
        available_amount=-1500000,
        effective_date=datetime(2024, 1, 1),
        expiry_date=datetime(2025, 12, 31)
    )
    repo.save_credit_line(bad_credit)

    try:
        calc.calculate_gap(pool_id)
        print("❌ 测试失败：应该抛出异常")
        assert False
    except UserFriendlyError as e:
        print(f"捕获到用户友好错误：")
        print(f"  错误码：{e.error_code}")
        print(f"  用户提示：{e.user_message}")
        print(f"  建议：{e.suggestion}")
        print()
        print("错误消息不是内部字段名或堆栈，而是人话：")
        print(f"  ✅ 包含客户名称：'戊公司'")
        print(f"  ✅ 说明问题：'不是正数'")
        print(f"  ✅ 给出建议：'请去【授信管理】修正'")

        assert "戊公司" in e.user_message
        assert "不是正数" in e.user_message
        assert "授信管理" in e.suggestion
        assert "credits" not in e.user_message.lower()
        assert "field" not in e.user_message.lower()
        assert "traceback" not in e.user_message.lower()
        print("\n✅ 测试通过：错误提示人性化，不含内部字段名或堆栈")


def test_scenario_11_gap_exceeds_threshold():
    """场景11：压力缺口超过警戒线"""
    print_separator("场景11：压力缺口超过警戒线")

    repo = DataRepository()
    pool_id = setup_test_data(repo)
    calc = PressureGapCalculator(repo)
    calc.set_operator("蒋运营")

    pool = repo.get_asset_pool(pool_id)
    pool.total_liability = 1500000000
    repo.save_asset_pool(pool)

    report_date = datetime(2024, 10, 15)
    calc.upload_review_report(
        asset_pool_id=pool_id,
        report_date=report_date,
        content="资产质量恶化，负债上升",
        total_asset=5000000000,
        total_liability=1500000000,
        pressure_gap=1190000000,
        conclusion="压力缺口较大，需启动应急预案",
        reviewer="李复核"
    )

    result = calc.calculate_gap(pool_id, report_date)
    print(calc.format_result_for_display(result))

    assert result.status == ConclusionStatus.ABNORMAL
    assert result.pressure_gap_ratio > 0.15
    assert "超过警戒线" in result.conclusion
    assert "请立即启动压力缺口应急预案" in str(result.human_readable_notes)
    print("✅ 测试通过：超警戒线正确识别并预警")


def run_all_tests():
    print("\n" + "#" * 70)
    print("#" + " " * 68 + "#")
    print("#" + " " * 15 + "资产池压力缺口系统 - 场景测试" + " " * 22 + "#")
    print("#" + " " * 68 + "#")
    print("#" * 70)

    tests = [
        test_scenario_1_normal_calculation,
        test_scenario_2_freeze_not_released,
        test_scenario_3_duplicate_credit,
        test_scenario_4_manual_note_override,
        test_scenario_5_missing_review_report,
        test_scenario_6_late_supplement,
        test_scenario_7_report_version_comparison,
        test_scenario_8_complex_mixed_scenario,
        test_scenario_9_confirm_pending_items,
        test_scenario_10_user_friendly_errors,
        test_scenario_11_gap_exceeds_threshold,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            failed += 1
            print(f"\n❌ 测试 {test.__name__} 失败: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 70)
    print(f"测试完成：{passed} 个通过，{failed} 个失败")
    print("=" * 70)

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_all_tests()
