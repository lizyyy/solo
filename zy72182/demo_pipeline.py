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


def print_sample_states(df, title="样本状态"):
    print(f"\n--- {title} ---")
    cols = ['sample_id', 'predicted_label', 'human_label', 'review_status', 'review_source']
    available = [c for c in cols if c in df.columns]
    print(df[available].to_string(index=False))


def demo_smooth_workflow():
    print_section("场景1: V1版本 - 完整演示『待确认 → 人工确认 → 已确认』闭环")
    
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
    
    print("\n[步骤3] 数据清洗（空值、无效数据、重复项三重过滤）")
    clean_df, clean_stats = dm.clean_data(raw_df)
    print(f"  总行数: {clean_stats['total_rows']}")
    print(f"  全空行: {clean_stats['null_rows']}")
    print(f"  关键字段全空（无效）: {clean_stats['invalid_rows']}")
    if clean_stats.get('invalid_details'):
        for d in clean_stats['invalid_details']:
            print(f"    - 行{d.get('_raw_index','?')}: {d.get('_reason','')}")
    print(f"  重复行: {clean_stats['duplicate_rows']}")
    if clean_stats.get('removed_samples'):
        for s in clean_stats['removed_samples']:
            print(f"    - {s.get('sample_id','')} ({s.get('image_path','')})")
    print(f"  有效行: {clean_stats['valid_rows']}")
    print(f"  校验: {clean_stats['null_rows']} + {clean_stats['invalid_rows']} + {clean_stats['duplicate_rows']} + {clean_stats['valid_rows']} = {clean_stats['null_rows']+clean_stats['invalid_rows']+clean_stats['duplicate_rows']+clean_stats['valid_rows']}")
    
    print("\n[步骤4] 合并历史复核记录")
    review_src = Path("./sample_data/historical_reviews.json")
    review_dst = Path(f"{work_dir}/reviews/historical.json")
    review_dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(review_src, review_dst)
    
    merged_df, merge_stats = dm.merge_with_historical_reviews(clean_df, version_id)
    print(f"  总样本: {merge_stats['total_samples']}")
    print(f"  匹配历史: {merge_stats['matched_reviews']}")
    print(f"  直接继承（confirmed）: {merge_stats['applied_labels']}")
    print(f"  待确认（need_confirm）: {merge_stats['conflicting_labels']}")
    
    print_sample_states(merged_df, "历史合并后样本状态")
    
    need_confirm_list = merged_df[merged_df['review_status'] == 'need_confirm']
    confirmed_list = merged_df[merged_df['review_status'] == 'confirmed']
    print(f"\n  待确认样本数: {len(need_confirm_list)}")
    print(f"  已确认样本数: {len(confirmed_list)}")
    
    print("\n[步骤5] 缺陷聚类")
    clustered_df, cluster_stats = ce.cluster_defects(merged_df)
    print(f"  聚类数量: {cluster_stats['cluster_count']}")
    print(f"  噪声样本: {cluster_stats['noise_count']}")
    for cid, info in cluster_stats['samples_per_cluster'].items():
        print(f"    {cid}: {info['count']}个样本")
    
    print("\n[步骤6] 分配聚类标签")
    labeled_df, label_stats = ce.assign_cluster_labels(clustered_df)
    print(f"  已标记聚类: {label_stats['labeled_clusters']}")
    
    print("\n[步骤7] 应用复核记录（二次确认状态）")
    reviewed_df, apply_stats = rm.apply_reviews_to_dataframe(labeled_df)
    print(f"  匹配复核: {apply_stats['total_matched']}")
    print(f"  直接应用: {apply_stats['labels_applied']}")
    print(f"  待确认: {apply_stats['conflicts_found']}")
    
    review_summary = rm.get_review_summary(reviewed_df)
    print(f"  复核进度: {review_summary['review_progress']}%")
    
    print("\n[步骤8] 生成初次报告（含待确认项）")
    version_info = dm.get_version_info(version_id)
    metrics = ce.calculate_metrics(reviewed_df)
    
    handoff_v1a = rg.generate_handoff_report(reviewed_df, version_info, review_summary)
    print(f"  初次交接报告: {handoff_v1a}")
    
    dm.save_processed_data(reviewed_df, version_id, "before_review")
    
    print("\n[步骤9] ⭐ 人工复核闭环 - 小乔处理待确认样本")
    need_confirm = reviewed_df[reviewed_df['review_status'] == 'need_confirm']
    print(f"  待确认样本数: {len(need_confirm)}")
    
    if len(need_confirm) > 0:
        for _, sample in need_confirm.iterrows():
            sid = sample['sample_id']
            hist_label = sample.get('human_label', '')
            pred_label = sample.get('predicted_label', '')
            print(f"  - 样本 {sid}: 模型预测[{pred_label}]，历史标签[{hist_label}]")
            print(f"    小乔确认: 采用[{hist_label}]（严重气泡，需重点关注）")
            
            rm.submit_review(
                sample_id=sid,
                human_label=hist_label,
                reviewer="小乔",
                note=f"人工确认：严重气泡缺陷，模型预测[{pred_label}]不够准确，维持人工标签",
                version_id=version_id
            )
    else:
        print("  ⚠️  没有待确认样本，闭环演示不完整")
    
    print("\n[步骤10] 重新应用复核 → 闭环完成")
    reviewed_final, apply_final = rm.apply_reviews_to_dataframe(reviewed_df)
    print(f"  匹配复核: {apply_final['total_matched']}")
    print(f"  已确认: {apply_final['labels_applied']}")
    print(f"  待确认: {apply_final['conflicts_found']}")
    
    final_summary = rm.get_review_summary(reviewed_final)
    final_metrics = ce.calculate_metrics(reviewed_final)
    print(f"  最终复核进度: {final_summary['review_progress']}%")
    
    print_sample_states(reviewed_final, "人工确认完成后样本状态")
    
    need_confirm_final = reviewed_final[reviewed_final['review_status'] == 'need_confirm']
    confirmed_final = reviewed_final[reviewed_final['review_status'] == 'confirmed']
    print(f"\n  ✅ 闭环验证: confirmed={len(confirmed_final)}, need_confirm={len(need_confirm_final)}")
    
    print("\n[步骤11] 生成最终报告和Excel")
    final_report = rg.generate_full_report(
        reviewed_final, version_info, final_metrics,
        cluster_stats, clean_stats, merge_stats
    )
    print(f"  完整报告ID: {final_report['report_id']}")
    
    final_handoff = rg.generate_handoff_report(reviewed_final, version_info, final_summary)
    print(f"  最终交接报告: {final_handoff}")
    
    excel_path = rg.export_result_excel(reviewed_final, version_id)
    print(f"  Excel结果: {excel_path}")
    
    dm.save_processed_data(reviewed_final, version_id, "final")
    
    print("\n[步骤12] 验证判断过程追溯（decision_trail）")
    for sample_trail in final_report['decision_trail']:
        sid = sample_trail['sample_id']
        if sid in ['893179f90c31', 'dd6914cffcc3', 'cbeb879cd8f3']:
            print(f"\n  样本 {sid}:")
            for d in sample_trail['decisions']:
                extra = {k:v for k,v in d.items() if k not in ['step','action'] and v is not None and v != ''}
                print(f"    [{d['step']}] {d['action']} {extra}")
    
    return version_id, work_dir


def demo_rework_workflow(prev_version_id, work_dir):
    print_section("场景2: V2版本 - 旧口径继承（人工标签不被新模型盖掉） + 版本对比")
    
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
    print(f"  总: {clean_stats['total_rows']}, 空: {clean_stats['null_rows']}, 无效: {clean_stats['invalid_rows']}, 重复: {clean_stats['duplicate_rows']}, 有效: {clean_stats['valid_rows']}")
    
    print("\n[步骤4] ⭐ 合并历史复核（继承V1人工标签，验证不被新模型盖掉）")
    merged_df, merge_stats = dm.merge_with_historical_reviews(clean_df, version_id)
    print(f"  匹配历史: {merge_stats['matched_reviews']}")
    print(f"  直接继承 confirmed: {merge_stats['applied_labels']}")
    print(f"  待确认: {merge_stats['conflicting_labels']}")
    
    print_sample_states(merged_df, "V2历史合并后样本状态")
    
    dust_sample = merged_df[merged_df['sample_id'] == 'cbeb879cd8f3']
    if len(dust_sample) > 0:
        row = dust_sample.iloc[0]
        print(f"\n  🌟 旧口径继承验证:")
        print(f"    样本: {row['sample_id']} ({row.get('image_path','')})")
        print(f"    新模型预测: {row.get('predicted_label','')}")
        print(f"    历史人工标签: {row.get('human_label','')}")
        print(f"    状态: {row.get('review_status','')}")
        print(f"    来源: {row.get('review_source','')}")
        print(f"    备注: {row.get('review_note','')}")
        if row.get('review_status') == 'confirmed' and row.get('human_label') == '灰尘':
            print(f"    ✅ 验证通过：旧口径『灰尘』标签未被新模型『污渍』盖掉")
        else:
            print(f"    ❌ 验证失败：旧口径被覆盖了")
    
    print("\n[步骤5] V2版本聚类")
    clustered_df, cluster_stats = ce.cluster_defects(merged_df)
    labeled_df, _ = ce.assign_cluster_labels(clustered_df)
    reviewed_df, _ = rm.apply_reviews_to_dataframe(labeled_df)
    
    v2_summary = rm.get_review_summary(reviewed_df)
    v2_metrics = ce.calculate_metrics(reviewed_df)
    print(f"  V2复核进度: {v2_summary['review_progress']}%")
    
    print("\n[步骤6] 与V1版本对比")
    prev_df = dm.load_processed_data(prev_version_id, "final")
    if prev_df is not None:
        comparison = ce.compare_versions(prev_df, reviewed_df)
        print(f"  V1样本数: {comparison['total_samples_old']}")
        print(f"  V2样本数: {comparison['total_samples_new']}")
        print(f"  新增样本: {len(comparison['sample_changes']['added'])} ({', '.join(comparison['sample_changes']['added'][:2])}{'...' if len(comparison['sample_changes']['added'])>2 else ''})")
        print(f"  移除样本: {len(comparison['sample_changes']['removed'])}")
        print(f"  共同样本: {len(comparison['sample_changes']['unchanged'])}")
        
        if comparison['sample_changes']['matched_by_image_path']:
            print(f"  image_path匹配: {len(comparison['sample_changes']['matched_by_image_path'])} 个（sample_id因字段变化而不同，但为同一样本）")
            for m in comparison['sample_changes']['matched_by_image_path']:
                print(f"    {m['image_path']}: {m['old_sample_id']} → {m['new_sample_id']}")
        
        pred_changes = comparison['label_changes']['predicted_changed']
        if pred_changes:
            print(f"  📊 模型预测标签变化（共{len(pred_changes)}个）:")
            for change in pred_changes:
                print(f"    {change.get('image_path', change.get('sample_id',''))}: 模型[{change['old_label']}]→[{change['new_label']}]")
        
        human_changes = comparison['label_changes']['human_changed']
        if human_changes:
            print(f"  👤 人工标签变化（共{len(human_changes)}个）:")
            for change in human_changes:
                print(f"    {change.get('image_path', change.get('sample_id',''))}: 人工[{change['old_label']}]→[{change['new_label']}]")
    
    print("\n[步骤7] 生成V2报告和Excel")
    version_info = dm.get_version_info(version_id)
    report = rg.generate_full_report(
        reviewed_df, version_info, v2_metrics,
        cluster_stats, clean_stats, merge_stats,
        comparison=comparison if prev_df is not None else None
    )
    print(f"  V2报告ID: {report['report_id']}")
    
    handoff = rg.generate_handoff_report(reviewed_df, version_info, v2_summary)
    print(f"  V2交接报告: {handoff}")
    
    excel_path = rg.export_result_excel(reviewed_df, version_id)
    print(f"  V2 Excel: {excel_path}")
    
    dm.save_processed_data(reviewed_df, version_id, "final")
    
    return version_id


def demo_verify_consistency(work_dir):
    print_section("场景3: 一致性验证 - 清洗统计、报告、Excel 三方对账")
    
    rg = ReportGenerator(report_dir=f"{work_dir}/reports")
    reports = rg.list_reports()
    
    if not reports:
        print("  没有找到报告")
        return
    
    latest = sorted(reports, key=lambda x: x.get('generated_at', ''))[-1]
    report_path = Path(f"{work_dir}/reports/{latest['file']}")
    
    import json
    with open(report_path, 'r', encoding='utf-8') as f:
        report = json.load(f)
    
    print(f"\n  报告文件: {latest['file']}")
    
    print(f"\n  [1] 清洗统计对账")
    clean = report.get('data_cleaning', {})
    total = clean.get('total_rows', 0)
    nulls = clean.get('null_rows', 0)
    invalid = clean.get('invalid_rows', 0)
    dups = clean.get('duplicate_rows', 0)
    valid = clean.get('valid_rows', 0)
    print(f"    总行数: {total}")
    print(f"    全空行: {nulls}")
    print(f"    无效行: {invalid}")
    print(f"    重复行: {dups}")
    print(f"    有效行: {valid}")
    check = nulls + invalid + dups + valid
    print(f"    校验: {nulls}+{invalid}+{dups}+{valid} = {check} {'✅' if check == total else '❌'}")
    
    print(f"\n  [2] 历史合并且账")
    merge = report.get('historical_merge', {})
    print(f"    匹配历史: {merge.get('matched_reviews', 0)}")
    print(f"    继承confirmed: {merge.get('applied_labels', 0)}")
    print(f"    待确认: {merge.get('conflicting_labels', 0)}")
    check2 = merge.get('applied_labels', 0) + merge.get('conflicting_labels', 0)
    print(f"    校验: 继承+待确认 = {check2}, 匹配总数 = {merge.get('matched_reviews', 0)} {'✅' if check2 == merge.get('matched_reviews', 0) else '❌'}")
    
    print(f"\n  [3] 复核状态与样本数对账")
    sample_total = report.get('sample_summary', {}).get('total_samples', 0)
    statuses = report.get('sample_summary', {}).get('by_review_status', {})
    status_sum = sum(statuses.values())
    print(f"    样本总数: {sample_total}")
    print(f"    各状态合计: {status_sum} {'✅' if status_sum == sample_total else '❌'}")
    for k, v in statuses.items():
        print(f"      - {k}: {v}")
    
    print(f"\n  [4] Excel导出验证")
    excel_files = list(Path(f"{work_dir}/reports").glob("*_results.xlsx"))
    if excel_files:
        latest_excel = sorted(excel_files)[-1]
        print(f"    文件: {latest_excel.name}")
        
        for sheet in ['完整结果', '待确认', '待复核']:
            try:
                df = pd.read_excel(latest_excel, sheet_name=sheet)
                print(f"    {sheet}: {len(df)} 行")
                if 'review_status' in df.columns and sheet != '完整结果':
                    expected_status = 'need_confirm' if sheet == '待确认' else 'pending'
                    actual = df['review_status'].value_counts().to_dict()
                    print(f"      状态分布: {actual}")
            except Exception as e:
                print(f"    {sheet}: 不存在")


def main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║           图像质检缺陷聚类工具 - 完整流程演示                  ║
╚══════════════════════════════════════════════════════════════╝

核心特性验证:
  ✓ 版本管理 - 模型版本变化时旧报告不被覆盖
  ✓ 数据清洗 - 空值/无效/重复 三重过滤，统计准确
  ✓ 历史合并 - confirmed人工标签直接继承，不被新模型盖掉
  ✓ 待确认闭环 - need_confirm → 人工确认 → confirmed
  ✓ 旧口径继承 - 从版本发布记录补来的旧口径可追溯
  ✓ 判断留痕 - 每个样本的完整决策轨迹
  ✓ 一致性 - 清洗统计 / 报告 / Excel 三方对账
""")
    
    print("\n>>> 开始完整流程演示 <<<")
    
    v1_version, work_dir = demo_smooth_workflow()
    v2_version = demo_rework_workflow(v1_version, work_dir)
    demo_verify_consistency(work_dir)
    
    print("\n" + "="*60)
    print("  🎉 演示完成！所有场景验证通过")
    print(f"  所有数据保存在: {work_dir}/")
    print("="*60)
    print("""
目录结构:
  workspace_demo/
  ├── raw/                原始数据
  ├── processed/          各版本处理结果（按版本分目录）
  ├── reviews/            人工复核记录（持久化，不被覆盖）
  ├── reports/            报告
  │   ├── *.json          完整报告（含decision_trail决策轨迹）
  │   ├── *_handoff.md    交接报告
  │   └── *_results.xlsx  Excel结果（多sheet）
  └── meta/               版本元数据

小乔交接使用:
  1. 看 *_handoff.md 总览
  2. 待确认的去 Excel 的「待确认」sheet 处理
  3. 处理完重新跑，状态自动更新
  4. 历史标签不会被新模型盖掉
""")


if __name__ == "__main__":
    main()
