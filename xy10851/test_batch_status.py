import requests
import json

BASE = "http://localhost:8000/api"

print("=" * 60)
print("调试测试: 批次状态更新验证")
print("=" * 60)

# 重置数据
requests.post(f"{BASE}/sample-data")

# 获取数据
drafts = requests.get(f"{BASE}/drafts").json()
conflicts = requests.get(f"{BASE}/conflicts").json()
batches = requests.get(f"{BASE}/batches").json()

# 获取冲突草稿和相关冲突
conflict_draft = [d for d in drafts if d['status'] == 'conflict'][0]
draft_conflicts = [c for c in conflicts if c['draft_id'] == conflict_draft['id'] and not c['resolved']]

print(f"\n草稿 ID: {conflict_draft['id']}")
print(f"草稿 sync_batch_id: {conflict_draft['sync_batch_id']}")
print(f"冲突 1 batch_id: {draft_conflicts[0]['batch_id']}")
print(f"冲突 2 batch_id: {draft_conflicts[1]['batch_id']}")

print(f"\n批次列表:")
for b in batches:
    print(f"  {b['id']}: status={b['status']}, batch_number={b['batch_number']}")

# 解决所有冲突
print(f"\n解决冲突...")
for i, conflict in enumerate(draft_conflicts):
    print(f"  解决冲突 {i+1}: batch_id={conflict['batch_id']}")
    requests.post(f"{BASE}/conflicts/resolve", json={
        "conflict_id": conflict['id'],
        "resolution": "server_wins",
        "resolved_by": "test"
    }).json()

# 获取更新后的数据
print(f"\n解决后:")
batches2 = requests.get(f"{BASE}/batches").json()
for b in batches2:
    print(f"  {b['id']}: status={b['status']}")

# 特别检查冲突关联的批次
target_batch_id = draft_conflicts[0]['batch_id']
target_batch = [b for b in batches2 if b['id'] == target_batch_id][0]
print(f"\n冲突关联的批次 {target_batch_id}:")
print(f"  status: {target_batch['status']}")
print(f"  expected: completed")

if target_batch['status'] == 'completed':
    print("\n✓ 批次状态正确更新!")
else:
    print("\n✗ 批次状态未正确更新!")
