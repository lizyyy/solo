#!/usr/bin/env python3
"""compare 命令：对比两次分析结果。"""

import sys
from pathlib import Path

from ..core.database import Database
from ..core.exporter import export_report
from ..core.models import ComparisonResult, Severity


def compare_command(args) -> int:
    """执行 compare 命令。"""
    db_path = Path(args.db)
    id1 = args.analysis_id_1
    id2 = args.analysis_id_2
    output_format = args.format

    if id1 == id2:
        print("❌ 错误: 两次分析的 ID 不能相同")
        return 1

    print(f"🔍 对比分析 #{id1} 和 #{id2}...")
    print()

    db = Database(db_path)

    analysis1 = db.get_analysis(id1)
    analysis2 = db.get_analysis(id2)

    if not analysis1:
        print(f"❌ 错误: 找不到分析 ID {id1}")
        print("\n可用的分析记录:")
        list_analyses(db)
        return 1

    if not analysis2:
        print(f"❌ 错误: 找不到分析 ID {id2}")
        print("\n可用的分析记录:")
        list_analyses(db)
        return 1

    name1 = analysis1.name or f"分析 #{id1}"
    name2 = analysis2.name or f"分析 #{id2}"

    print(f"📋 对比: {name1} → {name2}")
    print()

    comparison = db.compare_analyses(id1, id2)
    if not comparison:
        print("❌ 对比失败")
        return 1

    if output_format == "json":
        output = export_report(comparison, "json")
        print(output)
    elif output_format == "markdown":
        output = export_report(comparison, "markdown")
        print(output)
    else:
        print_comparison_summary(comparison)

    return 0


def list_analyses(db: Database):
    """列出可用的分析记录。"""
    analyses = db.list_analyses(limit=10)
    if not analyses:
        print("   (暂无分析记录)")
        return

    for a in analyses:
        name = a["name"] or "(未命名)"
        findings = a.get("finding_count", 0)
        print(f"   #{a['id']} - {name} ({findings} 个问题)")


def print_comparison_summary(result: ComparisonResult):
    """打印对比摘要到控制台。"""
    summary = result.summary

    print("📊 对比摘要")
    print("-" * 50)

    new_count = summary.get("new_findings_count", 0)
    resolved_count = summary.get("resolved_findings_count", 0)
    improved_count = summary.get("improved_count", 0)
    worsened_count = summary.get("worsened_count", 0)

    net_change = (resolved_count + improved_count) - (new_count + worsened_count)

    print(f"   🆕 新增问题: {new_count}")
    print(f"   ✅ 已解决问题: {resolved_count}")
    print(f"   📉 严重程度降低: {improved_count}")
    print(f"   📈 严重程度升高: {worsened_count}")
    print()

    if net_change > 0:
        print(f"✅ 总体改善: +{net_change}")
    elif net_change < 0:
        print(f"⚠️  总体恶化: {net_change}")
    else:
        print("ℹ️  总体无变化")

    print()

    if result.resolved_findings:
        print("✅ 已解决的问题:")
        print("-" * 50)
        for idx, finding in enumerate(result.resolved_findings, 1):
            emoji = get_severity_emoji(finding.severity)
            location = ""
            if finding.location:
                location = f" ({finding.location.file_path}"
                if finding.location.line_number:
                    location += f":{finding.location.line_number}"
                location += ")"
            print(f"   {idx}. {emoji} {finding.title}{location}")
        print()

    if result.new_findings:
        print("🆕 新增的问题:")
        print("-" * 50)
        for idx, finding in enumerate(result.new_findings, 1):
            emoji = get_severity_emoji(finding.severity)
            location = ""
            if finding.location:
                location = f" ({finding.location.file_path}"
                if finding.location.line_number:
                    location += f":{finding.location.line_number}"
                location += ")"
            print(f"   {idx}. {emoji} {finding.title}{location}")
        print()

    if result.improved_findings:
        print("📉 严重程度降低:")
        print("-" * 50)
        for idx, item in enumerate(result.improved_findings, 1):
            before = item["before"]
            after = item["after"]
            before_emoji = get_severity_emoji(before.severity)
            after_emoji = get_severity_emoji(after.severity)
            print(f"   {idx}. {before.title}")
            print(f"      {before_emoji} {before.severity.value.upper()} → {after_emoji} {after.severity.value.upper()}")
        print()

    if result.worsened_findings:
        print("📈 严重程度升高:")
        print("-" * 50)
        for idx, item in enumerate(result.worsened_findings, 1):
            before = item["before"]
            after = item["after"]
            before_emoji = get_severity_emoji(before.severity)
            after_emoji = get_severity_emoji(after.severity)
            print(f"   {idx}. {before.title}")
            print(f"      {before_emoji} {before.severity.value.upper()} → {after_emoji} {after.severity.value.upper()}")
        print()


def get_severity_emoji(severity: Severity) -> str:
    """获取严重程度对应的 emoji。"""
    mapping = {
        Severity.CRITICAL: "🔴",
        Severity.HIGH: "🟠",
        Severity.MEDIUM: "🟡",
        Severity.LOW: "🟢",
        Severity.INFO: "ℹ️",
    }
    return mapping.get(severity, "❓")
