#!/usr/bin/env python3
"""
示例数据脚本 - 演示设备更换场景

场景说明：
- 设备A（旧设备）：2024年1月-6月运行，能效较高
- 设备A在2024年6月底更换为新设备
- 新设备（设备A-新）：2024年7月-12月运行，能效更优
- 演示基线版本管理：旧基线（更换前）和新基线（更换后）
"""

import sys
import os
from datetime import datetime, timedelta
import random

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, init_db
from app.models import (
    Equipment, EquipmentGroup, EnergyData, ProductionData,
    BaselineVersion, EnergySaving
)
from app.services import BaselineService


def create_sample_data():
    """创建示例数据"""
    db = SessionLocal()
    
    try:
        print("初始化数据库...")
        init_db()
        
        print("创建设备分组...")
        group = EquipmentGroup(
            name="冲压车间",
            code="STAMPING_01",
            description="冲压车间设备分组"
        )
        db.add(group)
        db.commit()
        db.refresh(group)
        
        print("创建旧设备（设备A）...")
        old_equipment = Equipment(
            name="冲压机A（旧）",
            code="STAMP-001",
            type="冲压机",
            group_id=group.id,
            install_date=datetime(2020, 1, 1),
            replace_date=datetime(2024, 6, 30),
            status="replaced",
            description="2024年6月更换的旧设备"
        )
        db.add(old_equipment)
        db.commit()
        db.refresh(old_equipment)
        
        print("创建新设备（设备A-新）...")
        new_equipment = Equipment(
            name="冲压机A（新）",
            code="STAMP-001-NEW",
            type="冲压机",
            group_id=group.id,
            install_date=datetime(2024, 7, 1),
            status="active",
            description="2024年7月新更换的设备，能效更优"
        )
        db.add(new_equipment)
        db.commit()
        db.refresh(new_equipment)
        
        print("生成旧设备数据（2024年1月-6月）...")
        generate_equipment_data(
            db, old_equipment,
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 6, 30),
            efficiency_mean=15.0,  # 旧设备能效：15 kWh/件
            efficiency_std=2.0
        )
        
        print("生成新设备数据（2024年7月-12月）...")
        generate_equipment_data(
            db, new_equipment,
            start_date=datetime(2024, 7, 1),
            end_date=datetime(2024, 12, 31),
            efficiency_mean=10.0,  # 新设备能效：10 kWh/件（更节能）
            efficiency_std=1.5
        )
        
        print("创建旧设备基线版本...")
        try:
            old_baseline = BaselineService.create_baseline_version(
                db=db,
                name="旧设备基线（更换前）",
                equipment_id=old_equipment.id,
                start_date=datetime(2024, 1, 1),
                end_date=datetime(2024, 6, 30),
                description="基于2024年1-6月数据的旧设备基线",
                created_by="系统管理员"
            )
            
            BaselineService.activate_baseline(
                db, old_baseline.id,
                replace_reason="初始基线版本"
            )
            print(f"旧设备基线创建成功: {old_baseline.version}")
        except Exception as e:
            print(f"旧设备基线创建失败: {e}")
        
        print("创建新设备基线版本...")
        try:
            new_baseline = BaselineService.create_baseline_version(
                db=db,
                name="新设备基线（更换后）",
                equipment_id=new_equipment.id,
                start_date=datetime(2024, 7, 1),
                end_date=datetime(2024, 12, 31),
                description="基于2024年7-12月数据的新设备基线",
                created_by="系统管理员"
            )
            
            BaselineService.activate_baseline(
                db, new_baseline.id,
                replace_reason="设备更换，需要重新计算基线"
            )
            print(f"新设备基线创建成功: {new_baseline.version}")
        except Exception as e:
            print(f"新设备基线创建失败: {e}")
        
        print("\n示例数据创建完成！")
        print(f"\n数据概览：")
        print(f"  - 设备分组: {group.name}")
        print(f"  - 旧设备: {old_equipment.name} (状态: {old_equipment.status})")
        print(f"  - 新设备: {new_equipment.name} (状态: {new_equipment.status})")
        
        old_energy_count = db.query(EnergyData).filter(
            EnergyData.equipment_id == old_equipment.id
        ).count()
        new_energy_count = db.query(EnergyData).filter(
            EnergyData.equipment_id == new_equipment.id
        ).count()
        
        print(f"  - 旧设备能耗数据: {old_energy_count} 条")
        print(f"  - 新设备能耗数据: {new_energy_count} 条")
        
        baseline_count = db.query(BaselineVersion).count()
        print(f"  - 基线版本总数: {baseline_count} 个")
        
    finally:
        db.close()


def generate_equipment_data(db, equipment, start_date, end_date, 
                           efficiency_mean, efficiency_std):
    """
    生成设备的能耗和产量数据
    
    Args:
        db: 数据库会话
        equipment: 设备对象
        start_date: 开始日期
        end_date: 结束日期
        efficiency_mean: 能效平均值（kWh/件）
        efficiency_std: 能效标准差
    """
    current_date = start_date
    day_count = 0
    
    while current_date <= end_date:
        # 每天生成3个班次的数据
        for shift in range(3):
            hour = 8 + shift * 8  # 8:00, 16:00, 24:00
            
            # 随机生成产量（500-1500件/班次）
            production = random.uniform(500, 1500)
            
            # 基于能效计算能耗：能耗 = 产量 * 能效
            efficiency = max(1.0, random.gauss(efficiency_mean, efficiency_std))
            energy = production * efficiency
            
            # 偶尔加入异常数据（约5%的概率）
            if random.random() < 0.05:
                energy *= 2.0  # 能耗异常偏高
            
            record_time = current_date.replace(hour=hour, minute=0, second=0)
            
            energy_record = EnergyData(
                equipment_id=equipment.id,
                record_date=record_time,
                energy_consumption=energy,
                energy_type="electricity",
                source="示例数据生成器"
            )
            
            production_record = ProductionData(
                equipment_id=equipment.id,
                record_date=record_time,
                production_quantity=production,
                production_unit="件",
                shift=f"班次{shift + 1}",
                source="示例数据生成器"
            )
            
            db.add(energy_record)
            db.add(production_record)
        
        current_date += timedelta(days=1)
        day_count += 1
        
        # 每30天提交一次
        if day_count % 30 == 0:
            db.commit()
    
    db.commit()


if __name__ == "__main__":
    print("=" * 60)
    print("设备能效基线系统 - 示例数据生成")
    print("=" * 60)
    print()
    create_sample_data()
    print()
    print("=" * 60)
    print("完成！可通过以下方式启动应用：")
    print("  python main.py")
    print("  然后访问 http://localhost:8000/docs 查看API文档")
    print("=" * 60)
