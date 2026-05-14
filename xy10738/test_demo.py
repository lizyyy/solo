#!/usr/bin/env python3
import requests
import json

BASE = "http://localhost:8000/api"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

# 1. 四种状态演示
print_section("状态1: 正常数据 (success)")
data = {
    "topic": "order-events", "partition": 0, "consumer_group": "order-processor",
    "lag": 1500, "owner": "张三", "last_updated": "2026-05-14T00:00:00Z",
    "rebalance_events": []
}
resp = requests.post(f"{BASE}/validate", json=data)
print(json.dumps(resp.json(), indent=2, ensure_ascii=False))

print_section("状态2: 高积压数据 (retryable) - 限速策略介入")
data = {
    "topic": "payment-events", "partition": 1, "consumer_group": "payment-processor",
    "lag": 75000, "owner": "李四", "last_updated": "2026-05-14T00:00:00Z",
    "rebalance_events": []
}
resp = requests.post(f"{BASE}/validate", json=data)
print(json.dumps(resp.json(), indent=2, ensure_ascii=False))

print_section("状态3: 频繁重平衡 (pending_review) - 待人工复核")
data = {
    "topic": "user-events", "partition": 2, "consumer_group": "user-processor",
    "lag": 8000, "owner": "王五", "last_updated": "2026-05-14T00:00:00Z",
    "rebalance_events": [
        {"event_id": f"r{i}", "timestamp": "2026-05-14T00:00:00Z", 
         "consumer_group": "user-processor", "partitions": [2], 
         "reason": "消费者心跳超时"}
        for i in range(6)
    ]
}
resp = requests.post(f"{BASE}/validate", json=data)
print(json.dumps(resp.json(), indent=2, ensure_ascii=False))

print_section("状态4: 脏数据 (blocked) - 已拦截")
data = {
    "topic": "", "partition": -1, "consumer_group": "",
    "lag": -500, "owner": "", "last_updated": "2026-05-14T00:00:00Z",
    "rebalance_events": []
}
resp = requests.post(f"{BASE}/validate", json=data)
print(json.dumps(resp.json(), indent=2, ensure_ascii=False))

# 2. 限速策略和诊断建议保存
print_section("保存限速策略")
strategy = {
    "strategy_id": "s001", "name": "支付服务限流策略", 
    "consumer_group": "payment-processor",
    "max_messages_per_second": 1000, "max_lag_threshold": 50000,
    "enabled": True, "created_at": "2026-05-14T00:00:00Z", "created_by": "管理员"
}
resp = requests.post(f"{BASE}/rate-limit-strategies", json=strategy)
print(json.dumps(resp.json(), indent=2, ensure_ascii=False))

print_section("保存诊断建议")
suggestion = {
    "suggestion_id": "g001", "topic": "user-events", "consumer_group": "user-processor",
    "suggestion": "检测到频繁重平衡（6次），建议检查消费者实例健康状态",
    "priority": "high", "status": "open", "created_at": "2026-05-14T00:00:00Z"
}
resp = requests.post(f"{BASE}/diagnosis-suggestions", json=suggestion)
print(json.dumps(resp.json(), indent=2, ensure_ascii=False))

# 3. 获取策略和建议
print_section("查询已保存的限速策略")
resp = requests.get(f"{BASE}/rate-limit-strategies")
print(json.dumps(resp.json(), indent=2, ensure_ascii=False))

print_section("查询已保存的诊断建议")
resp = requests.get(f"{BASE}/diagnosis-suggestions")
print(json.dumps(resp.json(), indent=2, ensure_ascii=False))

# 4. 失败路径演示
print_section("失败路径: 无历史数据时导出")
resp = requests.get(f"{BASE}/export?group_by=owner")
print(f"状态码: {resp.status_code}")
print(json.dumps(resp.json(), indent=2, ensure_ascii=False))

print_section("\n✓ 所有测试完成！")
print("""
失败路径总结:
1. 脏数据进入 → 返回 blocked，系统拦截
2. 高积压数据 → 返回 retryable，提示限速策略介入
3. 频繁重平衡 → 返回 pending_review，待人工复核
4. 无数据导出 → 404 错误，提示无数据
""")
