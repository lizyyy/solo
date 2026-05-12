import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def header():
    return {"Content-Type": "application/json"}

def print_separator(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def create_member(member_data):
    response = requests.post(
        f"{BASE_URL}/api/members",
        headers=header(),
        json=member_data
    )
    result = response.json()
    print(f"  [创建会员] {member_data['member_no']}: {'成功' if result['success'] else '失败'} - {result['message']}")
    return result

def main():
    print_separator("开始造数 - 内置样例数据")
    
    tomorrow = (datetime.utcnow() + timedelta(days=1)).isoformat()
    next_year = (datetime.utcnow() + timedelta(days=365)).isoformat()
    
    members_to_create = [
        {
            "member_no": "M001",
            "name": "张三",
            "phone": "13800000001",
            "balance": 500.0,
            "points": 1000,
            "points_expire_at": next_year,
            "store_id": "STORE01"
        },
        {
            "member_no": "M002",
            "name": "张三",
            "phone": "13800000001",
            "balance": 300.0,
            "points": 500,
            "points_expire_at": tomorrow,
            "store_id": "STORE02"
        },
        {
            "member_no": "M003",
            "name": "李四",
            "phone": "13800000002",
            "balance": 800.0,
            "points": 2000,
            "points_expire_at": next_year,
            "store_id": "STORE01"
        },
        {
            "member_no": "M004",
            "name": "李四五",
            "phone": "13800000002",
            "balance": 200.0,
            "points": 300,
            "points_expire_at": next_year,
            "store_id": "STORE03"
        },
        {
            "member_no": "M005",
            "name": "王五",
            "phone": "13800000003",
            "balance": -100.0,
            "points": 100,
            "points_expire_at": next_year,
            "store_id": "STORE01"
        },
        {
            "member_no": "M006",
            "name": "赵六",
            "phone": "13800000004",
            "balance": 1000.0,
            "points": 5000,
            "points_expire_at": next_year,
            "store_id": "STORE02"
        }
    ]
    
    print("\n【1. 创建会员】")
    for m in members_to_create:
        create_member(m)
    
    print("\n【2. 扫描重复候选】")
    response = requests.post(f"{BASE_URL}/api/duplicates/scan", headers=header())
    result = response.json()
    print(f"  扫描结果: {result['message']}")
    if result['data']:
        for c in result['data']:
            print(f"    - 手机号 {c['phone']}: {c['reason']}")
    
    print_separator("造数完成")
    print("\n数据说明:")
    print("  M001 + M002: 同手机号同姓名 (安全合并场景)")
    print("  M003 + M004: 同手机号不同姓名 (信息冲突待审场景)")
    print("  M005: 储值余额为负 (储值异常拦截场景)")
    print("  M006: 单独会员")
    print("\n可使用 curl 演示脚本进行完整流程测试!")

if __name__ == "__main__":
    main()
