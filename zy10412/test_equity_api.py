#!/usr/bin/env python3
"""
权益用量对账API - 测试脚本与样例数据
"""

import json
import requests
from datetime import datetime, timedelta

BASE_URL = "http://localhost:5000/api"


def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")
    print(f"Status Code: {response.status_code}")
    try:
        data = response.json()
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return data
    except:
        print(response.text)
        return None


def test_health_check():
    print("\n" + "="*60)
    print("  0. 健康检查")
    print("="*60)
    response = requests.get(f"{BASE_URL}/health")
    print_response("健康检查", response)


def test_full_workflow():
    print("\n" + "="*60)
    print("  完整工作流演示")
    print("="*60)
    
    account_id = None
    package_id = None
    detail_id = None
    correction_id = None
    reconciliation_id = None
    
    print("\n--- 1. 创建客户账号 ---")
    response = requests.post(f"{BASE_URL}/accounts", json={
        "customer_name": "某某科技有限公司"
    })
    data = print_response("创建账号", response)
    if data and data.get("success"):
        account_id = data["data"]["account_id"]
        print(f"创建账号成功: {account_id}")
    
    if not account_id:
        print("账号创建失败，终止测试")
        return
    
    print("\n--- 2. 创建权益包 ---")
    valid_from = datetime.now().isoformat()
    valid_to = (datetime.now() + timedelta(days=365)).isoformat()
    response = requests.post(f"{BASE_URL}/packages", json={
        "account_id": account_id,
        "package_type": "API调用套餐-企业版",
        "total_quota": 1000,
        "valid_from": valid_from,
        "valid_to": valid_to
    })
    data = print_response("创建权益包", response)
    if data and data.get("success"):
        package_id = data["data"]["package_id"]
        print(f"创建权益包成功: {package_id}")
    
    if not package_id:
        print("权益包创建失败，终止测试")
        return
    
    print("\n--- 3. 查询账号下的权益包 ---")
    response = requests.get(f"{BASE_URL}/accounts/{account_id}/packages")
    print_response("查询权益包列表", response)
    
    print("\n--- 4. 执行正常扣减 (扣减理由: 文本生成API调用) ---")
    response = requests.post(f"{BASE_URL}/deductions", json={
        "account_id": account_id,
        "package_id": package_id,
        "request_id": "req_001",
        "api_name": "text_generation",
        "deducted_amount": 10,
        "deducted_reason": "文本生成API调用 - 生成产品描述文案",
        "operator": "system"
    })
    data = print_response("扣减1", response)
    if data and data.get("detail_id"):
        detail_id = data["detail_id"]
    
    print("\n--- 5. 执行第二次扣减 (扣减理由: 图像识别API调用) ---")
    response = requests.post(f"{BASE_URL}/deductions", json={
        "account_id": account_id,
        "package_id": package_id,
        "request_id": "req_002",
        "api_name": "image_recognition",
        "deducted_amount": 20,
        "deducted_reason": "图像识别API调用 - 批量识别产品图片",
        "operator": "system"
    })
    print_response("扣减2", response)
    
    print("\n--- 6. 测试重复请求拦截 ---")
    response = requests.post(f"{BASE_URL}/deductions", json={
        "account_id": account_id,
        "package_id": package_id,
        "request_id": "req_001",
        "api_name": "text_generation",
        "deducted_amount": 10,
        "deducted_reason": "重复调用测试"
    })
    print_response("重复请求拦截", response)
    
    print("\n--- 7. 测试额度不足的待复核状态 ---")
    response = requests.post(f"{BASE_URL}/deductions", json={
        "account_id": account_id,
        "package_id": package_id,
        "request_id": "req_003",
        "api_name": "large_batch_processing",
        "deducted_amount": 2000,
        "deducted_reason": "大批量数据处理 - 超出额度待审核"
    })
    print_response("额度不足待复核", response)
    
    print("\n--- 8. 查询扣减明细列表 ---")
    response = requests.get(f"{BASE_URL}/deductions", params={
        "account_id": account_id,
        "package_id": package_id
    })
    print_response("扣减明细列表", response)
    
    print("\n--- 9. 查询单个扣减明细 ---")
    if detail_id:
        response = requests.get(f"{BASE_URL}/deductions/{detail_id}")
        print_response("单个扣减明细", response)
    
    print("\n--- 10. 查询当前权益包余额 ---")
    response = requests.get(f"{BASE_URL}/packages/{package_id}")
    print_response("权益包当前状态", response)
    
    print("\n--- 11. 客户反馈扣错了，创建修正申请 ---")
    if detail_id:
        response = requests.post(f"{BASE_URL}/corrections", json={
            "account_id": account_id,
            "package_id": package_id,
            "detail_id": detail_id,
            "requested_by": "customer_service_001",
            "correction_type": "refund",
            "correction_amount": 10,
            "reason": "客户反馈扣减错误：该次API调用实际处理失败，不应扣减权益"
        })
        data = print_response("创建修正申请", response)
        if data and data.get("success"):
            correction_id = data["data"]["correction_id"]
            print(f"修正申请ID: {correction_id}")
    
    print("\n--- 12. 查询待审批的修正申请 ---")
    response = requests.get(f"{BASE_URL}/corrections", params={
        "status": "pending"
    })
    print_response("待审批修正申请", response)
    
    print("\n--- 13. 审批修正申请 - 通过 ---")
    if correction_id:
        response = requests.post(f"{BASE_URL}/corrections/{correction_id}/review", json={
            "reviewed_by": "manager_001",
            "approve": True,
            "review_comment": "经核实，该次调用确实失败，同意退还权益"
        })
        print_response("审批修正申请", response)
    
    print("\n--- 14. 审批后再次查询权益包余额 ---")
    response = requests.get(f"{BASE_URL}/packages/{package_id}")
    print_response("权益包余额（修正后）", response)
    
    print("\n--- 15. 执行余额重算 ---")
    response = requests.post(f"{BASE_URL}/packages/{package_id}/recalculate")
    print_response("余额重算结果", response)
    
    print("\n--- 16. 生成对账报告 ---")
    start_time = (datetime.now() - timedelta(days=1)).isoformat()
    end_time = (datetime.now() + timedelta(days=1)).isoformat()
    response = requests.post(f"{BASE_URL}/reconciliations", json={
        "account_id": account_id,
        "package_id": package_id,
        "start_time": start_time,
        "end_time": end_time,
        "generated_by": "auditor_001"
    })
    data = print_response("生成对账报告", response)
    if data and data.get("success"):
        reconciliation_id = data["data"]["reconciliation_id"]
    
    print("\n--- 17. 查询对账报告列表 ---")
    response = requests.get(f"{BASE_URL}/reconciliations", params={
        "account_id": account_id
    })
    print_response("对账报告列表", response)
    
    print("\n--- 18. 导出对账报告（含详细明细）---")
    if reconciliation_id:
        response = requests.get(f"{BASE_URL}/reconciliations/{reconciliation_id}/export")
        print_response("导出对账报告", response)
    
    print("\n" + "="*60)
    print("  测试完成！")
    print("="*60)
    print(f"""
测试摘要：
- 客户账号ID: {account_id}
- 权益包ID: {package_id}
- 扣减明细ID: {detail_id}
- 修正申请ID: {correction_id}
- 对账报告ID: {reconciliation_id}

所有数据已持久化到 SQLite 数据库，重启服务后仍可查询。
""")


def test_status_queries():
    print("\n" + "="*60)
    print("  按状态查询演示")
    print("="*60)
    
    print("\n--- 查询所有成功的扣减 ---")
    response = requests.get(f"{BASE_URL}/deductions", params={
        "status": "success"
    })
    print_response("成功扣减列表", response)
    
    print("\n--- 查询所有已补偿的扣减 ---")
    response = requests.get(f"{BASE_URL}/deductions", params={
        "status": "compensated"
    })
    print_response("已补偿扣减列表", response)
    
    print("\n--- 查询所有待复核的扣减 ---")
    response = requests.get(f"{BASE_URL}/deductions", params={
        "status": "pending_review"
    })
    print_response("待复核扣减列表", response)


if __name__ == "__main__":
    print("权益用量对账API测试脚本")
    print("请确保服务已启动: python equity_reconciliation.py")
    
    try:
        test_health_check()
        test_full_workflow()
        test_status_queries()
    except requests.exceptions.ConnectionError:
        print("\n错误: 无法连接到服务，请先启动服务！")
        print("启动命令: python equity_reconciliation.py")
