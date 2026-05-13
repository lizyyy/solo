import requests
import json
from datetime import datetime


BASE_URL = "http://localhost:8000"


def print_response(name, response):
    print(f"\n{'='*60}")
    print(f"场景: {name}")
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    print(f"{'='*60}\n")


def test_normal_scenario():
    headers = {"X-User-Id": "admin_001"}
    
    create_rule_data = {
        "name": "用户信息脱敏规则",
        "description": "对用户手机号、身份证号、银行卡号进行脱敏",
        "api_path": "/api/user/profile",
        "method": "POST",
        "fields": [
            {"path": "user.contact.phone", "level": "mask"},
            {"path": "user.identity.id_card", "level": "hash"},
            {"path": "user.finance.bank_card", "level": "mask"}
        ],
        "allowed_callers": ["service_order", "service_user"]
    }
    
    response = requests.post(f"{BASE_URL}/api/v1/rules", json=create_rule_data, headers=headers)
    print_response("1. 创建脱敏规则", response)
    
    rule_id = response.json()["rule_id"]
    
    response = requests.post(f"{BASE_URL}/api/v1/rules/{rule_id}/approve", headers=headers)
    print_response("2. 审批激活规则", response)
    
    validate_data = {
        "rule_id": rule_id,
        "caller": "service_order",
        "request_id": f"req_{int(datetime.now().timestamp())}",
        "api_path": "/api/user/profile",
        "data": {
            "user": {
                "name": "张三",
                "contact": {
                    "phone": "13812345678",
                    "email": "zhangsan@example.com"
                },
                "identity": {
                    "id_card": "110101199001011234"
                },
                "finance": {
                    "bank_card": "6222021234567890123"
                }
            }
        }
    }
    
    response = requests.post(f"{BASE_URL}/api/v1/validate", json=validate_data)
    print_response("3. 正常脱敏请求 - 手机号被掩码、身份证被哈希", response)


def test_exception_scenario():
    headers = {"X-User-Id": "admin_001"}
    
    validate_data = {
        "rule_id": "non_existent_rule",
        "caller": "service_order",
        "request_id": f"req_err_{int(datetime.now().timestamp())}",
        "api_path": "/api/user/profile",
        "data": {"user": {"name": "张三"}}
    }
    
    response = requests.post(f"{BASE_URL}/api/v1/validate", json=validate_data)
    print_response("4. 异常场景 - 规则不存在", response)
    
    create_rule_data = {
        "name": "受限调用方规则",
        "api_path": "/api/secret/data",
        "fields": [{"path": "secret.value", "level": "remove"}],
        "allowed_callers": ["only_me"]
    }
    response = requests.post(f"{BASE_URL}/api/v1/rules", json=create_rule_data, headers=headers)
    rule_id = response.json()["rule_id"]
    requests.post(f"{BASE_URL}/api/v1/rules/{rule_id}/approve", headers=headers)
    
    validate_data = {
        "rule_id": rule_id,
        "caller": "hacker_service",
        "request_id": f"req_auth_{int(datetime.now().timestamp())}",
        "api_path": "/api/secret/data",
        "data": {"secret": {"value": "very_secret"}}
    }
    
    response = requests.post(f"{BASE_URL}/api/v1/validate", json=validate_data)
    print_response("5. 异常场景 - 调用方无权限", response)
    
    create_rule_data2 = {
        "name": "未激活规则",
        "api_path": "/api/test/data",
        "fields": [{"path": "test.field", "level": "mask"}],
        "allowed_callers": []
    }
    response = requests.post(f"{BASE_URL}/api/v1/rules", json=create_rule_data2, headers=headers)
    rule_id2 = response.json()["rule_id"]
    
    validate_data2 = {
        "rule_id": rule_id2,
        "caller": "any_service",
        "request_id": f"req_inactive_{int(datetime.now().timestamp())}",
        "api_path": "/api/test/data",
        "data": {"test": {"field": "value"}}
    }
    
    response = requests.post(f"{BASE_URL}/api/v1/validate", json=validate_data2)
    print_response("6. 异常场景 - 规则未激活(DRAFT状态)", response)


def test_duplicate_scenario():
    headers = {"X-User-Id": "admin_001"}
    
    create_rule_data = {
        "name": "去重测试规则",
        "api_path": "/api/order/detail",
        "fields": [{"path": "order.customer.phone", "level": "mask"}],
        "allowed_callers": []
    }
    response = requests.post(f"{BASE_URL}/api/v1/rules", json=create_rule_data, headers=headers)
    rule_id = response.json()["rule_id"]
    requests.post(f"{BASE_URL}/api/v1/rules/{rule_id}/approve", headers=headers)
    
    duplicate_req_id = f"req_dup_{int(datetime.now().timestamp())}"
    
    validate_data = {
        "rule_id": rule_id,
        "caller": "service_order",
        "request_id": duplicate_req_id,
        "api_path": "/api/order/detail",
        "data": {
            "order": {
                "id": "ORD123456",
                "customer": {"phone": "13987654321"}
            }
        }
    }
    
    response = requests.post(f"{BASE_URL}/api/v1/validate", json=validate_data)
    print_response("7. 重复请求场景 - 第一次请求", response)
    
    response = requests.post(f"{BASE_URL}/api/v1/validate", json=validate_data)
    print_response("8. 重复请求场景 - 第二次请求(相同request_id，返回缓存)", response)


def test_manual_processing():
    headers = {"X-User-Id": "admin_001"}
    
    print("\n" + "="*60)
    print("场景: 9. 人工处理 - 审计查询")
    print("="*60)
    
    response = requests.get(f"{BASE_URL}/api/v1/records")
    print(f"查询所有访问记录: {len(response.json())} 条记录")
    
    response = requests.get(f"{BASE_URL}/api/v1/rules")
    print(f"查询所有规则: {len(response.json())} 条规则")
    
    for rule in response.json():
        print(f"  - {rule['name']} ({rule['rule_id']}): {rule['status']}")
    
    print("\n" + "="*60)
    print("一条会被拦截的路径示例:")
    print("路径: user.contact.phone")
    print("脱敏级别: mask (掩码)")
    print("原始值: 13812345678")
    print("脱敏后: 1********8")
    print("="*60 + "\n")


if __name__ == "__main__":
    print("按需脱敏代理 API - 测试数据生成")
    print("请先启动服务: uvicorn main:app --reload")
    print("="*60)
    
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("服务已启动，开始执行测试...\n")
            
            test_normal_scenario()
            test_exception_scenario()
            test_duplicate_scenario()
            test_manual_processing()
            
            print("\n所有测试场景执行完成!")
        else:
            print("服务响应异常，请检查启动状态")
    except Exception as e:
        print(f"无法连接到服务: {e}")
        print("请先执行: uvicorn main:app --reload")
