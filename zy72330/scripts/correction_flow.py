#!/usr/bin/env python3
"""
人工修正和重跑流程 - 竞赛教练唐老师演示用
"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bandit_calculator import BanditCalculator
from config import DATA_DIR


def step1_first_import():
    """步骤1: 旧公式截图第一次导入"""
    print("\n" + "="*70)
    print("  步骤1: 旧公式截图第一次导入")
    print("="*70)
    
    calculator = BanditCalculator()
    
    with open(os.path.join(DATA_DIR, 'demo_records.json'), 'r', encoding='utf-8') as f:
        records = json.load(f)
    
    print("\n导入原始数据...")
    for record in records:
        result = calculator.process_record(record, use_old_formula=False)
        print(f"  {record['id']}: 公式={result['formula_used']}, 得分={result['score']:.4f}")
    
    issues = calculator.detect_mixed_format(records)
    print(f"\n检测到格式问题: {len(issues)} 个")
    for issue in issues:
        print(f"  {issue['record_id']}: {issue['issue']} - {issue['status']}")
    
    calculator.save_history('step1_first_import')
    print("\n历史记录已保存: run_step1_first_import.json")
    return calculator


def step2_teacher_review():
    """步骤2: 竞赛教练唐老师补看老师批注"""
    print("\n" + "="*70)
    print("  步骤2: 竞赛教练唐老师补看老师批注")
    print("="*70)
    
    calculator = BanditCalculator()
    calculator.load_history('step1_first_import')
    
    with open(os.path.join(DATA_DIR, 'teacher_notes.md'), 'r', encoding='utf-8') as f:
        notes = f.read()
    
    print("\n唐老师正在查看批注文档:")
    print("-"*50)
    print(notes)
    print("-"*50)
    
    print("\n唐老师发现需要修正 REC_003，应使用旧公式")
    print("REC_002 格式问题暂不处理，留给活动负责人复核")
    
    correction = {
        'use_old_formula': True,
        'formula_used': '旧公式',
        'note': '已根据唐老师批注修正 - 应用旧公式'
    }
    
    correction_log = calculator.apply_manual_correction(
        record_id='REC_003',
        correction=correction,
        operator='唐老师'
    )
    
    print(f"\n修正记录:")
    print(f"  原值: 公式={correction_log['old_values']['formula_used']}, 得分={correction_log['old_values']['score']:.4f}")
    print(f"  新值: 公式={correction['formula_used']}")
    print(f"  操作人: {correction_log['operator']}")
    
    calculator.save_history('step2_teacher_review')
    print("\n修正后历史已保存: run_step2_teacher_review.json")
    return calculator


def step3_recalculate():
    """步骤3: 计算明细更新（重跑）"""
    print("\n" + "="*70)
    print("  步骤3: 计算明细更新 - 重跑")
    print("="*70)
    
    calculator = BanditCalculator()
    
    with open(os.path.join(DATA_DIR, 'demo_records.json'), 'r', encoding='utf-8') as f:
        records = json.load(f)
    
    print("\n根据批注重新计算...")
    for record in records:
        use_old = record.get('needs_old_formula', False)
        result = calculator.process_record(record, use_old_formula=use_old)
        print(f"  {record['id']}: 公式={result['formula_used']}, 得分={result['score']:.4f}")
    
    calculator.save_history('step3_recalculated')
    
    print("\n计算明细汇总:")
    df = calculator.get_calculation_details()
    print(df[['record_id', 'arm_id', 'click_rate_input', 'click_rate_parsed', 
              'rate_format', 'score', 'formula_used']].to_string(index=False))
    
    print("\n重跑完成，历史已保存: run_step3_recalculated.json")
    return calculator


def show_comparison():
    """展示三次运行结果对比"""
    print("\n" + "="*70)
    print("  三种处理结果对比")
    print("="*70)
    
    modes = ['step1_first_import', 'step2_teacher_review', 'step3_recalculated']
    mode_names = ['第一次导入(全用新公式)', '唐老师修正后', '重跑(应用旧公式)']
    
    for mode, name in zip(modes, mode_names):
        try:
            calculator = BanditCalculator()
            calculator.load_history(mode)
            df = calculator.get_calculation_details()
            
            print(f"\n【{name}】")
            print(df[['record_id', 'score', 'formula_used']].to_string(index=False))
        except Exception as e:
            print(f"\n【{name}】- 未找到")
    
    print("\n" + "="*70)
    print("  关键差异说明:")
    print("  - REC_001: 始终正常，使用新公式")
    print("  - REC_002: 百分数格式，保留待复核状态")
    print("  - REC_003: 新公式 vs 旧公式 得分不同")
    print("="*70)


def main():
    print("\n" + "#"*70)
    print("#  多臂老虎机活动分流 - 完整流程演示")
    print("#  竞赛教练唐老师新人培训专用")
    print("#"*70)
    
    step1_first_import()
    step2_teacher_review()
    step3_recalculate()
    show_comparison()
    
    print("\n" + "#"*70)
    print("#  演示完成！查看 results/history 目录获取详细记录")
    print("#"*70)


if __name__ == '__main__':
    main()
