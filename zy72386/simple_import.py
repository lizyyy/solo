import requests
import base64

BASE = 'http://localhost:3001/api'

with open('sample/first_import.csv', 'rb') as f:
    content = f.read()
    b64 = base64.b64encode(content).decode()

r = requests.post(f'{BASE}/import', json={
    'fileName': 'first_import.csv',
    'fileContent': b64,
    'batchLabel': '1号仓首次导入',
    'operator': '设备工程师何工'
})
data = r.json()
import_id1 = data['data']['importId']
print(f'第一次导入: {import_id1}, {data["data"]["totalRows"]}条')

with open('sample/second_import_after_restart.csv', 'rb') as f:
    content = f.read()
    b64 = base64.b64encode(content).decode()

r = requests.post(f'{BASE}/import', json={
    'fileName': 'second_import_after_restart.csv',
    'fileContent': b64,
    'batchLabel': '维修群截图后补录',
    'operator': '设备工程师何工'
})
data = r.json()
import_id2 = data['data']['importId']
print(f'第二次导入: {import_id2}, {data["data"]["totalRows"]}条, {data["data"]["anomalyCount"]}异常')

r = requests.get(f'{BASE}/review/batch/{import_id2}')
data = r.json()
print()
print('第二次导入记录详情:')
for rec in data['data']['records']:
    print(f'  行{rec["original_row_number"]}: {rec["sensor_id"]:10s} 来源={rec["record_source"]:12s} 状态={rec["status"]:20s} 步骤={rec["current_step"]}')

print()
print('传感器变更:')
for c in data['data']['sensorChanges']:
    print(f'  {c["old_sensor_id"]} → {c["new_sensor_id"]}: {c["status"]} (卡在步骤{c["stuck_at_step"]})')

print()
print(f'请在浏览器打开: http://localhost:5173/review?importId={import_id2}')
