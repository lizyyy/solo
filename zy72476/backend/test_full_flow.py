#!/usr/bin/env python3
import requests
import json
import sys

API = 'http://localhost:5001/api'

NO_PROXY = {'http': None, 'https': None}

def step(msg):
    print(f'\n{"="*60}')
    print(f'  {msg}')
    print(f'{"="*60}')

def pprint(d, indent=2):
    print(json.dumps(d, ensure_ascii=False, indent=indent))

try:
    # Step 1: 导入巡查表
    step('第一步：导入网格员巡查表')
    with open('../samples/网格员巡查表样例.xlsx', 'rb') as f:
        r = requests.post(f'{API}/import', files={'file': f}, proxies=NO_PROXY)
    d = r.json()
    print(f'批次号: {d["batch_id"]}')
    print(f'总行数: {d["total_rows"]}')
    print(f'✅ 新记录: {d["new_count"]}')
    print(f'⚠️  历史重复: {d["history_duplicate_count"]}')
    print(f'⚠️  本次重复: {d["batch_duplicate_count"]}')
    print()
    print('新记录明细（原始行号 | 小区 | 出行次数 | 得分）:')
    for rec in d['new_records']:
        print(f'  行{rec["original_row"]:2d} | {rec["community_name"]:15s} | {rec["trip_count"]:3d}次 | {rec["low_carbon_score"]:.1f}分')

    # Step 2: 自检 - 看新旧名候选
    step('第二步：自检 - 识别新旧名候选')
    r = requests.get(f'{API}/self-check', proxies=NO_PROXY)
    results = r.json()
    for res in results:
        if res['check_type'] == '同一小区新旧名识别':
            print(f'候选数: {res["total_candidates"]}')
            print(f'已关联: {res["total_alias_pairs"]}对')
            if res['candidates']:
                print('推荐关联:')
                for c in res['candidates']:
                    print(f'  [{c["match_type"]}] {c["name_a"]} ↔ {c["name_b"]} ({c["record_count_a"]}条 ↔ {c["record_count_b"]}条)')

    # Step 3: 设置别名关联
    step('第三步：设置小区新旧名关联')
    # 先获取小区列表
    r = requests.get(f'{API}/communities', proxies=NO_PROXY)
    comms = {c['name']: c['id'] for c in r.json()}
    print('小区ID映射:', comms)
    
    aliases = [
        ('阳光花园', '阳光花园小区'),
        ('翠湖家园', '翠湖家园小区'),
        ('和平里', '和平里社区'),
    ]
    for from_name, to_name in aliases:
        fid = comms[from_name]
        tid = comms[to_name]
        r = requests.post(f'{API}/communities/{fid}/alias', 
                         json={'alias_id': tid, 'operator': '小付'}, proxies=NO_PROXY)
        print(f'✅ {from_name} → {to_name}: {r.json()["success"]}')

    # Step 4: 摘要 - 检查是否合并统计
    step('第四步：摘要 - 检查关联合并统计')
    r = requests.get(f'{API}/summary', proxies=NO_PROXY)
    d = r.json()
    print(f'总记录: {d["total_records"]}')
    print(f'总小区: {d["total_communities"]}')
    print(f'已复核: {d["reviewed_communities"]}')
    print()
    print('小区排名（合并后的统计）:')
    for i, c in enumerate(d['top_communities']):
        members = ','.join([m['name'] for m in c.get('members', [])])
        print(f'  {i+1}. {c["canonical_name"]:15s} | {c["record_count"]:2d}条 | {c["trips"]:3d}次 | {c["score"]:.1f}分 | 包含: {members}')

    # Step 5: 补录施工告示
    step('第五步：补录施工告示（小付）')
    yg_id = comms['阳光花园']
    r = requests.post(f'{API}/construction-notices', json={
        'community_id': yg_id,
        'community_name': '阳光花园',
        'notice_title': 'XX路管线改造施工',
        'notice_content': '小区正门步道临时封闭3天',
        'notice_date': '2024-06-03',
        'impact_trip_count': -5,
        'impact_low_carbon_score': -1.2,
        'operator': '小付'
    }, proxies=NO_PROXY)
    print(f'✅ 告示添加: {r.json()["success"]}')

    # 查看记录状态变化
    step('第六步：检查记录状态（应标记为需重算）')
    r = requests.get(f'{API}/records', params={'community_id': yg_id}, proxies=NO_PROXY)
    recs = r.json()
    for rec in recs:
        print(f'  行{rec["original_row"]:2d} | {rec["community_name"]:15s} | 状态: {rec["processing_status_text"]:6s} | 次数:{rec["trip_count"]:3d} | 得分:{rec["low_carbon_score"]:.1f}')
        if rec.get('conclusion'):
            print(f'      结论: {rec["conclusion"]}')

    # Step 6: 执行重算
    step('第七步：执行重算')
    r = requests.post(f'{API}/recalc', json={'operator': '小付'}, proxies=NO_PROXY)
    print(f'✅ 重算记录: {r.json()["recalculated"]}条')

    # Step 7: 重算后检查
    step('第八步：重算后检查')
    r = requests.get(f'{API}/records', params={'community_id': yg_id}, proxies=NO_PROXY)
    recs = r.json()
    for rec in recs:
        print(f'  行{rec["original_row"]:2d} | {rec["community_name"]:15s} | 规范名: {rec["canonical_community_name"]:15s} | 状态: {rec["processing_status_text"]:6s} | 次数:{rec["trip_count"]:3d} | 得分:{rec["low_carbon_score"]:.1f}')
        if rec.get('conclusion'):
            print(f'      结论: {rec["conclusion"][:60]}...')

    # Step 8: 最终摘要
    step('第九步：最终摘要')
    r = requests.get(f'{API}/summary', proxies=NO_PROXY)
    d = r.json()
    print(f'总出行: {d["total_trips"]}次')
    print(f'总得分: {d["total_score"]:.1f}')
    print(f'待重算: {d["needs_recalc"]}条')
    print()
    print('小区排名（合并后）:')
    for i, c in enumerate(d['top_communities']):
        members = ','.join([m['name'] for m in c.get('members', [])])
        print(f'  {i+1}. {c["canonical_name"]:15s} | {c["trips"]:3d}次 | {c["score"]:.1f}分 | 含: {members}')

    # Step 9: 自检
    step('第十步：运行自检')
    r = requests.get(f'{API}/self-check', proxies=NO_PROXY)
    results = r.json()
    all_pass = True
    for res in results:
        status = '✅ 通过' if res['passed'] else '❌ 失败'
        print(f'  {res["check_type"]}: {status}')
        if not res['passed']:
            all_pass = False
            print(f'    详情: {json.dumps(res, ensure_ascii=False)[:100]}...')

    # Step 10: 导出
    step('第十一步：导出Excel')
    r = requests.get(f'{API}/export', proxies=NO_PROXY)
    print(f'导出状态: {r.status_code}')
    print(f'文件大小: {len(r.content)}字节')
    with open('/tmp/低碳街区出行账本_测试导出.xlsx', 'wb') as f:
        f.write(r.content)
    print(f'已保存到: /tmp/低碳街区出行账本_测试导出.xlsx')

    # Step 11: 检查导出数据和API数据一致性
    step('第十二步：数据一致性核对（阳光花园重点）')
    r = requests.get(f'{API}/records', proxies=NO_PROXY)
    all_recs = r.json()
    
    print()
    print('【重点核对：阳光花园/阳光花园小区】')
    yg_recs = [r for r in all_recs if '阳光花园' in r['community_name']]
    for rec in yg_recs:
        merged = '✅ 已合并' if rec['is_alias_merged'] else '❌ 未合并'
        print(f'  原始行{rec["original_row"]:2d}: {rec["community_name"]:15s} → 规范名:{rec["canonical_community_name"]:15s} {merged}')
        print(f'    来源: {rec["data_source"][:50]}...')
        print(f'    结论: {rec["conclusion"][:60]}...')

    print()
    print('【导出明细抽样】')
    print(f'  总记录数: {len(all_recs)}')
    print(f'  字段列表: {list(all_recs[0].keys())[:10]}...')
    
    print()
    print(f'{"="*60}')
    print(f'  ✅ 全流程测试完成！')
    print(f'{"="*60}')

except Exception as e:
    print(f'❌ 错误: {e}')
    import traceback
    traceback.print_exc()
    sys.exit(1)
