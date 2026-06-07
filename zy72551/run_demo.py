#!/usr/bin/env python3
"""
演示脚本：多臂老虎机预算分流完整流程
============================================================
场景：实验平台负责人晚上催结果，推荐策略老唐走流程复核

三步流程：
  1. 导入召回候选表
  2. 补看参数 YAML
  3. 运行检测，异常样本页自动更新

演示包含：
  - 一份小而真的演示数据（召回候选表、参数YAML）
  - 一次人工修正（实验平台负责人复核时间窗穿越）
  - 一次重跑
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mab_budget.reviewer import MabBudgetReviewer


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    demo_dir = os.path.join(base_dir, "data", "demo")
    data_dir = os.path.join(base_dir, "data")
    output_dir = os.path.join(base_dir, "output")

    for d in [data_dir, output_dir]:
        os.makedirs(d, exist_ok=True)

    reviewer = MabBudgetReviewer(data_dir, output_dir)

    print("=" * 70)
    print("🎰 多臂老虎机预算分流 - 完整演示流程")
    print("=" * 70)
    print("\n📋 场景：实验平台负责人晚上催结果，推荐策略老唐翻召回候选表")
    print("   发现「时间窗穿越」导致效果虚高，结论不敢直接发\n")

    # === 第一步：导入召回候选表 ===
    print("-" * 70)
    print("📌 第一步：导入召回候选表（推荐策略老唐）")
    print("-" * 70)
    csv_path = os.path.join(demo_dir, "recall_candidates.csv")
    candidates = reviewer.step1_import_candidates(csv_path, "推荐策略老唐")
    print(f"✅ 导入 {len(candidates)} 条召回候选")
    for c in candidates:
        tag = " ⚠️" if c.candidate_id in ["cand_003", "cand_007", "cand_010"] else ""
        print(f"   {c.candidate_id}: {c.strategy_name} | CTR={c.ctr:.4f} | 窗口={c.time_window_start[5:16]}~{c.time_window_end[5:16]}{tag}")
    print()

    # === 第二步：补看参数 YAML ===
    print("-" * 70)
    print("📌 第二步：补看参数 YAML（推荐策略老唐）")
    print("-" * 70)
    yaml_path = os.path.join(demo_dir, "params.yaml")
    params = reviewer.step2_load_params(yaml_path, "推荐策略老唐")
    print(f"✅ 参数 v{params.version} 已加载")
    print(f"   时间窗口大小: {params.time_window_size_hours} 小时")
    print(f"   最低曝光阈值: {params.min_impression_threshold:,}")
    print(f"   启用的异常规则: {[r['name'] for r in params.anomaly_detection_rules if r['enabled']]}")
    print()

    # === 第三步：运行异常检测 ===
    print("-" * 70)
    print("📌 第三步：运行异常检测，标出时间窗穿越让效果虚高")
    print("-" * 70)
    anomalies = reviewer.step3_run_detection("推荐策略老唐")
    print(f"🔍 检测完成，共检出 {len(anomalies)} 条异常:")
    for a in anomalies:
        if a.anomaly_type == "time_window_cross":
            print(f"   ⏰ 时间窗穿越: {a.candidate_id} -> 留给实验平台负责人复核（别急着归正常）")
        elif a.anomaly_type == "budget_overrun":
            print(f"   💰 预算预警: {a.candidate_id} -> 推荐策略老唐评估")
    print()
    print("⚠️  关键提醒：时间窗穿越的样本会让效果虚高，结论不可直接发")
    print()

    # === 演示：异常样本页已生成 ===
    print("-" * 70)
    print("📄 异常样本页已生成，每页都说明：")
    print("   1. 这条为什么被留下")
    print("   2. 还缺什么材料")
    print("   3. 下一步该找谁（实验平台负责人还是推荐策略老唐）")
    print("-" * 70)
    time_anomalies = [a for a in anomalies if a.anomaly_type == "time_window_cross"]
    for a in time_anomalies:
        print(f"   📄 {a.sample_id}.html -> 下一步: {a.next_step_owner}")
    print()

    # === 演示：一次人工修正 ===
    print("-" * 70)
    print("📌 演示：实验平台负责人复核并修正（一次人工修正）")
    print("-" * 70)
    if time_anomalies:
        sample = time_anomalies[0]
        updated = reviewer.manual_correct_anomaly(
            sample.sample_id,
            operator="实验平台负责人",
            correction_notes="已确认该时间窗对应618大促跨天活动，数据上报已对齐，效果可信，可以正常使用",
            mark_verified=True,
            next_step_owner="推荐策略老唐",
            next_step_action="可正常使用该条数据结论，无需再扣量"
        )
        print(f"✅ {sample.sample_id} 已由实验平台负责人复核通过")
        print(f"   修正前: 下一步 = {sample.next_step_owner}")
        print(f"   修正后: 下一步 = {updated.next_step_owner} | 状态 = 已复核")
        print(f"   异常样本页已自动更新")
    print()

    # === 演示：一次重跑 ===
    print("-" * 70)
    print("📌 演示：基于最新状态重跑检测（一次重跑）")
    print("-" * 70)
    rerun_anomalies = reviewer.rerun_detection("推荐策略老唐")
    verified = sum(1 for a in rerun_anomalies if a.is_verified)
    print(f"🔄 重跑完成，共 {len(rerun_anomalies)} 条异常，其中 {verified} 条已复核")
    print()

    # === 演示数据总结 ===
    print("=" * 70)
    print("🎉 演示完成！以下是产出物：")
    print("=" * 70)
    print(f"   📁 数据目录: {data_dir}/")
    print(f"      - 召回候选表: candidates/latest.json")
    print(f"      - 参数配置: params.yaml")
    print(f"      - 异常样本: anomalies/*.json")
    print(f"      - 复核记录: audit/*.json（谁改了什么、为什么改、影响哪些结果）")
    print()
    print(f"   📁 报告目录: {output_dir}/")
    print(f"      - 汇总报告: index.html（可直接用浏览器打开）")
    print(f"      - 异常样本页: anomalies/*.html（每条异常一个详情页）")
    print()
    print("🚀 下一步操作:")
    print("   python mab_review.py demo                # 重新跑一遍演示")
    print("   python mab_review.py dashboard           # 启动Web小看板")
    print("   python mab_review.py --help              # 查看所有命令")
    print()


if __name__ == "__main__":
    main()
