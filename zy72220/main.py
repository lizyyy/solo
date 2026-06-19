import sys
from sample_data import (
    create_smooth_record,
    create_mixed_currency_record,
    create_old_caliber_record,
    create_conflict_record
)
from models import RecordStatus, Currency, ProcessingResult
from processing_engine import ProcessingEngine
from decision_support import (
    ConflictDisplayer,
    DecisionMaker,
    CustodianReviewer,
    CalcDisplayer
)


def print_separator(char="=", length=80):
    print(char * length)


def print_header(title):
    print_separator()
    print(f"  {title}")
    print_separator()


def print_record_summary(record, scenario_name):
    print(f"\n【{scenario_name}】处理结果摘要")
    print("-" * 40)
    print(f"  记录ID: {record.record_id}")
    print(f"  产品: {record.product_name} ({record.product_code})")
    print(f"  当前状态: {record.status.value}")
    print(f"  处理结果: {record.processing_result.value if record.processing_result else '待处理'}")
    print(f"  最终币种: {record.final_currency.value if record.final_currency else '待确认'}")
    print(f"  最终费率: {record.final_rate * 100:.4f}%" if record.final_rate else "  最终费率: 待确认")
    print(f"  生效日期: {record.final_effective_date or '待确认'}")
    print(f"  需托管复核: {'是' if record.need_custodian_review else '否'}")
    print(f"  存在冲突: {'是' if record.has_conflict else '否'}")
    print(f"  审计明细: {len(record.audit_details)} 条")
    print(f"  历史记录: {len(record.history_records)} 条")
    print(f"  专业计算: {len(record.professional_calcs)} 条")


def scenario_1_smooth():
    print_header("场景一：正常材料 - 顺利处理流程")
    
    engine = ProcessingEngine()
    record = create_smooth_record()
    
    print("\n>>> 第一步：客户经理补充邮件导入")
    record = engine.step1_import_email(record)
    print(f"状态变更: {RecordStatus.INITIAL.value} → {record.status.value}")
    print(f"说明: {record.audit_details[-1].change_content}")
    
    print("\n>>> 第二步：风控值班老秦补看清算批次号")
    record = engine.step2_check_settlement(record)
    print(f"状态变更: {RecordStatus.EMAIL_IMPORTED.value} → {record.status.value}")
    print(f"说明: {record.audit_details[-1].change_content}")
    
    print("\n>>> 查看专业计算明细")
    print(CalcDisplayer.display_calculations(record))
    
    print("\n>>> 第三步：审计明细更新")
    record = engine.step3_update_audit(record)
    print(f"状态变更: {RecordStatus.SETTLEMENT_CHECKED.value} → {record.status.value}")
    print(f"说明: {record.audit_details[-1].change_content}")
    
    print("\n>>> 审计明细与历史记录双向核对")
    print(CalcDisplayer.display_audit_history_alignment(record))
    
    print_record_summary(record, "场景一：正常材料")
    return record


def scenario_2_mixed_currency():
    print_header("场景二：港币人民币同列 - 待托管对接人复核")
    
    engine = ProcessingEngine()
    decision = DecisionMaker(engine)
    custodian = CustodianReviewer(engine)
    record = create_mixed_currency_record()
    
    print("\n>>> 第一步：客户经理补充邮件导入")
    record = engine.step1_import_email(record)
    print(f"状态变更: {RecordStatus.INITIAL.value} → {record.status.value}")
    print(f"说明: {record.audit_details[-1].change_content}")
    print(f"⚠  检测到港币人民币同列，已标记需托管复核，暂不归入正常")
    
    print("\n>>> 第二步：风控值班老秦补看清算批次号")
    record = engine.step2_check_settlement(record)
    print(f"状态保持: {record.status.value}")
    print(f"说明: {record.audit_details[-1].change_content}")
    
    print("\n>>> 第三步：审计明细更新")
    record = engine.step3_update_audit(record)
    print(f"状态保持: {record.status.value}")
    print(f"说明: {record.audit_details[-1].change_content}")
    
    print("\n>>> 托管对接人复核提示")
    print(custodian.display_review_prompt(record))
    
    print("\n>>> 模拟托管对接人复核（选择HKD港币）")
    record = custodian.review_mixed_currency(
        record=record,
        review_result=True,
        final_currency=Currency.HKD,
        reviewer="托管对接人孙丽"
    )
    print(f"状态变更: {RecordStatus.CUSTODIAN_PENDING.value} → {record.status.value}")
    print(f"说明: {record.audit_details[-1].change_content}")
    
    print("\n>>> 重新执行第二步和第三步（完成完整流程）")
    record = engine.step2_check_settlement(record)
    assert record.final_currency == Currency.HKD, (
        f"阻断性偏差：托管复核确认HKD后，final_currency被覆盖为{record.final_currency.value}"
    )
    print(f"✓  复核结论一致性检查通过：final_currency={record.final_currency.value}（与托管对接人复核选择一致）")
    record = engine.step3_update_audit(record)
    
    print_record_summary(record, "场景二：港币人民币同列")
    return record


def scenario_3_old_caliber():
    print_header("场景三：旧口径补录材料 - 从清算批次号补来的旧口径")
    
    engine = ProcessingEngine()
    record = create_old_caliber_record()
    
    print("\n>>> 第一步：客户经理补充邮件导入")
    record = engine.step1_import_email(record)
    print(f"状态变更: {RecordStatus.INITIAL.value} → {record.status.value}")
    print(f"说明: {record.audit_details[-1].change_content}")
    
    print("\n>>> 第二步：风控值班老秦补看清算批次号")
    print(f"⚠  检测到清算批次 {record.settlement_batch.batch_no} 为旧口径版本 {record.settlement_batch.caliber_version}")
    record = engine.step2_check_settlement(record)
    print(f"状态变更: {RecordStatus.EMAIL_IMPORTED.value} → {record.status.value}")
    print(f"说明: {record.audit_details[-1].change_content}")
    
    print("\n>>> 查看专业计算明细（使用旧口径参数）")
    print(CalcDisplayer.display_calculations(record))
    
    print("\n>>> 第三步：审计明细更新")
    record = engine.step3_update_audit(record)
    print(f"状态变更: {RecordStatus.SETTLEMENT_CHECKED.value} → {record.status.value}")
    print(f"说明: {record.audit_details[-1].change_content}")
    
    print("\n>>> 审计明细与历史记录双向核对")
    print(CalcDisplayer.display_audit_history_alignment(record))
    
    print_record_summary(record, "场景三：旧口径补录")
    return record


def scenario_4_conflict():
    print_header("场景四：冲突材料 - 邮件与清算批次互相矛盾")
    
    engine = ProcessingEngine()
    displayer = ConflictDisplayer()
    decision = DecisionMaker(engine)
    record = create_conflict_record()
    
    print("\n>>> 第一步：客户经理补充邮件导入")
    record = engine.step1_import_email(record)
    print(f"状态变更: {RecordStatus.INITIAL.value} → {record.status.value}")
    print(f"说明: {record.audit_details[-1].change_content}")
    
    print("\n>>> 第二步：风控值班老秦补看清算批次号")
    record = engine.step2_check_settlement(record)
    print(f"状态变更: {RecordStatus.EMAIL_IMPORTED.value} → {record.status.value}")
    print(f"说明: {record.audit_details[-1].change_content}")
    
    print("\n>>> 冲突证据展示")
    print(displayer.display_conflicts(record))
    
    print("\n>>> 第三步：审计明细更新（因冲突挂起）")
    record = engine.step3_update_audit(record)
    print(f"状态保持: {record.status.value}")
    print(f"说明: {record.audit_details[-1].change_content}")
    
    print("\n>>> 风控值班老秦决策（选择 REJECT 驳回邮件，采用清算数据）")
    print("⚠  系统不自动拍板，必须由风控值班老秦人工决策")
    record = decision.resolve_conflict(
        record=record,
        decision="REJECT",
        decision_maker="风控值班老秦"
    )
    print(f"状态变更: {RecordStatus.CONFLICT.value} → {record.status.value}")
    print(f"说明: {record.audit_details[-1].change_content}")
    print(f"决策人: {record.final_decision_maker}")
    print(f"决策时间: {record.final_decision_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    print("\n>>> 重新执行第三步（完成审计更新）")
    record = engine.step3_update_audit(record)
    
    print("\n>>> 审计明细与历史记录双向核对")
    print(CalcDisplayer.display_audit_history_alignment(record))
    
    print_record_summary(record, "场景四：冲突决策")
    return record


def print_final_summary(results):
    print_header("四种场景处理结果对比")
    
    scenarios = [
        ("场景一：正常材料", "顺利处理"),
        ("场景二：港币人民币同列", "待托管复核→完成"),
        ("场景三：旧口径补录", "旧口径处理"),
        ("场景四：冲突决策", "冲突→人工驳回→完成")
    ]
    
    print(f"{'场景':<25} {'处理结果':<20} {'最终状态':<15} {'审计数':<8} {'历史数':<8} {'冲突':<6}")
    print("-" * 90)
    
    for i, (record, (name, expected)) in enumerate(zip(results, scenarios), 1):
        result = record.processing_result.value if record.processing_result else "N/A"
        status = record.status.value
        audit_count = len(record.audit_details)
        hist_count = len(record.history_records)
        has_conflict = "是" if record.has_conflict else "否"
        
        status_icon = "✓" if record.status in [RecordStatus.AUDIT_UPDATED, RecordStatus.REJECTED, RecordStatus.CONFIRMED] else "⚠"
        print(f"{status_icon} {name:<22} {result:<20} {status:<15} {audit_count:<8} {hist_count:<8} {has_conflict:<6}")
    
    print()
    print_separator()
    print("  关键验证点检查")
    print_separator()
    
    checks = [
        ("三步流程完整性", all(
            len(r.audit_details) >= 3 for r in results
        )),
        ("审计与历史记录对齐", all(
            r.status not in [RecordStatus.REJECTED, RecordStatus.CONFIRMED]
            and len(r.audit_details) > 2 and len(r.history_records) > 2
            for r in results
        )),
        ("港币人民币同列不自动处理", results[1].need_custodian_review == True or 
         (results[1].custodian_review_result == True and results[1].custodian_reviewer is not None)),
        ("冲突不自动拍板", results[3].final_decision_maker == "风控值班老秦"),
        ("旧口径使用旧参数", any(
            calc.parameter_version == "PARAM-2026-Q1-LEGACY" 
            for calc in results[2].professional_calcs
        )),
        ("专业计算参数版本留痕", all(
            len(r.professional_calcs) > 0 and r.professional_calcs[0].parameter_version
            for r in [results[0], results[2]]
        )),
        ("三种处理结果不同", len(set(
            r.processing_result for r in results[:3]
        )) == 3)
    ]
    
    for check_name, passed in checks:
        status = "✓ 通过" if passed else "✗ 失败"
        print(f"  {status} - {check_name}")
    
    print_separator()


def main():
    print("\n" + "=" * 80)
    print("  理财产品费率版本回看 - 业务处理系统演示")
    print("  验证：审计明细、历史记录、三种处理结果差异")
    print("=" * 80)
    
    results = []
    
    print("\n" + "=" * 80)
    print("  开始执行场景演示...")
    print("=" * 80)
    
    results.append(scenario_1_smooth())
    print()
    
    results.append(scenario_2_mixed_currency())
    print()
    
    results.append(scenario_3_old_caliber())
    print()
    
    results.append(scenario_4_conflict())
    print()
    
    print_final_summary(results)
    
    print("\n✅ 所有场景执行完成！")
    print("   重点检查项：")
    print("   1. 审计明细与历史记录是否双向对得上")
    print("   2. 三种处理结果（顺利、待复核、旧口径）是否不同")
    print("   3. 港币人民币同列是否留给托管对接人复核")
    print("   4. 冲突是否列出证据，由老秦选确认/驳回")
    print("   5. 专业计算参数版本和取舍理由是否留在结果旁")
    print("   6. 三步流程（导入→补看→更新）是否完整走完")
    print()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
