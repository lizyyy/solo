from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("=" * 60)
print("仓储波次拣货 API - 集成测试")
print("=" * 60)

# 1. 健康检查
response = client.get("/")
print(f"\n1. 健康检查: {response.status_code}")
assert response.status_code == 200

# 2. 获取订单列表
response = client.get("/api/orders/")
orders = response.json()
print(f"2. 获取订单: {response.status_code}, 数量: {len(orders)}")
assert len(orders) == 5

# 3. 创建波次
order_ids = [o["id"] for o in orders[:3]]
response = client.post("/api/waves/", json={
    "order_ids": order_ids,
    "priority": 1,
    "created_by": "测试员"
})
print(f"3. 创建波次: {response.status_code}")
assert response.status_code == 200
wave = response.json()
wave_id = wave["id"]

# 4. 获取波次详情
response = client.get(f"/api/waves/{wave_id}")
wave_detail = response.json()
tasks = wave_detail["pick_tasks"]
print(f"4. 波次详情: {response.status_code}, 任务数: {len(tasks)}")

# 5. 测试缺货拆单
task_id = tasks[0]["id"]
original_qty = tasks[0]["required_qty"]
available_qty = original_qty - 2
print(f"5. 缺货拆单测试:")
print(f"   原任务ID: {task_id}, 原数量: {original_qty}, 可用: {available_qty}")

response = client.post("/api/stock-split/", json={
    "pick_task_id": task_id,
    "available_qty": available_qty,
    "reason": "库存不足集成测试",
    "operator": "测试员"
})
print(f"   拆单请求: {response.status_code}")

if response.status_code != 200:
    print(f"   错误: {response.text}")
    assert False, "拆单失败"

# 6. 验证新任务创建
response = client.get(f"/api/waves/{wave_id}")
new_tasks = response.json()["pick_tasks"]
print(f"6. 拆单后任务数: {len(new_tasks)} (原: {len(tasks)})")
assert len(new_tasks) > len(tasks), "应该创建新的缺货任务"

# 7. 验证数量计算正确性
split_task = [t for t in new_tasks if t.get("split_from_task_id") == task_id]
if split_task:
    split_task = split_task[0]
    print(f"7. 缺货任务验证:")
    print(f"   新任务数量: {split_task['required_qty']} (预期: 2)")
    print(f"   新任务状态: {split_task['status']} (预期: out_of_stock)")
    assert split_task["required_qty"] == 2, f"缺货数量计算错误: 预期2, 实际{split_task['required_qty']}"
    assert split_task["status"] == "out_of_stock", "状态错误"

# 8. 验证原任务
original_updated = [t for t in new_tasks if t["id"] == task_id][0]
print(f"8. 原任务验证:")
print(f"   更新后数量: {original_updated['required_qty']} (预期: {available_qty})")
assert original_updated["required_qty"] == available_qty, "原任务数量错误"
assert original_updated["is_split"] == True, "拆单标记错误"

print()
print("=" * 60)
print("✅ 所有集成测试通过!")
print("=" * 60)
