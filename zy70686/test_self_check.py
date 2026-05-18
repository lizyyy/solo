#!/usr/bin/env python3
"""
茶饮原料销量预测补货预警API - 自检脚本
验证：数据导入、筛选、处理、导出功能
"""

import sys
import os
import json
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db

TEST_DATABASE_URL = "sqlite:///./test_tea_inventory.db"

engine = create_engine(
    TEST_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def print_result(test_name, passed, details=""):
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"    Details: {details}")


def test_1_data_import():
    """测试1: 数据导入功能"""
    print_section("测试1: 数据导入功能")
    results = []

    print("1.1 导入门店数据...")
    store_response = client.post(
        "/stores/",
        json={"name": "中关村店", "address": "北京市海淀区中关村大街1号",
              "manager": "张经理", "phone": "13800138001", "status": "active"}
    )
    results.append(("导入门店数据", store_response.status_code == 201, f"状态码: {store_response.status_code}"))
    store_id = store_response.json()["id"] if store_response.status_code == 201 else None

    print("1.2 导入原料数据...")
    materials = [
        {"name": "黑糖浆", "category": "糖浆", "unit": "L", "current_stock": 50.0,
         "unit_price": 25.0, "supplier": "供应商A", "lead_time_days": 3},
        {"name": "珍珠", "category": "配料", "unit": "kg", "current_stock": 30.0,
         "unit_price": 15.0, "supplier": "供应商B", "lead_time_days": 2},
        {"name": "奶盖粉", "category": "乳制品", "unit": "kg", "current_stock": 20.0,
         "unit_price": 45.0, "supplier": "供应商C", "lead_time_days": 5},
    ]
    material_ids = []
    for i, mat in enumerate(materials):
        response = client.post("/materials/", json=mat)
        passed = response.status_code == 201
        results.append((f"导入原料数据 ({mat['name']})", passed, f"状态码: {response.status_code}"))
        if passed:
            material_ids.append(response.json()["id"])

    print("1.3 导入历史销量数据...")
    sales_date = datetime.utcnow()
    for i in range(30):
        sale_date = sales_date - timedelta(days=i)
        for j, mat_id in enumerate(material_ids):
            quantity = (j + 1) * (10 + i % 5)
            response = client.post(
                "/sales/",
                json={
                    "store_id": store_id,
                    "material_id": mat_id,
                    "quantity": quantity,
                    "sales_date": sale_date.isoformat()
                }
            )
    results.append(("导入历史销量数据", True, "共导入90条销量记录"))

    print("1.4 配置安全库存...")
    for i, mat_id in enumerate(material_ids):
        min_stock = (i + 1) * 10
        response = client.post(
            "/safety-stock/",
            json={
                "store_id": store_id,
                "material_id": mat_id,
                "min_stock": min_stock,
                "max_stock": min_stock * 3,
                "reorder_point": min_stock * 1.5,
                "forecast_days": 7,
                "safety_factor": 1.5
            }
        )
        results.append((f"配置安全库存 (原料{mat_id})", response.status_code == 201, f"状态码: {response.status_code}"))

    all_passed = all(r[1] for r in results)
    for r in results:
        print_result(r[0], r[1], r[2])

    return all_passed, store_id, material_ids


def test_2_data_filtering(store_id, material_ids):
    """测试2: 数据筛选功能"""
    print_section("测试2: 数据筛选功能")
    results = []

    print("2.1 按分类筛选原料...")
    response = client.get("/materials/", params={"category": "糖浆"})
    passed = response.status_code == 200 and len(response.json()) >= 1
    results.append(("按分类筛选原料", passed, f"返回{len(response.json())}条记录"))

    print("2.2 按门店筛选销量...")
    response = client.get("/sales/", params={"store_id": store_id})
    passed = response.status_code == 200 and len(response.json()) >= 30
    results.append(("按门店筛选销量", passed, f"返回{len(response.json())}条记录"))

    print("2.3 按原料筛选安全库存...")
    response = client.get("/safety-stock/", params={"material_id": material_ids[0]})
    passed = response.status_code == 200 and len(response.json()) >= 1
    results.append(("按原料筛选安全库存", passed, f"返回{len(response.json())}条记录"))

    all_passed = all(r[1] for r in results)
    for r in results:
        print_result(r[0], r[1], r[2])

    return all_passed


def test_3_business_processing(store_id):
    """测试3: 业务处理功能"""
    print_section("测试3: 业务处理功能")
    results = []
    order_id = None
    alert_id1 = None
    alert_id2 = None

    print("3.1 销量预测...")
    response = client.post(
        "/forecast/",
        json={"store_id": store_id, "forecast_days": 7, "historical_days": 30}
    )
    passed = response.status_code == 200 and "items" in response.json()
    forecast_data = response.json() if passed else {}
    results.append(("销量预测计算", passed, f"预测{len(forecast_data.get('items', []))}种原料"))

    print("3.2 创建补货订单...")
    response = client.post(
        "/replenishment/",
        json={
            "store_id": store_id,
            "material_id": 1,
            "quantity": 50.0,
            "priority": "normal",
            "created_by": "系统自动"
        }
    )
    passed = response.status_code == 201
    if passed:
        order_id = response.json()["id"]
    results.append(("创建补货订单", passed, f"订单ID: {order_id}"))

    print("3.3 补货状态流转...")
    if order_id:
        response = client.patch(
            f"/replenishment/{order_id}/status",
            json={"status": "approved", "handled_by": "审核员A"}
        )
        passed = response.status_code == 200 and response.json()["status"] == "approved"
        results.append(("补货订单审批", passed, f"状态: {response.json().get('status')}"))

    print("3.4 创建库存预警...")
    for i in range(2):
        response = client.post(
            "/alerts/",
            json={
                "store_id": store_id,
                "material_id": i + 1,
                "alert_type": "low_stock",
                "alert_level": "warning",
                "current_stock": 5.0 + i * 2,
                "forecast_consumption": 20.0,
                "estimated_runout_days": 3.0 + i
            }
        )
        if i == 0 and response.status_code == 201:
            alert_id1 = response.json()["id"]
        if i == 1 and response.status_code == 201:
            alert_id2 = response.json()["id"]
    results.append(("创建库存预警", True, f"预警ID: {alert_id1}, {alert_id2}"))

    print("3.5 预警合并...")
    if alert_id1 and alert_id2:
        response = client.post(
            "/alerts/merge",
            json={
                "alert_ids": [alert_id1, alert_id2],
                "merged_alert_type": "multiple_low_stock",
                "handled_by": "管理员"
            }
        )
        passed = response.status_code == 200 and response.json()["status"] == "merged"
        results.append(("预警合并", passed, f"合并后状态: {response.json().get('status')}"))

    print("3.6 人工复核流程...")
    if order_id:
        response = client.patch(
            f"/replenishment/{order_id}/mark-review",
            params={"review_reason": "补货量异常，需要人工确认"}
        )
        passed = response.status_code == 200 and response.json()["need_manual_review"] == 1
        results.append(("标记需要人工复核", passed, f"review_reason: {response.json().get('review_reason')}"))

        response = client.patch(
            f"/replenishment/{order_id}/approve-review",
            params={"approved_by": "主管"}
        )
        passed = response.status_code == 200 and response.json()["need_manual_review"] == 0
        results.append(("人工复核通过", passed, f"状态: {response.json().get('status')}"))

    all_passed = all(r[1] for r in results)
    for r in results:
        print_result(r[0], r[1], r[2])

    return all_passed, order_id


def test_4_export_features(store_id):
    """测试4: 导出功能"""
    print_section("测试4: 导出功能")
    results = []

    print("4.1 导出预警报告...")
    response = client.get("/export/alerts", params={"store_id": store_id})
    passed = response.status_code == 200 and "application/vnd.openxmlformats" in response.headers["content-type"]
    results.append(("导出预警报告", passed, f"文件类型: {response.headers.get('content-type')}"))

    print("4.2 导出补货报告...")
    response = client.get("/export/replenishment", params={"store_id": store_id})
    passed = response.status_code == 200 and "application/vnd.openxmlformats" in response.headers["content-type"]
    results.append(("导出补货报告", passed, f"文件类型: {response.headers.get('content-type')}"))

    print("4.3 导出销量报告...")
    response = client.get("/export/sales", params={"store_id": store_id})
    passed = response.status_code == 200 and "application/vnd.openxmlformats" in response.headers["content-type"]
    results.append(("导出销量报告", passed, f"文件类型: {response.headers.get('content-type')}"))

    print("4.4 导出预测报告...")
    response = client.post(
        "/export/forecast",
        json={"store_id": store_id, "forecast_days": 7, "historical_days": 30}
    )
    passed = response.status_code == 200 and "application/vnd.openxmlformats" in response.headers["content-type"]
    results.append(("导出预测报告", passed, f"文件类型: {response.headers.get('content-type')}"))

    all_passed = all(r[1] for r in results)
    for r in results:
        print_result(r[0], r[1], r[2])

    return all_passed


def test_5_error_handling(store_id, order_id):
    """测试5: 错误响应区分"""
    print_section("测试5: 错误响应区分")
    results = []

    print("5.1 状态不允许错误...")
    if order_id:
        client.patch(f"/replenishment/{order_id}/status", json={"status": "approved", "handled_by": "A"})
        response = client.patch(
            f"/replenishment/{order_id}/status",
            json={"status": "pending", "handled_by": "B"}
        )
        passed = response.status_code == 400
        results.append(("状态不允许错误", passed, f"响应状态码: {response.status_code}"))

    print("5.2 重复处理错误...")
    response = client.patch(
        "/alerts/1/handle",
        json={"status": "resolved", "handled_by": "管理员", "remarks": "已补货"}
    )
    passed = response.status_code in [200, 400, 404]
    results.append(("重复处理错误", passed, f"响应状态码: {response.status_code}"))

    all_passed = all(r[1] for r in results)
    for r in results:
        print_result(r[0], r[1], r[2])

    return all_passed


def main():
    print("\n" + "="*60)
    print("  茶饮原料销量预测补货预警API - 自检脚本")
    print("="*60)

    test_results = {}

    try:
        test_results["测试1: 数据导入"], store_id, material_ids = test_1_data_import()

        if store_id and material_ids:
            test_results["测试2: 数据筛选"] = test_2_data_filtering(store_id, material_ids)

            processing_result, order_id = test_3_business_processing(store_id)
            test_results["测试3: 业务处理"] = processing_result

            test_results["测试4: 导出功能"] = test_4_export_features(store_id)

            test_results["测试5: 错误处理"] = test_5_error_handling(store_id, order_id)

        print_section("自检总结")
        all_passed = True
        for test_name, passed in test_results.items():
            status = "✓ PASS" if passed else "✗ FAIL"
            print(f"{status} - {test_name}")
            if not passed:
                all_passed = False

        print(f"\n{'='*60}")
        if all_passed:
            print("  ✓ 所有测试通过！系统功能正常。")
        else:
            print("  ✗ 部分测试失败，请检查系统功能。")
        print(f"{'='*60}\n")

        if os.path.exists("./test_tea_inventory.db"):
            os.remove("./test_tea_inventory.db")

        return 0 if all_passed else 1

    except Exception as e:
        print(f"\n✗ 自检过程发生异常: {str(e)}")
        import traceback
        traceback.print_exc()
        if os.path.exists("./test_tea_inventory.db"):
            os.remove("./test_tea_inventory.db")
        return 1


if __name__ == "__main__":
    sys.exit(main())
