import requests
import json
import time

BASE_URL = "http://localhost:8000"


def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"{'='*60}")
    print(f"状态码: {response.status_code}")
    if response.status_code in [200, 201]:
        print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    else:
        print(f"错误: {response.text}")
    print()


def test_health_check():
    print("1. 健康检查...")
    response = requests.get(f"{BASE_URL}/")
    print_response("健康检查", response)
    return response.status_code == 200


def test_get_orders():
    print("2. 获取订单列表...")
    response = requests.get(f"{BASE_URL}/api/orders/")
    print_response("订单列表", response)
    if response.status_code == 200:
        orders = response.json()
        return [o["id"] for o in orders if o["status"] == "pending"]
    return []


def test_get_locations():
    print("3. 获取库位列表...")
    response = requests.get(f"{BASE_URL}/api/locations/")
    print_response("库位列表", response)
    return response.status_code == 200


def test_create_wave(order_ids):
    print(f"4. 创建波次（合并订单: {order_ids}）...")
    data = {
        "order_ids": order_ids,
        "priority": 1,
        "created_by": "系统管理员"
    }
    response = requests.post(f"{BASE_URL}/api/waves/", json=data)
    print_response("创建波次", response)
    if response.status_code == 200:
        return response.json()["id"]
    return None


def test_get_wave_detail(wave_id):
    print(f"5. 获取波次详情 (ID: {wave_id})...")
    response = requests.get(f"{BASE_URL}/api/waves/{wave_id}")
    print_response("波次详情", response)
    if response.status_code == 200:
        data = response.json()
        return [t["id"] for t in data["pick_tasks"]]
    return []


def test_update_wave_status(wave_id, status):
    print(f"6. 更新波次状态为 '{status}'...")
    response = requests.put(f"{BASE_URL}/api/waves/{wave_id}/status?status={status}")
    print_response(f"更新波次状态为 {status}", response)
    return response.status_code == 200


def test_update_pick_task(task_id):
    print(f"7. 更新拣货任务 (ID: {task_id})...")
    data = {
        "picked_qty": 2,
        "status": "picked",
        "picker": "拣货员001"
    }
    response = requests.put(f"{BASE_URL}/api/pick-tasks/{task_id}", json=data)
    print_response("更新拣货任务", response)
    return response.status_code == 200


def test_create_review_diff(wave_id, order_id, pick_task_id):
    print("8. 创建复核差异...")
    data = {
        "wave_id": wave_id,
        "order_id": order_id,
        "pick_task_id": pick_task_id,
        "sku": "SKU001",
        "expected_qty": 5,
        "actual_qty": 4,
        "diff_type": "少货",
        "reviewer": "复核员001",
        "remarks": "盘点发现少1件"
    }
    response = requests.post(f"{BASE_URL}/api/review-diffs/", json=data)
    print_response("创建复核差异", response)
    if response.status_code == 200:
        return response.json()["id"]
    return None


def test_resolve_review_diff(diff_id):
    print(f"9. 解决复核差异 (ID: {diff_id})...")
    data = {
        "resolution": "已通知补货，后续订单补发",
        "resolver": "主管001"
    }
    response = requests.put(f"{BASE_URL}/api/review-diffs/{diff_id}/resolve", json=data)
    print_response("解决复核差异", response)
    return response.status_code == 200


def test_stock_split(task_id):
    print(f"10. 缺货拆单 (任务ID: {task_id})...")
    data = {
        "pick_task_id": task_id,
        "available_qty": 1,
        "reason": "库位库存不足，仅剩1件",
        "operator": "仓管员001"
    }
    response = requests.post(f"{BASE_URL}/api/stock-split/", json=data)
    print_response("缺货拆单", response)
    return response.status_code == 200


def test_manual_correction(task_id):
    print(f"11. 人工修正 (任务ID: {task_id})...")
    data = {
        "pick_task_id": task_id,
        "new_qty": 3,
        "reason": "客户临时修改订单数量",
        "operator": "客服001"
    }
    response = requests.post(f"{BASE_URL}/api/manual-correction/", json=data)
    print_response("人工修正", response)
    return response.status_code == 200


def test_get_exceptions():
    print("12. 获取异常记录...")
    response = requests.get(f"{BASE_URL}/api/exceptions/")
    print_response("异常记录", response)
    return response.status_code == 200


def test_export_wave(wave_id):
    print(f"13. 导出波次数据 (ID: {wave_id})...")
    response = requests.get(f"{BASE_URL}/api/waves/{wave_id}/export?format=json")
    print_response("导出波次数据 (JSON)", response)
    return response.status_code == 200


def main():
    print("仓储波次拣货 API 测试脚本")
    print("=" * 60)

    if not test_health_check():
        print("API 服务未启动，请先运行: python main.py")
        return

    time.sleep(0.5)

    order_ids = test_get_orders()
    if not order_ids:
        print("没有待处理的订单，请先运行: python init_sample_data.py")
        return

    test_get_locations()
    time.sleep(0.5)

    wave_id = test_create_wave(order_ids[:3])
    if not wave_id:
        print("创建波次失败")
        return

    time.sleep(0.5)

    task_ids = test_get_wave_detail(wave_id)
    time.sleep(0.5)

    test_update_wave_status(wave_id, "picking")
    time.sleep(0.5)

    if task_ids:
        test_update_pick_task(task_ids[0])
        time.sleep(0.5)

    test_update_wave_status(wave_id, "reviewing")
    time.sleep(0.5)

    if task_ids:
        diff_id = test_create_review_diff(wave_id, order_ids[0], task_ids[0])
        time.sleep(0.5)
        if diff_id:
            test_resolve_review_diff(diff_id)
            time.sleep(0.5)

    if len(task_ids) > 1:
        test_stock_split(task_ids[1])
        time.sleep(0.5)

    if len(task_ids) > 2:
        test_manual_correction(task_ids[2])
        time.sleep(0.5)

    test_update_wave_status(wave_id, "completed")
    time.sleep(0.5)

    test_get_exceptions()
    time.sleep(0.5)

    test_export_wave(wave_id)

    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)
    print(f"\nAPI 文档地址: {BASE_URL}/docs")
    print(f"波次 ID: {wave_id}")


if __name__ == "__main__":
    main()
