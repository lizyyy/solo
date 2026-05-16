import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api/v1"


def test_create_exception():
    print("=== 测试: 创建例外 ===")
    
    recovery_date = (datetime.utcnow() + timedelta(days=7)).isoformat()
    payload = {
        "rule_name": "customer_email_valid",
        "field_path": "customer.email",
        "exception_condition": {
            "operator": "equals",
            "value": "test@example.com"
        },
        "recovery_date": recovery_date,
        "description": "测试客户临时例外",
        "created_by": "admin",
        "idempotency_key": "test_create_001"
    }
    
    response = requests.post(f"{BASE_URL}/exceptions", json=payload)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"创建成功 - 例外ID: {data['id']}, 状态: {data['status']}")
        
        print("\n=== 测试: 幂等性 - 重复提交 ===")
        response2 = requests.post(f"{BASE_URL}/exceptions", json=payload)
        print(f"重复提交状态码: {response2.status_code}")
        data2 = response2.json()
        print(f"返回相同ID: {data2['id'] == data['id']}")
        return data['id']
    else:
        print(f"错误: {response.text}")
        return None


def test_get_exception(exception_id):
    print("\n=== 测试: 查询单个例外 ===")
    response = requests.get(f"{BASE_URL}/exceptions/{exception_id}")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"规则名称: {data['rule_name']}")
        print(f"字段路径: {data['field_path']}")
        print(f"状态: {data['status']}")


def test_list_exceptions():
    print("\n=== 测试: 查询例外列表 ===")
    params = {
        "rule_name": "customer",
        "page": 1,
        "page_size": 10
    }
    response = requests.get(f"{BASE_URL}/exceptions", params=params)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"总数: {data['total']}")
        print(f"当前页条数: {len(data['items'])}")


def test_status_transition(exception_id):
    print("\n=== 测试: 状态推进 ===")
    payload = {
        "target_status": "active",
        "reviewed_by": "reviewer1",
        "review_comment": "已复核，同意激活",
        "idempotency_key": "test_status_001"
    }
    response = requests.post(f"{BASE_URL}/exceptions/{exception_id}/status", json=payload)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"新状态: {data['status']}")
        print(f"复核人: {data['reviewed_by']}")
        
        print("\n=== 测试: 幂等性 - 重复状态推进 ===")
        response2 = requests.post(f"{BASE_URL}/exceptions/{exception_id}/status", json=payload)
        print(f"重复提交状态码: {response2.status_code}")
        data2 = response2.json()
        print(f"状态未变化: {data2['status'] == data['status']}")


def test_match_exception():
    print("\n=== 测试: 例外匹配 ===")
    payload = {
        "rule_name": "customer_email_valid",
        "field_path": "customer.email",
        "record_data": {
            "customer": {
                "email": "test@example.com"
            }
        }
    }
    response = requests.post(f"{BASE_URL}/exceptions/match", json=payload)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"是否匹配: {data['matched']}")
        if data['matched']:
            print(f"匹配的例外ID: {data['exception_id']}")


def test_create_hit_record(exception_id):
    print("\n=== 测试: 创建命中记录 ===")
    payload = {
        "exception_id": exception_id,
        "record_key": "customer_12345",
        "record_data": {
            "customer_id": 12345,
            "email": "test@example.com",
            "name": "Test User"
        }
    }
    response = requests.post(f"{BASE_URL}/exceptions/{exception_id}/hit-records", json=payload)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"命中记录ID: {data['id']}")
        return data['id']
    return None


def test_list_hit_records(exception_id):
    print("\n=== 测试: 查询命中记录 ===")
    response = requests.get(f"{BASE_URL}/exceptions/{exception_id}/hit-records")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"命中记录总数: {data['total']}")


def test_manual_correction(exception_id, hit_record_id):
    print("\n=== 测试: 人工修正 ===")
    payload = {
        "hit_record_ids": [hit_record_id],
        "correction_note": "已人工审核并修正数据",
        "corrected_by": "operator1",
        "idempotency_key": "test_correction_001"
    }
    response = requests.post(f"{BASE_URL}/exceptions/{exception_id}/manual-correction", json=payload)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"修正记录数: {data['corrected_count']}")


def test_statistics(exception_id):
    print("\n=== 测试: 命中统计 ===")
    response = requests.get(f"{BASE_URL}/exceptions/{exception_id}/statistics")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"总命中数: {data['total_hits']}")
        print(f"已恢复数: {data['recovered_count']}")
        print(f"待处理数: {data['pending_count']}")


def test_handling_logs(exception_id):
    print("\n=== 测试: 异常处理日志 ===")
    response = requests.get(f"{BASE_URL}/exceptions/{exception_id}/handling-logs")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"日志总数: {data['total']}")
        for log in data['items'][:3]:
            print(f"  - {log['action']}: {log['result']} (by {log['handled_by']})")


def test_export(exception_id):
    print("\n=== 测试: 导出报告 ===")
    payload = {
        "exception_ids": [exception_id],
        "include_hit_records": True,
        "include_handling_logs": True,
        "format": "excel"
    }
    response = requests.post(f"{BASE_URL}/exceptions/export", json=payload)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"导出文件名: {data['file_name']}")
        print(f"导出例外数: {data['total_exceptions']}")
        print(f"报告ID: {data['report_id']}")


def test_check_expired():
    print("\n=== 测试: 到期恢复检查 ===")
    response = requests.post(f"{BASE_URL}/exceptions/check-expired")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"到期例外数: {data['expired_count']}")


def main():
    print("=" * 60)
    print("数据质量例外API 功能测试")
    print("=" * 60)
    
    try:
        requests.get("http://localhost:8000/health")
    except:
        print("错误: 请先启动服务: python main.py")
        return
    
    exception_id = test_create_exception()
    if not exception_id:
        return
    
    test_get_exception(exception_id)
    test_list_exceptions()
    test_status_transition(exception_id)
    test_match_exception()
    
    hit_record_id = test_create_hit_record(exception_id)
    test_list_hit_records(exception_id)
    
    if hit_record_id:
        test_manual_correction(exception_id, hit_record_id)
    
    test_statistics(exception_id)
    test_handling_logs(exception_id)
    test_export(exception_id)
    test_check_expired()
    
    print("\n" + "=" * 60)
    print("测试完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
