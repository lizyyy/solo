import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def seed_data():
    print("=== 开始造数 ===")
    
    print("\n1. 创建货柜...")
    cabinets = [
        {"cabinet_no": "CAB001", "location": "一楼大厅"},
        {"cabinet_no": "CAB002", "location": "二楼办公室"},
    ]
    for cab in cabinets:
        try:
            r = requests.post(f"{BASE_URL}/cabinets/", json=cab)
            print(f"  创建货柜 {cab['cabinet_no']}: {r.status_code}")
        except Exception as e:
            print(f"  创建货柜失败: {e}")
    
    print("\n2. 创建SKU...")
    skus = [
        {"sku_code": "SKU001", "name": "可乐", "price": 3.0, "unit": "瓶"},
        {"sku_code": "SKU002", "name": "矿泉水", "price": 2.0, "unit": "瓶"},
        {"sku_code": "SKU003", "name": "薯片", "price": 5.0, "unit": "包"},
    ]
    for sku in skus:
        try:
            r = requests.post(f"{BASE_URL}/skus/", json=sku)
            print(f"  创建SKU {sku['sku_code']}: {r.status_code}")
        except Exception as e:
            print(f"  创建SKU失败: {e}")
    
    print("\n3. 创建库存快照...")
    snapshots = [
        {"cabinet_no": "CAB001", "sku_code": "SKU001", "quantity": 50, "batch_no": "B20240101", "created_by": "admin"},
        {"cabinet_no": "CAB001", "sku_code": "SKU002", "quantity": 30, "batch_no": "B20240102", "created_by": "admin"},
        {"cabinet_no": "CAB002", "sku_code": "SKU001", "quantity": 40, "batch_no": "B20240101", "created_by": "admin"},
    ]
    for snap in snapshots:
        try:
            r = requests.post(f"{BASE_URL}/inventory/snapshots/", json=snap)
            print(f"  创建库存快照 {snap['cabinet_no']}-{snap['sku_code']}: {r.status_code}")
        except Exception as e:
            print(f"  创建库存快照失败: {e}")
    
    print("\n4. 创建补货单...")
    replenishments = [
        {
            "cabinet_no": "CAB001",
            "replenishment_no": "REP20240115001",
            "items": [
                {"sku_code": "SKU001", "quantity": 20, "batch_no": "B20240115"},
                {"sku_code": "SKU002", "quantity": 15, "batch_no": "B20240115"},
            ],
            "remark": "日常补货",
            "operator_id": "OP001",
            "operator_name": "张三"
        }
    ]
    for rep in replenishments:
        try:
            r = requests.post(f"{BASE_URL}/replenishments/", json=rep)
            print(f"  创建补货单 {rep['replenishment_no']}: {r.status_code}")
        except Exception as e:
            print(f"  创建补货单失败: {e}")
    
    print("\n5. 确认补货单...")
    try:
        r = requests.post(
            f"{BASE_URL}/replenishments/REP20240115001/confirm",
            json={"operator_id": "OP001", "operator_name": "张三"}
        )
        print(f"  确认补货单: {r.status_code}")
    except Exception as e:
        print(f"  确认补货单失败: {e}")
    
    print("\n6. 创建货损记录...")
    damages = [
        {
            "cabinet_no": "CAB001",
            "sku_code": "SKU001",
            "quantity": 2,
            "damage_type": "包装破损",
            "reason": "运输过程中挤压",
            "reporter_id": "OP001",
            "reporter_name": "张三"
        }
    ]
    for dmg in damages:
        try:
            r = requests.post(f"{BASE_URL}/damages/", json=dmg)
            result = r.json()
            damage_no = result.get("damage_no", "")
            print(f"  创建货损记录: {r.status_code}, damage_no={damage_no}")
            
            if damage_no:
                r = requests.post(
                    f"{BASE_URL}/damages/{damage_no}/confirm",
                    json={"confirmer_id": "MGR001", "confirmer_name": "经理"}
                )
                print(f"  确认货损记录: {r.status_code}")
        except Exception as e:
            print(f"  货损记录操作失败: {e}")
    
    print("\n7. 创建临期下架记录...")
    expired = [
        {
            "cabinet_no": "CAB001",
            "sku_code": "SKU003",
            "quantity": 3,
            "batch_no": "B20231201",
            "operator_id": "OP001",
            "operator_name": "张三"
        }
    ]
    for exp in expired:
        try:
            r = requests.post(f"{BASE_URL}/expired-products/", json=exp)
            result = r.json()
            record_no = result.get("record_no", "")
            print(f"  创建临期下架记录: {r.status_code}, record_no={record_no}")
            
            if record_no:
                r = requests.post(f"{BASE_URL}/expired-products/{record_no}/confirm")
                print(f"  确认临期下架: {r.status_code}")
        except Exception as e:
            print(f"  临期下架操作失败: {e}")
    
    print("\n8. 创建结算单...")
    settlement = {
        "cabinet_no": "CAB001",
        "settlement_no": "SET202401",
        "period_start": (datetime.now() - timedelta(days=30)).isoformat(),
        "period_end": datetime.now().isoformat(),
        "created_by": "finance"
    }
    try:
        r = requests.post(f"{BASE_URL}/settlements/", json=settlement)
        print(f"  创建结算单: {r.status_code}")
    except Exception as e:
        print(f"  创建结算单失败: {e}")
    
    print("\n=== 造数完成 ===")
    print("\n可以访问 http://localhost:8000/docs 查看API文档")

if __name__ == "__main__":
    seed_data()
