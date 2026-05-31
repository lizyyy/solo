#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from script_ledger.ledger import Ledger, ScriptRecord
from script_ledger.classifier import Classifier, Classification
from script_ledger.detector import Detector, Issue

def test_list():
    print("=" * 60)
    print("测试1: 列出所有记录")
    print("=" * 60)
    ledger = Ledger("script_ledger.json")
    records = ledger.get_all_records()
    print(f"总计 {len(records)} 条记录\n")
    
    print(f"{'ID':<18} {'时间':<20} {'状态':<8} {'命令'}")
    print("-" * 100)
    for r in records[:10]:
        from datetime import datetime
        time_str = datetime.fromtimestamp(r.start_time).strftime('%Y-%m-%d %H:%M:%S')
        status = "✓" if r.exit_code == 0 else ("✗" if r.exit_code is not None else "?")
        rerun = " [重跑]" if r.is_rerun else ""
        cmd = r.command[:50] + "..." if len(r.command) > 50 else r.command
        print(f"{r.id:<18} {time_str:<20} {status:<8} {cmd}{rerun}")
    print()

def test_show():
    print("=" * 60)
    print("测试2: 查看单条记录详情")
    print("=" * 60)
    ledger = Ledger("script_ledger.json")
    records = ledger.get_all_records()
    if records:
        r = records[0]
        from datetime import datetime
        print(f"记录ID: {r.id}")
        print(f"时间: {datetime.fromtimestamp(r.start_time).strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"命令: {r.command}")
        print(f"目录: {r.cwd}")
        print(f"退出码: {r.exit_code}")
        if r.failure_reason:
            print(f"失败原因: {r.failure_reason}")
        if r.note:
            print(f"备注: {r.note}")
        if r.script_hash:
            print(f"脚本哈希: {r.script_hash[:16]}...")
        if r.output_files:
            print(f"输出文件: {r.output_files}")
    print()

def test_detect():
    print("=" * 60)
    print("测试3: 智能检测功能")
    print("=" * 60)
    ledger = Ledger("script_ledger.json")
    detector = Detector(ledger)
    issues = detector.detect_all()
    
    by_type = {}
    for issue in issues:
        if issue.issue_type not in by_type:
            by_type[issue.issue_type] = []
        by_type[issue.issue_type].append(issue)
    
    print(f"检测到 {len(issues)} 个问题:\n")
    for issue_type, type_issues in by_type.items():
        print(f"【{issue_type}】({len(type_issues)} 个)")
        for issue in type_issues[:2]:
            print(f"  - [{issue.severity.upper()}] {issue.message}")
            if issue.details:
                for k, v in issue.details.items():
                    if isinstance(v, list):
                        v = ", ".join(str(x) for x in v[:3])
                    print(f"    {k}: {v}")
        print()

def test_classify():
    print("=" * 60)
    print("测试4: 问题分类引擎")
    print("=" * 60)
    ledger = Ledger("script_ledger.json")
    classifier = Classifier(ledger)
    classifications, issues = classifier.classify_all()
    
    by_category = {}
    for c in classifications:
        if c.category not in by_category:
            by_category[c.category] = []
        by_category[c.category].append(c)
    
    ok_count = len(by_category.get(Classification.CATEGORY_OK, []))
    rerun_count = len(by_category.get(Classification.CATEGORY_RERUN, []))
    ask_dev_count = len(by_category.get(Classification.CATEGORY_ASK_DEV, []))
    
    print(f"分类结果:")
    print(f"  ✓ 不用动: {ok_count}")
    print(f"  ⚠ 要补跑: {rerun_count}")
    print(f"  ✗ 找研发确认: {ask_dev_count}")
    print()
    
    for category, label in [
        (Classification.CATEGORY_ASK_DEV, "【找研发确认】"),
        (Classification.CATEGORY_RERUN, "【要补跑】"),
        (Classification.CATEGORY_OK, "【不用动】")
    ]:
        items = by_category.get(category, [])
        if items:
            print(f"{label} ({len(items)} 条):")
            for c in items[:2]:
                record = ledger.find_by_id(c.record_id)
                if record:
                    cmd = record.command[:40] + "..." if len(record.command) > 40 else record.command
                    print(f"  - {c.record_id}: {cmd}")
                    print(f"    原因: {'; '.join(c.reasons)}")
            print()

def test_report():
    print("=" * 60)
    print("测试5: 生成报告")
    print("=" * 60)
    ledger = Ledger("script_ledger.json")
    classifier = Classifier(ledger)
    ledger_file, issues_file = classifier.generate_report("test_report")
    
    print(f"✓ 账本报告: {ledger_file}")
    print(f"✓ 问题清单: {issues_file}")
    print()
    
    with open(issues_file, 'r', encoding='utf-8') as f:
        content = f.read()
        # 只打印前1000个字符
        print(content[:1500])
        if len(content) > 1500:
            print("\n... (内容过长，已截断)")

def test_import():
    print("=" * 60)
    print("测试6: 导入账本（保留失败原因）")
    print("=" * 60)
    ledger = Ledger("script_ledger.json")
    
    original_failures = {}
    for r in ledger.get_all_records():
        if r.failure_reason:
            original_failures[r.id] = r.failure_reason
    
    print(f"导入前: {len(ledger.get_all_records())} 条记录")
    print(f"导入前有失败原因的记录: {len(original_failures)} 条")
    
    if os.path.exists("backup_ledger.json"):
        count = ledger.import_records("backup_ledger.json", preserve_existing_failures=True)
        print(f"已导入 {count} 条记录")
        print(f"导入后: {len(ledger.get_all_records())} 条记录")
        
        preserved = 0
        for r in ledger.get_all_records():
            if r.id in original_failures and r.failure_reason == original_failures[r.id]:
                preserved += 1
        print(f"失败原因保留数: {preserved}/{len(original_failures)}")
    else:
        print("backup_ledger.json 不存在，跳过")
    print()

def main():
    if not os.path.exists("script_ledger.json"):
        print("请先运行 generate_test_data.py 生成测试数据")
        sys.exit(1)
    
    test_list()
    test_show()
    test_detect()
    test_classify()
    test_report()
    test_import()
    
    print("=" * 60)
    print("所有测试完成!")
    print("=" * 60)

if __name__ == "__main__":
    main()
