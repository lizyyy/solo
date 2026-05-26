#!/usr/bin/env python3
"""
本地复跑测试脚本
用于快速验证整个流程：上传顾客档案 -> 上传购药记录 -> 生成随访报告 -> 链路追踪
"""

import requests
import os
import json

BASE_URL = "http://localhost:8000"
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


def test_health():
    """测试服务健康状态"""
    print("=" * 60)
    print("1. 测试服务健康状态...")
    try:
        resp = requests.get(f"{BASE_URL}/api/v1/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        print(f"   ✓ 服务正常运行: {data['timestamp']}")
        return True
    except Exception as e:
        print(f"   ✗ 服务未启动或异常: {e}")
        print("   请先执行: cd pharmacy_followup && python main.py")
        return False


def upload_customers():
    """上传顾客档案JSON"""
    print("\n" + "=" * 60)
    print("2. 上传顾客档案JSON...")
    file_path = os.path.join(DATA_DIR, "customers.json")

    with open(file_path, "rb") as f:
        content = f.read()
        import hashlib
        file_hash = hashlib.md5(content).hexdigest()
        print(f"   文件哈希: {file_hash}")
        files = {"file": ("customers.json", content, "application/json")}
        resp = requests.post(f"{BASE_URL}/api/v1/upload/customers", files=files)

    assert resp.status_code == 200, f"上传失败: {resp.text}"
    result = resp.json()

    print(f"   批次号: {result['batch_no']}")
    print(f"   总记录数: {result['total_records']}")
    print(f"   正常: {result['normal_count']} | 待确认: {result['pending_count']} | 失败: {result['failed_count']}")
    print(f"   返回字段: {list(result.keys())}")

    if result.get("is_duplicate"):
        print(f"   ⚠  {result['message']}")

    if result["failed"]:
        print("\n   失败记录详情:")
        for item in result["failed"][:3]:
            print(f"   - {item['source_id']}: {item['error_message']}")
            print(f"     建议: {item['suggestion']}")

    return result


def upload_purchase():
    """上传购药记录CSV"""
    print("\n" + "=" * 60)
    print("3. 上传购药记录CSV...")
    file_path = os.path.join(DATA_DIR, "purchase_records.csv")

    with open(file_path, "rb") as f:
        files = {"file": ("purchase_records.csv", f, "text/csv")}
        resp = requests.post(f"{BASE_URL}/api/v1/upload/purchase", files=files)

    assert resp.status_code == 200, f"上传失败: {resp.text}"
    result = resp.json()

    print(f"   批次号: {result['batch_no']}")
    print(f"   总记录数: {result['total_records']}")
    print(f"   正常: {result['normal_count']} | 待确认: {result['pending_count']} | 失败: {result['failed_count']}")

    if result.get("is_duplicate"):
        print(f"   ⚠  {result['message']}")

    if result["failed"]:
        print("\n   失败记录详情:")
        for item in result["failed"][:3]:
            print(f"   - {item['source_id']}: {item['error_message']}")
            print(f"     建议: {item['suggestion']}")

    if result["pending"]:
        print("\n   待确认记录详情:")
        for item in result["pending"][:2]:
            print(f"   - {item['source_id']}: {item['error_message']}")
            print(f"     建议: {item['suggestion']}")

    return result


def generate_report():
    """生成随访报告"""
    print("\n" + "=" * 60)
    print("4. 生成随访报告...")
    resp = requests.post(f"{BASE_URL}/api/v1/report/generate")
    assert resp.status_code == 200, f"生成报告失败: {resp.text}"
    result = resp.json()

    print(f"   报告ID: {result['report_id']}")
    print(f"   生成时间: {result['generated_at']}")
    print(f"   顾客总数: {result['summary']['total_customers']}")
    print(f"   提醒总数: {result['summary']['total_reminders']}")
    print(f"   逾期提醒: {result['summary']['overdue_count']}")
    print(f"   即将到期: {result['summary']['upcoming_count']}")

    if result["reminders"]:
        print("\n   部分提醒内容:")
        for rem in result["reminders"][:3]:
            print(f"   - [{rem['reminder_type']}] {rem['customer_name']} - {rem['drug_name']}")
            print(f"     下次随访: {rem['next_followup_date']}")

    return result


def test_trace(reminders):
    """测试链路追踪"""
    print("\n" + "=" * 60)
    print("5. 测试链路追踪...")

    if not reminders:
        print("   没有提醒数据，跳过追踪测试")
        return

    sample_trace_id = reminders[0]["trace_id"]
    print(f"   使用追踪ID: {sample_trace_id}")

    resp = requests.get(f"{BASE_URL}/api/v1/trace/{sample_trace_id}")
    assert resp.status_code == 200, f"追踪查询失败: {resp.text}"
    result = resp.json()

    print("\n   追踪链路详情:")
    if result.get("reminder"):
        print(f"   ✓ 提醒记录: {result['reminder']['reminder_id']}")
        print(f"     - 顾客: {result['reminder']['customer_name']}")
        print(f"     - 药品: {result['reminder']['drug_name']}")
        print(f"     - 报告: {result['reminder']['report_id']}")

    if result.get("purchase_record"):
        print(f"   ✓ 购药记录: {result['purchase_record']['record_id']}")
        print(f"     - 日期: {result['purchase_record']['purchase_date']}")

    if result.get("customer"):
        print(f"   ✓ 顾客档案: {result['customer']['customer_id']}")
        print(f"     - 脱敏手机号: {result['customer']['phone_masked']}")
        print(f"     - 病种: {result['customer']['disease_type']}")

    if result.get("processed_record"):
        print(f"   ✓ 处理记录: 批次{result['processed_record']['batch_id']}")
        print(f"     - 状态: {result['processed_record']['status']}")


def test_duplicate_upload():
    """测试重复上传幂等性"""
    print("\n" + "=" * 60)
    print("6. 测试重复上传幂等性...")
    file_path = os.path.join(DATA_DIR, "customers.json")

    with open(file_path, "rb") as f:
        content = f.read()
        import hashlib
        file_hash = hashlib.md5(content).hexdigest()
        print(f"   文件哈希: {file_hash}")

    files1 = {"file": ("customers.json", content, "application/json")}
    resp1 = requests.post(f"{BASE_URL}/api/v1/upload/customers", files=files1)
    result1 = resp1.json()
    print(f"   第一次上传 - 批次号: {result1['batch_no']}, 字段: {list(result1.keys())}")

    files2 = {"file": ("customers.json", content, "application/json")}
    resp2 = requests.post(f"{BASE_URL}/api/v1/upload/customers", files=files2)
    result2 = resp2.json()
    print(f"   第二次上传 - 批次号: {result2['batch_no']}, 字段: {list(result2.keys())}")

    assert result1["batch_no"] == result2["batch_no"], "重复上传应返回相同批次号"
    has_duplicate_flag = result1.get("is_duplicate") == True or result2.get("is_duplicate") == True
    assert has_duplicate_flag, f"重复上传应标记为重复"

    print(f"   ✓ 两次上传批次号相同: {result1['batch_no']}")
    message = result2.get("message") or result1.get("message") or "该文件已处理过"
    print(f"   ✓ 返回历史结果: {message}")


def main():
    print("药店慢病随访提醒API - 本地复跑测试")
    print("=" * 60)

    if not test_health():
        return

    try:
        customer_result = upload_customers()
        purchase_result = upload_purchase()
        report_result = generate_report()
        test_trace(report_result.get("reminders", []))
        test_duplicate_upload()

        print("\n" + "=" * 60)
        print("✅ 所有测试通过！")
        print("\n常用API地址:")
        print(f"  - API文档: {BASE_URL}/docs")
        print(f"  - 健康检查: {BASE_URL}/api/v1/health")
        print(f"  - 批次列表: {BASE_URL}/api/v1/batches")
        print(f"  - 规则列表: {BASE_URL}/api/v1/rules")
        print(f"  - 提醒列表: {BASE_URL}/api/v1/reminders")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
