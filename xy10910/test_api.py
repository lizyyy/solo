#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8000"

def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"{'='*60}")
    print(f"状态码: {response.status_code}")
    if response.status_code in [200, 201]:
        print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    else:
        print(f"错误: {response.text}")
    print()

def test_normal_flow():
    print("\n" + "#"*60)
    print("# 测试场景 1: 正常创建设备 -> 检测 -> 报价 -> 复核 -> 报告")
    print("#"*60)
    
    serial = "IPHONE15PRO-2024001"
    
    print("\n1. 创建设备")
    device_data = {
        "serial_number": serial,
        "brand": "Apple",
        "model": "iPhone 15 Pro",
        "storage": "256GB",
        "color": "深空黑"
    }
    response = requests.post(f"{BASE_URL}/api/devices/", json=device_data)
    print_response("创建设备", response)
    
    print("\n2. 提交检测（含屏幕、电池扣减）")
    inspection_data = {
        "serial_number": serial,
        "inspector": "张检测",
        "screen_score": 85.0,
        "battery_score": 78.0,
        "appearance_score": 90.0,
        "function_score": 95.0,
        "remarks": "屏幕有轻微划痕，电池健康78%",
        "deductions": [
            {
                "deduction_type": "屏幕问题",
                "description": "屏幕划痕",
                "amount": 200.0
            },
            {
                "deduction_type": "电池问题",
                "description": "电池健康低于80%",
                "amount": 150.0
            }
        ]
    }
    response = requests.post(f"{BASE_URL}/api/inspections/", json=inspection_data)
    print_response("提交检测", response)
    
    print("\n3. 创建报价")
    quote_data = {
        "serial_number": serial,
        "initial_price": 5000.0,
        "quoted_by": "李报价",
        "remarks": "根据检测结果给出报价"
    }
    response = requests.post(f"{BASE_URL}/api/quotes/", json=quote_data)
    print_response("创建报价", response)
    quote_id = response.json()["id"]
    
    print("\n4. 冻结报价")
    response = requests.post(f"{BASE_URL}/api/quotes/{quote_id}/freeze")
    print_response("冻结报价", response)
    
    print("\n5. 创建复核")
    review_data = {
        "serial_number": serial,
        "reviewer": "王复核",
        "comments": "准备进行最终复核"
    }
    response = requests.post(f"{BASE_URL}/api/reviews/", json=review_data)
    print_response("创建复核", response)
    review_id = response.json()["id"]
    
    print("\n6. 通过复核")
    review_update = {
        "status": "复核通过",
        "comments": "检测结果和报价合理，通过复核"
    }
    response = requests.put(f"{BASE_URL}/api/reviews/{review_id}", json=review_update)
    print_response("通过复核", response)
    
    print("\n7. 生成质检报告")
    report_data = {
        "serial_number": serial,
        "generated_by": "系统管理员"
    }
    response = requests.post(f"{BASE_URL}/api/reports/generate", json=report_data)
    print_response("生成报告", response)
    report_id = response.json()["id"]
    
    print("\n8. 导出报告")
    response = requests.get(f"{BASE_URL}/api/reports/{report_id}/export")
    print_response("导出报告", response)
    
    print("\n9. 查看设备详情（含状态历史）")
    response = requests.get(f"{BASE_URL}/api/devices/{serial}")
    print_response("设备详情", response)

def test_duplicate_submission():
    print("\n" + "#"*60)
    print("# 测试场景 2: 重复提交拦截")
    print("#"*60)
    
    serial = "IPHONE15PRO-2024002"
    
    print("\n第一次创建")
    device_data = {
        "serial_number": serial,
        "brand": "Apple",
        "model": "iPhone 15 Pro",
        "storage": "128GB",
        "color": "银色"
    }
    response = requests.post(f"{BASE_URL}/api/devices/", json=device_data)
    print_response("第一次创建", response)
    
    print("\n第二次创建（相同序列号）")
    response = requests.post(f"{BASE_URL}/api/devices/", json=device_data)
    print_response("重复创建（应被拦截）", response)
    
    print("\n查看异常日志")
    response = requests.get(f"{BASE_URL}/api/reports/exceptions/")
    print_response("异常日志", response)

def test_exception_handling():
    print("\n" + "#"*60)
    print("# 测试场景 3: 异常路径处理")
    print("#"*60)
    
    print("\n1. 检测不存在的设备")
    inspection_data = {
        "serial_number": "NONEXISTENT-001",
        "inspector": "张检测",
        "screen_score": 90.0,
        "battery_score": 85.0,
        "appearance_score": 88.0,
        "function_score": 92.0,
        "deductions": []
    }
    response = requests.post(f"{BASE_URL}/api/inspections/", json=inspection_data)
    print_response("检测不存在设备（应报错）", response)
    
    print("\n2. 给不存在的设备报价")
    quote_data = {
        "serial_number": "NONEXISTENT-002",
        "initial_price": 3000.0,
        "quoted_by": "李报价"
    }
    response = requests.post(f"{BASE_URL}/api/quotes/", json=quote_data)
    print_response("给不存在设备报价", response)

def test_quote_first_then_inspect():
    print("\n" + "#"*60)
    print("# 测试场景 4: 先报价后补测（核心流程）")
    print("#"*60)
    
    serial = "IPHONE15PRO-2024004"
    
    print("\n1. 创建设备（状态：待检测）")
    device_data = {
        "serial_number": serial,
        "brand": "Apple",
        "model": "iPhone 15 Pro",
        "storage": "1TB",
        "color": "钛金属"
    }
    response = requests.post(f"{BASE_URL}/api/devices/", json=device_data)
    print_response("创建设备", response)
    
    print("\n2. 先报价（状态从待检测 -> 已报价）")
    quote_data = {
        "serial_number": serial,
        "initial_price": 7000.0,
        "quoted_by": "李报价",
        "remarks": "先报价后补测场景"
    }
    response = requests.post(f"{BASE_URL}/api/quotes/", json=quote_data)
    print_response("创建报价", response)
    
    print("\n3. 后补测（已报价状态下检测，状态不回退）")
    inspection_data = {
        "serial_number": serial,
        "inspector": "张检测",
        "screen_score": 92.0,
        "battery_score": 88.0,
        "appearance_score": 95.0,
        "function_score": 98.0,
        "remarks": "补测：发现序列号有异常记录",
        "deductions": [
            {
                "deduction_type": "序列号问题",
                "description": "有过维修记录",
                "amount": 300.0
            }
        ]
    }
    response = requests.post(f"{BASE_URL}/api/inspections/", json=inspection_data)
    print_response("补测完成", response)
    
    print("\n4. 查看设备状态历史（验证状态保持已报价，未回退）")
    response = requests.get(f"{BASE_URL}/api/devices/{serial}")
    print_response("设备状态历史", response)
    
    status_history = response.json().get("status_history", [])
    print(f"\n状态历史记录数: {len(status_history)}")
    for record in status_history:
        print(f"  - {record['from_status']} -> {record['to_status']}: {record['remarks']}")


def test_manual_correction():
    print("\n" + "#"*60)
    print("# 测试场景 5: 人工修正")
    print("#"*60)
    
    serial = "IPHONE15PRO-2024003"
    
    print("\n1. 创建设备")
    device_data = {
        "serial_number": serial,
        "brand": "Apple",
        "model": "iPhone 15 Pro",
        "storage": "512GB",
        "color": "蓝色"
    }
    response = requests.post(f"{BASE_URL}/api/devices/", json=device_data)
    print_response("创建设备", response)
    
    print("\n2. 创建报价")
    quote_data = {
        "serial_number": serial,
        "initial_price": 6000.0,
        "quoted_by": "李报价"
    }
    response = requests.post(f"{BASE_URL}/api/quotes/", json=quote_data)
    print_response("创建报价", response)
    
    print("\n3. 人工修正状态")
    correction_data = {
        "serial_number": serial,
        "correction_type": "status",
        "correction_value": "已结算",
        "operator": "管理员",
        "reason": "特殊渠道结算，直接跳过复核"
    }
    response = requests.post(f"{BASE_URL}/api/devices/correct", json=correction_data)
    print_response("人工修正状态", response)
    
    print("\n4. 查看修正后的状态历史")
    response = requests.get(f"{BASE_URL}/api/devices/{serial}")
    print_response("设备状态历史", response)

if __name__ == "__main__":
    print("二手设备质检 API 测试脚本")
    print("请确保服务已启动: python main.py")
    
    input("\n按回车开始测试...")
    
    try:
        test_normal_flow()
        test_duplicate_submission()
        test_exception_handling()
        test_quote_first_then_inspect()
        test_manual_correction()
        
        print("\n" + "#"*60)
        print("# 所有测试场景完成！")
        print("#"*60)
        print("\n你可以通过以下方式验证:")
        print("- 访问 http://localhost:8000/docs 查看API文档")
        print("- 查看 SQLite 数据库 inspection.db")
        print("- 查看异常日志确认所有异常都已记录")
    except Exception as e:
        print(f"\n测试出错: {e}")
        print("请确保服务已启动并运行在 8000 端口")
