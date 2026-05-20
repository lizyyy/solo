import requests
import json

BASE_URL = "http://localhost:8000"


def test_root():
    print("=== 测试根端点 ===")
    response = requests.get(f"{BASE_URL}/")
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}\n")


def test_upload_repair_csv():
    print("=== 测试上传返修CSV ===")
    with open("sample_repairs.csv", "rb") as f:
        response = requests.post(
            f"{BASE_URL}/upload/repair-csv",
            files={"file": ("sample_repairs.csv", f, "text/csv")}
        )
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"总数: {result['total_count']}")
    print(f"正常: {result['normal_count']}, 待确认: {result['pending_count']}, 失败: {result['failed_count']}")

    if result['pending_items']:
        print("\n待确认记录示例:")
        item = result['pending_items'][0]
        print(f"  原始数据: {item['raw_data']}")
        print(f"  建议: {item['suggestion']}")
        print(f"  错误码: {item['error_code']}")

    if result['failed_items']:
        print("\n失败记录示例:")
        item = result['failed_items'][0]
        print(f"  原始数据: {item['raw_data']}")
        print(f"  建议: {item['suggestion']}")

    print(f"\n统计摘要: {json.dumps(result['summary'], ensure_ascii=False, indent=2)}")
    print()


def test_upload_work_order():
    print("=== 测试上传工单JSON ===")
    with open("sample_work_orders.json", "rb") as f:
        response = requests.post(
            f"{BASE_URL}/upload/work-order",
            files={"file": ("sample_work_orders.json", f, "application/json")}
        )
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}\n")


def test_upload_material_batch():
    print("=== 测试上传物料批次JSON ===")
    with open("sample_material_batches.json", "rb") as f:
        response = requests.post(
            f"{BASE_URL}/upload/material-batch",
            files={"file": ("sample_material_batches.json", f, "application/json")}
        )
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}\n")


def test_stats():
    print("=== 测试统计信息 ===")
    response = requests.get(f"{BASE_URL}/stats")
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}\n")


def test_duplicate_batch():
    print("=== 测试同一批次重复提交（应失败） ===")
    data = {
        "records": [
            {
                "work_order_id": "WO20240501999",
                "station_id": "S01",
                "material_batch": "BATCH202404001",
                "defect_type": "测试重复",
                "repair_date": "2024-05-01",
                "operator": "测试员"
            }
        ]
    }
    response = requests.post(f"{BASE_URL}/process", json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"失败数: {result['failed_count']}")
    if result['failed_items']:
        print(f"失败原因: {result['failed_items'][0]['suggestion']}")
    print()


def test_reset():
    print("=== 测试重置处理器 ===")
    response = requests.post(f"{BASE_URL}/reset")
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}\n")


if __name__ == "__main__":
    try:
        test_root()
        test_upload_work_order()
        test_upload_material_batch()
        test_upload_repair_csv()
        test_stats()
        test_duplicate_batch()
        print("=== 所有测试完成 ===")
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器，请先运行 'python main.py' 启动服务")
    except Exception as e:
        print(f"测试过程中出错: {e}")
