#!/usr/bin/env python3
"""
多仓履约拆单系统 - 幂等性与状态一致性测试
测试目标：
1. 同一订单同一 idempotency_key 第二次拆单不应产生新的履约记录
2. 版本号不应在重复调用时递增
3. 库存预留应准确，不重复扣减
4. 无库存时状态应为 partial_completed 或 failed，而非 completed
"""
import requests
import json
import time
import uuid

BASE_URL = "http://localhost:8000"


def request(method, path, **kwargs):
    url = f"{BASE_URL}{path}"
    return requests.request(method, url, **kwargs)


def print_header(title):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


def print_pass(msg):
    print(f"  ✅ {msg}")


def print_fail(msg):
    print(f"  ❌ {msg}")


def print_info(msg):
    print(f"  ℹ️ {msg}")


def test_1_idempotency_check():
    """测试1: 幂等性验证 - 重复拆单不产生新记录"""
    print_header("测试1: 幂等性验证 - 重复拆单不产生新记录")

    order_no = f"IDEMPOTENT-{int(time.time())}"

    print_info(f"创建订单: {order_no}")
    order_data = {
        "order_no": order_no,
        "customer_name": "测试用户",
        "customer_address": "北京市 海淀区",
        "order_lines": [
            {
                "sku": "SKU001",
                "product_name": "测试商品",
                "quantity": 1,
                "unit_price": 100.0
            }
        ]
    }
    response = request("POST", "/api/orders/", json=order_data)
    assert response.status_code == 200, "订单创建失败"
    order_id = response.json()['id']
    print_pass("订单创建成功")

    idempotency_key = f"key-{order_no}-12345"

    print_info(f"第一次拆单 (key={idempotency_key})")
    result1 = request("POST", "/api/orders/split/", json={
        "order_no": order_no,
        "idempotency_key": idempotency_key
    }).json()
    version1 = result1['data']['version']
    records1 = len(result1['data']['fulfillment_records'])
    print_pass(f"第一次拆单: 版本={version1}, 履约记录数={records1}")

    print_info(f"第二次拆单 (相同 key={idempotency_key})")
    result2 = request("POST", "/api/orders/split/", json={
        "order_no": order_no,
        "idempotency_key": idempotency_key
    }).json()
    version2 = result2['data']['version']
    records2 = len(result2['data']['fulfillment_records'])
    print_pass(f"第二次拆单: 版本={version2}, 履约记录数={records2}")

    if version1 == version2:
        print_pass("版本号未递增 ✓")
    else:
        print_fail(f"版本号错误递增: {version1} -> {version2}")
        return False

    if records1 == records2:
        print_pass(f"履约记录数未增加: {records1} ✓")
    else:
        print_fail(f"履约记录数错误增加: {records1} -> {records2}")
        return False

    detail = request("GET", f"/api/orders/{order_id}").json()
    final_records = len(detail['fulfillment_records'])
    if final_records == 1:
        print_pass(f"数据库中履约记录数正确: {final_records} ✓")
    else:
        print_fail(f"数据库中履约记录数错误: {final_records} (应为1)")
        return False

    return True


def test_2_inventory_consistency():
    """测试2: 库存一致性验证 - 不重复预留库存"""
    print_header("测试2: 库存一致性验证 - 不重复预留库存")

    order_no = f"INVENTORY-{int(time.time())}"

    print_info("查询拆单前初始库存")
    inventory_before = request("GET", "/api/inventories/", params={"sku": "SKU001"}).json()
    total_reserved_before = sum(inv['reserved_quantity'] for inv in inventory_before)
    print_info(f"拆单前: 总预留库存 = {total_reserved_before}")

    print_info(f"创建订单: {order_no}, 数量 = 3")
    order_data = {
        "order_no": order_no,
        "customer_name": "测试用户",
        "customer_address": "上海市 浦东新区",
        "order_lines": [
            {
                "sku": "SKU001",
                "product_name": "测试商品",
                "quantity": 3,
                "unit_price": 100.0
            }
        ]
    }
    response = request("POST", "/api/orders/", json=order_data)
    order_id = response.json()['id']

    idempotency_key = f"key-{order_no}-67890"

    print_info("连续拆单 3 次 (相同 key)...")
    for i in range(3):
        request("POST", "/api/orders/split/", json={
            "order_no": order_no,
            "idempotency_key": idempotency_key
        })

    print_info("查询拆单后库存")
    inventory_after = request("GET", "/api/inventories/", params={"sku": "SKU001"}).json()
    total_reserved_after = sum(inv['reserved_quantity'] for inv in inventory_after)
    reserved_increased = total_reserved_after - total_reserved_before

    print_info(f"拆单后: 总预留库存 = {total_reserved_after}, 增加量 = {reserved_increased}")

    if reserved_increased == 3:
        print_pass(f"库存预留量正确: 增加了 {reserved_increased} (订单数量 = 3) ✓")
    else:
        print_fail(f"库存预留量错误: 增加了 {reserved_increased} (应该是 3)")
        print_info(f"  拆单前总预留: {total_reserved_before}")
        print_info(f"  拆单后总预留: {total_reserved_after}")
        return False

    detail = request("GET", f"/api/orders/{order_id}").json()
    final_records = len(detail['fulfillment_records'])
    if final_records == 1:
        print_pass(f"履约记录数正确: {final_records} ✓")
    else:
        print_fail(f"履约记录数错误: {final_records} (应该是 1)")
        return False

    return True


def test_3_no_inventory_status():
    """测试3: 无库存状态验证 - 状态不应为 completed"""
    print_header("测试3: 无库存状态验证 - 状态不应为 completed")

    order_no = f"NOINV-{int(time.time())}"
    fake_sku = f"SKU-{uuid.uuid4().hex[:6]}"  # 肯定不存在的SKU

    print_info(f"创建订单: {order_no}, 使用不存在的 SKU={fake_sku}")
    order_data = {
        "order_no": order_no,
        "customer_name": "测试用户",
        "customer_address": "广州市 天河区",
        "order_lines": [
            {
                "sku": fake_sku,
                "product_name": "不存在的商品",
                "quantity": 1,
                "unit_price": 100.0
            }
        ]
    }
    response = request("POST", "/api/orders/", json=order_data)
    order_id = response.json()['id']
    print_pass("订单创建成功")

    print_info("执行拆单...")
    response = request("POST", "/api/orders/split/", json={
        "order_no": order_no,
        "idempotency_key": f"key-{order_no}-test"
    })
    result = response.json()

    print_info(f"API响应: status_code={response.status_code}, success={result.get('success')}, message={result.get('message')}")

    if 'data' not in result:
        print_fail(f"响应结构错误: 缺少 data 字段")
        return False

    status = result['data']['status']
    records_count = len(result['data']['fulfillment_records'])

    print_info(f"拆单结果: 状态={status}, 履约记录数={records_count}")

    if status != "completed":
        print_pass(f"状态正确: {status} (不是 completed) ✓")
    else:
        print_fail(f"状态错误: {status} (无库存时不应为 completed)")
        return False

    if records_count == 0:
        print_pass(f"履约记录数正确: {records_count} (无库存不应有履约记录) ✓")
    else:
        print_fail(f"履约记录数错误: {records_count} (无库存应为 0)")
        return False

    return True


def test_4_partial_status():
    """测试4: 部分成功状态验证 - mixed case"""
    print_header("测试4: 部分成功状态验证 - 部分有库存部分无库存")

    order_no = f"PARTIAL-{int(time.time())}"
    fake_sku = f"SKU-{uuid.uuid4().hex[:6]}"

    print_info(f"创建订单: 包含1个存在SKU + 1个不存在SKU")
    order_data = {
        "order_no": order_no,
        "customer_name": "测试用户",
        "customer_address": "北京市 朝阳区",
        "order_lines": [
            {
                "sku": "SKU001",
                "product_name": "存在的商品",
                "quantity": 1,
                "unit_price": 100.0
            },
            {
                "sku": fake_sku,
                "product_name": "不存在的商品",
                "quantity": 1,
                "unit_price": 100.0
            }
        ]
    }
    response = request("POST", "/api/orders/", json=order_data)
    order_id = response.json()['id']

    print_info("执行拆单...")
    result = request("POST", "/api/orders/split/", json={
        "order_no": order_no,
        "idempotency_key": f"key-{order_no}-partial"
    }).json()

    status = result['data']['status']
    records_count = len(result['data']['fulfillment_records'])

    print_info(f"拆单结果: 状态={status}, 履约记录数={records_count}")

    if status == "partial_completed":
        print_pass(f"状态正确: partial_completed ✓")
    else:
        print_fail(f"状态错误: {status} (应为 partial_completed)")
        return False

    if records_count == 1:
        print_pass(f"履约记录数正确: {records_count} (1个成功, 1个失败) ✓")
    else:
        print_fail(f"履约记录数错误: {records_count} (应为 1)")
        return False

    return True


def test_5_failed_state_idempotency():
    """测试5: failed状态幂等性验证 - 重复调用版本号不递增"""
    print_header("测试5: failed状态幂等性验证 - 重复调用版本号不递增")

    order_no = f"FAILED-IDEMP-{int(__import__('time').time())}"
    fake_sku = f"SKU-{__import__('uuid').uuid4().hex[:6]}"

    print_info(f"创建订单: {order_no}, 使用不存在的 SKU={fake_sku}")
    order_data = {
        "order_no": order_no,
        "customer_name": "测试用户",
        "customer_address": "北京市 朝阳区",
        "order_lines": [
            {
                "sku": fake_sku,
                "product_name": "不存在的商品",
                "quantity": 1,
                "unit_price": 100.0
            }
        ]
    }
    response = request("POST", "/api/orders/", json=order_data)
    order_id = response.json()['id']
    print_pass("订单创建成功")

    idempotency_key = f"key-{order_no}-test123"

    print_info(f"第一次拆单 (key={idempotency_key})")
    result1 = request("POST", "/api/orders/split/", json={
        "order_no": order_no,
        "idempotency_key": idempotency_key
    }).json()
    status1 = result1['data']['status']
    version1 = result1['data']['version']
    print_pass(f"第一次拆单: 状态={status1}, 版本={version1}")

    if status1 != "failed":
        print_fail(f"状态错误: {status1} (应为 failed)")
        return False

    print_info(f"第二次拆单 (相同 key={idempotency_key})")
    result2 = request("POST", "/api/orders/split/", json={
        "order_no": order_no,
        "idempotency_key": idempotency_key
    }).json()
    status2 = result2['data']['status']
    version2 = result2['data']['version']
    print_pass(f"第二次拆单: 状态={status2}, 版本={version2}")

    if version1 == version2:
        print_pass(f"版本号未递增: {version1} ✓")
    else:
        print_fail(f"版本号错误递增: {version1} -> {version2}")
        return False

    if status1 == status2:
        print_pass(f"状态保持一致: {status1} ✓")
    else:
        print_fail(f"状态不一致: {status1} -> {status2}")
        return False

    print_info("验证数据库中订单状态...")
    detail = request("GET", f"/api/orders/{order_id}").json()
    final_version = detail['order']['version']
    final_status = detail['order']['status']

    if final_version == version1:
        print_pass(f"数据库版本正确: {final_version} ✓")
    else:
        print_fail(f"数据库版本错误: {final_version} (应为 {version1})")
        return False

    if final_status == "failed":
        print_pass(f"数据库状态正确: {final_status} ✓")
    else:
        print_fail(f"数据库状态错误: {final_status} (应为 failed)")
        return False

    return True


def main():
    print("=" * 60)
    print("  多仓履约拆单系统 - 幂等性与状态一致性验证")
    print("=" * 60)

    try:
        request("GET", "/api/orders/")
    except:
        print("\n❌ 后端服务未启动，请先运行: cd backend && python main.py")
        return

    tests = [
        test_1_idempotency_check,
        test_2_inventory_consistency,
        test_3_no_inventory_status,
        test_4_partial_status,
        test_5_failed_state_idempotency
    ]

    results = []
    for test in tests:
        try:
            results.append(test())
        except Exception as e:
            print_fail(f"测试异常: {e}")
            import traceback
            traceback.print_exc()
            results.append(False)

    print_header("测试总结")
    passed = sum(results)
    total = len(results)
    print(f"  通过: {passed}/{total}")

    if passed == total:
        print("\n✅ 所有测试通过! 幂等性和状态一致性验证成功!")
    else:
        print(f"\n❌ 有 {total - passed} 个测试失败，请检查修复")


if __name__ == "__main__":
    main()
