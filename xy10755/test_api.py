#!/usr/bin/env python3
"""
多仓履约拆单系统 API 测试脚本
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_health():
    """测试服务是否启动"""
    try:
        response = requests.get(f"{BASE_URL}/docs")
        return response.status_code == 200
    except:
        return False

def test_init_sample_data():
    """初始化示例数据"""
    response = requests.post(f"{BASE_URL}/api/init-sample-data/")
    print(f"初始化示例数据: {response.status_code}")
    print(response.json())
    return response.ok

def test_create_order():
    """创建测试订单"""
    order_data = {
        "order_no": f"TEST{__import__('time').time():.0f}",
        "customer_name": "张三",
        "customer_address": "北京市 朝阳区",
        "order_lines": [
            {
                "sku": "SKU001",
                "product_name": "测试商品A",
                "quantity": 2,
                "unit_price": 99.00,
                "original_input": "原始数据A"
            }
        ],
        "raw_input": "原始订单数据"
    }
    response = requests.post(f"{BASE_URL}/api/orders/", json=order_data)
    print(f"\n创建订单: {response.status_code}")
    result = response.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return result.get('order_no')

def test_list_orders():
    """查询订单列表"""
    response = requests.get(f"{BASE_URL}/api/orders/")
    print(f"\n查询订单列表: {response.status_code}")
    orders = response.json()
    print(f"共 {len(orders)} 个订单")
    return orders

def test_split_order(order_no):
    """执行拆单"""
    data = {
        "order_no": order_no,
        "idempotency_key": f"{order_no}-test-{__import__('time').time()}"
    }
    response = requests.post(f"{BASE_URL}/api/orders/split/", json=data)
    print(f"\n执行拆单: {response.status_code}")
    result = response.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return result

def test_list_warehouses():
    """查询仓库列表"""
    response = requests.get(f"{BASE_URL}/api/warehouses/")
    print(f"\n查询仓库列表: {response.status_code}")
    warehouses = response.json()
    print(f"共 {len(warehouses)} 个仓库")
    for wh in warehouses:
        print(f"  - {wh['warehouse_code']}: {wh['warehouse_name']}")
    return warehouses

def test_list_inventories():
    """查询库存"""
    response = requests.get(f"{BASE_URL}/api/inventories/")
    print(f"\n查询库存: {response.status_code}")
    inventories = response.json()
    print(f"共 {len(inventories)} 条库存记录")
    for inv in inventories:
        available = inv['quantity'] - inv['reserved_quantity']
        print(f"  - 仓库{inv['warehouse_id']} SKU:{inv['sku']} 可用:{available}")

def main():
    print("=" * 60)
    print("多仓履约拆单系统 API 测试")
    print("=" * 60)

    if not test_health():
        print("\n❌ 后端服务未启动，请先运行:")
        print("  cd backend && pip install -r requirements.txt && python main.py")
        return

    print("✅ 后端服务运行正常")

    print("\n" + "=" * 60)
    print("1. 初始化示例数据")
    print("=" * 60)
    test_init_sample_data()

    print("\n" + "=" * 60)
    print("2. 查询基础数据")
    print("=" * 60)
    test_list_warehouses()
    test_list_inventories()

    print("\n" + "=" * 60)
    print("3. 创建测试订单")
    print("=" * 60)
    order_no = test_create_order()
    test_list_orders()

    print("\n" + "=" * 60)
    print("4. 执行拆单")
    print("=" * 60)
    if order_no:
        test_split_order(order_no)

    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)
    print("\n下一步:")
    print("  1. 启动前端: cd frontend && npm install && npm run dev")
    print("  2. 访问 http://localhost:5173 查看界面")
    print("  3. 查看API文档: http://localhost:8000/docs")

if __name__ == "__main__":
    main()
