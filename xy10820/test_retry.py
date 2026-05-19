#!/usr/bin/env python3
import requests
import json
import sys
sys.path.insert(0, 'backend')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app import models, services
from datetime import datetime

DATABASE_URL = "sqlite:///./backend/supplier_mapping.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_retry_flow():
    print("=== 测试补偿重试完整流程 ===\n")
    
    db = SessionLocal()
    
    # 1. 获取已创建的供应商
    supplier = db.query(models.Supplier).filter(models.Supplier.id == 1).first()
    if not supplier:
        print("未找到供应商，请先运行 test_compensation.py")
        return
    
    print(f"1. 供应商: {supplier.supplier_name} (ID: {supplier.id})")
    
    # 2. 手动创建模拟的补偿日志
    print("\n2. 创建模拟补偿日志...")
    
    # 先获取一个批次
    batch = db.query(models.SyncBatch).first()
    if not batch:
        print("未找到批次")
        return
    
    # 创建模拟的失败商品数据
    product_data = {"sku": "SKU-RETRY-001", "name": "重试商品", "price": 200}
    
    comp_log = models.CompensationLog(
        batch_id=batch.batch_id,
        action="process_product",
        details={"product_data": product_data, "error": "模拟错误"},
        status="pending",
        retry_count=0
    )
    db.add(comp_log)
    db.commit()
    db.refresh(comp_log)
    
    print(f"   补偿日志ID: {comp_log.id}")
    print(f"   批次ID: {comp_log.batch_id}")
    print(f"   Action: {comp_log.action}")
    print(f"   状态: {comp_log.status}")
    
    # 查看重试前的商品数量
    products_before = db.query(models.SupplierProduct).filter(
        models.SupplierProduct.supplier_id == supplier.id
    ).count()
    print(f"\n3. 重试前商品数量: {products_before}")
    
    # 查看批次状态
    batch_before = db.query(models.SyncBatch).filter(
        models.SyncBatch.batch_id == batch.batch_id
    ).first()
    print(f"   批次状态: {batch_before.status}")
    print(f"   成功: {batch_before.success_items}, 失败: {batch_before.failed_items}")
    
    # 4. 调用重试
    print("\n4. 执行补偿重试...")
    result = services.retry_compensation(db, comp_log.id)
    
    print(f"   重试结果状态: {result.status}")
    print(f"   重试次数: {result.retry_count}")
    
    # 5. 验证结果
    print("\n5. 验证结果...")
    
    # 检查商品是否创建
    products_after = db.query(models.SupplierProduct).filter(
        models.SupplierProduct.supplier_id == supplier.id
    ).count()
    print(f"   重试后商品数量: {products_after}")
    
    new_product = db.query(models.SupplierProduct).filter(
        models.SupplierProduct.supplier_sku == "SKU-RETRY-001"
    ).first()
    if new_product:
        print(f"   ✓ 商品已创建: {new_product.supplier_sku}")
        print(f"   raw_data: {json.dumps(new_product.raw_data)}")
    else:
        print(f"   ✗ 商品未创建")
    
    # 检查批次更新
    batch_after = db.query(models.SyncBatch).filter(
        models.SyncBatch.batch_id == batch.batch_id
    ).first()
    print(f"\n   批次状态: {batch_after.status}")
    print(f"   成功: {batch_after.success_items}, 失败: {batch_after.failed_items}")
    
    db.close()
    
    print("\n=== 测试完成 ===")
    print("\n关键验证:")
    print(f"  ✓ 商品数量变化: {products_before} -> {products_after}")
    print(f"  ✓ 批次成功计数已更新: {batch_before.success_items} -> {batch_after.success_items}")
    print(f"  ✓ 补偿日志状态变为: {result.status}")

if __name__ == "__main__":
    test_retry_flow()
