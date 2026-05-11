#!/usr/bin/env python3
import requests
import json
import os
import glob

BASE_URL = "http://localhost:8000"


def run_test_flow():
    requests.post(
        f"{BASE_URL}/api/wristbands",
        json={"wristband_no": "I001", "visitor_name": "幂等测试用户", "deposit_amount": 20.0}
    )
    requests.post(f"{BASE_URL}/api/wristbands/I001/freeze")
    requests.post(
        f"{BASE_URL}/api/wristbands/I001/activate",
        params={"initial_deposit": 100.0}
    )
    requests.post(
        f"{BASE_URL}/api/wristbands/I001/consume",
        json={"amount": 50.0, "description": "幂等消费"}
    )


def main():
    print("测试幂等性 - 重复运行相同流程不应导致数据膨胀\n")

    print("第一次运行...")
    run_test_flow()

    stats1 = requests.get(f"{BASE_URL}/api/statistics").json()
    print(f"第一次统计: 腕带={stats1['total_wristbands']}, 消费总额={stats1['total_consumption']}")

    print("\n执行结算...")
    settlement1 = requests.post(f"{BASE_URL}/api/settlement").json()
    export_count1 = len(glob.glob("exports/settlement_*.csv"))
    print(f"导出文件数量: {export_count1}")

    print("\n再次执行结算（应返回同一条记录）...")
    settlement2 = requests.post(f"{BASE_URL}/api/settlement").json()
    export_count2 = len(glob.glob("exports/settlement_*.csv"))

    print(f"第一次结算ID: {settlement1['id']}")
    print(f"第二次结算ID: {settlement2['id']}")
    print(f"导出文件数量: {export_count2}")

    assert settlement1["id"] == settlement2["id"], "幂等性失败：创建了多条结算记录"
    assert export_count1 == export_count2, "幂等性失败：导出文件重复生成"

    print("\n✓ 幂等性测试通过！重复执行结算不会产生重复数据")
    print(f"  - 结算记录ID相同: {settlement1['id']}")
    print(f"  - 导出文件数量不变: {export_count1}")


if __name__ == "__main__":
    main()
