#!/usr/bin/env python3
import json
import requests

BASE_URL = "http://localhost:8000"


def print_step(step: str, data: dict = None):
    print(f"\n{'='*60}")
    print(f"【问题流示例】{step}")
    print(f"{'='*60}")
    if data:
        print(json.dumps(data, ensure_ascii=False, indent=2))


def run_problem_flow():
    print_step("1. 创建第一个样本")
    create_data = {
        "http_method": "GET",
        "api_endpoint": "/api/v1/orders/999",
        "request_payload": json.dumps({}, ensure_ascii=False),
        "response_payload": json.dumps({
            "code": "NOT_FOUND",
            "message": "订单不存在"
        }, ensure_ascii=False),
        "error_code": "NOT_FOUND",
        "error_message": "订单不存在",
        "created_by": "developer_a",
        "retention_days": 30
    }
    response = requests.post(f"{BASE_URL}/api/samples", json=create_data)
    sample1 = response.json()
    sample1_id = sample1["id"]
    print(f"第一个样本 ID: {sample1_id}")

    print_step("2. 重复提交相同样本（去重测试）")
    response = requests.post(f"{BASE_URL}/api/samples", json=create_data)
    sample_dup = response.json()
    print(f"返回样本 ID: {sample_dup['id']}")
    print(f"是否与第一个相同: {sample_dup['id'] == sample1_id}")
    print("历史记录中会有重复提交记录")

    print_step("3. 状态流转错误测试 - 直接分类未校验的样本")
    classify_data = {
        "error_category": "not_found",
        "classified_by": "qa_lead"
    }
    response = requests.post(f"{BASE_URL}/api/samples/{sample1_id}/classify", json=classify_data)
    print(f"状态码: {response.status_code}")
    print(f"错误信息: {response.json()['detail']['error_message']}")

    print_step("4. 先校验，再尝试未复现就修复")
    validate_data = {
        "validated_by": "qa_engineer",
        "validation_notes": "有效样本"
    }
    response = requests.post(f"{BASE_URL}/api/samples/{sample1_id}/validate", json=validate_data)
    sample = response.json()
    print(f"校验后状态: {sample['status']}")

    classify_data = {
        "error_category": "not_found",
        "classified_by": "qa_lead"
    }
    response = requests.post(f"{BASE_URL}/api/samples/{sample1_id}/classify", json=classify_data)
    sample = response.json()
    print(f"分类后状态: {sample['status']}")

    response = requests.post(f"{BASE_URL}/api/samples/{sample1_id}/fix/start?operator=developer")
    print(f"状态码: {response.status_code}")
    print(f"错误信息: {response.json()['detail']['error_message']}")

    print_step("5. 复现失败后无法继续修复")
    response = requests.post(f"{BASE_URL}/api/samples/{sample1_id}/reproduce/start?operator=qa_engineer")
    sample = response.json()
    print(f"开始复现状态: {sample['status']}")

    reproduce_data = {
        "reproduce_steps": "1. 调用接口\n2. 无法复现",
        "reproduce_success": False,
        "reproduced_by": "qa_engineer"
    }
    response = requests.post(f"{BASE_URL}/api/samples/{sample1_id}/reproduce", json=reproduce_data)
    sample = response.json()
    print(f"复现结果状态: {sample['status']}")
    print(f"复现成功: {sample['reproduce_success']}")

    response = requests.post(f"{BASE_URL}/api/samples/{sample1_id}/fix/start?operator=developer")
    print(f"状态码: {response.status_code}")
    print(f"错误信息: {response.json()['detail']['error_message']}")

    print_step("6. 查看不存在的样本")
    response = requests.get(f"{BASE_URL}/api/samples/99999")
    print(f"状态码: {response.status_code}")
    print(f"错误信息: {response.json()['detail']['error_message']}")

    print_step("7. 查询所有样本列表")
    response = requests.get(f"{BASE_URL}/api/samples")
    result = response.json()
    print(f"总样本数: {result['total']}")
    for item in result['items']:
        print(f"  - ID: {item['id']}, 状态: {item['status']}, 创建人: {item['created_by']}")


if __name__ == "__main__":
    run_problem_flow()
