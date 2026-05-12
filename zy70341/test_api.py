#!/usr/bin/env python3
import json
import time
import requests
from datetime import datetime, timedelta

BASE_URL = "http://localhost:5001/api/v1"

def test_risk_event_and_graylist():
    print("\n=== 测试1：写入风险事件并加入灰名单 ===")
    
    event_data = {
        "event_id": "evt_test_001",
        "user_id": "user_test_001",
        "risk_type": "bot_detection",
        "severity": "medium",
        "description": "测试风险事件",
        "evidence": {"test": True, "score": 95},
        "source": "test_engine"
    }
    
    r = requests.post(f"{BASE_URL}/risk-events", json=event_data)
    print(f"创建风险事件 - 状态码: {r.status_code}")
    print(f"响应: {json.dumps(r.json(), ensure_ascii=False, indent=2)}")
    assert r.status_code in [200, 201], f"创建风险事件失败: {r.text}"
    
    graylist_data = {
        "user_id": "user_test_001",
        "trigger_event_id": "evt_test_001",
        "reason": "测试灰名单",
        "single_transaction_limit": 1000,
        "daily_transaction_limit": 5000
    }
    
    r = requests.post(f"{BASE_URL}/graylist", json=graylist_data)
    print(f"\n加入灰名单 - 状态码: {r.status_code}")
    print(f"响应: {json.dumps(r.json(), ensure_ascii=False, indent=2)}")
    assert r.status_code in [200, 201], f"加入灰名单失败: {r.text}"

def test_transaction_evaluation():
    print("\n=== 测试2：交易试算 ===")
    
    tx_500 = {"user_id": "user_test_001", "amount": 500}
    r = requests.post(f"{BASE_URL}/transactions/evaluate", json=tx_500)
    print(f"交易500元（应允许）:")
    result = r.json()
    print(f"  allowed: {result['data']['allowed']}, reason: {result['data']['reason']}")
    assert result['data']['allowed'] == True, "500元交易应该被允许"
    
    tx_1500 = {"user_id": "user_test_001", "amount": 1500}
    r = requests.post(f"{BASE_URL}/transactions/evaluate", json=tx_1500)
    print(f"\n交易1500元（应被限额）:")
    result = r.json()
    print(f"  allowed: {result['data']['allowed']}, reason: {result['data']['reason']}")
    assert result['data']['allowed'] == False, "1500元交易应该被限额"

def test_review_and_remove():
    print("\n=== 测试3：人工复核解除 ===")
    
    review_data = {
        "decision": "approve",
        "reviewer_id": "reviewer_001",
        "remark": "经核实为正常用户，解除限制",
        "evidence": {"verified": True, "source": "manual_review"}
    }
    
    r = requests.post(f"{BASE_URL}/users/user_test_001/review", json=review_data)
    print(f"复核通过 - 状态码: {r.status_code}")
    print(f"响应: {json.dumps(r.json(), ensure_ascii=False, indent=2)}")
    assert r.status_code == 200, f"复核失败: {r.text}"
    
    r = requests.get(f"{BASE_URL}/users/user_test_001/risk-timeline")
    print(f"\n查询风险时间线:")
    result = r.json()
    print(f"  is_graylisted: {result['data']['is_graylisted']}")
    print(f"  review_records 数量: {len(result['data']['review_records'])}")
    assert result['data']['is_graylisted'] == False, "复核后应该不在灰名单中"
    assert len(result['data']['review_records']) >= 1, "应该有复核记录"

def test_escalate_to_blacklist():
    print("\n=== 测试4：升级黑名单 ===")
    
    event_data = {
        "event_id": "evt_test_002",
        "user_id": "user_test_002",
        "risk_type": "fraud_suspected",
        "severity": "high",
        "description": "严重风险测试",
        "evidence": {"fraud_score": 99},
        "source": "test_engine"
    }
    requests.post(f"{BASE_URL}/risk-events", json=event_data)
    
    graylist_data = {
        "user_id": "user_test_002",
        "single_transaction_limit": 100,
        "daily_transaction_limit": 500
    }
    requests.post(f"{BASE_URL}/graylist", json=graylist_data)
    
    escalate_data = {
        "decision": "escalate",
        "reviewer_id": "reviewer_002",
        "remark": "确认风险，升级黑名单",
        "evidence": {"police_report": "CASE-001"}
    }
    
    r = requests.post(f"{BASE_URL}/users/user_test_002/review", json=escalate_data)
    print(f"升级黑名单 - 状态码: {r.status_code}")
    print(f"响应: {json.dumps(r.json(), ensure_ascii=False, indent=2)}")
    assert r.status_code == 200, f"升级失败: {r.text}"
    
    tx_1 = {"user_id": "user_test_002", "amount": 1}
    r = requests.post(f"{BASE_URL}/transactions/evaluate", json=tx_1)
    result = r.json()
    print(f"\n黑名单用户1元交易（应禁止）:")
    print(f"  allowed: {result['data']['allowed']}, reason: {result['data']['reason']}")
    assert result['data']['allowed'] == False, "黑名单用户应该被禁止"

def test_idempotent():
    print("\n=== 测试5：幂等性 ===")
    
    event_data = {
        "event_id": "evt_idempotent_001",
        "user_id": "user_test_003",
        "risk_type": "device_anomaly",
        "severity": "medium",
        "description": "幂等测试",
        "evidence": {"test": True},
        "source": "test"
    }
    
    r1 = requests.post(f"{BASE_URL}/risk-events", json=event_data)
    r2 = requests.post(f"{BASE_URL}/risk-events", json=event_data)
    
    print(f"第一次写入 - is_duplicate: {r1.json().get('is_duplicate')}")
    print(f"第二次写入 - is_duplicate: {r2.json().get('is_duplicate')}")
    
    assert r1.json().get('is_duplicate') == False, "第一次不应该是重复"
    assert r2.json().get('is_duplicate') == True, "第二次应该是重复"

def test_graylist_detail():
    print("\n=== 测试6：灰名单详情（客服解释）===")
    
    event_data = {
        "event_id": "evt_detail_001",
        "user_id": "user_test_004",
        "risk_type": "ip_anomaly",
        "severity": "medium",
        "description": "异地登录异常",
        "evidence": {"ip": "8.8.8.8", "location": "美国"},
        "source": "ip_analytics"
    }
    requests.post(f"{BASE_URL}/risk-events", json=event_data)
    
    graylist_data = {
        "user_id": "user_test_004",
        "reason": "异地登录异常，临时限额",
        "single_transaction_limit": 500,
        "daily_transaction_limit": 2000
    }
    requests.post(f"{BASE_URL}/graylist", json=graylist_data)
    
    r = requests.get(f"{BASE_URL}/graylist/user_test_004")
    result = r.json()
    print(f"灰名单详情:")
    if result.get('success') and 'explanation' in result.get('data', {}):
        print(f"  explanation:\n{result['data']['explanation']}")
    else:
        print(f"  响应: {json.dumps(result, ensure_ascii=False, indent=2)}")

def test_daily_stats():
    print("\n=== 测试7：每日风控统计 ===")
    
    r = requests.get(f"{BASE_URL}/stats/daily")
    result = r.json()
    print(f"今日统计: {json.dumps(result, ensure_ascii=False, indent=2)}")
    assert result['success'] == True

if __name__ == "__main__":
    print("开始运行 API 测试...")
    print(f"测试时间: {datetime.now()}")
    
    try:
        r = requests.get("http://localhost:5001/health")
        print(f"服务健康检查: {r.status_code}")
    except:
        print("错误：服务未启动，请先运行 python3 app.py")
        exit(1)
    
    test_risk_event_and_graylist()
    test_transaction_evaluation()
    test_review_and_remove()
    test_escalate_to_blacklist()
    test_idempotent()
    test_graylist_detail()
    test_daily_stats()
    
    print("\n" + "="*50)
    print("所有测试通过！✓")
    print("="*50)
