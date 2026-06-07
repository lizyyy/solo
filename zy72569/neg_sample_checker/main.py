#!/usr/bin/env python3
"""序列推荐负采样检查工具 - 主入口"""

import argparse
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.workflow import WorkflowEngine
from src.reporter import Reporter


def print_step_result(step):
    status_icon = "✅" if step.status == "completed" else "❌" if step.status == "failed" else "⏳"
    print(f"\n{status_icon} {step.step_name} [{step.status.upper()}]")
    
    for result in step.results:
        icon = "✅" if result.passed else "⚠️" if result.severity == "warning" else "❌"
        print(f"  {icon} {result.check_name}: {'通过' if result.passed else '不通过'}")
        if result.suggestion:
            print(f"     💡 建议: {result.suggestion}")
    
    if step.conflicts:
        pending = sum(1 for c in step.conflicts if c.resolution == "pending")
        print(f"  ⚔️  冲突: {len(step.conflicts)} 条 (待处理: {pending})")
        for c in step.conflicts[:3]:
            print(f"     - {c.description} [{c.resolution}]")
        if len(step.conflicts) > 3:
            print(f"     ... 还有 {len(step.conflicts) - 3} 条冲突")


def interactive_mode(engine, reporter):
    print("\n" + "="*60)
    print("序列推荐负采样检查 - 交互模式")
    print("="*60)
    
    neg_path = input("请输入负样本列表CSV路径: ").strip()
    if not neg_path or not os.path.exists(neg_path):
        print("❌ 文件不存在")
        return
    
    step1 = engine.run_step1_import(neg_path)
    print_step_result(step1)
    
    recall_path = input("\n请输入召回候选表CSV路径: ").strip()
    if recall_path and os.path.exists(recall_path):
        step2 = engine.run_step2_compare(recall_path)
        print_step_result(step2)
        
        if step2.conflicts:
            print("\n⚠️  检测到标签冲突，请数据科学家林姐确认或驳回")
            print("   不要替业务同事自动拍板！")
            for i, c in enumerate(step2.conflicts):
                print(f"\n   冲突 {i+1}: {c.description}")
                print(f"   负样本标签: {c.neg_sample_data}")
                print(f"   召回候选标签: {c.recall_candidate_data}")
                choice = input("   操作 [c=确认, r=驳回, s=跳过]: ").strip().lower()
                if choice == 'c':
                    engine.resolve_conflict(c.conflict_id, 'confirmed')
                    print("   ✅ 已确认")
                elif choice == 'r':
                    engine.resolve_conflict(c.conflict_id, 'rejected')
                    print("   ❌ 已驳回")
    
    threshold_input = input("\n请输入阈值 (回车使用默认0.5): ").strip()
    threshold = float(threshold_input) if threshold_input else None
    step3 = engine.run_step3_playback(threshold)
    print_step_result(step3)
    
    supplement = input("\n是否需要补录数据？[y/N]: ").strip().lower()
    if supplement == 'y':
        supp_path = input("请输入补录数据CSV路径: ").strip()
        if supp_path and os.path.exists(supp_path):
            success, count = engine.apply_supplement(supp_path)
            if success:
                print(f"✅ 补录成功，新增 {count} 条数据")
                print("   已自动重新运行重复导入和少数类检查")
                
                if recall_path and os.path.exists(recall_path):
                    engine.run_step2_compare(recall_path)
                engine.run_step3_playback()
            else:
                print("❌ 补录失败")
    
    print("\n" + "="*60)
    print("生成报告...")
    report_paths = reporter.generate_report(engine)
    print(f"✅ JSON报告: {report_paths['json']}")
    print(f"✅ HTML报告: {report_paths['html']}")
    print("="*60)


def run_batch_mode(args):
    engine = WorkflowEngine(args.config)
    reporter = Reporter(os.path.join(os.path.dirname(__file__), 'reports'))
    
    print(f"\n📊 批量运行检查: {args.scenario}")
    
    base_dir = os.path.join(os.path.dirname(__file__), 'data', args.scenario)
    neg_path = os.path.join(base_dir, 'neg_samples.csv')
    recall_path = os.path.join(base_dir, 'recall_candidates.csv')
    supplement_path = os.path.join(base_dir, 'supplement.csv')
    
    if not os.path.exists(neg_path):
        print(f"❌ 场景数据不存在: {neg_path}")
        return
    
    step1 = engine.run_step1_import(neg_path)
    print_step_result(step1)
    
    if os.path.exists(recall_path):
        step2 = engine.run_step2_compare(recall_path)
        print_step_result(step2)
    
    step3 = engine.run_step3_playback(args.threshold)
    print_step_result(step3)
    
    if os.path.exists(supplement_path):
        print("\n📝 检测到补录材料，正在应用...")
        success, count = engine.apply_supplement(supplement_path)
        if success:
            print(f"✅ 补录完成，新增 {count} 条，正在重算...")
            if os.path.exists(recall_path):
                engine.run_step2_compare(recall_path)
            engine.run_step3_playback()
    
    report_paths = reporter.generate_report(engine, f"report_{args.scenario}")
    print(f"\n✅ 报告生成:")
    print(f"   JSON: {report_paths['json']}")
    print(f"   HTML: {report_paths['html']}")


def main():
    parser = argparse.ArgumentParser(description="序列推荐负采样检查工具")
    parser.add_argument('--config', type=str, 
                       default=os.path.join(os.path.dirname(__file__), 'config/settings.yaml'),
                       help='配置文件路径')
    parser.add_argument('--mode', type=str, choices=['interactive', 'batch'], default='interactive',
                       help='运行模式: interactive(交互) 或 batch(批量)')
    parser.add_argument('--scenario', type=str, choices=['normal', 'wrong_caliber', 'supplement'],
                       default='normal', help='批量模式下的场景')
    parser.add_argument('--threshold', type=float, default=None, help='自定义阈值')
    
    args = parser.parse_args()
    
    engine = WorkflowEngine(args.config)
    reporter = Reporter(os.path.join(os.path.dirname(__file__), 'reports'))
    
    if args.mode == 'interactive':
        interactive_mode(engine, reporter)
    else:
        run_batch_mode(args)


if __name__ == '__main__':
    main()
