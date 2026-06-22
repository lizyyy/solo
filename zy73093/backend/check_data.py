#!/usr/bin/env python3
import json
import os
import sys

for k in ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY']:
    os.environ.pop(k, None)
os.environ['NO_PROXY'] = '*'
os.environ['no_proxy'] = '*'


def format_dirty_flag(df, material):
    """兼容字符串和对象两种 dirtyFlags 格式，返回可读描述"""
    if isinstance(df, str):
        type_map = {
            'late_attachment': '晚到附件',
            'change_order_late': '变更单晚到',
            'mixed': '混合脏数据'
        }
        desc = type_map.get(df, df)
        extra = ''
        original_link = material.get('sourceLink', '')
        if df == 'late_attachment':
            late_att = next((a for a in material.get('attachments', []) if a.get('isLate')), None)
            if late_att:
                extra = f' [{late_att.get("name", "")}] {late_att.get("lateReason", "")}'
                if late_att.get('originalMaterialId'):
                    original_link = f'material://{late_att["originalMaterialId"]}'
        elif df == 'change_order_late':
            late_co = next((c for c in material.get('changeOrders', []) if c.get('isLate')), None)
            if late_co:
                extra = f' [{late_co.get("name", "")}] {late_co.get("reason", "")}'
                if late_co.get('originalMaterialId'):
                    original_link = f'material://{late_co["originalMaterialId"]}'
        return f'  ⚠️  {desc}{extra}', f'     原始链接: {original_link}'
    elif isinstance(df, dict):
        desc = f'{df.get("typeName", df.get("type", ""))}'
        name = df.get('name', '')
        reason = df.get('reason', df.get('description', ''))
        extra = f' [{name}] {reason}' if name or reason else ''
        link = df.get('originalLink', df.get('sourceLink', material.get('sourceLink', '')))
        return f'  ⚠️  {desc}{extra}', f'     原始链接: {link}'
    else:
        return f'  ⚠️  未知格式: {repr(df)}', ''


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
        dirty_flags = m.get('dirtyFlags', []) or []
        status = m.get('status', 'normal')
        remark = (m.get('remark', '') or '')[:40]
        manual = m.get('hasManualRemark', False)
        print(f'  {m["id"]:15s} {status:25s} {m["materialName"]:22s}  hasManual={manual}')
        if remark:
            print(f'    备注: {remark}')
        print(f'    sourceLink: {m.get("sourceLink", "")}')
        if dirty_flags:
            for df in dirty_flags:
                line1, line2 = format_dirty_flag(df, m)
                print(line1)
                if line2:
                    print(line2)
        print()

    print('批次列表:')
    for b in batches:
        print(f'  {b["id"]:10s} {b["name"]:30s} 导入{b.get("count", b.get("importedCount", 0))}条 跳过{b.get("skippedCount", 0)}条  {b.get("importTime", "")}')

    has999 = any('999' in m['id'] for m in mats)
    has_test_remark = any('测试' in (m.get('remark', '') or '') for m in mats)
    has_test_batch = any('测试' in (b.get('name', '') or '') for b in batches)

    print()
    print('干净度检查:')
    print(f'  无999记录: {not has999}')
    print(f'  无测试字样备注: {not has_test_remark}')
    print(f'  无测试字样批次: {not has_test_batch}')

    normal_count = sum(1 for m in mats if m.get('status') == 'normal')
    dirty_count = sum(1 for m in mats if m.get('status') != 'normal')
    late_att = sum(1 for m in mats if m.get('status') == 'dirty_late_attachment')
    change_late = sum(1 for m in mats if m.get('status') == 'dirty_change_order')
    print()
    print('数据分布:')
    print(f'  正常记录: {normal_count}')
    print(f'  脏数据: {dirty_count} (晚到附件={late_att}, 变更单晚到={change_late})')

    dirty_ids = sorted([m['id'] for m in mats if m.get('status') != 'normal'])
    print(f'  脏数据ID: {", ".join(dirty_ids) if dirty_ids else "无"}')

    all_clean = (not has999) and (not has_test_remark) and (not has_test_batch)
    print()
    print(f'最终结论: {"✅ 数据干净" if all_clean else "❌ 存在测试残留污染"}')
    return all_clean

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    ok = check_json()
    sys.exit(0 if ok else 1)
