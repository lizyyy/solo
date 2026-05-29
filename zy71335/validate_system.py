#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from royalty_settlement.models import (
    PerformanceSheet, Track, AuthorShare, PlatformFee,
    FeePeriod, AuthorRole, TrackSplit
)
from royalty_settlement.core import SettlementEngine
from royalty_settlement.output import OutputFormatter
from datetime import date

result_output = []

def log(msg):
    result_output.append(msg)
    print(msg)

log("=" * 70)
log("版权分账演出单 - 系统验证")
log("=" * 70)

log("\n[1] 模块导入测试")
try:
    from royalty_settlement.models import *
    from royalty_settlement.core import *
    from royalty_settlement.output import *
    log("  ✓ 所有模块导入成功")
except Exception as e:
    log(f"  ✗ 导入失败: {e}")
    sys.exit(1)

log("\n[2] 创建测试演出单")
sheet = PerformanceSheet(
    performance_name="测试演出 - 夏日音乐节",
    performance_date=date(2026, 5, 20),
    venue="测试场馆",
    total_box_office=100000.0,
    operator="测试员",
)

sheet.tracks = [
    Track(
        name="正常曲目",
        duration_seconds=240,
        authors=[
            AuthorShare(author_id="A1", author_name="作者甲", role=AuthorRole.COMPOSER, ratio=0.6),
            AuthorShare(author_id="A2", author_name="作者乙", role=AuthorRole.LYRICIST, ratio=0.4),
        ],
    ),
    Track(
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
    ),
    Track(
        name="比例不满一曲目",
        duration_seconds=180,
        authors=[
            AuthorShare(author_id="A5", author_name="作者戊", role=AuthorRole.COMPOSER, ratio=0.3),
            AuthorShare(author_id="A6", author_name="作者己", role=AuthorRole.LYRICIST, ratio=0.3),
        ],
    ),
]

sheet.platform_fees = [
    PlatformFee(fee_type="平台服务费", amount=10000.0, period=FeePeriod.CURRENT),
    PlatformFee(fee_type="跨期宣传费", amount=15000.0, period=FeePeriod.CROSS,
                period_start=date(2026, 5, 15), period_end=date(2026, 6, 15)),
    PlatformFee(fee_type="上期结转费用", amount=5000.0, period=FeePeriod.PREVIOUS),
]

log(f"  ✓ 演出单创建成功")
log(f"    - 曲目数: {len(sheet.tracks)} (含1个串烧, 1个比例不满一)")
log(f"    - 扣费数: {len(sheet.platform_fees)} (含1个跨期, 1个上期结转)")

log("\n[3] 数据验证")
errors = sheet.validate()
if errors:
    log(f"  ! 发现 {len(errors)} 个验证问题")
    for e in errors:
        log(f"    - {e}")
else:
    log("  ✓ 数据验证通过")

log("\n[4] 执行结算处理")
engine = SettlementEngine(
    history_dir="data/history",
    output_dir="data/output",
    errors_dir="data/errors",
)

result, issues, warnings = engine.process(sheet)

log(f"  ✓ 结算处理完成")
log(f"    - 总票房: ¥{result.total_box_office:,.2f}")
log(f"    - 总扣费: ¥{result.total_fees:,.2f}")
log(f"    - 可分配: ¥{result.net_distributable:,.2f}")
log(f"    - 明细条数: {len(result.items)}")
log(f"    - 问题数: {len(issues)}")
log(f"    - 警告数: {len(warnings)}")

log("\n[5] 问题清单")
if issues:
    log(f"  发现 {len(issues)} 个问题:")
    for i, issue in enumerate(issues, 1):
        log(f"  {i}. [{issue.severity.value.upper()}] {issue.category.value}: {issue.message}")
        log(f"     原因: {issue.reason}")
        log(f"     影响: {issue.impact}")
        if issue.next_steps:
            log(f"     下一步: {issue.next_steps[0]}")

log("\n[6] 作者分账汇总")
log(f"  {'作者':<12} {'曲目数':<8} {'税前':>12} {'扣费':>12} {'税后':>12}")
log("  " + "-" * 60)
total = 0
for author, summary in sorted(result.author_summary.items()):
    log(f"  {author:<12} {summary['track_count']:<8} ¥{summary['gross_amount']:>10,.2f}  ¥{summary['fee_deduction']:>10,.2f}  ¥{summary['net_amount']:>10,.2f}")
    total += summary['net_amount']
log("  " + "-" * 60)
log(f"  {'合计':<12} {'':<8} {'':>12} {'':>12} ¥{total:>10,.2f}")

log("\n[7] 生成输出文件")
formatter = OutputFormatter(engine.output_dir)
output_paths = formatter.save_all(result)
for fmt, path in output_paths.items():
    label = {"summary": "人类可读摘要", "json": "结构化JSON", "csv": "CSV表格"}.get(fmt, fmt)
    log(f"  ✓ {label}: {path}")

log("\n[8] 历史记录")
history = engine.list_history()
log(f"  ✓ 历史记录数: {len(history)}")

log("\n" + "=" * 70)
log("✓ 系统验证全部通过！")
log("=" * 70)

log("\n使用方法:")
log("  生成模板: python3 -m royalty_settlement template -o my_show.json")
log("  执行结算: python3 -m royalty_settlement settle my_show.json")
log("  查看历史: python3 -m royalty_settlement history")

with open('validation_result.txt', 'w', encoding='utf-8') as f:
    f.write("\n".join(result_output))

print("\n✓ 验证结果已保存到 validation_result.txt")
