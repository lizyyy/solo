#!/usr/bin/env python3
"""验证并运行完整的版权分账流程"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 70)
print("版权分账演出单 - 系统验证")
print("=" * 70)

try:
    from royalty_settlement.models import (
        PerformanceSheet, Track, AuthorShare, PlatformFee,
        FeePeriod, AuthorRole, IssueCategory, IssueSeverity,
        TrackSplit
    )
    from royalty_settlement.core import (
        SettlementEngine, TrackSplitter, RatioValidator,
        FeeCollector, RoyaltyCalculator, Auditor
    )
    from royalty_settlement.output import OutputFormatter, ConsolePrinter
    print("\n✓ 所有模块导入成功")
except Exception as e:
    print(f"\n✗ 导入失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

from datetime import date

print("\n" + "-" * 70)
print("步骤1: 创建测试演出单")
print("-" * 70)

sheet = PerformanceSheet(
    performance_name="测试演出 - 夏日音乐节",
    performance_date=date(2026, 5, 20),
    venue="测试场馆",
    total_box_office=100000.0,
    operator="测试员",
    notes="测试用演出单",
)

track1 = Track(
    name="正常曲目",
    duration_seconds=240,
    is_medley=False,
    authors=[
        AuthorShare(author_id="A1", author_name="作者甲", role=AuthorRole.COMPOSER, ratio=0.6),
        AuthorShare(author_id="A2", author_name="作者乙", role=AuthorRole.LYRICIST, ratio=0.4),
    ],
)

track2 = Track(
    name="串烧组曲",
    duration_seconds=300,
    is_medley=True,
    medley_tracks=[
        TrackSplit(track_name="子曲目1", duration_seconds=100),
        TrackSplit(track_name="子曲目2", duration_seconds=100),
        TrackSplit(track_name="子曲目3", duration_seconds=100),
    ],
    authors=[
        AuthorShare(author_id="A3", author_name="作者丙", role=AuthorRole.COMPOSER, ratio=0.5),
        AuthorShare(author_id="A4", author_name="作者丁", role=AuthorRole.LYRICIST, ratio=0.5),
    ],
    notes="这是一个串烧曲目，需要拆分",
)

track3 = Track(
    name="比例不满一曲目",
    duration_seconds=180,
    is_medley=False,
    authors=[
        AuthorShare(author_id="A5", author_name="作者戊", role=AuthorRole.COMPOSER, ratio=0.3),
        AuthorShare(author_id="A6", author_name="作者己", role=AuthorRole.LYRICIST, ratio=0.3),
    ],
    notes="比例总和只有0.6，缺少0.4",
)

sheet.tracks = [track1, track2, track3]

fee1 = PlatformFee(
    fee_type="平台服务费",
    amount=10000.0,
    period=FeePeriod.CURRENT,
)

fee2 = PlatformFee(
    fee_type="跨期宣传费",
    amount=15000.0,
    period=FeePeriod.CROSS,
    period_start=date(2026, 5, 15),
    period_end=date(2026, 6, 15),
)

fee3 = PlatformFee(
    fee_type="上期结转费用",
    amount=5000.0,
    period=FeePeriod.PREVIOUS,
)

sheet.platform_fees = [fee1, fee2, fee3]

print(f"✓ 演出单创建成功: {sheet.performance_name}")
print(f"  - 曲目数: {len(sheet.tracks)} (含1个串烧, 1个比例不满一)")
print(f"  - 扣费数: {len(sheet.platform_fees)} (含1个跨期, 1个上期结转)")

errors = sheet.validate()
if errors:
    print(f"\n! 验证发现 {len(errors)} 个问题:")
    for e in errors:
        print(f"  - {e}")
else:
    print("\n✓ 数据验证通过")

print("\n" + "-" * 70)
print("步骤2: 初始化引擎并处理")
print("-" * 70)

engine = SettlementEngine(
    history_dir="data/history",
    output_dir="data/output",
    errors_dir="data/errors",
)

try:
    result, issues, warnings = engine.process(sheet)
    print(f"\n✓ 结算处理完成")
    print(f"  - 总票房: ¥{result.total_box_office:,.2f}")
    print(f"  - 总扣费: ¥{result.total_fees:,.2f}")
    print(f"  - 可分配: ¥{result.net_distributable:,.2f}")
    print(f"  - 明细条数: {len(result.items)}")
    print(f"  - 问题数: {len(issues)}")
    print(f"  - 警告数: {len(warnings)}")
except Exception as e:
    print(f"\n✗ 处理失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "-" * 70)
print("步骤3: 问题分析")
print("-" * 70)

if issues:
    print(f"\n发现 {len(issues)} 个问题:")
    for i, issue in enumerate(issues, 1):
        severity_icon = {
            "critical": "★",
            "error": "✖",
            "warning": "⚠",
            "info": "ℹ",
        }.get(issue.severity.value, "•")
        print(f"\n{i}. [{severity_icon}] {issue.category.value.upper()} - {issue.message}")
        if issue.reason:
            print(f"   原因: {issue.reason}")
        if issue.affected_items:
            print(f"   影响: {', '.join(issue.affected_items)}")
        if issue.impact:
            print(f"   后果: {issue.impact}")
        if issue.next_steps:
            print(f"   下一步:")
            for step in issue.next_steps:
                print(f"     → {step}")

print("\n" + "-" * 70)
print("步骤4: 作者分账汇总")
print("-" * 70)

print(f"\n{'作者':<12} {'曲目数':<8} {'税前':>12} {'扣费':>12} {'税后':>12}")
print("-" * 60)
total = 0
for author, summary in sorted(result.author_summary.items()):
    print(f"{author:<12} {summary['track_count']:<8} ¥{summary['gross_amount']:>10,.2f}  ¥{summary['fee_deduction']:>10,.2f}  ¥{summary['net_amount']:>10,.2f}")
    total += summary["net_amount"]

print("-" * 60)
print(f"{'合计':<12} {'':<8} {'':>12} {'':>12} ¥{total:>10,.2f}")

print("\n" + "-" * 70)
print("步骤5: 生成输出文件")
print("-" * 70)

formatter = OutputFormatter(engine.output_dir)
output_paths = formatter.save_all(result)

print("\n生成的文件:")
for fmt, path in output_paths.items():
    label = {"summary": "人类可读摘要", "json": "结构化JSON", "csv": "CSV表格"}.get(fmt, fmt)
    print(f"  ✓ {label}: {path}")

print("\n" + "-" * 70)
print("步骤6: 检查历史和审计记录")
print("-" * 70)

history = engine.list_history()
print(f"\n✓ 历史记录数: {len(history)}")
if history:
    print("最近3条记录:")
    for h in history[:3]:
        type_label = "输入" if h["type"] == "input" else "输出"
        print(f"  - [{type_label}] {h['timestamp']} - {h['filename']}")

print("\n" + "=" * 70)
print("✓ 系统验证全部通过！")
print("=" * 70)

print("\n" + "使用说明:")
print("  1. 生成模板: python3 -m royalty_settlement template -o my_show.json")
print("  2. 编辑模板填入实际数据")
print("  3. 执行结算: python3 -m royalty_settlement settle my_show.json")
print("  4. 查看历史: python3 -m royalty_settlement history")

print("\n" + "数据目录结构:")
print("  data/")
print("  ├── input/          (可选，存放原始输入文件)")
print("  ├── output/         (结算输出：摘要、JSON、CSV)")
print("  ├── errors/         (验证失败的错误清单)")
print("  └── history/        (审计历史)")
print("      ├── inputs/     (输入存档)")
print("      ├── outputs/    (输出存档)")
print("      └── audit_logs/ (审计追踪)")

summary_path = output_paths.get("summary", "")
if summary_path and os.path.exists(summary_path):
    print(f"\n查看生成的摘要文件:")
    print(f"  cat {summary_path}")
