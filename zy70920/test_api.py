import urllib.request
import json

BASE_URL = 'http://localhost:3000/api'

def api_get(url):
    try:
        with urllib.request.urlopen(BASE_URL + url) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {'error': str(e)}

def api_post(url, data):
    try:
        req = urllib.request.Request(BASE_URL + url,
            data=json.dumps(data).encode(),
            headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {'error': str(e)}

print("=== 1. Health Check ===")
print(api_get('/health'))

print("\n=== 2. Create Batch ===")
batch = api_post('/batches', {
    'batchNo': 'BATCH-TEST-001',
    'sender': 'Green Farm',
    'receiveDate': '2026-05-24',
    'handler': 'admin',
    'remark': '农产品检测批次'
})
print(batch)
batch_id = batch.get('data', {}).get('id', 1)

print("\n=== 3. Import Recheck Rules (验证复检规则表) ===")
rules = api_post('/import/recheck-rules', [
    {'ruleCode': 'R001', 'ruleName': '超标复检', 'condition': '检测值超过限值', 
     'action': '重新送样复检', 'windowDays': 7, 'description': '超标时触发复检'}
])
print(rules)

print("\n=== 4. Import Test Items ===")
items = api_post('/import/test-items', [
    {'itemCode': 'P001', 'itemName': '有机磷农药残留', 'itemPackage': '农残套餐A', 
     'standard': 'GB 2763-2021', 'method': 'GC-MS'}
])
print(items)

print("\n=== 5. Mark Sample Mixed (验证混批) ===")
mixed = api_post(f'/samples/1/mixed', {
    'handler': 'tester',
    'reason': '样品外观与其他批次相似，疑似混批',
    'relatedSamples': 'S002, S003'
})
print(mixed)

print("\n=== 6. Withdraw Report (验证报告撤回) ===")
withdraw = api_post(f'/samples/2/withdraw', {
    'handler': 'tester',
    'reason': '检测数据录入错误，需要撤回重检'
})
print(withdraw)

print("\n=== 7. Export Samples (验证 mixed_note 字段) ===")
export = api_get('/export/samples')
if 'count' in export:
    print(f"Export count: {export['count']}")
    if export['data'] and len(export['data']) > 0:
        sample = export['data'][0]
        print(f"Sample 1 has mixed_note: {'mixed_note' in sample}")
        print(f"Sample keys: {list(sample.keys())[:10]}")
else:
    print(f"Export result: {export}")

print("\n=== 8. Get Operation Logs ===")
logs = api_get('/export/logs')
if 'count' in logs:
    print(f"Total logs: {logs['count']}")
else:
    print(f"Logs result: {logs}")

print("\n=== All tests completed ===")
