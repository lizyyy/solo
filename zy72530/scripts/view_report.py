#!/usr/bin/env python3
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPTS_DIR))

from engine import ReviewEngine

BASE_DIR = SCRIPTS_DIR.parent
REPORTS_DIR = BASE_DIR / "reports"
HISTORY_DIR = BASE_DIR / "history"


def view_report(report_name: str):
    report_path = REPORTS_DIR / report_name
    if not report_path.exists():
        print(f"报告不存在: {report_name}")
        return
    
    with open(report_path, 'r', encoding='utf-8') as f:
        report = json.load(f)
    
    print("=" * 70)
    print(f"评测报告: {report['report_id']}")
    print("=" * 70)
    print(f"批次ID:     {report['batch_id']}")
    print(f"模型版本:   {report['model_version']}")
    print(f"生成时间:   {report['generated_at']}")
    print(f"批次状态:   {report['batch_status']}")
    print()
    
    s = report['summary']
    print("📊 摘要:")
    print(f"  总记录数:               {s['total_records']}")
    print(f"  有人工判罚(当前批次):   {s['records_with_manual_judgment']}")
    print(f"  确认一致:               {s['confirmed_count']}")
    print(f"  人工修正:               {s['modified_count']}")
    print(f"  绝对分差总计:           {s['total_abs_score_diff']}")
    print(f"  有批跑覆盖:             {'是' if s['has_overwrites'] else '否'}")
    print(f"  有补录数据:             {'是' if s['has_supplements'] else '否'}")
    print(f"  需安全审核:             {'⚠️ 是' if s['needs_safety_review'] else '否'}")
    if s.get('overwrites_original_batch'):
        print(f"  ⬇  覆盖自原批次:         {s['overwrites_original_batch']}")
    if s.get('records_with_overwritten_manual_judgment'):
        print(f"  ⚡ 带被覆盖人工改判记录:  {s['records_with_overwritten_manual_judgment']}")
    print()
    
    ow = report.get('overwrite_context')
    if ow:
        print("� 覆盖上下文:")
        print(f"  原批次ID:       {ow.get('overwrites_original_batch')}")
        print(f"  原批次状态:     {ow.get('original_status_before_overwrite')}")
        print(f"  原人工判罚数:   {ow.get('original_manual_judgments_count')}")
        print(f"  冲突记录数:     {ow.get('safety_conflicts_count')}")
        if ow.get('overwrite_details'):
            for od in ow['overwrite_details']:
                print(f"  覆盖时间:       {od.get('timestamp')}")
                print(f"  说明:           {od.get('note')}")
        print()
    
    print("�📋 明细记录:")
    for rec in report['records']:
        print(f"\n  ┌─ [{rec['record_id']}] {rec['question_id']}")
        print(f"  │  模型判罚: {rec['model_judgment']} ({rec['model_score']}分)")
        if rec.get('has_manual_judgment'):
            print(f"  │  人工判罚: {rec['manual_judgment']} ({rec['manual_score']}分)")
            print(f"  │  是否同意模型: {'是' if rec['agree_with_model'] else '否'}")
            print(f"  │  状态: {rec['judgment_status']}")
            if rec.get('score_diff', 0) != 0:
                print(f"  │  分差: {rec['score_diff']:+d}")
            if rec.get('is_supplement'):
                print(f"  │  ⚡ 补录数据")
            if rec.get('manual_comment'):
                print(f"  │  备注: {rec['manual_comment']}")
        else:
            print(f"  │  ⚠  当前批次暂无人工判罚")
        
        if rec.get('has_overwritten_manual_judgment'):
            ov = rec['overwritten_manual_judgment']
            print(f"  │")
            print(f"  ├─⚠️  被覆盖前的V1人工改判:")
            print(f"  │  V1人工判罚: {ov['manual_judgment']} ({ov['manual_score']}分)")
            print(f"  │  V1是否同意模型: {'是' if ov['agree_with_model_before'] else '否'}")
            print(f"  │  V1状态: {ov['judgment_status_before']}")
            if rec.get('overwritten_score_diff', 0) != 0:
                print(f"  │  V1分差(人工-V2模型): {rec['overwritten_score_diff']:+d}")
            if ov.get('manual_comment_before'):
                print(f"  │  V1备注: {ov['manual_comment_before']}")
            print(f"  │  👉 此人工改判已被新批跑覆盖，待安全审核同事复核")
        print(f"  └─────────────────────────────────")
    
    print("\n" + "=" * 70)
    print("🧾 报告内嵌历史快照 (history_snapshot):")
    for i, a in enumerate(report.get('history_snapshot', []), 1):
        print(f"  {i}. {a['action']}")
    print("=" * 70)


def list_reports():
    reports = list(REPORTS_DIR.glob("*.json"))
    if not reports:
        print("暂无报告")
        return
    print("可用报告:")
    for r in sorted(reports):
        print(f"  - {r.name}")


def list_history():
    histories = list(HISTORY_DIR.glob("*.json"))
    if not histories:
        print("暂无历史记录")
        return
    print("可用历史记录:")
    for h in sorted(histories):
        print(f"  - {h.name}")


def view_history(history_name: str):
    history_path = HISTORY_DIR / history_name
    if not history_path.exists():
        print(f"历史记录不存在: {history_name}")
        return
    
    with open(history_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print("=" * 70)
    print(f"操作历史: {data['scenario']}")
    print("=" * 70)
    print(f"保存时间: {data['saved_at']}")
    print()
    print("操作步骤:")
    for i, action in enumerate(data['actions'], 1):
        print(f"\n  {i}. [{action['timestamp']}] {action['action']}")
        details = action['details']
        for k, v in details.items():
            if isinstance(v, (dict, list)):
                print(f"     {k}: <复杂数据>")
            else:
                print(f"     {k}: {v}")
    print("\n" + "=" * 70)


def run_alignment_check(report_file: str, history_file: str):
    print("=" * 70)
    print("🔍 报告-历史对齐检查")
    print("=" * 70)
    print(f"报告文件:  {report_file}")
    print(f"历史文件:  {history_file}")
    print()
    
    result = ReviewEngine.check_alignment(report_file, history_file)
    
    if result.get("error"):
        print(f"❌ 错误: {result['error']}")
        return
    
    print("📝 检查项:")
    all_pass = True
    for check in result.get("checks", []):
        status = "✅ 通过" if check["pass"] else "❌ 失败"
        all_pass = all_pass and check["pass"]
        print(f"  {status}  {check['name']}")
        print(f"         ↳ {check['detail']}")
    
    print()
    d = result.get("details", {})
    print("📊 明细:")
    print(f"  报告ID:                   {d.get('report_id')}")
    print(f"  历史场景:                 {d.get('history_scenario')}")
    print(f"  历史操作步骤数:           {d.get('action_count_history')}")
    print(f"  报告内嵌快照步骤数:       {d.get('action_count_report')}")
    print(f"  历史操作序列:             {d.get('history_actions')}")
    print(f"  报告内嵌快照序列:         {d.get('report_actions_in_snapshot')}")
    
    print()
    if all_pass:
        print("🎉 对齐结论: ✅ 报告与历史能对上！关键检查项全部通过")
    else:
        print("⚠️  对齐结论: ❌ 报告与历史对不上，存在差异需要复核")
    print("=" * 70)


def main():
    if len(sys.argv) < 2:
        print("用法:")
        print("  python3 view_report.py list                                # 列出所有报告")
        print("  python3 view_report.py report <文件名>                      # 查看评测报告")
        print("  python3 view_report.py history list                        # 列出所有历史记录")
        print("  python3 view_report.py history <文件名>                     # 查看操作历史")
        print("  python3 view_report.py align <报告文件> <历史文件>           # ✅ 核心检查：报告-历史是否对齐")
        return
    
    cmd = sys.argv[1]
    if cmd == "list":
        list_reports()
    elif cmd == "report":
        if len(sys.argv) < 3:
            list_reports()
        else:
            view_report(sys.argv[2])
    elif cmd == "history":
        if len(sys.argv) < 3:
            list_history()
        elif sys.argv[2] == "list":
            list_history()
        else:
            view_history(sys.argv[2])
    elif cmd == "align":
        if len(sys.argv) < 4:
            print("需要两个参数: 报告文件 历史文件")
            print("例: python3 view_report.py align report_case_002_overwritten.json history_case_002_overwritten_xxx.json")
        else:
            run_alignment_check(sys.argv[2], sys.argv[3])
    else:
        print(f"未知命令: {cmd}")


if __name__ == "__main__":
    main()
