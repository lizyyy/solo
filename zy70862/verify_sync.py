#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.services.reconciliation_service import ReconciliationService
from app.services.review_service import ReviewService
from app.models.models import ReconciliationDiff

print("=" * 60)
print("数据同步验证测试")
print("=" * 60)

db = SessionLocal()

result = ReconciliationService.run_auto_reconciliation(db)
print("\n1. 初始对账结果:")
print(f"   run_auto_reconciliation 返回 total_diffs = {result['total_diffs']}")
print(f"   summary.total_diffs = {result['summary']['total_diffs']}")
print(f"   summary.negative_inventory_count = {result['summary']['negative_inventory_count']}")
print(f"   summary.return_diff_count = {result['summary']['return_diff_count']}")

actual_count = db.query(ReconciliationDiff).count()
print(f"   数据库实际差异数 = {actual_count}")

assert result['total_diffs'] == actual_count, '返回的 total_diffs 与数据库实际数量不一致'
assert result['summary']['total_diffs'] == actual_count, '汇总中的 total_diffs 与数据库实际数量不一致'
print("   ✓ 初始对账数字全部同步")

diffs = ReconciliationService.get_diff_list(db)
if diffs:
    print(f"\n2. 复核差异 ID={diffs[0]['id']} 后:")
    ReviewService.review_diff(db, diffs[0]['id'], '测试人', 'approved', '测试复核')
    
    result2 = ReconciliationService.run_auto_reconciliation(db)
    actual_count2 = db.query(ReconciliationDiff).count()
    resolved_count = db.query(ReconciliationDiff).filter(ReconciliationDiff.is_approved == True).count()
    
    print(f"   数据库差异数 = {actual_count2}")
    print(f"   已批准差异数 = {resolved_count}")
    print(f"   summary.resolved_diffs = {result2['summary']['resolved_diffs']}")
    print(f"   summary.pending_diffs = {result2['summary']['pending_diffs']}")
    
    assert result2['summary']['resolved_diffs'] == resolved_count, '汇总中的已解决数与实际不一致'
    assert result2['summary']['pending_diffs'] == actual_count2 - resolved_count, '汇总中的待处理数计算错误'
    print("   ✓ 复核后数字仍同步")

db.close()

print("\n" + "=" * 60)
print("✓ 所有数据同步验证通过!")
print("=" * 60)
