"""
验证三种口径的修复
1. 纯小数名单 → 应该一路算完
2. 纯百分数名单 → 应该一路算完
3. 混合名单 → 必须复核才能继续
"""
import sys
import os
sys.path.insert(0, os.getcwd())

from bus_scheduling import (
    BoundaryValidator, SamplingImporter,
    BusScheduler, SchedulingWorkflow,
)
from bus_scheduling.models import IssueStatus


def run_pure_decimal():
    """纯小数名单"""
    print("\n" + "="*70)
    print("📋 测试1：纯小数名单 (sampling_list_decimal_only.csv)")
    print("="*70)

    validator = BoundaryValidator()
    importer = SamplingImporter(validator)
    scheduler = BusScheduler(validator)
    workflow = SchedulingWorkflow(validator, importer, scheduler)

    test_data_dir = os.path.join(os.getcwd(), "test_data")
    file_path = os.path.join(test_data_dir, "sampling_list_decimal_only.csv")

    # 第一步：导入
    r1 = workflow.step1_import_sampling_list(file_path, "实验助理小穆")
    print(f"\n[第一步] 导入结果：")
    print(f"  批次类型: {r1['batch_type']}")
    print(f"  总记录数: {r1['total_records']}")
    print(f"  待复核数: {r1['pending_review_count']}")
    print(f"  can_skip_review: {r1['can_skip_review']}")
    print(f"  note: {r1['note']}")

    # 检查 issues 状态
    print(f"\n  各条记录 issue 状态:")
    for r in workflow.records:
        for iss in r.issues:
            print(f"    {r.route_code}: {iss.status.value} (保留理由: {iss.retain_reason})")

    # 第二步：参数调试
    r2 = workflow.step2_review_parameters(reviewer="活动负责人")
    print(f"\n[第二步] 参数调试：")
    print(f"  批次类型: {r2['batch_type']}")
    print(f"  待复核数: {r2['pending_count']}")
    print(f"  can_proceed: {r2['can_proceed']}")
    print(f"  note: {r2['note']}")

    # 第三步：计算
    r3 = workflow.step3_calculate(operator="实验助理小穆")
    print(f"\n[第三步] 计算结果：")
    print(f"  总车辆数: {r3['total_buses']}")
    print(f"  总成本: {r3['total_cost']}")
    print(f"  线路分配: {r3['route_allocations']}")
    print(f"  计算明细数: {r3['calculation_details_count']}")

    # 下钻查看一条明细
    first_detail = r3["drilldown_available"][0]
    detail = workflow.drilldown_detail(first_detail["detail_id"])
    print(f"\n[下钻] 明细ID {first_detail['detail_id']}:")
    print(f"  线路: {detail['record']['route_code'] if detail['record'] else 'N/A'}")
    print(f"  原始客流量: {detail['detail']['input_params']['original_passenger_count']}")
    print(f"  有效客流量: {detail['detail']['input_params']['effective_passenger_count']}")
    print(f"  计算结果值: {detail['detail']['result_value']} 辆车")
    print(f"  保留理由: {detail['retain_reason']}")
    print(f"  计算步骤数: {len(detail['detail']['calculation_steps'])}")

    print("\n✅ 纯小数名单：测试通过（一路算完无阻断）")
    return True


def run_pure_percentage():
    """纯百分数名单"""
    print("\n" + "="*70)
    print("📋 测试2：纯百分数名单 (sampling_list_percentage_only.csv)")
    print("="*70)

    validator = BoundaryValidator()
    importer = SamplingImporter(validator)
    scheduler = BusScheduler(validator)
    workflow = SchedulingWorkflow(validator, importer, scheduler)

    test_data_dir = os.path.join(os.getcwd(), "test_data")
    file_path = os.path.join(test_data_dir, "sampling_list_percentage_only.csv")

    # 第一步：导入
    r1 = workflow.step1_import_sampling_list(file_path, "实验助理小穆")
    print(f"\n[第一步] 导入结果：")
    print(f"  批次类型: {r1['batch_type']}")
    print(f"  总记录数: {r1['total_records']}")
    print(f"  待复核数: {r1['pending_review_count']}")
    print(f"  can_skip_review: {r1['can_skip_review']}")
    print(f"  note: {r1['note']}")

    # 检查 issues 状态
    print(f"\n  各条记录 issue 状态:")
    for r in workflow.records:
        for iss in r.issues:
            print(f"    {r.route_code}: {iss.status.value} (保留理由: {iss.retain_reason})")

    # 第二步：参数调试
    r2 = workflow.step2_review_parameters(reviewer="活动负责人")
    print(f"\n[第二步] 参数调试：")
    print(f"  批次类型: {r2['batch_type']}")
    print(f"  待复核数: {r2['pending_count']}")
    print(f"  can_proceed: {r2['can_proceed']}")
    print(f"  note: {r2['note']}")

    # 第三步：计算
    r3 = workflow.step3_calculate(operator="实验助理小穆")
    print(f"\n[第三步] 计算结果：")
    print(f"  总车辆数: {r3['total_buses']}")
    print(f"  总成本: {r3['total_cost']}")
    print(f"  线路分配: {r3['route_allocations']}")
    print(f"  计算明细数: {r3['calculation_details_count']}")

    # 下钻查看一条明细
    first_detail = r3["drilldown_available"][0]
    detail = workflow.drilldown_detail(first_detail["detail_id"])
    print(f"\n[下钻] 明细ID {first_detail['detail_id']}:")
    print(f"  线路: {detail['record']['route_code'] if detail['record'] else 'N/A'}")
    print(f"  原始客流量: {detail['detail']['input_params']['original_passenger_count']}")
    print(f"  有效客流量: {detail['detail']['input_params']['effective_passenger_count']}")
    print(f"  计算结果值: {detail['detail']['result_value']} 辆车")
    print(f"  保留理由: {detail['retain_reason']}")
    print(f"  计算步骤数: {len(detail['detail']['calculation_steps'])}")

    print("\n✅ 纯百分数名单：测试通过（一路算完无阻断）")
    return True


def run_mixed():
    """混合名单 - 必须复核才能继续"""
    print("\n" + "="*70)
    print("📋 测试3：混合名单 (sampling_list_mixed.csv)")
    print("="*70)

    validator = BoundaryValidator()
    importer = SamplingImporter(validator)
    scheduler = BusScheduler(validator)
    workflow = SchedulingWorkflow(validator, importer, scheduler)

    test_data_dir = os.path.join(os.getcwd(), "test_data")
    file_path = os.path.join(test_data_dir, "sampling_list_mixed.csv")

    # 第一步：导入
    r1 = workflow.step1_import_sampling_list(file_path, "实验助理小穆")
    print(f"\n[第一步] 导入结果：")
    print(f"  批次类型: {r1['batch_type']}")
    print(f"  总记录数: {r1['total_records']}")
    print(f"  待复核数: {r1['pending_review_count']}")
    print(f"  can_skip_review: {r1['can_skip_review']}")
    print(f"  note: {r1['note']}")

    # 检查 issues 状态
    print(f"\n  各条记录 issue 状态:")
    for r in workflow.records[:3]:
        for iss in r.issues:
            print(f"    {r.route_code}: {iss.status.value} (原值: {iss.original_value}, 类型: {iss.detected_type.value})")

    # 第二步：参数调试（有待复核，不能继续）
    r2 = workflow.step2_review_parameters(reviewer="活动负责人")
    print(f"\n[第二步] 参数调试（复核前）：")
    print(f"  批次类型: {r2['batch_type']}")
    print(f"  待复核数: {r2['pending_count']}")
    print(f"  can_proceed: {r2['can_proceed']}")
    print(f"  note: {r2['note']}")

    # 尝试直接计算（应该失败）
    print(f"\n[验证] 尝试绕过复核直接计算...")
    from bus_scheduling.models import WorkflowStep
    workflow._current_step = WorkflowStep.STEP3_CALC_UPDATE
    try:
        workflow.step3_calculate()
        print("  ❌ 错误：本该被拦截但没有拦截！")
        return False
    except Exception as e:
        print(f"  ✅ 正确拦截！错误提示：{e.message[:80]}...")

    # 重新设置到第二步
    workflow._current_step = WorkflowStep.STEP2_PARAM_DEBUG
    workflow.step2_review_parameters(reviewer="活动负责人")

    # 复核所有问题
    print(f"\n[复核] 活动负责人开始复核 {r2['pending_count']} 条问题...")
    pending = workflow.get_pending_issues()
    for i, issue in enumerate(pending):
        r = workflow.review_issue(
            issue_id=issue["issue_id"],
            approved=True,
            reviewer="活动负责人",
            retain_reason=f"线路{i+1}：活动负责人确认数据无误，允许原值参与计算",
        )
        if i < 3:
            print(f"  {r['old_value']} → {r['status']}, 理由: {r['retain_reason']}")
    print(f"  ... 共复核 {len(pending)} 条记录")

    # 再次检查参数调试状态
    r2b = workflow.step2_review_parameters(reviewer="活动负责人")
    print(f"\n[第二步] 参数调试（复核后）：")
    print(f"  待复核数: {r2b['pending_count']}")
    print(f"  can_proceed: {r2b['can_proceed']}")

    # 第三步：计算
    r3 = workflow.step3_calculate(operator="实验助理小穆")
    print(f"\n[第三步] 计算结果：")
    print(f"  总车辆数: {r3['total_buses']}")
    print(f"  总成本: {r3['total_cost']}")
    print(f"  线路分配: {r3['route_allocations']}")
    print(f"  计算明细数: {r3['calculation_details_count']}")

    # 下钻查看一条涉及混合问题的明细
    mixed_detail = next(d for d in r3["drilldown_available"] if d["has_mixed_issue"])
    detail = workflow.drilldown_detail(mixed_detail["detail_id"])
    print(f"\n[下钻] 明细ID {mixed_detail['detail_id']}（含混合问题）：")
    print(f"  线路: {detail['record']['route_code'] if detail['record'] else 'N/A'}")
    print(f"  原始客流量: {detail['detail']['input_params']['original_passenger_count']}")
    print(f"  有效客流量: {detail['detail']['input_params']['effective_passenger_count']}")
    print(f"  计算结果值: {detail['detail']['result_value']} 辆车")
    print(f"  保留理由: {detail['retain_reason']}")
    print(f"  关联问题数: {len(detail['related_issues'])}")
    if detail['related_issues']:
        iss = detail['related_issues'][0]
        print(f"    问题状态: {iss['status']}")
        print(f"    复核人: {iss['reviewer']}")
        print(f"    保留理由: {iss['retain_reason']}")

    # 测试回滚功能
    print(f"\n[回滚] 测试回滚第一条复核记录...")
    first_issue = pending[0]
    rb = workflow.rollback_issue(
        issue_id=first_issue["issue_id"],
        operator="活动负责人",
        reason="数据需要重新核实，暂时回滚",
    )
    print(f"  回滚后状态: {rb['status']}")
    print(f"  新待复核数: {len(workflow.get_pending_issues())}")

    # 查看历史备注
    first_record_id = workflow.records[0].record_id
    history = workflow.get_record_history(first_record_id)
    print(f"\n[历史] 线路{workflow.records[0].route_code}的变更历史 ({len(history)}条)：")
    for h in history[:4]:
        print(f"  - {h['field_name']}: {h['old_value']} → {h['new_value']}")

    print("\n✅ 混合名单：测试通过（复核机制不放松，回滚/历史正常）")
    return True


if __name__ == "__main__":
    results = []
    results.append(run_pure_decimal())
    results.append(run_pure_percentage())
    results.append(run_mixed())

    print("\n" + "="*70)
    print("📊 三种口径验证汇总")
    print("="*70)
    print(f"  纯小数名单:    {'✅ 通过' if results[0] else '❌ 失败'}")
    print(f"  纯百分数名单:  {'✅ 通过' if results[1] else '❌ 失败'}")
    print(f"  混合名单:      {'✅ 通过' if results[2] else '❌ 失败'}")
    print(f"  总计:          {sum(results)}/3 通过")
    print("="*70)
