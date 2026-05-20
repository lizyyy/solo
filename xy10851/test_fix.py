import requests
import json

BASE = "http://localhost:8000/api"

print("=" * 60)
print("测试: 冲突解决后数据持久化验证")
print("=" * 60)

# 1. 重置样例数据
print("\n1. 重置样例数据...")
requests.post(f"{BASE}/sample-data")

# 2. 获取第一个冲突草稿
conflicts = requests.get(f"{BASE}/conflicts").json()
unresolved = [c for c in conflicts if not c['resolved']]
print(f"\n2. 找到 {len(unresolved)} 个未解决的冲突")

if unresolved:
    # 选择第一个草稿的所有冲突
    draft_id = unresolved[0]['draft_id']
    draft_conflicts = [c for c in unresolved if c['draft_id'] == draft_id]
    print(f"   草稿 ID: {draft_id}")
    print(f"   该草稿的冲突数: {len(draft_conflicts)}")

    # 3. 获取解决前的草稿状态
    draft_before = requests.get(f"{BASE}/drafts/{draft_id}").json()
    print(f"\n3. 解决前草稿状态:")
    print(f"   status: {draft_before['status']}")
    print(f"   version: {draft_before['version']}")
    print(f"   form_data: {json.dumps(draft_before['form_data'], ensure_ascii=False)}")

    # 4. 解决所有冲突（使用 client_wins）
    print(f"\n4. 解决冲突 (策略: client_wins)...")
    client_values = {}
    for i, conflict in enumerate(draft_conflicts):
        field = conflict['field_name']
        client_values[field] = conflict['client_value']
        print(f"   {i+1}. 字段 {field}: client_value={conflict['client_value']}")
        
        result = requests.post(f"{BASE}/conflicts/resolve", json={
            "conflict_id": conflict['id'],
            "resolution": "client_wins",
            "resolved_by": "test_user"
        }).json()
        print(f"      结果: {result}")

    # 5. 获取解决后的草稿状态
    draft_after = requests.get(f"{BASE}/drafts/{draft_id}").json()
    print(f"\n5. 解决后草稿状态:")
    print(f"   status: {draft_after['status']}")
    print(f"   version: {draft_after['version']}")
    print(f"   form_data: {json.dumps(draft_after['form_data'], ensure_ascii=False)}")

    # 6. 验证
    print(f"\n6. 验证结果:")
    all_pass = True
    for field, expected in client_values.items():
        actual = draft_after['form_data'].get(field)
        passed = actual == expected
        all_pass = all_pass and passed
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"   {status} 字段 '{field}': expected={expected}, actual={actual}")

    print(f"\n" + "=" * 60)
    if all_pass:
        print("✓ 所有测试通过! JSON 字段修改已正确持久化")
    else:
        print("✗ 测试失败!")
    print("=" * 60)
else:
    print("没有找到未解决的冲突")
