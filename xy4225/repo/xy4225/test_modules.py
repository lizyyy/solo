#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试核心模块功能
"""

import sys
from pathlib import Path

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from modules.file_scanner import FileScanner
from modules.srt_parser import SRTParser
from modules.rules_checker import RulesChecker, CheckIssue
from modules.review_store import ReviewStore
from modules.exporter import Exporter


def test_file_scanner():
    print("\n=== 测试文件扫描模块 ===")
    sample_dir = project_root / "sample_project"
    
    scanner = FileScanner(str(sample_dir))
    result = scanner.scan()
    
    print(f"媒体配对数: {len(result.media_pairs)}")
    print(f"术语表路径: {result.glossary_path}")
    print(f"扫描错误数: {len(result.errors)}")
    
    for pair in result.media_pairs:
        status = "匹配" if (pair.video_path and pair.srt_path) else "不匹配"
        print(f"  - {pair.name_base}: 视频={'有' if pair.video_path else '无'}, 字幕={'有' if pair.srt_path else '无'} [{status}]")
    
    return result


def test_srt_parser():
    print("\n=== 测试SRT解析模块 ===")
    sample_srt = project_root / "sample_project" / "episode_001.srt"
    
    parser = SRTParser()
    result = parser.parse(sample_srt)
    
    print(f"解析条目数: {len(result.entries)}")
    print(f"解析错误数: {len(result.errors)}")
    
    for i, entry in enumerate(result.entries[:3], 1):
        print(f"  条目{i}: 索引={entry.index}, "
              f"时间={entry.start_time:.3f}s --> {entry.end_time:.3f}s, "
              f"文本={entry.text[:30]}...")
    
    return result


def test_rules_checker():
    print("\n=== 测试规则校验模块 ===")
    sample_dir = project_root / "sample_project"
    sample_srt = sample_dir / "episode_001.srt"
    glossary_path = sample_dir / "术语表.txt"
    
    parser = SRTParser()
    parse_result = parser.parse(sample_srt)
    
    checker = RulesChecker()
    
    if glossary_path.exists():
        load_result = checker.load_glossary(glossary_path)
        print(f"术语表加载: {load_result['loaded']}, 违禁词数量: {load_result['forbidden_count']}")
    
    issues = checker.check_all(parse_result.entries, sample_srt, video_duration=0.0)
    
    print(f"发现问题数: {len(issues)}")
    
    issue_types = {}
    for issue in issues:
        issue_types[issue.rule_type] = issue_types.get(issue.rule_type, 0) + 1
    
    for rule_type, count in issue_types.items():
        print(f"  - {rule_type}: {count} 个")
    
    if issues:
        print("\n问题示例:")
        for issue in issues[:3]:
            print(f"  [{issue.severity}] {issue.rule_type}: {issue.message[:50]}")
    
    return issues


def test_review_store():
    print("\n=== 测试复核存储模块 ===")
    sample_dir = project_root / "sample_project"
    
    store = ReviewStore(sample_dir)
    
    test_issue_id = "test_issue_001"
    store.update_issue(test_issue_id, "fixed", "测试备注")
    store.save()
    
    status = store.get_issue_status(test_issue_id)
    print(f"保存状态: {status}")
    
    stats = store.get_statistics()
    print(f"统计信息: {stats}")
    
    test_issues = [
        CheckIssue(
            issue_id="test_apply_001",
            rule_type="测试",
            severity="warning",
            file="test.srt",
            subtitle_index=1,
            timecode="00:00:01,000 --> 00:00:02,000",
            message="测试问题",
            context="测试文本"
        )
    ]
    store.update_issue("test_apply_001", "ignored", "忽略测试")
    store.apply_to_issues(test_issues)
    print(f"应用后状态: {test_issues[0].review_status}")
    
    return store


def test_exporter():
    print("\n=== 测试导出模块 ===")
    sample_dir = project_root / "sample_project"
    
    test_issues = [
        CheckIssue(
            issue_id="export_test_001",
            rule_type="字幕重叠",
            severity="error",
            file="test.srt",
            subtitle_index=1,
            timecode="00:00:01,000 --> 00:00:03,000",
            message="字幕 1 和 2 重叠",
            context="重叠的字幕内容",
            review_status="fixed",
            review_note="已修复时间轴"
        ),
        CheckIssue(
            issue_id="export_test_002",
            rule_type="违禁词",
            severity="error",
            file="test.srt",
            subtitle_index=2,
            timecode="00:00:03,000 --> 00:00:05,000",
            message="包含违禁词: 大概",
            context="大概是这样的",
            review_status="rework",
            review_note="需要修改用词"
        )
    ]
    
    exporter = Exporter(sample_dir, test_issues)
    
    md_path = sample_dir / "test_report.md"
    if exporter.export_markdown(md_path):
        print(f"Markdown报告导出成功: {md_path}")
    else:
        print("Markdown导出失败")
    
    csv_path = sample_dir / "test_report.csv"
    if exporter.export_csv(csv_path):
        print(f"CSV清单导出成功: {csv_path}")
    else:
        print("CSV导出失败")
    
    return exporter


def full_integration_test():
    print("\n" + "=" * 60)
    print("完整集成测试 - 使用示例目录")
    print("=" * 60)
    
    sample_dir = project_root / "sample_project"
    
    print("\n[步骤1] 扫描文件...")
    scanner = FileScanner(str(sample_dir))
    scan_result = scanner.scan()
    print(f"  媒体配对: {len(scan_result.media_pairs)} 个")
    print(f"  术语表: {scan_result.glossary_path}")
    print(f"  命名问题: {len(scan_result.errors)} 个")
    
    print("\n[步骤2] 加载术语表...")
    checker = RulesChecker()
    if scan_result.glossary_path:
        load_result = checker.load_glossary(scan_result.glossary_path)
        print(f"  违禁词数量: {load_result['forbidden_count']}")
    
    print("\n[步骤3] 解析字幕并质检...")
    all_issues = []
    parser = SRTParser()
    
    for pair in scan_result.media_pairs:
        if pair.srt_path:
            print(f"  处理: {pair.name_base}")
            parse_result = parser.parse(pair.srt_path)
            issues = checker.check_all(parse_result.entries, pair.srt_path)
            all_issues.extend(issues)
    
    for err in scan_result.errors:
        all_issues.append(CheckIssue(
            issue_id=f"naming_{err.get('file', '')}",
            rule_type="命名问题",
            severity="error",
            file=err.get('file', ''),
            subtitle_index=0,
            timecode="",
            message=err.get('message', ''),
            context=""
        ))
    
    print(f"\n[步骤4] 总共发现 {len(all_issues)} 个问题")
    
    print("\n[步骤5] 初始化复核存储...")
    store = ReviewStore(sample_dir)
    store.apply_to_issues(all_issues)
    
    for issue in all_issues[:2]:
        store.update_issue(issue.issue_id, "fixed", f"测试修复 - {issue.rule_type}")
    store.save()
    print("  已保存测试复核状态")
    
    print("\n[步骤6] 导出报告...")
    exporter = Exporter(sample_dir, all_issues, store)
    
    md_path = sample_dir / "质检报告_示例项目.md"
    if exporter.export_markdown(md_path):
        print(f"  Markdown报告: {md_path}")
    
    csv_path = sample_dir / "问题清单_示例项目.csv"
    if exporter.export_csv(csv_path):
        print(f"  CSV清单: {csv_path}")
    
    print("\n" + "=" * 60)
    print("集成测试完成!")
    print("=" * 60)
    
    return all_issues


if __name__ == "__main__":
    print("=" * 60)
    print("字幕交付质检台 - 模块测试")
    print("=" * 60)
    
    try:
        test_file_scanner()
        test_srt_parser()
        test_rules_checker()
        test_review_store()
        test_exporter()
        full_integration_test()
        
        print("\n✅ 所有测试通过!")
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
