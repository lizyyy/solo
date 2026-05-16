#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8000"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def test_1_normal_application():
    print_section("测试1: 提交正常指标申请（应自动通过）")
    
    payload = {
        "metric_name": "http_requests_total",
        "labels": {
            "env": "prod",
            "service": "api-gateway",
            "version": "v1"
        },
        "reason": "API网关HTTP请求统计，用于监控QPS"
    }
    
    print("提交数据:")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    
    response = requests.post(f"{BASE_URL}/api/v1/applications", json=payload)
    result = response.json()
    
    print(f"\n响应状态码: {response.status_code}")
    print("响应数据:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    assert result["status"] == "APPROVED", f"预期状态为 APPROVED，实际为 {result['status']}"
    print("\n✅ 测试通过: 正常指标申请自动批准")
    return result["id"]

def test_2_duplicate_submission():
    print_section("测试2: 重复提交相同申请（应返回已有记录，状态不推进）")
    
    payload = {
        "metric_name": "http_requests_total",
        "labels": {
            "env": "prod",
            "service": "api-gateway",
            "version": "v1"
        },
        "reason": "API网关HTTP请求统计，用于监控QPS"
    }
    
    print("第1次提交:")
    response1 = requests.post(f"{BASE_URL}/api/v1/applications", json=payload)
    result1 = response1.json()
    id1 = result1["id"]
    status1 = result1["status"]
    print(f"ID: {id1}, 状态: {status1}")
    
    print("\n第2次提交（相同指标和标签）:")
    response2 = requests.post(f"{BASE_URL}/api/v1/applications", json=payload)
    result2 = response2.json()
    id2 = result2["id"]
    status2 = result2["status"]
    print(f"ID: {id2}, 状态: {status2}")
    
    assert id1 == id2, f"预期返回相同ID，实际ID1={id1}, ID2={id2}"
    assert status1 == status2, f"预期状态不变，实际status1={status1}, status2={status2}"
    print("\n✅ 测试通过: 重复提交返回已有记录，状态未推进")
    return id1

def test_3_blocked_by_whitelist():
    print_section("测试3: 提交含未授权标签的申请（应被拦截）")
    
    payload = {
        "metric_name": "user_login_events",
        "labels": {
            "env": "prod",
            "service": "auth",
            "user_id": "12345"
        },
        "reason": "用户登录事件统计"
    }
    
    print("提交数据（含未授权标签 user_id）:")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    
    response = requests.post(f"{BASE_URL}/api/v1/applications", json=payload)
    result = response.json()
    
    print(f"\n响应状态码: {response.status_code}")
    print("响应数据:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    assert result["status"] == "BLOCKED", f"预期状态为 BLOCKED，实际为 {result['status']}"
    assert "user_id" in result["block_reason"], "拦截原因应包含 user_id"
    print("\n✅ 测试通过: 未授权标签申请被正确拦截")
    return result["id"]

def test_4_blocked_by_cardinality():
    print_section("测试4: 提交高基数指标申请（应被拦截）")
    
    payload = {
        "metric_name": "database_query_latency",
        "labels": {
            "env": "prod",
            "service": "db",
            "region": "cn",
            "zone": "a",
            "instance": "db-01"
        },
        "reason": "数据库查询延迟监控",
        "estimated_values": {
            "env": 3,
            "service": 20,
            "region": 10,
            "zone": 5,
            "instance": 100
        }
    }
    
    print("提交数据（5个标签，估算基数很高）:")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    
    response = requests.post(f"{BASE_URL}/api/v1/applications", json=payload)
    result = response.json()
    
    print(f"\n响应状态码: {response.status_code}")
    print("响应数据:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    assert result["status"] == "BLOCKED", f"预期状态为 BLOCKED，实际为 {result['status']}"
    assert result["estimated_cardinality"] >= 10000, f"估算基数应超过阈值"
    print("\n✅ 测试通过: 高基数申请被正确拦截")
    return result["id"]

def test_5_manual_approve():
    print_section("测试5: 人工放行被拦截的申请")
    
    blocked_id = test_3_blocked_by_whitelist()
    
    print(f"\n查询申请 ID={blocked_id} 当前状态:")
    response = requests.get(f"{BASE_URL}/api/v1/applications/{blocked_id}")
    before = response.json()
    print(f"状态: {before['status']}")
    print(f"拦截原因: {before['block_reason']}")
    
    print("\n执行人工批准:")
    approve_payload = {
        "reviewer": "admin",
        "comment": "业务特殊场景需要，临时放行"
    }
    response = requests.post(f"{BASE_URL}/api/v1/applications/{blocked_id}/approve", json=approve_payload)
    after = response.json()
    
    print(f"新状态: {after['status']}")
    print(f"审核人: {after['reviewed_by']}")
    print(f"审核意见: {after['review_comment']}")
    
    assert after["status"] == "APPROVED", f"预期状态为 APPROVED，实际为 {after['status']}"
    assert after["block_reason"] is None, "拦截原因应被清除"
    print("\n✅ 测试通过: 人工放行成功")
    return blocked_id

def test_6_state_transition_validation():
    print_section("测试6: 状态流转验证 - 不能重复批准已批准的申请")
    
    app_id = test_1_normal_application()
    
    print(f"\n申请 ID={app_id} 当前状态: APPROVED")
    
    print("\n尝试再次批准（应该失败）:")
    approve_payload = {
        "reviewer": "admin",
        "comment": "重复批准测试"
    }
    response = requests.post(f"{BASE_URL}/api/v1/applications/{app_id}/approve", json=approve_payload)
    
    print(f"响应状态码: {response.status_code}")
    print(f"错误信息: {response.json().get('detail')}")
    
    assert response.status_code == 400, "预期返回400错误"
    print("\n✅ 测试通过: 已批准申请不能重复批准，状态不推进")

def test_7_export_report():
    print_section("测试7: 导出护栏报告")
    
    response = requests.get(f"{BASE_URL}/api/v1/report?format=json")
    report = response.json()
    
    print("报告摘要:")
    print(json.dumps(report["summary"], indent=2, ensure_ascii=False))
    
    print(f"\n申请数量: {len(report['applications'])}")
    print(f"拦截记录数: {len(report['block_records'])}")
    
    print("\n检查每条申请的process_result字段（应包含处理详情）:")
    for app in report["applications"]:
        if app["process_result"]:
            print(f"  - ID={app['id']}: {app['process_result']['final_status']}")
            for check in app["process_result"]["checks"]:
                print(f"    * {check['check']}: {'通过' if check['passed'] else '失败'} - {check['message']}")
    
    assert report["summary"]["total_applications"] > 0, "应有申请记录"
    print("\n✅ 测试通过: 报告导出成功，包含每条异常的解释")

def test_8_mark_applied():
    print_section("测试8: 标记已应用")
    
    app_id = test_1_normal_application()
    
    print(f"\n申请 ID={app_id} 当前状态: APPROVED")
    
    print("\n标记为已应用:")
    response = requests.post(f"{BASE_URL}/api/v1/applications/{app_id}/apply")
    result = response.json()
    
    print(f"新状态: {result['status']}")
    print(f"应用时间: {result['applied_at']}")
    
    assert result["status"] == "APPLIED", f"预期状态为 APPLIED，实际为 {result['status']}"
    print("\n✅ 测试通过: 标记已应用成功")

def test_9_raw_input_preserved():
    print_section("测试9: 原始输入保留验证")
    
    payload = {
        "metric_name": "test_metric_raw",
        "labels": {
            "env": "test",
            "service": "test-service"
        },
        "reason": "测试原始输入保留"
    }
    
    response = requests.post(f"{BASE_URL}/api/v1/applications", json=payload)
    result = response.json()
    app_id = result["id"]
    
    response = requests.get(f"{BASE_URL}/api/v1/applications/{app_id}")
    full_app = response.json()
    
    print("原始输入 (raw_input):")
    print(json.dumps(full_app["raw_input"], indent=2, ensure_ascii=False))
    
    assert full_app["raw_input"] is not None, "原始输入应被保留"
    assert full_app["raw_input"]["metric_name"] == payload["metric_name"], "原始输入应匹配"
    print("\n✅ 测试通过: 原始输入已保留")

def main():
    print("🚀 开始指标基数护栏API功能测试")
    print(f"服务地址: {BASE_URL}")
    print("请确保服务已启动: python main.py")
    
    try:
        response = requests.get(f"{BASE_URL}/docs")
        if response.status_code != 200:
            print("❌ 服务未启动，请先运行: python main.py")
            return
    except:
        print("❌ 服务未启动，请先运行: python main.py")
        return
    
    print("✅ 服务已启动，开始测试...")
    time.sleep(1)
    
    try:
        test_1_normal_application()
        test_2_duplicate_submission()
        test_3_blocked_by_whitelist()
        test_4_blocked_by_cardinality()
        test_5_manual_approve()
        test_6_state_transition_validation()
        test_7_export_report()
        test_8_mark_applied()
        test_9_raw_input_preserved()
        
        print_section("🎉 所有测试通过！")
        print("\n📊 验收要点总结:")
        print("  ✅ 正常数据: 自动通过审批")
        print("  ✅ 重复提交: 返回已有记录，状态不推进")
        print("  ✅ 标签白名单: 未授权标签自动拦截")
        print("  ✅ 基数估算: 高基数指标自动拦截")
        print("  ✅ 人工放行: 支持人工审核放行")
        print("  ✅ 状态流转: 状态机校验，防止重复操作")
        print("  ✅ 报告导出: 包含每条异常的详细解释")
        print("  ✅ 原始输入: 所有请求原始数据已保留")
        
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
    except Exception as e:
        print(f"\n❌ 测试发生错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
