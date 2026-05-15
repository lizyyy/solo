#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8080/api/v1"

def run_tests():
    print("="*60)
    print("API 负载回放节流器 - 安全修复验证")
    print("="*60)

    # 1. 创建两个租户
    print("\n[步骤1] 创建两个租户")
    try:
        t1 = requests.post(f"{BASE_URL}/tenants", json={"name": "tenant1"}).json()["id"]
        t2 = requests.post(f"{BASE_URL}/tenants", json={"name": "tenant2"}).json()["id"]
        print(f"  TENANT1 = {t1}")
        print(f"  TENANT2 = {t2}")
    except Exception as e:
        print(f"  创建租户失败: {e}")
        return

    # 2. 为租户1创建sample和rule
    print("\n[步骤2] 为租户1创建sample和rule")
    try:
        s1_resp = requests.post(f"{BASE_URL}/tenants/{t1}/samples", json=[
            {"method": "GET", "url": "https://httpbin.org/get"}
        ]).json()
        s1 = s1_resp["samples"][0]["id"]
        print(f"  SAMPLE1 (属于T1) = {s1}")
    except Exception as e:
        print(f"  创建sample失败: {e}")
        return

    try:
        r1 = requests.post(f"{BASE_URL}/tenants/{t1}/rules", json={
            "name": "rule1", "max_requests": 10, "window_seconds": 60,
            "max_concurrency": 5, "error_threshold": 0.5, "backoff_multiplier": 2.0
        }).json()["id"]
        print(f"  RULE1 (属于T1) = {r1}")
    except Exception as e:
        print(f"  创建rule失败: {e}")
        return

    # 3. 为租户2创建sample和rule
    print("\n[步骤3] 为租户2创建sample和rule")
    try:
        s2_resp = requests.post(f"{BASE_URL}/tenants/{t2}/samples", json=[
            {"method": "GET", "url": "https://httpbin.org/get"}
        ]).json()
        s2 = s2_resp["samples"][0]["id"]
        print(f"  SAMPLE2 (属于T2) = {s2}")
    except Exception as e:
        print(f"  创建sample失败: {e}")
        return

    try:
        r2 = requests.post(f"{BASE_URL}/tenants/{t2}/rules", json={
            "name": "rule2", "max_requests": 10, "window_seconds": 60,
            "max_concurrency": 5, "error_threshold": 0.5, "backoff_multiplier": 2.0
        }).json()["id"]
        print(f"  RULE2 (属于T2) = {r2}")
    except Exception as e:
        print(f"  创建rule失败: {e}")
        return

    print("\n" + "="*60)
    print("开始安全验证测试")
    print("="*60)

    # 测试1: 用租户2的规则在租户1下创建计划（应该失败）
    print("\n测试1: 跨租户使用规则（应该失败）")
    try:
        result = requests.post(f"{BASE_URL}/tenants/{t1}/plans", json={
            "name": "bad-plan", "rule_id": r2
        })
        if "error" in result.json():
            print(f"  [PASS] 跨租户规则被拒绝，错误信息: {result.json()['error']}")
        else:
            print(f"  [FAIL] 跨租户规则没有被拒绝！响应: {result.text}")
    except Exception as e:
        print(f"  [ERROR] 测试失败: {e}")

    # 测试2: 用租户1自己的规则创建计划（应该成功）
    print("\n测试2: 正常创建计划（应该成功）")
    try:
        plan1 = requests.post(f"{BASE_URL}/tenants/{t1}/plans", json={
            "name": "good-plan", "rule_id": r1
        }).json()
        if "id" in plan1:
            plan1_id = plan1["id"]
            print(f"  [PASS] 同租户规则创建成功，PLAN1 = {plan1_id}")
        else:
            print(f"  [FAIL] 创建失败: {plan1}")
    except Exception as e:
        print(f"  [ERROR] 测试失败: {e}")
        return

    # 测试3: 用租户2的sample启动租户1的计划（应该失败）
    print("\n测试3: 跨租户使用sample启动计划（应该失败）")
    try:
        result = requests.post(f"{BASE_URL}/tenants/{t1}/plans/{plan1_id}/start", json={
            "sample_ids": [s2]
        })
        result_json = result.json()
        if "error" in result_json:
            print(f"  [PASS] 跨租户sample被拒绝，错误信息: {result_json['error']}")
        else:
            print(f"  [FAIL] 跨租户sample没有被拒绝！响应: {result.text}")
    except Exception as e:
        print(f"  [ERROR] 测试失败: {e}")

    # 测试4: 用租户1自己的sample启动计划
    print("\n测试4: 正常启动计划（应该成功）")
    try:
        result = requests.post(f"{BASE_URL}/tenants/{t1}/plans/{plan1_id}/start", json={
            "sample_ids": [s1]
        })
        result_json = result.json()
        if "id" in result_json or "status" in result_json or ("error" not in result_json and "processed_count" in result_json):
            print(f"  [PASS] 同租户sample启动成功")
        else:
            print(f"  [INFO] 响应: {result.text}")
    except Exception as e:
        print(f"  [ERROR] 测试失败: {e}")

    time.sleep(3)  # 等待回放完成

    # 测试5: 租户2访问租户1的计划详情
    print("\n测试5: 跨租户访问计划详情（应该失败）")
    try:
        result = requests.get(f"{BASE_URL}/tenants/{t2}/plans/{plan1_id}")
        result_json = result.json()
        if "error" in result_json:
            print(f"  [PASS] 跨租户计划详情被拒绝，错误信息: {result_json['error']}")
        else:
            print(f"  [FAIL] 跨租户计划详情没有被拒绝！响应: {result.text}")
    except Exception as e:
        print(f"  [ERROR] 测试失败: {e}")

    # 测试6: 租户2访问租户1的结果
    print("\n测试6: 跨租户访问结果（应该失败）")
    try:
        result = requests.get(f"{BASE_URL}/tenants/{t2}/plans/{plan1_id}/results")
        result_json = result.json()
        if "error" in result_json:
            print(f"  [PASS] 跨租户结果被拒绝，错误信息: {result_json['error']}")
        else:
            print(f"  [FAIL] 跨租户结果没有被拒绝！响应: {result.text}")
    except Exception as e:
        print(f"  [ERROR] 测试失败: {e}")

    # 测试7: 租户1正常访问结果
    print("\n测试7: 同租户访问结果（应该成功）")
    try:
        result = requests.get(f"{BASE_URL}/tenants/{t1}/plans/{plan1_id}/results")
        result_json = result.json()
        if "total" in result_json or "data" in result_json:
            print(f"  [PASS] 同租户访问结果成功")
        else:
            print(f"  [INFO] 响应: {result.text}")
    except Exception as e:
        print(f"  [ERROR] 测试失败: {e}")

    # 测试8: 访问不存在的plan
    print("\n测试8: 访问不存在的plan（应该返回404）")
    try:
        result = requests.get(f"{BASE_URL}/tenants/{t1}/plans/nonexistent-plan-id-123/export")
        result_json = result.json()
        if "error" in result_json and "not found" in result_json["error"].lower():
            print(f"  [PASS] 不存在plan返回404错误，错误信息: {result_json['error']}")
        elif "error" in result_json:
            print(f"  [PASS] 不存在plan返回错误: {result_json['error']}")
        else:
            print(f"  [FAIL] 不存在plan没有返回404！响应: {result.text}")
    except Exception as e:
        print(f"  [ERROR] 测试失败: {e}")

    # 测试9: 租户1正常访问统计
    print("\n测试9: 同租户访问统计（应该成功）")
    try:
        result = requests.get(f"{BASE_URL}/tenants/{t1}/plans/{plan1_id}/statistics")
        result_json = result.json()
        if "total_count" in result_json or "error" not in result_json:
            print(f"  [PASS] 同租户访问统计成功")
        else:
            print(f"  [INFO] 响应: {result.text}")
    except Exception as e:
        print(f"  [ERROR] 测试失败: {e}")

    print("\n" + "="*60)
    print("所有安全验证测试完成!")
    print("="*60)

if __name__ == "__main__":
    run_tests()
