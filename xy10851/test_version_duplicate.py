import requests
import json

BASE = "http://localhost:8000/api"

print("=" * 70)
print("测试: 版本冲突 vs 重复同步 的区分")
print("=" * 70)

# 1. 重置数据
requests.post(f"{BASE}/sample-data")
print("\n[步骤 1] 重置样例数据完成")

# 2. 获取已同步的草稿 (v2, status=synced)
drafts = requests.get(f"{BASE}/drafts").json()
synced_draft = [d for d in drafts if d['status'] == 'synced' and d['version'] == 2][0]
devices = requests.get(f"{BASE}/devices").json()
device_id = devices[0]['id']

print(f"\n[步骤 2] 获取已同步草稿:")
print(f"  草稿 ID: {synced_draft['id']}")
print(f"  版本: v{synced_draft['version']}")
print(f"  状态: {synced_draft['status']}")
print(f"  form_data: {json.dumps(synced_draft['form_data'], ensure_ascii=False)}")
print(f"  sync_batch_id: {synced_draft['sync_batch_id']}")

# 3. 尝试同步同 ID 但版本更低的脏数据 (v1)
print(f"\n[步骤 3] 尝试同步同 ID 但版本更低的脏数据...")
print(f"  客户端版本: v1 (低于服务器 v2)")
print(f"  客户端数据: {{'检查地点': 'B车间', '检查人': '王五', '安全评分': 70, '备注': '客户端离线修改'}}")

result = requests.post(f"{BASE}/sync", json={
    "device_id": device_id,
    "drafts": [{
        "id": synced_draft['id'],  # 使用相同 ID
        "form_type": "安全检查",
        "form_data": {"检查地点": "B车间", "检查人": "王五", "安全评分": 70, "备注": "客户端离线修改"},
        "device_id": device_id,
        "version": 1,  # 版本更低！
        "created_by": "王五"
    }]
}).json()

print(f"\n[步骤 4] 同步结果:")
print(f"  批次状态: {result['status']}")
print(f"  success_count: {result['success_count']}")
print(f"  conflict_count: {result['conflict_count']}")
print(f"  processed_drafts: {json.dumps(result['processed_drafts'], ensure_ascii=False)}")

# 5. 检查是否产生冲突
conflicts = requests.get(f"{BASE}/conflicts").json()
new_conflicts = [c for c in conflicts if c['batch_id'] == result['batch_id']]
print(f"\n[步骤 5] 冲突检查:")
print(f"  本次同步产生的冲突数: {len(new_conflicts)}")
for c in new_conflicts:
    print(f"    - {c['field_name']}: server={c['server_value']}, client={c['client_value']}")

# 6. 验证结果
print(f"\n" + "=" * 70)
if result['status'] == 'has_conflicts' and result['conflict_count'] > 0 and len(new_conflicts) > 0:
    print("✓ 测试通过! 版本冲突被正确检测，没有被误判为重复同步")
elif result['status'] == 'completed' and result['conflict_count'] == 0:
    if any(d['status'] == 'duplicate' for d in result['processed_drafts']):
        print("✗ 测试失败! 真实版本冲突被误判为重复同步，冲突被吞掉了！")
    else:
        print("✗ 测试失败! 状态变为 completed 但应该检测到冲突")
else:
    print("✗ 测试失败! 状态不正确")
print("=" * 70)
