#!/usr/bin/env python3
"""
初始化测试数据脚本
创建展位和示例调拨记录，用于测试归还功能
"""

import sys
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models, schemas, crud

def init_test_data():
    db = SessionLocal()
    
    try:
        print("开始初始化测试数据...")
        
        print("\n1. 创建展位...")
        booths = [
            schemas.BoothCreate(
                booth_number="B-001",
                company_name="科技有限公司",
                contact_person="张经理",
                contact_phone="13800138001"
            ),
            schemas.BoothCreate(
                booth_number="B-002",
                company_name="创意设计公司",
                contact_person="李总监",
                contact_phone="13800138002"
            ),
            schemas.BoothCreate(
                booth_number="B-003",
                company_name="智能设备厂商",
                contact_person="王主管",
                contact_phone="13800138003"
            )
        ]
        
        created_booths = []
        for booth in booths:
            existing = crud.get_booth_by_number(db, booth.booth_number)
            if existing:
                created_booths.append(existing)
                print(f"  展位 {booth.booth_number} 已存在")
            else:
                created = crud.create_booth(db, booth)
                created_booths.append(created)
                print(f"  创建展位: {booth.booth_number} - {booth.company_name}")
        
        print("\n2. 检查物料是否存在...")
        materials = crud.get_materials(db, limit=100)
        if not materials:
            print("  物料表为空，请先导入物料CSV文件")
            print("  命令: curl -X POST -F 'file=@sample_materials.csv' http://localhost:8000/api/import/materials/csv/")
            return
        
        print(f"  找到 {len(materials)} 个物料")
        
        print("\n3. 创建调拨记录...")
        allocations_data = [
            {
                "allocation_code": "ALLOC-001",
                "booth_idx": 0,
                "material_idx": 0,
                "quantity": 20,
                "operator": "系统管理员",
                "remark": "测试调拨1"
            },
            {
                "allocation_code": "ALLOC-002",
                "booth_idx": 1,
                "material_idx": 2,
                "quantity": 50,
                "operator": "系统管理员",
                "remark": "测试调拨2"
            },
            {
                "allocation_code": "ALLOC-003",
                "booth_idx": 2,
                "material_idx": 4,
                "quantity": 30,
                "operator": "系统管理员",
                "remark": "测试调拨3"
            }
        ]
        
        for alloc_data in allocations_data:
            existing = crud.get_allocation_by_code(db, alloc_data["allocation_code"])
            if existing:
                print(f"  调拨记录 {alloc_data['allocation_code']} 已存在")
                continue
            
            booth = created_booths[alloc_data["booth_idx"]]
            material = materials[alloc_data["material_idx"]]
            
            if material.quantity_available < alloc_data["quantity"]:
                print(f"  物料 {material.material_code} 可用数量不足，跳过")
                continue
            
            allocation = schemas.AllocationCreate(
                allocation_code=alloc_data["allocation_code"],
                booth_id=booth.id,
                material_id=material.id,
                quantity=alloc_data["quantity"],
                operator=alloc_data["operator"],
                remark=alloc_data["remark"]
            )
            
            created = crud.create_allocation(db, allocation)
            print(f"  创建调拨记录: {created.allocation_code} - {material.name} x{created.quantity}")
        
        print("\n测试数据初始化完成！")
        print("\n现在可以进行以下操作：")
        print("  1. 查看物料列表: GET /api/materials/")
        print("  2. 查看调拨记录: GET /api/allocations/")
        print("  3. 导入归还记录: POST /api/import/returns/csv/")
        print("  4. 查看库存报告: GET /api/reports/inventory")
        print("  5. 查看总账报告: GET /api/reports/general-ledger")
        
    except Exception as e:
        print(f"初始化失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    init_test_data()
