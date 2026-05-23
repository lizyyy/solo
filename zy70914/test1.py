import sys
sys.path.insert(0, '.')
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print('=== 1. 数据导入测试 ===')
with open('sample_data/claims.csv', 'rb') as f:
    resp = client.post('/api/import/claims/csv', files={'file': ('claims.csv', f, 'text/csv')})
print(f'claims.csv: {resp.status_code}')
print(f'  result: {resp.json()}')

with open('sample_data/flights.json', 'rb') as f:
    resp = client.post('/api/import/flights/json', files={'file': ('flights.json', f, 'application/json')})
print(f'flights.json: {resp.status_code}')
print(f'  result: {resp.json()}')

with open('sample_data/photos.json', 'rb') as f:
    resp = client.post('/api/import/photos', files={'file': ('photos.json', f, 'application/json')})
print(f'photos.json: {resp.status_code}')
print(f'  result: {resp.json()}')
