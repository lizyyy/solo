#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import warnings
import sys
from typing import List, Dict, Any

from root_tracker import NonlinearRootTracker
from models import SampleStatus, ConflictType
from errors import (
    BoundaryValueWarning, ConflictDetectedError,
    UserFriendlyError
)
from test_data import TEST_SCENARIOS


warnings.filterwarnings("always", category=BoundaryValueWarning)


def print_separator(char: str = "=", length: int = 70) -> None:
    print("\n" + char * length)


def print_header(title: str) -> None:
    print_separator("=")
    print(f"  {title}")
    print_separator("=")


def run_scenario(scenario_name: str, tracker: NonlinearRootTracker) -> None:
    scenario = TEST_SCENARIOS[scenario_name]
    
    print_header(f"场景测试：{scenario['description']}")
    
    print("\n📋 第一步：导入抽样名单（张老师）")
    print("-" * 50)
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        try:
            imported = tracker.import_sample_list(scenario["sample_list"], "张老师")
            print(f"✅ 成功导入 {len(imported)} 个样本")
            
            for warning in w:
                if issubclass(warning.category, BoundaryValueWarning):
                    print(f"  ⚠️  {warning.message}")
            
            for sample in imported:
                status_icon = "🟢" if sample.status == SampleStatus.NORMAL else "🟡"
                print(f"  {status_icon} 【{sample.sample_id}】参数={sample.equation_param}, "
                      f"阈值={sample.threshold}, 根={sample.root_value}, 状态={sample.status.value}")
        except UserFriendlyError as e:
            print(f"  ❌ {e}")
            return
    
    pending = tracker.get_pending_review()
    if pending:
        print(f"\n  📋 待任课老师复核列表: {', '.join(pending)}")
    
    print("\n🔍 第二步：吴老师补看参数调试表")
    print("-" * 50)
    
    conflicts_count = 0
    for i, param_data in enumerate(scenario["parameter_table"]):
        try:
            with warnings.catch_warnings(record=True) as w:
                warnings.simplefilter("always")
                updated = tracker.import_parameter_table([param_data], "吴老师")
                
                for warning in w:
                    if issubclass(warning.category, BoundaryValueWarning):
                        print(f"  ⚠️  {warning.message}")
                
                for sample in updated:
                    print(f"  ✅ 【{sample.sample_id}】来源={sample.source.value}, "
                          f"状态={sample.status.value}")
        except ConflictDetectedError as e:
            conflicts_count += 1
            print(f"  ❌ 【{param_data['sample_id']}】{e.message}")
            print(f"     💡 请吴老师选择确认或驳回")
            
            unresolved_conflicts = tracker.get_conflicts(resolved=False)
            for conflict in unresolved_conflicts:
                if conflict.sample_id == param_data["sample_id"]:
                    print(f"     📊 冲突证据：{conflict.description}")
                    print(f"        抽样名单: {conflict.sample_list_value}")
                    print(f"        参数调试表: {conflict.parameter_table_value}")
                    
                    while True:
                        choice = input(f"     🤔 吴老师，请确认【{param_data['sample_id']}】的处理方式 ([Y]确认/[N]驳回): ").strip().upper()
                        if choice in ['Y', 'N']:
                            break
                        print("     ⚠️  请输入 Y 或 N")
                    
                    confirm = (choice == 'Y')
                    resolved = tracker.resolve_conflict(param_data["sample_id"], confirm, "吴老师")
                    print(f"     ✅ 冲突已解决：{resolved.resolution}")
    
    if scenario_name == "supplement" and "supplement_data" in scenario:
        print("\n📝 第三步：补录数据后重算")
        print("-" * 50)
        
        for supplement in scenario["supplement_data"]:
            sample_id = supplement["sample_id"]
            print(f"  📝 补录样本【{sample_id}】数据...")
            
            with warnings.catch_warnings(record=True) as w:
                warnings.simplefilter("always")
                updated = tracker.supplement_sample(sample_id, supplement, "吴老师")
                
                for warning in w:
                    if issubclass(warning.category, BoundaryValueWarning):
                        print(f"    ⚠️  {warning.message}")
                
                print(f"    ✅ 新参数={updated.equation_param}, 新阈值={updated.threshold}, "
                      f"新根值={updated.root_value}")
            
            recalculated = tracker.recalculate_after_supplement("吴老师")
            for sample in recalculated:
                print(f"    🔄 重算完成【{sample.sample_id}】根值={sample.root_value}")
    
    print("\n📝 反例列表")
    print("-" * 50)
    anti_examples = tracker.get_anti_examples()
    print(f"  共发现 {len(anti_examples)} 个反例")
    for i, ae in enumerate(anti_examples, 1):
        print(f"  {i}. 【{ae.sample_id}】{ae.description}")
        print(f"     根本原因: {ae.root_cause}")
        print(f"     发现时间: {ae.detected_time.strftime('%H:%M:%S')}")
    
    print("\n📜 操作历史记录")
    print("-" * 50)
    history = tracker.get_history()
    print(f"  共 {len(history)} 条操作记录")
    for i, record in enumerate(history, 1):
        print(f"  {i:2d}. [{record.timestamp.strftime('%H:%M:%S')}] {record.operator:4s} - {record.operation}")
        if record.details:
            detail_str = ", ".join([f"{k}={v}" for k, v in record.details.items() if k != "sample_id"])
            if detail_str:
                print(f"       {record.details.get('sample_id', '')} {detail_str}")
    
    print("\n✅ 系统自检")
    print("-" * 50)
    results = tracker.run_self_check()
    all_passed = True
    for result in results:
        status_icon = "✅" if result.passed else "❌"
        print(f"  {status_icon} {result.check_name}: {result.message}")
        if not result.passed:
            all_passed = False
    
    if all_passed:
        print("\n🎉 所有自检通过！")
    else:
        print("\n⚠️  部分自检未通过，请查看详细信息")
    
    print_separator("=")
    print(f"  场景【{scenario_name}】测试完成")
    print_separator("=")


def interactive_mode() -> None:
    print_header("交互式模式 - 非线性方程根追踪系统")
    print("\n欢迎使用非线性方程根追踪系统！")
    print("请选择要执行的操作：\n")
    
    tracker = NonlinearRootTracker()
    
    while True:
        print("\n" + "=" * 50)
        print("  主菜单")
        print("=" * 50)
        print("  1. 导入抽样名单")
        print("  2. 导入参数调试表")
        print("  3. 查看样本列表")
        print("  4. 查看待复核列表")
        print("  5. 查看冲突列表")
        print("  6. 处理冲突（仅限吴老师）")
        print("  7. 任课老师复核边界值")
        print("  8. 补录样本数据")
        print("  9. 补录后重算")
        print(" 10. 查看反例列表")
        print(" 11. 查看操作历史")
        print(" 12. 运行系统自检")
        print(" 13. 导出数据")
        print("  0. 退出")
        print("=" * 50)
        
        choice = input("\n请输入选项 (0-13): ").strip()
        
        try:
            if choice == "1":
                print("\n📋 导入抽样名单")
                n = int(input("请输入样本数量: "))
                data = []
                for i in range(n):
                    print(f"\n第 {i+1} 个样本:")
                    sample_id = input("  样本编号: ").strip()
                    equation_param = float(input("  方程参数: "))
                    threshold = float(input("  阈值: "))
                    data.append({"sample_id": sample_id, "equation_param": equation_param, "threshold": threshold})
                
                operator = input("操作人姓名: ").strip()
                with warnings.catch_warnings(record=True) as w:
                    warnings.simplefilter("always")
                    imported = tracker.import_sample_list(data, operator)
                    for warning in w:
                        if issubclass(warning.category, BoundaryValueWarning):
                            print(f"  ⚠️  {warning.message}")
                print(f"✅ 成功导入 {len(imported)} 个样本")
            
            elif choice == "2":
                print("\n🔍 导入参数调试表")
                n = int(input("请输入样本数量: "))
                data = []
                for i in range(n):
                    print(f"\n第 {i+1} 个样本:")
                    sample_id = input("  样本编号: ").strip()
                    equation_param = float(input("  方程参数: "))
                    threshold = float(input("  阈值: "))
                    notes = input("  备注 (可选): ").strip()
                    data.append({"sample_id": sample_id, "equation_param": equation_param, 
                                "threshold": threshold, "notes": notes})
                
                operator = input("操作人姓名: ").strip()
                with warnings.catch_warnings(record=True) as w:
                    warnings.simplefilter("always")
                    try:
                        updated = tracker.import_parameter_table(data, operator)
                        for warning in w:
                            if issubclass(warning.category, BoundaryValueWarning):
                                print(f"  ⚠️  {warning.message}")
                        print(f"✅ 成功更新 {len(updated)} 个样本")
                    except ConflictDetectedError as e:
                        print(f"  ❌ {e}")
            
            elif choice == "3":
                print("\n📊 样本列表")
                samples = tracker.get_all_samples()
                if not samples:
                    print("  暂无样本数据")
                else:
                    for s in samples:
                        status_icon = "🟢" if s.status == SampleStatus.NORMAL else \
                                     "🟡" if s.status == SampleStatus.PENDING_REVIEW else \
                                     "🔵" if s.status == SampleStatus.CONFIRMED else "🔴"
                        print(f"  {status_icon} 【{s.sample_id}】参数={s.equation_param}, "
                              f"阈值={s.threshold}, 根={s.root_value}, 状态={s.status.value}")
            
            elif choice == "4":
                print("\n📋 待复核列表")
                pending = tracker.get_pending_review()
                if not pending:
                    print("  暂无待复核样本")
                else:
                    for sample_id in pending:
                        s = tracker.get_sample(sample_id)
                        print(f"  🟡 【{sample_id}】参数={s.equation_param}, 阈值={s.threshold}")
            
            elif choice == "5":
                print("\n⚔️  冲突列表")
                conflicts = tracker.get_conflicts()
                if not conflicts:
                    print("  暂无冲突")
                else:
                    for c in conflicts:
                        status = "✅ 已解决" if c.resolved else "❌ 未解决"
                        print(f"\n  {status} 【{c.sample_id}】{c.conflict_type.value}")
                        print(f"     描述: {c.description}")
                        print(f"     抽样名单: {c.sample_list_value}")
                        print(f"     参数调试表: {c.parameter_table_value}")
                        if c.resolved:
                            print(f"     处理结果: {c.resolution}")
            
            elif choice == "6":
                print("\n⚖️  处理冲突（仅限吴老师）")
                operator = input("请输入您的姓名: ").strip()
                if operator != "吴老师":
                    print("❌ 只有吴老师才能处理冲突！")
                    continue
                
                unresolved = tracker.get_conflicts(resolved=False)
                if not unresolved:
                    print("  暂无未解决的冲突")
                    continue
                
                print("\n未解决的冲突:")
                for i, c in enumerate(unresolved, 1):
                    print(f"  {i}. 【{c.sample_id}】{c.description}")
                
                idx = int(input("\n请选择要处理的冲突编号: ")) - 1
                if 0 <= idx < len(unresolved):
                    conflict = unresolved[idx]
                    print(f"\n冲突详情:")
                    print(f"  样本编号: {conflict.sample_id}")
                    print(f"  冲突类型: {conflict.conflict_type.value}")
                    print(f"  抽样名单: {conflict.sample_list_value}")
                    print(f"  参数调试表: {conflict.parameter_table_value}")
                    
                    while True:
                        confirm = input("\n请选择处理方式 ([Y]确认-以参数调试表为准 / [N]驳回-以抽样名单为准): ").strip().upper()
                        if confirm in ['Y', 'N']:
                            break
                    
                    resolved = tracker.resolve_conflict(conflict.sample_id, confirm == 'Y', "吴老师")
                    print(f"\n✅ 冲突已处理: {resolved.resolution}")
            
            elif choice == "7":
                print("\n👨‍🏫 任课老师复核边界值")
                pending = tracker.get_pending_review()
                if not pending:
                    print("  暂无待复核的边界值样本")
                    continue
                
                print("\n待复核样本:")
                for i, sample_id in enumerate(pending, 1):
                    s = tracker.get_sample(sample_id)
                    print(f"  {i}. 【{sample_id}】参数={s.equation_param}, 阈值={s.threshold}")
                
                idx = int(input("\n请选择要复核的样本编号: ")) - 1
                if 0 <= idx < len(pending):
                    sample_id = pending[idx]
                    operator = input("任课老师姓名: ").strip()
                    
                    while True:
                        result = input(f"\n【{sample_id}】复核结果 ([Y]正常 / [N]异常): ").strip().upper()
                        if result in ['Y', 'N']:
                            break
                    
                    reviewed = tracker.teacher_review_boundary(sample_id, result == 'Y', operator)
                    print(f"\n✅ 复核完成，【{sample_id}】状态更新为: {reviewed.status.value}")
            
            elif choice == "8":
                print("\n📝 补录样本数据")
                sample_id = input("请输入样本编号: ").strip()
                if not tracker.get_sample(sample_id):
                    print(f"❌ 样本【{sample_id}】不存在")
                    continue
                
                print("\n请输入新的数据（直接回车保留原值）:")
                old = tracker.get_sample(sample_id)
                equation_param_str = input(f"  方程参数 (当前: {old.equation_param}): ").strip()
                threshold_str = input(f"  阈值 (当前: {old.threshold}): ").strip()
                notes = input("  补录备注: ").strip()
                
                new_data = {}
                if equation_param_str:
                    new_data["equation_param"] = float(equation_param_str)
                if threshold_str:
                    new_data["threshold"] = float(threshold_str)
                if notes:
                    new_data["notes"] = notes
                
                operator = input("操作人姓名: ").strip()
                with warnings.catch_warnings(record=True) as w:
                    warnings.simplefilter("always")
                    updated = tracker.supplement_sample(sample_id, new_data, operator)
                    for warning in w:
                        if issubclass(warning.category, BoundaryValueWarning):
                            print(f"  ⚠️  {warning.message}")
                
                print(f"\n✅ 补录完成")
                print(f"  新参数: {updated.equation_param}")
                print(f"  新阈值: {updated.threshold}")
                print(f"  新根值: {updated.root_value}")
                print(f"  状态: {updated.status.value}")
            
            elif choice == "9":
                print("\n🔄 补录后重算")
                operator = input("操作人姓名: ").strip()
                recalculated = tracker.recalculate_after_supplement(operator)
                if not recalculated:
                    print("  没有需要重算的样本")
                else:
                    print(f"✅ 已重算 {len(recalculated)} 个样本:")
                    for s in recalculated:
                        print(f"  【{s.sample_id}】新根值={s.root_value}")
            
            elif choice == "10":
                print("\n📝 反例列表")
                anti_examples = tracker.get_anti_examples()
                if not anti_examples:
                    print("  暂无反例")
                else:
                    for i, ae in enumerate(anti_examples, 1):
                        print(f"\n  {i}. 【{ae.sample_id}】")
                        print(f"     描述: {ae.description}")
                        print(f"     根本原因: {ae.root_cause}")
                        print(f"     发现时间: {ae.detected_time.strftime('%Y-%m-%d %H:%M:%S')}")
            
            elif choice == "11":
                print("\n📜 操作历史")
                history = tracker.get_history()
                if not history:
                    print("  暂无操作记录")
                else:
                    for i, record in enumerate(history, 1):
                        print(f"  {i:2d}. [{record.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] "
                              f"{record.operator} - {record.operation}")
                        if record.details:
                            detail_str = ", ".join([f"{k}={v}" for k, v in record.details.items()])
                            print(f"       {detail_str}")
            
            elif choice == "12":
                print("\n✅ 系统自检")
                results = tracker.run_self_check()
                all_passed = True
                for result in results:
                    status_icon = "✅" if result.passed else "❌"
                    print(f"  {status_icon} {result.check_name}: {result.message}")
                    if not result.passed:
                        all_passed = False
                
                if all_passed:
                    print("\n🎉 所有自检通过！")
            
            elif choice == "13":
                print("\n📤 导出数据")
                exported = tracker.export_data()
                filename = input("请输入导出文件名 (默认: export.json): ").strip() or "export.json"
                
                import json
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump(exported, f, ensure_ascii=False, indent=2)
                
                print(f"✅ 数据已导出到 {filename}，共 {len(exported)} 条记录")
            
            elif choice == "0":
                print("\n👋 感谢使用非线性方程根追踪系统，再见！")
                break
            
            else:
                print("\n⚠️  无效选项，请重新输入")
        
        except UserFriendlyError as e:
            print(f"\n❌ {e}")
        except ValueError as e:
            print(f"\n❌ 输入错误：{e}")
        except Exception as e:
            print(f"\n❌ 系统错误：{e}")
            import traceback
            traceback.print_exc()


def main():
    if len(sys.argv) > 1:
        mode = sys.argv[1].lower()
        
        if mode == "test":
            print_header("运行自动化测试")
            import unittest
            from test_root_tracker import TestNonlinearRootTracker
            
            suite = unittest.TestLoader().loadTestsFromTestCase(TestNonlinearRootTracker)
            runner = unittest.TextTestRunner(verbosity=2)
            result = runner.run(suite)
            
            sys.exit(0 if result.wasSuccessful() else 1)
        
        elif mode in TEST_SCENARIOS:
            tracker = NonlinearRootTracker()
            run_scenario(mode, tracker)
        
        elif mode == "all":
            for scenario_name in TEST_SCENARIOS:
                tracker = NonlinearRootTracker()
                run_scenario(scenario_name, tracker)
        
        elif mode == "interactive":
            interactive_mode()
        
        else:
            print(f"❌ 未知模式: {mode}")
            print(f"可用模式: test, {', '.join(TEST_SCENARIOS.keys())}, all, interactive")
            sys.exit(1)
    else:
        print_header("非线性方程根追踪系统")
        print("\n使用方法:")
        print(f"  python {sys.argv[0]} test           - 运行自动化测试")
        print(f"  python {sys.argv[0]} normal         - 运行正常材料场景")
        print(f"  python {sys.argv[0]} wrong_calibration  - 运行错口径材料场景")
        print(f"  python {sys.argv[0]} supplement     - 运行补录材料场景")
        print(f"  python {sys.argv[0]} all            - 运行所有场景")
        print(f"  python {sys.argv[0]} interactive    - 进入交互式模式")
        print()


if __name__ == "__main__":
    main()
