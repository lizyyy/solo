#!/usr/bin/env python3
"""
物流调度核对系统 - API 集成测试
验证 HTTP 接口的幂等性功能
"""

import sys
import json
import time
import subprocess
import requests

sys.path.insert(0, '/Users/lzy/pro/solo/workspaces/zy70941')

BASE_URL = "http://localhost:8000"


def test_api_idempotency():
    print("=" * 60)
    print("物流调度核对系统 - API 集成测试")
    print("=" * 60)
    print()

    print("🔍 检查服务是否启动...")
    try:
        response = requests.get(f"{BASE_URL}/api/v1/health", timeout=2)
        if response.status_code == 200:
            print("✅ 服务已启动")
        else:
            print(f"⚠️  服务响应异常: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("❌ 服务未启动，请先运行: python main.py")
        print()
        print("启动命令:")
        print("  python3 main.py &")
        print("  sleep 3")
        print(f"  python3 {sys.argv[0]}")
        print()
        return False
    print()

    results = []

    # ============================================================
    # 测试1：/api/v1/process/local - 指定 batch_id 的幂等性
    # ============================================================
    print("=" * 60)
    print("🔄 测试1：/api/v1/process/local - 指定 batch_id 的幂等性")
    print("=" * 60)
    print()

    batch_id = "API_TEST_001"
    payload = {
        "batch_id": batch_id,
        "waybill_path": "./samples/waybills.csv",
        "track_path": "./samples/tracks.json",
        "rules_path": "./samples/rules.json",
    }

    print(f"🚀 首次提交 batch_id={batch_id}")
    response1 = requests.post(
        f"{BASE_URL}/api/v1/process/local",
        json=payload,
        headers={"Content-Type": "application/json"},
    )
    data1 = response1.json()
    print(f"   状态码: {response1.status_code}")
    print(f"   返回状态: {data1.get('status')}")
    print(f"   统计: 正常={data1.get('normal_count')}, 待确认={data1.get('pending_count')}, 失败={data1.get('failed_count')}")
    print()

    print(f"🔄 重复提交同一 batch_id={batch_id}")
    response2 = requests.post(
        f"{BASE_URL}/api/v1/process/local",
        json=payload,
        headers={"Content-Type": "application/json"},
    )
    data2 = response2.json()
    print(f"   状态码: {response2.status_code}")
    print(f"   返回状态: {data2.get('status')}")
    print(f"   消息: {data2.get('message', '')[:80]}...")
    print()

    test1_pass = data1.get("status") == "success" and data2.get("status") == "duplicate"
    results.append(("指定 batch_id 幂等性", test1_pass))
    print(f"   测试1结果: {'✅ 通过' if test1_pass else '❌ 失败'}")
    print()

    # ============================================================
    # 测试2：/api/v1/process/local - 不指定 batch_id 的内容哈希去重
    # ============================================================
    print("=" * 60)
    print("🔄 测试2：/api/v1/process/local - 不指定 batch_id 的内容哈希去重")
    print("=" * 60)
    print()

    payload_no_id = {
        "waybill_path": "./samples/waybills.csv",
        "track_path": "./samples/tracks.json",
        "rules_path": "./samples/rules.json",
    }

    print(f"🚀 首次提交（不指定 batch_id）")
    response3 = requests.post(
        f"{BASE_URL}/api/v1/process/local",
        json=payload_no_id,
        headers={"Content-Type": "application/json"},
    )
    data3 = response3.json()
    first_batch_id = data3.get("batch_id")
    print(f"   状态码: {response3.status_code}")
    print(f"   batch_id: {first_batch_id}")
    print(f"   返回状态: {data3.get('status')}")
    print(f"   消息: {data3.get('message', '')[:60]}...")
    print()

    is_content_hash_working = data3.get("status") == "duplicate" or first_batch_id != "API_TEST_001"

    print(f"🔄 再次提交相同文件（不指定 batch_id）")
    response4 = requests.post(
        f"{BASE_URL}/api/v1/process/local",
        json=payload_no_id,
        headers={"Content-Type": "application/json"},
    )
    data4 = response4.json()
    print(f"   状态码: {response4.status_code}")
    print(f"   返回状态: {data4.get('status')}")
    print(f"   返回 batch_id: {data4.get('batch_id')}")
    print(f"   消息: {data4.get('message', '')[:80]}...")
    print()

    test2_pass = data4.get("status") == "duplicate"
    if is_content_hash_working:
        print("   ℹ️  内容哈希已生效（与测试1的内容相同，自动去重）")
    results.append(("内容哈希去重", test2_pass))
    print(f"   测试2结果: {'✅ 通过' if test2_pass else '❌ 失败'}")
    print()

    # ============================================================
    # 测试3：查询批次状态
    # ============================================================
    print("=" * 60)
    print("🔍 测试3：查询批次状态")
    print("=" * 60)
    print()

    print(f"🔍 查询已存在批次: {batch_id}")
    response5 = requests.get(f"{BASE_URL}/api/v1/batch/{batch_id}")
    data5 = response5.json()
    print(f"   状态码: {response5.status_code}")
    print(f"   exists: {data5.get('exists')}")
    print(f"   status: {data5.get('status')}")
    print()

    print(f"🔍 查询不存在批次: NON_EXISTENT_123")
    response6 = requests.get(f"{BASE_URL}/api/v1/batch/NON_EXISTENT_123")
    data6 = response6.json()
    print(f"   状态码: {response6.status_code}")
    print(f"   exists: {data6.get('exists')}")
    print(f"   status: {data6.get('status')}")
    print()

    test3_pass = data5.get("exists") == True and data6.get("exists") == False
    results.append(("批次状态查询", test3_pass))
    print(f"   测试3结果: {'✅ 通过' if test3_pass else '❌ 失败'}")
    print()

    # ============================================================
    # 测试总结
    # ============================================================
    print("=" * 60)
    print("🎯 API 测试总结")
    print("=" * 60)
    print()

    all_passed = all(r[1] for r in results)
    for name, passed in results:
        print(f"   {'✅' if passed else '❌'} {name}: {'通过' if passed else '失败'}")
    print()

    if all_passed:
        print("🎉 所有 API 测试通过！")
    else:
        print("❌ 部分 API 测试未通过")
    print()

    return all_passed


if __name__ == "__main__":
    try:
        success = test_api_idempotency()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⏹️  测试被中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 测试发生异常: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
