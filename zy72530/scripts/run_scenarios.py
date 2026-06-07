#!/usr/bin/env python3
import sys
import os
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPTS_DIR))

from engine import ReviewEngine
import json

BASE_DIR = SCRIPTS_DIR.parent
DATA_DIR = BASE_DIR / "data"


def run_scenario_001_normal():
    print("=" * 60)
    print("场景1: 顺利记录 - 正常处理流程")
    print("=" * 60)
    
    engine = ReviewEngine()
    
    print("\n[步骤1] 导入模型输出片段...")
    model_file = DATA_DIR / "model_outputs" / "model_output_batch_001.json"
    model_data = engine.load_model_output(str(model_file))
    print(f"  ✓ 已导入批次: {model_data['batch_id']}")
    print(f"  ✓ 记录数量: {len(model_data['records'])}")
    
    print("\n[步骤2] 模型评测同事小孟查看并补全人工改判表...")
    judgment_file = DATA_DIR / "manual_judgments" / "manual_judgment_batch_001.json"
    judgments = engine.apply_manual_judgment(model_data['batch_id'], str(judgment_file))
    print(f"  ✓ 人工改判已应用, 审核人: {judgments['reviewed_by']}")
    print(f"  ✓ 改判记录数: {len(judgments['judgments'])}")
    
    print("\n[步骤3] 生成评测报告...")
    report = engine.generate_report(model_data['batch_id'], "report_case_001_normal.json")
    print(f"  ✓ 报告ID: {report['report_id']}")
    print(f"  ✓ 批次状态: {report['batch_status']}")
    print(f"  ✓ 确认一致: {report['summary']['confirmed_count']} 条")
    print(f"  ✓ 人工修正: {report['summary']['modified_count']} 条")
    
    history_path = engine.save_history("case_001_normal")
    print(f"\n  ✓ 历史记录已保存: {os.path.basename(history_path)}")
    
    print("\n" + "=" * 60)
    print("场景1 完成：顺利记录，评测报告与人工改判一致")
    print("=" * 60)
    return report


def run_scenario_002_overwritten():
    print("\n\n" + "=" * 60)
    print("场景2: 人工改判被下一次批跑覆盖")
    print("=" * 60)
    
    engine = ReviewEngine()
    
    print("\n[步骤1] 导入第一次模型输出...")
    model_file = DATA_DIR / "model_outputs" / "model_output_batch_002.json"
    model_data = engine.load_model_output(str(model_file))
    orig_batch_id = model_data['batch_id']
    print(f"  ✓ 已导入批次: {orig_batch_id}")
    
    print("\n[步骤2] 小孟完成人工改判（有修正）...")
    judgment_file = DATA_DIR / "manual_judgments" / "manual_judgment_batch_002.json"
    judgments = engine.apply_manual_judgment(orig_batch_id, str(judgment_file))
    print(f"  ✓ 人工改判已应用")
    for j in judgments['judgments']:
        if j['status'] == 'modified':
            print(f"  ⚠  记录 {j['record_id']}: 模型 {j.get('original_model_score', '?')}分 → 人工 {j['manual_score']}分")
    
    print("\n[步骤3] 第二次批跑开始，覆盖第一次结果...")
    second_file = DATA_DIR / "model_outputs" / "model_output_batch_002_v2.json"
    result = engine.apply_second_batch(orig_batch_id, str(second_file))
    print(f"  ✓ 新批次: {result['new_batch_id']}")
    print(f"  ✓ 检测到冲突: {'是' if result['conflicts_detected'] else '否'}")
    
    if result['needs_safety_review']:
        print("  ⚠  状态: 待安全审核同事复核（人工改判被覆盖！）")
        print("  ℹ  别急着归正常，留给安全审核同事")
    
    print("\n[步骤4] 生成评测报告（包含冲突标记）...")
    report = engine.generate_report(result['new_batch_id'], "report_case_002_overwritten.json")
    print(f"  ✓ 报告ID: {report['report_id']}")
    print(f"  ✓ 批次状态: {report['batch_status']}")
    print(f"  ✓ 需安全审核: {'是' if report['summary']['needs_safety_review'] else '否'}")
    
    history_path = engine.save_history("case_002_overwritten")
    print(f"\n  ✓ 历史记录已保存: {os.path.basename(history_path)}")
    
    print("\n" + "=" * 60)
    print("场景2 完成：人工改判被覆盖，标记待安全审核")
    print("=" * 60)
    return report


def run_scenario_003_supplement():
    print("\n\n" + "=" * 60)
    print("场景3: 从人工改判表补录旧口径")
    print("=" * 60)
    
    engine = ReviewEngine()
    
    print("\n[步骤1] 导入旧批次模型输出（当时未完成复核）...")
    model_file = DATA_DIR / "model_outputs" / "model_output_batch_003.json"
    model_data = engine.load_model_output(str(model_file))
    batch_id = model_data['batch_id']
    print(f"  ✓ 已导入批次: {batch_id}")
    print(f"  ✓ 备注: {model_data.get('note', '无')}")
    
    print("\n[步骤2] 小孟补看人工改判表，从备份中找回旧口径...")
    supplement_file = DATA_DIR / "supplements" / "supplement_manual_judgment_003.json"
    supplement = engine.apply_supplement(batch_id, str(supplement_file))
    print(f"  ✓ 补录ID: {supplement['supplement_id']}")
    print(f"  ✓ 来源: {supplement['source']}")
    print(f"  ✓ 备注: {supplement.get('note', '')}")
    
    print("\n[步骤3] 评测报告更新（包含补录数据）...")
    report = engine.generate_report(batch_id, "report_case_003_supplement.json")
    print(f"  ✓ 报告ID: {report['report_id']}")
    print(f"  ✓ 批次状态: {report['batch_status']}")
    print(f"  ✓ 含补录数据: {'是' if report['summary']['has_supplements'] else '否'}")
    
    for rec in report['records']:
        if rec.get('is_supplement'):
            print(f"  ✓ 补录记录 {rec['record_id']}: 旧口径评分 {rec['manual_score']}分")
    
    history_path = engine.save_history("case_003_supplement")
    print(f"\n  ✓ 历史记录已保存: {os.path.basename(history_path)}")
    
    print("\n" + "=" * 60)
    print("场景3 完成：补录旧口径后评测报告更新")
    print("=" * 60)
    return report


def print_summary(reports):
    print("\n\n" + "=" * 70)
    print("三种场景处理结果对比汇总")
    print("=" * 70)
    print(f"{'场景':<20} {'状态':<20} {'安全审核':<10} {'补录':<10}")
    print("-" * 70)
    
    scenarios = [
        ("场景1: 顺利记录", reports[0]),
        ("场景2: 被覆盖", reports[1]),
        ("场景3: 补录旧口径", reports[2])
    ]
    
    for name, report in scenarios:
        status = report['batch_status']
        safety = "需审核" if report['summary']['needs_safety_review'] else "正常"
        supp = "含补录" if report['summary']['has_supplements'] else "无"
        print(f"{name:<20} {status:<20} {safety:<10} {supp:<10}")
    
    print("=" * 70)


def main():
    if len(sys.argv) > 1:
        scenario = sys.argv[1]
        if scenario == "1":
            run_scenario_001_normal()
        elif scenario == "2":
            run_scenario_002_overwritten()
        elif scenario == "3":
            run_scenario_003_supplement()
        else:
            print(f"未知场景: {scenario}")
            print("用法: python run_scenarios.py [1|2|3]")
    else:
        r1 = run_scenario_001_normal()
        r2 = run_scenario_002_overwritten()
        r3 = run_scenario_003_supplement()
        print_summary([r1, r2, r3])
    
    print("\n\n💡 生成的报告在 reports/ 目录下")
    print("💡 历史操作记录在 history/ 目录下")
    print("\n🔄 重跑命令:")
    print("  python scripts/run_scenarios.py 1   # 场景1: 顺利记录")
    print("  python scripts/run_scenarios.py 2   # 场景2: 人工改判被覆盖")
    print("  python scripts/run_scenarios.py 3   # 场景3: 补录旧口径")
    print("  python scripts/run_scenarios.py     # 全部场景")


if __name__ == "__main__":
    main()
