import requests
import json

BASE = "http://localhost:8000/api"

print("=" * 60)
print("测试: server_wins 策略持久化验证")
print("=" * 60)

# 1. 重置样例数据
print("\n1. 重置样例数据...")
requests.post(f"{BASE}/sample-data")

# 2. 获取服务器版本的草稿（高版本）
drafts = requests.get(f"{BASE}/drafts").json()
server_draft = [d for d in drafts if d['version'] == 2][0]
print(f"\n2. 服务器版本草稿 (v{server_draft['version']}):")
print(f"   ID: {server_draft['id']}")
print(f"   form_data: {json.dumps(server_draft['form_data'], ensure_ascii=False)}")

# 3. 获取低版本有冲突的草稿
conflict_draft = [d for d in drafts if d['status'] == 'conflict'][0]
conflicts = requests.get(f"{BASE}/conflicts").json()
draft_conflicts = [c for c in conflicts if c['draft_id'] == conflict_draft['id'] and not c['resolved']]

print(f"\n3. 冲突草稿 (v{conflict_draft['version']}):")
print(f"   ID: {conflict_draft['id']}")
print(f"   status: {conflict_draft['status']}")
print(f"   form_data: {json.dumps(conflict_draft['form_data'], ensure_ascii=False)}")
print(f"   冲突数: {len(draft_conflicts)}")

# 4. 使用 server_wins 策略解决冲突
print(f"\n4. 使用 server_wins 策略解决冲突...")
server_values = {}
for conflict in draft_conflicts:
    field = conflict['field_name']
    server_values[field] = conflict['server_value']
    print(f"   - {field}: server_value={conflict['server_value']}")
    
    requests.post(f"{BASE}/conflicts/resolve", json={
        "conflict_id": conflict['id'],
        "resolution": "server_wins",
        "resolved_by": "test_user"
    }).json()

# 5. 验证
draft_after = requests.get(f"{BASE}/drafts/{conflict_draft['id']}").json()
print(f"\n5. 解决后验证:")
print(f"   status: {draft_after['status']}")
print(f"   version: {draft_after['version']}")
print(f"   form_data: {json.dumps(draft_after['form_data'], ensure_ascii=False)}")

all_pass = True
for field, expected in server_values.items():
    actual = draft_after['form_data'].get(field)
    passed = actual == expected
    all_pass = all_pass and passed
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"\n   {status} 字段 '{field}':")
    print(f"      expected={expected}, actual={actual}")

print(f"\n" + "=" * 60)
if all_pass and draft_after['status'] == 'synced' and draft_after['version'] == 2:
    print("✓ 所有测试通过!")
    print("  - JSON 字段修改已正确持久化")
    print("  - 所有冲突解决后草稿状态已变为 'synced'")
    print("  - 所有冲突解决后草稿版本号正确递增")
else:
    print("✗ 测试失败!")
print("=" * 60)
