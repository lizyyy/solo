#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8080/api"

def test_full_status_workflow():
    print("=" * 70)
    print("测试: 完整状态闭环验证 (pending → reviewing → approved → closed → archived)")
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
    status = r["status"]
    print(f"提交申诉: {appeal_no}")
    print(f"  状态: {status} {'✓' if status == 'pending' else '✗'}")
    
    print("\n1. 创建复核报告:")
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
    
    detail = requests.get(f"{BASE_URL}/appeals/{appeal_no}").json()
    status = detail["appeal"]["status"]
    print(f"  报告编号: {report_no}")
    print(f"  申诉状态: {status} {'✓' if status == 'reviewing' else '✗'}")
    
    print("\n2. 复核定稿 (通过):")
    finalize_data = {"is_approved": True}
    r = requests.post(f"{BASE_URL}/reviews/{report_no}/finalize", json=finalize_data)
    print(f"  HTTP状态: {r.status_code} {'✓' if r.status_code == 200 else '✗'}")
    
    detail = requests.get(f"{BASE_URL}/appeals/{appeal_no}").json()
    appeal = detail["appeal"]
    status = appeal["status"]
    refund = appeal["refund_amount"]
    balance = appeal["adjusted_balance"]
    print(f"  申诉状态: {status} {'✓' if status == 'approved' else '✗'}")
    print(f"  退款金额: {refund} {'✓' if abs(refund - 294) < 0.01 else '✗'}")
    print(f"  调整余额: {balance} {'✓' if abs(balance - 1294) < 0.01 else '✗'}")
    
    print("\n3. 结案:")
    close_data = {"handler_id": "R001", "handler_name": "审核员"}
    r = requests.post(f"{BASE_URL}/appeals/{appeal_no}/close", json=close_data)
    print(f"  HTTP状态: {r.status_code} {'✓' if r.status_code == 200 else '✗'}")
    
    detail = requests.get(f"{BASE_URL}/appeals/{appeal_no}").json()
    status = detail["appeal"]["status"]
    print(f"  申诉状态: {status} {'✓' if status == 'closed' else '✗'}")
    
    print("\n4. 归档:")
    r = requests.post(f"{BASE_URL}/appeals/{appeal_no}/archive")
    print(f"  HTTP状态: {r.status_code} {'✓' if r.status_code == 200 else '✗'}")
    
    detail = requests.get(f"{BASE_URL}/appeals/{appeal_no}").json()
    status = detail["appeal"]["status"]
    is_archived = detail["appeal"]["is_archived"]
    print(f"  申诉状态: {status} {'✓' if status == 'archived' else '✗'}")
    print(f"  归档标记: {is_archived} {'✓' if is_archived else '✗'}")
    
    print("\n5. 导出结果验证:")
    export_data = {"appeal_nos": [appeal_no], "export_type": "json"}
    export = requests.post(f"{BASE_URL}/export/appeals", json=export_data).json()
    rec = export["data"][0]
    print(f"  导出状态: {rec['status']} {'✓' if rec['status'] == 'archived' else '✗'}")
    print(f"  导出退款: {rec['refund_amount']} {'✓' if abs(rec['refund_amount'] - 294) < 0.01 else '✗'}")
    
    all_pass = (status == 'archived' and is_archived and 
                abs(refund - 294) < 0.01 and abs(balance - 1294) < 0.01 and
                abs(rec['refund_amount'] - 294) < 0.01)
    
    print("\n" + "=" * 70)
    print(f"完整状态闭环: {'全部通过 ✓' if all_pass else '存在问题 ✗'}")
    print("=" * 70)
    print()
    return all_pass

def test_status_with_split():
    print("=" * 70)
    print("测试: 异常拆分后的状态流转 (pending → processing → reviewing → approved)")
    print("=" * 70)
    
    appeal_data = {
        "meter_no": "WM003",
        "user_id": "U003",
        "appeal_type": "马桶漏水",
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
    
    print("\n1. 异常拆分:")
    split = requests.post(f"{BASE_URL}/appeals/{appeal_no}/split").json()
    print(f"  拆分异常数: {split['count']}")
    
    detail = requests.get(f"{BASE_URL}/appeals/{appeal_no}").json()
    status = detail["appeal"]["status"]
    print(f"  申诉状态: {status} {'✓' if status == 'processing' else '✗'}")
    
    print("\n2. 创建复核报告 (processing → reviewing):")
    review_data = {
        "appeal_no": appeal_no,
        "reviewer_id": "R001",
        "reviewer_name": "审核员",
        "is_reading_valid": True,
        "reading_anomaly": "",
        "leak_confirmed": True,
        "leak_days": 16,
        "leak_amount": 12.8,
        "review_conclusion": "情况属实",
        "review_suggestion": "核减"
    }
    
    report = requests.post(f"{BASE_URL}/reviews", json=review_data).json()
    report_no = report["report_no"]
    
    detail = requests.get(f"{BASE_URL}/appeals/{appeal_no}").json()
    status = detail["appeal"]["status"]
    print(f"  报告编号: {report_no}")
    print(f"  申诉状态: {status} {'✓' if status == 'reviewing' else '✗'}")
    
    print("\n3. 复核定稿 (reviewing → approved):")
    finalize_data = {"is_approved": True}
    requests.post(f"{BASE_URL}/reviews/{report_no}/finalize", json=finalize_data)
    
    detail = requests.get(f"{BASE_URL}/appeals/{appeal_no}").json()
    status = detail["appeal"]["status"]
    print(f"  申诉状态: {status} {'✓' if status == 'approved' else '✗'}")
    
    print("\n" + "=" * 70)
    print(f"拆分后流转: {'通过 ✓' if status == 'approved' else '失败 ✗'}")
    print("=" * 70)
    print()
    return status == 'approved'

def test_rejected_workflow():
    print("=" * 70)
    print("测试: 驳回申诉流程 (pending → reviewing → rejected → closed)")
    print("=" * 70)
    
    appeal_data = {
        "meter_no": "WM001",
        "user_id": "U001",
        "appeal_type": "异常申诉",
        "description": "测试驳回",
        "appeal_date": "2024-05-01T00:00:00Z",
        "start_bill_cycle": "2024-02",
        "end_bill_cycle": "2024-03",
        "disputed_amount": 78.40,
        "original_balance": 300.00
    }
    
    r = requests.post(f"{BASE_URL}/appeals", json=appeal_data).json()
    appeal_no = r["appeal_no"]
    print(f"申诉单号: {appeal_no}")
    
    print("\n1. 创建复核报告:")
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
    report_no = report["report_no"]
    print(f"  报告编号: {report_no}")
    
    print("\n2. 复核定稿 (驳回):")
    finalize_data = {"is_approved": False}
    requests.post(f"{BASE_URL}/reviews/{report_no}/finalize", json=finalize_data)
    
    detail = requests.get(f"{BASE_URL}/appeals/{appeal_no}").json()
    status = detail["appeal"]["status"]
    refund = detail["appeal"]["refund_amount"]
    print(f"  申诉状态: {status} {'✓' if status == 'rejected' else '✗'}")
    print(f"  退款金额: {refund} {'✓' if refund == 0 else '✗'}")
    
    print("\n3. 结案:")
    close_data = {"handler_id": "R001", "handler_name": "审核员"}
    requests.post(f"{BASE_URL}/appeals/{appeal_no}/close", json=close_data)
    
    detail = requests.get(f"{BASE_URL}/appeals/{appeal_no}").json()
    status = detail["appeal"]["status"]
    print(f"  申诉状态: {status} {'✓' if status == 'closed' else '✗'}")
    
    all_pass = (status == 'closed' and refund == 0)
    print("\n" + "=" * 70)
    print(f"驳回流程: {'通过 ✓' if all_pass else '失败 ✗'}")
    print("=" * 70)
    print()
    return all_pass

def test_withdrawn_workflow():
    print("=" * 70)
    print("测试: 撤回申诉流程 (pending → withdrawn → closed)")
    print("=" * 70)
    
    appeal_data = {
        "meter_no": "WM001",
        "user_id": "U001",
        "appeal_type": "测试撤回",
        "description": "用户自行解决",
        "appeal_date": "2024-05-02T00:00:00Z",
        "start_bill_cycle": "2024-03",
        "end_bill_cycle": "2024-04",
        "disputed_amount": 40.60,
        "original_balance": 200.00
    }
    
    r = requests.post(f"{BASE_URL}/appeals", json=appeal_data).json()
    appeal_no = r["appeal_no"]
    print(f"申诉单号: {appeal_no}")
    
    print("\n1. 撤回申诉:")
    withdraw_data = {
        "handler_id": "U001",
        "handler_name": "用户",
        "reason": "自行解决，撤回申诉"
    }
    requests.post(f"{BASE_URL}/appeals/{appeal_no}/withdraw", json=withdraw_data)
    
    detail = requests.get(f"{BASE_URL}/appeals/{appeal_no}").json()
    status = detail["appeal"]["status"]
    print(f"  申诉状态: {status} {'✓' if status == 'withdrawn' else '✗'}")
    
    print("\n2. 结案:")
    close_data = {"handler_id": "R001", "handler_name": "审核员"}
    requests.post(f"{BASE_URL}/appeals/{appeal_no}/close", json=close_data)
    
    detail = requests.get(f"{BASE_URL}/appeals/{appeal_no}").json()
    status = detail["appeal"]["status"]
    print(f"  申诉状态: {status} {'✓' if status == 'closed' else '✗'}")
    
    print("\n" + "=" * 70)
    print(f"撤回流程: {'通过 ✓' if status == 'closed' else '失败 ✗'}")
    print("=" * 70)
    print()
    return status == 'closed'

if __name__ == "__main__":
    try:
        r1 = test_full_status_workflow()
        r2 = test_status_with_split()
        r3 = test_rejected_workflow()
        r4 = test_withdrawn_workflow()
        
        print("=" * 70)
        print("综合测试结果:")
        print(f"  完整状态闭环 (→ archived): {'✓ 通过' if r1 else '✗ 失败'}")
        print(f"  拆分后状态流转: {'✓ 通过' if r2 else '✗ 失败'}")
        print(f"  驳回申诉流程: {'✓ 通过' if r3 else '✗ 失败'}")
        print(f"  撤回申诉流程: {'✓ 通过' if r4 else '✗ 失败'}")
        print("=" * 70)
        print("所有状态机测试完成!")
    except Exception as e:
        print(f"测试出错: {e}")
        import traceback
        traceback.print_exc()
