#!/usr/bin/env python3
"""
多臂老虎机活动分流 - 主运行脚本
"""
import argparse
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bandit_calculator import BanditCalculator
from config import DATA_DIR, RESULTS_DIR


def load_records(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def run_demo(mode: str = 'normal', run_id: str = None):
    calculator = BanditCalculator()
    
    records_path = os.path.join(DATA_DIR, 'demo_records.json')
    records = load_records(records_path)
    
    print(f"\n{'='*60}")
    print(f"  多臂老虎机活动分流 - 运行模式: {mode}")
    print(f"{'='*60}")
    
    print(f"\n[步骤1] 检测数据格式问题...")
    issues = calculator.detect_mixed_format(records)
    if issues:
        print(f"  发现 {len(issues)} 个格式问题:")
        for issue in issues:
            print(f"    - {issue['record_id']}: {issue['issue']} ({issue['value']})")
            print(f"      状态: {issue['status']}")
    else:
        print("  未发现格式问题")
    
    print(f"\n[步骤2] 处理记录...")
    results = []
    
    for record in records:
        use_old = False
        
        if mode == 'wrong' and record.get('needs_old_formula'):
            use_old = False
            print(f"  [错口径] {record['id']}: 误用新公式")
        
        if mode == 'corrected' and record.get('needs_old_formula'):
            use_old = True
            print(f"  [补录修正] {record['id']}: 应用旧公式 (唐老师批注)")
        
        result = calculator.process_record(record, use_old_formula=use_old)
        results.append(result)
        
        print(f"  {record['id']} (arm_{record['arm_id']}):")
        print(f"    输入点击率: {result['click_rate_input']} ({result['rate_format']})")
        print(f"    解析后: {result['click_rate_parsed']:.4f}")
        print(f"    得分: {result['score']:.4f} ({result['formula_used']})")
    
    print(f"\n[步骤3] 计算明细汇总:")
    df = calculator.get_calculation_details()
    print(df[['record_id', 'arm_id', 'click_rate_parsed', 'score', 'formula_used']].to_string(index=False))
    
    if run_id:
        save_path = calculator.save_history(run_id)
        print(f"\n[步骤4] 历史记录已保存: {save_path}")
    
    return calculator, results


def main():
    parser = argparse.ArgumentParser(description='多臂老虎机活动分流')
    parser.add_argument('--mode', type=str, default='normal',
                        choices=['normal', 'wrong', 'corrected'],
                        help='运行模式: normal(正常), wrong(错口径), corrected(补录修正)')
    parser.add_argument('--run-id', type=str, default=None, help='运行ID')
    parser.add_argument('--show-history', type=str, default=None, help='显示历史记录ID')
    
    args = parser.parse_args()
    
    if args.show_history:
        calculator = BanditCalculator()
        data = calculator.load_history(args.show_history)
        print(f"\n历史记录 {args.show_history}:")
        df = calculator.get_calculation_details()
        print(df[['record_id', 'arm_id', 'click_rate_parsed', 'score', 'formula_used']].to_string(index=False))
        return
    
    run_id = args.run_id or args.mode
    run_demo(mode=args.mode, run_id=run_id)


if __name__ == '__main__':
    main()
