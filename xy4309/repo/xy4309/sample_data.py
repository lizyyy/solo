#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
示例数据模块
用于初始化应用时添加测试数据
"""

from datetime import date, timedelta, datetime
from typing import Optional

from models import (
    Reagent, Cabinet, ResponsiblePerson, UsageRecord,
    ChemicalCategory
)
from storage.db_manager import DatabaseManager


def add_sample_data(db_manager: DatabaseManager):
    """
    添加示例数据（如果数据库为空）
    
    Args:
        db_manager: 数据库管理器实例
    """
    # 检查是否已有数据
    existing_persons = db_manager.get_all_responsible_persons()
    if existing_persons:
        # 已有数据，不重复添加
        return
    
    # 添加责任人
    person1 = ResponsiblePerson(
        id=None,
        name="张三",
        employee_id="T2023001",
        department="化学系",
        phone="13800138001",
        email="zhangsan@university.edu",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    person1_id = db_manager.add_responsible_person(person1)
    
    person2 = ResponsiblePerson(
        id=None,
        name="李四",
        employee_id="T2023002",
        department="材料系",
        phone="13800138002",
        email="lisi@university.edu",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    person2_id = db_manager.add_responsible_person(person2)
    
    person3 = ResponsiblePerson(
        id=None,
        name="王五",
        employee_id="T2023003",
        department="环境系",
        phone="13800138003",
        email="wangwu@university.edu",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    person3_id = db_manager.add_responsible_person(person3)
    
    # 添加柜位
    cabinet1 = Cabinet(
        id=None,
        name="A-01 酸类柜",
        location="实验室A区",
        description="专门存放酸性试剂",
        responsible_person_id=person1_id,
        capacity=50,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    cabinet1_id = db_manager.add_cabinet(cabinet1)
    
    cabinet2 = Cabinet(
        id=None,
        name="A-02 碱类柜",
        location="实验室A区",
        description="专门存放碱性试剂",
        responsible_person_id=person1_id,
        capacity=50,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    cabinet2_id = db_manager.add_cabinet(cabinet2)
    
    cabinet3 = Cabinet(
        id=None,
        name="B-01 有机溶剂柜",
        location="实验室B区",
        description="存放有机溶剂",
        responsible_person_id=person2_id,
        capacity=40,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    cabinet3_id = db_manager.add_cabinet(cabinet3)
    
    cabinet4 = Cabinet(
        id=None,
        name="B-02 氧化剂柜",
        location="实验室B区",
        description="存放氧化剂",
        responsible_person_id=person2_id,
        capacity=30,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    cabinet4_id = db_manager.add_cabinet(cabinet4)
    
    # 添加试剂
    today = date.today()
    
    # 正常试剂
    reagent1 = Reagent(
        id=None,
        bottle_number="R20240001",
        name="盐酸 (HCl)",
        category=ChemicalCategory.ACID,
        purity="分析纯",
        specification="500ml",
        manufacturer="国药集团",
        production_date=today - timedelta(days=180),
        expiration_date=today + timedelta(days=545),  # 约2年
        cabinet_id=cabinet1_id,
        quantity=5.0,
        unit="瓶",
        min_quantity=2.0,
        responsible_person_id=person1_id,
        purchase_date=today - timedelta(days=170),
        notes="36% 浓盐酸",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    reagent1_id = db_manager.add_reagent(reagent1)
    
    # 即将过期的试剂
    reagent2 = Reagent(
        id=None,
        bottle_number="R20240002",
        name="氢氧化钠 (NaOH)",
        category=ChemicalCategory.BASE,
        purity="分析纯",
        specification="500g",
        manufacturer="国药集团",
        production_date=today - timedelta(days=700),
        expiration_date=today + timedelta(days=15),  # 即将过期
        cabinet_id=cabinet2_id,
        quantity=3.0,
        unit="瓶",
        min_quantity=1.0,
        responsible_person_id=person1_id,
        purchase_date=today - timedelta(days=690),
        notes="片状氢氧化钠",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    reagent2_id = db_manager.add_reagent(reagent2)
    
    # 已过期的试剂
    reagent3 = Reagent(
        id=None,
        bottle_number="R20230001",
        name="硫酸 (H2SO4)",
        category=ChemicalCategory.ACID,
        purity="化学纯",
        specification="500ml",
        manufacturer="西陇化工",
        production_date=today - timedelta(days=1000),
        expiration_date=today - timedelta(days=30),  # 已过期
        cabinet_id=cabinet1_id,
        quantity=1.0,
        unit="瓶",
        min_quantity=1.0,
        responsible_person_id=person1_id,
        purchase_date=today - timedelta(days=990),
        notes="98% 浓硫酸，已过期待处理",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    reagent3_id = db_manager.add_reagent(reagent3)
    
    # 库存不足的试剂
    reagent4 = Reagent(
        id=None,
        bottle_number="R20240003",
        name="乙醇 (C2H5OH)",
        category=ChemicalCategory.ORGANIC,
        purity="无水乙醇",
        specification="500ml",
        manufacturer="国药集团",
        production_date=today - timedelta(days=100),
        expiration_date=today + timedelta(days=600),
        cabinet_id=cabinet3_id,
        quantity=0.5,  # 库存不足
        unit="瓶",
        min_quantity=2.0,
        responsible_person_id=person2_id,
        purchase_date=today - timedelta(days=90),
        notes="99.7% 无水乙醇",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    reagent4_id = db_manager.add_reagent(reagent4)
    
    # 正常试剂
    reagent5 = Reagent(
        id=None,
        bottle_number="R20240004",
        name="高锰酸钾 (KMnO4)",
        category=ChemicalCategory.OXIDIZING,
        purity="分析纯",
        specification="500g",
        manufacturer="国药集团",
        production_date=today - timedelta(days=60),
        expiration_date=today + timedelta(days=700),
        cabinet_id=cabinet4_id,
        quantity=4.0,
        unit="瓶",
        min_quantity=2.0,
        responsible_person_id=person2_id,
        purchase_date=today - timedelta(days=50),
        notes="氧化剂，强氧化性",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    reagent5_id = db_manager.add_reagent(reagent5)
    
    # 故意放错柜位的试剂（禁配测试）- 酸类柜里放碱
    reagent6 = Reagent(
        id=None,
        bottle_number="R20240005",
        name="氢氧化钾 (KOH)",
        category=ChemicalCategory.BASE,  # 碱类
        purity="分析纯",
        specification="500g",
        manufacturer="国药集团",
        production_date=today - timedelta(days=120),
        expiration_date=today + timedelta(days=600),
        cabinet_id=cabinet1_id,  # 放在酸类柜（错误！）
        quantity=2.0,
        unit="瓶",
        min_quantity=1.0,
        responsible_person_id=person1_id,
        purchase_date=today - timedelta(days=110),
        notes="片状氢氧化钾",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    reagent6_id = db_manager.add_reagent(reagent6)
    
    # 添加领用记录
    # 正常领用（已归还）
    usage1 = UsageRecord(
        id=None,
        reagent_id=reagent1_id,
        bottle_number="R20240001",
        operation_type="领用",
        quantity=1.0,
        unit="瓶",
        operator_id=person3_id,
        expected_return_date=today - timedelta(days=5),
        actual_return_date=today - timedelta(days=3),
        purpose="本科实验课使用",
        notes="用于酸碱滴定实验",
        created_at=datetime.now() - timedelta(days=10),
        updated_at=datetime.now() - timedelta(days=3)
    )
    db_manager.add_usage_record(usage1)
    
    # 超期未归还的领用记录
    usage2 = UsageRecord(
        id=None,
        reagent_id=reagent4_id,
        bottle_number="R20240003",
        operation_type="领用",
        quantity=0.5,
        unit="瓶",
        operator_id=person3_id,
        expected_return_date=today - timedelta(days=15),  # 已超期
        actual_return_date=None,  # 未归还
        purpose="毕业设计实验",
        notes="无水乙醇用于样品清洗",
        created_at=datetime.now() - timedelta(days=30),
        updated_at=datetime.now() - timedelta(days=30)
    )
    db_manager.add_usage_record(usage2)
    
    # 归还记录
    usage3 = UsageRecord(
        id=None,
        reagent_id=reagent5_id,
        bottle_number="R20240004",
        operation_type="归还",
        quantity=0.5,
        unit="瓶",
        operator_id=person3_id,
        expected_return_date=None,
        actual_return_date=today,
        purpose="归还剩余部分",
        notes="实验剩余约200ml",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    db_manager.add_usage_record(usage3)
