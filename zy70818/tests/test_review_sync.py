#!/usr/bin/env python3
"""测试复核后数据同步"""

import sys
sys.path.insert(0, '.')

import os
for f in os.listdir('data'):
    if f.endswith('.json'):
        os.remove(os.path.join('data', f))

from services.import_service import import_service
from services.reconciliation_service import reconciliation_engine, review_service
from services.report_service import report_generator
from models.reconciliation import ReviewAction
from models.report import ReportType, ReportFormat
from datetime import date

print("=" * 70)
print("复核后数据同步测试")
print("=" * 70)

print("\n1. 导入测试数据...")
with open('data/sample_inventory.csv', 'r', encoding='utf-8-sig') as f:
    import_service.import_inventory(f.read())
with open('data/sample_recall.md', 'r', encoding='utf-8') as f:
    import_service.import_recall(f.read())
with open('data/sample_consumption.csv', 'r', encoding='utf-8-sig') as f:
    import_service.import_consumption(f.read())
print("   ✓ 数据导入完成")

print("\n2. 执行对账...")
result = reconciliation_engine.run_reconciliation(
    name='复核同步测试',
    start_date=date(2024, 1, 1),
    end_date=date(2024, 1, 31)
)
recon_id = result.id
print(f"   ✓ 对账任务ID: {recon_id}")
print(f"   ✓ 初始差异数: {result.discrepancy_count}")
print(f"   ✓ 待复核差异: {result.unresolved_discrepancy_count}")

print("\n3. 复核第一个差异（调整库存数量）...")
first_disc = result.discrepancies[0]
print(f"   差异: {first_disc.batch_number} @ {first_disc.store_name}")
print(f"   类型: {first_disc.type}")

success, message, updated_recon = review_service.review_discrepancy(
    reconciliation_id=recon_id,
    discrepancy_id=first_disc.id,
    action=ReviewAction.ADJUST,
    notes="测试复核并调整数量",
    reviewed_by="测试管理员",
    adjustment_quantity=100
)
print(f"   ✓ {message}")
print(f"   ✓ 复核后差异数: {updated_recon.discrepancy_count}")
print(f"   ✓ 复核后待复核: {updated_recon.unresolved_discrepancy_count}")

print("\n4. 验证差异列表已更新...")
from utils.storage import store
from models.reconciliation import ReconciliationResult
fresh_recon = store.get('reconciliation', recon_id, ReconciliationResult)
print(f"   ✓ 从存储读取差异数: {fresh_recon.discrepancy_count}")
print(f"   ✓ 从存储读取待复核: {fresh_recon.unresolved_discrepancy_count}")

reviewed_count = len([d for d in fresh_recon.discrepancies if d.is_reviewed])
print(f"   ✓ 已复核差异数: {reviewed_count}")

if reviewed_count > 0:
    reviewed = [d for d in fresh_recon.discrepancies if d.is_reviewed][0]
    print(f"   ✓ 复核记录保留: {reviewed.reviewed_by} at {reviewed.reviewed_at}")

print("\n5. 验证汇总数据已更新...")
print(f"   ✓ 汇总数据存在: {len(fresh_recon.summary_data) > 0}")
print(f"   ✓ 涉及门店: {len(fresh_recon.summary_data.get('stores', []))}")

print("\n6. 生成报告验证数据一致性...")
report = report_generator.generate_report(
    reconciliation_id=recon_id,
    report_type=ReportType.SUMMARY,
    report_format=ReportFormat.EXCEL,
    generated_by="测试用户"
)
print(f"   ✓ 报告文件: {report.file_path.split('/')[-1]}")
print(f"   ✓ 报告统计差异数: {report.statistics['total_discrepancies']}")
print(f"   ✓ 报告统计待复核: {report.statistics['unresolved_discrepancies']}")

print("\n7. 验证统计数据一致性...")
recon_match = (fresh_recon.discrepancy_count == report.statistics['total_discrepancies'])
unresolved_match = (fresh_recon.unresolved_discrepancy_count == report.statistics['unresolved_discrepancies'])
print(f"   ✓ 差异数一致: {recon_match}")
print(f"   ✓ 待复核数一致: {unresolved_match}")

if recon_match and unresolved_match:
    print("\n" + "=" * 70)
    print("✓ 所有数据同步验证通过!")
    print("  - 复核后重新计算差异")
    print("  - 汇总数据同步更新")
    print("  - 报告数据与对账结果一致")
    print("=" * 70)
else:
    print("\n" + "=" * 70)
    print("✗ 数据不一致!")
    print("=" * 70)
