import requests
import json

BASE_URL = 'http://localhost:5001/api/v1'

headers = {'Content-Type': 'application/json'}

def print_section(title):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")

def test_fixed_scenarios():
    print_section("创建测试账户")
    account_data = {
        "account_number": "ACC_TEST_FIX_001",
        "card_number": "6222****TEST",
        "customer_name": "测试用户",
        "credit_limit": 100000.00,
        "used_credit": 0.00
    }
    r = requests.post(f"{BASE_URL}/accounts", headers=headers, json=account_data)
    account = r.json()['data']
    account_id = account['id']
    print(f"账户ID: {account_id}")
    print(f"初始可用额度: {account['available_credit']}")

    print_section("创建分期计划（10000元分3期）")
    install_data = {
        "account_id": account_id,
        "original_transaction_id": "TXN_FIX_TEST_001",
        "original_amount": 10000.00,
        "installment_months": 3,
        "fee_rate": 0.006,
        "start_date": "2026-05-14"
    }
    r = requests.post(f"{BASE_URL}/installments", headers=headers, json=install_data)
    plan = r.json()['data']
    plan_id = plan['id']
    print(f"分期计划ID: {plan_id}")
    print(f"分期金额: {plan['original_amount']}, 剩余本金: {plan['remaining_principal']}")

    print_section("提前还款（关键修复点1）")
    settle_data = {
        "reason": "修复验证-提前还款",
        "transaction_id": "ES_FIX_TEST_001"
    }
    r = requests.post(f"{BASE_URL}/installments/{plan_id}/early-settle", headers=headers, json=settle_data)
    if r.status_code != 201:
        print(f"提前还款失败: {r.status_code}")
        print(r.json())
        return
    
    revocation = r.json()['data']
    print(f"提前还款成功")
    print(f"  - 恢复额度: {revocation['credit_restored']}")
    print(f"  - 违约金: {revocation['penalty_fee']}")
    print(f"  - 待收金额: {revocation['amount_to_collect']}")

    print_section("检查异常记录（修复前会错误记录异常）")
    r = requests.get(f"{BASE_URL}/exceptions?plan_id={plan_id}")
    exceptions = r.json()['data']
    exception_count = exceptions['total']
    print(f"异常数量: {exception_count}")
    
    if exception_count == 0:
        print("✅ 修复1验证通过: 正常提前还款没有被错误记录为异常")
    else:
        print(f"❌ 修复1未通过: 存在 {exception_count} 条异常记录")
        for exc in exceptions['items'][:5]:
            print(f"   - {exc['title']}: {exc['description']}")

    print_section("检查待处理任务（应该有收费任务）")
    r = requests.get(f"{BASE_URL}/pending-tasks?plan_id={plan_id}")
    tasks = r.json()['data']
    print(f"待处理任务数量: {tasks['total']}")
    for t in tasks['items']:
        print(f"  - {t['task_type']}: {t['title']}")

    print_section("运行综合验证（关键修复点2）")
    r = requests.get(f"{BASE_URL}/validation/installments/{plan_id}/comprehensive")
    validation = r.json()['data']
    overall = validation['overall_status']
    total_errors = validation['total_errors']
    print(f"综合验证状态: {overall}")
    print(f"总错误数: {total_errors}")
    
    if validation.get('credit_restore_validation'):
        credit_val = validation['credit_restore_validation']
        print(f"  额度恢复验证结果: {credit_val['is_valid']}")
        if not credit_val['is_valid']:
            print(f"  额度恢复验证错误: {credit_val['errors']}")
    
    if overall == 'passed':
        print("✅ 修复2验证通过: 额度恢复校验没有重复叠加问题")
    else:
        print(f"❌ 修复2未通过: 综合验证失败")

    print_section("创建第二个分期用于撤销测试")
    install_data2 = {
        "account_id": account_id,
        "original_transaction_id": "TXN_FIX_TEST_002",
        "original_amount": 20000.00,
        "installment_months": 6,
        "fee_rate": 0.006,
        "start_date": "2026-05-14"
    }
    r = requests.post(f"{BASE_URL}/installments", headers=headers, json=install_data2)
    plan2 = r.json()['data']
    plan_id2 = plan2['id']
    print(f"第二个分期计划ID: {plan_id2}")

    print_section("执行分期撤销（关键修复点1同样适用）")
    revoke_data = {
        "reason": "修复验证-分期撤销",
        "transaction_id": "REV_FIX_TEST_001"
    }
    r = requests.post(f"{BASE_URL}/installments/{plan_id2}/revoke", headers=headers, json=revoke_data)
    revocation2 = r.json()['data']
    print(f"分期撤销成功")
    print(f"  - 恢复额度: {revocation2['credit_restored']}")
    print(f"  - 总退款: {revocation2['total_refund']}")
    print(f"  - 待收金额: {revocation2['amount_to_collect']}")

    print_section("检查撤销后的异常记录")
    r = requests.get(f"{BASE_URL}/exceptions?plan_id={plan_id2}")
    exceptions2 = r.json()['data']
    exc_count2 = exceptions2['total']
    print(f"异常数量: {exc_count2}")
    
    if exc_count2 == 0:
        print("✅ 修复1验证通过: 分期撤销也没有异常记录")
    else:
        print(f"❌ 存在异常: {exc_count2}")

    print_section("测试导出功能（关键修复点3）")
    r = requests.get(f"{BASE_URL}/exports/revocation-report")
    if r.status_code == 200:
        print(f"✅ 修复3验证通过: 撤销记录导出成功 (状态码 200)")
        print(f"   内容长度: {len(r.content)} bytes")
    else:
        print(f"❌ 修复3未通过: 导出失败 (状态码 {r.status_code})")
        try:
            print(r.json())
        except:
            print(r.text[:500])

    print_section("最终校验-异常统计")
    r = requests.get(f"{BASE_URL}/exceptions/stats")
    stats = r.json()['data']
    print(f"  总异常数: {stats['total']}")
    print(f"  未解决数: {stats['unresolved_count']}")
    print(f"  严重级别: {stats['by_severity']}")
    
    if stats['total'] == 0:
        print("\n🎉 所有修复验证通过！项目可正常运行。")
    else:
        print(f"\n⚠️  存在 {stats['total']} 条异常记录，需要检查")

if __name__ == '__main__':
    test_fixed_scenarios()
