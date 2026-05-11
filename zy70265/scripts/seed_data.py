#!/usr/bin/env python3
"""
样例数据初始化脚本 - 用于初始化测试数据
运行: python -m scripts.seed_data
"""
from datetime import datetime, timedelta
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine, Base
from app.models import User, GasCylinder
from app.config import DANGER_CATEGORIES


def init_data():
    print("正在初始化样例数据...")
    
    db = SessionLocal()
    
    try:
        Base.metadata.create_all(bind=engine)
        
        print("\n1. 创建用户...")
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            admin_user = User(
                username="admin",
                full_name="系统管理员",
                email="admin@lab.example.com",
                phone="13800138000",
                is_admin=True
            )
            db.add(admin_user)
            print(f"  - 创建管理员: {admin_user.username}")
        
        researcher1 = db.query(User).filter(User.username == "researcher1").first()
        if not researcher1:
            researcher1 = User(
                username="researcher1",
                full_name="研究员 张三",
                email="zhangsan@lab.example.com",
                phone="13900139001",
                is_admin=False
            )
            db.add(researcher1)
            print(f"  - 创建研究员: {researcher1.username}")
        
        researcher2 = db.query(User).filter(User.username == "researcher2").first()
        if not researcher2:
            researcher2 = User(
                username="researcher2",
                full_name="研究员 李四",
                email="lisi@lab.example.com",
                phone="13900139002",
                is_admin=False
            )
            db.add(researcher2)
            print(f"  - 创建研究员: {researcher2.username}")
        
        db.commit()
        
        print("\n2. 创建气瓶档案...")
        
        cylinders_data = [
            {
                "cylinder_code": "CYL-2024-001",
                "gas_type": "氧气",
                "danger_category": "OXIDIZING",
                "capacity": 50.0,
                "current_level": 45.0,
                "location": "A楼 301室 气瓶柜",
                "manufacturer": "某气体公司",
                "production_date": datetime(2024, 1, 15),
                "inspection_date": datetime(2024, 1, 20),
                "next_inspection_date": datetime(2026, 1, 20)
            },
            {
                "cylinder_code": "CYL-2024-002",
                "gas_type": "氮气",
                "danger_category": "INERT",
                "capacity": 50.0,
                "current_level": 12.0,
                "location": "A楼 301室 气瓶柜",
                "manufacturer": "某气体公司",
                "production_date": datetime(2024, 2, 10),
                "inspection_date": datetime(2024, 2, 15),
                "next_inspection_date": datetime(2026, 2, 15)
            },
            {
                "cylinder_code": "CYL-2024-003",
                "gas_type": "氢气",
                "danger_category": "FLAMMABLE",
                "capacity": 40.0,
                "current_level": 3.0,
                "location": "B楼 安全实验室",
                "manufacturer": "某特种气体公司",
                "production_date": datetime(2024, 1, 20),
                "inspection_date": datetime(2024, 1, 25),
                "next_inspection_date": datetime(2025, 1, 25)
            },
            {
                "cylinder_code": "CYL-2024-004",
                "gas_type": "氯气",
                "danger_category": "TOXIC",
                "capacity": 30.0,
                "current_level": 5.0,
                "location": "C楼 有毒气体专用室",
                "manufacturer": "某特种气体公司",
                "production_date": datetime(2024, 3, 1),
                "inspection_date": datetime(2024, 3, 5),
                "next_inspection_date": datetime(2025, 3, 5)
            },
            {
                "cylinder_code": "CYL-2024-005",
                "gas_type": "氩气",
                "danger_category": "INERT",
                "capacity": 50.0,
                "current_level": 50.0,
                "location": "备用气瓶库",
                "manufacturer": "某气体公司",
                "production_date": datetime(2024, 3, 15),
                "inspection_date": datetime(2024, 3, 20),
                "next_inspection_date": datetime(2026, 3, 20)
            }
        ]
        
        for cyl_data in cylinders_data:
            existing = db.query(GasCylinder).filter(
                GasCylinder.cylinder_code == cyl_data["cylinder_code"]
            ).first()
            if not existing:
                cylinder = GasCylinder(**cyl_data)
                db.add(cylinder)
                category_info = DANGER_CATEGORIES[cyl_data["danger_category"]]
                print(f"  - 创建气瓶: {cyl_data['cylinder_code']} ({cyl_data['gas_type']}, {category_info['name']})")
        
        db.commit()
        
        print("\n3. 数据初始化完成!")
        print("\n总结:")
        print(f"  - 用户数量: {db.query(User).count()}")
        print(f"  - 气瓶数量: {db.query(GasCylinder).count()}")
        print("\n危险分类说明:")
        for cat, info in DANGER_CATEGORIES.items():
            print(f"  - {cat}: {info['name']} (预警倍率: {info['warning_multiplier']}x)")
        
    finally:
        db.close()


if __name__ == "__main__":
    init_data()
