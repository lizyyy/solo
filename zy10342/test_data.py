#!/usr/bin/env python3
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"

def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"{'='*60}")
    print(f"Status: {response.status_code}")
    try:
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except:
        print(response.text)

def test_normal_workflow():
    print("\n" + "#"*60)
    print("# 测试1: 正常工作流程 - 创建 -> 发布 -> 推进状态 -> 解除")
    print("#"*60)
    
    event_id = f"FAULT-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    create_data = {
        "event_id": event_id,
        "title": "支付接口超时故障",
        "description": "用户支付时出现超时，成功率下降至60%",
        "impact_level": "high",
        "created_by": "admin@example.com",
        "interfaces": [
            {
                "api_path": "/api/v1/payment/create",
                "api_method": "POST",
                "service_name": "payment-service",
                "description": "创建支付订单"
            },
            {
                "api_path": "/api/v1/payment/query",
                "api_method": "GET",
                "service_name": "payment-service",
                "description": "查询支付状态"
            }
        ],
        "customers": [
            {
                "customer_id": "CUST001",
                "customer_name": "电商平台A",
                "contact_email": "a@example.com",
                "contact_phone": "13800000001"
            },
            {
                "customer_id": "CUST002",
                "customer_name": "电商平台B",
                "contact_email": "b@example.com",
                "contact_phone": "13800000002"
            }
        ]
    }
    
    response = requests.post(f"{BASE_URL}/events", json=create_data)
    print_response("1. 创建故障事件", response)
    
    response = requests.get(f"{BASE_URL}/events/{event_id}/impact")
    print_response("2. 计算影响范围", response)
    
    publish_data = {
        "published_by": "admin@example.com",
        "change_log": "首次发布，确认影响范围"
    }
    response = requests.post(f"{BASE_URL}/events/{event_id}/publish", json=publish_data)
    print_response("3. 发布故障声明", response)
    
    status_data = {
        "status": "in_progress",
        "updated_by": "engineer@example.com",
        "comment": "已定位问题，正在修复数据库连接池"
    }
    response = requests.patch(f"{BASE_URL}/events/{event_id}/status", json=status_data)
    print_response("4. 推进状态至处理中", response)
    
    status_data = {
        "status": "resolving",
        "updated_by": "engineer@example.com",
        "comment": "修复已上线，观察恢复情况"
    }
    response = requests.patch(f"{BASE_URL}/events/{event_id}/status", json=status_data)
    print_response("5. 推进状态至待确认解除", response)
    
    resolve_data = {
        "confirmed_by": "admin@example.com",
        "resolution_note": "故障已完全恢复，支付成功率恢复至99.9%"
    }
    response = requests.post(f"{BASE_URL}/events/{event_id}/resolve", json=resolve_data)
    print_response("6. 确认解除", response)
    
    response = requests.get(f"{BASE_URL}/events/{event_id}/history")
    print_response("7. 查看历史记录", response)
    
    return event_id

def test_exception_cases():
    print("\n" + "#"*60)
    print("# 测试2: 异常返回场景")
    print("#"*60)
    
    response = requests.get(f"{BASE_URL}/events/NONEXISTENT")
    print_response("2.1 查询不存在的事件 - 应返回404", response)
    
    event_id = f"FAULT-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    create_data = {
        "event_id": event_id,
        "title": "测试异常",
        "description": "测试异常流程",
        "impact_level": "low",
        "created_by": "test@example.com"
    }
    response = requests.post(f"{BASE_URL}/events", json=create_data)
    print_response("2.2 创建草稿事件", response)
    
    resolve_data = {
        "confirmed_by": "admin@example.com",
        "resolution_note": "尝试直接解除草稿状态"
    }
    response = requests.post(f"{BASE_URL}/events/{event_id}/resolve", json=resolve_data)
    print_response("2.3 直接解除草稿状态 - 应返回400", response)
    
    status_data = {
        "status": "resolved",
        "updated_by": "admin@example.com"
    }
    response = requests.patch(f"{BASE_URL}/events/{event_id}/status", json=status_data)
    print_response("2.4 草稿直接跳到已解除 - 应返回400", response)
    
    response = requests.post(f"{BASE_URL}/events", json=create_data)
    print_response("2.5 重复创建相同event_id - 应返回400", response)

def test_idempotency():
    print("\n" + "#"*60)
    print("# 测试3: 幂等性测试 - 重复请求不产生脏数据")
    print("#"*60)
    
    event_id = f"FAULT-IDEM-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    idempotency_key = f"key-{datetime.now().timestamp()}"
    
    create_data = {
        "event_id": event_id,
        "title": "幂等性测试事件",
        "description": "测试重复提交",
        "impact_level": "medium",
        "created_by": "test@example.com"
    }
    
    headers = {"x-idempotency-key": idempotency_key}
    
    response1 = requests.post(f"{BASE_URL}/events", json=create_data, headers=headers)
    print_response("3.1 第一次提交", response1)
    
    response2 = requests.post(f"{BASE_URL}/events", json=create_data, headers=headers)
    print_response("3.2 第二次提交（相同幂等键）- 返回缓存数据，不创建新记录", response2)
    
    create_data["title"] = "修改后的标题"
    response3 = requests.post(f"{BASE_URL}/events", json=create_data, headers=headers)
    print_response("3.3 相同幂等键但不同数据 - 应返回400错误", response3)
    
    response = requests.get(f"{BASE_URL}/events")
    events = response.json()
    matching = [e for e in events if e["event_id"].startswith("FAULT-IDEM-")]
    print(f"\n3.4 验证数据库中只有1条记录: 实际有 {len(matching)} 条")

def test_manual_processing():
    print("\n" + "#"*60)
    print("# 测试4: 人工处理场景 - 添加接口、客户，创建新版本")
    print("#"*60)
    
    event_id = f"FAULT-MANUAL-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    create_data = {
        "event_id": event_id,
        "title": "用户服务异常",
        "description": "初始报告",
        "impact_level": "medium",
        "created_by": "operator@example.com"
    }
    response = requests.post(f"{BASE_URL}/events", json=create_data)
    print_response("4.1 创建初始事件", response)
    
    interfaces = [
        {
            "api_path": "/api/v1/user/login",
            "api_method": "POST",
            "service_name": "user-service",
            "description": "用户登录"
        },
        {
            "api_path": "/api/v1/user/info",
            "api_method": "GET",
            "service_name": "user-service",
            "description": "获取用户信息"
        }
    ]
    response = requests.post(f"{BASE_URL}/events/{event_id}/interfaces", json=interfaces)
    print_response("4.2 人工添加影响接口", response)
    
    customers = [
        {
            "customer_id": "CUST003",
            "customer_name": "小程序C",
            "contact_email": "c@example.com"
        }
    ]
    response = requests.post(f"{BASE_URL}/events/{event_id}/customers", json=customers)
    print_response("4.3 人工添加受影响客户", response)
    
    publish_data = {"published_by": "admin@example.com"}
    response = requests.post(f"{BASE_URL}/events/{event_id}/publish", json=publish_data)
    print_response("4.4 发布事件", response)
    
    version_data = {
        "version": 2,
        "title": "用户服务异常 - 影响范围扩大",
        "description": "问题影响扩大，注册接口也受影响，影响级别升级为high",
        "impact_level": "high",
        "created_by": "admin@example.com",
        "change_log": "新增注册接口受影响，升级为high级别"
    }
    response = requests.post(f"{BASE_URL}/events/{event_id}/versions", json=version_data)
    print_response("4.5 创建新版本（升级影响级别）", response)
    
    response = requests.get(f"{BASE_URL}/events/{event_id}")
    print_response("4.6 查看事件最新状态", response)

def test_customer_view():
    print("\n" + "#"*60)
    print("# 测试5: 客户视角查询")
    print("#"*60)
    
    response = requests.get(f"{BASE_URL}/events?customer_id=CUST001")
    print_response("5.1 查询客户CUST001相关的所有故障", response)
    
    response = requests.get(f"{BASE_URL}/events?status=published")
    print_response("5.2 查询所有已发布的故障", response)
    
    response = requests.get(f"{BASE_URL}/events?status=resolved")
    print_response("5.3 查询所有已解除的故障", response)

if __name__ == "__main__":
    print("接口故障声明 API - 测试数据脚本")
    print("请确保服务已启动: python main.py")
    print("\n按回车键开始测试...")
    input()
    
    try:
        test_normal_workflow()
        test_exception_cases()
        test_idempotency()
        test_manual_processing()
        test_customer_view()
        
        print("\n" + "="*60)
        print("所有测试完成！")
        print("="*60)
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器，请先启动服务: python main.py")
    except Exception as e:
        print(f"测试过程出错: {e}")
