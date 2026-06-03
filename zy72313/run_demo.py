#!/usr/bin/env python3
"""
演示脚本：展示完整的三步工作流
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from pathlib import Path
from markov_churn import (
    MarkovChurnModel,
    DataImporter,
    HistoryManager,
    ReviewSystem,
    Visualizer
)
import yaml


def load_config():
    with open('config.yaml', 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def main():
    config = load_config()
    
    for dir_key in ['data_dir', 'history_dir', 'import_dir', 'export_dir']:
        Path(config['system'][dir_key]).mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("Markov 客户流失转移 - 三步工作流演示")
    print("=" * 60)

    history_mgr = HistoryManager(config['system']['history_dir'])
    review_sys = ReviewSystem(
        Path(config['system']['data_dir']) / "reviews.json",
        history_mgr
    )
    importer = DataImporter(config['system']['import_dir'], history_mgr)
    
    model = MarkovChurnModel(
        states=config['markov_model']['states'],
        smoothing_factor=config['markov_model']['smoothing_factor']
    )

    print("\n" + "=" * 60)
    print("步骤1: 导入旧公式截图")
    print("=" * 60)
    
    test_file = "test_data/sample_formula_data.csv"
    print(f"\n导入文件: {test_file}")
    
    result = importer.import_csv(test_file, model, skip_duplicates=True, check_multiple_answers=True)
    print(f"导入结果: {result['status']}")
    print(f"导入记录数: {result['imported_count']}")
    
    if result.get('requires_review'):
        print(f"\n⚠️  检测到需要复核: {result['review_type']}")
        for student_id in result.get('multiple_answer_students', []):
            print(f"  - 学生 {student_id} 存在多版答案")
            
            versions = model.get_student_versions(student_id)
            print(f"    版本详情:")
            for key, states in versions.items():
                print(f"      {key}: {len(states)}条记录")
            
            review = review_sys.check_and_create_multiple_answer_review(
                student_id,
                {k: [{'state': s.state, 'timestamp': s.timestamp.isoformat(), 
                      'error_notes': s.error_notes, 'annotations': s.annotations} 
                     for s in v]
                 for k, v in versions.items()},
                result.get('source_file', '')
            )
            if review:
                print(f"\n    ✅ 创建复核任务: {review.review_id}")
                print(f"       分配给: {review.assigned_to}")

    print("\n" + "=" * 60)
    print("步骤2: 唐老师补看老师批注")
    print("=" * 60)
    
    pending_reviews = review_sys.get_pending_reviews('multiple_answers')
    print(f"\n待处理复核任务: {len(pending_reviews)}")
    
    for review in pending_reviews:
        print(f"\n复核任务: {review.review_id}")
        print(f"  类型: {review.review_type}")
        print(f"  学生: {review.data.get('student_id')}")
        print(f"  问题: {review.data.get('issue')}")
        
        print("\n  各版本批注对比:")
        for version_key, states in review.data.get('versions', {}).items():
            print(f"\n    版本 {version_key}:")
            for state in states:
                annotations = state.get('annotations', {})
                print(f"      - {state.get('timestamp')}: {state.get('state')}")
                if annotations:
                    print(f"        老师批注: {annotations.get('teacher', '未知')} - {annotations.get('comment', '无')}")
                if state.get('error_notes'):
                    print(f"        误差说明: {state.get('error_notes')}")

    print("\n" + "=" * 60)
    print("步骤3: 误差说明更新（唐老师处理复核）")
    print("=" * 60)
    
    if pending_reviews:
        review_to_approve = pending_reviews[0]
        print(f"\n批准复核: {review_to_approve.review_id}")
        
        approved = review_sys.approve(
            review_to_approve.review_id,
            approver="唐老师",
            comment="经与业务运营复核，确认使用第2版答案，误差说明已更新"
        )
        
        print(f"  状态: {approved.status}")
        print(f"  处理人: {approved.resolved_by}")
        print(f"  处理时间: {approved.resolved_at}")

    print("\n" + "=" * 60)
    print("操作历史记录（可复盘）")
    print("=" * 60)
    
    versions = history_mgr.list_versions(limit=10)
    for v in versions:
        rollback_marker = "[回滚]" if v.is_rollback else ""
        print(f"  {v.version_id} | {v.author:8} | {v.description} {rollback_marker}")

    print("\n" + "=" * 60)
    print("可复现命令记录")
    print("=" * 60)
    print("\n重新运行整个流程的命令:")
    print(f"  python cli.py import-data {test_file}")
    print(f"  python cli.py check-answers")
    pending = review_sys.get_pending_reviews('multiple_answers')
    if not pending:
        all_reviews = review_sys.list_reviews(limit=1)
        if all_reviews:
            print(f"  python cli.py review {all_reviews[0].review_id} approve --author 唐老师")

    print("\n" + "=" * 60)
    print("生成可视化图表（先服务复核）")
    print("=" * 60)
    
    model.estimate_transition_matrix()
    viz = Visualizer(
        model,
        config['system']['export_dir'],
        enable_3d=config['visualization']['enable_3d']
    )
    
    print("\n点击数据点可查看:")
    sample_customer = list(model.customers.keys())[0]
    click_data = viz.get_clickable_data_point(sample_customer)
    print(f"\n客户 {sample_customer} 详细数据:")
    print(f"  - 状态历史: {len(click_data.get('state_history', []))}条记录")
    if click_data.get('state_history'):
        latest = click_data['state_history'][-1]
        print(f"  - 最新状态: {latest['state']}")
        print(f"  - 学生ID: {latest['student_id']}")
        print(f"  - 答案版本: v{latest['answer_version']}")
        print(f"  - 来源文件: {latest['source_file']}")
        if latest.get('annotations'):
            print(f"  - 老师批注: {latest['annotations']}")
    
    review_link = viz.generate_review_link(sample_customer, "review_demo")
    print(f"\n复核链接: {review_link['review_url']}")
    print(f"原始数据链接: {review_link['raw_data_link']}")

    print("\n" + "=" * 60)
    print("✅ 三步工作流演示完成")
    print("=" * 60)
    print("\n边界规则总结:")
    print("  1. ✅ 同一学生多版答案 → 创建复核任务，不自动合并")
    print("  2. ✅ 重复导入文件 → 自动跳过（幂等性）")
    print("  3. ✅ 批注修改 → 记录版本历史")
    print("  4. ✅ 3D图表点击 → 显示原始数据+复核链接")
    print("  5. ✅ 回滚操作 → 本身也记录为新版本")
    print("\n所有操作都可复盘，可重新执行！")


if __name__ == '__main__':
    main()
