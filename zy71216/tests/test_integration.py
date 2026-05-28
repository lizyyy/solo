"""集成测试 - 验证端到端流程"""

import json
import tempfile
from datetime import date
from pathlib import Path
import sys
import os

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from abs_waterfall.models import (
    DealStructure,
    UnderlyingAsset,
    CashFlowRecord,
    Tranche,
    ServicingFee,
    DefaultRecord,
    TriggerEvent,
    AllocationReportSample,
    AssetStatus,
    TrancheType,
    PaymentType,
    TriggerEventType,
    TriggerStatus,
)
from abs_waterfall.data_loader import DataLoader
from abs_waterfall.trigger_detector import TriggerDetector
from abs_waterfall.waterfall_engine import WaterfallEngine
from abs_waterfall.discrepancy_detector import DiscrepancyDetector
from abs_waterfall.report_generator import ReportGenerator


def create_normal_deal() -> DealStructure:
    """创建一个正常的、没有差错的交易数据"""
    
    assets = [
        UnderlyingAsset(
            asset_id="LOAN-001",
            original_balance=100000.00,
            current_balance=90000.00,
            coupon_rate=0.12,
            origination_date=date(2023, 1, 1),
            maturity_date=date(2026, 1, 1),
            status=AssetStatus.PERFORMING,
            borrower_id="BORR-001",
            collateral_type="consumer_unsecured",
        ),
        UnderlyingAsset(
            asset_id="LOAN-002",
            original_balance=150000.00,
            current_balance=140000.00,
            coupon_rate=0.13,
            origination_date=date(2023, 2, 1),
            maturity_date=date(2026, 2, 1),
            status=AssetStatus.PERFORMING,
            borrower_id="BORR-002",
            collateral_type="auto_loan",
        ),
        UnderlyingAsset(
            asset_id="LOAN-003",
            original_balance=80000.00,
            current_balance=75000.00,
            coupon_rate=0.11,
            origination_date=date(2023, 3, 1),
            maturity_date=date(2026, 3, 1),
            status=AssetStatus.PERFORMING,
            borrower_id="BORR-003",
            collateral_type="consumer_unsecured",
        ),
    ]

    cashflows = [
        CashFlowRecord(
            record_id="CF-001",
            asset_id="LOAN-001",
            payment_date=date(2025, 1, 15),
            payment_type=PaymentType.PRINCIPAL_AND_INTEREST,
            amount=500000.00,
            source_account="COL-001",
            reference="PMT-001",
        ),
        CashFlowRecord(
            record_id="CF-002",
            asset_id="LOAN-002",
            payment_date=date(2025, 1, 18),
            payment_type=PaymentType.PRINCIPAL_AND_INTEREST,
            amount=600000.00,
            source_account="COL-001",
            reference="PMT-002",
        ),
        CashFlowRecord(
            record_id="CF-003",
            asset_id="LOAN-003",
            payment_date=date(2025, 1, 20),
            payment_type=PaymentType.PRINCIPAL_AND_INTEREST,
            amount=400000.00,
            source_account="COL-001",
            reference="PMT-003",
        ),
    ]

    tranches = [
        Tranche(
            tranche_id="A-1",
            tranche_name="优先A-1档",
            tranche_type=TrancheType.SENIOR,
            original_balance=2000000.00,
            current_balance=1900000.00,
            coupon_rate=0.045,
            payment_priority=10,
            payment_type=PaymentType.PRINCIPAL_AND_INTEREST,
            is_shortfall_carry=True,
        ),
        Tranche(
            tranche_id="B",
            tranche_name="次级B档",
            tranche_type=TrancheType.SUBORDINATED,
            original_balance=300000.00,
            current_balance=300000.00,
            coupon_rate=0.075,
            payment_priority=20,
            payment_type=PaymentType.PRINCIPAL_AND_INTEREST,
            is_shortfall_carry=True,
        ),
        Tranche(
            tranche_id="E",
            tranche_name="权益档",
            tranche_type=TrancheType.EQUITY,
            original_balance=200000.00,
            current_balance=200000.00,
            coupon_rate=0.00,
            payment_priority=99,
            payment_type=PaymentType.PRINCIPAL,
            is_shortfall_carry=False,
        ),
    ]

    servicing_fees = [
        ServicingFee(
            fee_id="FEE-001",
            fee_name="服务商管理费",
            rate=0.01,
            calculation_base="total_assets",
            payment_priority=1,
            is_flat_fee=False,
            arrears=0.00,
        ),
        ServicingFee(
            fee_id="FEE-002",
            fee_name="托管银行费",
            rate=0.001,
            calculation_base="senior_balance",
            payment_priority=2,
            is_flat_fee=False,
            arrears=0.00,
        ),
    ]

    trigger_events = [
        TriggerEvent(
            event_id="TRIG-001",
            event_name="违约率触发事件",
            event_type=TriggerEventType.DEFAULT,
            test_formula="default_rate",
            threshold=0.05,
            actual_value=0.0,
            status=TriggerStatus.NOT_TRIGGERED,
        ),
        TriggerEvent(
            event_id="TRIG-002",
            event_name="DSCR不足触发事件",
            event_type=TriggerEventType.ACCELERATION,
            test_formula="dscr_below",
            threshold=0.1,
            actual_value=0.0,
            status=TriggerStatus.NOT_TRIGGERED,
        ),
    ]

    default_records = []
    allocation_samples = []

    return DealStructure(
        deal_id="TEST-001",
        deal_name="测试交易-正常情况",
        closing_date=date(2024, 1, 1),
        next_payment_date=date(2025, 2, 25),
        assets=assets,
        cashflows=cashflows,
        tranches=tranches,
        servicing_fees=servicing_fees,
        default_records=default_records,
        trigger_events=trigger_events,
        allocation_samples=allocation_samples,
        reserve_account_balance=500000.00,
        collection_account_balance=100000.00,
        reinvestment_account_balance=0.00,
    )


def test_full_pipeline_normal():
    """测试正常交易的完整流程"""
    print("=" * 60)
    print("测试1: 正常交易的完整复核流程")
    print("=" * 60)

    deal = create_normal_deal()
    period_start = date(2025, 1, 1)
    period_end = date(2025, 1, 31)

    print(f"✓ 已创建测试交易: {deal.deal_name}")
    print(f"  - 基础资产: {len(deal.assets)} 笔")
    print(f"  - 现金流: {len(deal.cashflows)} 笔")
    print(f"  - 分层: {len(deal.tranches)} 档")

    trigger_detector = TriggerDetector(deal, period_end)
    trigger_results = trigger_detector.run_tests()
    print(f"✓ 触发事件检测完成，触发 {sum(1 for t in trigger_results if t.status == TriggerStatus.TRIGGERED)} 个")

    engine = WaterfallEngine(deal, period_start, period_end)
    result = engine.run_waterfall(trigger_results)
    print(f"✓ 现金流瀑布计算完成")
    print(f"  - 本期流入: ¥{result.total_cash_inflow:,.2f}")
    print(f"  - 本期流出: ¥{result.total_cash_outflow:,.2f}")

    discrepancy_detector = DiscrepancyDetector(deal, result)
    discrepancies = discrepancy_detector.run_all_checks()
    print(f"✓ 差错检测完成，发现 {len(discrepancies)} 项差错")

    assert len(discrepancies) == 0, f"正常交易不应检测到差错，但发现 {len(discrepancies)} 项"
    print("✓ PASS: 正常交易未检测到任何差错")
    print()

    return deal, result, discrepancies


def test_full_pipeline_with_issues():
    """测试包含差错的交易的完整流程"""
    print("=" * 60)
    print("测试2: 包含差错的交易复核流程")
    print("=" * 60)

    sample_file = Path(__file__).parent.parent / "sample_data" / "deal_with_issues.json"
    deal = DataLoader.load_from_json(str(sample_file))
    period_start = date(2025, 1, 1)
    period_end = date(2025, 1, 31)

    print(f"✓ 已加载测试交易: {deal.deal_name}")
    print(f"  - 基础资产: {len(deal.assets)} 笔")
    print(f"  - 违约资产: {sum(1 for a in deal.assets if a.status in [AssetStatus.DEFAULTED, AssetStatus.WRITTEN_OFF])} 笔")
    print(f"  - 现金流: {len(deal.cashflows)} 笔")

    trigger_detector = TriggerDetector(deal, period_end)
    trigger_results = trigger_detector.run_tests()
    triggered = [t for t in trigger_results if t.status == TriggerStatus.TRIGGERED]
    print(f"✓ 触发事件检测完成，触发 {len(triggered)} 个事件")
    for t in triggered:
        print(f"  - {t.event_name}: {t.actual_value*100:.2f}% (阈值 {t.threshold*100:.2f}%)")

    engine = WaterfallEngine(deal, period_start, period_end)
    result = engine.run_waterfall(trigger_results)
    print(f"✓ 现金流瀑布计算完成")
    print(f"  - 本期流入: ¥{result.total_cash_inflow:,.2f}")
    print(f"  - 本期流出: ¥{result.total_cash_outflow:,.2f}")

    discrepancy_detector = DiscrepancyDetector(deal, result)
    discrepancies = discrepancy_detector.run_all_checks()
    print(f"✓ 差错检测完成，发现 {len(discrepancies)} 项差错")

    severity_count = {}
    for d in discrepancies:
        severity_count[d.severity] = severity_count.get(d.severity, 0) + 1
    for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        if sev in severity_count:
            print(f"  - {sev}: {severity_count[sev]} 项")

    assert len(discrepancies) > 0, "包含差错的交易应检测到至少一项差错"
    assert any(d.severity == "HIGH" for d in discrepancies), "应检测到至少一项HIGH级别差错"
    print("✓ PASS: 成功检测到预期的差错")
    print()

    return deal, result, discrepancies


def test_report_generation():
    """测试报告生成功能"""
    print("=" * 60)
    print("测试3: 报告生成功能")
    print("=" * 60)

    deal = create_normal_deal()
    period_start = date(2025, 1, 1)
    period_end = date(2025, 1, 31)

    trigger_detector = TriggerDetector(deal, period_end)
    trigger_results = trigger_detector.run_tests()

    engine = WaterfallEngine(deal, period_start, period_end)
    result = engine.run_waterfall(trigger_results)

    discrepancy_detector = DiscrepancyDetector(deal, result)
    discrepancies = discrepancy_detector.run_all_checks()

    reporter = ReportGenerator(deal, result, discrepancies)

    with tempfile.TemporaryDirectory() as tmpdir:
        json_path = os.path.join(tmpdir, "result.json")
        report_path = os.path.join(tmpdir, "report.txt")

        reporter.generate_machine_readable(json_path)
        assert os.path.exists(json_path), "JSON报告应已生成"
        print(f"✓ 机器可读JSON报告已生成: {json_path}")

        with open(json_path, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        assert "metadata" in json_data
        assert "cashflow_summary" in json_data
        assert "discrepancies" in json_data
        assert "conclusion" in json_data
        assert "original_values_preserved" in json_data
        assert "raw_cashflows_used" in json_data
        print("✓ JSON报告包含所有必需字段")

        reporter.generate_human_readable(report_path)
        assert os.path.exists(report_path), "文本报告应已生成"
        print(f"✓ 人可读文本报告已生成: {report_path}")

        with open(report_path, 'r', encoding='utf-8') as f:
            report_content = f.read()
        assert "ABS现金流瀑布复核报告" in report_content
        assert "交易基本信息" in report_content
        assert "现金流汇总" in report_content
        assert "处理结论" in report_content
        print("✓ 文本报告包含所有必需章节")

    print("✓ PASS: 报告生成功能正常")
    print()


def test_original_values_preserved():
    """测试原始值是否正确保留"""
    print("=" * 60)
    print("测试4: 原始值保留功能")
    print("=" * 60)

    deal = create_normal_deal()
    original_balances = {t.tranche_id: t.current_balance for t in deal.tranches}
    original_collection = deal.collection_account_balance
    original_reserve = deal.reserve_account_balance

    period_start = date(2025, 1, 1)
    period_end = date(2025, 1, 31)

    trigger_detector = TriggerDetector(deal, period_end)
    trigger_results = trigger_detector.run_tests()

    engine = WaterfallEngine(deal, period_start, period_end)
    result = engine.run_waterfall(trigger_results)

    preserved = result.original_values_preserved
    assert "tranche_balances" in preserved
    assert "beginning_collection_balance" in preserved
    assert "beginning_reserve_balance" in preserved

    for tranche_id, original_balance in original_balances.items():
        assert tranche_id in preserved["tranche_balances"]
        assert preserved["tranche_balances"][tranche_id] == original_balance

    assert preserved["beginning_collection_balance"] == original_collection
    assert preserved["beginning_reserve_balance"] == original_reserve

    print(f"✓ 原始分层余额已保留: {len(preserved['tranche_balances'])} 个分层")
    print(f"✓ 原始归集账户余额已保留: ¥{preserved['beginning_collection_balance']:,.2f}")
    print(f"✓ 原始储备金余额已保留: ¥{preserved['beginning_reserve_balance']:,.2f}")
    print("✓ PASS: 原始值保留功能正常")
    print()


def test_data_roundtrip():
    """测试数据JSON序列化和反序列化"""
    print("=" * 60)
    print("测试5: 数据JSON往返测试")
    print("=" * 60)

    deal = create_normal_deal()

    with tempfile.TemporaryDirectory() as tmpdir:
        json_path = os.path.join(tmpdir, "deal.json")
        DataLoader.deal_to_json(deal, json_path)
        assert os.path.exists(json_path), "JSON文件应已生成"

        loaded_deal = DataLoader.load_from_json(json_path)

        assert loaded_deal.deal_id == deal.deal_id
        assert loaded_deal.deal_name == deal.deal_name
        assert len(loaded_deal.assets) == len(deal.assets)
        assert len(loaded_deal.tranches) == len(deal.tranches)
        assert len(loaded_deal.servicing_fees) == len(deal.servicing_fees)
        assert len(loaded_deal.trigger_events) == len(deal.trigger_events)
        assert abs(loaded_deal.collection_account_balance - deal.collection_account_balance) < 0.01
        assert abs(loaded_deal.reserve_account_balance - deal.reserve_account_balance) < 0.01

        print(f"✓ 交易ID匹配: {loaded_deal.deal_id}")
        print(f"✓ 资产数量匹配: {len(loaded_deal.assets)}")
        print(f"✓ 分层数量匹配: {len(loaded_deal.tranches)}")
        print("✓ PASS: 数据JSON往返测试通过")
        print()


def test_exit_code_logic():
    """测试退出码逻辑"""
    print("=" * 60)
    print("测试6: 退出码逻辑")
    print("=" * 60)

    sample_file = Path(__file__).parent.parent / "sample_data" / "deal_with_issues.json"
    deal = DataLoader.load_from_json(str(sample_file))
    period_start = date(2025, 1, 1)
    period_end = date(2025, 1, 31)

    trigger_detector = TriggerDetector(deal, period_end)
    trigger_results = trigger_detector.run_tests()

    engine = WaterfallEngine(deal, period_start, period_end)
    result = engine.run_waterfall(trigger_results)

    discrepancy_detector = DiscrepancyDetector(deal, result)
    discrepancies = discrepancy_detector.run_all_checks()

    has_critical = any(d.severity == "CRITICAL" for d in discrepancies)
    has_high = any(d.severity == "HIGH" for d in discrepancies)
    has_medium = any(d.severity == "MEDIUM" for d in discrepancies)

    if has_critical or has_high:
        expected_exit_code = 2
    elif has_medium:
        expected_exit_code = 1
    else:
        expected_exit_code = 0

    print(f"  - CRITICAL差错: {has_critical}")
    print(f"  - HIGH差错: {has_high}")
    print(f"  - MEDIUM差错: {has_medium}")
    print(f"  - 预期退出码: {expected_exit_code}")

    assert expected_exit_code == 2, "包含HIGH差错的交易应返回退出码2"
    print("✓ PASS: 退出码逻辑正确")
    print()


def main():
    """运行所有集成测试"""
    print("\n" + "=" * 60)
    print("ABS现金流瀑布复核工具 - 集成测试套件")
    print("=" * 60 + "\n")

    tests = [
        test_full_pipeline_normal,
        test_full_pipeline_with_issues,
        test_report_generation,
        test_original_values_preserved,
        test_data_roundtrip,
        test_exit_code_logic,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"✗ FAIL: {str(e)}")
            failed += 1
        except Exception as e:
            print(f"✗ ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            failed += 1

    print("=" * 60)
    print(f"测试结果: {passed} 通过, {failed} 失败")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
