#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"
TIMESTAMP = str(int(time.time()))

def pprint(data):
    print(json.dumps(data, ensure_ascii=False, indent=2))

print("=== 异常工单归因 API 核心功能测试")
print("===================================")
print()

print("1. 健康检查")
resp = requests.get("http://localhost:8000/health")
pprint(resp.json())
print()

print("2. 创建归属规则")
resp = requests.post(f"{BASE_URL}/attribution-rules", json={
    "name": "数据库连接错误",
    "error_code_pattern": "DB_500|CONN_.*",
    "api_path_pattern": "/api/.*",
    "keyword_pattern": "数据库|连接|超时",
    "priority": 100
})
pprint(resp.json())
print()

print("3. 创建工单")
resp = requests.post(f"{BASE_URL}/tickets", json={
    "idempotency_key": f"test-{TIMESTAMP}",
    "ticket_id": "TICKET-TEST-001",
    "title": "数据库连接超时",
    "description": "用户登录时数据库连接超时",
    "error_code": "DB_500_CONN_TIMEOUT",
    "api_path": "/api/auth/login",
    "severity": "high"
})
pprint(resp.json())
print()

print("4. 幂等性测试 - 重复提交")
resp = requests.post(f"{BASE_URL}/tickets", json={
    "idempotency_key": f"test-{TIMESTAMP}",
    "ticket_id": "TICKET-TEST-001",
    "title": "重复提交测试"
})
print(f"状态码: {resp.status_code}")
pprint(resp.json())
print()

print("5. 查询工单列表")
resp = requests.get(f"{BASE_URL}/tickets")
pprint(resp.json())
print()

print("6. 归属规则匹配")
resp = requests.post(f"{BASE_URL}/tickets/1/match-rules")
pprint(resp.json())
print()

print("7. 标注根因")
resp = requests.post(f"{BASE_URL}/root-cause-labels", json={
    "ticket_id": 1,
    "root_cause_category": "基础设施-数据库",
    "root_cause_detail": "连接池配置过小",
    "confidence_score": 95,
    "tagged_by": "系统自动"
})
pprint(resp.json())
print()

print("8. 派单")
resp = requests.post(f"{BASE_URL}/dispatch-records", json={
    "ticket_id": 1,
    "assignee": "张三",
    "dispatch_note": "请排查数据库连接池问题"
})
pprint(resp.json())
print()

print("9. 状态流转")
resp = requests.post(f"{BASE_URL}/status-transitions", json={
    "ticket_id": 1,
    "target_status": "completed",
    "reason": "问题已修复",
    "changed_by": "李四"
})
pprint(resp.json())
print()

print("10. 状态历史查询")
resp = requests.get(f"{BASE_URL}/tickets/1/status-history")
pprint(resp.json())
print()

print("11. 归因报告导出 (第一次)")
resp = requests.get(f"{BASE_URL}/tickets/1/report")
report1 = resp.json()
pprint(report1)
print()

print("12. 归因报告导出 (第二次 - 验证结果一致性)")
resp = requests.get(f"{BASE_URL}/tickets/1/report")
report2 = resp.json()
pprint(report2)
print(f"结果一致: {json.dumps(report1, sort_keys=True) == json.dumps(report2, sort_keys=True)}")
print()

print("13. 异常测试 - 查询不存在的工单")
resp = requests.get(f"{BASE_URL}/tickets/999")
print(f"状态码: {resp.status_code}")
pprint(resp.json())
print()

print("=== 测试完成!")
print("API文档: http://localhost:8000/docs")
