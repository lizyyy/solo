#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8080/api"

def test_duplicate_appeal():
    print("=" * 60)
    print("测试 1: 重复申诉拦截（不创建新记录）")
    print("=" * 60)
    
    appeal_data = {
        "meter_no": "WM001",
        "user_id": "U001",
        "appeal_type": "测试重复",
        "description": "第一次申诉",
        "appeal_date": "2024-05-01T00:00:00Z",
        "start_bill_cycle": "2024-02",
        "end_bill_cycle": "2024-04",
        "disputed_amount": 100.00,
        "original_balance": 500.00
    }
    
    r1 = requests.post(f"{BASE_URL}/appeals", json=appeal_data).json()
    print(f"第一次提交: {r1['success']}, 单号: {r1['appeal_no']}")
    
    appeal_data["description"] = "重复申诉，应该被拦截"
    r2 = requests.post(f"{BASE_URL}/appeals", json=appeal_data).json()
    print(f"第二次提交: {r2['success']}, 单号: {r2['appeal_no']}")
    
    r = requests.get(f"{BASE_URL}/appeals?meter_no=WM001").json()
    print(f"WM001 申诉总数: {r['count']}")
    print(f"✓ 幂等性验证: {'通过' if r1['appeal_no'] == r2['appeal_no'] else '失败'}")
    print()

def test_anomaly_split_idempotent():
    print("=" * 60)
    print("测试 2: 异常拆分幂等性（多次调用不重复插入）")
    print("=" * 60)
    
    appeal_data = {
        "meter_no": "WM002",
        "user_id": "U002",
        "appeal_type": "漏水测试幂等",
        "description": "测试",
        "appeal_date": "2024-05-01T00:00:00Z",
        "start_bill_cycle": "2024-01",
        "end_bill_cycle": "2024-03",
        "disputed_amount": 500.00,
        "original_balance": 1000.00
    }
    
    r = requests.post(f"{BASE_URL}/appeals", json=appeal_data).json()
    appeal_no = r["appeal_no"]
    print(f"申诉单号: {appeal_no}")
    
    r1 = requests.post(f"{BASE_URL}/appeals/{appeal_no}/split").json()
    print(f"第一次拆分 - 异常数: {r1['count']}")
    
    r2 = requests.post(f"{BASE_URL}/appeals/{appeal_no}/split").json()
    print(f"第二次拆分 - 异常数: {r2['count']}")
    
    print(f"✓ 幂等性验证: {'通过' if r1['count'] == r2['count'] else '失败'}")
    print()
    return appeal_no

def test_review_amount_correct(appeal_no):
    print("=" * 60)
    print("测试 3: 复核报告金额计算（使用账单合计）")
    print("=" * 60)
    
    review_data = {
        "appeal_no": appeal_no,
        "reviewer_id": "R001",
        "reviewer_name": "测试员",
        "is_reading_valid": False,
        "reading_anomaly": "存在读数倒挂",
        "leak_confirmed": True,
        "leak_days": 34,
        "leak_amount": 51.0,
        "review_conclusion": "情况属实",
        "review_suggestion": "建议减免"
    }
    
    r = requests.post(f"{BASE_URL}/reviews", json=review_data).json()
    report_no = r["report_no"]
    print(f"报告编号: {report_no}")
    print(f"原始金额: {r['original_amount']}")
    print(f"调整金额: {r['adjusted_amount']}")
    print(f"原始用量: {r['original_usage']}")
    print(f"调整用量: {r['adjusted_usage']}")
    
    expected_original = 483.0
    print(f"✓ 原始金额验证: {'通过' if abs(r['original_amount'] - expected_original) < 1 else f'失败 (期望{expected_original})'}")
    print()
    return report_no

def test_manual_correct_and_balance(report_no, appeal_no):
    print("=" * 60)
    print("测试 4: 人工修正与余额更新")
    print("=" * 60)
    
    correct_data = {
        "adjusted_amount": 350.00,
        "reason": "人工特别减免"
    }
    
    r = requests.post(f"{BASE_URL}/reviews/{report_no}/manual-correct", json=correct_data).json()
    print(f"人工修正: {r.get('message', '成功')}")
    
    finalize_data = {"is_approved": True}
    r = requests.post(f"{BASE_URL}/reviews/{report_no}/finalize", json=finalize_data).json()
    print(f"复核定稿: {r.get('message', '成功')}")
    
    r = requests.get(f"{BASE_URL}/appeals/{appeal_no}").json()
    appeal = r["appeal"]
    report = r.get("report", {})
    
    print(f"原始余额: {appeal['original_balance']}")
    print(f"调整余额: {appeal['adjusted_balance']}")
    print(f"退款金额: {appeal['refund_amount']}")
    
    expected_refund = 483 - 350
    expected_balance = 1000 + expected_refund
    print(f"期望退款: {expected_refund}")
    print(f"期望余额: {expected_balance}")
    
    refund_ok = abs(appeal['refund_amount'] - expected_refund) < 1
    balance_ok = abs(appeal['adjusted_balance'] - expected_balance) < 1
    print(f"✓ 退款金额验证: {'通过' if refund_ok else '失败'}")
    print(f"✓ 调整余额验证: {'通过' if balance_ok else '失败'}")
    print()

def test_finalize_idempotent(report_no):
    print("=" * 60)
    print("测试 5: 复核定稿幂等性")
    print("=" * 60)
    
    finalize_data = {"is_approved": True}
    r1 = requests.post(f"{BASE_URL}/reviews/{report_no}/finalize", json=finalize_data)
    print(f"第一次定稿: 状态码 {r1.status_code}")
    
    r2 = requests.post(f"{BASE_URL}/reviews/{report_no}/finalize", json=finalize_data)
    print(f"第二次定稿: 状态码 {r2.status_code}")
    print(f"✓ 定稿幂等性: {'通过' if r1.status_code == r2.status_code == 200 else '检查'}")
    print()

if __name__ == "__main__":
    try:
        test_duplicate_appeal()
        appeal_no = test_anomaly_split_idempotent()
        report_no = test_review_amount_correct(appeal_no)
        test_manual_correct_and_balance(report_no, appeal_no)
        test_finalize_idempotent(report_no)
        
        print("=" * 60)
        print("所有测试完成!")
        print("=" * 60)
    except Exception as e:
        print(f"测试出错: {e}")
        import traceback
        traceback.print_exc()
