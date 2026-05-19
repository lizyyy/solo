from datetime import date, timedelta
import json

today = date.today()

# 更新 normal_data.json
with open('samples/normal_data.json', 'r') as f:
    data = json.load(f)

for secret in data['secrets']:
    if secret['secret_id'] == 'SEC001':
        secret['expire_date'] = str(today + timedelta(days=2))
    elif secret['secret_id'] == 'SEC002':
        secret['expire_date'] = str(today + timedelta(days=5))
    elif secret['secret_id'] == 'SEC003':
        secret['expire_date'] = str(today + timedelta(days=60))

with open('samples/normal_data.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('Updated normal_data.json')

# 更新 dirty_data.json
with open('samples/dirty_data.json', 'r') as f:
    data = json.load(f)

for secret in data['secrets']:
    if secret['secret_id'] == 'DIRTY001':
        secret['expire_date'] = str(today - timedelta(days=5))
    elif secret['secret_id'] == 'DIRTY002':
        secret['expire_date'] = str(today + timedelta(days=1))
    elif secret['secret_id'] == 'DIRTY003':
        secret['expire_date'] = str(today + timedelta(days=3))

with open('samples/dirty_data.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('Updated dirty_data.json')
