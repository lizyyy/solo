#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8080/api"

def test_amount_consistency():
    print("=" * 70)
    print("测试: 金额链路一致性验证 (账单重算 → 复核报告 → 余额 → 导出)")
    print("=" * 70)
    
    appeal_data = {
        "meter_no": "WM002",
        "user_id": "U002",
        "appeal_type": "漏水申诉",
        "description": "用户申请漏水减免",
        "appeal_date": "2024-05-01T00:00:00Z",
        "start_bill_cycle": "2024-01",
        "end_bill_cycle": "2024-03",
        "disputed_amount": 483.00,
        "original_balance": 1000.00
    }
    
    r = requests.post(f"{BASE_URL}/appeals", json=appeal_data).json()
    appeal_no = r["appeal_no"]
    print(f"申诉单号: {appeal_no}")
    
    print("\n1. 账单重算结果:")
    recalc = requests.get(f"{BASE_URL}/appeals/{appeal_no}/recalculate").json()
    print(f"   原始金额合计: {recalc['original_total']}")
    print(f"   调整金额合计: {recalc['adjusted_total']}")
    print(f"   退款金额: {recalc['refund_amount']}")
    for bd in recalc['bill_details']:
        print(f"   - {bd['bill_cycle']}: 原{bd['original_amount']} → 调{bd['adjusted_amount']} (差{bd['difference']})")
    
    print("\n2. 复核报告 (确认漏水):")
    review_data = {
        "appeal_no": appeal_no,
        "reviewer_id": "R001",
        "reviewer_name": "审核员",
        "is_reading_valid": False,
        "reading_anomaly": "存在读数倒挂",
        "leak_confirmed": True,
        "leak_days": 34,
        "leak_amount": 54,
        "review_conclusion": "情况属实",
        "review_suggestion": "按漏水核减"
    }
    
    report = requests.post(f"{BASE_URL}/reviews", json=review_data).json()
    report_no = report["report_no"]
    print(f"   报告编号: {report_no}")
    print(f"   原始金额: {report['original_amount']}")
    print(f"   调整金额: {report['adjusted_amount']}")
    print(f"   原始用量: {report['original_usage']}")
    print(f"   调整用量: {report['adjusted_usage']}")
    print(f"   核减漏量: {report['leak_amount']}")
    
    print("\n3. 链路一致性验证:")
    match1 = abs(recalc['original_total'] - report['original_amount']) < 0.01
    match2 = abs(recalc['adjusted_total'] - report['adjusted_amount']) < 0.01
    print(f"   账单重算原始金额 = 复核报告原始金额: {'✓ 通过' if match1 else '✗ 失败'}")
    print(f"   账单重算调整金额 = 复核报告调整金额: {'✓ 通过' if match2 else '✗ 失败'}")
    
    print("\n4. 复核定稿与余额更新:")
    finalize_data = {"is_approved": True}
    requests.post(f"{BASE_URL}/reviews/{report_no}/finalize", json=finalize_data)
    
    detail = requests.get(f"{BASE_URL}/appeals/{appeal_no}").json()
    appeal = detail["appeal"]
    expected_refund = report['original_amount'] - report['adjusted_amount']
    expected_balance = appeal['original_balance'] + expected_refund
    
    print(f"   原始余额: {appeal['original_balance']}")
    print(f"   退款金额: {appeal['refund_amount']} (计算: {report['original_amount']} - {report['adjusted_amount']} = {expected_refund})")
    print(f"   调整余额: {appeal['adjusted_balance']} (计算: {appeal['original_balance']} + {expected_refund} = {expected_balance})")
    
    match3 = abs(appeal['refund_amount'] - expected_refund) < 0.01
    match4 = abs(appeal['adjusted_balance'] - expected_balance) < 0.01
    print(f"   退款金额计算正确: {'✓ 通过' if match3 else '✗ 失败'}")
    print(f"   调整余额计算正确: {'✓ 通过' if match4 else '✗ 失败'}")
    
    print("\n5. 结果导出一致性:")
    export_data = {
        "appeal_nos": [appeal_no],
        "export_type": "json"
    }
    export = requests.post(f"{BASE_URL}/export/appeals", json=export_data).json()
    export_record = export['data'][0]
    
    print(f"   导出退款金额: {export_record['refund_amount']}")
    print(f"   导出状态: {export_record['status']}")
    
    match5 = abs(export_record['refund_amount'] - appeal['refund_amount']) < 0.01
    match6 = export_record['status'] == appeal['status']
    print(f"   导出退款 = 申诉退款: {'✓ 通过' if match5 else '✗ 失败'}")
    print(f"   导出状态 = 申诉状态: {'✓ 通过' if match6 else '✗ 失败'}")
    
    print("\n" + "=" * 70)
    all_pass = match1 and match2 and match3 and match4 and match5 and match6
    print(f"金额链路验证: {'全部通过 ✓' if all_pass else '存在问题 ✗'}")
    print("=" * 70)
    print()
    return all_pass

def test_leak_not_confirmed():
    print("=" * 70)
    print("测试: 不确认漏水时金额不调整")
    print("=" * 70)
    
    appeal_data = {
        "meter_no": "WM003",
        "user_id": "U003",
        "appeal_type": "测试不确认漏水",
        "description": "测试",
        "appeal_date": "2024-05-01T00:00:00Z",
        "start_bill_cycle": "2024-01",
        "end_bill_cycle": "2024-02",
        "disputed_amount": 92.40,
        "original_balance": 500.00
    }
    
    r = requests.post(f"{BASE_URL}/appeals", json=appeal_data).json()
    appeal_no = r["appeal_no"]
    print(f"申诉单号: {appeal_no}")
    
    recalc = requests.get(f"{BASE_URL}/appeals/{appeal_no}/recalculate").json()
    print(f"账单重算原始金额: {recalc['original_total']}")
    print(f"账单重算调整金额: {recalc['adjusted_total']}")
    
    review_data = {
        "appeal_no": appeal_no,
        "reviewer_id": "R001",
        "reviewer_name": "审核员",
        "is_reading_valid": True,
        "reading_anomaly": "",
        "leak_confirmed": False,
        "leak_days": 0,
        "leak_amount": 0,
        "review_conclusion": "不确认漏水",
        "review_suggestion": "驳回申诉"
    }
    
    report = requests.post(f"{BASE_URL}/reviews", json=review_data).json()
    print(f"复核报告原始金额: {report['original_amount']}")
    print(f"复核报告调整金额: {report['adjusted_amount']}")
    
    match = abs(report['original_amount'] - report['adjusted_amount']) < 0.01
    print(f"不确认漏水时原始金额 = 调整金额: {'✓ 通过' if match else '✗ 失败'}")
    
    print("=" * 70)
    print()
    return match

def test_idempotency():
    print("=" * 70)
    print("测试: 各项幂等性验证")
    print("=" * 70)
    
    all_pass = True
    
    appeal_data = {
        "meter_no": "WM001",
        "user_id": "U001",
        "appeal_type": "幂等测试",
        "description": "测试",
        "appeal_date": "2024-05-01T00:00:00Z",
        "start_bill_cycle": "2024-02",
        "end_bill_cycle": "2024-03",
        "disputed_amount": 100.00,
        "original_balance": 300.00
    }
    
    r1 = requests.post(f"{BASE_URL}/appeals", json=appeal_data).json()
    r2 = requests.post(f"{BASE_URL}/appeals", json=appeal_data).json()
    match = r1['appeal_no'] == r2['appeal_no']
    print(f"重复申诉拦截: {'✓ 通过' if match else '✗ 失败'}")
    all_pass = all_pass and match
    
    appeal_no = r1['appeal_no']
    s1 = requests.post(f"{BASE_URL}/appeals/{appeal_no}/split").json()
    s2 = requests.post(f"{BASE_URL}/appeals/{appeal_no}/split").json()
    match = s1['count'] == s2['count']
    print(f"异常拆分幂等: {'✓ 通过' if match else '✗ 失败'}")
    all_pass = all_pass and match
    
    review_data = {
        "appeal_no": appeal_no,
        "reviewer_id": "R001",
        "reviewer_name": "审核员",
        "is_reading_valid": True,
        "leak_confirmed": False,
        "leak_days": 0,
        "leak_amount": 0,
        "review_conclusion": "测试",
        "review_suggestion": "测试"
    }
    rv1 = requests.post(f"{BASE_URL}/reviews", json=review_data).json()
    rv2 = requests.post(f"{BASE_URL}/reviews", json=review_data).json()
    match = rv1['report_no'] == rv2['report_no']
    print(f"复核报告幂等: {'✓ 通过' if match else '✗ 失败'}")
    all_pass = all_pass and match
    
    print("=" * 70)
    print(f"幂等性验证: {'全部通过 ✓' if all_pass else '存在问题 ✗'}")
    print("=" * 70)
    print()
    return all_pass

if __name__ == "__main__":
    try:
        r1 = test_amount_consistency()
        r2 = test_leak_not_confirmed()
        r3 = test_idempotency()
        
        print("=" * 70)
        print("综合测试结果:")
        print(f"  金额链路一致性: {'✓ 通过' if r1 else '✗ 失败'}")
        print(f"  不确认漏水不调整: {'✓ 通过' if r2 else '✗ 失败'}")
        print(f"  各项幂等性: {'✓ 通过' if r3 else '✗ 失败'}")
        print("=" * 70)
        print("所有测试完成!")
    except Exception as e:
        print(f"测试出错: {e}")
        import traceback
        traceback.print_exc()
