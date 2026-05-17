#!/usr/bin/env python3
"""
生鲜温度拒收阈值供应商统计API自检脚本
验证功能：基础数据导入、筛选、处理、导出
"""

import sys
import os
import io
import pandas as pd
from datetime import datetime, timedelta

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fresh_temperature.db")
if os.path.exists(db_path):
    try:
        os.remove(db_path)
    except:
        pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from database import init_db
from main import app

init_db()

client = TestClient(app)

def test_health_check():
    """测试健康检查"""
    print("\n=== 1. 测试健康检查 ===")
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    print("✓ 健康检查通过")

def test_supplier_operations():
    """测试供应商CRUD"""
    print("\n=== 2. 测试供应商管理 ===")
    
    supplier_data = {"code": "SUP001", "name": "新鲜蔬菜供应商", "contact": "张三", "phone": "13800138000"}
    response = client.post("/suppliers/", json=supplier_data)
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "SUP001"
    print("✓ 供应商创建成功")
    
    supplier_data2 = {"code": "SUP002", "name": "优质水果供应商"}
    client.post("/suppliers/", json=supplier_data2)
    
    response = client.get("/suppliers/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    print("✓ 供应商列表获取成功")

def test_category_operations():
    """测试品类管理"""
    print("\n=== 3. 测试品类管理 ===")
    
    category_data = {"code": "CAT001", "name": "冷藏蔬菜", "description": "需要0-4度冷藏保存"}
    response = client.post("/categories/", json=category_data)
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "CAT001"
    print("✓ 品类创建成功")
    
    category_data2 = {"code": "CAT002", "name": "冷冻肉类"}
    client.post("/categories/", json=category_data2)
    
    response = client.get("/categories/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    print("✓ 品类列表获取成功")

def test_threshold_operations():
    """测试拒收阈值配置"""
    print("\n=== 4. 测试拒收阈值配置 ===")
    
    response = client.get("/categories/")
    categories = response.json()
    
    for i, cat in enumerate(categories):
        threshold_data = {
            "category_id": cat["id"],
            "min_temperature": -10.0 if i > 0 else 0.0,
            "max_temperature": 4.0,
            "sample_size": 5,
            "reject_count_threshold": 2
        }
        response = client.post("/thresholds/", json=threshold_data)
        assert response.status_code == 200
    
    print("✓ 阈值配置成功")
    
    response = client.get("/thresholds/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    print("✓ 阈值列表获取成功")

def test_arrival_order_operations():
    """测试到货单管理"""
    print("\n=== 5. 测试到货单管理 ===")
    
    order_data = {
        "order_no": "ORD20240101001",
        "supplier_code": "SUP001",
        "category_code": "CAT001",
        "arrival_date": datetime.now().isoformat(),
        "batch_no": "BATCH001",
        "quantity": 1000.0,
        "unit": "kg",
        "vehicle_no": "京A12345",
        "driver_name": "李四"
    }
    response = client.post("/arrival-orders/", json=order_data)
    assert response.status_code == 200
    data = response.json()
    assert data["order_no"] == "ORD20240101001"
    print("✓ 到货单创建成功")
    
    order_data2 = {
        "order_no": "ORD20240101002",
        "supplier_code": "SUP002",
        "category_code": "CAT002",
        "arrival_date": datetime.now().isoformat(),
        "batch_no": "BATCH002",
        "quantity": 500.0
    }
    client.post("/arrival-orders/", json=order_data2)
    
    response = client.get("/arrival-orders/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    print("✓ 到货单列表获取成功")

def test_temperature_record_operations():
    """测试温度记录管理"""
    print("\n=== 6. 测试温度记录管理 ===")
    
    temperatures = [2.0, 3.5, 5.0, 1.5, 6.0]
    for i, temp in enumerate(temperatures):
        record_data = {
            "order_no": "ORD20240101001",
            "record_no": f"REC00{i+1}",
            "measure_time": (datetime.now() + timedelta(minutes=i*5)).isoformat(),
            "temperature": temp,
            "measure_point": "货箱中部",
            "operator": "检测员A"
        }
        response = client.post("/temperature-records/", json=record_data)
        assert response.status_code == 200
    
    print("✓ 温度记录创建成功")

def test_csv_import():
    """测试CSV批量导入"""
    print("\n=== 7. 测试CSV批量导入 ===")
    
    arrival_csv = pd.DataFrame({
        "order_no": ["ORD20240102001", "ORD20240102002"],
        "supplier_code": ["SUP001", "SUP002"],
        "category_code": ["CAT001", "CAT002"],
        "arrival_date": ["2024-01-02 08:00:00", "2024-01-02 09:00:00"],
        "batch_no": ["BATCH003", "BATCH004"],
        "quantity": [800.0, 600.0],
        "unit": ["kg", "kg"]
    })
    
    csv_buffer = io.StringIO()
    arrival_csv.to_csv(csv_buffer, index=False)
    csv_buffer.seek(0)
    
    response = client.post(
        "/import/arrival-orders/csv",
        files={"file": ("arrival_orders.csv", csv_buffer.getvalue(), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["imported_count"] == 2
    print(f"✓ 到货单CSV导入成功: {data['imported_count']}条")
    
    temp_data = {
        "order_no": ["ORD20240102001"] * 5 + ["ORD20240102002"] * 5,
        "record_no": [f"IMPORTREC{i:03d}" for i in range(10)],
        "measure_time": [f"2024-01-02 08:{i*5:02d}:00" for i in range(5)] + [f"2024-01-02 09:{i*5:02d}:00" for i in range(5)],
        "temperature": [3.0, 7.0, 2.5, 8.0, 3.5] + [2.0, 1.5, 3.0, 2.5, 1.0]
    }
    temp_csv = pd.DataFrame(temp_data)
    
    csv_buffer = io.StringIO()
    temp_csv.to_csv(csv_buffer, index=False)
    csv_buffer.seek(0)
    
    response = client.post(
        "/import/temperature-records/csv",
        files={"file": ("temp_records.csv", csv_buffer.getvalue(), "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["imported_count"] == 10
    print(f"✓ 温度记录CSV导入成功: {data['imported_count']}条")

def test_inspection_process():
    """测试质检报告生成流程"""
    print("\n=== 8. 测试质检报告生成流程 ===")
    
    response = client.post("/inspection/generate/ORD20240101001")
    assert response.status_code == 200
    data = response.json()
    assert data["result"] in ["拒收", "通过"]
    assert data["total_samples"] == 5
    report_no = data["report_no"]
    print(f"✓ 质检报告生成成功: {report_no}, 结果: {data['result']}")
    
    response = client.post(f"/inspection/process/{report_no}?inspector=质检员A")
    assert response.status_code == 200
    print("✓ 质检报告处理完成")
    
    response = client.get("/inspection-reports/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    print("✓ 质检报告列表获取成功")

def test_supplier_statistics():
    """测试供应商统计"""
    print("\n=== 9. 测试供应商统计 ===")
    
    response = client.get("/suppliers/stats")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    
    for stat in data:
        assert "supplier_code" in stat
        assert "total_arrivals" in stat
        assert "rejection_rate" in stat
        print(f"  - {stat['supplier_name']}: 到货{stat['total_arrivals']}次, 拒收率{stat['rejection_rate']}%")
    
    print("✓ 供应商统计获取成功")

def test_anomaly_records():
    """测试异常记录管理"""
    print("\n=== 10. 测试异常记录管理 ===")
    
    response = client.get("/anomaly-records/")
    assert response.status_code == 200
    data = response.json()
    print(f"  - 发现异常记录: {len(data)}条")
    
    if data:
        record_id = data[0]["id"]
        response = client.put(f"/anomaly-records/{record_id}/review?review_note=已复核确认温度异常")
        assert response.status_code == 200
        print("✓ 异常记录审核成功")
    
    print("✓ 异常记录功能正常")

def test_export_functions():
    """测试导出功能"""
    print("\n=== 11. 测试导出功能 ===")
    
    response = client.get("/export/inspection-reports")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    print("✓ 质检报告Excel导出成功")
    
    response = client.get("/export/supplier-stats")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    print("✓ 供应商统计Excel导出成功")

def test_error_responses():
    """测试错误响应分类"""
    print("\n=== 12. 测试错误响应分类 ===")
    
    response = client.post("/suppliers/", json={"code": "SUP001", "name": "重复供应商"})
    assert response.status_code == 400
    data = response.json()
    assert "error_code" in data or (data.get("detail") and "error_code" in data["detail"])
    error_code = data["error_code"] if "error_code" in data else data["detail"]["error_code"]
    assert error_code == "duplicate_data"
    print("✓ 重复数据错误响应正确")
    
    response = client.post("/inspection/generate/NONEXISTENT")
    assert response.status_code in [400, 404]
    print("✓ 资源不存在错误响应正确")
    
    response = client.post("/inspection/generate/ORD20240101001")
    assert response.status_code == 400
    data = response.json()
    error_code = data["error_code"] if "error_code" in data else data["detail"]["error_code"]
    assert error_code in ["already_processed", "needs_manual_review"]
    print("✓ 已处理状态错误响应正确")

def main():
    """主测试函数"""
    print("=" * 60)
    print("生鲜温度拒收阈值供应商统计API - 自检脚本")
    print("=" * 60)
    
    try:
        test_health_check()
        test_supplier_operations()
        test_category_operations()
        test_threshold_operations()
        test_arrival_order_operations()
        test_temperature_record_operations()
        test_csv_import()
        test_inspection_process()
        test_supplier_statistics()
        test_anomaly_records()
        test_export_functions()
        test_error_responses()
        
        print("\n" + "=" * 60)
        print("✓ 所有测试通过！API功能正常运行")
        print("=" * 60)
        return 0
    except AssertionError as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    except Exception as e:
        print(f"\n✗ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())