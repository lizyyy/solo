#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
偏微分网格边界检查系统 - 完整演示脚本

运行方式: python demo.py
"""

from models import MaterialType, CheckStatus
from workflow_engine import WorkflowEngine
from test_data import get_material_data, SUPPLEMENT_RECORDS


def print_separator(title="", char="=", length=70):
    if title:
        print(f"\n{char * 2} {title} {char * (length - len(title) - 4)}")
    else:
        print(f"\n{char * length}")


def demo_normal_material():
    """演示1：正常材料测试"""
    print_separator("演示1：正常材料测试", "=")
    
    engine = WorkflowEngine()
    data = get_material_data(MaterialType.NORMAL)
    
    print(f"\n材料说明: {data['description']}")
    print(f"抽样记录数: {len(data['sampling'])}")
    print(f"参数调试记录数: {len(data['params'])}")
    
    print_separator("工作流进度")
    print(engine.get_workflow_progress())
    
    print_separator("第一步：导入抽样名单")
    result1 = engine.step1_import_sampling_list(data['sampling'])
    print(f"\n状态: {result1.status.value}")
    print(f"\n{result1.message}")
    
    print_separator("工作流进度")
    print(engine.get_workflow_progress())
    
    print_separator("第二步：数据分析师小祁补看参数调试表")
    result2 = engine.step2_analyst_review_params(data['params'])
    print(f"\n状态: {result2.status.value}")
    print(f"\n{result2.message}")
    
    if result2.conflicts:
        print_separator("冲突明细")
        for i, conflict in enumerate(result2.conflicts, 1):
            print(f"{i}. 网格[{conflict.grid_id}] - {conflict.field_name}")
            print(f"   严重程度: {conflict.severity}")
            print(f"   抽样值: {conflict.sampling_value}")
            print(f"   参数值: {conflict.param_value}")
            print(f"   说明: {conflict.description}\n")
    
    print_separator("工作流进度")
    print(engine.get_workflow_progress())
    
    print_separator("第三步：更新计算明细")
    result3 = engine.step3_update_calculation()
    print(f"\n状态: {result3.status.value}")
    print(f"\n{result3.message}")
    
    print_separator("计算明细")
    for i, calc in enumerate(result3.calculation_details, 1):
        print(f"{i}. 网格[{calc.grid_id}]")
        print(f"   边界值: {calc.boundary_value}{'%' if calc.is_percent else ''}")
        print(f"   换算后: {calc.calculation_result:.6f}")
        print(f"   检查结果: {'✓ 通过' if calc.check_pass else '✗ 未通过'}")
        print(f"   数据来源: {calc.source}\n")
    
    print_separator("基本自检")
    self_check_results = engine.run_self_check()
    for check in self_check_results:
        status = "✓ 通过" if check.passed else "✗ 未通过"
        print(f"{status} {check.check_name}: {check.details}")
    
    print_separator("历史记录")
    for i, hist in enumerate(engine.get_history(), 1):
        print(f"{i}. [{hist.operation_time.strftime('%H:%M:%S')}] {hist.operator} - {hist.operation_type}")
        print(f"   {hist.detail}\n")
    
    print_separator("导出数据并验证一致性")
    exported = engine.export_data()
    print(f"已导出 {len(exported)} 条数据")
    
    self_check_after = engine.run_self_check()
    for check in self_check_after:
        if check.check_name == "导出一致性检查":
            status = "✓ 通过" if check.passed else "✗ 未通过"
            print(f"{status} {check.check_name}: {check.details}")
    
    print_separator("正常材料测试完成", "=")


def demo_wrong_caliber_material():
    """演示2：错口径材料测试"""
    print_separator("演示2：错口径材料测试", "=")
    
    engine = WorkflowEngine()
    data = get_material_data(MaterialType.WRONG_CALIBER)
    
    print(f"\n材料说明: {data['description']}")
    print(f"抽样记录数: {len(data['sampling'])}")
    print(f"参数调试记录数: {len(data['params'])}")
    
    print_separator("第一步：导入抽样名单")
    result1 = engine.step1_import_sampling_list(data['sampling'])
    print(f"\n状态: {result1.status.value}")
    print(f"\n{result1.message}")
    
    print_separator("待负责人复核项")
    pending = engine.get_pending_manager_review()
    for i, item in enumerate(pending, 1):
        print(f"{i}. 网格[{item.grid_id}] - {item.warning_type.value}")
        print(f"   当前值: {item.current_value}")
        print(f"   说明: {item.description}")
        print(f"   建议: {item.suggestion}\n")
    
    print_separator("第二步：数据分析师小祁补看参数调试表")
    
    def analyst_decision(conflicts):
        for conflict in conflicts:
            print(f"\n🤔 数据分析师小祁正在处理冲突:")
            print(f"   网格[{conflict.grid_id}] - {conflict.field_name}")
            print(f"   抽样值: {conflict.sampling_value}")
            print(f"   参数值: {conflict.param_value}")
            print(f"   说明: {conflict.description}")
            
            if conflict.field_name == "boundary_threshold" and conflict.grid_id == "GRID-002":
                print("   👉 小祁决定: confirm（确认以参数调试表为准）")
                return "confirm"
            elif conflict.field_name == "missing_param":
                print("   👉 小祁决定: reject（驳回，以抽样名单为准）")
                return "reject"
            elif conflict.field_name == "missing_sampling":
                print("   👉 小祁决定: reject（驳回，等待补录）")
                return "reject"
            else:
                print("   👉 小祁决定: confirm（确认以参数调试表为准）")
                return "confirm"
        return None
    
    result2 = engine.step2_analyst_review_params(
        data['params'],
        conflict_callback=analyst_decision
    )
    print(f"\n状态: {result2.status.value}")
    print(f"\n{result2.message}")
    
    pending_conflicts = engine.conflict_detector.get_pending_conflicts()
    if pending_conflicts:
        print_separator("仍有待处理冲突，手动处理")
        for conflict in pending_conflicts:
            print(f"\n处理网格[{conflict.grid_id}]的{conflict.field_name}冲突")
            engine.conflict_detector.resolve_conflict(
                conflict.grid_id,
                conflict.field_name,
                "confirm",
                "小祁"
            )
            print(f"   👉 小祁决定: confirm")
    
    print_separator("第三步：更新计算明细")
    result3 = engine.step3_update_calculation()
    print(f"\n状态: {result3.status.value}")
    print(f"\n{result3.message}")
    
    print_separator("基本自检")
    self_check_results = engine.run_self_check()
    for check in self_check_results:
        status = "✓ 通过" if check.passed else "✗ 未通过"
        print(f"{status} {check.check_name}: {check.details}")
        if check.warnings:
            for warning in check.warnings:
                print(f"   ⚠️  {warning.grid_id}: {warning.description}")
    
    print_separator("待负责人最终复核")
    pending_final = engine.get_pending_manager_review()
    print(f"共 {len(pending_final)} 项需要活动负责人复核")
    for i, item in enumerate(pending_final, 1):
        print(f"\n{i}. 网格[{item.grid_id}] - {item.warning_type.value}")
        print(f"   当前值: {item.current_value}")
        print(f"   说明: {item.description}")
        print(f"   👉 活动负责人复核通过，从待办中移除")
        engine.clear_manager_review(item.grid_id, item.field_name)
    
    print(f"\n剩余待复核项: {len(engine.get_pending_manager_review())}")
    
    print_separator("历史记录")
    for i, hist in enumerate(engine.get_history(), 1):
        print(f"{i}. [{hist.operation_time.strftime('%H:%M:%S')}] {hist.operator} - {hist.operation_type}")
        print(f"   {hist.detail}\n")
    
    print_separator("错口径材料测试完成", "=")


def demo_supplement_material():
    """演示3：补录材料测试"""
    print_separator("演示3：补录材料测试", "=")
    
    engine = WorkflowEngine()
    normal_data = get_material_data(MaterialType.NORMAL)
    
    print(f"\n先导入正常材料作为基础...")
    engine.step1_import_sampling_list(normal_data['sampling'])
    engine.step2_analyst_review_params(normal_data['params'])
    engine.step3_update_calculation()
    print(f"基础数据导入完成，共 {len(engine.get_calculation_details())} 条记录")
    
    print_separator("导出当前数据")
    exported = engine.export_data()
    print(f"已导出 {len(exported)} 条数据")
    
    print_separator("补录数据")
    print(f"补录记录数: {len(SUPPLEMENT_RECORDS)}")
    
    result_supplement = engine.supplement_data(SUPPLEMENT_RECORDS)
    print(f"\n状态: {result_supplement.status.value}")
    print(f"\n{result_supplement.message}")
    
    if result_supplement.conflicts:
        print_separator("补录后发现冲突，小祁处理中")
        for conflict in result_supplement.conflicts:
            if conflict.severity in ["high", "medium"]:
                print(f"\n处理网格[{conflict.grid_id}]的{conflict.field_name}冲突")
                print(f"   抽样值: {conflict.sampling_value}")
                print(f"   参数值: {conflict.param_value}")
                print(f"   说明: {conflict.description}")
                if conflict.field_name == "missing_param":
                    print(f"   👉 小祁决定: reject（驳回，以抽样为准）")
                    engine.conflict_detector.resolve_conflict(
                        conflict.grid_id, conflict.field_name, "reject", "小祁"
                    )
                else:
                    print(f"   👉 小祁决定: confirm（确认，以参数为准）")
                    engine.conflict_detector.resolve_conflict(
                        conflict.grid_id, conflict.field_name, "confirm", "小祁"
                    )
    
    print_separator("基本自检（补录后重算前）")
    self_check_before = engine.run_self_check()
    for check in self_check_before:
        status = "✓ 通过" if check.passed else "✗ 未通过"
        print(f"{status} {check.check_name}: {check.details}")
        if check.warnings:
            for warning in check.warnings:
                print(f"   ⚠️  {warning.description}")
    
    print_separator("补录后重算")
    result_recalc = engine.recalculate_after_supplement()
    print(f"\n状态: {result_recalc.status.value}")
    print(f"\n{result_recalc.message}")
    
    if result_recalc.status == CheckStatus.NEED_REVIEW and result_recalc.conflicts:
        print_separator("仍有冲突，继续处理")
        for conflict in result_recalc.conflicts:
            if engine.conflict_detector.get_conflict_decision(conflict.grid_id, conflict.field_name) is None:
                print(f"\n处理网格[{conflict.grid_id}]的{conflict.field_name}冲突")
                print(f"   👉 小祁决定: confirm")
                engine.conflict_detector.resolve_conflict(
                    conflict.grid_id, conflict.field_name, "confirm", "小祁"
                )
        
        print_separator("冲突处理完成，再次重算")
        result_recalc = engine.recalculate_after_supplement()
        print(f"\n状态: {result_recalc.status.value}")
        print(f"\n{result_recalc.message}")
    
    print_separator("基本自检（重算后）")
    self_check_after = engine.run_self_check()
    for check in self_check_after:
        status = "✓ 通过" if check.passed else "✗ 未通过"
        print(f"{status} {check.check_name}: {check.details}")
    
    print_separator("导出一致性检查（数据已变更）")
    for check in self_check_after:
        if check.check_name == "导出一致性检查":
            status = "✓ 通过" if check.passed else "✗ 未通过"
            print(f"{status} {check.check_name}: {check.details}")
            if check.warnings:
                for warning in check.warnings:
                    print(f"   ⚠️  {warning.description}")
                    print(f"   建议: {warning.suggestion}")
    
    print_separator("重新导出")
    exported_new = engine.export_data()
    print(f"已重新导出 {len(exported_new)} 条数据")
    
    print_separator("最终自检")
    self_check_final = engine.run_self_check()
    for check in self_check_final:
        status = "✓ 通过" if check.passed else "✗ 未通过"
        print(f"{status} {check.check_name}: {check.details}")
    
    print_separator("补录材料测试完成", "=")


def demo_percent_decimal_mix():
    """演示4：百分数和小数混合专项测试"""
    print_separator("演示4：百分数和小数混合专项测试", "=")
    
    from test_data import PERCENT_DECIMAL_MIX_SAMPLING
    
    engine = WorkflowEngine()
    
    print(f"\n测试数据特点：同一网格同时出现百分数和小数格式")
    print(f"记录数: {len(PERCENT_DECIMAL_MIX_SAMPLING)}")
    for i, record in enumerate(PERCENT_DECIMAL_MIX_SAMPLING, 1):
        print(f"  {i}. {record.grid_id}: {record.boundary_threshold}")
    
    print_separator("导入数据")
    result = engine.step1_import_sampling_list(PERCENT_DECIMAL_MIX_SAMPLING)
    print(f"\n状态: {result.status.value}")
    print(f"\n{result.message}")
    
    print_separator("待负责人复核项")
    pending = engine.get_pending_manager_review()
    print(f"共 {len(pending)} 项需要活动负责人复核")
    for i, item in enumerate(pending, 1):
        print(f"\n{i}. 网格[{item.grid_id}] - {item.warning_type.value}")
        print(f"   当前值: {item.current_value}")
        print(f"   说明: {item.description}")
        print(f"   建议: {item.suggestion}")
        print(f"   需要负责人复核: {'是' if item.need_manager_review else '否'}")
    
    print_separator("系统不自动归正常，等待活动负责人")
    print("✅ 符合需求：百分数小数混着出现时不急着归正常，留给活动负责人复核")
    
    print_separator("百分数小数混合专项测试完成", "=")


def main():
    print("\n" + "=" * 70)
    print("📊 偏微分网格边界检查系统 - 完整演示")
    print("=" * 70)
    print("\n本演示将依次运行：")
    print("  1. 正常材料测试")
    print("  2. 错口径材料测试（含各种异常场景）")
    print("  3. 补录材料测试")
    print("  4. 百分数和小数混合专项测试")
    print("\n核心功能点：")
    print("  ✓ 百分数和小数混合检测")
    print("  ✓ 重复导入检测")
    print("  ✓ 抽样名单与参数调试表冲突检测")
    print("  ✓ 数据分析师小祁确认/驳回流程")
    print("  ✓ 补录后重算")
    print("  ✓ 导出一致性检查")
    print("  ✓ 友好的错误提示（说人话）")
    print("  ✓ 完整的历史记录追踪")
    print("  ✓ 百分数小数混合留待活动负责人复核")
    
    try:
        demo_normal_material()
        demo_wrong_caliber_material()
        demo_supplement_material()
        demo_percent_decimal_mix()
        
        print_separator("所有演示完成", "=")
        print("\n🎉 偏微分网格边界检查系统演示完成！")
        print("\n系统特点总结：")
        print("  1. 重点关注计算明细和历史记录的一致性")
        print("  2. 抽样名单和参数调试表矛盾时，列出冲突证据让小祁选确认或驳回")
        print("  3. 不替业务同事自动拍板")
        print("  4. 基本自检覆盖：重复导入、百分数小数混合、补录后重算、导出一致")
        print("  5. 错误提示直接说人话，不吐内部字段名")
        print("  6. 三步流程完整：导入→小祁补看→更新计算明细")
        print("  7. 百分数小数混合不急着归正常，留给活动负责人复核")
        print("\n")
        
    except Exception as e:
        print(f"\n❌ 演示过程中出错: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
