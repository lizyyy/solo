#!/usr/bin/env python3
"""苗圃检疫证书 API 测试脚本"""
import requests
import json
from datetime import date, timedelta

BASE_URL = "http://localhost:8000/api"


def test_full_flow():
    print("=" * 60)
    print("苗圃检疫证书 API - 完整流程测试")
    print("=" * 60)

    print("\n[1] 创建苗木批次")
    batch_data = {
        "batch_no": "BATCH-001",
        "species": "红枫",
        "quantity": 1000,
        "origin": "江苏苗圃",
        "production_date": str(date.today())
    }
    resp = requests.post(f"{BASE_URL}/batches/", json=batch_data)
    print(f"  状态码: {resp.status_code}")
    if resp.status_code == 200:
        print("  ✓ 批次创建成功:", batch_data["batch_no"])
    else:
        print(f"  结果: {resp.json()}")

    print("\n[2] 创建检疫证书（有效期30天）")
    cert_data = {
        "cert_no": "CERT-001",
        "batch_no": "BATCH-001",
        "issue_date": str(date.today()),
        "expiry_date": str(date.today() + timedelta(days=30)),
        "issuer": "林业局A"
    }
    resp = requests.post(f"{BASE_URL}/certificates/", json=cert_data)
    print(f"  状态码: {resp.status_code}")
    if resp.status_code == 200:
        print("  ✓ 证书创建成功:", cert_data["cert_no"])
    else:
        print(f"  结果: {resp.json()}")

    print("\n[3] 创建目的地（可发货地区）")
    dest_data = {
        "region_code": "SH",
        "region_name": "上海",
        "is_embargoed": False
    }
    resp = requests.post(f"{BASE_URL}/destinations/", json=dest_data)
    print(f"  状态码: {resp.status_code}")
    if resp.status_code == 200:
        print("  ✓ 目的地创建成功:", dest_data["region_name"])
    else:
        print(f"  结果: {resp.json()}")

    print("\n[4] 创建禁运目的地")
    dest_data2 = {
        "region_code": "BJ",
        "region_name": "北京",
        "is_embargoed": True,
        "embargo_reason": "病虫害防控",
        "embargo_date": str(date.today())
    }
    resp = requests.post(f"{BASE_URL}/destinations/", json=dest_data2)
    print(f"  状态码: {resp.status_code}")
    if resp.status_code == 200:
        print("  ✓ 禁运目的地创建成功:", dest_data2["region_name"])
    else:
        print(f"  结果: {resp.json()}")

    print("\n[5] 创建销售订单（正常发货上海）")
    order_data = {
        "order_no": "ORDER-001",
        "batch_no": "BATCH-001",
        "cert_no": "CERT-001",
        "region_code": "SH",
        "quantity": 500,
        "customer": "客户A"
    }
    resp = requests.post(f"{BASE_URL}/orders/", json=order_data)
    print(f"  状态码: {resp.status_code}")
    if resp.status_code == 200:
        print("  ✓ 订单创建成功:", order_data["order_no"])
        print(f"    当前状态: {resp.json()['status']}")
    else:
        print(f"  结果: {resp.json()}")

    print("\n[6] 订单规则校验")
    resp = requests.get(f"{BASE_URL}/orders/ORDER-001/check")
    print(f"  状态码: {resp.status_code}")
    if resp.status_code == 200:
        result = resp.json()
        print(f"  ✓ 校验完成")
        print(f"    证书校验: {'✓ 通过' if result['cert_check'] else '✗ 失败'} - {result['cert_message']}")
        print(f"    禁运校验: {'✓ 通过' if result['embargo_check'] else '✗ 失败'} - {result['embargo_message']}")
        print(f"    最终状态: {result['final_status']}")
    else:
        print(f"  结果: {resp.json()}")

    print("\n[7] 创建销售订单（禁运地区北京）")
    order_data2 = {
        "order_no": "ORDER-002",
        "batch_no": "BATCH-001",
        "cert_no": "CERT-001",
        "region_code": "BJ",
        "quantity": 300,
        "customer": "客户B"
    }
    resp = requests.post(f"{BASE_URL}/orders/", json=order_data2)
    print(f"  状态码: {resp.status_code}")
    if resp.status_code == 200:
        print("  ✓ 订单创建成功:", order_data2["order_no"])
    else:
        print(f"  结果: {resp.json()}")

    print("\n[8] 禁运订单规则校验")
    resp = requests.get(f"{BASE_URL}/orders/ORDER-002/check")
    print(f"  状态码: {resp.status_code}")
    if resp.status_code == 200:
        result = resp.json()
        print(f"  ✓ 校验完成")
        print(f"    证书校验: {'✓ 通过' if result['cert_check'] else '✗ 失败'}")
        print(f"    禁运校验: {'✓ 通过' if result['embargo_check'] else '✗ 失败'} - {result['embargo_message']}")
        print(f"    最终状态: {result['final_status']}")
        print(f"    需要复核: {result['need_recheck']}")
    else:
        print(f"  结果: {resp.json()}")

    print("\n[9] 拆单测试")
    resp = requests.post(
        f"{BASE_URL}/orders/ORDER-001/split",
        params={"operator": "测试员"},
        json=[200, 300]
    )
    print(f"  状态码: {resp.status_code}")
    if resp.status_code == 200:
        orders = resp.json()
        print(f"  ✓ 拆单成功，生成 {len(orders)} 个子订单")
        for o in orders:
            print(f"    - {o['order_no']}: {o['quantity']} 株")
    else:
        print(f"  结果: {resp.json()}")

    print("\n[10] 订单历史记录")
    resp = requests.get(f"{BASE_URL}/orders/ORDER-001/history")
    print(f"  状态码: {resp.status_code}")
    if resp.status_code == 200:
        history = resp.json()
        print(f"  ✓ 历史记录获取成功")
        print(f"    订单状态: {history['order']['status']}")
        print(f"    处理轨迹数: {len(history['traces'])}")
        for t in history['traces'][:3]:
            print(f"      - {t['action']}: {t['result']}")
    else:
        print(f"  结果: {resp.json()}")

    print("\n[11] 测试重复创建订单")
    resp = requests.post(f"{BASE_URL}/orders/", json=order_data)
    print(f"  状态码: {resp.status_code}")
    if resp.status_code != 200:
        error = resp.json()['detail']
        print(f"  ✓ 正确识别重复请求")
        print(f"    错误类型: {error['error_type']}")
        print(f"    提示信息: {error['message']}")
    else:
        print(f"  结果: {resp.json()}")

    print("\n" + "=" * 60)
    print("测试完成！请访问 http://localhost:8000/docs 查看完整API文档")
    print("=" * 60)


if __name__ == "__main__":
    try:
        test_full_flow()
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器，请确保服务已启动在 http://localhost:8000")
