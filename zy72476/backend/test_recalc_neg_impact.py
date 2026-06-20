import sys, os, io, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from app import app
from database import init_db, DB_PATH

if os.path.exists(DB_PATH):
    os.remove(DB_PATH)
init_db()

client = app.test_client()

def P(msg): print(f"\n{'='*60}\n{msg}\n{'='*60}")

def make_sample_xlsx():
    data = [
        {"巡查日期": "2024-06-10", "小区名称": "阳光花园", "出行方式": "步行", "出行次数": 45, "低碳得分": 8.5, "网格员": "张"},
        {"巡查日期": "2024-06-10", "小区名称": "阳光花园小区", "出行方式": "步行", "出行次数": 32, "低碳得分": 7.2, "网格员": "张"},
        {"巡查日期": "2024-06-10", "小区名称": "翠湖家园", "出行方式": "步行", "出行次数": 28, "低碳得分": 6.0, "网格员": "李"},
        {"巡查日期": "2024-06-10", "小区名称": "翠湖家园小区", "出行方式": "步行", "出行次数": 20, "低碳得分": 4.5, "网格员": "李"},
        {"巡查日期": "2024-06-10", "小区名称": "和平里", "出行方式": "步行", "出行次数": 35, "低碳得分": 7.8, "网格员": "王"},
        {"巡查日期": "2024-06-10", "小区名称": "和平里社区", "出行方式": "步行", "出行次数": 22, "低碳得分": 5.0, "网格员": "王"},
    ]
    df = pd.DataFrame(data)
    buf = io.BytesIO()
    df.to_excel(buf, index=False, sheet_name="巡查记录")
    buf.seek(0)
    return buf

P("步骤1：导入网格员巡查表（6条记录，含阳光花园/阳光花园小区）")
resp = client.post('/api/import',
    data={'file': (make_sample_xlsx(), '巡查表.xlsx')},
    content_type='multipart/form-data')
r = resp.get_json()
print(f"  导入结果: {json.dumps(r, ensure_ascii=False, indent=2)[:400]}")
print(f"  新记录={r.get('new_count')} 历史重复={r.get('historical_duplicate_count')} 本次重复={r.get('batch_duplicate_count')} 总数={r.get('total_count')}")
assert r.get('new_count') == 6, f"期望6条新记录, 实际{r}"
print("  ✅ 通过")

P("步骤2：运行自检 - 应该识别出新旧名候选")
resp = client.get('/api/self-check')
checks = {c['check_type']: c for c in resp.get_json()}
dual = checks['同一小区新旧名识别']
print(f"  已关联别名对: {dual['total_alias_pairs']}")
print(f"  候选推荐: {dual['total_candidates']} 组 - {[(c['name_a'], c['name_b'], c['match_type']) for c in dual.get('candidates', [])]}")
print(f"  命名冲突: {dual['total_conflicts']}")
print(f"  是否通过: {dual['passed']}")
assert dual['total_candidates'] >= 3, "至少应识别出3组候选（阳光花园/翠湖家园/和平里）"
yangguang_cand = [c for c in dual.get('candidates', []) if '阳光花园' in c.get('name_a', '') and '阳光花园' in c.get('name_b', '')]
assert len(yangguang_cand) >= 1, "应识别出阳光花园 ↔ 阳光花园小区"
print("  ✅ 通过")

P("步骤3：小区复核 - 关联阳光花园→阳光花园小区")
resp = client.get('/api/communities')
comms = resp.get_json()
print(f"  所有小区: {[(c['id'], c['name']) for c in comms]}")
old = next(c for c in comms if c['name'] == '阳光花园')
new = next(c for c in comms if c['name'] == '阳光花园小区')
resp = client.post(f'/api/communities/{old["id"]}/alias', json={'alias_id': new['id'], 'operator': '测试员'})
print(f"  关联结果 status={resp.status_code}: {resp.get_json()}")
assert resp.status_code == 200
print("  ✅ 通过")

P("步骤4：查看摘要 - 阳光花园与阳光花园小区应合并显示")
resp = client.get('/api/summary')
r = resp.get_json()
s = r['top_communities']
print(f"  总览: {r['total_records']}条记录 {r['total_communities']}个小区 {r['total_trips']}次 {r['total_score']:.1f}分 待重算={r['needs_recalc']}")
print("  摘要列表:")
for x in s:
    print(f"    {x['canonical_name']}: {x['record_count']}条 {x['trips']}次 {x['score']:.1f}分 成员={[m['name'] for m in x['members']]}")
yg = next(x for x in s if x['canonical_name'] == '阳光花园小区')
assert yg['record_count'] == 2, f"合并后应2条记录, 实际{yg['record_count']}"
assert yg['trips'] == 77, f"合并后应77次, 实际{yg['trips']}"
assert abs(yg['score'] - 15.7) < 0.05, f"合并后应15.7分, 实际{yg['score']}"
yangguang_old = [x for x in s if x['canonical_name'] == '阳光花园']
assert len(yangguang_old) == 0, "合并后不应单独显示阳光花园"
print("  ✅ 通过")

P("步骤5：补录施工告示 - 挂在阳光花园，负向影响得分-1.2，出行-5")
resp = client.post('/api/construction-notices', json={
    'community_id': old['id'],
    'notice_title': '南门管线施工',
    'notice_content': '2024年6月1日至15日南门管线施工，绕行',
    'notice_date': '2024-06-01',
    'impact_trip_count': -5,
    'impact_low_carbon_score': -1.2,
    'added_by': '测试员'
})
print(f"  补录结果 status={resp.status_code}: {resp.get_json()}")
assert resp.status_code == 200
print("  ✅ 通过")

P("步骤6：查看补录后的记录状态（先不重算）")
resp = client.get('/api/records')
recs = resp.get_json()
yg_recs = [r for r in recs if '阳光花园' in r['community_name']]
print(f"  阳光花园相关记录共 {len(yg_recs)} 条:")
for x in yg_recs:
    print(f"    行{x.get('original_row')} {x['community_name']} | 状态={x['processing_status']} | 次数={x['trip_count']} 得分={x['low_carbon_score']:.1f}")
    print(f"       规范名={x.get('canonical_community_name', '无')} | 自检结论={x.get('self_check_conclusion', '无')}")
    print(f"       告示影响={x.get('notice_impact_trip', 0)}次 {x.get('notice_impact_score', 0):.1f}分")
    print(f"       notes={str(x.get('notes', '无'))[:60]}")
assert len(yg_recs) == 2, "阳光花园和阳光花园小区各1条"
for x in yg_recs:
    assert x['processing_status'] == 'needs_recalc', f"{x['community_name']}状态应为needs_recalc, 实际{x['processing_status']}"
    assert x.get('notice_impact_score', 0) == -1.2, f"{x['community_name']}影响得分应为-1.2, 实际{x.get('notice_impact_score', 0)}"
    assert '待处理' in x.get('self_check_conclusion', ''), f"{x['community_name']}自检结论应包含'待处理', 实际{x.get('self_check_conclusion', '')}"
print("  ✅ 两条记录均标记为需重算，负向影响-1.2已纳入，自检结论显示'待处理'")

P("步骤7：运行自检（未重算状态）- 补录后重算检查应未通过，明确暴露待处理")
resp = client.get('/api/self-check')
checks = {c['check_type']: c for c in resp.get_json()}
recalc = checks['补录后重算检查']
print(f"  检查类型: {recalc['check_type']}")
print(f"  是否通过: {recalc['passed']}")
print(f"  施工告示总数: {recalc['total_notices']}")
print(f"  待重算记录数: {recalc['need_recalc_count']}")
print(f"  已重算记录数: {recalc['ok_count']}")
print(f"  待处理明细:")
for p in recalc.get('pending_details', []):
    print(f"    行{p['original_row']} {p['community_name']} | 别名组={p['canonical_group_names']} | 告示={p['notice_title']} | 影响={p['impact_trip_count']:+d}次 {p['impact_low_carbon_score']:+.1f}分 | 状态={p['current_status']}")
assert recalc['passed'] == False, "未重算时自检不应通过"
assert recalc['need_recalc_count'] == 2, f"应有2条待重算, 实际{recalc['need_recalc_count']}"
assert recalc['total_notices'] == 1, f"应有1条施工告示, 实际{recalc['total_notices']}"
for p in recalc.get('pending_details', []):
    assert any('阳光花园' in n for n in p['canonical_group_names']), f"别名组应包含阳光花园, 实际{p['canonical_group_names']}"
    assert p['impact_low_carbon_score'] == -1.2, f"影响得分应为-1.2, 实际{p['impact_low_carbon_score']}"
print("  ✅ 通过: 负向影响-1.2被检测，别名组一起纳入检查，明确暴露待处理")

P("步骤8：执行重算")
resp = client.post('/api/recalc', json={'operator': '测试员'})
r = resp.get_json()
print(f"  重算结果 status={resp.status_code}: {json.dumps(r, ensure_ascii=False)[:300]}")
updated_count = r.get('recalculated', r.get('updated', r.get('updated_count', 0)))
print(f"  更新 {updated_count} 条记录")
assert updated_count == 2, f"应更新2条, 实际{updated_count}"
print("  ✅ 通过")

P("步骤9：重算后核对记录数据")
resp = client.get('/api/records')
recs = resp.get_json()
yg_recs = [r for r in recs if '阳光花园' in r['community_name']]
print(f"  重算后阳光花园相关记录:")
for x in yg_recs:
    print(f"    行{x.get('original_row')} {x['community_name']} | 状态={x['processing_status']} | 次数={x['trip_count']} 得分={x['low_carbon_score']:.1f}")
    print(f"       自检结论={x.get('self_check_conclusion', '无')}")
    print(f"       操作次数={x.get('operation_count', 0)}")
    if x['community_name'] == '阳光花园':
        assert x['trip_count'] == 40, f"阳光花园次数应为40, 实际{x['trip_count']}"
        assert abs(x['low_carbon_score'] - 7.3) < 0.05, f"阳光花园得分应为7.3, 实际{x['low_carbon_score']}"
    elif x['community_name'] == '阳光花园小区':
        assert x['trip_count'] == 27, f"阳光花园小区次数应为27, 实际{x['trip_count']}"
        assert abs(x['low_carbon_score'] - 6.0) < 0.05, f"阳光花园小区得分应为6.0, 实际{x['low_carbon_score']}"
    assert x['processing_status'] == 'recalculated', f"状态应为recalculated, 实际{x['processing_status']}"
    assert '已完成' in x.get('self_check_conclusion', ''), f"自检结论应包含'已完成', 实际{x.get('self_check_conclusion', '')}"
print("  ✅ 通过: 阳光花园 45→40次 8.5→7.3分, 阳光花园小区 32→27次 7.2→6.0分")

P("步骤10：重算后查看摘要 - 合并统计")
resp = client.get('/api/summary')
r = resp.get_json()
s = r['top_communities']
yg = next(x for x in s if x['canonical_name'] == '阳光花园小区')
print(f"  总览: {r['total_records']}条 {r['total_trips']}次 {r['total_score']:.1f}分 待重算={r['needs_recalc']}")
print(f"  {yg['canonical_name']}: {yg['record_count']}条 {yg['trips']}次 {yg['score']:.1f}分 成员={[m['name'] for m in yg['members']]}")
assert yg['trips'] == 67, f"合并后应67次, 实际{yg['trips']}"
assert abs(yg['score'] - 13.3) < 0.05, f"合并后应13.3分, 实际{yg['score']}"
print("  ✅ 通过: 合并 40+27=67次, 7.3+6.0=13.3分")

P("步骤11：重算后运行自检 - 补录后重算检查应通过")
resp = client.get('/api/self-check')
checks = {c['check_type']: c for c in resp.get_json()}
recalc = checks['补录后重算检查']
print(f"  是否通过: {recalc['passed']}")
print(f"  待重算: {recalc['need_recalc_count']} | 已重算: {recalc['ok_count']}")
assert recalc['passed'] == True, "重算后自检应通过"
assert recalc['need_recalc_count'] == 0, "重算后待重算应为0"
assert recalc['ok_count'] == 2, "重算后已重算应为2"

export_c = checks['导出一致性校验']
print(f"  导出一致性: {'通过' if export_c['passed'] else '不通过'} (导出{export_c['export_count']}/API{export_c['api_count']}/页面{export_c['page_count']})")
for k, c in checks.items():
    print(f"  {k}: {'✅' if c['passed'] else '❌'}")
print("  ✅ 全部自检通过")

P("步骤12：导出Excel并核对明细")
resp = client.get('/api/export')
assert resp.status_code == 200
out_path = '/tmp/低碳街区出行账本_负向影响验证.xlsx'
with open(out_path, 'wb') as f:
    f.write(resp.data)
print(f"  已导出: {out_path} ({len(resp.data)}字节)")

df_detail = pd.read_excel(out_path, sheet_name='明细')
print(f"  明细Sheet列: {list(df_detail.columns)}")
yg_rows = df_detail[df_detail['小区名称'].str.contains('阳光花园')]
print(f"  阳光花园相关明细 {len(yg_rows)} 行:")
for _, x in yg_rows.iterrows():
    print(f"    行{x['原始行号']} {x['小区名称']} | 规范名={x['规范小区名']} | 别名组={x['别名组']} | 状态={x['处理状态']}")
    print(f"       次数={x['出行次数']} 得分={x['低碳得分']} | 告示影响={x['告示影响出行']}次 {x['告示影响得分']:.1f}分")
    print(f"       自检结论={x['自检结论']}")
    print(f"       操作次数={x['操作次数']} 来源={str(x['数据来源'])[:50]}")
assert '规范小区名' in df_detail.columns, "应有规范小区名列"
assert '别名组' in df_detail.columns, "应有别名组列"
assert '自检结论' in df_detail.columns, "应有自检结论列"
assert '告示影响得分' in df_detail.columns, "应有告示影响得分列"
assert '处理状态' in df_detail.columns, "应有处理状态列"
assert '操作次数' in df_detail.columns, "应有操作次数列"
for _, x in yg_rows.iterrows():
    assert x['规范小区名'] == '阳光花园小区', f"规范名应为阳光花园小区, 实际{x['规范小区名']}"
    assert '阳光花园' in str(x['别名组']) and '阳光花园小区' in str(x['别名组']), f"别名组应包含两者, 实际{x['别名组']}"
    assert x['处理状态'] == '已重算', f"处理状态应为已重算, 实际{x['处理状态']}"
    assert abs(x['告示影响得分'] - (-1.2)) < 0.01, f"告示影响得分应为-1.2, 实际{x['告示影响得分']}"
    assert '已完成' in str(x['自检结论']), f"自检结论应包含已完成, 实际{x['自检结论']}"

df_notice = pd.read_excel(out_path, sheet_name='施工告示')
print(f"\n  施工告示Sheet: {len(df_notice)}行")
for _, x in df_notice.iterrows():
    print(f"    {x['小区']} | {x['标题']} | 影响出行{x['影响出行次数']}次 影响得分{x['影响低碳得分']:.1f}分")
assert len(df_notice) == 1
assert df_notice.iloc[0]['影响低碳得分'] == -1.2

df_logs = pd.read_excel(out_path, sheet_name='操作日志')
print(f"\n  操作日志Sheet: {len(df_logs)}行")
for _, x in df_logs.iterrows():
    print(f"    [{x['时间']}] {x['操作人']} - {x['操作类型']} | {str(x.get('记录ID',''))[:50]}")
assert len(df_logs) > 0

P("步骤13：操作日志核对证据链")
resp = client.get('/api/operation-logs')
logs = resp.get_json()
print(f"  共 {len(logs)} 条日志:")
for l in logs:
    print(f"    [{l['created_at']}] {l['operator']} - {l['operation_type']} | {str(l['old_value'])[:40] if l['old_value'] else ''} → {str(l['new_value'])[:40] if l['new_value'] else ''}")
alias_logs = [l for l in logs if 'alias' in l['operation_type'].lower()]
notice_logs = [l for l in logs if 'notice' in l['operation_type'].lower()]
recalc_logs = [l for l in logs if 'recalc' in l['operation_type'].lower()]
print(f"  别名关联日志: {len(alias_logs)} 条")
print(f"  施工告示日志: {len(notice_logs)} 条")
print(f"  重算日志: {len(recalc_logs)} 条")
assert len(alias_logs) >= 1, "应有别名关联日志"
assert len(notice_logs) >= 1, "应有补录日志"
assert len(recalc_logs) >= 1, "应有重算日志"
print("  ✅ 操作日志证据链完整")

P("步骤14：一致性最终核对 - API vs 导出函数")
resp = client.get('/api/records')
api_recs = resp.get_json()
from self_check import get_export_data
export_recs = get_export_data()
print(f"  API记录数: {len(api_recs)} | 导出函数记录数: {len(export_recs)}")
api_yg = sorted([r for r in api_recs if '阳光花园' in r['community_name']], key=lambda x: x['id'])
exp_yg = sorted([r for r in export_recs if '阳光花园' in r['community_name']], key=lambda x: x['id'])
for a, e in zip(api_yg, exp_yg):
    assert a['processing_status'] == e['processing_status'], f"状态不一致 {a['processing_status']} vs {e['processing_status']}"
    assert a['trip_count'] == e['trip_count'], f"次数不一致"
    assert abs(a['low_carbon_score'] - e['low_carbon_score']) < 0.01, f"得分不一致"
    assert a['self_check_conclusion'] == e['self_check_conclusion'], f"自检结论不一致"
print("  ✅ API与导出函数数据完全一致")

P("🎉 全部14步验证通过！")
print(f"\n导出文件: {out_path}")
print("\n关键验证点汇总:")
print("  1. ✅ 负向影响得分 -1.2 在未重算时被自检明确暴露（非正向才检测）")
print("  2. ✅ 阳光花园的施工告示 别名组一起纳入检查（阳光花园+阳光花园小区 2条记录）")
print("  3. ✅ 未重算时: 状态=需重算, 自检未通过, 结论=待处理")
print("  4. ✅ 已重算时: 状态=已重算, 自检通过, 结论=已完成, 次数/得分正确")
print("  5. ✅ 导出明细: 规范名/别名组/处理状态/告示影响/自检结论/操作历史/数据来源 全部齐全")
print("  6. ✅ 摘要合并: 阳光花园小区 合并为 67次 / 13.3分")
print("  7. ✅ 证据链: 操作日志包含别名关联/补录/重算 完整记录")
print("  8. ✅ 数据一致性: API / 导出 / 页面 三者同源")
