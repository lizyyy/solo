#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import warnings
import sys
import json
import os
from typing import List, Dict, Any

from root_tracker import NonlinearRootTracker
from models import SampleStatus, ConflictType, AntiExampleStatus
from errors import (
    BoundaryValueWarning, ConflictDetectedError,
    UserFriendlyError
)
from test_data import TEST_SCENARIOS


warnings.filterwarnings("always", category=BoundaryValueWarning)

SAVE_FILE = "tracker_state.json"


def print_help():
    print_header("非线性方程根追踪系统 - 帮助")
    print("\n使用方法:")
    print(f"  python {sys.argv[0]} test                    - 运行自动化测试")
    print(f"  python {sys.argv[0]} normal [--auto]         - 正常材料场景")
    print(f"  python {sys.argv[0]} wrong_calibration [--auto] - 错口径材料场景")
    print(f"  python {sys.argv[0]} supplement [--auto]     - 补录材料场景")
    print(f"  python {sys.argv[0]} all  [--auto]           - 所有场景依次运行")
    print(f"  python {sys.argv[0]} interactive             - 进入交互式模式（支持暂停续局跨会话）")
    print()
    print("核心链路:")
    print("  抽样名单(原始快照) → 参数调试表(冲突暂存提案) → 吴老师(确认/驳回)")
    print("  → 任课老师(边界值复核) → 补录修正 → 重算根值 → 自检 → 导出报告")
    print()
    print("暂停续局:")
    print("  冲突的 proposed_* 字段、待复核列表、反例状态全部持久化到 tracker_state.json")
    print("  退出时自动保存，下次启动交互模式自动加载，从断点接着走")
    print()
    print("四项基础自检:")
    print("  1. 重复导入检查    2. 边界值检查    3. 补录后重算检查    4. 导出一致性检查")
    print()


def print_separator(char: str = "=", length: int = 70) -> None:
    print("\n" + char * length)


def print_header(title: str) -> None:
    print_separator("=")
    print(f"  {title}")
    print_separator("=")


def _sample_status_icon(sample) -> str:
    if sample.status == SampleStatus.NORMAL:
        return "🟢"
    if sample.status == SampleStatus.PENDING_REVIEW:
        return "🟡"
    if sample.status == SampleStatus.CONFIRMED:
        return "🔵"
    if sample.status == SampleStatus.REJECTED:
        return "🔴"
    if sample.status == SampleStatus.ABNORMAL:
        return "🟣"
    return "⚪"


def _print_sample_detail(sample, prefix: str = "  ") -> None:
    icon = _sample_status_icon(sample)
    print(f"{prefix}{icon} 【{sample.sample_id}】")
    print(f"{prefix}   当前值: 参数={sample.equation_param}, 阈值={sample.threshold}, 根={sample.root_value}")
    print(f"{prefix}   状态: {sample.status.value}  |  来源: {sample.source.value if sample.source else '未知'}  |  边界值: {'是' if sample.is_boundary_case else '否'}")
    if sample.original_equation_param is not None and (
        sample.original_equation_param != sample.equation_param or sample.original_threshold != sample.threshold
    ):
        print(f"{prefix}   原始快照(抽样名单第一次导入): 参数={sample.original_equation_param}, 阈值={sample.original_threshold}, 根={sample.original_root_value}")
    if sample.proposed_equation_param is not None:
        print(f"{prefix}   ⏳ 提案值(参数调试表,待吴老师确认/驳回): 参数={sample.proposed_equation_param}, 阈值={sample.proposed_threshold}")
        if sample.proposed_notes:
            print(f"{prefix}      提案备注: {sample.proposed_notes}")
    if sample.resolution_reason:
        print(f"{prefix}   📝 处理原因: {sample.resolution_reason}")
    if sample.next_handler:
        print(f"{prefix}   👉 下一步: 找{sample.next_handler}")
    if sample.reviewer:
        print(f"{prefix}   🔍 最后复核人: {sample.reviewer} @ {sample.review_time.strftime('%H:%M:%S') if sample.review_time else ''}")
    if sample.notes:
        print(f"{prefix}   📄 完整备注链: {sample.notes}")


def run_scenario(scenario_name: str, tracker: NonlinearRootTracker, auto_resolve_all: bool = False) -> None:
    scenario = TEST_SCENARIOS[scenario_name]
    
    print_header(f"场景测试：{scenario['description']}")
    
    # ---------- Step 1: 导入抽样名单 ----------
    print("\n📋 第一步：导入抽样名单（张老师）")
    print("-" * 50)
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        try:
            imported = tracker.import_sample_list(scenario["sample_list"], "张老师")
            print(f"✅ 成功导入 {len(imported)} 个样本（抽样名单第一次导入时的原始值已自动保存快照）")
            
            for warning in w:
                if issubclass(warning.category, BoundaryValueWarning):
                    print(f"  ⚠️  {warning.message}")
            
            for sample in imported:
                _print_sample_detail(sample)
        except UserFriendlyError as e:
            print(f"  ❌ {e}")
            return
    
    pending = tracker.get_pending_review()
    if pending:
        print(f"\n  📋 待任课老师复核列表: {', '.join(pending)}")
    
    # ---------- Step 2: 导入参数调试表（吴老师） ----------
    print("\n🔍 第二步：吴老师补看参数调试表")
    print("-" * 50)
    
    conflict_sample_ids = set()
    for i, param_data in enumerate(scenario["parameter_table"]):
        sample_id = param_data["sample_id"]
        try:
            with warnings.catch_warnings(record=True) as w:
                warnings.simplefilter("always")
                updated = tracker.import_parameter_table([param_data], "吴老师")
                for warning in w:
                    if issubclass(warning.category, BoundaryValueWarning):
                        print(f"  ⚠️  {warning.message}")
                for sample in updated:
                    print(f"  ✅ 【{sample.sample_id}】无冲突 → 直接生效")
                    _print_sample_detail(sample, prefix="     ")
        except ConflictDetectedError as e:
            conflict_sample_ids.add(sample_id)
            print(f"  ❌ 【{sample_id}】检测到冲突，提案值已暂存（暂停续局：下次进来可直接接着处理）")
            print(f"     💡 {e.message}")
            unresolved = tracker.get_conflicts(resolved=False)
            for conflict in unresolved:
                if conflict.sample_id == sample_id:
                    print(f"     📊 冲突证据 ({conflict.conflict_type.value})：")
                    print(f"        抽样名单原始值: {conflict.sample_list_value}")
                    print(f"        参数调试表提案: {conflict.parameter_table_value}")
            _print_sample_detail(tracker.get_sample(sample_id), prefix="     ")
    
    unresolved_list = tracker.get_unresolved_samples()
    if unresolved_list:
        print(f"\n  ⚖️  未处理冲突的样本: {', '.join(unresolved_list)}")
        print(f"  💡 下一步 → 教研负责人吴老师需要针对以上样本，逐条决定「确认-以参数调试表为准」或「驳回-以抽样名单为准」")
    
    # ---------- Step 3: 吴老师处理冲突 ----------
    if conflict_sample_ids:
        print("\n⚖️  第三步：吴老师处理冲突（确认/驳回）")
        print("-" * 50)
        
        for sample_id in sorted(conflict_sample_ids):
            sample = tracker.get_sample(sample_id)
            if not sample or sample_id not in tracker.get_unresolved_samples():
                continue
            
            print(f"\n  处理【{sample_id}】：")
            print(f"    抽样名单原始值: 参数={sample.original_equation_param}, 阈值={sample.original_threshold}")
            print(f"    参数调试表提案: 参数={sample.proposed_equation_param}, 阈值={sample.proposed_threshold}")
            if sample.proposed_notes:
                print(f"    提案备注: {sample.proposed_notes}")
            
            if auto_resolve_all:
                choice = 'Y'
                reason_text = "自动演示：确认以参数调试表为准"
                print(f"    🤖 自动选择: [Y]确认")
            else:
                while True:
                    choice = input(f"    吴老师，请确认【{sample_id}】的处理方式 ([Y]确认-参数调试表 / [N]驳回-抽样名单 / [S]先跳过暂停续局): ").strip().upper()
                    if choice in ['Y', 'N', 'S']:
                        break
                if choice == 'S':
                    print(f"    ⏸️  【{sample_id}】已暂停，下次打开可以基于当前暂存的提案值继续。")
                    continue
                reason_text = input(f"    请输入处理原因（回车用默认）：").strip() or None
            
            try:
                resolved_list = tracker.resolve_conflict(sample_id, confirm=(choice == 'Y'),
                                                          operator="吴老师", reason=reason_text)
                print(f"    ✅ 已解决 {len(resolved_list)} 条冲突")
                for r in resolved_list:
                    print(f"       - {r.conflict_type.value}: {r.resolution}")
                
                updated_sample = tracker.get_sample(sample_id)
                print(f"    👇 处理后的最新结果：")
                _print_sample_detail(updated_sample, prefix="       ")
                
                if updated_sample.status == SampleStatus.PENDING_REVIEW:
                    print(f"    🎯 👉 仍需下一步：任课老师复核边界值（没有提前归为正常）")
                elif updated_sample.status == SampleStatus.CONFIRMED:
                    print(f"    🎯 流程完成，已标记为「吴老师确认」")
            except (PermissionError, ValueError) as e:
                print(f"    ❌ 处理失败: {e}")
    
    # ---------- Step 4: 任课老师复核边界值 ----------
    pending_after = tracker.get_pending_review()
    if pending_after:
        print("\n👨‍🏫 第四步：任课老师复核边界值（边界值不自动归正常，必须人工走这步）")
        print("-" * 50)
        
        for sample_id in pending_after:
            sample = tracker.get_sample(sample_id)
            print(f"\n  复核【{sample_id}】：")
            print(f"    当前值: 参数={sample.equation_param}, 阈值={sample.threshold}")
            print(f"    原始快照: 参数={sample.original_equation_param}, 阈值={sample.original_threshold}")
            
            if auto_resolve_all:
                choice = 'Y'
                review_reason = "自动演示：任课老师复核通过"
                print(f"    🤖 任课老师[王老师]自动选择: [Y]正常")
            else:
                while True:
                    choice = input(f"    任课老师，请确认【{sample_id}】 ([Y]正常 / [N]异常): ").strip().upper()
                    if choice in ['Y', 'N']:
                        break
                review_reason = input(f"    复核理由（回车用默认）：").strip() or None
            
            teacher_name = "王老师" if auto_resolve_all else (input("    任课老师姓名: ").strip() or "任课老师")
            
            try:
                reviewed = tracker.teacher_review_boundary(
                    sample_id, is_normal=(choice == 'Y'),
                    operator=teacher_name, review_reason=review_reason
                )
                print(f"    ✅ 复核完成，【{sample_id}】更新为: {reviewed.status.value}")
                _print_sample_detail(reviewed, prefix="       ")
            except StatusTransitionError as e:
                print(f"    ❌ 复核失败: {e}")
    
    # ---------- Step 5: 补录材料场景 ----------
    if scenario_name == "supplement" and "supplement_data" in scenario:
        print("\n📝 第五步：补录/修正数据 → 补录后重算")
        print("-" * 50)
        
        for supplement in scenario["supplement_data"]:
            sample_id = supplement["sample_id"]
            old_sample = tracker.get_sample(sample_id)
            print(f"\n  补录【{sample_id}】：")
            print(f"    旧值: 参数={old_sample.equation_param}, 阈值={old_sample.threshold}, 根={old_sample.root_value}")
            
            reason_text = supplement.get("notes", None) or None
            updated = tracker.supplement_sample(sample_id, supplement, "吴老师", supplement_reason=reason_text)
            
            recalculated = tracker.recalculate_after_supplement("吴老师")
            new_sample = tracker.get_sample(sample_id)
            print(f"    新值: 参数={new_sample.equation_param}, 阈值={new_sample.threshold}, 根={new_sample.root_value}")
            if new_sample.status == SampleStatus.PENDING_REVIEW:
                print(f"    🎯 补录后变成边界值 → 下一步: 任课老师复核（不自动归正常）")
            _print_sample_detail(new_sample, prefix="       ")
    
    # ---------- 反例列表 ----------
    print("\n📝 反例列表（与同一份最新结果同步，包含解决状态和解决说明）")
    print("-" * 50)
    anti_examples = tracker.get_anti_examples()
    print(f"  共 {len(anti_examples)} 个反例")
    open_count = len([ae for ae in anti_examples if ae.status == AntiExampleStatus.OPEN])
    resolved_count = len([ae for ae in anti_examples if ae.status == AntiExampleStatus.RESOLVED])
    print(f"  🟡 未解决: {open_count}  |  ✅ 已解决: {resolved_count}")
    
    for i, ae in enumerate(anti_examples, 1):
        icon = "🟡" if ae.status == AntiExampleStatus.OPEN else "✅"
        sample = tracker.get_sample(ae.sample_id)
        print(f"\n  {i}. {icon} 【{ae.sample_id}】{ae.status.value}")
        print(f"     描述: {ae.description}")
        print(f"     根因: {ae.root_cause}")
        if ae.status == AntiExampleStatus.RESOLVED:
            print(f"     解决说明: {ae.resolution_note}")
            print(f"     解决人: {ae.resolved_by} @ {ae.resolved_time.strftime('%H:%M:%S') if ae.resolved_time else ''}")
        if sample and sample.next_handler:
            print(f"     👉 下一步: 找{sample.next_handler}")
        print(f"     🕒 发现时间: {ae.detected_time.strftime('%H:%M:%S')}")
        
        history_for_sample = [h for h in tracker.get_history() if h.details.get("sample_id") == ae.sample_id]
        print(f"     📜 该样本相关操作记录 ({len(history_for_sample)} 条):")
        for j, h in enumerate(history_for_sample[-3:], 1):
            print(f"        {j}. {h.operator} - {h.operation}")
    
    # ---------- 历史记录 ----------
    print("\n📜 操作历史记录（触发问题输入→补录修正→保存状态变化，全程串联）")
    print("-" * 50)
    history = tracker.get_history()
    print(f"  共 {len(history)} 条操作记录")
    for i, record in enumerate(history, 1):
        det = record.details
        sid = det.get("sample_id", "")
        print(f"\n  {i:2d}. [{record.timestamp.strftime('%H:%M:%S')}] {record.operator} - {record.operation}")
        if sid:
            print(f"       样本: {sid}")
        if "old_equation_param" in det:
            print(f"       参数变化: {det['old_equation_param']} → {det['new_equation_param']}")
            print(f"       阈值变化: {det.get('old_threshold')} → {det.get('new_threshold')}")
        if "proposed_equation_param" in det:
            print(f"       暂存提案: 参数={det['proposed_equation_param']}, 阈值={det['proposed_threshold']}")
            print(f"       说明: {det.get('note', '')}")
        if "old_status" in det:
            print(f"       状态流转: {det['old_status']} → {det['new_status']}")
        if "next_handler" in det and det["next_handler"]:
            print(f"       👉 下一步: {det['next_handler']}")
        if "reason" in det and det["reason"]:
            print(f"       📝 原因: {det['reason']}")
        if "conflicts_resolved_count" in det:
            print(f"       本次解决冲突数: {det['conflicts_resolved_count']}")
    
    # ---------- 系统自检 ----------
    print("\n✅ 系统自检（4项基础自检）")
    print("-" * 50)
    results = tracker.run_self_check()
    all_passed = True
    for result in results:
        status_icon = "✅" if result.passed else "❌"
        print(f"  {status_icon} {result.check_name}: {result.message}")
        if not result.passed:
            all_passed = False
    
    # ---------- 导出/报告 ----------
    print("\n📤 导出与报告（列表、详情、摘要、历史、自检都基于同一份最新数据）")
    print("-" * 50)
    report = tracker.export_report(include_self_check_in_summary=True)
    summary = report["summary"]
    print(f"  📊 汇总报告摘要：")
    for k, v in summary.items():
        print(f"     • {k}: {v}")
    
    exported = tracker.export_data()
    if exported:
        sample_first = exported[0]
        print(f"\n  📄 导出字段完整性（第一条样本为例）：")
        important_fields = ["sample_id", "equation_param", "threshold", "root_value", "status",
                           "original_equation_param", "original_threshold", "original_root_value",
                           "proposed_equation_param", "proposed_threshold",
                           "resolution_reason", "next_handler", "notes"]
        for f in important_fields:
            val = sample_first.get(f)
            marker = "✅" if val is not None or f in ["proposed_equation_param", "proposed_threshold"] else "⚠️"
            print(f"     {marker} {f}: {val}")
    
    if all_passed:
        print("\n🎉 所有自检通过！抽样名单→参数调试表→冲突→边界值→补录→重算→反例→历史→导出 全链路使用同一份最新结果。")
    else:
        print("\n⚠️  部分自检未通过，请查看详细信息。")
    
    print_separator("=")
    print(f"  场景【{scenario_name}】测试完成")
    print_separator("=")


def interactive_mode() -> None:
    print_header("交互式模式 - 非线性方程根追踪系统")
    print("\n欢迎使用非线性方程根追踪系统！（已接入暂停续局、完整历史、同一份数据）")
    print("退出时会自动保存状态，下次启动自动加载，从断点接着走。\n")

    tracker = NonlinearRootTracker()
    if tracker.has_saved_state(SAVE_FILE):
        loaded = tracker.load_state(SAVE_FILE)
        if loaded:
            unresolved_count = len(tracker.get_unresolved_samples())
            pending_count = len(tracker.get_pending_review())
            print(f"✅ 已自动加载上次保存的状态：样本={len(tracker.get_all_samples())}, "
                  f"待处理冲突={unresolved_count}, 待任课复核={pending_count}")
            if unresolved_count or pending_count:
                print(f"💡 你可以直接从上次暂停的地方继续处理\n")

    while True:
        unresolved_count = len(tracker.get_unresolved_samples())
        pending_count = len(tracker.get_pending_review())
        sample_count = len(tracker.get_all_samples())
        print("\n" + "=" * 60)
        print(f"  主菜单  |  📋 样本: {sample_count}  |  ⚖️  待处理冲突: {unresolved_count}  |  🟡 待任课复核: {pending_count}")
        print("=" * 60)
        print("  1. 导入抽样名单（会保存原始快照）")
        print("  2. 导入参数调试表（有冲突则暂存提案，支持暂停续局）")
        print("  3. 查看样本列表（含原始值/提案值/下一步）")
        print("  4. 查看待复核列表")
        print("  5. 查看未处理冲突样本")
        print("  6. 查看冲突列表")
        print("  7. 处理冲突（仅限吴老师，确认会同步参数值+重算+重判边界）")
        print("  8. 任课老师复核边界值")
        print("  9. 补录样本数据（修正值后重算根值，原始快照保留）")
        print(" 10. 补录后重算根值")
        print(" 11. 查看反例列表（含解决状态/说明/解决人）")
        print(" 12. 查看操作历史（含old→new完整链路）")
        print(" 13. 运行系统自检")
        print(" 14. 导出数据（含原始值/提案/原因/下一步）")
        print(" 15. 导出完整报告（含summary+所有模块）")
        print(" 16. 保存当前状态（暂停续局）")
        print(" 17. 重新加载上次保存的状态")
        print(" 18. 显示帮助说明")
        print(" 19. 清空所有数据（重置）")
        print("  0. 退出（自动保存）")
        print("=" * 60)

        choice = input("\n请输入选项 (0-19): ").strip()
        
        try:
            if choice == "1":
                print("\n📋 导入抽样名单（原始快照自动保存）")
                n = int(input("请输入样本数量: "))
                data = []
                for i in range(n):
                    print(f"\n第 {i+1} 个样本:")
                    sample_id = input("  样本编号: ").strip()
                    equation_param = float(input("  方程参数: "))
                    threshold = float(input("  阈值: "))
                    data.append({"sample_id": sample_id, "equation_param": equation_param, "threshold": threshold})
                
                operator = input("操作人姓名: ").strip() or "张老师"
                with warnings.catch_warnings(record=True) as w:
                    warnings.simplefilter("always")
                    imported = tracker.import_sample_list(data, operator)
                    for warning in w:
                        if issubclass(warning.category, BoundaryValueWarning):
                            print(f"  ⚠️  {warning.message}")
                print(f"✅ 成功导入 {len(imported)} 个样本，原始快照已保存")
            
            elif choice == "2":
                print("\n🔍 导入参数调试表（有冲突时暂存提案，可暂停后接着处理）")
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
                
                operator = input("操作人姓名: ").strip() or "吴老师"
                with warnings.catch_warnings(record=True) as w:
                    warnings.simplefilter("always")
                    try:
                        updated = tracker.import_parameter_table(data, operator)
                        for warning in w:
                            if issubclass(warning.category, BoundaryValueWarning):
                                print(f"  ⚠️  {warning.message}")
                        print(f"✅ 成功更新 {len(updated)} 个样本")
                        for s in updated:
                            _print_sample_detail(s, prefix="  ")
                    except ConflictDetectedError as e:
                        print(f"  ❌ 检测到冲突：{e.message}")
                        print(f"  💡 提案值已暂存，使用菜单 [7] 处理冲突（即使退出再进也能接着来）")
                        unresolved = tracker.get_unresolved_samples()
                        print(f"  📋 当前待处理: {', '.join(unresolved)}")
            
            elif choice == "3":
                print("\n📊 样本列表（原始快照+当前值+提案+下一步，同一份最新数据）")
                samples = tracker.get_all_samples()
                if not samples:
                    print("  暂无样本数据")
                else:
                    for s in samples:
                        print()
                        _print_sample_detail(s)
            
            elif choice == "4":
                print("\n📋 待任课老师复核列表（边界值不自动归正常）")
                pending = tracker.get_pending_review()
                if not pending:
                    print("  暂无待复核样本")
                else:
                    for sample_id in pending:
                        s = tracker.get_sample(sample_id)
                        _print_sample_detail(s, prefix="  ")
            
            elif choice == "5":
                print("\n⚔️  未处理冲突的样本（下一步：吴老师）")
                unresolved = tracker.get_unresolved_samples()
                if not unresolved:
                    print("  暂无未处理冲突")
                else:
                    for sample_id in unresolved:
                        s = tracker.get_sample(sample_id)
                        print(f"\n  【{sample_id}】提案值暂存中：")
                        print(f"    提案参数={s.proposed_equation_param}, 阈值={s.proposed_threshold}")
                        conflicts = [c for c in tracker.get_conflicts(resolved=False) if c.sample_id == sample_id]
                        for c in conflicts:
                            print(f"    - {c.conflict_type.value}: {c.description}")
            
            elif choice == "6":
                print("\n⚔️  冲突列表")
                conflicts = tracker.get_conflicts()
                if not conflicts:
                    print("  暂无冲突")
                else:
                    for c in conflicts:
                        status_icon = "✅" if c.resolved else "🟡"
                        status = c.resolution if c.resolved else "待吴老师处理"
                        print(f"\n  {status_icon} 【{c.sample_id}】{c.conflict_type.value}")
                        print(f"     描述: {c.description}")
                        print(f"     抽样名单: {c.sample_list_value}  →  参数调试表: {c.parameter_table_value}")
                        print(f"     当前状态: {status}")
                        if c.resolved_by:
                            print(f"     处理人: {c.resolved_by} @ {c.resolved_time.strftime('%H:%M:%S') if c.resolved_time else ''}")
            
            elif choice == "7":
                print("\n⚖️  处理冲突（仅限吴老师，确认/驳回都会同步参数值+反例+历史）")
                operator = input("请输入您的姓名（仅限吴老师）: ").strip()
                if operator != "吴老师":
                    print("❌ 只有吴老师才能处理冲突！")
                    continue
                
                unresolved = tracker.get_unresolved_samples()
                if not unresolved:
                    print("  暂无未解决的冲突")
                    continue
                
                print("\n未处理冲突的样本:")
                for i, sid in enumerate(unresolved, 1):
                    s = tracker.get_sample(sid)
                    print(f"  {i}. 【{sid}】原始({s.original_equation_param}/{s.original_threshold}) "
                          f"→ 提案({s.proposed_equation_param}/{s.proposed_threshold})")
                
                idx_str = input("\n请选择编号（直接回车处理全部）: ").strip()
                target_ids = []
                if idx_str == "":
                    target_ids = list(unresolved)
                else:
                    idx = int(idx_str) - 1
                    if 0 <= idx < len(unresolved):
                        target_ids = [unresolved[idx]]
                
                for sid in target_ids:
                    s = tracker.get_sample(sid)
                    print(f"\n处理【{sid}】：")
                    print(f"  原始值（抽样名单）: 参数={s.original_equation_param}, 阈值={s.original_threshold}")
                    print(f"  提案值（参数调试表）: 参数={s.proposed_equation_param}, 阈值={s.proposed_threshold}")
                    if s.proposed_notes:
                        print(f"  提案备注: {s.proposed_notes}")
                    while True:
                        confirm = input("\n  [Y]确认-参数调试表 / [N]驳回-抽样名单 / [S]跳过: ").strip().upper()
                        if confirm in ['Y', 'N', 'S']:
                            break
                    if confirm == 'S':
                        print(f"  ⏸️  【{sid}】已跳过暂停")
                        continue
                    reason = input("  处理原因（回车用默认）：").strip() or None
                    resolved = tracker.resolve_conflict(sid, confirm=(confirm == 'Y'),
                                                        operator="吴老师", reason=reason)
                    print(f"  ✅ 【{sid}】已解决 {len(resolved)} 条冲突")
                    updated = tracker.get_sample(sid)
                    _print_sample_detail(updated, prefix="     ")
                    if updated.next_handler:
                        print(f"     👉 下一步：{updated.next_handler}")
            
            elif choice == "8":
                print("\n👨‍🏫 任课老师复核边界值（边界值不提前归正常）")
                pending = tracker.get_pending_review()
                if not pending:
                    print("  暂无待复核的边界值样本")
                    continue
                
                print("\n待复核样本:")
                for i, sid in enumerate(pending, 1):
                    s = tracker.get_sample(sid)
                    print(f"  {i}. 【{sid}】参数={s.equation_param}, 阈值={s.threshold}")
                
                idx_str = input("\n请选择编号（直接回车全部复核）: ").strip()
                target_ids = []
                if idx_str == "":
                    target_ids = list(pending)
                else:
                    idx = int(idx_str) - 1
                    if 0 <= idx < len(pending):
                        target_ids = [pending[idx]]
                
                teacher = input("任课老师姓名: ").strip() or "任课老师"
                for sid in target_ids:
                    while True:
                        result = input(f"\n【{sid}】复核结果 ([Y]正常 / [N]异常): ").strip().upper()
                        if result in ['Y', 'N']:
                            break
                    review_reason = input("复核理由（回车用默认）：").strip() or None
                    reviewed = tracker.teacher_review_boundary(
                        sid, is_normal=(result == 'Y'),
                        operator=teacher, review_reason=review_reason
                    )
                    print(f"  ✅ 【{sid}】复核完成 → {reviewed.status.value}")
            
            elif choice == "9":
                print("\n📝 补录样本数据（保留原始快照，修正后自动触发边界判断）")
                sample_id = input("请输入样本编号: ").strip()
                if not tracker.get_sample(sample_id):
                    print(f"❌ 样本【{sample_id}】不存在")
                    continue
                
                old = tracker.get_sample(sample_id)
                print("\n当前值（直接回车保留）：")
                equation_param_str = input(f"  方程参数 (当前: {old.equation_param}): ").strip()
                threshold_str = input(f"  阈值 (当前: {old.threshold}): ").strip()
                notes = input("  补录备注: ").strip()
                reason = input("  补录原因: ").strip() or None
                
                new_data = {}
                if equation_param_str:
                    new_data["equation_param"] = float(equation_param_str)
                if threshold_str:
                    new_data["threshold"] = float(threshold_str)
                if notes:
                    new_data["notes"] = notes
                
                operator = input("操作人姓名: ").strip() or "吴老师"
                with warnings.catch_warnings(record=True) as w:
                    warnings.simplefilter("always")
                    updated = tracker.supplement_sample(sample_id, new_data, operator, supplement_reason=reason)
                    for warning in w:
                        if issubclass(warning.category, BoundaryValueWarning):
                            print(f"  ⚠️  {warning.message}")
                
                print(f"\n✅ 补录完成：")
                _print_sample_detail(updated, prefix="  ")
                print(f"  💡 补录值自动进入重算队列，可用菜单 [10] 立即重算")
            
            elif choice == "10":
                print("\n🔄 补录后重算根值")
                operator = input("操作人姓名: ").strip() or "吴老师"
                recalculated = tracker.recalculate_after_supplement(operator)
                if not recalculated:
                    print("  没有需要重算的样本")
                else:
                    print(f"✅ 已重算 {len(recalculated)} 个样本:")
                    for s in recalculated:
                        print(f"  【{s.sample_id}】新根值 = {s.root_value}")
            
            elif choice == "11":
                print("\n📝 反例列表（含解决状态、解决说明、解决人）")
                filter_choice = input("  过滤器 [A]全部 / [O]未解决 / [R]已解决 (默认A): ").strip().upper() or 'A'
                if filter_choice == 'O':
                    anti_examples = tracker.get_anti_examples(status=AntiExampleStatus.OPEN)
                elif filter_choice == 'R':
                    anti_examples = tracker.get_anti_examples(status=AntiExampleStatus.RESOLVED)
                else:
                    anti_examples = tracker.get_anti_examples()
                
                if not anti_examples:
                    print("  暂无反例")
                else:
                    for i, ae in enumerate(anti_examples, 1):
                        icon = "🟡" if ae.status == AntiExampleStatus.OPEN else "✅"
                        print(f"\n  {i:2d}. {icon} 【{ae.sample_id}】{ae.status.value}")
                        print(f"      描述: {ae.description}")
                        print(f"      根因: {ae.root_cause}")
                        print(f"      发现: {ae.detected_time.strftime('%Y-%m-%d %H:%M:%S')}")
                        if ae.status == AntiExampleStatus.RESOLVED:
                            print(f"      解决说明: {ae.resolution_note}")
                            print(f"      解决人: {ae.resolved_by} @ {ae.resolved_time.strftime('%Y-%m-%d %H:%M:%S') if ae.resolved_time else ''}")
                        s = tracker.get_sample(ae.sample_id)
                        if s and s.next_handler:
                            print(f"      👉 下一步: {s.next_handler}")
            
            elif choice == "12":
                print("\n📜 操作历史（完整链路：触发→修正→状态→下一步）")
                history = tracker.get_history()
                if not history:
                    print("  暂无操作记录")
                else:
                    sample_filter = input("  按样本编号过滤（回车显示全部）：").strip()
                    for i, record in enumerate(history, 1):
                        if sample_filter and record.details.get("sample_id") != sample_filter:
                            continue
                        det = record.details
                        print(f"\n  {i:2d}. [{record.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] "
                              f"{record.operator} - {record.operation}")
                        for k, v in det.items():
                            print(f"       {k}: {v}")
            
            elif choice == "13":
                print("\n✅ 系统自检（重复导入/边界值/补录重算/导出一致性）")
                results = tracker.run_self_check()
                all_passed = True
                for result in results:
                    status_icon = "✅" if result.passed else "❌"
                    print(f"  {status_icon} {result.check_name}: {result.message}")
                    if result.details:
                        for k, v in result.details.items():
                            print(f"       {k}: {v}")
                    if not result.passed:
                        all_passed = False
                if all_passed:
                    print("\n🎉 所有自检通过！")
            
            elif choice == "14":
                print("\n📤 导出数据（JSON，含原始快照/提案/原因/下一步）")
                exported = tracker.export_data()
                filename = input("请输入导出文件名 (默认: export_samples.json): ").strip() or "export_samples.json"
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump(exported, f, ensure_ascii=False, indent=2)
                print(f"✅ 数据已导出到 {filename}，共 {len(exported)} 条记录")
                print(f"  字段包含：sample_id, equation_param, threshold, root_value, status,")
                print(f"           original_*, proposed_*, resolution_reason, next_handler, notes 等")
            
            elif choice == "15":
                print("\n📑 导出完整报告（summary + 样本 + 冲突 + 反例 + 历史 + 自检）")
                report = tracker.export_report(include_self_check_in_summary=True)
                filename = input("请输入报告文件名 (默认: full_report.json): ").strip() or "full_report.json"
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump(report, f, ensure_ascii=False, indent=2)
                print(f"✅ 完整报告已导出到 {filename}")
                s = report["summary"]
                print(f"  摘要: 样本={s['total_samples']}, 边界值={s['boundary_cases']}, "
                      f"待复核={s['pending_review']}, 未解决冲突={s['unresolved_conflicts']}, "
                      f"反例(开/关)={s['anti_examples_open']}/{s['anti_examples_resolved']}, "
                      f"自检通过={s['self_check_passed']}")

            elif choice == "16":
                print(f"\n💾 保存当前状态（暂停续局） → {SAVE_FILE}")
                path = tracker.save_state(SAVE_FILE)
                print(f"✅ 已保存：样本={len(tracker.get_all_samples())}, "
                      f"待处理冲突={len(tracker.get_unresolved_samples())}, "
                      f"待任课复核={len(tracker.get_pending_review())}")
                print(f"  💡 下次进入交互模式会自动加载该文件，从断点继续")

            elif choice == "17":
                print(f"\n🔄 重新加载上次保存的状态 ← {SAVE_FILE}")
                if not tracker.has_saved_state(SAVE_FILE):
                    print("  ⚠️  没有找到保存的状态文件")
                else:
                    ok = tracker.load_state(SAVE_FILE)
                    if ok:
                        print(f"✅ 加载成功：样本={len(tracker.get_all_samples())}, "
                              f"待处理冲突={len(tracker.get_unresolved_samples())}, "
                              f"待任课复核={len(tracker.get_pending_review())}")
                    else:
                        print("  ❌ 加载失败，文件版本不匹配或损坏")

            elif choice == "18":
                print()
                print_help()

            elif choice == "19":
                confirm = input(f"\n⚠️  确认清空所有数据并删除 {SAVE_FILE}？([Y]是 / [N]否): ").strip().upper()
                if confirm == 'Y':
                    tracker.__init__()
                    if os.path.exists(SAVE_FILE):
                        os.remove(SAVE_FILE)
                    print("✅ 已清空所有数据，重置为初始状态")
                else:
                    print("  已取消")

            elif choice == "0":
                unresolved = tracker.get_unresolved_samples()
                pending = tracker.get_pending_review()
                saved = False
                try:
                    tracker.save_state(SAVE_FILE)
                    saved = True
                except Exception:
                    saved = False
                print(f"\n💾 自动保存状态 → {SAVE_FILE}" + (" ✅" if saved else " ❌ 保存失败"))
                if unresolved or pending:
                    print(f"\n⏸️  【暂停续局提示】")
                    if unresolved:
                        print(f"  • 还有 {len(unresolved)} 个冲突未处理，提案值已暂存在 proposed_* 字段")
                        print(f"    样本: {', '.join(unresolved)}")
                    if pending:
                        print(f"  • 还有 {len(pending)} 个边界值待任课老师复核")
                        print(f"    样本: {', '.join(pending)}")
                    print(f"  下次启动交互模式会自动从 {SAVE_FILE} 加载，直接从断点接着走。")
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

        if mode in ("-h", "--help", "help", "?", "h"):
            print_help()
            sys.exit(0)

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
            auto = "--auto" in sys.argv or len(sys.argv) > 2 and sys.argv[2] == "--auto"
            run_scenario(mode, tracker, auto_resolve_all=auto)

        elif mode == "all":
            tracker = NonlinearRootTracker()
            auto = "--auto" in sys.argv
            for scenario_name in TEST_SCENARIOS:
                run_scenario(scenario_name, tracker, auto_resolve_all=auto)
                tracker = NonlinearRootTracker()

        elif mode == "interactive":
            interactive_mode()

        else:
            print(f"❌ 未知模式: {mode}")
            print(f"可用模式: test, {', '.join(TEST_SCENARIOS.keys())}, all, interactive, help")
            print(f"附加参数: --auto 自动处理冲突和边界值（演示用）")
            print(f"帮助: python {sys.argv[0]} --help 或 -h")
            sys.exit(1)
    else:
        print_help()


if __name__ == "__main__":
    main()
