#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
供应链账期滚动预测 - 完整工作流演示
场景: 基金经理晚上催结果，风控值班老秦处理清算批次号
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from datetime import datetime
from pprint import pprint

from src.io.handlers import ForecastImporter, ForecastExporter, DuplicateDetector
from src.workflow.orchestrator import WorkflowOrchestrator
from src.models import MaterialType, WorkflowStepStatus
from src.checks.self_check import SelfCheckEngine


def print_separator(title: str):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80 + "\n")


def print_subtitle(title: str):
    print("\n" + "-" * 80)
    print(f"  {title}")
    print("-" * 80)


def main():
    print_separator("供应链账期滚动预测 - 完整演示")
    print(f"演示时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("场景: 基金经理晚上催结果，风控值班老秦只能翻清算批次号")
    print("重点: T+1到账被手工改成T+2，结论不敢直接发")

    duplicate_detector = DuplicateDetector()
    importer = ForecastImporter(duplicate_detector)
    orchestrator = WorkflowOrchestrator()
    self_check_engine = SelfCheckEngine()
    exporter = ForecastExporter()

    print_separator("第一步: 导入三份材料（正常、错口径、补录）")

    print_subtitle("1.1 导入正常材料")
    normal_dataset = importer.import_sample(
        "batch_20260530_normal.json",
        MaterialType.NORMAL,
        import_user="风控值班老秦"
    )
    print(f"✓ 正常材料导入成功")
    print(f"  批次号: {normal_dataset.batch.batch_id}")
    print(f"  记录数: {normal_dataset.batch.record_count}")
    print(f"  总金额: {normal_dataset.batch.total_amount:,.2f}")
    print(f"  是否重复: {normal_dataset.batch.is_duplicate}")

    print_subtitle("1.2 导入错口径材料（T+1被手工改成T+2）")
    wrong_dataset = importer.import_sample(
        "batch_20260530_wrong_dimension.json",
        MaterialType.WRONG_DIMENSION,
        import_user="风控值班老秦"
    )
    print(f"✓ 错口径材料导入成功")
    print(f"  批次号: {wrong_dataset.batch.batch_id}")
    print(f"  记录数: {wrong_dataset.batch.record_count}")
    print(f"  是否重复: {wrong_dataset.batch.is_duplicate}")
    if wrong_dataset.batch.is_duplicate:
        print(f"  ⚠️  与批次{wrong_dataset.batch.duplicate_of_batch}重复")

    print_subtitle("1.3 导入补录材料")
    supplementary_dataset = importer.import_sample(
        "batch_20260530_supplementary.json",
        MaterialType.SUPPLEMENTARY,
        import_user="风控值班老秦"
    )
    print(f"✓ 补录材料导入成功")
    print(f"  批次号: {supplementary_dataset.batch.batch_id}")
    print(f"  记录数: {supplementary_dataset.batch.record_count}")
    print(f"  总金额: {supplementary_dataset.batch.total_amount:,.2f}")

    print_separator("第二步: 以错口径材料为主线运行三步工作流")
    print("重点关注: T+1到账被手工改成T+2，清算批次号与节假日顺延说明的矛盾")

    dataset = wrong_dataset
    orchestrator.initialize_workflow(dataset)

    print_subtitle("工作流第一步: 清算批次号第一次导入")
    step1_result = orchestrator.step_1_import_settlement_batch(dataset, "风控值班老秦")
    print(f"状态: {step1_result['status']}")
    print(f"发现T+1→T+2修改记录: {step1_result['modified_records']}条")
    print(f"生成冲突证据: {step1_result['conflicts_created']}条")
    print(f"需要经理复核: {'是' if step1_result['needs_manager_review'] else '否'}")
    print(f"T+1改T+2记录ID: {', '.join(step1_result['t1_to_t2_record_ids'])}")

    if step1_result["conflicts"]:
        print("\n⚠️  冲突证据列表（需要风控值班老秦选择确认或驳回）:")
        for conflict in step1_result["conflicts"]:
            print(f"\n  冲突ID: {conflict['conflict_id']}")
            print(f"  记录ID: {conflict['record_id']}")
            print(f"  类型: {conflict['conflict_type']}")
            print(f"  描述: {conflict['description']}")
            print(f"  {conflict['field_a']}")
            print(f"  {conflict['field_b']}")
            print(f"  ⚠️  {conflict['warning']}")
            print(f"  选项:")
            for opt in conflict["options"]:
                print(f"    [{opt['action']}] {opt['label']}")

    print_subtitle("工作流第一步: 交互式冲突处理（风控值班老秦选择）")
    print("  REC-003: 儿童节不是法定节假日，顺延说明错误 → 驳回，恢复T+1")
    print("  REC-005: 端午节顺延说明正确 → 确认T+2生效")

    for conflict in dataset.conflicts:
        if conflict.record_id == "REC-003":
            action = "reject"
            review_note = "儿童节不是法定节假日，银行正常营业，驳回T+2修改，恢复T+1"
        elif conflict.record_id == "REC-005":
            action = "confirm"
            review_note = "端午节(6月1日)及调休(6月2日)确为法定假期，银行不处理对公业务，确认T+2顺延至6月3日"
        else:
            continue

        result = orchestrator.resolve_conflict_interactive(
            dataset, conflict.conflict_id, action, "风控值班老秦", review_note
        )
        status = "✓" if result["success"] else "✗"
        print(f"  {status} 冲突{conflict.conflict_id} ({conflict.record_id}): "
              f"{action} → {result['resolution_status']}")

    workflow_summary = orchestrator.get_workflow_summary(dataset)
    print(f"\n冲突处理后状态:")
    print(f"  待处理冲突: {len(workflow_summary['pending_conflicts'])}条")
    print(f"  需要经理复核: {'是' if workflow_summary['requires_manager_review'] else '否'}")

    print_subtitle("工作流第二步: 风控值班老秦补看节假日顺延说明")
    step2_result = orchestrator.step_2_review_holiday_deferral(dataset, "风控值班老秦")
    print(f"状态: {step2_result['status']}")
    print(f"涉及节假日顺延记录: {step2_result['records_with_deferral']}条")
    print(f"节假日顺延冲突: {step2_result['holiday_conflicts']}条")

    for record in dataset.records:
        if record.holiday_deferral_applies:
            print(f"\n  记录{record.record_id} ({record.supplier_name}):")
            print(f"    当前账期: {record.current_settlement_cycle.value}")
            print(f"    预计到账日: {record.expected_arrival_date}")
            print(f"    顺延说明: {record.holiday_deferral_explanation}")
            print(f"    修改状态: {record.modification_status.value}")

    print_subtitle("工作流第三步: 对账说明更新")
    step3_result = orchestrator.step_3_update_reconciliation(dataset, "风控值班老秦")
    print(f"状态: {step3_result['status']}")
    if step3_result["status"] == "blocked":
        print(f"原因: {step3_result['reason']}")
        print("⚠️  前序步骤有待处理冲突，无法继续第三步")
    else:
        print(f"总记录数: {step3_result['total_records']}")
        print(f"有对账说明记录: {step3_result['records_with_notes']}条")
        print(f"已对账记录: {step3_result['records_reconciled']}条")
        print(f"不匹配记录: {step3_result['records_mismatch']}条")
        print(f"自动新增对账说明: {step3_result['notes_added']}条")
        print(f"工作流完成: {'是' if step3_result['workflow_complete'] else '否'}")
        print(f"报告可发布: {'是' if step3_result['final_report_ready'] else '否'}")

        if step3_result["consistency_issues"]:
            print("\n历史一致性问题:")
            for issue in step3_result["consistency_issues"]:
                print(f"  记录{issue['record_id']} ({issue['supplier_name']}):")
                for detail in issue["issues"]:
                    print(f"    - {detail}")

    print_separator("第三步: 运行四项基本自检")
    print("覆盖: 重复导入、T+1改T+2、补录后重算、导出一致")

    check_report = self_check_engine.run_all_checks(
        dataset, supplementary_dataset
    )

    check_summary = self_check_engine.get_check_summary(check_report)
    print(f"总体结果: {'✅ 通过' if check_summary['overall_pass'] else '❌ 未通过'}")
    print(f"通过检查: {check_summary['passed_checks']}/{check_summary['total_checks']}")
    if check_summary['critical_failures']:
        print(f"严重失败: {check_summary['critical_failures']}项")
    if check_summary['high_failures']:
        print(f"高风险失败: {check_summary['high_failures']}项")

    for result in check_report.results:
        status = "✅" if result.passed else "❌"
        print(f"\n  {status} {result.check_name}")
        print(f"     严重程度: {result.severity}")
        print(f"     消息: {result.message}")
        if result.evidence:
            print(f"     证据:")
            for ev in result.evidence:
                print(f"       - {ev}")
        if result.recommendation:
            print(f"     建议: {result.recommendation}")

    print_separator("第四步: 运行三份材料对比分析")
    print_subtitle("正常材料 vs 错口径材料 vs 补录材料")

    datasets = [
        ("正常材料", normal_dataset),
        ("错口径材料", wrong_dataset),
        ("补录材料", supplementary_dataset),
    ]

    for name, ds in datasets:
        modified = [r for r in ds.records if r.is_manually_modified]
        t1_to_t2 = [r for r in modified
                    if r.original_settlement_cycle.value == "T+1"
                    and r.current_settlement_cycle.value == "T+2"]
        reconciled = [n for n in ds.reconciliation_notes if n.is_reconciled]
        print(f"\n  {name}:")
        print(f"    记录数: {len(ds.records)}")
        print(f"    总金额: {ds.batch.total_amount:,.2f}")
        print(f"    手工修改记录: {len(modified)}条")
        print(f"    T+1→T+2记录: {len(t1_to_t2)}条")
        print(f"    对账说明: {len(ds.reconciliation_notes)}条")
        print(f"    已对账: {len(reconciled)}条")

    print_separator("第五步: 导出最终报告")

    json_path = exporter.export_to_json(dataset)
    print(f"✓ JSON数据导出: {json_path}")

    report_path = exporter.export_report_to_txt(dataset, check_report)
    print(f"✓ TXT分析报告导出: {report_path}")

    print_separator("第六步: 最终检查 - 留给基金经理复核")

    print_subtitle("🔒 待基金经理复核的记录")
    pending_manager = [r for r in dataset.records
                       if r.modification_status.value == "confirmed"
                       and r.is_manually_modified]
    for r in pending_manager:
        print(f"\n  记录{r.record_id} ({r.supplier_name}):")
        print(f"    原始账期: {r.original_settlement_cycle.value} → "
              f"当前账期: {r.current_settlement_cycle.value}")
        print(f"    原始到账日: {r.original_arrival_date} → "
              f"预计到账日: {r.expected_arrival_date}")
        print(f"    修改原因: {r.modification_reason}")
        print(f"    修改人: {r.modified_by}")
        print(f"    审核状态: {r.modification_status.value}")
        print(f"    风控审核备注: {r.review_note}")
        print(f"    🔒 待基金经理最终确认后才能对外发布")

    print_subtitle("✅ 可直接发布的记录")
    normal_records = [r for r in dataset.records
                      if not r.is_manually_modified
                      or r.modification_status.value == "normal"]
    for r in normal_records:
        print(f"  ✓ {r.record_id}: {r.supplier_name} - "
              f"{r.current_settlement_cycle.value} - "
              f"{r.expected_arrival_date}")

    print_separator("工作流完成总结")
    final_summary = orchestrator.get_workflow_summary(dataset)
    print(f"批次号: {final_summary['batch_id']}")
    print(f"当前步骤: {final_summary['current_step_index']}/3")
    print(f"工作流完成: {'是' if final_summary['is_complete'] else '否'}")
    print(f"报告可发布: {'是' if final_summary['final_report_ready'] else '否'}")
    print(f"需要经理复核: {'是' if final_summary['requires_manager_review'] else '否'}")
    print(f"T+1改T+2记录: {', '.join(final_summary['t1_to_t2_records']) if final_summary['t1_to_t2_records'] else '无'}")
    print(f"待处理冲突: {len(final_summary['pending_conflicts'])}条")

    print("\n" + "=" * 80)
    print("  演示完成！")
    print("  核心原则: 碰到T+1到账被手工改成T+2时，别急着归正常，留给基金经理复核")
    print("  风控值班老秦的职责: 列出冲突证据，选择确认或驳回，不替业务同事自动拍板")
    print("=" * 80 + "\n")

    print(f"生成的报告文件:")
    print(f"  1. {json_path}")
    print(f"  2. {report_path}")
    print(f"\n请查看报告文件了解完整细节。")


if __name__ == "__main__":
    main()
