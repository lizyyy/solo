import requests
import json

BASE = "http://localhost:8000/api"

print("=" * 70)
print("完整流程测试: 前端操作后后端真实状态变化")
print("=" * 70)

# 1. 重置数据
print("\n[步骤 1] 重置样例数据...")
requests.post(f"{BASE}/sample-data")

# 2. 初始状态检查
drafts = requests.get(f"{BASE}/drafts").json()
conflicts = requests.get(f"{BASE}/conflicts").json()
batches = requests.get(f"{BASE}/batches").json()

print("\n[步骤 2] 初始状态:")
print(f"   草稿总数: {len(drafts)}")
print(f"   冲突状态草稿: {len([d for d in drafts if d['status'] == 'conflict'])}")
print(f"   已同步草稿: {len([d for d in drafts if d['status'] == 'synced'])}")
print(f"   未解决冲突: {len([c for c in conflicts if not c['resolved']])}")
print(f"   有冲突的批次: {len([b for b in batches if b['status'] == 'has_conflicts'])}")

# 3. 获取待解决的冲突
unresolved_conflicts = [c for c in conflicts if not c['resolved']]
target_draft_id = unresolved_conflicts[0]['draft_id']
draft_conflicts = [c for c in unresolved_conflicts if c['draft_id'] == target_draft_id]

print(f"\n[步骤 3] 选择草稿 {target_draft_id[:8]}... 进行冲突解决")
print(f"   该草稿有 {len(draft_conflicts)} 个冲突待解决")

# 4. 解决第一个冲突 (client_wins)
print(f"\n[步骤 4] 解决冲突 1/2: 使用 client_wins 策略")
c1 = draft_conflicts[0]
r1 = requests.post(f"{BASE}/conflicts/resolve", json={
    "conflict_id": c1['id'],
    "resolution": "client_wins",
    "resolved_by": "admin"
}).json()
print(f"   字段 '{c1['field_name']}' 更新为 {r1['final_value']}")

# 5. 验证中间状态
draft_mid = requests.get(f"{BASE}/drafts/{target_draft_id}").json()
conflicts_mid = requests.get(f"{BASE}/conflicts").json()
batches_mid = requests.get(f"{BASE}/batches").json()

print(f"\n[步骤 5] 解决部分冲突后的状态:")
print(f"   草稿状态: {draft_mid['status']}")
print(f"   form_data['{c1['field_name']}'] = {draft_mid['form_data'].get(c1['field_name'])}")
print(f"   剩余未解决冲突: {len([c for c in conflicts_mid if not c['resolved'] and c['draft_id'] == target_draft_id])}")
print(f"   批次状态: {batches_mid[0]['status']}")

# 6. 解决第二个冲突 (server_wins)
print(f"\n[步骤 6] 解决冲突 2/2: 使用 server_wins 策略")
c2 = draft_conflicts[1]
r2 = requests.post(f"{BASE}/conflicts/resolve", json={
    "conflict_id": c2['id'],
    "resolution": "server_wins",
    "resolved_by": "admin"
}).json()
print(f"   字段 '{c2['field_name']}' 更新为 {r2['final_value']}")

# 7. 验证最终状态
draft_final = requests.get(f"{BASE}/drafts/{target_draft_id}").json()
conflicts_final = requests.get(f"{BASE}/conflicts").json()
batches_final = requests.get(f"{BASE}/batches").json()

print(f"\n[步骤 7] 最终状态验证:")
print(f"   草稿状态: {draft_final['status']} (预期: synced)")
print(f"   草稿版本: {draft_final['version']} (预期: 2)")
print(f"   最终 form_data: {json.dumps(draft_final['form_data'], ensure_ascii=False)}")

print(f"\n   字段 '{c1['field_name']}' 值: {draft_final['form_data'].get(c1['field_name'])} (client值: {c1['client_value']})")
print(f"   字段 '{c2['field_name']}' 值: {draft_final['form_data'].get(c2['field_name'])} (server值: {c2['server_value']})")

unresolved_final = len([c for c in conflicts_final if not c['resolved'] and c['draft_id'] == target_draft_id])
print(f"   剩余未解决冲突: {unresolved_final} (预期: 0)")

batch_status = [b['status'] for b in batches_final if b['id'] == draft_final['sync_batch_id']][0] if draft_final['sync_batch_id'] else "N/A"
print(f"   关联批次状态: {batch_status} (预期: completed)")

# 8. 结果总结
print("\n" + "=" * 70)
all_ok = (
    draft_final['status'] == 'synced' and
    draft_final['version'] == 2 and
    draft_final['form_data'][c1['field_name']] == c1['client_value'] and
    draft_final['form_data'][c2['field_name']] == c2['server_value'] and
    unresolved_final == 0 and
    batch_status == 'completed'
)

if all_ok:
    print("✓ 测试通过!")
    print("  ✓ 冲突解决后字段值正确持久化")
    print("  ✓ 草稿状态从 'conflict' 变为 'synced'")
    print("  ✓ 草稿版本号正确递增")
    print("  ✓ 所有冲突解决后批次状态变为 'completed'")
    print("  ✓ 前端刷新后能看到真实的后端状态变化")
else:
    print("✗ 测试失败!")
print("=" * 70)
