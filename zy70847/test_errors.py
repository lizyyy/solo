#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8000"

def print_response(title, response):
    print(f"\n{'='*20} {title} {'='*20}")
    print(f"状态码: {response.status_code}")
    try:
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except:
        print(response.text)

def main():
    print("错误回写功能测试")

    response = requests.get(f"{BASE_URL}/api/health")
    print_response("健康检查", response)

    materials = {
        "batch_no": "ERROR-TEST-001",
        "materials": [
            {
                "line_number": 1,
                "sku_name": None,
                "sku_code": "SKU-001",
                "quantity": 50,
                "location_code": "LOC-A",
                "location_name": "东门货架",
                "inventory_time": "2024-01-15T09:30:00"
            },
            {
                "line_number": 2,
                "sku_name": "重复行号测试1",
                "sku_code": "SKU-002",
                "quantity": 30,
                "location_code": "LOC-A",
                "location_name": "东门货架",
                "inventory_time": "2024-01-15T09:30:00"
            },
            {
                "line_number": 2,
                "sku_name": "重复行号测试2",
                "sku_code": "SKU-003",
                "quantity": 20,
                "location_code": "LOC-B",
                "location_name": "西门货架",
                "inventory_time": "2024-01-15T10:00:00"
            },
            {
                "line_number": 3,
                "sku_name": "负数数量测试",
                "sku_code": "SKU-004",
                "quantity": -5,
                "location_code": "LOC-C",
                "location_name": "南门货架",
                "inventory_time": "2024-01-15T10:30:00"
            },
            {
                "line_number": 4,
                "sku_name": "时间矛盾测试",
                "sku_code": "SKU-005",
                "quantity": 100,
                "location_code": "LOC-D",
                "location_name": "北门货架",
                "inventory_time": "2024-01-20T08:00:00",
                "expiry_date": "2024-01-10T23:59:59"
            },
            {
                "line_number": 5,
                "sku_name": "正常商品",
                "sku_code": "SKU-006",
                "quantity": 80,
                "location_code": "LOC-E",
                "location_name": "中门货架",
                "inventory_time": "2024-01-15T12:00:00"
            }
        ]
    }

    response = requests.post(f"{BASE_URL}/api/materials/upload", json=materials)
    print_response("上传包含各种错误的材料", response)

    response = requests.post(f"{BASE_URL}/api/process/trigger", json={"batch_no": "ERROR-TEST-001"})
    print_response("触发处理流程", response)

    response = requests.get(f"{BASE_URL}/api/materials/batch/ERROR-TEST-001")
    print_response("查询材料列表（查看错误标记）", response)

    response = requests.get(f"{BASE_URL}/api/trace/1")
    print_response("查询处理轨迹 - 缺字段错误(ID=1)", response)

    response = requests.get(f"{BASE_URL}/api/trace/2")
    print_response("查询处理轨迹 - 重复行号错误(ID=2)", response)

    response = requests.get(f"{BASE_URL}/api/trace/4")
    print_response("查询处理轨迹 - 负数数量错误(ID=4)", response)

    response = requests.get(f"{BASE_URL}/api/trace/5")
    print_response("查询处理轨迹 - 时间矛盾错误(ID=5)", response)

    response = requests.get(f"{BASE_URL}/api/trace/6")
    print_response("查询处理轨迹 - 正常商品(ID=6)", response)

    print("\n" + "="*60)
    print("测试完成!")
    print("="*60)

if __name__ == "__main__":
    main()
