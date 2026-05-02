#!/usr/bin/env python3
"""
食堂留样追溯系统 - 演示脚本
"""

import requests
import json
from datetime import datetime, timedelta
import time

BASE_URL = "http://localhost:8000"


def print_header(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)


def print_response(response):
    print(f"状态码: {response.status_code}")
    if response.status_code in [200, 201]:
        try:
            print(json.dumps(response.json(), ensure_ascii=False, indent=2))
        except:
            print(response.text)
    else:
        print(f"错误: {response.text}")


def check_server():
    """检查服务器是否运行"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ 服务器运行正常")
            return True
    except:
        pass
    print("❌ 服务器未运行")
    print("请先运行: uvicorn app.main:app --reload")
    return False


def demo_import_data():
    """演示导入数据"""
    print_header("1. 导入示例数据")
    
    # 导入冷藏柜规则
    print("\n📋 导入冷藏柜规则...")
    with open("data/fridge_rules.yaml", "r", encoding="utf-8") as f:
        content = f.read()
    response = requests.post(
        f"{BASE_URL}/api/import/fridge-rules/text",
        data=content.encode("utf-8"),
        headers={"Content-Type": "text/plain"}
    )
    print_response(response)
    
    # 导入餐次数据
    print("\n🍽️  导入餐次数据...")
    with open("data/meals.csv", "r", encoding="utf-8") as f:
        content = f.read()
    response = requests.post(
        f"{BASE_URL}/api/import/meals/text",
        data=content.encode("utf-8"),
        headers={"Content-Type": "text/plain"}
    )
    print_response(response)
    
    # 获取餐次列表
    print("\n📜 获取餐次列表...")
    response = requests.get(f"{BASE_URL}/api/samples/")
    meals = []
    if response.status_code == 200:
        # 这里需要通过 meals API 获取，先获取样本数量
        pass
    
    return response.json() if response.status_code == 200 else []


def demo_register_samples():
    """演示登记留样"""
    print_header("2. 登记留样")
    
    # 先获取餐次信息（直接用已知的 meal_id 或者创建新的）
    samples_data = [
        {"box_code": "BOX001", "meal_id": 1, "weight": 150.0, "registered_by": "管理员A"},
        {"box_code": "BOX002", "meal_id": 2, "weight": 120.0, "registered_by": "管理员A"},
        {"box_code": "BOX003", "meal_id": 3, "weight": 180.0, "registered_by": "管理员B"},
    ]
    
    for sample_data in samples_data:
        print(f"\n📦 登记留样盒 {sample_data['box_code']}...")
        try:
            response = requests.post(
                f"{BASE_URL}/api/samples/register",
                json=sample_data
            )
            print_response(response)
        except Exception as e:
            print(f"错误: {e}")
            # 如果 meal_id 不存在，尝试先获取 meals 列表
            print("尝试获取可用的餐次...")
            # 这里简化处理，假设我们重新用 meal_id 1-3
            
    # 测试重复盒码
    print("\n⚠️  测试重复盒码验证...")
    response = requests.post(
        f"{BASE_URL}/api/samples/register",
        json={"box_code": "BOX001", "meal_id": 4, "weight": 100.0, "registered_by": "测试"}
    )
    print_response(response)


def demo_scan_operations():
    """演示扫码入柜和取样"""
    print_header("3. 扫码入柜和取样")
    
    # 扫码入柜
    print("\n📥 扫码入柜 BOX001...")
    response = requests.post(
        f"{BASE_URL}/api/samples/scan-in",
        json={
            "box_code": "BOX001",
            "fridge_code": "FRIDGE_A",
            "operator": "管理员A"
        }
    )
    print_response(response)
    
    print("\n📥 扫码入柜 BOX002...")
    response = requests.post(
        f"{BASE_URL}/api/samples/scan-in",
        json={
            "box_code": "BOX002",
            "fridge_code": "FRIDGE_A",
            "operator": "管理员A"
        }
    )
    print_response(response)
    
    print("\n📥 扫码入柜 BOX003...")
    response = requests.post(
        f"{BASE_URL}/api/samples/scan-in",
        json={
            "box_code": "BOX003",
            "fridge_code": "FRIDGE_B",
            "operator": "管理员B"
        }
    )
    print_response(response)
    
    # 测试事件乱序处理
    print("\n🔄 测试事件乱序处理...")
    # 创建一个早于入柜时间的取样事件
    earlier_time = (datetime.utcnow() - timedelta(hours=1)).isoformat()
    response = requests.post(
        f"{BASE_URL}/api/samples/scan-out",
        json={
            "box_code": "BOX001",
            "operator": "管理员C",
            "event_time": earlier_time,
            "notes": "补录取样记录"
        }
    )
    print_response(response)


def demo_alerts():
    """演示过期预警"""
    print_header("4. 过期预警")
    
    print("\n⏰ 获取过期预警...")
    response = requests.get(f"{BASE_URL}/api/alerts/expiry?hours_threshold=100")
    print_response(response)


def demo_trace_complaint():
    """演示投诉追溯"""
    print_header("5. 投诉追溯")
    
    print("\n🔍 追溯 2025-05-02 午餐的留样...")
    response = requests.post(
        f"{BASE_URL}/api/trace/complaint",
        json={
            "complaint_time": datetime.utcnow().isoformat(),
            "date": "2025-05-02",
            "meal_type": "lunch"
        }
    )
    print_response(response)


def demo_export_report():
    """演示导出追溯报告"""
    print_header("6. 导出追溯报告")
    
    print("\n📄 生成 BOX001 的追溯报告...")
    response = requests.post(
        f"{BASE_URL}/api/trace/export-report",
        json={"box_code": "BOX001"}
    )
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        print("\n--- 追溯报告 ---")
        print(response.text)
        
        # 保存报告
        with open("trace_report.md", "w", encoding="utf-8") as f:
            f.write(response.text)
        print("\n✅ 报告已保存到 trace_report.md")


def main():
    print("🍜 食堂留样追溯系统 - 演示脚本")
    print("="*60)
    
    # 检查服务器
    if not check_server():
        return
    
    print("\n等待服务器完全启动...")
    time.sleep(2)
    
    # 运行演示
    try:
        demo_import_data()
        demo_register_samples()
        demo_scan_operations()
        demo_alerts()
        demo_trace_complaint()
        demo_export_report()
        
        print_header("✅ 演示完成")
        print("\n📚 更多操作请访问:")
        print(f"   API 文档: {BASE_URL}/docs")
        print(f"   服务地址: {BASE_URL}")
        
    except requests.exceptions.ConnectionError:
        print("\n❌ 无法连接到服务器")
        print("请确保服务器正在运行: uvicorn app.main:app --reload")
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")


if __name__ == "__main__":
    main()
