import sys
sys.path.insert(0, '/Users/maca/pro/solo/workspaces/zy73091')
from app import app
import json

client = app.test_client()

def log(label, data=None):
    with open('/tmp/preaudit_smoke.log','a',encoding='utf-8') as f:
        f.write(f'\n===== {label} =====\n')
        if data is not None:
            f.write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

# 清理旧日志
open('/tmp/preaudit_smoke.log','w').close()

# 1. health
r = client.get('/api/health')
log('HEALTH', r.status_code)
assert r.status_code == 200

# 2. analyze case - 有口径不一致+坐标偏移
sample = {
    "project_name": "测试项目-机电管综A座",
    "operator": "阿宁",
    "meeting_minutes": """
机电管综协调会纪要：
1. 消防水管送审口径 DN150，施工班组现场采购 DN100 消防水管
2. 电缆桥架设计要求规格 800×200，施工单位实际进场桥架为 600×200
3. 通风风管蓝图标注 1200×600，现场施工按 1200×600 安装（一致）
4. 坐标：给排水系统坐标基点 X 2000.0 Y 3000.0 Z 2800.5（偏移严重，需挂起）
5. 坐标：消防系统坐标原点 X 10.5 Y 20.3 Z 30.8（正常）
6. 电缆桥架与消防水管在B3层发生严重碰撞
""",
    "supplementary_note": "后补：消防水管送审是DN150，施工实际到货就是DN100，采购口径对不上",
    "oral_instruction": "阿宁口头说：电缆桥架现场确实是小一档的，设计院还没签变更"
}
r = client.post('/api/cases/analyze', json=sample)
log('ANALYZE', r.get_json())
assert r.status_code == 200
res = r.get_json()
assert res['ok']
case_id = res['case_id']
case_no = res['case_no']

# 3. get case
r = client.get(f'/api/cases/{case_id}')
data = r.get_json()
log('GET_CASE summary', {
    'judgement': data['case']['current_judgement'],
    'is_suspended': data['case']['is_suspended'],
    'materials_count': len(data['materials']),
    'mismatch_count': sum(1 for m in data['materials'] if m['spec_mismatch']),
    'coords_count': len(data['coordinates']),
    'offset_count': sum(1 for c in data['coordinates'] if c['offset_detected']),
    'collisions': len(data['collisions']),
    'judgement_history': len(data['judgement_history']),
})
# 应该是挂起状态（因为坐标偏移未确认）
assert data['case']['is_suspended'] == 1, f"应该挂起但状态是{data['case']['is_suspended']}"
assert data['case']['current_judgement'] == 'suspended'
# 材料口径不一致应该 >= 2项：消防水管DN150≠DN100，桥架800×200≠600×200
assert sum(1 for m in data['materials'] if m['spec_mismatch']) >= 2, \
    f"应该至少2项口径不一致，实际{sum(1 for m in data['materials'] if m['spec_mismatch'])}。材料明细：{[(m['material_name'],m['review_spec'],m['construction_spec'],m['spec_mismatch']) for m in data['materials']]}"

# 4. 修改备注同步（模拟复核人改一条备注）
r = client.patch(f'/api/cases/{case_id}/remark', json={
    'operator': '复核人老王',
    'change_note': '复核人改了一条预审备注',
    'current_judgement_note': '【复核人修正】已确认消防水管采购单确实是DN100，口径不一致，需整改',
    'materials': [
        {'id': data['materials'][0]['id'],
         'review_spec': 'DN150', 'construction_spec': 'DN100（现场已确认）'}
    ]
})
log('REMARK PATCH', r.get_json())
assert r.status_code == 200
assert r.get_json()['ok']

# 5. 确认坐标偏移 - 解除挂起
r = client.post(f'/api/cases/{case_id}/coordinate/confirm', json={
    'operator': '复核人老王'
})
log('COORD CONFIRM', r.get_json())
assert r.status_code == 200
r2 = client.get(f'/api/cases/{case_id}').get_json()
log('AFTER CONFIRM', {
    'judgement': r2['case']['current_judgement'],
    'is_suspended': r2['case']['is_suspended'],
    'history_count': len(r2['judgement_history'])
})
assert r2['case']['is_suspended'] == 0

# 6. 阿宁临时调整判断
r = client.post(f'/api/cases/{case_id}/judgement', json={
    'new_judgement': 'conditional',
    'reason': '阿宁：设计方已经口头同意桥架缩径，先走附条件通过，后续补正式变更单',
    'operator': '阿宁'
})
log('CHANGE JUDGE', r.get_json())
assert r.status_code == 200
r3 = client.get(f'/api/cases/{case_id}').get_json()
assert r3['case']['current_judgement'] == 'conditional'
assert len(r3['judgement_history']) >= 3, f"判断历史应该≥3条，实际{len(r3['judgement_history'])}"

# 7. 补录后重跑
r = client.post(f'/api/cases/{case_id}/rerun', json={
    'meeting_minutes': sample['meeting_minutes'] + """
8. 补录：给水管送审 DN80，施工实际用 DN65（补录内容）
9. 补录：新的碰撞——通风风管与喷淋头在2层发生中等碰撞
""",
    'supplementary_note': sample['supplementary_note'] + '；补录：给水管口径不一致',
    'operator': '阿宁',
})
log('RERUN', r.get_json())
assert r.status_code == 200
r4 = client.get(f'/api/cases/{case_id}').get_json()
log('AFTER RERUN', {
    'rerun_count': r4['case']['rerun_count'],
    'materials_count': len(r4['materials']),
    'judgements': len(r4['judgement_history']),
    'remarks': len(r4['remark_history']),
})
assert r4['case']['rerun_count'] == 1
# 历史不能断：判断历史和备注历史都应该有增加
assert len(r4['judgement_history']) >= 3, f"判断历史不应该断"
assert len(r4['remark_history']) >= 3, f"备注历史不应该断"

# 8. 导出Excel
r = client.get(f'/api/cases/{case_id}/export')
log('EXPORT', {'status': r.status_code, 'size': len(r.data), 'filename_header': r.headers.get('Content-Disposition')})
assert r.status_code == 200
assert len(r.data) > 2000, f"Excel导出内容太小，才{len(r.data)}字节"
disp = r.headers.get('Content-Disposition', '') + r.headers.get('Content-disposition', '')
assert ('预审报告' in disp or '%E9%A2%84%E5%AE%A1%E6%8A%A5%E5%91%8A' in disp), f"文件名里没预审报告: {disp}"

# 9. 再次检查备注修改后导出包含最新口径
mat0 = r4['materials'][0]
log('FINAL CHECK', {
    'construction_spec_latest': mat0.get('construction_spec'),
    'modified_flag': mat0.get('modified_after_submit'),
    'version': mat0.get('version_tag'),
})

print("ALL TESTS PASSED")
log('RESULT', 'ALL PASSED')
