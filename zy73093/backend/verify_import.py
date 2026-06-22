#!/usr/bin/env python3
"""验证重复导入结果"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

with open('data/materials.json') as f:
    d = json.load(f)

print('=' * 60)
print('重复导入验证结果')
print('=' * 60)

mats = d['materials']
batches = d['importBatches']

print(f'\n材料总数: {len(mats)}')
ids = [m['id'] for m in mats]
print(f'材料ID列表: {ids}')

no_dup = len(ids) == len(set(ids))
print(f'\n✅ 去重验证: {"通过" if no_dup else "失败"} - 无重复ID')

# 检查002备注
mat002 = next(m for m in mats if m['id'] == 'MAT-2026-002')
print(f'\nMAT-2026-002:')
print(f'  备注: {mat002["remark"][:60]}...')
print(f'  hasManualRemark: {mat002["hasManualRemark"]}')
preserve002 = '小周复核' in mat002['remark'] and mat002['hasManualRemark'] == True
print(f'  ✅ 备注保护: {"通过" if preserve002 else "失败"}')

# 检查005备注
mat005 = next(m for m in mats if m['id'] == 'MAT-2026-005')
print(f'\nMAT-2026-005:')
print(f'  备注: {mat005["remark"][:60]}...')
print(f'  hasManualRemark: {mat005["hasManualRemark"]}')
preserve005 = 'GB50303' in mat005['remark'] and mat005['hasManualRemark'] == True
print(f'  ✅ 备注保护: {"通过" if preserve005 else "失败"}')

# 检查001
mat001 = next(m for m in mats if m['id'] == 'MAT-2026-001')
print(f'\nMAT-2026-001:')
print(f'  hasManualRemark: {mat001["hasManualRemark"]}')
print(f'  ✅ 跳过验证: {"通过" if mat001["hasManualRemark"] == False else "失败"} - 无人工备注标记保持原样')

# 检查导入批次
print(f'\n导入批次: {len(batches)} 个')
for b in batches:
    print(f'  {b["id"]}: {b["name"]} 导入{b.get("count",0)}条 跳过{b.get("skippedCount",0)}条')

all_ok = no_dup and preserve002 and preserve005
print(f'\n{"=" * 60}')
print(f'最终结果: {"✅ 全部通过" if all_ok else "❌ 有失败项"}')
print(f'{"=" * 60}')

sys.exit(0 if all_ok else 1)
