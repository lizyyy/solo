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
    print("\n\n" + "=" * 70)
    print("场景2: 人工改判被下一次批跑覆盖")
    print("目标: 停在「重点看评测报告和历史记录是不是能对上」")
    print("=" * 70)
    
    engine = ReviewEngine()
    
    print("\n" + "─" * 70)
    print("[步骤1] 模型输出片段第一次导入")
    print("─" * 70)
    model_file = DATA_DIR / "model_outputs" / "model_output_batch_002.json"
    model_data = engine.load_model_output(str(model_file))
    orig_batch_id = model_data['batch_id']
    rec = model_data['records'][0]
    print(f"  导入批次:       {orig_batch_id}")
    print(f"  模型版本:       {model_data['model_version']}")
    print(f"  记录ID:         {rec['record_id']}")
    print(f"  模型初判:       {rec['model_judgment']} ({rec['model_score']}分)")
    state_now = engine.get_state()[orig_batch_id]['status']
    print(f"  👉 状态变化:  (无) → {state_now}")
    
    print("\n" + "─" * 70)
    print("[步骤2] 模型评测同事小孟补看人工改判表")
    print("─" * 70)
    judgment_file = DATA_DIR / "manual_judgments" / "manual_judgment_batch_002.json"
    judgments = engine.apply_manual_judgment(orig_batch_id, str(judgment_file))
    j = judgments['judgments'][0]
    print(f"  审核人:         {judgments['reviewed_by']}")
    print(f"  记录ID:         {j['record_id']}")
    print(f"  人工判罚:       {j['manual_judgment']} ({j['manual_score']}分)")
    print(f"  是否同意模型:   {'否(有修正)' if not j['agree_with_model'] else '是'}")
    print(f"  改判备注:       {j.get('manual_comment', '')}")
    state_before = 'imported'
    state_now = engine.get_state()[orig_batch_id]['status']
    print(f"  👉 状态变化:  {state_before} → {state_now}")
    
    print("\n" + "─" * 70)
    print("[步骤2.5] 第二次批跑覆盖第一次结果")
    print("─" * 70)
    second_file = DATA_DIR / "model_outputs" / "model_output_batch_002_v2.json"
    result = engine.apply_second_batch(orig_batch_id, str(second_file))
    new_batch_id = result['new_batch_id']
    conflict = result['conflict_records'][0] if result['conflict_records'] else None
    print(f"  新批次:         {new_batch_id}")
    print(f"  原批次:         {orig_batch_id}")
    print(f"  检测到冲突:     {'是' if result['conflicts_detected'] else '否'}")
    if conflict:
        ov = conflict['original_manual_judgment']
        nm = conflict.get('new_model_output', {})
        print(f"  冲突记录:       {conflict['record_id']}")
        print(f"    V1人工改判:   {ov['manual_judgment']} ({ov['manual_score']}分)  ← 小孟之前改的")
        print(f"    V2模型重算:   {nm.get('model_judgment')} ({nm.get('model_score')}分)  ← 新批跑覆盖")
        print(f"    影响:         人工改判痕迹丢失！")
    state_now = engine.get_state()[new_batch_id]['status']
    print(f"  👉 状态变化:  imported → {state_now}")
    if result['needs_safety_review']:
        print("  ⚠  紧急: 人工改判被下一次批跑覆盖")
        print("  ⚠  处理原则: 别急着归正常，留给安全审核同事复核")
    
    print("\n" + "─" * 70)
    print("[步骤3] 评测报告更新")
    print("─" * 70)
    report = engine.generate_report(result['new_batch_id'], "report_case_002_overwritten.json")
    s = report['summary']
    ow = report.get('overwrite_context', {})
    rec_report = report['records'][0]
    print(f"  报告ID:         {report['report_id']}")
    print(f"  报告批次:       {report['batch_id']}")
    print(f"  批次状态:       {report['batch_status']}")
    print()
    print("  报告关键留痕:")
    print(f"    summary.overwrites_original_batch:                 {s.get('overwrites_original_batch')}")
    print(f"    summary.records_with_overwritten_manual_judgment:  {s.get('records_with_overwritten_manual_judgment')}")
    print(f"    summary.needs_safety_review:                       {s.get('needs_safety_review')}")
    print(f"    overwrite_context.原批次状态:                       {ow.get('original_status_before_overwrite')}")
    print(f"    overwrite_context.原人工判罚数:                     {ow.get('original_manual_judgments_count')}")
    print(f"    record.has_overwritten_manual_judgment:            {rec_report.get('has_overwritten_manual_judgment')}")
    if rec_report.get('overwritten_manual_judgment'):
        ovj = rec_report['overwritten_manual_judgment']
        print(f"    record.overwritten_manual_judgment (V1人工):      {ovj['manual_judgment']} {ovj['manual_score']}分")
    
    history_path = engine.save_history("case_002_overwritten")
    history_file_name = os.path.basename(history_path)
    print(f"\n  ✓ 历史记录已保存: {history_file_name}")
    
    print("\n" + "=" * 70)
    print("⛳ 到达检查点：重点看评测报告和历史记录是不是能对上")
    print("=" * 70)
    print()
    print("📋 报告里内嵌的 history_snapshot:")
    for i, a in enumerate(report.get('history_snapshot', []), 1):
        print(f"  {i}. {a['action']}")
    
    print("\n📋 独立历史文件 actions:")
    with open(history_path, 'r', encoding='utf-8') as f:
        history_data = json.load(f)
    for i, a in enumerate(history_data['actions'], 1):
        print(f"  {i}. {a['action']}")
    
    print("\n🔍 运行对齐检查命令:")
    print(f"  python3 scripts/view_report.py align report_case_002_overwritten.json {history_file_name}")
    print()
    print("🔍 也可以分别查看:")
    print(f"  python3 scripts/view_report.py report report_case_002_overwritten.json")
    print(f"  python3 scripts/view_report.py history {history_file_name}")
    
    return report, history_file_name


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
            result = run_scenario_002_overwritten()
            if isinstance(result, tuple) and len(result) == 2:
                _, history_name = result
                print("\n" + "=" * 70)
                print("⏸  停在检查点，请手动执行对齐检查命令（不要自动点下一步）：")
                print("=" * 70)
                print(f"\n  python3 scripts/view_report.py align report_case_002_overwritten.json {history_name}")
                print()
        elif scenario == "3":
            run_scenario_003_supplement()
        else:
            print(f"未知场景: {scenario}")
            print("用法: python3 run_scenarios.py [1|2|3]")
    else:
        r1 = run_scenario_001_normal()
        r2_result = run_scenario_002_overwritten()
        r2 = r2_result[0] if isinstance(r2_result, tuple) else r2_result
        r3 = run_scenario_003_supplement()
        print_summary([r1, r2, r3])
    
    print("\n\n💡 生成的报告在 reports/ 目录下")
    print("💡 历史操作记录在 history/ 目录下")
    print("\n🔄 重跑命令:")
    print("  python3 scripts/run_scenarios.py 1   # 场景1: 顺利记录")
    print("  python3 scripts/run_scenarios.py 2   # 场景2: 人工改判被覆盖 → 停在对齐检查点")
    print("  python3 scripts/run_scenarios.py 3   # 场景3: 补录旧口径")
    print("  python3 scripts/run_scenarios.py     # 全部场景")
    print("\n🔍 核心检查命令:")
    print("  python3 scripts/view_report.py align <报告文件> <历史文件>   # 检查报告-历史是否对齐")
    print("  python3 scripts/view_report.py report <报告文件>             # 查看评测报告详情")
    print("  python3 scripts/view_report.py history <历史文件>            # 查看操作历史详情")


if __name__ == "__main__":
    main()
