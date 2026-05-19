#!/usr/bin/env python3
"""
测试导入功能的脚本
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from database import engine, get_db
import models, schemas
from importers.material_importer import import_materials_from_csv
from importers.transfer_importer import import_transfers_from_yaml, import_booths_from_yaml
from importers.return_importer import import_returns_from_csv

# 创建数据库表
models.Base.metadata.drop_all(bind=engine)
models.Base.metadata.create_all(bind=engine)

db = next(get_db())

print("=" * 60)
print("测试物料导入...")
print("=" * 60)
success, failed, errors = import_materials_from_csv(db, "sample_data/materials.csv", "materials.csv")
print(f"成功: {success}, 失败: {failed}")
if errors:
    for e in errors:
        print(f"  错误: {e.error_message}")

materials = db.query(models.Material).all()
print(f"\n物料总数: {len(materials)}")
for m in materials[:3]:
    print(f"  {m.material_code}: {m.name} ({m.type.value}) - 可用: {m.available_quantity}/{m.total_quantity}")

print("\n" + "=" * 60)
print("测试展位导入...")
print("=" * 60)
success, failed, errors = import_booths_from_yaml(db, "sample_data/booths.yaml", "booths.yaml")
print(f"成功: {success}, 失败: {failed}")
if errors:
    for e in errors:
        print(f"  错误: {e.error_message}")

booths = db.query(models.Booth).all()
print(f"\n展位总数: {len(booths)}")
for b in booths[:3]:
    print(f"  {b.booth_code}: {b.name} - 负责人: {b.manager}")

print("\n" + "=" * 60)
print("测试调拨单导入...")
print("=" * 60)
success, failed, errors = import_transfers_from_yaml(db, "sample_data/transfers.yaml", "transfers.yaml")
print(f"成功: {success}, 失败: {failed}")
if errors:
    for e in errors:
        print(f"  错误: {e.error_message}")

transfers = db.query(models.TransferOrder).all()
print(f"\n调拨单总数: {len(transfers)}")
for t in transfers[:3]:
    print(f"  {t.order_no}: {t.material.name} x{t.quantity} -> {t.booth.name} ({t.status.value})")

# 检查库存扣减
print("\n库存扣减检查:")
hj001 = db.query(models.Material).filter_by(material_code="HJ001").first()
print(f"  HJ001 标准桁架: 初始100, 借出20, 剩余 {hj001.available_quantity}")

print("\n" + "=" * 60)
print("测试归还记录导入...")
print("=" * 60)
success, failed, errors = import_returns_from_csv(db, "sample_data/returns.csv", "returns.csv")
print(f"成功: {success}, 失败: {failed}")
if errors:
    for e in errors:
        print(f"  错误: {e.error_message}")

returns = db.query(models.ReturnRecord).all()
print(f"\n归还记录总数: {len(returns)}")
for r in returns[:3]:
    print(f"  {r.transfer_order.order_no}: 归还 {r.quantity} - 异常: {r.exception_type.value}")

# 检查库存恢复
print("\n库存恢复检查:")
hj001 = db.query(models.Material).filter_by(material_code="HJ001").first()
print(f"  HJ001 标准桁架: 归还15, 剩余 {hj001.available_quantity} (预期 95)")

# 检查调拨单状态更新
print("\n调拨单状态检查:")
for t in transfers:
    db.refresh(t)
    print(f"  {t.order_no}: {t.status.value}, 已归还 {t.returned_quantity}/{t.quantity}")
    if t.exception_type != models.ExceptionType.NONE:
        print(f"    异常: {t.exception_type.value} - {t.exception_note}")

print("\n" + "=" * 60)
print("测试错误数据导入...")
print("=" * 60)
success, failed, errors = import_materials_from_csv(db, "sample_data/materials_with_errors.csv", "materials_with_errors.csv")
print(f"成功: {success}, 失败: {failed}")
print("\n捕获的错误:")
for i, e in enumerate(errors, 1):
    print(f"\n{i}. 行号: {e.row_number or 'N/A'}")
    print(f"   错误: {e.error_message}")
    print(f"   建议: {e.suggestion or '无'}")
    print(f"   原始数据: {e.original_data[:50]}...")

print("\n" + "=" * 60)
print("导入错误日志数量:", db.query(models.ImportErrorLog).count())
print("测试完成!")
print("=" * 60)

db.close()
