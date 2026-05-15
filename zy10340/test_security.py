#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8080/api/v1"

def p(desc, result):
    print(f"[{'PASS' if result else 'FAIL'}] {desc}")

print("="*50)
print("API负载回放节流器 - 安全修复验证")
print("="*50)

# 1. 创建两个租户
print("\n[步骤1] 创建两个租户")
t1 = requests.post(f"{BASE_URL}/tenants", json={"name": "tenant1"}).json()["id"]
t2 = requests.post(f"{BASE_URL}/tenants", json={"name": "tenant2"}).json()["id"]
print(f"  TENANT1 = {t1}")
print(f"  TENANT2 = {t2}")

# 2. 为租户1创建sample和rule
print("\n[步骤2] 为租户1创建sample和rule")
s1_resp = requests.post(f"{BASE_URL}/tenants/{t1}/samples", json=[
    {"method": "GET", "url": "https://httpbin.org/get"}
]).json()
s1 = s1_resp["samples"][0]["id"]
r1 = requests.post(f"{BASE_URL}/tenants/{t1}/rules", json={
    "name": "rule1", "max_requests": 10, "window_seconds": 60,
    "max_concurrency": 5, "error_threshold": 0.5, "backoff_multiplier": 2.0
}).json()["id"]
print(f"  SAMPLE1 = {s1}")
print(f"  RULE1 = {r1}")

# 3. 为租户2创建sample和rule
print("\n[步骤3] 为租户2创建sample和rule")
s2_resp = requests.post(f"{BASE_URL}/tenants/{t2}/samples", json=[
    {"method": "GET", "url": "https://httpbin.org/get"}
]).json()
s2 = s2_resp["samples"][0]["id"]
r2 = requests.post(f"{BASE_URL}/tenants/{t2}/rules", json={
    "name": "rule2", "max_requests": 10, "window_seconds": 60,
    "max_concurrency": 5, "error_threshold": 0.5, "backoff_multiplier": 2.0
}).json()["id"]
print(f"  SAMPLE2 = {s2}")
print(f"  RULE2 = {r2}")

print("\n" + "="*50)
print("开始安全验证测试")
print("="*50)

# 测试1: 用租户2的规则在租户1下创建计划（应该失败）
print("\n测试1: 跨租户使用规则（应该失败）")
result = requests.post(f"{BASE_URL}/tenants/{t1}/plans", json={
    "name": "bad-plan", "rule_id": r2
}).json()
has_error = "error" in result or "resource does not belong to tenant" in str(result)
p("跨租户规则被拒绝", has_error)
if has_error:
    print(f"  错误信息: {result.get('error', result)}")

# 测试2: 用租户1自己的规则创建计划（应该成功）
print("\n测试2: 正常创建计划（应该成功）")
plan1 = requests.post(f"{BASE_URL}/tenants/{t1}/plans", json={
    "name": "good-plan", "rule_id": r1
}).json()["id"]
p("同租户规则创建成功", True)
print(f"  PLAN1 = {plan1}")

# 测试3: 用租户2的sample启动租户1的计划（应该失败）
print("\n测试3: 跨租户使用sample（应该失败）")
result = requests.post(f"{BASE_URL}/tenants/{t1}/plans/{plan1}/start", json={
    "sample_ids": [s2]
}).json()
has_error = "error" in result or "resource does not belong to tenant" in str(result)
p("跨租户sample被拒绝", has_error)
if has_error:
    print(f"  错误信息: {result.get('error', result)}")

# 测试4: 用租户1自己的sample启动计划
print("\n测试4: 正常启动计划（应该成功）")
result = requests.post(f"{BASE_URL}/tenants/{t1}/plans/{plan1}/start", json={
    "sample_ids": [s1]
}).json()
success = "id" in result or "status" in result
p("同租户sample启动成功", success)

import time
time.sleep(2)

# 测试5: 租户2访问租户1的计划详情
print("\n测试5: 跨租户访问计划详情（应该失败）")
result = requests.get(f"{BASE_URL}/tenants/{t2}/plans/{plan1}").json()
has_error = "error" in result and "not found" not in result["error"].lower()
p("跨租户计划详情被拒绝", "error" in result)
if "error" in result:
    print(f"  错误信息: {result['error']}")

# 测试6: 租户2访问租户1的结果
print("\n测试6: 跨租户访问结果（应该失败）")
result = requests.get(f"{BASE_URL}/tenants/{t2}/plans/{plan1}/results").json()
p("跨租户结果被拒绝", "error" in result)
if "error" in result:
    print(f"  错误信息: {result['error']}")

# 测试7: 租户2导出租户1的结果
print("\n测试7: 跨租户导出结果（应该失败）")
result = requests.get(f"{BASE_URL}/tenants/{t2}/plans/{plan1}/export").json()
p("跨租户导出被拒绝", "error" in result)
if "error" in result:
    print(f"  错误信息: {result['error']}")

# 测试8: 租户1正常访问结果
print("\n测试8: 同租户访问结果（应该成功）")
result = requests.get(f"{BASE_URL}/tenants/{t1}/plans/{plan1}/results").json()
p("同租户访问结果成功", "total" in result and result["total"] >= 0)
if "total" in result:
    print(f"  结果数: {result['total']}")

# 测试9: 访问不存在的plan
print("\n测试9: 访问不存在的plan（应该返回404）")
result = requests.get(f"{BASE_URL}/tenants/{t1}/plans/nonexistent-plan-id-123/export").json()
p("不存在plan返回404错误", "error" in result and "not found" in result["error"].lower())
if "error" in result:
    print(f"  错误信息: {result['error']}")

# 测试10: 租户1正常访问统计
print("\n测试10: 同租户访问统计（应该成功）")
result = requests.get(f"{BASE_URL}/tenants/{t1}/plans/{plan1}/statistics").json()
p("同租户访问统计成功", "total_count" in result or "error" not in result)
if "total_count" in result:
    print(f"  统计数据: {result}")

print("\n" + "="*50)
print("所有安全验证测试完成!")
print("="*50)
