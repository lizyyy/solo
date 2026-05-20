import requests
import json

BASE = "http://localhost:8000/api"

print("=" * 70)
print("测试: 有 sync_batch_id 的草稿的冲突检测")
print("=" * 70)

# 1. 重置数据
requests.post(f"{BASE}/sample-data")
print("\n[步骤 1] 重置样例数据完成")

# 2. 获取冲突草稿，解决它，让它变成 synced 状态并且有 sync_batch_id
drafts = requests.get(f"{BASE}/drafts").json()
conflict_draft = [d for d in drafts if d['status'] == 'conflict'][0]
conflicts = requests.get(f"{BASE}/conflicts").json()
draft_conflicts = [c for c in conflicts if c['draft_id'] == conflict_draft['id']]

print(f"\n[步骤 2] 解决草稿的所有冲突，让它变为 synced 状态...")
for c in draft_conflicts:
    requests.post(f"{BASE}/conflicts/resolve", json={
        "conflict_id": c['id'],
        "resolution": "server_wins",
        "resolved_by": "test"
    }).json()

# 3. 验证解决后的状态
drafts = requests.get(f"{BASE}/drafts").json()
target_draft = [d for d in drafts if d['id'] == conflict_draft['id']][0]
devices = requests.get(f"{BASE}/devices").json()
device_id = devices[0]['id']

print(f"\n[步骤 3] 目标草稿状态:")
print(f"  草稿 ID: {target_draft['id']}")
print(f"  版本: v{target_draft['version']}")
print(f"  状态: {target_draft['status']}")
print(f"  form_data: {json.dumps(target_draft['form_data'], ensure_ascii=False)}")
print(f"  sync_batch_id: {target_draft['sync_batch_id']}")

if target_draft['sync_batch_id']:
    print(f"  ✓ 草稿现在有 sync_batch_id 了")
else:
    print(f"  ✗ 草稿没有 sync_batch_id，测试条件不满足")

# 4. 关键测试：同步同 ID 但版本更低的脏数据
print(f"\n[步骤 4] 关键测试：同步同 ID 但版本更低的脏数据...")
print(f"  服务器版本: v{target_draft['version']}")
print(f"  客户端版本: v1 (更低)")
print(f"  客户端数据已修改")

result = requests.post(f"{BASE}/sync", json={
    "device_id": device_id,
    "drafts": [{
        "id": target_draft['id'],  # 相同 ID
        "form_type": "安全检查",
        "form_data": {"检查地点": "B车间", "检查人": "王五", "安全评分": 50, "备注": "脏数据！！！"},
        "device_id": device_id,
        "version": 1,  # 版本更低
        "created_by": "王五"
    }]
}).json()

print(f"\n[步骤 5] 同步结果:")
print(f"  批次状态: {result['status']}")
print(f"  success_count: {result['success_count']}")
print(f"  conflict_count: {result['conflict_count']}")
print(f"  processed_drafts: {json.dumps(result['processed_drafts'], ensure_ascii=False)}")

# 6. 检查冲突
conflicts = requests.get(f"{BASE}/conflicts").json()
new_conflicts = [c for c in conflicts if c['batch_id'] == result['batch_id']]
print(f"\n[步骤 6] 冲突检查:")
print(f"  本次同步产生的冲突数: {len(new_conflicts)}")

# 7. 验证结果
print(f"\n" + "=" * 70)
was_duplicate = any(d.get('status') == 'duplicate' for d in result['processed_drafts'])
has_conflicts = result['status'] == 'has_conflicts' and len(new_conflicts) > 0

if has_conflicts and not was_duplicate:
    print("✓ 测试通过! 尽管草稿有 sync_batch_id，但版本冲突仍被正确检测")
    print("  没有被误判为重复同步！")
elif was_duplicate:
    print("✗ 测试失败! 真实版本冲突被误判为重复同步，冲突被吞掉了！")
    print("  这正是用户报告的 bug！")
else:
    print(f"✗ 测试失败! 状态不正确: has_conflicts={has_conflicts}, was_duplicate={was_duplicate}")
print("=" * 70)

# 8. 额外测试：真正的重复同步（版本相同，内容相同）
print(f"\n\n[额外测试] 真正的重复同步: 同 ID 同版本 同内容")
result2 = requests.post(f"{BASE}/sync", json={
    "device_id": device_id,
    "drafts": [{
        "id": target_draft['id'],
        "form_type": "安全检查",
        "form_data": target_draft['form_data'],  # 相同内容
        "device_id": device_id,
        "version": target_draft['version'],  # 相同版本
        "created_by": "王五"
    }]
}).json()

print(f"  批次状态: {result2['status']}")
print(f"  processed_drafts: {json.dumps(result2['processed_drafts'], ensure_ascii=False)}")

was_duplicate2 = any(d.get('status') == 'duplicate' for d in result2['processed_drafts'])
if was_duplicate2:
    print("  ✓ 真正的重复同步被正确识别")
else:
    print("  ? 未标记为重复，但这可能是合理的行为")
