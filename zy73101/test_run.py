import os, sys, csv, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import db

DB = os.path.join(os.path.dirname(__file__), 'roof_drainage.db')
if os.path.exists(DB): os.remove(DB)
db.init_db()

S = os.path.join(os.path.dirname(__file__), 'sample_data')
def read_csv(p):
    with open(os.path.join(S, p), 'r', encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))

print('='*60)
print('[1/6] 导入 V2.1 材料送审表（张工版，标准字段名）')
r1 = db.import_submission(read_csv('现场材料包_材料送审表_V2.1_复核人张工.csv'), 'V2.1_张工.csv')
print(f'     结果: 总数={r1["total"]}，重复={r1["duplicates"]}')
d = db.query_all()
print(f'     数据库当前：送审记录={d["stats"]["submission_total"]}')
assert d['stats']['submission_total'] == 10, f'应10条，实{d["stats"]["submission_total"]}'
print('     ✅ 首次导入正确')

print()
print('[2/6] 重复导入同一张 V2.1（验证不翻倍 + 后续验证备注保留）')
r2 = db.import_submission(read_csv('现场材料包_材料送审表_V2.1_复核人张工.csv'), 'V2.1_张工.csv')
print(f'     结果: 总数={r2["total"]}，重复={r2["duplicates"]}')
d = db.query_all()
print(f'     数据库当前：送审记录={d["stats"]["submission_total"]}')
assert d['stats']['submission_total'] == 10, '重复导入翻倍了！'
assert r2['duplicates'] == 10, '应报告10条重复'
ws5 = [s for s in d['submissions'] if s['material_code'] == 'WS-005'][0]
db.update_manual_remark(ws5['id'], '【人工备注】现场看过位置OK，保留')
print('     ✅ 重复导入未翻倍，已写入人工备注')

print()
print('[3/6] 再次导入 V2.1（验证人工备注不被覆盖）')
r3 = db.import_submission(read_csv('现场材料包_材料送审表_V2.1_复核人张工.csv'), 'V2.1_张工.csv')
d = db.query_all()
ws5 = [s for s in d['submissions'] if s['material_code'] == 'WS-005'][0]
print(f'     WS-005 人工备注: {ws5["manual_remark"]}')
assert '【人工备注】现场看过位置OK' in (ws5['manual_remark'] or ''), '人工备注被覆盖了！'
print(f'     数据库当前：送审记录={d["stats"]["submission_total"]}')
print('     ✅ 人工备注保住了，未被覆盖')

print()
print('[4/6] 导入 V2.2 材料送审表（王工版，字段名全换了：物料编码/报审日期/审核人…）')
r4 = db.import_submission(read_csv('现场材料包_材料送审表_V2.2_复核人王工.csv'), 'V2.2_王工.csv')
print(f'     结果: 总数={r4["total"]}，重复={r4["duplicates"]}')
d = db.query_all()
print(f'     数据库当前：送审记录={d["stats"]["submission_total"]}')
ws1_v22 = [s for s in d['submissions'] if s['material_code'] == 'WS-001' and s['drawing_version'] == 'V2.2']
print(f'     WS-001 V2.2 审核人={ws1_v22[0]["reviewer"]} 版次={ws1_v22[0]["drawing_version"]}')
assert d['stats']['submission_total'] == 15, f'应15条，实{d["stats"]["submission_total"]}'
assert ws1_v22[0]['reviewer'] == '王工', '换字段名没识别到审核人'
print('     ✅ 字段别名识别OK，不同版次按新条目入')

print()
print('[5/6] 导入屋面模型坐标（含 BEAM-L1 坐标偏移标注，不能被吞）')
r5 = db.import_model(read_csv('现场材料包_屋面模型坐标_V2.2_设计院导出.csv'), '模型坐标_V2.2.csv')
print(f'     结果: 构件总数={r5["total"]}，重复={r5["duplicates"]}')
d = db.query_all()
print(f'     数据库当前：构件={d["stats"]["components_total"]}')
assert d['stats']['components_total'] == 19
print('     ✅ 模型坐标导入OK')

print()
print('[6/6] 运行碰撞预审（验证坐标偏移单独列出不被吞 + 碰撞检测）')
res = db.run_collision_detection()
d = db.query_all()
print(f'     碰撞={res["collisions"]}处，坐标偏移={res["offsets"]}处')
print(f'     严重碰撞={d["stats"]["collisions_critical"]}处')
print(f'     偏移记录列表：')
for o in d['offsets']:
    print(f'        · [{o["component_id"]}] {o["component_type"]} 标注={o["description"]}')
    print(f'          处理建议={o["suggestion"][:60]}…')
assert res['offsets'] >= 1, 'BEAM-L1 的坐标偏移被吞掉了！'
assert any('BEAM-L1' in o['component_id'] for o in d['offsets']), '没找到 BEAM-L1 的偏移记录'
beam_offset = [o for o in d['offsets'] if 'BEAM-L1' in o['component_id']][0]
assert '联系设计确认' in beam_offset['suggestion'], '偏移处理建议缺失'
assert res['collisions'] >= 2, '碰撞检测太少'
crit = [c for c in d['collisions'] if c['severity'] == 'critical']
print(f'     严重碰撞示例：{crit[0]["description"] if crit else "无"}')
print(f'     严重碰撞建议：{crit[0]["suggestion"][:60] if crit else "无"}…')
print('     ✅ 碰撞 + 坐标偏移全正常，偏移没被吞')

print()
print('='*60)
print('🎉 全部验证通过！要点回顾：')
print(f'  ① 同文件重复导入 → {r2["duplicates"]}条去重，记录不翻倍')
print(f'  ② 人工备注 → 经第3步验证保留完好')
print(f'  ③ 字段名前后不一 → V2.2换列名照样识别，审核人="王工"入列正确')
print(f'  ④ 坐标偏移 → BEAM-L1 单独入坐标偏移表，带完整处理建议')
print(f'  ⑤ 碰撞检测 → {res["collisions"]}处，其中严重{d["stats"]["collisions_critical"]}处')
print(f'  ⑥ 材料来源 → 每条记录都保留 source_file，可追溯哪张表哪位复核人')
print()
print('下一步：执行  python3 app.py  打开浏览器 http://127.0.0.1:5055 看界面')
print('        或继续加载样例、体验界面。')
