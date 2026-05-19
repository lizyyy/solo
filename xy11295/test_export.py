#!/usr/bin/env python3
"""
测试导出功能的脚本
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from database import engine, get_db
import models, schemas, crud
from exporter import export_transfer_orders, export_materials

# 创建数据库表（使用之前的数据）
db = next(get_db())

print("=" * 60)
print("测试调拨单查询和统计...")
print("=" * 60)

# 测试查询所有
query = schemas.TransferQuery()
total, items = crud.query_transfer_orders(db, query)
print(f"总调拨单数: {total}")

# 测试按负责人筛选
query = schemas.TransferQuery(manager="张明")
total, items = crud.query_transfer_orders(db, query)
print(f"负责人 '张明' 的调拨单数: {total}")

# 测试按异常筛选
query = schemas.TransferQuery(exception_type=models.ExceptionType.DAMAGED)
total, items = crud.query_transfer_orders(db, query)
print(f"异常为 '损坏' 的调拨单数: {total}")

# 测试统计
summary = crud.get_transfer_summary(db, schemas.TransferQuery())
print(f"\n统计汇总:")
print(f"  总调拨单数: {summary['total_transfers']}")
print(f"  总调拨数量: {summary['total_quantity']}")
print(f"  状态统计: {summary['status_summary']}")
if summary['exception_summary']:
    print(f"  异常统计:")
    for e in summary['exception_summary']:
        print(f"    - {e['exception_type']}: {e['count']}单, {e['affected_quantity']}件")

print("\n" + "=" * 60)
print("测试导出功能...")
print("=" * 60)

os.makedirs("exports", exist_ok=True)

# 导出Excel
excel_path = "exports/test_transfers.xlsx"
export_transfer_orders(db, schemas.TransferQuery(), excel_path, "xlsx")
print(f"Excel导出成功: {excel_path}")

# 导出CSV
csv_path = "exports/test_transfers.csv"
export_transfer_orders(db, schemas.TransferQuery(), csv_path, "csv")
print(f"CSV导出成功: {csv_path}")

# 导出物料表
material_excel = "exports/test_materials.xlsx"
export_materials(db, material_excel, "xlsx")
print(f"物料表导出成功: {material_excel}")

# 检查文件
print(f"\n导出目录文件:")
for f in os.listdir("exports"):
    size = os.path.getsize(f"exports/{f}")
    print(f"  {f}: {size} bytes")

print("\n" + "=" * 60)
print("测试完成!")
print("=" * 60)

db.close()
