import sys, os, json, traceback
sys.path.insert(0, os.path.dirname(__file__))
os.environ['FLASK_ENV'] = 'production'

import app as myapp
client = myapp.app.test_client()

def check(desc, r, expected_code=200):
    try:
        data = r.get_json()
        ok = r.status_code == expected_code and (data is None or data.get('ok', True))
        print(f"{'✓' if ok else '✗'} {desc}: HTTP{r.status_code} ok={data.get('ok') if data else '?'} msg={data.get('msg','') if data else ''} {'' if ok else json.dumps(data, ensure_ascii=False)[:200]}")
        return ok, data
    except Exception as e:
        print(f"✗ {desc}: Exception {e}")
        return False, None

print("=== 功能冒烟测试 ===")

# 1. 汇总 API
r = client.get('/api/summary')
check('获取汇总', r)

# 2. 记录列表
r = client.get('/api/records?page=1&size=10')
ok, data = check('获取记录列表', r)
init_count = data.get('total', 0) if ok else 0
print(f"  → 初始记录数: {init_count}")

# 3. 生成演示数据
r = client.post('/api/demo/generate', json={})
ok, data = check('生成演示数据', r)
demo_count = data.get('inserted', 0) if ok else 0
print(f"  → 插入演示记录: {demo_count} 条")

# 4. 再次查询列表
r = client.get('/api/records?page=1&size=20')
ok, data = check('查询演示后列表', r)
records = data.get('records', []) if ok else []
print(f"  → 当前总数: {data.get('total') if data else '?'} 条")

# 5. 临时调高 tab
r = client.get('/api/records?tab=temp')
ok, data = check('筛选临时调高记录', r)
print(f"  → 临时调高记录数: {data.get('total') if data else '?'} 条")

# 6. 取首条记录详情
if records:
    rid = records[0]['id']
    r = client.get(f'/api/records/{rid}')
    ok, data = check(f'获取记录 {rid} 详情(含溯源链)', r)
    if ok:
        tr = data['record'].get('traceability', {})
        print(f"  → 溯源点: {len(tr.get('summary_points',[]))} 条, 核心字段: {len(tr.get('core_fields',{}))} 个")
        vars_ = data['record'].get('device_variants', [])
        print(f"  → 设备编号历史写法: {[v['device_no_raw'] for v in vars_][:5]}")

    # 7. 更新记录状态
    r = client.put(f'/api/records/{rid}', json={'status': '处理中', 'remark': '冒烟测试已处理', 'operator': 'test'})
    check(f'更新记录 {rid} 状态', r)

    # 8. 保存快照
    r = client.put('/api/snapshot/test_page', json={'reviewer': '阿敏', 'current_record_id': rid, 'filters': {'tab':'all'}, 'active_tab': 'all', 'scroll_pos': 100})
    check('保存页面快照', r)

    # 9. 恢复快照
    r = client.get('/api/snapshot/test_page')
    check('恢复页面快照', r)

# 10. 导出摘要
r = client.post('/api/export/summary', json={})
print(f"{'✓' if r.status_code==200 else '✗'} 导出摘要CSV: HTTP{r.status_code} size={len(r.data)}B name={r.headers.get('Content-Disposition','')}")

# 11. 交接溯源
r = client.get('/api/handover/trace?device_no_raw=FD%23012')
ok, data = check('交接溯源(FD#012)', r)
if ok:
    print(f"  → 归一化后编号: {data.get('normalized_device_no')}, 命中记录: {len(data.get('traces',[]))} 条")
    if data.get('traces'):
        t = data['traces'][0]
        print(f"  → 原话字数: {len(t.get('original_words',''))}, 摘要点: {len(t.get('page_summary',[]))}")

# 12. 关键字搜索
r = client.get('/api/records?keyword=叶根')
ok, data = check('关键字搜索(叶根)', r)
print(f"  → 搜索结果数: {data.get('total') if data else '?'}")

print("\n=== 测试完成 ===")
print(f"数据库文件: {myapp.DB_PATH} ({os.path.getsize(myapp.DB_PATH)/1024:.1f}KB)")
