#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")
    if response.status_code in [200, 201]:
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    else:
        print(f"Status: {response.status_code}")
        print(f"Error: {response.text}")


def test_full_flow():
    print("🚀 开始测试民宿运营管理系统完整流程...")
    
    deadline = (datetime.utcnow() + timedelta(hours=4)).isoformat()
    
    print("\n" + "="*60)
    print("  1. 创建订单")
    print("="*60)
    order_data = {
        "order_no": "ORD20240115001",
        "property_name": "海景公寓A栋302",
        "guest_name": "张先生",
        "check_in_date": None,
        "check_out_date": None
    }
    r = requests.post(f"{BASE_URL}/orders/", json=order_data)
    order_id = r.json()["id"] if r.status_code == 200 else None
    print_response("创建订单结果", r)
    
    print("\n" + "="*60)
    print("  2. 创建保洁员")
    print("="*60)
    cleaner_data = {
        "name": "李阿姨",
        "phone": "13800138000",
        "base_salary": 3000
    }
    r = requests.post(f"{BASE_URL}/cleaners/", json=cleaner_data)
    cleaner_id = r.json()["id"] if r.status_code == 200 else None
    print_response("创建保洁员结果", r)
    
    print("\n" + "="*60)
    print("  3. 分配保洁任务 (派单)")
    print("="*60)
    task_data = {
        "task_no": "TASK20240115001",
        "order_id": order_id,
        "cleaner_id": cleaner_id,
        "deadline": deadline,
        "base_fee": 200
    }
    r = requests.post(f"{BASE_URL}/tasks/", json=task_data)
    task_id = r.json()["id"] if r.status_code == 200 else None
    print_response("派单结果", r)
    
    print("\n" + "="*60)
    print("  4. 重复派单测试 (幂等性)")
    print("="*60)
    r = requests.post(f"{BASE_URL}/tasks/", json=task_data)
    print_response("重复派单结果", r)
    
    print("\n" + "="*60)
    print("  5. 上传保洁照片")
    print("="*60)
    photo_types = ["living_room", "bedroom", "bathroom", "kitchen", "overall"]
    for ptype in photo_types:
        photo_data = {
            "task_id": task_id,
            "photo_type": ptype,
            "photo_url": f"http://example.com/photos/{ptype}.jpg",
            "uploaded_by": "李阿姨"
        }
        r = requests.post(f"{BASE_URL}/photos/", json=photo_data)
        print_response(f"上传 {ptype} 照片", r)
    
    print("\n" + "="*60)
    print("  6. 重复上传照片测试")
    print("="*60)
    photo_data = {
        "task_id": task_id,
        "photo_type": "living_room",
        "photo_url": "http://example.com/photos/living_room.jpg"
    }
    r = requests.post(f"{BASE_URL}/photos/", json=photo_data)
    print_response("重复上传照片结果", r)
    
    print("\n" + "="*60)
    print("  7. 验收保洁任务")
    print("="*60)
    inspection_data = {
        "task_id": task_id,
        "inspector": "王主管",
        "passed": True,
        "comments": "整体清洁质量良好",
        "reason": ""
    }
    r = requests.post(f"{BASE_URL}/inspections/", json=inspection_data)
    print_response("验收结果", r)
    
    print("\n" + "="*60)
    print("  8. 查看任务状态和扣款详情")
    print("="*60)
    r = requests.get(f"{BASE_URL}/tasks/{task_id}/status")
    print_response("任务状态详情", r)
    
    print("\n" + "="*60)
    print("  9. 申请返工")
    print("="*60)
    rework_data = {
        "task_id": task_id,
        "requested_by": "王主管",
        "reason": "卫生间角落有污渍需要重新清理",
        "deadline": (datetime.utcnow() + timedelta(hours=2)).isoformat(),
        "affects_settlement": True
    }
    r = requests.post(f"{BASE_URL}/reworks/", json=rework_data)
    rework_id = r.json()["id"] if r.status_code == 200 else None
    print_response("返工申请结果", r)
    
    print("\n" + "="*60)
    print("  10. 查看返工后的任务状态")
    print("="*60)
    r = requests.get(f"{BASE_URL}/tasks/{task_id}/status")
    print_response("返工后的任务状态", r)
    
    print("\n" + "="*60)
    print("  11. 完成返工")
    print("="*60)
    r = requests.put(f"{BASE_URL}/reworks/{rework_id}/complete", json={"completed": True})
    print_response("完成返工结果", r)
    
    print("\n" + "="*60)
    print("  12. 手动扣款 (客诉)")
    print("="*60)
    deduction_data = {
        "task_id": task_id,
        "deduction_type": "客诉扣款",
        "amount": 30,
        "reason": "客人反馈床品有毛发",
        "applied_by": "运营经理"
    }
    r = requests.post(f"{BASE_URL}/deductions/", json=deduction_data)
    print_response("扣款结果", r)
    
    print("\n" + "="*60)
    print("  13. 重复扣款测试 (幂等性)")
    print("="*60)
    r = requests.post(f"{BASE_URL}/deductions/", json=deduction_data)
    print_response("重复扣款结果", r)
    
    print("\n" + "="*60)
    print("  14. 创建结算单")
    print("="*60)
    settlement_data = {
        "settlement_no": "SET20240115001",
        "order_id": order_id,
        "cleaner_id": cleaner_id
    }
    r = requests.post(f"{BASE_URL}/settlements/", json=settlement_data)
    settlement_id = r.json()["id"] if r.status_code == 200 else None
    print_response("创建结算单结果", r)
    
    print("\n" + "="*60)
    print("  15. 最终确认结算")
    print("="*60)
    r = requests.put(f"{BASE_URL}/settlements/{settlement_id}/finalize", 
                     json={"notes": "本月结算，已扣除返工和客诉费用"})
    print_response("最终结算结果", r)
    
    print("\n" + "="*60)
    print("  16. 批量派单测试")
    print("="*60)
    batch_tasks = [
        {
            "task_no": "TASK20240115002",
            "order_id": order_id,
            "cleaner_id": cleaner_id,
            "deadline": deadline,
            "base_fee": 180
        },
        {
            "task_no": "TASK20240115003",
            "order_id": order_id,
            "cleaner_id": cleaner_id,
            "deadline": deadline,
            "base_fee": 220
        }
    ]
    r = requests.post(f"{BASE_URL}/tasks/batch", json=batch_tasks)
    print_response("批量派单结果", r)
    
    print("\n" + "="*60)
    print("  17. 查看完整任务详情")
    print("="*60)
    r = requests.get(f"{BASE_URL}/tasks/{task_id}/detail")
    print_response("任务完整详情", r)
    
    print("\n" + "="*60)
    print("  18. 查看操作日志")
    print("="*60)
    r = requests.get(f"{BASE_URL}/logs/")
    print_response("操作日志", r)
    
    print("\n" + "="*60)
    print("  ✅ 测试完成!")
    print("="*60)


if __name__ == "__main__":
    try:
        test_full_flow()
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器!")
        print("请先运行: python main.py 或 uvicorn main:app --reload")
        exit(1)
