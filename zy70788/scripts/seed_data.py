#!/usr/bin/env python3
import requests
import json
import time
from typing import List, Dict

BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"

WEBHOOK_EVENTS = [
    {
        "event_type": "payment.completed",
        "request_method": "POST",
        "request_url": "https://api.example.com/webhook/payment",
        "payload": {
            "id": "pay_001",
            "amount": 99.99,
            "currency": "CNY",
            "status": "completed",
            "created_at": "2024-01-15T10:30:00Z"
        }
    },
    {
        "event_type": "payment.failed",
        "request_method": "POST",
        "request_url": "https://api.example.com/webhook/payment",
        "payload": {
            "id": "pay_002",
            "amount": 199.99,
            "currency": "CNY",
            "status": "failed",
            "error_code": "INSUFFICIENT_FUNDS",
            "created_at": "2024-01-15T11:00:00Z"
        }
    },
    {
        "event_type": "subscription.created",
        "request_method": "POST",
        "request_url": "https://api.example.com/webhook/subscription",
        "payload": {
            "id": "sub_001",
            "plan_id": "premium_monthly",
            "customer_id": "cust_001",
            "status": "active",
            "start_date": "2024-01-15"
        }
    },
    {
        "event_type": "subscription.cancelled",
        "request_method": "POST",
        "request_url": "https://api.example.com/webhook/subscription",
        "payload": {
            "id": "sub_002",
            "plan_id": "basic_yearly",
            "customer_id": "cust_002",
            "status": "cancelled",
            "end_date": "2024-02-15"
        }
    },
    {
        "event_type": "user.created",
        "request_method": "POST",
        "request_url": "https://api.example.com/webhook/user",
        "payload": {
            "id": "user_001",
            "email": "user@example.com",
            "name": "张三",
            "role": "customer",
            "created_at": "2024-01-15T09:00:00Z"
        }
    }
]

SIGNATURE_HEADERS_TEMPLATE = {
    "X-Webhook-Signature": "sha256={signature}",
    "X-Timestamp": "{timestamp}",
    "X-Event-Id": "{event_id}"
}

REQUEST_HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Webhook-Service/2.0",
    "X-Provider": "ExamplePay"
}


def generate_signature(payload: str, timestamp: str) -> str:
    import hashlib
    import hmac
    secret = "test_secret_key_123"
    message = f"{timestamp}.{payload}"
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()


def create_fixture(event: Dict, index: int) -> Dict:
    timestamp = str(int(time.time()) + index * 60)
    payload_str = json.dumps(event["payload"], ensure_ascii=False)
    signature = generate_signature(payload_str, timestamp)
    
    signature_headers = {
        "X-Webhook-Signature": f"sha256={signature}",
        "X-Timestamp": timestamp,
        "X-Event-Id": f"evt_{index:03d}"
    }
    
    return {
        "request_method": event["request_method"],
        "request_url": event["request_url"],
        "request_headers": REQUEST_HEADERS.copy(),
        "signature_headers": signature_headers,
        "raw_payload": payload_str,
        "handler": "seed_script"
    }


def seed_fixtures(count: int = 5):
    print(f"开始造数，准备创建 {count} 个夹具...")
    
    created_fixtures = []
    
    for i in range(count):
        event = WEBHOOK_EVENTS[i % len(WEBHOOK_EVENTS)]
        fixture_data = create_fixture(event, i)
        
        try:
            response = requests.post(
                f"{BASE_URL}{API_PREFIX}/fixtures/",
                json=fixture_data,
                timeout=10
            )
            
            if response.status_code == 201:
                fixture = response.json()
                created_fixtures.append(fixture)
                print(f"✓ 创建夹具: {fixture['fixture_id']} - {event['event_type']}")
            else:
                print(f"✗ 创建失败: {response.status_code} - {response.text}")
                
        except Exception as e:
            print(f"✗ 请求失败: {e}")
        
        time.sleep(0.1)
    
    print(f"\n造数完成，共创建 {len(created_fixtures)} 个夹具")
    
    if created_fixtures:
        print("\n进行状态推进演示...")
        
        first_id = created_fixtures[0]["fixture_id"]
        response = requests.patch(
            f"{BASE_URL}{API_PREFIX}/fixtures/{first_id}/status/",
            json={"status": "normalized", "handler": "seed_script"}
        )
        if response.status_code == 200:
            print(f"✓ {first_id} → normalized")
        
        if len(created_fixtures) > 1:
            second_id = created_fixtures[1]["fixture_id"]
            response = requests.patch(
                f"{BASE_URL}{API_PREFIX}/fixtures/{second_id}/status/",
                json={"status": "verified", "handler": "seed_script"}
            )
            if response.status_code == 200:
                print(f"✓ {second_id} → verified")
        
        print("\n生成报告演示...")
        response = requests.post(f"{BASE_URL}{API_PREFIX}/fixtures/{first_id}/report/")
        if response.status_code == 201:
            print(f"✓ 已生成 {first_id} 的录制报告")
        
        print("\n生成重放脚本演示...")
        response = requests.post(
            f"{BASE_URL}{API_PREFIX}/fixtures/{first_id}/replay-script/",
            json={"target_url": "https://test.example.com/webhook"}
        )
        if response.status_code == 200:
            print(f"✓ 已生成 {first_id} 的重放脚本")
    
    print("\n造数流程完成！")


def list_all_fixtures():
    print("\n查询所有夹具...")
    response = requests.get(f"{BASE_URL}{API_PREFIX}/fixtures/", timeout=10)
    if response.status_code == 200:
        fixtures = response.json()
        print(f"共 {len(fixtures)} 个夹具:")
        for f in fixtures:
            print(f"  - {f['fixture_id']} [{f['status']}]")


if __name__ == "__main__":
    import sys
    
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    
    seed_fixtures(count)
    list_all_fixtures()
