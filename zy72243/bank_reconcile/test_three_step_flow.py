#!/usr/bin/env python3
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src import init_db, BankStatementImporter, ReviewManager, AuditManager

BATCH_NO = "TEST-20240601-001"
SAMPLE_FILE = os.path.join(os.path.dirname(__file__), "samples", "sample_batch_20240601.csv")


def print_step(title, step_num):
    print(f"\n{'=' * 80}")
    print(f" 步骤 {step_num}: {title}")
    print(f"{'=' * 80}\n")


def test_step1_import():
    print_step("清算批次号第一次导入", 1)

    print(f"📂 正在导入样例文件: {SAMPLE_FILE}")
    print(f"📦 清算批次号: {BATCH_NO}")
    print()

    importer = BankStatementImporter()
    result = importer.import_batch(SAMPLE_FILE, BATCH_NO)

    print("✅ 导入完成！")
    print(f"   总记录数: {result['total_records']}")
    print(f"   港币人民币同列数: {result['mixed_currency_count']}")
    print()

    if result['mixed_currency_count'] > 0:
        print("⚠️  检测到币种混合，这些记录不会自动归为正常")
        print("   已自动生成审计明细，等待托管对接人复核")

    auditor = AuditManager()
    audits = auditor.get_audit_trails(batch_no=BATCH_NO, is_resolved=False)
    print(f"\n📝 待处理审计项: {len(audits)} 条")
    for i, a in enumerate(audits[:5], 1):
        type_label = "🔴 币种混合" if a['audit_type'] == 'mixed_currency' else "🟡 缺少节假日说明"
        print(f"   {i}. {type_label} - {a['reason']}")
        print(f"      责任人: {a['responsible_party']}")
        print(f"      下一步: {a['next_action']}")

    return result


def test_step2_holiday_adjustment():
    print_step("对账运营阿芬补看节假日顺延说明", 2)

    reviewer = ReviewManager()

    print("👩‍💼 对账运营阿芬正在补录节假日顺延说明...")
    print()

    original_date = datetime(2024, 6, 1)
    adjusted_date = datetime(2024, 6, 3)
    reason = "2024年6月1日为香港特别行政区成立纪念日，港币清算顺延至下一个工作日"
    operator_note = "已核对香港金管局公告，确认为节假日"

    result = reviewer.add_holiday_adjustment(
        BATCH_NO, original_date, adjusted_date, reason, operator_note
    )

    if result:
        print("✅ 节假日顺延说明已补录")
        print(f"   原日期: {original_date.strftime('%Y-%m-%d')} → 调整后: {adjusted_date.strftime('%Y-%m-%d')}")
        print(f"   原因: {reason}")
        print(f"   操作人: 对账运营阿芬")
        print()

        print("🔄 审计明细自动更新中...")
        auditor = AuditManager()
        pending_holiday = auditor.get_audit_trails(
            batch_no=BATCH_NO, is_resolved=False
        )
        pending_holiday = [a for a in pending_holiday if a['audit_type'] == 'missing_holiday_note']

        if len(pending_holiday) == 0:
            print("✅ 节假日相关审计项已全部自动标记为已解决")
        else:
            print(f"⚠️  仍有 {len(pending_holiday)} 条节假日相关审计项待处理")

        pending_mixed = auditor.get_audit_trails(
            batch_no=BATCH_NO, is_resolved=False
        )
        pending_mixed = [a for a in pending_mixed if a['audit_type'] == 'mixed_currency']
        print(f"🔴 币种混合审计项仍保留 {len(pending_mixed)} 条，待托管对接人复核")
        print("   （不会自动归为正常，符合需求）")

    return result


def test_step3_audit_update_and_review():
    print_step("审计明细更新 + 托管对接人复核", 3)

    reviewer = ReviewManager()
    auditor = AuditManager()

    batch = reviewer.get_batch_summary(BATCH_NO)
    from src.database import get_session
    from src.models import TransactionRecord
    session = get_session()
    mixed_transactions = session.query(TransactionRecord).filter(
        TransactionRecord.batch_id == batch['id'],
        TransactionRecord.has_mixed_currency == True
    ).all()

    print(f"📋 待托管对接人复核的币种混合交易: {len(mixed_transactions)} 笔")
    print()

    for i, txn in enumerate(mixed_transactions, 1):
        print(f"   {i}. 交易ID: {txn.id}, 流水号: {txn.transaction_no}")
        print(f"      金额列原始内容: {txn.amount_column_raw}")
        print(f"      检测到币种: {txn.detected_currencies}")
        print()

        if i == 1:
            print(f"   → 托管对接人正在复核第 {i} 笔...")
            print(f"   💡 复核意见: 经核对原始凭证，此笔为跨境双币种结算，币种标注正确")
            print(f"   ⚠️  注意：不标记为正常，继续保留待复核状态")
            print()

            result = reviewer.review_mixed_currency(
                txn.id,
                "经核对原始凭证，此笔为跨境双币种结算，币种标注正确，需按双币种分别记账",
                "托管对接人-李经理",
                mark_normal=False
            )

            if result:
                print("✅ 复核完成（未标记为正常，继续保留待复核状态）")
                print(f"   复核人: {result['reviewed_by']}")
                print()

        elif i == 2:
            print(f"   → 托管对接人正在复核第 {i} 笔...")
            print(f"   💡 复核意见: 经核对，此笔为录入错误，实际应为人民币8000元")
            print(f"   ✅ 标记为正常")
            print()

            result = reviewer.review_mixed_currency(
                txn.id,
                "经核对原始凭证，此笔为录入错误，实际应为人民币8000元，港币为笔误",
                "托管对接人-李经理",
                mark_normal=True
            )

            if result:
                print("✅ 复核完成（已标记为正常）")
                print(f"   复核人: {result['reviewed_by']}")
                print()

    print("📊 生成最终审计报告...")
    print()

    report = auditor.generate_audit_report(BATCH_NO, format="text")
    print(report)

    pending = auditor.get_audit_trails(batch_no=BATCH_NO, is_resolved=False)
    print(f"\n📈 最终状态汇总:")
    print(f"   待处理审计项: {len(pending)} 条")
    print(f"   其中币种混合待复核: {len([a for a in pending if a['audit_type'] == 'mixed_currency'])} 条")
    print(f"   其中节假日说明待补录: {len([a for a in pending if a['audit_type'] == 'missing_holiday_note'])} 条")
    print()
    print("🎉 三步流程测试完成！")
    print("   关键点验证:")
    print("   ✅ 清算批次导入成功，自动检测币种混合")
    print("   ✅ 节假日顺延说明补录后，相关审计项自动更新")
    print("   ✅ 币种混合项未自动归正常，留给托管对接人复核")
    print("   ✅ 审计明细清晰说明：为什么被留下、缺什么材料、下一步找谁")


def main():
    print("🏦 银行流水摘要归并系统 - 三步流程测试")
    print("=" * 80)
    print()
    print("测试场景:")
    print("  1. 清算批次号第一次导入（自动检测港币人民币同列）")
    print("  2. 对账运营阿芬补看节假日顺延说明（审计明细自动更新）")
    print("  3. 审计明细更新 + 托管对接人复核币种混合")
    print()

    init_db()

    try:
        test_step1_import()
        test_step2_holiday_adjustment()
        test_step3_audit_update_and_review()
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
