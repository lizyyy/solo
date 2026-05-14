import requests
import json
from decimal import Decimal

BASE_URL = 'http://localhost:5001/api/v1'

def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"{'='*60}")
    print(f"Status: {response.status_code}")
    try:
        data = response.json()
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except:
        print(response.text)
    print()

def test_full_flow():
    print("开始测试完整流程：创建账户 -> 创建分期 -> 验证摊销 -> 提前还款 -> 验证额度恢复")
    
    headers = {'Content-Type': 'application/json'}
    
    print("\n" + "="*60)
    print("1. 健康检查")
    print("="*60)
    response = requests.get(f"{BASE_URL}/health")
    print_response("健康检查", response)
    
    print("\n" + "="*60)
    print("2. 创建信用卡账户")
    print("="*60)
    account_data = {
        "account_number": "ACC20250509001",
        "card_number": "6222****1234",
        "customer_name": "张三",
        "credit_limit": 100000.00,
        "used_credit": 0.00
    }
    response = requests.post(f"{BASE_URL}/accounts", headers=headers, json=account_data)
    print_response("创建账户", response)
    account = response.json()['data']
    account_id = account['id']
    print(f"账户ID: {account_id}")
    
    print("\n" + "="*60)
    print("3. 创建分期计划（10000元，分3期，费率0.6%/月）")
    print("="*60)
    installment_data = {
        "account_id": account_id,
        "original_transaction_id": "TXN20250509001",
        "original_amount": 10000.00,
        "installment_months": 3,
        "fee_rate": 0.006,
        "start_date": "2025-05-09"
    }
    response = requests.post(f"{BASE_URL}/installments", headers=headers, json=installment_data)
    print_response("创建分期计划", response)
    plan = response.json()['data']
    plan_id = plan['id']
    print(f"分期计划ID: {plan_id}")
    
    print("\n" + "="*60)
    print("4. 查看分期计划详情（含摊销表）")
    print("="*60)
    response = requests.get(f"{BASE_URL}/installments/{plan_id}?include_amortizations=true")
    print_response("分期计划详情", response)
    
    print("\n" + "="*60)
    print("5. 查看账户分期列表")
    print("="*60)
    response = requests.get(f"{BASE_URL}/accounts/{account_id}/installments")
    print_response("账户分期列表", response)
    
    print("\n" + "="*60)
    print("6. 验证手续费摊销表")
    print("="*60)
    response = requests.get(f"{BASE_URL}/validation/installments/{plan_id}/amortization")
    print_response("摊销表验证", response)
    validation_data = response.json()['data']
    print(f"验证结果: {'通过' if validation_data['is_valid'] else '失败'}")
    
    print("\n" + "="*60)
    print("7. 查看账户账单记录")
    print("="*60)
    response = requests.get(f"{BASE_URL}/accounts/{account_id}/bills")
    print_response("账户账单", response)
    
    print("\n" + "="*60)
    print("8. 执行提前还款（3期后提前结清）")
    print("="*60)
    early_settle_data = {
        "reason": "客户资金充裕，主动提前结清",
        "transaction_id": "ES20250509001"
    }
    response = requests.post(
        f"{BASE_URL}/installments/{plan_id}/early-settle",
        headers=headers,
        json=early_settle_data
    )
    print_response("提前还款", response)
    revocation = response.json()['data']
    print(f"撤销记录ID: {revocation['id']}")
    
    print("\n" + "="*60)
    print("9. 查看分期计划状态变化")
    print("="*60)
    response = requests.get(f"{BASE_URL}/installments/{plan_id}")
    print_response("分期计划状态", response)
    
    print("\n" + "="*60)
    print("10. 查看账户额度恢复情况")
    print("="*60)
    response = requests.get(f"{BASE_URL}/accounts/{account_id}")
    print_response("账户详情", response)
    
    print("\n" + "="*60)
    print("11. 执行综合验证（摊销、还款链路、账单一致性、额度恢复）")
    print("="*60)
    response = requests.get(f"{BASE_URL}/validation/installments/{plan_id}/comprehensive")
    print_response("综合验证", response)
    
    print("\n" + "="*60)
    print("12. 查看待处理任务（提前还款会生成待处理任务）")
    print("="*60)
    response = requests.get(f"{BASE_URL}/pending-tasks")
    print_response("待处理任务", response)
    
    print("\n" + "="*60)
    print("13. 查看异常记录（如有校验问题会记录）")
    print("="*60)
    response = requests.get(f"{BASE_URL}/exceptions")
    print_response("异常记录", response)
    
    print("\n" + "="*60)
    print("14. 撤销记录汇总")
    print("="*60)
    response = requests.get(f"{BASE_URL}/reports/revocation-summary")
    print_response("撤销汇总", response)
    
    print("\n" + "="*60)
    print("15. 异常统计")
    print("="*60)
    response = requests.get(f"{BASE_URL}/exceptions/stats")
    print_response("异常统计", response)
    
    print("\n" + "="*60)
    print("16. 待处理任务统计")
    print("="*60)
    response = requests.get(f"{BASE_URL}/pending-tasks/stats")
    print_response("任务统计", response)
    
    print("\n" + "="*60)
    print("测试流程完成！")
    print("="*60)

def test_revocation_flow():
    print("\n\n" + "#"*60)
    print("# 测试第二个流程：创建分期 -> 撤销（不是提前还款）")
    print("#"*60)
    
    headers = {'Content-Type': 'application/json'}
    
    print("\n1. 创建另一个账户")
    account_data = {
        "account_number": "ACC20250509002",
        "card_number": "6222****5678",
        "customer_name": "李四",
        "credit_limit": 200000.00,
        "used_credit": 0.00
    }
    response = requests.post(f"{BASE_URL}/accounts", headers=headers, json=account_data)
    account = response.json()['data']
    account_id = account['id']
    print(f"账户ID: {account_id}")
    
    print("\n2. 创建分期计划（50000元，分6期）")
    installment_data = {
        "account_id": account_id,
        "original_transaction_id": "TXN20250509002",
        "original_amount": 50000.00,
        "installment_months": 6,
        "fee_rate": 0.006,
        "start_date": "2025-05-09"
    }
    response = requests.post(f"{BASE_URL}/installments", headers=headers, json=installment_data)
    plan = response.json()['data']
    plan_id = plan['id']
    print(f"分期计划ID: {plan_id}")
    
    print("\n3. 查看分期前账户状态")
    response = requests.get(f"{BASE_URL}/accounts/{account_id}")
    print(f"可用额度: {response.json()['data']['available_credit']}")
    print(f"已用额度: {response.json()['data']['used_credit']}")
    
    print("\n4. 执行分期撤销（客户后悔了）")
    revoke_data = {
        "reason": "客户申请撤销分期，资金用途改变",
        "transaction_id": "REV20250509001"
    }
    response = requests.post(
        f"{BASE_URL}/installments/{plan_id}/revoke",
        headers=headers,
        json=revoke_data
    )
    print_response("分期撤销", response)
    
    print("\n5. 查看分期后账户状态")
    response = requests.get(f"{BASE_URL}/accounts/{account_id}")
    print(f"可用额度: {response.json()['data']['available_credit']}")
    print(f"已用额度: {response.json()['data']['used_credit']}")
    
    print("\n6. 执行综合验证")
    response = requests.get(f"{BASE_URL}/validation/installments/{plan_id}/comprehensive")
    print_response("综合验证", response)
    
    print("\n" + "="*60)
    print("撤销流程测试完成！")
    print("="*60)

if __name__ == '__main__':
    print("信用卡分期撤销 API 测试脚本")
    print("确保服务已在 localhost:5000 运行")
    print()
    
    choice = input("请选择测试模式: [1] 完整流程测试  [2] 撤销流程测试  [3] 全部测试  请输入: ")
    
    if choice == '1':
        test_full_flow()
    elif choice == '2':
        test_revocation_flow()
    else:
        test_full_flow()
        test_revocation_flow()
