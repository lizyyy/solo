#!/usr/bin/env python3
import json
import requests
from datetime import datetime

BASE_URL = "http://localhost:8000"


def print_step(step: str, data: dict = None):
    print(f"\n{'='*60}")
    print(f"【成功流示例】{step}")
    print(f"{'='*60}")
    if data:
        print(json.dumps(data, ensure_ascii=False, indent=2))


def run_success_flow():
    print_step("1. 创建异常样本")
    create_data = {
        "http_method": "POST",
        "api_endpoint": "/api/v1/users",
        "request_payload": json.dumps({
            "name": "张三",
            "email": "zhangsan@example.com",
            "password": "SuperSecret123!",
            "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
        }, ensure_ascii=False),
        "response_payload": json.dumps({
            "code": "VALIDATION_ERROR",
            "message": "邮箱格式不正确",
            "details": {"field": "email"}
        }, ensure_ascii=False),
        "error_code": "VALIDATION_ERROR",
        "error_message": "邮箱格式不正确",
        "created_by": "developer_a",
        "retention_days": 60
    }
    response = requests.post(f"{BASE_URL}/api/samples", json=create_data)
    sample = response.json()
    sample_id = sample["id"]
    print(f"样本 ID: {sample_id}")
    print(f"状态: {sample['status']}")
    print(f"脱敏后载荷: {sample['sanitized_payload']}")

    print_step("2. 校验样本")
    validate_data = {
        "validated_by": "qa_engineer",
        "validation_notes": "确认为有效异常，字段校验逻辑缺失"
    }
    response = requests.post(f"{BASE_URL}/api/samples/{sample_id}/validate", json=validate_data)
    sample = response.json()
    print(f"状态: {sample['status']}")
    print(f"处理人: {sample['handled_by']}")

    print_step("3. 分类样本")
    classify_data = {
        "error_category": "validation",
        "classified_by": "qa_lead"
    }
    response = requests.post(f"{BASE_URL}/api/samples/{sample_id}/classify", json=classify_data)
    sample = response.json()
    print(f"状态: {sample['status']}")
    print(f"错误分类: {sample['error_category']}")

    print_step("4. 开始复现")
    response = requests.post(f"{BASE_URL}/api/samples/{sample_id}/reproduce/start?operator=qa_engineer")
    sample = response.json()
    print(f"状态: {sample['status']}")

    print_step("5. 提交复现结果（成功）")
    reproduce_data = {
        "reproduce_steps": "1. 调用 POST /api/v1/users\n2. 传入非法邮箱格式\n3. 观察返回错误",
        "reproduce_success": True,
        "reproduced_by": "qa_engineer"
    }
    response = requests.post(f"{BASE_URL}/api/samples/{sample_id}/reproduce", json=reproduce_data)
    sample = response.json()
    print(f"状态: {sample['status']}")
    print(f"复现成功: {sample['reproduce_success']}")

    print_step("6. 开始修复")
    response = requests.post(f"{BASE_URL}/api/samples/{sample_id}/fix/start?operator=developer_b")
    sample = response.json()
    print(f"状态: {sample['status']}")

    print_step("7. 提交修复结果")
    fix_data = {
        "fix_issue_id": "ISSUE-12345",
        "fix_description": "添加邮箱格式正则校验",
        "fixed_by": "developer_b"
    }
    response = requests.post(f"{BASE_URL}/api/samples/{sample_id}/fix", json=fix_data)
    sample = response.json()
    print(f"状态: {sample['status']}")
    print(f"Issue ID: {sample['fix_issue_id']}")
    print(f"修复时间: {sample['fixed_at']}")

    print_step("8. 归档样本")
    response = requests.post(f"{BASE_URL}/api/samples/{sample_id}/archive?operator=qa_lead")
    sample = response.json()
    print(f"状态: {sample['status']}")

    print_step("9. 查看完整历史记录")
    response = requests.get(f"{BASE_URL}/api/samples/{sample_id}")
    sample = response.json()
    print("历史记录:")
    for history in sample["history_records"]:
        print(f"  - [{history['created_at']}] {history['status']}: {history['description']} (操作人: {history['operated_by']})")


if __name__ == "__main__":
    run_success_flow()
