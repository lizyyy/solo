#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000"

def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"{'='*60}")
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))

def test_complete_flow():
    print("🚀 开始测试安全巡检闭环系统完整流程...\n")
    
    print("📊 1. 查看初始统计")
    r = requests.get(f"{BASE_URL}/api/stats")
    print_response("初始统计数据", r)
    
    print("\n📝 2. 登记隐患 (重复提交测试幂等性)")
    danger_data = {
        "danger_no": "D101",
        "title": "楼梯扶手松动",
        "description": "二楼西侧楼梯扶手有3处螺丝松动",
        "location": "办公区2楼",
        "level": "一般",
        "inspector": "张安全"
    }
    for i in range(2):
        print(f"\n第 {i+1} 次提交:")
        r = requests.post(f"{BASE_URL}/api/dangers/register", json=danger_data)
        print_response(f"登记隐患 D101 (第{i+1}次)", r)
    
    print("\n👤 3. 创建责任人")
    person_data = {
        "name": "刘整改",
        "department": "维修部",
        "phone": "13800138001",
        "role": "整改责任人"
    }
    r = requests.post(f"{BASE_URL}/api/persons", json=person_data)
    print_response("创建责任人", r)
    
    print("\n📋 4. 派发整改任务 (重复提交测试幂等性)")
    deadline = (datetime.now() + timedelta(days=3)).isoformat()
    assign_data = {
        "danger_no": "D101",
        "assignee_name": "刘整改",
        "deadline": deadline,
        "requirements": "3日内完成全部螺丝紧固工作",
        "assigned_by": "张安全"
    }
    for i in range(2):
        print(f"\n第 {i+1} 次派发:")
        r = requests.post(f"{BASE_URL}/api/dangers/assign", json=assign_data)
        print_response(f"派发整改任务 (第{i+1}次)", r)
    
    print("\n✅ 5. 提交整改结果 (重复提交测试幂等性)")
    rectify_data = {
        "danger_no": "D101",
        "rectification_date": datetime.now().isoformat(),
        "measures": "已全部更换新螺丝并紧固，对扶手进行了全面检查",
        "result": "整改完成，所有隐患消除",
        "completed_by": "刘整改"
    }
    for i in range(2):
        print(f"\n第 {i+1} 次提交:")
        r = requests.post(f"{BASE_URL}/api/dangers/rectify", json=rectify_data)
        print_response(f"提交整改结果 (第{i+1}次)", r)
    
    print("\n🔍 6. 复查整改结果 (重复提交测试幂等性)")
    review_data = {
        "danger_no": "D101",
        "reviewer_name": "赵复查",
        "review_date": datetime.now().isoformat(),
        "result": "合格",
        "comments": "现场检查确认，扶手已全部紧固，整改合格"
    }
    for i in range(2):
        print(f"\n第 {i+1} 次复查:")
        r = requests.post(f"{BASE_URL}/api/dangers/review", json=review_data)
        print_response(f"复查整改结果 (第{i+1}次)", r)
    
    print("\n📦 7. 归档隐患记录 (重复提交测试幂等性)")
    archive_data = {
        "danger_no": "D101",
        "archived_by": "张安全",
        "archive_reason": "流程完结，记录归档"
    }
    for i in range(2):
        print(f"\n第 {i+1} 次归档:")
        r = requests.post(f"{BASE_URL}/api/dangers/archive", json=archive_data)
        print_response(f"归档隐患记录 (第{i+1}次)", r)
    
    print("\n🔎 8. 查看隐患完整链路详情")
    r = requests.get(f"{BASE_URL}/api/dangers/D101")
    print_response("隐患 D101 完整链路详情", r)
    
    print("\n📜 9. 查看操作日志")
    r = requests.get(f"{BASE_URL}/api/operation-logs", params={"danger_no": "D101"})
    print_response("操作日志记录", r)
    
    print("\n📊 10. 查看最终统计数据")
    r = requests.get(f"{BASE_URL}/api/stats")
    print_response("最终统计数据", r)
    
    print("\n" + "="*60)
    print("✅ 主流程测试完成！")
    print("="*60)

def test_data_import():
    print("\n\n📁 开始测试数据导入功能...\n")
    
    print("📥 1. 导入隐患CSV")
    with open("sample_data/dangers.csv", "rb") as f:
        files = {"file": ("dangers.csv", f, "text/csv")}
        r = requests.post(f"{BASE_URL}/api/import/dangers-csv", files=files)
    print_response("导入隐患CSV结果", r)
    
    print("\n📥 2. 导入照片索引JSON")
    with open("sample_data/photos.json", "rb") as f:
        files = {"file": ("photos.json", f, "application/json")}
        r = requests.post(f"{BASE_URL}/api/import/photos-json", files=files)
    print_response("导入照片索引结果", r)
    
    print("\n📥 3. 导入复查记录JSON")
    with open("sample_data/reviews.json", "rb") as f:
        files = {"file": ("reviews.json", f, "application/json")}
        r = requests.post(f"{BASE_URL}/api/import/reviews-json", files=files)
    print_response("导入复查记录结果", r)
    
    print("\n❌ 4. 查看导入错误记录")
    r = requests.get(f"{BASE_URL}/api/import-errors")
    print_response("导入错误记录", r)
    
    print("\n📋 5. 查看所有隐患列表")
    r = requests.get(f"{BASE_URL}/api/dangers")
    print_response("所有隐患列表", r)
    
    print("\n" + "="*60)
    print("✅ 数据导入测试完成！")
    print("="*60)

if __name__ == "__main__":
    try:
        test_complete_flow()
        test_data_import()
        print("\n🎉 全部测试完成！")
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器，请先启动服务: python main.py")
    except Exception as e:
        print(f"❌ 测试出错: {e}")
