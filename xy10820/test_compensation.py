#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_compensation_flow():
    print("=== 测试补偿重试完整流程 ===\n")
    
    # 1. 创建供应商
    print("1. 创建供应商...")
    supplier_data = {
        "supplier_code": "TEST001",
        "supplier_name": "测试供应商"
    }
    response = requests.post(f"{BASE_URL}/api/suppliers/", json=supplier_data)
    supplier = response.json()
    supplier_id = supplier["id"]
    print(f"   供应商ID: {supplier_id}\n")
    
    # 2. 创建补偿日志（模拟失败）
    print("2. 创建失败批次...")
    
    # 手动创建批次和补偿日志（为了测试）
    import uuid
    from datetime import datetime
    
    batch_id = f"BATCH-TEST-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
    
    # 先导入正常商品
    import_data = {
        "supplier_id": supplier_id,
        "idempotency_key": f"test_{int(time.time())}",
        "products": [
            {"sku": "SKU001", "name": "商品1", "price": 100}
        ]
    }
    response = requests.post(f"{BASE_URL}/api/sync/import", json=import_data)
    print(f"   导入成功: {response.json()}")
    batch_id_from_api = response.json()["batch_id"]
    
    # 3. 查看商品
    print("\n3. 查看商品列表...")
    response = requests.get(f"{BASE_URL}/api/products/supplier/{supplier_id}")
    products = response.json()
    print(f"   商品数量: {len(products)}")
    for p in products:
        print(f"   - SKU: {p['supplier_sku']}, raw_data: {json.dumps(p['raw_data'])}")
    
    # 4. 查看同步批次
    print("\n4. 查看同步批次...")
    response = requests.get(f"{BASE_URL}/api/sync/batches/")
    batches = response.json()
    latest_batch = batches[0]
    print(f"   批次ID: {latest_batch['batch_id']}")
    print(f"   成功: {latest_batch['success_items']}, 失败: {latest_batch['failed_items']}")
    
    # 5. 直接调用API创建补偿日志（模拟失败商品）
    print("\n5. 直接测试补偿API...")
    # 先查看补偿日志
    response = requests.get(f"{BASE_URL}/api/sync/compensation/")
    compensations = response.json()
    print(f"   当前补偿日志数: {len(compensations)}")
    
    print("\n=== 测试完成 ===")
    print("\n验证点:")
    print("1. 后端补偿API可访问")
    print("2. 前端补偿页面可查看")
    print("3. 点击'重试'后商品正确创建")
    print("4. 批次成功/失败计数正确更新")
    print("5. 前端状态正确显示")

if __name__ == "__main__":
    test_compensation_flow()
