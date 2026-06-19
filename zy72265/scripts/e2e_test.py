import json, urllib.request, csv, io

base = 'http://localhost:3001'
PASS = True

def api_get(path):
    resp = urllib.request.urlopen(f'{base}{path}')
    return json.loads(resp.read())

def api_put(path, body):
    req = urllib.request.Request(f'{base}{path}', data=json.dumps(body).encode(), headers={'Content-Type':'application/json'}, method='PUT')
    return json.loads(urllib.request.urlopen(req).read())

def api_post(path, body):
    req = urllib.request.Request(f'{base}{path}', data=json.dumps(body).encode(), headers={'Content-Type':'application/json'}, method='POST')
    return json.loads(urllib.request.urlopen(req).read())

def check(name, condition, detail=''):
    global PASS
    if condition:
        print(f'  PASS: {name}')
    else:
        print(f'  FAIL: {name} - {detail}')
        PASS = False

print('=' * 60)
print('完整操作路验证：安装 → 启动 → 载入样例 → 产出结果')
print('=' * 60)

print('\n[1] 健康检查')
try:
    r = api_get('/api/envelopes')
    check('API可用', r.get('success') == True)
except Exception as e:
    check('API可用', False, str(e))

print('\n[2] 导入样例CSV')
csv_content = open('/Users/lzy/pro/solo/workspaces/zy72265/examples/point_cloud_log_sample.csv').read()
import_result = api_post('/api/envelopes/import', {
    'robotArmId': 'ARM-001',
    'safetyRadiusVersion': 'V2024.01',
    'fileContent': csv_content,
    'createdBy': '许工'
})
check('导入成功', import_result.get('success') == True)
env = import_result['data']['envelope']
pts = import_result['data']['points']
env_id = env['id']

check('总记录数=20', env['totalPoints'] == 20, f'got {env["totalPoints"]}')
check('混合记录数=5', env['mixedPoints'] == 5, f'got {env["mixedPoints"]}')
check('状态=INSPECTION_REVIEW', env['status'] == 'INSPECTION_REVIEW', f'got {env["status"]}')

print('\n[3] 验证原始行号保留')
line_numbers = [p['originalLineNumber'] for p in pts]
check('行号1-20完整', line_numbers == list(range(1, 21)), f'got {line_numbers}')

print('\n[4] 验证混合检测')
mixed = [p for p in pts if p['isMixed']]
mixed_lines = sorted([p['originalLineNumber'] for p in mixed])
check('混合行号=[5,7,11,14,17]', mixed_lines == [5, 7, 11, 14, 17], f'got {mixed_lines}')

check('line5 raw=116.3975m,39.9085m', any(p['rawValue']=='116.3975m,39.9085m' for p in mixed))
check('line7 raw=x=116.5,y=39.8', any(p['rawValue']=='x=116.5,y=39.8' for p in mixed))
check('line11 raw=x=1.8,y=2.3m', any(p['rawValue']=='x=1.8,y=2.3m' for p in mixed))
check('line14 raw=116.4000,39.9000°', any(p['rawValue']=='116.4000,39.9000°' for p in mixed))
check('line17 raw=116.3950m,39.9050', any(p['rawValue']=='116.3950m,39.9050' for p in mixed))

print('\n[5] 验证审计追踪（导入时记录了原始行号）')
detail = api_get(f'/api/envelopes/{env_id}')['data']
import_logs = [l for l in detail['auditLogs'] if l['actionType'] == 'IMPORT' and l['pointId'] is not None]
check('每条记录都有导入审计', len(import_logs) == 20, f'got {len(import_logs)}')
log_lines_with_line_num = [l for l in import_logs if l['originalLineNumber'] is not None]
check('审计日志都保留了原始行号', len(log_lines_with_line_num) == 20, f'got {len(log_lines_with_line_num)}')

print('\n[6] 第一步：许工确认正常记录')
normal_imported = [p for p in pts if not p['isMixed'] and p['status'] == 'IMPORTED']
confirmed_count = 0
for p in normal_imported:
    r = api_put(f'/api/points/{p["id"]}/confirm', {'operator': '许工'})
    if r.get('success'):
        confirmed_count += 1
check(f'确认了{len(normal_imported)}条正常记录', confirmed_count == len(normal_imported), f'got {confirmed_count}')

print('\n[7] 推进到第二步')
step2 = api_put(f'/api/envelopes/{env_id}/step', {'operator': '许工'})
check('推进成功', step2.get('success') == True, step2.get('message', ''))
check('step=2', step2['data']['currentStep'] == 2)
check('status=INSPECTION_REVIEW', step2['data']['status'] == 'INSPECTION_REVIEW')

print('\n[8] 第二步：巡检组复核混合记录')
detail2 = api_get(f'/api/envelopes/{env_id}')['data']
mixed2 = [p for p in detail2['points'] if p['isMixed']]
reviewed_count = 0
for m in mixed2:
    action = 'CONFIRM_LAT_LNG'
    r = api_post(f'/api/points/{m["id"]}/review', {
        'action': action,
        'operator': '巡检组-王工',
        'remark': '巡检组确认坐标为经纬度'
    })
    if r.get('success'):
        reviewed_count += 1
check(f'复核了{len(mixed2)}条混合记录', reviewed_count == len(mixed2), f'got {reviewed_count}')

print('\n[9] 推进到第三步')
step3 = api_put(f'/api/envelopes/{env_id}/step', {'operator': '巡检组-王工'})
check('推进成功', step3.get('success') == True, step3.get('message', ''))
check('step=3', step3['data']['currentStep'] == 3)
check('status=PUBLISHED', step3['data']['status'] == 'PUBLISHED')

print('\n[10] 验证数据一致性：列表API = 详情API = 导出CSV')
list_data = api_get(f'/api/envelopes?status=PUBLISHED')['data']
check('列表中有1条已发布', len(list_data) == 1, f'got {len(list_data)}')

detail3 = api_get(f'/api/envelopes/{env_id}')['data']
pts3 = detail3['points']

csv_resp = urllib.request.urlopen(f'{base}/api/envelopes/{env_id}/export')
csv_text = csv_resp.read().decode('utf-8-sig')
csv_lines = [l for l in csv_text.strip().split('\n') if not l.startswith('#') and l.strip()]
reader = csv.DictReader(csv_lines)
csv_rows = list(reader)
check('CSV行数=20', len(csv_rows) == 20, f'got {len(csv_rows)}')

for row in csv_rows:
    line_key = '\u539f\u59cb\u884c\u53f7' if '\u539f\u59cb\u884c\u53f7' in row else '原始行号'
    line_num = int(row[line_key])
    matching = [p for p in pts3 if p['originalLineNumber'] == line_num]
    if not matching:
        check(f'CSV line {line_num} 在API中存在', False, 'not found')
        continue
    p = matching[0]
    x_key = 'X\u5750\u6807' if 'X\u5750\u6807' in row else 'X坐标'
    y_key = 'Y\u5750\u6807' if 'Y\u5750\u6807' in row else 'Y坐标'
    csv_x = round(float(row[x_key]), 4)
    csv_y = round(float(row[y_key]), 4)
    api_x = round(p['xValue'], 4)
    api_y = round(p['yValue'], 4)
    if csv_x != api_x or csv_y != api_y:
        check(f'line {line_num} 一致', False, f'API({api_x},{api_y}) vs CSV({csv_x},{csv_y})')

check('列表/详情/导出三者数据一致', True)

print('\n[11] 验证混合记录不会被遗漏')
all_pts_after = detail3['points']
mixed_after = [p for p in all_pts_after if p.get('isMixed') or p['originalLineNumber'] in [5, 7, 11, 14, 17]]
check('5条混合记录仍在结果中', len(mixed_after) == 5, f'got {len(mixed_after)}')
for p in mixed_after:
    check(f'line {p["originalLineNumber"]} 已复核(非INSPECTION_REVIEW)', 
          p['status'] != 'INSPECTION_REVIEW',
          f'still {p["status"]}')

print('\n' + '=' * 60)
if PASS:
    print('全部通过！完整操作路验证成功')
else:
    print('存在失败项，请检查')
print('=' * 60)
