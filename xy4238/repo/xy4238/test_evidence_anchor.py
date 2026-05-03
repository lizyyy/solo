#!/usr/bin/env python3
"""
测试脚本 - 验证庭审笔录证据锚点核对员功能
"""

import os
import sys
import tempfile
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from evidence_anchor_checker.parsers.csv_parser import TimestampCSVParser
from evidence_anchor_checker.parsers.markdown_parser import TranscriptMarkdownParser
from evidence_anchor_checker.parsers.json_parser import EvidenceJSONParser
from evidence_anchor_checker.indexer.local_index import LocalIndex
from evidence_anchor_checker.reporter.check_engine import CheckEngine
from evidence_anchor_checker.rules.validation_rules import ValidationRules, ErrorType


def test_validation_rules():
    """测试校验规则"""
    print("\n=== 测试校验规则 ===")

    print("\n1. 测试证据编号校验:")
    test_cases = [
        ("证1", True, "标准格式"),
        ("证1-1", True, "子证据格式"),
        ("1", True, "省略证字"),
        ("1-1", True, "省略证字的子证据"),
        ("证-1", False, "无效格式（负号）"),
        ("证A", False, "无效格式（字母）"),
        ("", False, "空值"),
    ]

    for num, expected_valid, desc in test_cases:
        valid, _ = ValidationRules.validate_evidence_number(num)
        status = "✓" if valid == expected_valid else "✗"
        print(f"  {status} '{num}' - {desc} (预期: {'有效' if expected_valid else '无效'})")

    print("\n2. 测试页码校验:")
    page_cases = [
        ("1", True, "单页"),
        ("1-5", True, "页码范围"),
        ("0", False, "0页（无效）"),
        ("-1", False, "负页码（无效）"),
        ("5-1", False, "结束<起始（无效）"),
        ("", False, "空值"),
    ]

    for page, expected_valid, desc in page_cases:
        valid, _ = ValidationRules.validate_page_number(page)
        status = "✓" if valid == expected_valid else "✗"
        print(f"  {status} '{page}' - {desc} (预期: {'有效' if expected_valid else '无效'})")

    print("\n3. 测试时间码校验:")
    ts_cases = [
        ("00:05:30", True, "标准格式"),
        ("23:59:59", True, "最大有效时间"),
        ("01:30:00", True, "正常格式"),
        ("25:00:00", False, "小时超出"),
        ("00:61:00", False, "分钟超出"),
        ("00:00:61", False, "秒超出"),
        ("1:30", False, "格式错误"),
        ("", False, "空值"),
    ]

    for ts, expected_valid, desc in ts_cases:
        valid, _ = ValidationRules.validate_timestamp(ts)
        status = "✓" if valid == expected_valid else "✗"
        print(f"  {status} '{ts}' - {desc} (预期: {'有效' if expected_valid else '无效'})")

    print("\n4. 测试证据编号匹配:")
    match_cases = [
        ("证1", "1", True),
        ("证1-1", "1-1", True),
        ("证2", "证2", True),
        ("证1", "证2", False),
    ]

    for n1, n2, expected in match_cases:
        result = ValidationRules.evidence_numbers_match(n1, n2)
        status = "✓" if result == expected else "✗"
        print(f"  {status} '{n1}' == '{n2}' -> {result} (预期: {expected})")

    print("\n✓ 校验规则测试完成")


def test_parsers():
    """测试解析器"""
    print("\n=== 测试解析器 ===")

    examples_dir = Path(__file__).parent / "examples" / "normal"

    print("\n1. 测试CSV解析器:")
    csv_path = examples_dir / "timestamp.csv"
    if csv_path.exists():
        entries, errors = TimestampCSVParser.parse(str(csv_path))
        print(f"  ✓ 解析到 {len(entries)} 条时间码记录")
        if errors:
            print(f"  ⚠ 发现 {len(errors)} 个警告")
        for i, entry in enumerate(entries[:3]):
            print(f"    - {entry.timestamp} - {entry.speaker}: {entry.description[:20]}...")
    else:
        print(f"  ⚠ 文件不存在: {csv_path}")

    print("\n2. 测试JSON解析器:")
    json_path = examples_dir / "evidence.json"
    if json_path.exists():
        evidence, errors = EvidenceJSONParser.parse(str(json_path))
        print(f"  ✓ 解析到 {len(evidence)} 项证据")
        if errors:
            print(f"  ⚠ 发现 {len(errors)} 个警告")
        for i, item in enumerate(evidence[:3]):
            print(f"    - {item.evidence_number}: {item.evidence_name} ({item.page_count}页)")
    else:
        print(f"  ⚠ 文件不存在: {json_path}")

    print("\n3. 测试Markdown解析器:")
    md_path = examples_dir / "transcript.md"
    if md_path.exists():
        segments, errors = TranscriptMarkdownParser.parse(str(md_path))
        print(f"  ✓ 解析到 {len(segments)} 个笔录段落")

        all_anchors = []
        for segment in segments:
            all_anchors.extend(segment.anchors)

        print(f"  ✓ 检测到 {len(all_anchors)} 个证据锚点")
        for anchor in all_anchors:
            pages = ",".join(anchor.page_numbers) if anchor.page_numbers else "无"
            print(f"    - 证{anchor.evidence_number}, 页码:{pages}, 发言人:{anchor.speaker}")
    else:
        print(f"  ⚠ 文件不存在: {md_path}")

    print("\n✓ 解析器测试完成")


def test_index_and_check():
    """测试索引和检查引擎"""
    print("\n=== 测试索引和检查引擎 ===")

    temp_dir = tempfile.mkdtemp()
    test_dir = Path(temp_dir)

    try:
        examples_dir = Path(__file__).parent / "examples" / "normal"
        abnormal_md = Path(__file__).parent / "examples" / "abnormal" / "transcript_error.md"

        print("\n1. 测试正常样例:")

        index = LocalIndex(str(test_dir / "normal_test"))

        csv_path = examples_dir / "timestamp.csv"
        md_path = examples_dir / "transcript.md"
        json_path = examples_dir / "evidence.json"

        if csv_path.exists():
            timestamp_entries, _ = TimestampCSVParser.parse(str(csv_path))
            index.timestamp_entries = timestamp_entries

        if md_path.exists():
            transcript_segments, _ = TranscriptMarkdownParser.parse(str(md_path))
            index.transcript_segments = transcript_segments

        if json_path.exists():
            evidence_catalog, _ = EvidenceJSONParser.parse(str(json_path))
            index.evidence_catalog = evidence_catalog

        index.initialize()
        index.save()
        print(f"  ✓ 索引已建立并保存")

        index.load()
        print(f"  ✓ 索引已加载")

        engine = CheckEngine(index)
        errors, result = engine.run_all_checks()

        print(f"  ✓ 检查完成")
        print(f"    - 总错误数: {result.total_errors}")
        print(f"    - 错误类型: {list(result.error_summary.keys())}")

        print("\n2. 测试异常样例:")

        index2 = LocalIndex(str(test_dir / "abnormal_test"))

        if csv_path.exists():
            timestamp_entries, _ = TimestampCSVParser.parse(str(csv_path))
            index2.timestamp_entries = timestamp_entries

        if abnormal_md.exists():
            transcript_segments, _ = TranscriptMarkdownParser.parse(str(abnormal_md))
            index2.transcript_segments = transcript_segments

        if json_path.exists():
            evidence_catalog, _ = EvidenceJSONParser.parse(str(json_path))
            index2.evidence_catalog = evidence_catalog

        index2.initialize()
        index2.save()

        engine2 = CheckEngine(index2)
        errors2, result2 = engine2.run_all_checks()

        print(f"  ✓ 检查完成")
        print(f"    - 总错误数: {result2.total_errors}")
        print(f"    - 错误类型统计:")
        for error_type, count in result2.error_summary.items():
            print(f"      * {error_type}: {count} 处")

        if errors2:
            print(f"\n    前3个错误详情:")
            for i, err in enumerate(errors2[:3]):
                print(f"      {i+1}. [{err.error_type.value}] {err.message}")
                print(f"         位置: {err.location}")

        print("\n✓ 索引和检查引擎测试完成")

    finally:
        shutil.rmtree(temp_dir)


def test_full_workflow():
    """测试完整工作流程"""
    print("\n=== 测试完整工作流程 ===")

    temp_dir = tempfile.mkdtemp()
    work_dir = Path(temp_dir)

    try:
        print("\n1. 准备测试数据...")

        from evidence_anchor_checker.rules.validation_rules import (
            TimestampEntry,
            TranscriptSegment,
            EvidenceCatalogEntry,
            EvidenceAnchor
        )

        test_timestamp_csv = """时间码,发言人,事件类型,描述,持续时间(秒)
00:05:30,审判长,开庭,宣布开庭,30
00:06:00,原告代理人,举证,提交证据,120
00:08:00,被告代理人,质证,发表意见,90
"""

        test_transcript_md = """[00:05:30]
【审判长】现在宣布开庭。

[00:06:00]
【原告代理人】现在开始举证。我方提交证1 第1页，证2 第2-3页。证1 第2页（重复锚定）。证99 第1页（不存在）。

[00:08:00]
【被告代理人】质证意见。证3 第100页（超出范围）。证4（缺少页码）。
"""

        test_evidence_json = """{
  "证据目录": [
    {"证据编号": "证1", "证据名称": "合同书", "页数": 5, "提交方": "原告", "证据类型": "书证"},
    {"证据编号": "证2", "证据名称": "付款凭证", "页数": 4, "提交方": "原告", "证据类型": "书证"},
    {"证据编号": "证3", "证据名称": "确认书", "页数": 8, "提交方": "原告", "证据类型": "书证"},
    {"证据编号": "证4", "证据名称": "补充协议", "页数": 12, "提交方": "原告", "证据类型": "书证"}
  ]
}
"""

        csv_file = work_dir / "timestamp.csv"
        md_file = work_dir / "transcript.md"
        json_file = work_dir / "evidence.json"

        with open(csv_file, 'w', encoding='utf-8-sig', newline='') as f:
            f.write(test_timestamp_csv)

        with open(md_file, 'w', encoding='utf-8') as f:
            f.write(test_transcript_md)

        with open(json_file, 'w', encoding='utf-8') as f:
            f.write(test_evidence_json)

        print(f"  ✓ 测试文件已创建")

        print("\n2. 解析并建立索引...")

        index = LocalIndex(str(work_dir))

        timestamp_entries, _ = TimestampCSVParser.parse(str(csv_file))
        transcript_segments, _ = TranscriptMarkdownParser.parse(str(md_file))
        evidence_catalog, _ = EvidenceJSONParser.parse(str(json_file))

        index.timestamp_entries = timestamp_entries
        index.transcript_segments = transcript_segments
        index.evidence_catalog = evidence_catalog
        index.initialize()
        index.save()

        print(f"  ✓ 索引已建立:")
        print(f"    - 时间码: {len(timestamp_entries)} 条")
        print(f"    - 笔录段落: {len(transcript_segments)} 个")
        print(f"    - 证据目录: {len(evidence_catalog)} 项")

        all_anchors = index.get_all_anchors()
        print(f"    - 检测锚点: {len(all_anchors)} 个")

        print("\n3. 执行核对检查...")

        engine = CheckEngine(index)
        errors, result = engine.run_all_checks()

        print(f"  ✓ 检查完成，发现 {result.total_errors} 个错误")

        expected_error_types = {
            ErrorType.DUPLICATE_ANCHOR.value: "重复锚定",
            ErrorType.EVIDENCE_NUMBER_NOT_EXIST.value: "证据不存在",
            ErrorType.PAGE_MISSING.value: "页码缺失",
            ErrorType.PAGE_INVALID.value: "页码无效/超出",
        }

        print(f"\n  错误类型汇总:")
        for err_type, count in result.error_summary.items():
            desc = expected_error_types.get(err_type, err_type)
            print(f"    - {desc}: {count} 处")

        print("\n4. 导出报告...")

        from evidence_anchor_checker.reporter.report_generator import (
            MarkdownReportGenerator,
            CSVRevisionGenerator
        )

        report_dir = work_dir / "reports"

        md_gen = MarkdownReportGenerator(index)
        md_report = report_dir / "error_report.md"
        md_gen.save_report(errors, result, md_report)

        csv_gen = CSVRevisionGenerator(index)
        csv_revision = report_dir / "revision_list.csv"
        csv_summary = report_dir / "anchor_summary.csv"
        csv_gen.save_revision_list(errors, csv_revision)
        csv_gen.save_anchor_summary(csv_summary)

        print(f"  ✓ 报告已导出:")
        print(f"    - Markdown报告: {md_report.exists()}")
        print(f"    - 修订清单CSV: {csv_revision.exists()}")
        print(f"    - 锚点汇总CSV: {csv_summary.exists()}")

        if md_report.exists():
            with open(md_report, 'r', encoding='utf-8') as f:
                content = f.read()
                print(f"\n  Markdown报告预览 (前300字符):")
                print(f"    {content[:300]}...")

        print("\n✓ 完整工作流程测试完成")

    finally:
        shutil.rmtree(temp_dir)


def main():
    """主测试函数"""
    print("=" * 60)
    print("  庭审笔录证据锚点核对员 - 功能测试")
    print("=" * 60)

    test_validation_rules()
    test_parsers()
    test_index_and_check()
    test_full_workflow()

    print("\n" + "=" * 60)
    print("  ✓ 所有测试完成！")
    print("=" * 60)


if __name__ == '__main__':
    main()
