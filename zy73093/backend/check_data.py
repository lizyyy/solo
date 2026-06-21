#!/usr/bin/env python3
import json
import os
import sys

# Disable proxy
for k in ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY']:
    os.environ.pop(k, None)
os.environ['NO_PROXY'] = '*'
os.environ['no_proxy'] = '*'

def check_json():
    with open('data/materials.json') as f:
        d = json.load(f)

    mats = d['materials']
    batches = d['importBatches']

    print('=== materials.json 数据快照 ===')
    print(f'材料总数: {len(mats)}')
    print(f'批次总数: {len(batches)}')
    print()

    print('材料列表:')
    for m in mats:
        dirty_flags = m.get('dirtyFlags', [])
        status = m.get('status', 'normal')
        remark = (m.get('remark', '') or '')[:30]
        manual = m.get('hasManualRemark', False)
        print(f'  {m["id"]:15s} {status:25s} {m["materialName"]:20s}  hasManual={manual}  remark={remark}')
        if dirty_flags:
            for df in dirty_flags:
                print(f'    WARNING: dirty={df["type"]} - {df["description"]}')
                print(f'      originalLink={df.get("originalLink", "")}')

    print()
    print('批次列表:')
    for b in batches:
        print(f'  {b["id"]:10s} {b["name"]:25s} {b.get("importedCount",0)}条 {b.get("skippedCount",0)}跳过')

    has999 = any('999' in m['id'] for m in mats)
    has_test_remark = any('测试' in (m.get('remark', '') or '') for m in mats)

    print()
    print('干净度检查:')
    print(f'  无999记录: {not has999}')
    print(f'  无测试字样备注: {not has_test_remark}')

    # Check counts
    normal_count = sum(1 for m in mats if m.get('status') == 'normal')
    dirty_count = sum(1 for m in mats if m.get('status') != 'normal')
    print(f'  正常记录: {normal_count}')
    print(f'  脏数据: {dirty_count}')

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    check_json()
