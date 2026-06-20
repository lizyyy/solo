import os, sys, json
DATA_DIR = '/Users/lzy/pro/solo/workspaces/zy72460/data'
db_path = os.path.join(DATA_DIR, 'rain_garden.db')
if os.path.exists(db_path): os.remove(db_path)
from database import init_db, engine, Base
Base.metadata.drop_all(bind=engine)
init_db()
from fastapi.testclient import TestClient
from api import app
client = TestClient(app)
print('1. 创建会话...')
r = client.post('/api/sessions', json={'session_id': 'AUTO-VERIFY-001'})
assert r.status_code == 200, r.text
d = r.json()
assert d['session_id'] == 'AUTO-VERIFY-001'
print('  ✓ ok')
print('2. 导入点位...')
POINTS = [{'point_id': 'P005', 'name': '徐家汇公园雨水花园', 'location': {'lat': 31.1987, 'lng': 121.4382, 'street': '徐家汇街道', 'is_boundary': False}}, {'point_id': 'P006', 'name': '衡山路雨水花园', 'location': {'lat': 31.2078, 'lng': 121.4375, 'street': '天平路街道', 'is_boundary': True, 'adjacent_streets': ['湖南路街道']}}]
r = client.post('/api/sessions/AUTO-VERIFY-001/points', json=POINTS)
assert r.status_code == 200, r.text
d = r.json()
assert d['imported'] == 2
print('  ✓ ok')
print('3. 第一次导入 R005/R006...')
RAMP = [{'record_id': 'R005', 'point_id': 'P005', 'inspector': '孙工', 'inspect_time': '2026-06-04T10:00:00', 'has_waterlogging': False, 'ramp_accessible': True, 'ramp_note': '正常'}, {'record_id': 'R006', 'point_id': 'P006', 'inspector': '孙工', 'inspect_time': '2026-06-04T11:00:00', 'has_waterlogging': False, 'ramp_accessible': True, 'ramp_note': '正常'}]
r = client.post('/api/sessions/AUTO-VERIFY-001/records?source=RAMP_SURVEY', json=RAMP, params={'actor': '小付'})
assert r.status_code == 200, r.text
d = r.json()
assert d['imported'] == 2
assert d['reused'] == 0
batch_id_1 = d['batch_id']
r005_detail = next(x for x in d['details'] if x['record_id'] == 'R005')
assert r005_detail['status'] == '真新增'
print('  ✓ ok, batch_id:', batch_id_1)
