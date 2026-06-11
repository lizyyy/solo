#!/usr/bin/env python3
import urllib.request
import urllib.parse
import json
import os

BASE_URL = 'http://localhost:3001/api'

def api_get(path):
    req = urllib.request.Request(f'{BASE_URL}{path}')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def api_post(path, data=None, files=None):
    if files:
        boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
        body = b''
        for key, value in data.items():
            body += f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode()
        for key, filepath in files.items():
            filename = os.path.basename(filepath)
            with open(filepath, 'rb') as f:
                file_content = f.read()
            body += f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"; filename="{filename}"\r\nContent-Type: text/csv\r\n\r\n'.encode()
            body += file_content + b'\r\n'
        body += f'--{boundary}--\r\n'.encode()
        req = urllib.request.Request(f'{BASE_URL}{path}', data=body, method='POST')
        req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    else:
        req = urllib.request.Request(f'{BASE_URL}{path}', data=json.dumps(data).encode(), method='POST')
        req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def api_put(path, data):
    req = urllib.request.Request(f'{BASE_URL}{path}', data=json.dumps(data).encode(), method='PUT')
    req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

print('=' * 70)
print('粮仓通风阻力复盘 - 完整流程测试')
print('=' * 70)

# 第一步：第一次导入
print('\n📌 第一步：设备铭牌参数第一次导入')
print('-' * 50)
result = api_post('/import/upload',
    data={'batch_label': '1号仓首次导入', 'operator': '设备工程师何工'},
    files={'file': 'sample/first_import.csv'})
first_id = result['data']['importId']
print(f'✅ 导入成功: {result["data"]["totalRows"]} 条记录')
print(f'   importId: {first_id}')

batch = api_get(f'/review/batch/{first_id}')['data']
print('\n第一次导入记录详情:')
for r in batch['records']:
    source_label = {'new': '🆕 新增', 'reused': '♻️ 复用', 'id_changed': '🔄 编号变更'}.get(r['record_source'], r['record_source'])
    print(f'  行{r["original_row_number"]}: {r["sensor_id"]:10s} {source_label:10s} 状态: {r["status"]:15s} 步骤: {r["current_step"]}')

# 第二步：第二次导入
print('\n📌 第二步：维修群截图补看（模拟传感器重启后编号变更）')
print('-' * 50)
result = api_post('/import/upload',
    data={'batch_label': '维修群截图后补录', 'operator': '设备工程师何工'},
    files={'file': 'sample/second_import_after_restart.csv'})
second_id = result['data']['importId']
print(f'✅ 导入成功: {result["data"]["totalRows"]} 条记录, {result["data"]["anomalies"]} 条异常')
print(f'   importId: {second_id}')

batch = api_get(f'/review/batch/{second_id}')['data']
print('\n第二次导入记录详情:')
for r in batch['records']:
    source_label = {'new': '🆕 新增', 'reused': '♻️ 复用', 'id_changed': '🔄 编号变更'}.get(r['record_source'], r['record_source'])
    prev = f'(原:{r["previous_sensor_id"]})' if r['previous_sensor_id'] else ''
    print(f'  行{r["original_row_number"]}: {r["sensor_id"]:10s} {prev:12s} {source_label:10s} 状态: {r["status"]:20s} 步骤: {r["current_step"]}')

print('\n🔄 传感器变更记录:')
for c in batch['sensorChanges']:
    print(f'  {c["old_sensor_id"]} → {c["new_sensor_id"]}')
    print(f'    状态: {c["status"]} | 卡在步骤: {c["stuck_at_step"]}')
    print(f'    change_id: {c["id"]}')

change_id = batch['sensorChanges'][0]['id']
record_id = batch['sensorChanges'][0]['record_id']

# 第三步：运行自检
print('\n📌 第三步：运行四项自检')
print('-' * 50)
checks = api_get(f'/selfcheck/run/{second_id}')['data']
for c in checks:
    icon = {'pass': '✅', 'warning': '⚠️', 'fail': '❌'}.get(c['status'], '?')
    print(f'  {icon} {c["check_type"]}: {c["status"]} - {c["message"]}')

# 第四步：安全员复核
print('\n📌 第四步：安全员复核 - 确认 S-002 → S-002-B 变更')
print('-' * 50)
result = api_put(f'/review/sensor-change/{change_id}/confirm', {
    'action': 'confirm',
    'reviewed_by': '安全员王工',
    'note': '经核实确为传感器重启后编号变更，予以确认'
})
print(f'✅ 确认成功: {result["data"]["status"]}')

batch = api_get(f'/review/batch/{second_id}')['data']
print('\n确认后记录状态:')
for r in batch['records']:
    if r['sensor_id'] == 'S-002-B':
        print(f'  {r["sensor_id"]}: 状态 = {r["status"]}, 步骤 = {r["current_step"]}')
        break

for c in batch['sensorChanges']:
    if c['new_sensor_id'] == 'S-002-B':
        print(f'  变更记录: 状态 = {c["status"]}, 复核人 = {c["reviewed_by"]}')
        break

# 第五步：审计追踪
print('\n📌 第五步：审计追踪')
print('-' * 50)
audit = api_get(f'/audit/batch/{second_id}')['data']
print(f'共 {len(audit)} 条审计记录:')
for e in audit:
    field = f' [{e["field"]}]' if e['field'] else ''
    change = ''
    if e['old_value'] and e['new_value']:
        change = f' {e["old_value"]} → {e["new_value"]}'
    print(f'  {e["timestamp"]} | {e["operator"] or "系统":6s} | {e["action"]:25s}{field}{change}')

# 第六步：导出与一致性校验
print('\n📌 第六步：导出与一致性校验')
print('-' * 50)
verify = api_get(f'/export/verify/{second_id}')['data']
print(f'  数据哈希: {verify["dataHash"]}')
print(f'  CSV哈希:  {verify["csvHash"]}')
print(f'  一致性:  {"✅ 通过" if verify["consistent"] else "❌ 不一致"}')
print(f'  记录数:  {verify["recordCount"]}')

# 导出CSV并验证内容
print('\n📌 第七步：导出CSV内容验证')
print('-' * 50)
req = urllib.request.Request(f'{BASE_URL}/export/{second_id}')
with urllib.request.urlopen(req) as resp:
    csv_content = resp.read().decode('utf-8-sig')
    lines = csv_content.strip().split('\n')
    print(f'  CSV共 {len(lines)-1} 条数据')
    print(f'  表头: {lines[0]}')
    for i, line in enumerate(lines[1:], 1):
        cols = line.split(',')
        sensor_id = cols[1].strip('"')
        status = cols[3].strip('"')
        step = cols[4].strip('"')
        prev = cols[2].strip('"')
        prev_str = f'(原:{prev})' if prev else ''
        print(f'  行{i}: {sensor_id:10s} {prev_str:12s} 状态: {status:15s} 步骤: {step}')

print('\n' + '=' * 70)
print('✅ 完整流程测试通过！')
print('=' * 70)
