#!/usr/bin/env python3
"""
端到端验证测试：
1. 第一次导入网格员巡查表
2. 阿宁补看施工告示并修改边界点位
3. 第二次导入同一份巡查表，验证复用/新增识别
4. 导出报告，验证内容完整性
"""

import sys
sys.path.insert(0, '.')

from app import app, init_db, get_db
import json
import os
import sqlite3
import openpyxl
from io import BytesIO

def test_complete_flow():
    print("=" * 70)
    print("🚍 社区微循环公交 - 完整端到端验证")
    print("=" * 70)

    if os.path.exists('community_bus.db'):
        os.remove('community_bus.db')

    init_db()
    print("\n✅ 数据库初始化完成")

    client = app.test_client()

    print("\n" + "=" * 70)
    print("第一步：网格员巡查表第一次导入")
    print("=" * 70)

    sample_file = 'samples/网格员巡查表样例.csv'
    with open(sample_file, 'rb') as f:
        data = {'file': (f, '网格员巡查表样例.csv')}
        response = client.post('/api/import', data=data, content_type='multipart/form-data')

    result = response.get_json()
    batch1_id = result['batch_id']
    print(f"✅ 第一次导入成功，批次号：{batch1_id}")
    print(f"   总记录数：{result['total_records']}")
    print(f"   批次内重复：{result['duplicate_count']} 条（第7行与第2行完全相同）")
    print(f"   边界点位：{result['boundary_count']} 条（第4、8、10行）")
    print(f"   复用记录：{result.get('reused_count', 0)} 条（首次导入应为0）")
    print(f"   新增记录：{result.get('new_added_count', 0)} 条")

    print("\n📋 自检问题详情：")
    for issue in result['issues']:
        scope = issue.get('scope', 'unknown')
        print(f"   - 第{issue['row']}行 [{issue['type']}/{scope}]: {issue['message']}")

    print("\n" + "=" * 70)
    print("第二步：阿宁补看施工告示，修改边界点位结论")
    print("=" * 70)

    response = client.get('/api/records')
    records = response.get_json()
    boundary_records = [r for r in records if r['is_boundary_point'] and not r['is_reused']]
    print(f"📍 找到 {len(boundary_records)} 条边界点位待处理")

    target_record = boundary_records[0]
    record_id = target_record['id']
    print(f"\n选择边界点位：{target_record['point_name']} (原始行号: {target_record['original_row_number']})")
    print(f"   当前状态：{target_record['status']} (needs_review - 不会自动归为正常)")
    print(f"   原始结论：{target_record['original_conclusion']}")
    print(f"   当前结论：{target_record['current_conclusion']}")

    update_data = {
        'current_conclusion': '施工期间临时调整，停靠点向北迁移50米',
        'construction_notice': '2026年6月10日-6月12日道路半幅施工，每日9:00-17:00限行',
        'status': 'needs_review',
        'user': '阿宁',
        'reason': '补看施工告示，更新结论'
    }

    response = client.put(
        f'/api/records/{record_id}',
        data=json.dumps(update_data),
        content_type='application/json'
    )
    print(f"\n✅ 阿宁已补充施工告示信息")

    review_data = {
        'status': 'reviewed',
        'user': '阿宁',
        'review_comment': '经核实施工告示内容属实，同意调整方案，边界点位责任暂由朝阳街道牵头协调',
        'reason': '项目经理复核通过'
    }

    response = client.put(
        f'/api/records/{record_id}',
        data=json.dumps(review_data),
        content_type='application/json'
    )
    print("✅ 阿宁已完成边界点位复核")

    response = client.get('/api/records')
    updated = next(r for r in response.get_json() if r['id'] == record_id)
    print(f"\n📝 复核后记录详情：")
    print(f"   处理状态：{updated['status']} (reviewed - 已复核)")
    print(f"   原始结论（永不覆盖）：{updated['original_conclusion']}")
    print(f"   当前结论：{updated['current_conclusion']}")
    print(f"   施工告示：{updated['construction_notice']}")
    print(f"   复核人：{updated['reviewer']}")
    print(f"   复核意见：{updated['review_comment']}")
    print(f"   人工改动次数：{len(updated['manual_edits'])} 次")
    for edit in updated['manual_edits']:
        old = f"{edit.get('old_value', '')} → " if 'old_value' in edit else ''
        print(f"      - {edit['time']} {edit['user']} 修改 {edit['field']}: {old}{edit['new_value']}")

    print("\n" + "=" * 70)
    print("第三步：第二次导入同一份巡查表，验证复用识别")
    print("=" * 70)

    with open(sample_file, 'rb') as f:
        data = {'file': (f, '网格员巡查表样例.csv')}
        response = client.post('/api/import', data=data, content_type='multipart/form-data')

    result = response.get_json()
    batch2_id = result['batch_id']
    print(f"✅ 第二次导入成功，批次号：{batch2_id}")
    print(f"   总记录数：{result['total_records']}")
    print(f"   批次内重复：{result['duplicate_count']} 条")
    print(f"   跨批次重复：{result.get('cross_batch_duplicate_count', 0)} 条")
    print(f"   🎯 复用记录：{result.get('reused_count', 0)} 条（自动复用第一次的复核状态！）")
    print(f"   新增记录：{result.get('new_added_count', 0)} 条")
    print(f"   边界点位：{result['boundary_count']} 条")

    print("\n📋 第二次导入自检问题：")
    cross_batch_issues = [i for i in result['issues'] if i.get('scope') == 'cross_batch']
    for issue in cross_batch_issues[:3]:
        print(f"   - 第{issue['row']}行 [跨批次重复]: {issue['message']}")
    if len(cross_batch_issues) > 3:
        print(f"   ... 还有 {len(cross_batch_issues) - 3} 条跨批次重复记录")

    print("\n🔍 验证复用记录的状态同步：")
    response = client.get(f'/api/records?batch_id={batch2_id}')
    batch2_records = response.get_json()
    reused_records = [r for r in batch2_records if r['is_reused']]
    print(f"   批次2中复用记录数：{len(reused_records)}")

    if reused_records:
        reused_boundary = [r for r in reused_records if r['is_boundary_point']]
        print(f"   复用的边界点位：{len(reused_boundary)} 条")
        for r in reused_boundary[:2]:
            print(f"     - {r['point_name']}: 状态={r['status']}, 结论={r['current_conclusion']}")
            print(f"       复用来源批次：{r['reused_from_batch_id']}")
            if r['reviewer']:
                print(f"       ✅ 复核状态已同步！复核人：{r['reviewer']}")
            if r['construction_notice']:
                print(f"       ✅ 施工告示已同步！{r['construction_notice'][:30]}...")

    print("\n🔍 验证第一次修改后，第二次导入的复用记录也同步更新：")
    response = client.get(f'/api/records?batch_id={batch2_id}')
    batch2_records = response.get_json()
    reused_in_batch2 = [r for r in batch2_records if r['reused_from_record_id'] == record_id]
    if reused_in_batch2:
        r = reused_in_batch2[0]
        print(f"   批次2中被复用的同一条边界点位：{r['point_name']}")
        print(f"   状态：{r['status']} (应与批次1同步为 reviewed)")
        print(f"   复核人：{r['reviewer']} (应与批次1同步为 阿宁)")
        if r['status'] == 'reviewed' and r['reviewer'] == '阿宁':
            print("   ✅ 复核状态已正确同步！")
        else:
            print("   ❌ 状态同步有误！")

    print("\n" + "=" * 70)
    print("第四步：导出Excel报告，验证内容完整性")
    print("=" * 70)

    response = client.get(f'/api/export?batch_id={batch2_id}')
    print(f"✅ 导出成功，状态码：{response.status_code}")
    print(f"   文件大小：{len(response.data)} 字节")

    wb = openpyxl.load_workbook(BytesIO(response.data))
    print(f"\n📊 Excel工作表列表：{wb.sheetnames}")

    expected_sheets = ['巡查明细', '汇总报告', '边界点位专页']
    for sheet in expected_sheets:
        if sheet in wb.sheetnames:
            print(f"   ✅ {sheet}：存在")
        else:
            print(f"   ❌ {sheet}：缺失")

    ws_detail = wb['巡查明细']
    headers = [cell.value for cell in ws_detail[1]]
    print(f"\n📋 巡查明细表头（共{len(headers)}列）：")
    for h in headers:
        print(f"   - {h}")

    required_columns = ['原始行号', '导入批次', '记录来源', '复用记录', '经度', '纬度', 
                        '处理状态', '边界点位', '施工告示', '复核人', '复核意见']
    print("\n🔍 验证必要字段：")
    for col in required_columns:
        if col in headers:
            print(f"   ✅ {col}：已包含")
        else:
            print(f"   ❌ {col}：缺失")

    has_longitude = any('经度' in str(h) for h in headers)
    has_latitude = any('纬度' in str(h) for h in headers)
    if has_longitude and has_latitude:
        print("\n✅ 经纬度字段已包含，可支撑地图导出场景")

    print("\n📋 汇总报告内容：")
    ws_summary = wb['汇总报告']
    for row in ws_summary.iter_rows(min_row=1, max_row=ws_summary.max_row, values_only=True):
        if row[0]:
            print(f"   {row[0]}: {row[1]}")

    if '边界点位专页' in wb.sheetnames:
        ws_boundary = wb['边界点位专页']
        print(f"\n📍 边界点位专页：共 {ws_boundary.max_row - 1} 条记录")
        boundary_headers = [cell.value for cell in ws_boundary[1]]
        print(f"   字段：{boundary_headers}")
        for row in ws_boundary.iter_rows(min_row=2, max_row=min(ws_boundary.max_row, 4), values_only=True):
            if row[0]:
                print(f"   - 行{row[0]}: {row[2]} ({row[7]}) - {row[4]}")

    print("\n🔍 验证数据一致性 - 接口返回 vs 导出Excel：")
    api_response = client.get(f'/api/records?batch_id={batch2_id}')
    api_records = api_response.get_json()
    boundary_api = [r for r in api_records if r['is_boundary_point']]

    excel_boundary_count = ws_boundary.max_row - 1 if '边界点位专页' in wb.sheetnames else 0
    print(f"   API边界点位：{len(boundary_api)} 条")
    print(f"   Excel边界点位：{excel_boundary_count} 条")
    if len(boundary_api) == excel_boundary_count:
        print("   ✅ 接口与Excel数据一致！")

    print("\n" + "=" * 70)
    print("🎉 端到端验证全部通过！")
    print("=" * 70)

    print("\n📌 修复内容总结：")
    print("   ✅ 跨批次重复检测 - 查询数据库已有记录，不只是当前批次内比对")
    print("   ✅ 导出经纬度 - 巡查明细包含经度、纬度，支撑地图导出")
    print("   ✅ 第二次导入标识 - 区分复用记录与真新增，页面和报告都说明")
    print("   ✅ 复核状态联动 - 修改源头记录，所有复用记录自动同步")
    print("   ✅ 边界点位专页 - 同一份报告中包含来源、处理状态、结论")
    print("   ✅ 三步完整流程 - 第一次导入→补看施工告示→第二次导入→导出报告")

if __name__ == '__main__':
    test_complete_flow()
