#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""调试脚本：复现冲突处理流程中的数据不一致问题"""

import warnings
from root_tracker import NonlinearRootTracker
from models import SampleStatus, ConflictType
from errors import ConflictDetectedError, BoundaryValueWarning

warnings.filterwarnings("always", category=BoundaryValueWarning)

def debug_conflict_resolution():
    print("=" * 70)
    print("【调试：冲突处理流程 - 确认以参数调试表为准】")
    print("=" * 70)

    tracker = NonlinearRootTracker()

    # ---------- 第一步：导入抽样名单 ----------
    print("\n📋 第一步：导入抽样名单（张老师）")
    print("-" * 50)
    sample_list = [
        {"sample_id": "C001", "equation_param": 10.0, "threshold": 10.0},  # 边界值
    ]
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        imported = tracker.import_sample_list(sample_list, "张老师")
        for warning in w:
            print(f"  ⚠️  {warning.message}")

    sample_after_step1 = tracker.get_sample("C001")
    print(f"  导入后样本状态：")
    print(f"    sample_id = {sample_after_step1.sample_id}")
    print(f"    equation_param = {sample_after_step1.equation_param}")
    print(f"    threshold = {sample_after_step1.threshold}")
    print(f"    root_value = {sample_after_step1.root_value}")
    print(f"    status = {sample_after_step1.status.value}")
    print(f"    source = {sample_after_step1.source.value}")
    print(f"    is_boundary_case = {sample_after_step1.is_boundary_case}")

    # ---------- 第二步：导入参数调试表（制造冲突） ----------
    print("\n🔍 第二步：导入参数调试表（吴老师，参数值不同）")
    print("-" * 50)
    param_table = [
        {"sample_id": "C001", "equation_param": 12.0, "threshold": 15.0, "notes": "参数调试表修正后的值"},
    ]
    print(f"  参数调试表准备导入的值：equation_param=12.0, threshold=15.0")

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        try:
            tracker.import_parameter_table(param_table, "吴老师")
            print("  ✅ 无冲突")
        except ConflictDetectedError as e:
            print(f"  ❌ 检测到冲突！")
            print(f"     {e.message}")

    sample_after_step2 = tracker.get_sample("C001")
    print(f"\n  【问题点1】导入参数调试表（抛异常）后，样本实际值：")
    print(f"    equation_param = {sample_after_step2.equation_param}")
    print(f"    threshold = {sample_after_step2.threshold}")
    print(f"    👉 期望：应该更新为 12.0/15.0，还是保留 10.0/10.0？")

    conflicts = tracker.get_conflicts(resolved=False)
    print(f"\n  【问题点2】冲突记录中的值：")
    for c in conflicts:
        print(f"    sample_list_value (抽样名单) = {c.sample_list_value}")
        print(f"    parameter_table_value (参数调试表) = {c.parameter_table_value}")
        print(f"    conflict_type = {c.conflict_type.value}")
        print(f"    description = {c.description}")

    # ---------- 第三步：吴老师「确认 - 以参数调试表为准」 ----------
    print("\n⚖️  第三步：吴老师「确认 - 以参数调试表为准」")
    print("-" * 50)

    resolved = tracker.resolve_conflict("C001", True, "吴老师")
    print(f"  冲突已解决：{resolved.resolution}")

    sample_after_step3 = tracker.get_sample("C001")
    print(f"\n  【问题点3】冲突确认后，样本值：")
    print(f"    equation_param = {sample_after_step3.equation_param}")
    print(f"    threshold = {sample_after_step3.threshold}")
    print(f"    root_value = {sample_after_step3.root_value}")
    print(f"    status = {sample_after_step3.status.value}")
    print(f"    👉 期望：参数/阈值应该变成参数调试表的 12.0/15.0，对吗？")
    print(f"    👉 期望：root_value 应该重新计算为 sqrt(12) = 3.464102，对吗？")

    # ---------- 第四步：检查各数据结构 ----------
    print("\n📝 第四步：核对反例列表、历史记录、导出数据")
    print("-" * 50)

    print(f"\n  反例列表 ({len(tracker.get_anti_examples())} 条)：")
    for i, ae in enumerate(tracker.get_anti_examples()):
        print(f"    {i+1}. [{ae.sample_id}] {ae.description}")
        print(f"       根本原因: {ae.root_cause}")
        print(f"       👉 反例有没有更新？冲突解决了要不要改反例？")

    print(f"\n  历史记录 ({len(tracker.get_history())} 条)：")
    for i, record in enumerate(tracker.get_history()):
        print(f"    {i+1}. [{record.timestamp.strftime('%H:%M:%S')}] {record.operator} - {record.operation}")
        print(f"       详情: {record.details}")
        print(f"       👉 有没有记录参数变化的原始值→新值？")

    print(f"\n  导出数据：")
    exported = tracker.export_data()
    for exp in exported:
        for k, v in exp.items():
            print(f"    {k} = {v}")
        print(f"    👉 有没有原始说法、改后值、处理原因、下一步？")

    # ---------- 第五步：如果现在是边界值呢？ ----------
    print("\n🔄 第五步：边界值 + 冲突叠加测试")
    print("-" * 50)
    print("  (假设参数调试表改后的值又刚好是边界值)")

    tracker2 = NonlinearRootTracker()
    sample_list2 = [{"sample_id": "C002", "equation_param": 8.0, "threshold": 10.0}]
    tracker2.import_sample_list(sample_list2, "张老师")
    print(f"  抽样名单: 8.0 vs 10.0 (非边界)")

    param_table2 = [{"sample_id": "C002", "equation_param": 10.0, "threshold": 10.0}]
    try:
        tracker2.import_parameter_table(param_table2, "吴老师")
    except ConflictDetectedError as e:
        print(f"  ❌ 冲突：{e.message}")

    print(f"  👉 参数调试表把 8.0 改成 10.0，刚好等于阈值 10.0")
    print(f"  👉 吴老师确认后，状态应该是「待任课老师复核」不是「吴老师确认」对吗？")

    print("\n" + "=" * 70)
    print("【调试结束】")
    print("=" * 70)


if __name__ == "__main__":
    debug_conflict_resolution()
