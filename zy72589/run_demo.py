#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
模型监控延迟归因 - 演示脚本
推荐策略老唐给新人讲流程专用
"""

import sys
from attribution_analyzer import AttributionAnalyzer


def demo_scenario_1_normal():
    """
    场景一：正常材料 - 用v1阈值，一切顺利
    """
    print("\n" + "=" * 70)
    print("【场景一】正常材料 - 用v1阈值导入，一切顺利")
    print("=" * 70)
    
    analyzer = AttributionAnalyzer()
    
    # 第一步：导入v1阈值YAML
    analyzer.step1_import_threshold_yaml("config/threshold_v1.yaml")
    
    # 加载监控报告
    analyzer.step2_load_monitor_report("data/monitor_report_20260520.json")
    
    # 第二步：补看评测切片
    analyzer.step2_check_eval_slices("data/eval_slices_20260520.json")
    
    # 第三步：这里不需要人工修正，因为v1阈值和报告一致
    print("说明：本场景使用v1阈值导入，与报告中阈值一致，无需人工修正")
    print()
    
    # 第四步：重跑归因 & 分层指标更新
    result = analyzer.step4_rerun_and_update()
    
    # 导出结果
    analyzer.export_results("output/scenario1_normal.json")
    
    return analyzer, result


def demo_scenario_2_threshold_mismatch():
    """
    场景二：错口径材料 - 阈值改过(v2)但报告仍写旧值(v1)
    关键点：别急着归正常，留给数据科学家复核
    """
    print("\n" + "=" * 70)
    print("【场景二】错口径材料 - 阈值改过(v2)但报告仍写旧值(v1)")
    print("=" * 70)
    print("重点：碰到阈值不一致，别急着归正常，留给数据科学家复核")
    print()
    
    analyzer = AttributionAnalyzer()
    
    # 第一步：导入v2阈值YAML（最新的）
    analyzer.step1_import_threshold_yaml("config/threshold_v2.yaml")
    
    # 加载监控报告（报告里写的还是v1阈值！）
    analyzer.step2_load_monitor_report("data/monitor_report_20260520.json")
    
    # 第二步：补看评测切片 - 这里会发现阈值不一致
    analyzer.step2_check_eval_slices("data/eval_slices_20260520.json")
    
    # 第三步：人工修正 - 确认阈值不一致，待数据科学家复核
    print("老唐：嗯，这里REC-001和REC-002阈值对不上")
    print("老唐：系统已经升级到v2阈值了，但报告还在用v1的旧值")
    print("老唐：先别急着改状态，标记【待数据科学家复核】，别自己归正常")
    print()
    
    analyzer.step3_manual_correction(
        "REC-001", 
        "confirm_mismatch",
        "整体CTR：YAML v2阈值0.075，但报告用0.08，待数据科学家确认采用哪个口径"
    )
    
    analyzer.step3_manual_correction(
        "REC-002",
        "confirm_mismatch",
        "新用户CTR：YAML v2阈值0.045，但报告用0.05，待数据科学家确认采用哪个口径"
    )
    
    # 第四步：重跑归因 & 分层指标更新
    result = analyzer.step4_rerun_and_update()
    
    # 导出结果
    analyzer.export_results("output/scenario2_threshold_mismatch.json")
    
    return analyzer, result


def demo_scenario_3_backfill_from_eval():
    """
    场景三：补录材料 - 从评测切片补来的旧口径
    """
    print("\n" + "=" * 70)
    print("【场景三】补录材料 - 从评测切片补来旧口径数据")
    print("=" * 70)
    
    analyzer = AttributionAnalyzer()
    
    # 第一步：导入v2阈值YAML
    analyzer.step1_import_threshold_yaml("config/threshold_v2.yaml")
    
    # 加载监控报告
    analyzer.step2_load_monitor_report("data/monitor_report_20260520.json")
    
    # 第二步：补看评测切片
    analyzer.step2_check_eval_slices("data/eval_slices_20260520.json")
    
    # 第三步：人工修正 - 从评测切片补录旧口径数据
    print("老唐：REC-003这条，当时监控系统抽风没采到数")
    print("老唐：但评测切片里有同期的数据，用评测切片的值补录一下")
    print("老唐：注意：补录的数据来源要标记清楚，别和自动监控的混了")
    print()
    
    analyzer.step3_manual_correction(
        "REC-003",
        "use_eval_data",
        "老用户CTR：监控数据缺失，从同期评测切片SLICE-003补录旧口径数据"
    )
    
    # 其他不一致的也标记待复核
    analyzer.step3_manual_correction(
        "REC-001",
        "confirm_mismatch",
        "整体CTR：阈值口径不一致，待复核"
    )
    
    analyzer.step3_manual_correction(
        "REC-002",
        "confirm_mismatch",
        "新用户CTR：阈值口径不一致，待复核"
    )
    
    # 第四步：重跑归因 & 分层指标更新
    result = analyzer.step4_rerun_and_update()
    
    # 导出结果
    analyzer.export_results("output/scenario3_backfill.json")
    
    return analyzer, result


def compare_all_results():
    """
    对比三个场景的结果，重点看分层指标和历史记录
    """
    print("\n" + "=" * 70)
    print("【三个场景结果对比】")
    print("=" * 70)
    
    import json
    
    scenarios = [
        ("场景一：正常材料(v1阈值)", "output/scenario1_normal.json"),
        ("场景二：错口径(v2阈值+待复核)", "output/scenario2_threshold_mismatch.json"),
        ("场景三：补录材料(v2+评测补录)", "output/scenario3_backfill.json")
    ]
    
    print()
    print("对比维度1: 分层指标状态差异")
    print("-" * 70)
    
    for name, path in scenarios:
        print(f"\n[{name}]")
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        status_counts = {}
        for rec in data['records']:
            status = rec.get('attribution_status', 'unknown')
            status_counts[status] = status_counts.get(status, 0) + 1
        
        for status, count in status_counts.items():
            print(f"  {status}: {count}条")
        
        # 显示有差异的记录
        print(f"  详细记录:")
        for rec in data['records']:
            if rec.get('correction_note'):
                print(f"    {rec['record_id']}: {rec['correction_note'][:50]}...")
                print(f"      → 最终状态: {rec.get('final_status', 'N/A')}")
    
    print()
    print("对比维度2: 历史操作记录")
    print("-" * 70)
    
    for name, path in scenarios:
        print(f"\n[{name}]")
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        for i, entry in enumerate(data['history']):
            action = entry['action']
            details = entry.get('details', {})
            detail_str = ", ".join([f"{k}={v}" for k, v in details.items() 
                                   if not isinstance(v, (dict, list))])
            print(f"  {i+1}. {action} ({detail_str})")
    
    print()
    print("=" * 70)
    print("老唐给新人的总结：")
    print("=" * 70)
    print("1. 正常情况：阈值版本一致，直接出分层指标就行")
    print("2. 阈值改过但报告写旧值：别手欠自己改状态，标记【待数据科学家复核】")
    print("   这是红线！出了问题你担不起")
    print("3. 从评测切片补录：来源要标清楚，补录的数和自动监控的要能区分")
    print("4. 所有操作都有历史记录，谁改的、改了什么、什么时候改的，都能查到")
    print()
    print("记住：延迟归因的核心不是『快』，是『可追溯、可复核』")
    print("=" * 70)


def main():
    print()
    print("╔" + "═" * 68 + "╗")
    print("║" + " " * 15 + "模型监控延迟归因 - 演示系统" + " " * 23 + "║")
    print("║" + " " * 10 + "推荐策略老唐 & 数据科学家 交接专用" + " " * 18 + "║")
    print("╚" + "═" * 68 + "╝")
    
    print("\n三个演示场景：")
    print("  1. 正常材料 - 用v1阈值，一切顺利")
    print("  2. 错口径材料 - 阈值改过(v2)但报告仍写旧值(v1)")
    print("  3. 补录材料 - 从评测切片补来的旧口径")
    print()
    
    # 运行三个场景
    analyzer1, result1 = demo_scenario_1_normal()
    analyzer2, result2 = demo_scenario_2_threshold_mismatch()
    analyzer3, result3 = demo_scenario_3_backfill_from_eval()
    
    # 生成对比报告
    print("\n" + "=" * 70)
    print("【场景二对比报告（阈值改过但报告仍写旧值）】")
    print("=" * 70)
    analyzer2.generate_comparison_report()
    
    # 对比所有结果
    compare_all_results()
    
    print("\n✓ 演示完成！输出文件在 output/ 目录下")
    print("  - scenario1_normal.json: 正常材料结果")
    print("  - scenario2_threshold_mismatch.json: 错口径材料结果")
    print("  - scenario3_backfill.json: 补录材料结果")
    print()


if __name__ == "__main__":
    main()
