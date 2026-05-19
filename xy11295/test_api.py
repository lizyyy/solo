#!/usr/bin/env python3
"""
测试API接口
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("=" * 60)
print("测试API接口...")
print("=" * 60)

# 测试根路径
print("\n1. 测试根路径:")
response = client.get("/")
print(f"   状态码: {response.status_code}")
print(f"   响应: {response.json()}")

# 测试物料接口
print("\n2. 测试获取所有物料:")
response = client.get("/api/materials")
print(f"   状态码: {response.status_code}")
print(f"   物料数量: {len(response.json())}")

# 测试展位接口
print("\n3. 测试获取所有展位:")
response = client.get("/api/booths")
print(f"   状态码: {response.status_code}")
print(f"   展位数量: {len(response.json())}")

# 测试调拨单查询接口
print("\n4. 测试查询调拨单:")
response = client.get("/api/transfers")
print(f"   状态码: {response.status_code}")
data = response.json()
print(f"   总数量: {data['total']}")
print(f"   状态统计: {data['summary']['status_summary']}")

# 测试按负责人筛选
print("\n5. 测试按负责人筛选:")
response = client.get("/api/transfers?manager=张明")
print(f"   状态码: {response.status_code}")
print(f"   结果数量: {response.json()['total']}")

# 测试按状态筛选
print("\n6. 测试按状态筛选 (异常):")
response = client.get("/api/transfers?status=异常")
print(f"   状态码: {response.status_code}")
print(f"   结果数量: {response.json()['total']}")

# 测试导入错误日志
print("\n7. 测试获取导入错误日志:")
response = client.get("/api/import/errors")
print(f"   状态码: {response.status_code}")
print(f"   错误数量: {len(response.json())}")

# 测试创建调拨单
print("\n8. 测试创建调拨单 (新建测试数据):")
transfer_data = {
    "order_no": "TEST001",
    "material_code": "HJ002",
    "booth_code": "Z005",
    "quantity": 5,
    "borrower": "测试人员",
    "operator": "测试管理员",
    "transfer_time": "2024-05-20T10:00:00",
    "remark": "API测试"
}
response = client.post("/api/transfers", json=transfer_data)
print(f"   状态码: {response.status_code}")
if response.status_code == 200:
    result = response.json()
    print(f"   创建成功: {result['order_no']}, 状态: {result['status']}")
else:
    print(f"   错误: {response.text}")

# 测试创建归还记录
print("\n9. 测试创建归还记录:")
return_data = {
    "order_no": "TEST001",
    "quantity": 3,
    "return_time": "2024-05-21T15:00:00",
    "receiver": "仓库管理员",
    "condition": "完好",
    "exception_type": "无异常"
}
response = client.post("/api/returns", json=return_data)
print(f"   状态码: {response.status_code}")
if response.status_code == 200:
    result = response.json()
    print(f"   归还成功, 异常类型: {result['exception_type']}")
else:
    print(f"   错误: {response.text}")

# 测试导出功能
print("\n10. 测试导出Excel:")
response = client.get("/api/transfers/export")
print(f"   状态码: {response.status_code}")
print(f"   内容类型: {response.headers.get('content-type')}")

print("\n" + "=" * 60)
print("所有API接口测试完成!")
print("=" * 60)
