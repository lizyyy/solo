#!/usr/bin/env python3
import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
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
    print(f"  总记录数:       {s['total_records']}")
    print(f"  有人工判罚:     {s['records_with_manual_judgment']}")
    print(f"  确认一致:       {s['confirmed_count']}")
    print(f"  人工修正:       {s['modified_count']}")
    print(f"  绝对分差总计:   {s['total_abs_score_diff']}")
    print(f"  有批跑覆盖:     {'是' if s['has_overwrites'] else '否'}")
    print(f"  有补录数据:     {'是' if s['has_supplements'] else '否'}")
    print(f"  需安全审核:     {'是' if s['needs_safety_review'] else '否'}")
    print()
    
    print("📋 明细记录:")
    for rec in report['records']:
        print(f"\n  [{rec['record_id']}] {rec['question_id']}")
        print(f"    模型判罚: {rec['model_judgment']} ({rec['model_score']}分)")
        if rec.get('has_manual_judgment'):
            print(f"    人工判罚: {rec['manual_judgment']} ({rec['manual_score']}分)")
            print(f"    是否同意模型: {'是' if rec['agree_with_model'] else '否'}")
            print(f"    状态: {rec['judgment_status']}")
            if rec.get('score_diff', 0) != 0:
                print(f"    分差: {rec['score_diff']:+d}")
            if rec.get('is_supplement'):
                print(f"    ⚡ 补录数据")
            if rec.get('manual_comment'):
                print(f"    备注: {rec['manual_comment']}")
        else:
            print(f"    ⚠  暂无人工判罚")
    
    print("\n" + "=" * 70)


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


def main():
    if len(sys.argv) < 2:
        print("用法:")
        print("  python view_report.py list                    # 列出所有报告")
        print("  python view_report.py report <文件名>          # 查看评测报告")
        print("  python view_report.py history list            # 列出所有历史记录")
        print("  python view_report.py history <文件名>         # 查看操作历史")
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
    else:
        print(f"未知命令: {cmd}")


if __name__ == "__main__":
    main()
