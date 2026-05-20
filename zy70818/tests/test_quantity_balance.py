#!/usr/bin/env python3
"""测试数量平衡对账"""

import sys
sys.path.insert(0, '.')

import os
for f in os.listdir('data'):
    if f.endswith('.json'):
        os.remove(os.path.join('data', f))

from services.import_service import import_service
from services.reconciliation_service import reconciliation_engine
from datetime import date

with open('data/sample_inventory.csv', 'r', encoding='utf-8-sig') as f:
    import_service.import_inventory(f.read())
with open('data/sample_recall.md', 'r', encoding='utf-8') as f:
    import_service.import_recall(f.read())
with open('data/sample_consumption.csv', 'r', encoding='utf-8-sig') as f:
    import_service.import_consumption(f.read())

result = reconciliation_engine.run_reconciliation(
    name='测试对账',
    start_date=date(2024, 1, 1),
    end_date=date(2024, 1, 31)
)

print("=" * 60)
print("数量平衡对账测试")
print("=" * 60)

print(f"\n对账统计:")
print(f"  总差异: {result.discrepancy_count}")
print(f"  召回批号: {result.recalled_batch_count}")
print(f"  已过期: {result.expired_count}")
print(f"  调拨: {result.transfer_count}")

from collections import Counter
type_counts = Counter(d.type for d in result.discrepancies)
print(f"\n按类型统计:")
for t, count in type_counts.items():
    print(f"  {t}: {count}")

print(f"\n验证 IMP202301001 总店的数量对账:")
found = False
for d in result.discrepancies:
    if d.batch_number == 'IMP202301001' and d.store_name == '总店' and '数量' in d.type:
        found = True
        print(f"  ✓ 找到总店数量对账记录!")
        print(f"    类型: {d.type}")
        print(f"    描述: {d.description}")
        print(f"    解释: {d.explanation}")
        print(f"    期望值: {d.expected_value}, 实际值: {d.actual_value}")
        print(f"    数量差异: {d.quantity_diff}")

if not found:
    print("  ✗ 未找到总店数量对账记录!")

print(f"\n验证分店1调入未入账:")
found = False
for d in result.discrepancies:
    if d.batch_number == 'IMP202301001' and d.store_name == '分店1':
        found = True
        print(f"  ✓ 找到分店1记录!")
        print(f"    类型: {d.type}")
        print(f"    描述: {d.description}")

if not found:
    print("  ✗ 未找到分店1记录!")

print("\n" + "=" * 60)
print("测试完成!")
print("=" * 60)
