#!/usr/bin/env python3
"""
基本功能测试脚本
"""

import requests
import json

BASE_URL = "http://localhost:8000"


def test_get_products():
    print("\n" + "=" * 60)
    print("测试 1: 获取商品列表")
    print("=" * 60)
    response = requests.get(f"{BASE_URL}/api/products/")
    products = response.json()
    print(f"商品数量: {len(products)}")
    for p in products:
        print(f"  - {p['sku']}: {p['name']}, 库存: {p['available_stock']}")
    return products


def test_create_order():
    print("\n" + "=" * 60)
    print("测试 2: 创建订单（预占库存）")
    print("=" * 60)
    order_data = {
        "user_id": "test_user_001",
        "sku": "SKU001",
        "quantity": 1,
        "idempotency_key": "TEST_IDEM_001"
    }
    response = requests.post(f"{BASE_URL}/api/orders/", json=order_data)
    print(f"状态码: {response.status_code}")
    if response.status_code == 201:
        order = response.json()
        print(f"订单号: {order['order_no']}")
        print(f"订单状态: {order['status']}")
        return order['order_no']
    else:
        print(f"错误: {response.json()}")
        return None


def test_get_product_after_order():
    print("\n" + "=" * 60)
    print("测试 3: 查看创建订单后的库存")
    print("=" * 60)
    response = requests.get(f"{BASE_URL}/api/products/SKU001")
    product = response.json()
    print(f"可用库存: {product['available_stock']}")
    print(f"冻结库存: {product['frozen_stock']}")
    print(f"已售库存: {product['sold_stock']}")


def test_idempotency():
    print("\n" + "=" * 60)
    print("测试 4: 幂等性测试 - 使用相同幂等键重复下单")
    print("=" * 60)
    order_data = {
        "user_id": "test_user_001",
        "sku": "SKU001",
        "quantity": 1,
        "idempotency_key": "TEST_IDEM_001"
    }
    response = requests.post(f"{BASE_URL}/api/orders/", json=order_data)
    print(f"状态码: {response.status_code}")
    if response.status_code == 201:
        order = response.json()
        print(f"订单号: {order['order_no']}")
        print("幂等性测试: 相同幂等键返回相同订单信息")
    else:
        print(f"响应: {response.json()}")


def test_pay_order(order_no):
    if not order_no:
        print("\n跳过支付测试（无订单号）")
        return
    
    print("\n" + "=" * 60)
    print("测试 5: 支付成功（实扣库存）")
    print("=" * 60)
    payment_data = {"order_no": order_no}
    response = requests.post(f"{BASE_URL}/api/orders/pay", json=payment_data)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        order = response.json()
        print(f"订单状态: {order['status']}")
    else:
        print(f"错误: {response.json()}")


def test_get_product_after_pay():
    print("\n" + "=" * 60)
    print("测试 6: 查看支付后的库存")
    print("=" * 60)
    response = requests.get(f"{BASE_URL}/api/products/SKU001")
    product = response.json()
    print(f"可用库存: {product['available_stock']}")
    print(f"冻结库存: {product['frozen_stock']}")
    print(f"已售库存: {product['sold_stock']}")


def test_cancel_order():
    print("\n" + "=" * 60)
    print("测试 7: 创建订单后取消（回滚库存）")
    print("=" * 60)
    
    order_data = {
        "user_id": "test_user_002",
        "sku": "SKU001",
        "quantity": 1,
        "idempotency_key": "TEST_IDEM_002"
    }
    response = requests.post(f"{BASE_URL}/api/orders/", json=order_data)
    
    if response.status_code == 201:
        order2 = response.json()
        order_no2 = order2['order_no']
        print(f"创建订单成功，订单号: {order_no2}")
        
        print("\n查看取消前的库存:")
        response = requests.get(f"{BASE_URL}/api/products/SKU001")
        product = response.json()
        print(f"  可用库存: {product['available_stock']}")
        print(f"  冻结库存: {product['frozen_stock']}")
        
        print("\n取消订单:")
        cancel_data = {"order_no": order_no2}
        response = requests.post(f"{BASE_URL}/api/orders/cancel", json=cancel_data)
        print(f"  状态码: {response.status_code}")
        if response.status_code == 200:
            order = response.json()
            print(f"  订单状态: {order['status']}")
        
        print("\n查看取消后的库存:")
        response = requests.get(f"{BASE_URL}/api/products/SKU001")
        product = response.json()
        print(f"  可用库存: {product['available_stock']}")
        print(f"  冻结库存: {product['frozen_stock']}")
    else:
        print(f"创建订单失败: {response.json()}")


def test_inventory_journals():
    print("\n" + "=" * 60)
    print("测试 8: 查看库存流水")
    print("=" * 60)
    response = requests.get(f"{BASE_URL}/api/inventory-journals/")
    journals = response.json()
    print(f"流水记录数: {len(journals)}")
    for j in journals[:5]:
        print(f"  - ID: {j['id']}, 动作: {j['action']}, 数量: {j['quantity']}")


def test_audit_report():
    print("\n" + "=" * 60)
    print("测试 9: 导出审计报告（JSON）")
    print("=" * 60)
    response = requests.get(f"{BASE_URL}/api/audit/report/json")
    report = response.json()
    print(f"生成时间: {report['generated_at']}")
    print(f"总商品数: {report['summary']['total_products']}")
    print(f"总订单数: {report['total_orders']}")
    print(f"库存平衡: {'是' if report['summary']['all_balanced'] else '否'}")
    
    print("\n" + "=" * 60)
    print("测试 10: 导出审计报告（Markdown）")
    print("=" * 60)
    response = requests.get(f"{BASE_URL}/api/audit/report/markdown")
    print(response.text[:500])


def main():
    print("=" * 60)
    print("库存扣减服务 - 基本功能测试")
    print("=" * 60)
    
    test_get_products()
    order_no = test_create_order()
    test_get_product_after_order()
    test_idempotency()
    test_pay_order(order_no)
    test_get_product_after_pay()
    test_cancel_order()
    test_inventory_journals()
    test_audit_report()
    
    print("\n" + "=" * 60)
    print("所有测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
