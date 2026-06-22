#!/usr/bin/env python3
"""完整功能验证：干净数据、重复导入去重、备注保护、备注同步、脏数据回溯"""
import json
import urllib.request
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import API_BASE, apply_no_proxy

apply_no_proxy()

opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
API = API_BASE

passed = 0
failed = 0

def check(name, condition):
    global passed, failed
    if condition:
        passed += 1
        print(f'  ✅ {name}')
    else:
        failed += 1
        print(f'  ❌ {name}')

def api(path, method='GET', data=None):
    url = API + path
    req = urllib.request.Request(url, method=method)
    if data is not None:
        req.add_header('Content-Type', 'application/json')
        req.data = json.dumps(data).encode()
    with opener.open(req, timeout=10) as r:
        return json.loads(r.read().decode())

print('=' * 60)
print('完整功能验证')
print('=' * 60)

# === 1. 重置为干净演示数据 ===
print('\n1. 重置为干净演示数据')
r = api('/api/reset-demo', 'POST', {})
check('重置成功', r.get('code') == 0)
check('重置消息正确', '演示数据' in r.get('message', ''))

# 获取初始状态
r = api('/api/materials')
mats = r['data']
summary = r['summary']
initial_count = summary['total']
print(f'   初始记录数: {initial_count}')

check('共5条记录', initial_count == 5)
check('3条正常记录', summary['normal'] == 3)
check('2条脏数据', summary['dirty'] == 2)

# 检查无测试残留
has_999 = any('999' in m['id'] for m in mats)
has_test = any('测试' in (m.get('remark') or '') for m in mats)
check('无999测试记录', not has_999)
check('无测试字样备注', not has_test)

# 检查脏数据类型
dirty_mats = [m for m in mats if m['status'] != 'normal']
dirty_ids = [m['id'] for m in dirty_mats]
check('脏数据是003和004', 'MAT-2026-003' in dirty_ids and 'MAT-2026-004' in dirty_ids)

mat003 = next(m for m in mats if m['id'] == 'MAT-2026-003')
mat004 = next(m for m in mats if m['id'] == 'MAT-2026-004')
check('003是晚到附件', mat003['status'] == 'dirty_late_attachment')
check('004是变更单晚到', mat004['status'] == 'dirty_change_order')

# 检查005有真实业务备注
mat005 = next(m for m in mats if m['id'] == 'MAT-2026-005')
check('005有人工备注标记', mat005.get('hasManualRemark') == True)
check('005备注是真实业务内容', 'GB50303' in mat005.get('remark', ''))
check('005备注不含测试', '测试' not in mat005.get('remark', ''))

# === 2. 脏数据回溯链接 ===
print('\n2. 脏数据专区 & 回溯链接')
r = api('/api/materials/dirty/list')
check('脏数据API返回成功', r.get('code') == 0)
dirty_data = r['data']
check('脏数据专区返回2条', len(dirty_data) == 2)

# 检查每条脏数据都有sourceLink
all_have_links = all(m.get('sourceLink', '').startswith('material://') for m in dirty_data)
check('脏数据都有sourceLink', all_have_links)

# 检查晚到附件有originalLink
for m in dirty_data:
    if m['id'] == 'MAT-2026-003':
        late_att = next((a for a in m.get('attachments', []) if a.get('isLate')), None)
        check('003晚到附件有originalMaterialId', late_att and late_att.get('originalMaterialId'))

# === 3. 重复导入去重 & 备注保护 ===
print('\n3. 重复导入去重 & 人工备注保护')
import_items = [
    {'id': 'MAT-2026-001', 'materialName': '给排水管道系统-1F', 'projectName': '机电管综方案比选-小样例', 'remark': '导入备注1'},
    {'id': 'MAT-2026-002', 'materialName': '喷淋系统-B1层', 'projectName': '机电管综方案比选-小样例', 'remark': '导入备注2'},
    {'id': 'MAT-2026-005', 'materialName': '强电系统-4F', 'projectName': '机电管综方案比选-小样例', 'remark': '要覆盖人工备注？不行！'},
    {'id': 'MAT-2026-999', 'materialName': '临时测试记录', 'projectName': '机电管综方案比选-小样例', 'remark': '测试'},
]

r = api('/api/materials/import', 'POST', {
    'batchName': '验证-重复导入测试',
    'items': import_items
})
check('导入API成功', r.get('code') == 0)
totals = r['data']['totals']
check('新增1条(999)', totals['importedCount'] == 1)
check('跳过3条(重复)', totals['skippedCount'] == 3)

# 验证总数：原来5条 + 新增1条 = 6条
r = api('/api/materials')
check('导入后共6条记录', r['summary']['total'] == 6)

# 验证人工备注未被覆盖（005）
r005 = api('/api/materials/MAT-2026-005')
m005 = r005['data']
check('005人工备注未被覆盖', 'GB50303' in m005.get('remark', ''))
check('005 hasManualRemark仍为true', m005.get('hasManualRemark') == True)

# === 4. 备注同步（修改备注，验证JSON和导出变化）===
print('\n4. 备注实时同步')
new_remark = '建筑师小周复核：喷淋B1层方案已调整，碰撞点标高下移0.3米，待设计院确认后可进入比选'
r = api('/api/materials/MAT-2026-002/remark', 'PUT', {'remark': new_remark})
check('修改备注API成功', r.get('code') == 0)
check('返回新备注', r['data'].get('remark') == new_remark)
check('返回hasManualRemark=true', r['data'].get('hasManualRemark') == True)

# 再GET一次验证
r002 = api('/api/materials/MAT-2026-002')
m002 = r002['data']
check('GET验证备注已同步', m002.get('remark') == new_remark)
check('GET验证hasManualRemark=true', m002.get('hasManualRemark') == True)

# 验证JSON文件里也变了（读取文件验证）
with open('/Users/maca/pro/solo/workspaces/zy73093/backend/data/materials.json') as f:
    file_data = json.load(f)
file_002 = next(m for m in file_data['materials'] if m['id'] == 'MAT-2026-002')
check('后端JSON文件已同步', file_002.get('remark') == new_remark)

# === 5. 再次重置，回到干净状态 ===
print('\n5. 再次重置回干净状态')
r = api('/api/reset-demo', 'POST', {})
check('再次重置成功', r.get('code') == 0)

r = api('/api/materials')
check('重置后回到5条', r['summary']['total'] == 5)
check('重置后005备注恢复', 'GB50303' in next(m['remark'] for m in r['data'] if m['id'] == 'MAT-2026-005'))

# 验证JSON文件也重置了
with open('/Users/maca/pro/solo/workspaces/zy73093/backend/data/materials.json') as f:
    final_data = json.load(f)
final_ids = [m['id'] for m in final_data['materials']]
check('JSON文件无999', 'MAT-2026-999' not in final_ids)
check('JSON文件共5条', len(final_data['materials']) == 5)
check('JSON文件3个批次', len(final_data['importBatches']) == 3)

# === 汇总 ===
print('\n' + '=' * 60)
print(f'验证结果: {passed} 通过, {failed} 失败')
print('=' * 60)

if failed > 0:
    exit(1)
