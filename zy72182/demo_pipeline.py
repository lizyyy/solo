#!/usr/bin/env python3
import os
import sys
import shutil
import pandas as pd
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src import DataManager, ClusterEngine, ReviewManager, ReportGenerator


def print_section(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)


def demo_smooth_workflow():
    print_section("场景1: 顺利处理流程 - V1版本模型结果")
    
    work_dir = "./workspace_demo"
    
    if os.path.exists(work_dir):
        shutil.rmtree(work_dir)
    
    dm = DataManager(work_dir=work_dir)
    ce = ClusterEngine(eps=0.5, min_samples=1)
    rm = ReviewManager(review_dir=f"{work_dir}/reviews")
    rg = ReportGenerator(report_dir=f"{work_dir}/reports")
    
    print("\n[步骤1] 创建版本 V1.0.2")
    version_id = dm.create_version(
        model_version="1.0.2", 
        description="图像质检缺陷聚类 - 第一版发布"
    )
    print(f"  版本ID: {version_id}")
    
    print("\n[步骤2] 加载原始数据")
    raw_df = dm.load_raw_data("./sample_data/v1_model_results.csv", version_id)
    print(f"  加载行数: {len(raw_df)}")
    
    print("\n[步骤3] 数据清洗（去重、空值处理）")
    clean_df, clean_stats = dm.clean_data(raw_df)
    print(f"  总行数: {clean_stats['total_rows']}")
    print(f"  空值行: {clean_stats['null_rows']}")
    print(f"  重复行: {clean_stats['duplicate_rows']}")
    print(f"  有效行: {clean_stats['valid_rows']}")
    if clean_stats['removed_samples']:
        print(f"  移除样本: {[s['sample_id'] for s in clean_stats['removed_samples']]}")
    
    print("\n[步骤4] 合并历史复核记录")
    review_src = Path("./sample_data/historical_reviews.json")
    review_dst = Path(f"{work_dir}/reviews/historical.json")
    review_dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(review_src, review_dst)
    
    merged_df, merge_stats = dm.merge_with_historical_reviews(clean_df, version_id)
    print(f"  总样本: {merge_stats['total_samples']}")
    print(f"  匹配历史: {merge_stats['matched_reviews']}")
    print(f"  标签冲突: {merge_stats['conflicting_labels']}")
    print(f"  应用标签: {merge_stats['applied_labels']}")
    
    print("\n[步骤5] 缺陷聚类")
    clustered_df, cluster_stats = ce.cluster_defects(merged_df)
    print(f"  聚类数量: {cluster_stats['cluster_count']}")
    print(f"  噪声样本: {cluster_stats['noise_count']}")
    for cid, info in cluster_stats['samples_per_cluster'].items():
        print(f"    {cid}: {info['count']}个样本")
    
    print("\n[步骤6] 分配聚类标签")
    labeled_df, label_stats = ce.assign_cluster_labels(clustered_df)
    print(f"  已标记聚类: {label_stats['labeled_clusters']}")
    
    print("\n[步骤7] 应用复核记录到DataFrame")
    reviewed_df, apply_stats = rm.apply_reviews_to_dataframe(labeled_df)
    print(f"  匹配复核: {apply_stats['total_matched']}")
    print(f"  应用标签: {apply_stats['labels_applied']}")
    print(f"  发现冲突: {apply_stats['conflicts_found']}")
    
    print("\n[步骤8] 计算指标")
    metrics = ce.calculate_metrics(reviewed_df)
    print(f"  总样本: {metrics['total_samples']}")
    print(f"  复核状态: {metrics['review_status']}")
    
    review_summary = rm.get_review_summary(reviewed_df)
    print(f"  复核进度: {review_summary['review_progress']}%")
    
    print("\n[步骤9] 保存中间数据")
    dm.save_processed_data(reviewed_df, version_id, "final")
    print("  已保存 final.parquet")
    
    print("\n[步骤10] 生成报告")
    version_info = dm.get_version_info(version_id)
    report = rg.generate_full_report(
        reviewed_df, version_info, metrics, 
        cluster_stats, clean_stats, merge_stats
    )
    print(f"  报告ID: {report['report_id']}")
    
    handoff_path = rg.generate_handoff_report(reviewed_df, version_info, review_summary)
    print(f"  交接报告: {handoff_path}")
    
    excel_path = rg.export_result_excel(reviewed_df, version_id)
    print(f"  Excel结果: {excel_path}")
    
    print("\n[步骤11] 人工复核演示 - 处理冲突样本")
    need_confirm = reviewed_df[reviewed_df['review_status'] == 'need_confirm']
    if len(need_confirm) > 0:
        sample = need_confirm.iloc[0]
        print(f"  确认样本 {sample['sample_id']}: 模型预测[{sample['predicted_label']}] -> 人工标记[气泡]")
        rm.submit_review(
            sample_id=sample['sample_id'],
            human_label="气泡",
            reviewer="小乔",
            note="人工确认：实际是气泡缺陷",
            version_id=version_id
        )
    
    print("\n[步骤12] 最终复核后重新生成报告")
    final_df, final_stats = rm.apply_reviews_to_dataframe(reviewed_df)
    final_metrics = ce.calculate_metrics(final_df)
    final_summary = rm.get_review_summary(final_df)
    print(f"  最终复核进度: {final_summary['review_progress']}%")
    print(f"  最终复核状态: {final_metrics['review_status']}")
    
    final_handoff = rg.generate_handoff_report(final_df, version_info, final_summary)
    print(f"  最终交接报告: {final_handoff}")
    
    return version_id, work_dir


def demo_rework_workflow(prev_version_id, work_dir):
    print_section("场景2: 返工处理 - V2版本模型结果（指标变化对比）")
    
    dm = DataManager(work_dir=work_dir)
    ce = ClusterEngine(eps=0.5, min_samples=1)
    rm = ReviewManager(review_dir=f"{work_dir}/reviews")
    rg = ReportGenerator(report_dir=f"{work_dir}/reports")
    
    print("\n[步骤1] 创建新版本 V2.0.0")
    version_id = dm.create_version(
        model_version="2.0.0", 
        description="图像质检缺陷聚类 - 第二版优化模型"
    )
    print(f"  新版本ID: {version_id}")
    
    print("\n[步骤2] 加载V2模型结果")
    raw_df = dm.load_raw_data("./sample_data/v2_model_results.csv", version_id)
    print(f"  加载行数: {len(raw_df)}")
    
    print("\n[步骤3] 数据清洗")
    clean_df, clean_stats = dm.clean_data(raw_df)
    print(f"  有效行: {clean_stats['valid_rows']}")
    
    print("\n[步骤4] 合并历史复核记录（继承V1的人工标签）")
    merged_df, merge_stats = dm.merge_with_historical_reviews(clean_df, version_id)
    print(f"  匹配历史: {merge_stats['matched_reviews']}")
    print(f"  标签冲突: {merge_stats['conflicting_labels']}")
    print(f"  应用标签: {merge_stats['applied_labels']}")
    
    print("\n[步骤5] V2版本聚类")
    clustered_df, cluster_stats = ce.cluster_defects(merged_df)
    print(f"  聚类数量: {cluster_stats['cluster_count']}")
    
    labeled_df, _ = ce.assign_cluster_labels(clustered_df)
    reviewed_df, _ = rm.apply_reviews_to_dataframe(labeled_df)
    
    print("\n[步骤6] 与V1版本对比")
    prev_df = dm.load_processed_data(prev_version_id, "final")
    if prev_df is not None:
        comparison = ce.compare_versions(prev_df, reviewed_df)
        print(f"  V1样本数: {comparison['total_samples_old']}")
        print(f"  V2样本数: {comparison['total_samples_new']}")
        print(f"  新增样本: {len(comparison['sample_changes']['added'])}")
        print(f"  移除样本: {len(comparison['sample_changes']['removed'])}")
        print(f"  不变样本: {len(comparison['sample_changes']['unchanged'])}")
        
        if comparison['label_changes']['changed']:
            print(f"  标签变化样本:")
            for change in comparison['label_changes']['changed']:
                print(f"    {change['sample_id']}: [{change['old_label']}] -> [{change['new_label']}]")
    
    print("\n[步骤7] 计算V2指标并对比")
    v1_metrics = ce.calculate_metrics(prev_df) if prev_df is not None else {}
    v2_metrics = ce.calculate_metrics(reviewed_df)
    
    metrics_diff = rg.compare_version_metrics(v1_metrics, v2_metrics)
    print(f"  指标变化说明:")
    for note in metrics_diff['metric_notes']:
        print(f"    - {note}")
    
    if metrics_diff['label_changes']:
        print(f"  标签分布变化:")
        for label, change in metrics_diff['label_changes'].items():
            print(f"    {label}: {change['old']} -> {change['new']} ({change['delta']:+d})")
    
    print("\n[步骤8] 生成V2完整报告（包含对比信息）")
    version_info = dm.get_version_info(version_id)
    report = rg.generate_full_report(
        reviewed_df, version_info, v2_metrics,
        cluster_stats, clean_stats, merge_stats,
        comparison=comparison
    )
    print(f"  报告ID: {report['report_id']}")
    
    review_summary = rm.get_review_summary(reviewed_df)
    handoff_path = rg.generate_handoff_report(reviewed_df, version_info, review_summary)
    print(f"  V2交接报告: {handoff_path}")
    
    dm.save_processed_data(reviewed_df, version_id, "final")
    
    return version_id


def demo_list_versions_and_reports(work_dir):
    print_section("场景3: 历史版本和报告查询（补材料场景）")
    
    dm = DataManager(work_dir=work_dir)
    rg = ReportGenerator(report_dir=f"{work_dir}/reports")
    
    print("\n[版本列表]")
    versions = dm.list_versions()
    for v in versions:
        print(f"  - {v['version_id']} (模型{v['model_version']}): {v['description']}")
        print(f"    创建时间: {v['created_at']}")
    
    print("\n[报告列表]")
    reports = rg.list_reports()
    for r in reports:
        print(f"  - {r['file']}")
        print(f"    版本: {r['version_id']}, 样本数: {r['total_samples']}")


def demo_decision_trail(work_dir):
    print_section("场景4: 判断过程追溯（以某个样本为例）")
    
    rg = ReportGenerator(report_dir=f"{work_dir}/reports")
    reports = rg.list_reports()
    
    if reports:
        latest_report = reports[-1]
        report_path = Path(f"{work_dir}/reports/{latest_report['file']}")
        
        import json
        with open(report_path, 'r', encoding='utf-8') as f:
            report_data = json.load(f)
        
        if report_data['decision_trail']:
            sample_trail = report_data['decision_trail'][0]
            print(f"\n样本 {sample_trail['sample_id']} 的判断轨迹:")
            for decision in sample_trail['decisions']:
                print(f"  [{decision['step']}] {decision['action']}")
                for k, v in decision.items():
                    if k not in ['step', 'action'] and v is not None:
                        print(f"    {k}: {v}")


def main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║           图像质检缺陷聚类工具 - 完整流程演示                  ║
╚══════════════════════════════════════════════════════════════╝

功能特性:
  ✓ 版本管理 - 模型版本变化时旧报告不被覆盖
  ✓ 数据清洗 - 自动处理空值、重复样本
  ✓ 历史合并 - 自动应用历史人工标签，冲突时提示确认
  ✓ 缺陷聚类 - 基于特征的DBSCAN聚类
  ✓ 复核闭环 - 人工记录持久化，新模型不会覆盖
  ✓ 指标对比 - 版本间样本变化和指标变化分开解释
  ✓ 判断留痕 - 每个样本的完整决策轨迹
  ✓ 交接报告 - 一键生成标准化交接文档
""")
    
    print("\n>>> 开始演示 <<<")
    
    v1_version, work_dir = demo_smooth_workflow()
    v2_version = demo_rework_workflow(v1_version, work_dir)
    demo_list_versions_and_reports(work_dir)
    demo_decision_trail(work_dir)
    
    print("\n" + "="*60)
    print("  演示完成！")
    print(f"  所有数据保存在: {work_dir}/")
    print("="*60)
    print("""
目录结构说明:
  workspace_demo/
  ├── raw/              # 原始数据
  ├── processed/        # 各版本处理结果
  │   ├── v1_1_0_2/
  │   └── v2_2_0_0/
  ├── reviews/          # 人工复核记录（持久化）
  ├── reports/          # 生成的报告
  └── meta/             # 版本元数据
""")


if __name__ == "__main__":
    main()
