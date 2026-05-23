#!/usr/bin/env python3
"""
无人货柜补货结算 API 自检脚本
覆盖: 正常流程、重复请求、脏数据、导出内容一致性
"""

import requests
import json
import sys
import time
from typing import Dict, Any

BASE_URL = "http://localhost:8000"


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_test(name: str, success: bool, details: str = ""):
    status = f"{Colors.GREEN}✓ PASS{Colors.END}" if success else f"{Colors.RED}✗ FAIL{Colors.END}"
    print(f"{status} {Colors.BOLD}{name}{Colors.END}")
    if details:
        print(f"  {Colors.BLUE}→ {details}{Colors.END}")


def wait_for_server(timeout: int = 30):
    """等待服务器启动"""
    print(f"{Colors.YELLOW}等待服务器启动...{Colors.END}")
    start = time.time()
    while time.time() - start < timeout:
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=2)
            if response.status_code == 200:
                print(f"{Colors.GREEN}服务器已就绪！{Colors.END}")
                return True
        except:
            time.sleep(1)
    print(f"{Colors.RED}服务器启动超时！{Colors.END}")
    return False


def test_normal_flow():
    """测试正常流程: 创建货柜 -> 创建补货 -> 状态确认 -> 创建结算 -> 导出"""
    print(f"\n{Colors.BLUE}=== 测试正常流程 ==={Colors.END}")
    all_passed = True

    try:
        cabinet_data = {"cabinet_no": "TEST_CAB001", "location": "测试位置1"}
        response = requests.post(f"{BASE_URL}/api/cabinets/", json=cabinet_data)
        result = response.json()
        passed = result.get("success") == True
        print_test("创建货柜", passed, f"cabinet_no: {cabinet_data['cabinet_no']}")
        if not passed:
            all_passed = False

        replenishment_data = {
            "batch_no": "TEST_BATCH001",
            "cabinet_no": "TEST_CAB001",
            "operator_id": "TEST_OP001",
            "operator_name": "测试员",
            "items": [
                {"sku_code": "TEST_SKU001", "sku_name": "测试商品1", "replenish_quantity": 30, "unit_price": 2.0},
                {"sku_code": "TEST_SKU002", "sku_name": "测试商品2", "replenish_quantity": 20, "unit_price": 3.0}
            ],
            "damages": [
                {"sku_code": "TEST_SKU001", "sku_name": "测试商品1", "damage_type": "破损", "quantity": 2, "unit_price": 2.0, "reason": "测试货损"}
            ],
            "expired_removals": [
                {"sku_code": "TEST_SKU002", "sku_name": "测试商品2", "quantity": 1, "unit_price": 3.0}
            ]
        }
        response = requests.post(f"{BASE_URL}/api/replenishments/", json=replenishment_data)
        result = response.json()
        passed = result.get("success") == True
        print_test("创建补货单", passed, f"batch_no: {replenishment_data['batch_no']}")
        if not passed:
            all_passed = False

        status_data = {"status": "confirmed", "operator_id": "TEST_OP001", "remark": "测试确认"}
        response = requests.patch(
            f"{BASE_URL}/api/replenishments/{replenishment_data['batch_no']}/status/",
            json=status_data
        )
        result = response.json()
        passed = result.get("success") == True and result.get("data", {}).get("batch", {}).get("status") == "confirmed"
        print_test("确认补货状态", passed, f"status: confirmed")
        if not passed:
            all_passed = False

        settlement_data = {
            "settlement_no": "TEST_SET001",
            "cabinet_no": "TEST_CAB001",
            "batch_no": "TEST_BATCH001"
        }
        response = requests.post(f"{BASE_URL}/api/settlements/", json=settlement_data)
        result = response.json()
        passed = result.get("success") == True
        print_test("创建结算单", passed, f"settlement_no: {settlement_data['settlement_no']}")
        if not passed:
            all_passed = False

        response = requests.get(f"{BASE_URL}/api/settlements/{settlement_data['settlement_no']}/export/")
        result = response.json()
        passed = result.get("success") == True
        settlement = result.get("data", {}).get("settlement", {}) if result.get("data") else {}
        print_test("导出结算数据", passed, f"导出数据完整: {bool(settlement)}")
        if not passed:
            all_passed = False

    except Exception as e:
        print_test("正常流程", False, f"异常: {str(e)}")
        all_passed = False

    return all_passed


def test_idempotency():
    """测试幂等性: 重复提交相同批次号或相同幂等键应返回现有数据"""
    print(f"\n{Colors.BLUE}=== 测试幂等性 ==={Colors.END}")
    all_passed = True

    try:
        replenishment_data = {
            "batch_no": "TEST_BATCH002",
            "cabinet_no": "TEST_CAB001",
            "operator_id": "TEST_OP001",
            "idempotent_key": "IDEMPOTENT_KEY_001",
            "items": [
                {"sku_code": "TEST_SKU003", "sku_name": "测试商品3", "replenish_quantity": 50, "unit_price": 5.0}
            ]
        }

        response1 = requests.post(f"{BASE_URL}/api/replenishments/", json=replenishment_data)
        result1 = response1.json()

        response2 = requests.post(f"{BASE_URL}/api/replenishments/", json=replenishment_data)
        result2 = response2.json()

        passed = result1.get("success") == True and result2.get("success") == True
        is_idempotent = result2.get("data", {}).get("is_idempotent") == True
        print_test("相同批次号幂等性", passed and is_idempotent, f"is_idempotent: {is_idempotent}")
        if not (passed and is_idempotent):
            all_passed = False

        replenishment_data2 = {
            "batch_no": "TEST_BATCH003",
            "cabinet_no": "TEST_CAB001",
            "operator_id": "TEST_OP001",
            "idempotent_key": "IDEMPOTENT_KEY_001",
            "items": [
                {"sku_code": "TEST_SKU004", "sku_name": "测试商品4", "replenish_quantity": 40, "unit_price": 4.0}
            ]
        }
        response3 = requests.post(f"{BASE_URL}/api/replenishments/", json=replenishment_data2)
        result3 = response3.json()

        batch_id_1 = result1.get("data", {}).get("batch", {}).get("batch_no")
        batch_id_2 = result3.get("data", {}).get("batch", {}).get("batch_no")
        is_same = batch_id_1 == batch_id_2
        print_test("相同幂等键不同批次号", result3.get("success") == True and is_same, f"返回相同批次: {is_same}")
        if not (result3.get("success") == True and is_same):
            all_passed = False

    except Exception as e:
        print_test("幂等性测试", False, f"异常: {str(e)}")
        all_passed = False

    return all_passed


def test_dirty_data():
    """测试脏数据/异常处理: 无效JSON、缺失必填字段、无效状态等"""
    print(f"\n{Colors.BLUE}=== 测试脏数据/异常处理 ==={Colors.END}")
    all_passed = True

    try:
        response = requests.post(f"{BASE_URL}/api/replenishments/", data="invalid json", headers={"Content-Type": "application/json"})
        passed = response.status_code in [400, 422, 500]
        print_test("无效JSON处理", passed, f"状态码: {response.status_code}")
        if not passed:
            all_passed = False

        bad_data = {"batch_no": "TEST_BAD001"}
        response = requests.post(f"{BASE_URL}/api/replenishments/", json=bad_data)
        passed = response.status_code in [400, 422]
        print_test("缺失必填字段处理", passed, f"状态码: {response.status_code}")
        if not passed:
            all_passed = False

        status_data = {"status": "invalid_status"}
        response = requests.patch(f"{BASE_URL}/api/replenishments/TEST_BATCH001/status/", json=status_data)
        result = response.json()
        passed = result.get("success") == False
        print_test("无效状态处理", passed, f"success: {result.get('success')}")
        if not passed:
            all_passed = False

        response = requests.get(f"{BASE_URL}/api/exception-logs/")
        result = response.json()
        logs_count = len(result.get("data", {}).get("logs", [])) if result.get("data") else 0
        print_test("异常日志已记录", logs_count > 0, f"日志数量: {logs_count}")
        if not (logs_count > 0):
            all_passed = False

    except Exception as e:
        print_test("脏数据测试", False, f"异常: {str(e)}")
        all_passed = False

    return all_passed


def test_export_consistency():
    """测试导出内容一致性: 结算金额计算正确"""
    print(f"\n{Colors.BLUE}=== 测试导出内容一致性 ==={Colors.END}")
    all_passed = True

    try:
        replenishment_data = {
            "batch_no": "TEST_BATCH004",
            "cabinet_no": "TEST_CAB001",
            "operator_id": "TEST_OP001",
            "items": [
                {"sku_code": "TEST_SKU005", "sku_name": "测试商品5", "replenish_quantity": 10, "unit_price": 10.0}
            ],
            "damages": [
                {"sku_code": "TEST_SKU005", "sku_name": "测试商品5", "damage_type": "破损", "quantity": 2, "unit_price": 10.0, "reason": "测试"}
            ],
            "expired_removals": [
                {"sku_code": "TEST_SKU005", "sku_name": "测试商品5", "quantity": 1, "unit_price": 10.0}
            ]
        }
        requests.post(f"{BASE_URL}/api/replenishments/", json=replenishment_data)

        settlement_data = {
            "settlement_no": "TEST_SET002",
            "cabinet_no": "TEST_CAB001",
            "batch_no": "TEST_BATCH004"
        }
        requests.post(f"{BASE_URL}/api/settlements/", json=settlement_data)

        response = requests.get(f"{BASE_URL}/api/settlements/TEST_SET002/export/")
        result = response.json()
        settlement = result.get("data", {}).get("settlement", {}) if result.get("data") else {}

        expected_replenish = 10 * 10.0
        expected_damage = 2 * 10.0
        expected_expired = 1 * 10.0
        expected_final = expected_replenish - expected_damage - expected_expired

        actual_replenish = settlement.get("total_replenishment_amount", 0)
        actual_damage = settlement.get("total_damage_amount", 0)
        actual_expired = settlement.get("total_expired_amount", 0)
        actual_final = settlement.get("final_settlement_amount", 0)

        replenish_ok = abs(actual_replenish - expected_replenish) < 0.01
        damage_ok = abs(actual_damage - expected_damage) < 0.01
        expired_ok = abs(actual_expired - expected_expired) < 0.01
        final_ok = abs(actual_final - expected_final) < 0.01

        print_test("补货金额计算", replenish_ok, f"预期: {expected_replenish}, 实际: {actual_replenish}")
        print_test("货损金额计算", damage_ok, f"预期: {expected_damage}, 实际: {actual_damage}")
        print_test("临期金额计算", expired_ok, f"预期: {expected_expired}, 实际: {actual_expired}")
        print_test("结算金额计算", final_ok, f"预期: {expected_final}, 实际: {actual_final}")

        all_passed = replenish_ok and damage_ok and expired_ok and final_ok

    except Exception as e:
        print_test("导出一致性测试", False, f"异常: {str(e)}")
        all_passed = False

    return all_passed


def test_manual_correction():
    """测试人工修正功能"""
    print(f"\n{Colors.BLUE}=== 测试人工修正 ==={Colors.END}")
    all_passed = True

    try:
        response = requests.get(f"{BASE_URL}/api/cabinets/TEST_CAB001/skus/")
        result = response.json()
        skus = result.get("data", {}).get("skus", []) if result.get("data") else []

        if skus:
            target_id = skus[0]["id"]
            correction_data = {
                "target_type": "sku_stock",
                "target_id": target_id,
                "operator_id": "ADMIN001",
                "operator_name": "管理员",
                "reason": "测试人工修正",
                "correction_data": {"current_quantity": 999}
            }
            response = requests.post(f"{BASE_URL}/api/manual-corrections/", json=correction_data)
            result = response.json()
            passed = result.get("success") == True
            print_test("人工修正创建", passed, f"target_id: {target_id}")
            if not passed:
                all_passed = False

            response = requests.get(f"{BASE_URL}/api/manual-corrections/")
            result = response.json()
            corrections_count = len(result.get("data", {}).get("corrections", [])) if result.get("data") else 0
            print_test("修正记录已保存", corrections_count > 0, f"记录数量: {corrections_count}")
            if not (corrections_count > 0):
                all_passed = False
        else:
            print_test("人工修正创建", False, "没有可用的SKU进行测试")
            all_passed = False

    except Exception as e:
        print_test("人工修正测试", False, f"异常: {str(e)}")
        all_passed = False

    return all_passed


def main():
    print(f"{Colors.BOLD}{Colors.BLUE}")
    print("=" * 60)
    print("  无人货柜补货结算 API - 自检脚本")
    print("=" * 60)
    print(f"{Colors.END}")

    if not wait_for_server():
        sys.exit(1)

    results = []
    results.append(("正常流程", test_normal_flow()))
    results.append(("幂等性测试", test_idempotency()))
    results.append(("脏数据处理", test_dirty_data()))
    results.append(("导出一致性", test_export_consistency()))
    results.append(("人工修正", test_manual_correction()))

    print(f"\n{Colors.BOLD}{Colors.BLUE}")
    print("=" * 60)
    print("  测试结果汇总")
    print("=" * 60)
    print(f"{Colors.END}")

    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)

    for name, passed in results:
        status = f"{Colors.GREEN}通过{Colors.END}" if passed else f"{Colors.RED}失败{Colors.END}"
        print(f"  {name}: {status}")

    print(f"\n  {Colors.BOLD}总计: {passed_count}/{total_count} 通过{Colors.END}")

    if passed_count == total_count:
        print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 所有测试通过！API 运行正常。{Colors.END}")
        sys.exit(0)
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}⚠️  部分测试失败，请检查问题。{Colors.END}")
        sys.exit(1)


if __name__ == "__main__":
    main()
