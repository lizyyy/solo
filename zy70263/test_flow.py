#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8000"


def print_step(step, description):
    print(f"\n{'='*60}")
    print(f"步骤 {step}: {description}")
    print('='*60)


def test_wristband_management():
    print_step(1, "发放腕带 A001（游客张三）")
    response = requests.post(
        f"{BASE_URL}/api/wristbands",
        json={"wristband_no": "A001", "visitor_name": "张三", "deposit_amount": 20.0}
    )
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    assert response.status_code == 201
    wristband1 = response.json()

    print_step(2, "发放腕带 A002（游客李四）")
    response = requests.post(
        f"{BASE_URL}/api/wristbands",
        json={"wristband_no": "A002", "visitor_name": "李四", "deposit_amount": 20.0}
    )
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    assert response.status_code == 201

    print_step(3, "冻结 A001 的押金")
    response = requests.post(f"{BASE_URL}/api/wristbands/A001/freeze")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    assert response.status_code == 200
    assert response.json()["status"] == "frozen"

    print_step(4, "冻结 A002 的押金")
    response = requests.post(f"{BASE_URL}/api/wristbands/A002/freeze")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    assert response.status_code == 200

    print_step(5, "激活 A001 并储值 100 元")
    response = requests.post(
        f"{BASE_URL}/api/wristbands/A001/activate",
        params={"initial_deposit": 100.0}
    )
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    assert response.status_code == 200
    assert response.json()["status"] == "active"
    assert response.json()["balance"] == 100.0

    print_step(6, "激活 A002 并储值 200 元")
    response = requests.post(
        f"{BASE_URL}/api/wristbands/A002/activate",
        params={"initial_deposit": 200.0}
    )
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    assert response.status_code == 200
    assert response.json()["balance"] == 200.0

    print_step(7, "A001 消费 35 元（购买小吃）")
    response = requests.post(
        f"{BASE_URL}/api/wristbands/A001/consume",
        json={"amount": 35.0, "description": "购买小吃"}
    )
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    assert response.status_code == 200
    assert response.json()["balance_after"] == 65.0

    print_step(8, "A001 再充值 50 元")
    response = requests.post(
        f"{BASE_URL}/api/wristbands/A001/recharge",
        json={"amount": 50.0}
    )
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    assert response.status_code == 200
    assert response.json()["balance_after"] == 115.0

    print_step(9, "A001 消费 80 元（购买门票）")
    response = requests.post(
        f"{BASE_URL}/api/wristbands/A001/consume",
        json={"amount": 80.0, "description": "游乐项目消费"}
    )
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    assert response.status_code == 200
    assert response.json()["balance_after"] == 35.0

    print_step(10, "A002 消费 150 元")
    response = requests.post(
        f"{BASE_URL}/api/wristbands/A002/consume",
        json={"amount": 150.0, "description": "餐饮消费"}
    )
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    assert response.status_code == 200

    print_step(11, "A002 遗失，补办新腕带 A003")
    response = requests.post(
        f"{BASE_URL}/api/wristbands/A002/loss",
        json={"new_wristband_no": "A003", "replacement_fee": 10.0}
    )
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    assert response.status_code == 200
    new_wristband = response.json()
    assert new_wristband["wristband_no"] == "A003"
    assert new_wristband["balance"] == 40.0

    print_step(12, "查看 A001 的交易记录")
    response = requests.get(f"{BASE_URL}/api/wristbands/A001/transactions")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    assert response.status_code == 200

    print_step(13, "查看当前统计数据")
    response = requests.get(f"{BASE_URL}/api/statistics")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    assert response.status_code == 200
    stats = response.json()
    assert stats["total_wristbands"] == 3
    assert stats["total_consumption"] > 0
    assert stats["total_replacement_fees"] == 10.0

    print_step(14, "执行闭园结算")
    response = requests.post(f"{BASE_URL}/api/settlement")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    assert response.status_code == 200
    settlement1 = response.json()

    print_step(15, "验证结算数据")
    assert settlement1["total_deposit_frozen"] == 40.0
    assert settlement1["total_deposit_refunded"] == 20.0
    assert settlement1["total_deposit_forfeited"] == 20.0
    assert settlement1["total_consumption"] == 265.0
    assert settlement1["total_replacement_fees"] == 10.0

    print_step(16, "再次执行结算（验证幂等性）")
    response = requests.post(f"{BASE_URL}/api/settlement")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    settlement2 = response.json()
    assert settlement1["id"] == settlement2["id"], "重复执行结算应该返回同一条记录"

    print_step(17, "查看腕带状态（应已结算）")
    response = requests.get(f"{BASE_URL}/api/wristbands/A001")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    assert response.json()["status"] == "settled"

    response = requests.get(f"{BASE_URL}/api/wristbands/A002")
    print(f"A002 状态: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    assert response.json()["status"] == "lost"

    print_step(18, "下载结算导出文件")
    settlement_id = settlement1["id"]
    response = requests.get(f"{BASE_URL}/api/settlements/{settlement_id}/export")
    print(f"导出文件长度: {len(response.content)} 字节")
    print(f"文件内容:\n{response.text}")
    assert response.status_code == 200

    print("\n" + "="*60)
    print("测试流程全部通过！✓")
    print("="*60)


def test_error_cases():
    print("\n" + "="*60)
    print("测试错误处理")
    print("="*60)

    print_step("E1", "尝试消费不存在的腕带")
    response = requests.post(
        f"{BASE_URL}/api/wristbands/NONEXIST/consume",
        json={"amount": 10.0}
    )
    print(f"响应: {response.status_code} - {json.dumps(response.json(), ensure_ascii=False)}")
    assert response.status_code == 404

    print_step("E2", "尝试消费未激活的腕带")
    response = requests.post(
        f"{BASE_URL}/api/wristbands",
        json={"wristband_no": "B001", "visitor_name": "测试", "deposit_amount": 20.0}
    )
    response = requests.post(
        f"{BASE_URL}/api/wristbands/B001/consume",
        json={"amount": 10.0}
    )
    print(f"响应: {response.status_code} - {json.dumps(response.json(), ensure_ascii=False)}")
    assert response.status_code == 400

    print_step("E3", "尝试消费超过余额")
    response = requests.post(f"{BASE_URL}/api/wristbands/B001/freeze")
    response = requests.post(
        f"{BASE_URL}/api/wristbands/B001/activate",
        params={"initial_deposit": 50.0}
    )
    response = requests.post(
        f"{BASE_URL}/api/wristbands/B001/consume",
        json={"amount": 100.0}
    )
    print(f"响应: {response.status_code} - {json.dumps(response.json(), ensure_ascii=False)}")
    assert response.status_code == 400

    print("\n错误处理测试通过！✓")


if __name__ == "__main__":
    test_wristband_management()
    test_error_cases()
