#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8000"

def print_response(title, response):
    print(f"\n{'='*20} {title} {'='*20}")
    print(f"状态码: {response.status_code}")
    try:
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except:
        print(response.text)

def main():
    print("无人货架补货差异 API 演示脚本")
    print("请先确保服务已启动: python main.py")
    input("按 Enter 继续...")

    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=5)
        print_response("1. 健康检查", response)
    except Exception as e:
        print(f"连接失败: {e}")
        print("请先启动服务: python main.py")
        return

    response = requests.post(
        f"{BASE_URL}/api/sku-aliases",
        json={"canonical_sku": "COKE-001", "alias_sku": "COKE-CLASSIC"}
    )
    print_response("2. 设置SKU别名", response)

    response = requests.post(
        f"{BASE_URL}/api/location-time?location_code=LOC-A&standard_time=2024-01-15T08:00:00"
    )
    print_response("3. 设置点位标准盘点时间", response)

    response = requests.post(
        f"{BASE_URL}/api/batches",
        json={"batch_no": "BATCH-DEMO-001", "name": "演示批次001"}
    )
    print_response("4. 创建批次", response)

    materials = {
        "batch_no": "BATCH-DEMO-001",
        "materials": [
            {
                "line_number": 1,
                "sku_name": "可口可乐经典",
                "sku_code": "COKE-CLASSIC",
                "quantity": 50,
                "location_code": "LOC-A",
                "location_name": "东门货架A",
                "inventory_time": "2024-01-15T09:30:00",
                "expiry_date": "2024-01-20T23:59:59"
            },
            {
                "line_number": 2,
                "sku_name": "百事可乐",
                "sku_code": "PEPSI-001",
                "quantity": 30,
                "location_code": "LOC-A",
                "location_name": "东门货架A",
                "inventory_time": "2024-01-15T09:30:00"
            },
            {
                "line_number": 3,
                "sku_name": "矿泉水",
                "sku_code": "WATER-001",
                "quantity": -5,
                "location_code": "LOC-B",
                "location_name": "西门货架B",
                "inventory_time": "2024-01-15T10:00:00"
            }
        ]
    }
    response = requests.post(f"{BASE_URL}/api/materials/upload", json=materials)
    print_response("5. 上传材料", response)

    response = requests.post(
        f"{BASE_URL}/api/batches",
        json={"batch_no": "BATCH-DEMO-002", "name": "演示重复批次"}
    )
    response = requests.post(f"{BASE_URL}/api/materials/upload", json={
        "batch_no": "BATCH-DEMO-002",
        "materials": materials["materials"]
    })
    print_response("6. 重复材料检测", response)

    response = requests.post(
        f"{BASE_URL}/api/process/trigger",
        json={"batch_no": "BATCH-DEMO-001"}
    )
    print_response("7. 触发处理流程", response)

    response = requests.get(f"{BASE_URL}/api/materials/batch/BATCH-DEMO-001")
    print_response("8. 查询批次材料", response)

    response = requests.get(f"{BASE_URL}/api/trace/1")
    print_response("9. 查询处理轨迹 (ID=1)", response)

    print("\n" + "="*60)
    print("演示完成!")
    print(f"API 文档: {BASE_URL}/docs")
    print(f"下载报告: {BASE_URL}/api/reports/BATCH-DEMO-001")
    print("="*60)

if __name__ == "__main__":
    main()
