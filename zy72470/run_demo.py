from models import RecordStatus
from processor import RiverbankRiskProcessor
from sample_data import (
    create_sample_1_normal,
    create_sample_2_no_original,
    create_sample_3_old_caliber_conflict,
)


def print_separator(title: str):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_record_summary(record):
    print(f"\n【记录ID】 {record.record_id}")
    print(f"【位置】 {record.location}")
    print(f"【当前状态】 {record.status}")
    print(f"【最终风险等级】 {record.final_risk_level}")
    print(f"【最终风险描述】 {record.final_description}")

    if record.resident_opinion:
        print(f"\n--- 居民意见 ---")
        print(f"  摘要: {record.resident_opinion.summary}")
        print(f"  有原文: {'是' if record.resident_opinion.has_original else '否'}")
        if record.resident_opinion.original_text:
            print(f"  原文: {record.resident_opinion.original_text}")
        else:
            print("  原文: (无，只剩汇总)")

    if record.redline_remark:
        print(f"\n--- 红线图备注 ---")
        print(f"  版本: {record.redline_remark.redline_version}")
        print(f"  风险等级: {record.redline_remark.risk_level}")
        print(f"  风险描述: {record.redline_remark.risk_description}")

    if record.grid_inspection:
        print(f"\n--- 网格员巡查表 ---")
        print(f"  巡查员: {record.grid_inspection.inspector}")
        print(f"  风险等级: {record.grid_inspection.risk_level}")
        print(f"  风险描述: {record.grid_inspection.risk_description}")
        print(f"  旧口径补录: {'是' if record.grid_inspection.is_old_caliber else '否'}")

    if record.professional_calcs:
        print(f"\n--- 专业计算 ---")
        for calc in record.professional_calcs:
            print(f"  [{calc.calc_name}]")
            print(f"    参数版本: {calc.param_version}")
            print(f"    参数: {calc.params}")
            print(f"    结果: {calc.result}")
            print(f"    取舍理由: {calc.trade_off_reason}")

    if record.conflicts:
        print(f"\n--- 冲突证据 ---")
        for c in record.conflicts:
            print(f"  冲突字段: {c.field_name}")
            print(f"    {c.source_a}: {c.value_a}")
            print(f"    {c.source_b}: {c.value_b}")
            print(f"    说明: {c.description}")

    print(f"\n--- 处理历史 ---")
    for i, step in enumerate(record.processing_history, 1):
        print(f"  {i}. [{step.step_name}]")
        print(f"     操作人: {step.operator}")
        print(f"     动作: {step.action}")
        print(f"     备注: {step.remark}")


def print_conflict_review_table(processor):
    print_separator("冲突复核表")
    if not processor.conflict_review_table:
        print("暂无冲突记录")
        return

    for item in processor.conflict_review_table:
        print(f"\n【复核ID】 {item.review_id}")
        print(f"【关联记录】 {item.record_id} - {item.location}")
        print(f"【操作人】 {item.operator}")
        print(f"【决策】 {item.decision or '待处理'}")
        if item.decision_remark:
            print(f"【决策说明】 {item.decision_remark}")
        print(f"【冲突详情】")
        for c in item.conflicts:
            print(f"  - {c.field_name}: {c.source_a}({c.value_a}) vs {c.source_b}({c.value_b})")


def run_sample_1_normal():
    print_separator("样例1：正常记录（有原文、口径一致）")

    processor = RiverbankRiskProcessor()
    record, redline, grid, calc = create_sample_1_normal()

    if calc:
        record = processor.add_professional_calc(record, calc)

    record, review_item = processor.process_full_flow(record, redline, grid)

    print_record_summary(record)
    print_conflict_review_table(processor)

    print(f"\n>>> 处理结果：状态 = {record.status}")
    assert record.status == RecordStatus.NORMAL
    assert record.final_risk_level is not None
    assert len(record.conflicts) == 0
    print(">>> 验证通过：正常记录流程正确")


def run_sample_2_no_original():
    print_separator("样例2：居民意见只剩汇总没有原文（待社区书记复核）")

    processor = RiverbankRiskProcessor()
    record, redline, grid, calc = create_sample_2_no_original()

    record, review_item = processor.process_full_flow(record, redline, grid)

    print_record_summary(record)
    print_conflict_review_table(processor)

    print(f"\n>>> 处理结果：状态 = {record.status}")
    assert record.status == RecordStatus.PENDING_REVIEW
    assert "居民意见只剩汇总没有原文" in str(
        record.processing_history
    )
    print(">>> 验证通过：待复核状态正确，不归为正常")


def run_sample_3_old_caliber_conflict():
    print_separator("样例3：旧口径补录 + 冲突（需阿宁确认或驳回）")

    processor = RiverbankRiskProcessor()
    record, redline, grid, calc = create_sample_3_old_caliber_conflict()

    if calc:
        record = processor.add_professional_calc(record, calc)

    record, review_item = processor.process_full_flow(record, redline, grid)

    print_record_summary(record)
    print_conflict_review_table(processor)

    print(f"\n>>> 处理结果：状态 = {record.status}")
    assert record.status == RecordStatus.CONFLICT
    assert len(record.conflicts) > 0
    assert review_item is not None
    print(">>> 验证通过：冲突已检测，等待人工决策")

    print_separator("模拟：阿宁选择'确认'网格员巡查表（采纳旧口径）")
    review_item, record = processor.resolve_conflict(
        review_item,
        decision="确认",
        decision_remark="核实现场确无标识牌，旧口径记录属实，采纳网格员巡查结果",
        record=record,
    )

    print_record_summary(record)
    print_conflict_review_table(processor)

    print(f"\n>>> 确认后状态：{record.status}")
    print(f">>> 最终风险等级：{record.final_risk_level}")
    assert record.status == RecordStatus.CONFIRMED
    assert record.final_risk_level == grid.risk_level
    print(">>> 验证通过：确认后状态更新正确，采纳网格员巡查表结果")


def main():
    print_separator("河岸步道亲水风险 - 业务处理演示")
    print("  三种场景：正常 / 无原文待复核 / 旧口径冲突")

    run_sample_1_normal()
    run_sample_2_no_original()
    run_sample_3_old_caliber_conflict()

    print_separator("全部样例执行完毕")
    print("""
  三种处理结果对比：
  ┌──────────────┬──────────────────┬────────────────────────┐
  │ 样例类型     │ 最终状态         │ 关键特征               │
  ├──────────────┼──────────────────┼────────────────────────┤
  │ 正常记录     │ 正常             │ 有原文、口径一致       │
  │ 无原文       │ 待社区书记复核   │ 居民意见只剩汇总       │
  │ 旧口径+冲突  │ 存在冲突→已确认  │ 先列证据，阿宁拍板     │
  └──────────────┴──────────────────┴────────────────────────┘
    """)


if __name__ == "__main__":
    main()
