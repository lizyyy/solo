#!/usr/bin/env python3
import requests
import json
import time
import subprocess
import sys

BASE_URL = "http://localhost:8000"

def print_separator(title=""):
    print(f"\n{'='*60}")
    if title:
        print(f"  {title}")
        print('='*60)

def check_server():
    try:
        response = requests.get(f"{BASE_URL}/api/stats", timeout=2)
        return response.status_code == 200
    except:
        return False

def wait_for_server(max_wait=30):
    print("等待服务启动...")
    for i in range(max_wait):
        if check_server():
            print("服务已启动！")
            return True
        time.sleep(1)
    print(f"等待 {max_wait} 秒后服务仍未启动")
    return False

def demo():
    print_separator("社区药房库存管理系统 - 主流程演示")
    
    if not check_server():
        print("请先启动服务: python main.py")
        print("或使用: uvicorn main:app --reload")
        sys.exit(1)
    
    print_separator("1. 查看当前统计")
    response = requests.get(f"{BASE_URL}/api/stats")
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
    print_separator("2. 入库登记 - 正常数据样例")
    normal_samples = [
        {
            "batch_number": "VAC-2024-001",
            "product_name": "新冠灭活疫苗",
            "product_type": "疫苗",
            "temperature": 4.5,
            "receiver": "张三",
            "has_damage": False
        },
        {
            "batch_number": "INS-2024-001",
            "product_name": "甘精胰岛素注射液",
            "product_type": "胰岛素",
            "temperature": 5.0,
            "receiver": "李四",
            "has_damage": False
        }
    ]
    for sample in normal_samples:
        response = requests.post(f"{BASE_URL}/api/inventory", json=sample)
        print(f"批次 {sample['batch_number']}:", "成功" if response.status_code == 200 else "失败")
        if response.status_code == 200:
            print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
    print_separator("3. 入库登记 - 异常数据样例")
    abnormal_samples = [
        {
            "batch_number": "VAC-2024-002",
            "product_name": "乙肝疫苗",
            "product_type": "疫苗",
            "temperature": 15.0,
            "receiver": "王五",
            "has_damage": True,
            "damage_description": "外包装纸箱有轻微破损，内包装完好"
        },
        {
            "batch_number": "INS-2024-002",
            "product_name": "门冬胰岛素",
            "product_type": "胰岛素",
            "temperature": -2.0,
            "receiver": "赵六",
            "has_damage": True,
            "damage_description": "一支药剂瓶有裂纹"
        }
    ]
    for sample in abnormal_samples:
        response = requests.post(f"{BASE_URL}/api/inventory", json=sample)
        print(f"批次 {sample['batch_number']}:", "成功" if response.status_code == 200 else "失败")
        if response.status_code == 200:
            print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
    print_separator("4. 错误分支测试 - 重复批次号")
    duplicate_test = {
        "batch_number": "VAC-2024-001",
        "product_name": "测试重复",
        "product_type": "疫苗",
        "temperature": 5.0,
        "receiver": "测试员"
    }
    response = requests.post(f"{BASE_URL}/api/inventory", json=duplicate_test)
    print(f"状态码: {response.status_code}")
    print(f"错误信息: {response.json()['detail']}")
    
    print_separator("5. 错误分支测试 - 产品类型错误")
    type_test = {
        "batch_number": "TEST-001",
        "product_name": "感冒药",
        "product_type": "感冒药",
        "temperature": 5.0,
        "receiver": "测试员"
    }
    response = requests.post(f"{BASE_URL}/api/inventory", json=type_test)
    print(f"状态码: {response.status_code}")
    print(f"错误信息: {response.json()['detail']}")
    
    print_separator("6. 查询所有记录")
    response = requests.get(f"{BASE_URL}/api/inventory")
    records = response.json()
    print(f"共查询到 {len(records)} 条记录")
    for r in records:
        print(f"  - {r['batch_number']}: {r['product_name']} | 温度:{r['temperature']}℃ | 状态:{r['status']}")
    
    print_separator("7. 筛选查询 - 温度异常的记录")
    response = requests.get(f"{BASE_URL}/api/inventory", params={"temperature_status": "abnormal"})
    records = response.json()
    print(f"温度异常记录数: {len(records)}")
    for r in records:
        print(f"  - {r['batch_number']}: {r['product_name']} | 温度:{r['temperature']}℃")
    
    print_separator("8. 筛选查询 - 按签收人张三")
    response = requests.get(f"{BASE_URL}/api/inventory", params={"receiver": "张三"})
    records = response.json()
    print(f"张三签收的记录数: {len(records)}")
    for r in records:
        print(f"  - {r['batch_number']}: {r['product_name']}")
    
    print_separator("9. 复核记录 - 通过")
    review_approved = {
        "batch_number": "VAC-2024-001",
        "reviewed_by": "主管A",
        "status": "approved",
        "review_notes": "温度正常，包装完好，同意入库"
    }
    response = requests.post(f"{BASE_URL}/api/inventory/review", json=review_approved)
    print(f"复核 VAC-2024-001:", "成功" if response.status_code == 200 else "失败")
    if response.status_code == 200:
        print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
    print_separator("10. 复核记录 - 拒绝")
    review_rejected = {
        "batch_number": "INS-2024-002",
        "reviewed_by": "主管B",
        "status": "rejected",
        "review_notes": "温度过低且有破损，拒收并联系供应商退换"
    }
    response = requests.post(f"{BASE_URL}/api/inventory/review", json=review_rejected)
    print(f"复核 INS-2024-002:", "成功" if response.status_code == 200 else "失败")
    if response.status_code == 200:
        print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
    print_separator("11. 错误分支测试 - 重复复核")
    response = requests.post(f"{BASE_URL}/api/inventory/review", json=review_approved)
    print(f"状态码: {response.status_code}")
    print(f"错误信息: {response.json()['detail']}")
    
    print_separator("12. 查询单条记录详情")
    response = requests.get(f"{BASE_URL}/api/inventory/VAC-2024-001")
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
    print_separator("13. 查看更新后的统计")
    response = requests.get(f"{BASE_URL}/api/stats")
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
    print_separator("14. 导出Excel报告")
    response = requests.get(f"{BASE_URL}/api/inventory/export")
    if response.status_code == 200:
        filename = "exported_report.xlsx"
        with open(filename, "wb") as f:
            f.write(response.content)
        print(f"报告已导出为: {filename}")
    else:
        print("导出失败")
    
    print_separator("演示完成！")
    print("""
    主流程已全部走完：
    ✓ 入库登记（正常/异常数据）
    ✓ 错误分支处理（重复批次、类型错误、重复复核）
    ✓ 多条件筛选查询
    ✓ 复核流程（通过/拒绝）
    ✓ 统计摘要
    ✓ Excel导出
    
    重启服务后，数据会保留在 pharmacy_inventory.db 中
    """)

if __name__ == "__main__":
    demo()
