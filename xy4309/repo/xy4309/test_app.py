#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试脚本 - 验证应用核心功能
"""

import sys
from pathlib import Path
from datetime import date, timedelta

# 添加当前目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent))

print("=" * 60)
print("危化品柜巡检签收台 - 功能测试")
print("=" * 60)

# 测试 1: 数据模型
print("\n[测试 1] 数据模型...")
try:
    from models import (
        Reagent, Cabinet, ResponsiblePerson, UsageRecord,
        InventoryCheck, InspectionRecord, Alert,
        ChemicalCategory, AlertType
    )
    print("  ✓ 数据模型导入成功")
    print(f"  - 试剂类别数: {len(list(ChemicalCategory))}")
    print(f"  - 预警类型数: {len(list(AlertType))}")
except Exception as e:
    print(f"  ✗ 数据模型导入失败: {e}")
    sys.exit(1)

# 测试 2: 数据库管理器
print("\n[测试 2] 数据库管理器...")
try:
    from storage.db_manager import DatabaseManager
    
    # 使用测试数据库
    test_db_path = str(Path(__file__).parent / "data" / "test_chemicals.db")
    
    # 确保测试数据库不存在
    test_db = Path(test_db_path)
    if test_db.exists():
        test_db.unlink()
    
    db_manager = DatabaseManager(test_db_path)
    print("  ✓ 数据库管理器创建成功")
    print(f"  - 数据库路径: {test_db_path}")
except Exception as e:
    print(f"  ✗ 数据库管理器创建失败: {e}")
    sys.exit(1)

# 测试 3: 校验规则
print("\n[测试 3] 校验规则...")
try:
    from logic.validation_rules import ValidationRules, ValidationResult
    
    # 测试过期校验
    today = date.today()
    expired_reagent = Reagent(
        id=1,
        bottle_number="TEST001",
        name="过期试剂",
        category=ChemicalCategory.ACID,
        purity="分析纯",
        specification="500ml",
        manufacturer="测试厂家",
        production_date=today - timedelta(days=365),
        expiration_date=today - timedelta(days=30),
        cabinet_id=1,
        quantity=5.0,
        unit="瓶",
        min_quantity=2.0,
        responsible_person_id=1,
        purchase_date=today - timedelta(days=300),
        notes="测试",
        created_at=today,
        updated_at=today
    )
    
    result = ValidationRules.check_expired(expired_reagent)
    assert not result.is_valid, "过期试剂应该校验失败"
    assert result.alert_type == AlertType.EXPIRED, "应该是过期预警"
    print("  ✓ 过期校验规则正常")
    
    # 测试即将过期
    expiring_reagent = Reagent(
        id=2,
        bottle_number="TEST002",
        name="即将过期试剂",
        category=ChemicalCategory.BASE,
        purity="分析纯",
        specification="500g",
        manufacturer="测试厂家",
        production_date=today - timedelta(days=365),
        expiration_date=today + timedelta(days=15),
        cabinet_id=1,
        quantity=3.0,
        unit="瓶",
        min_quantity=1.0,
        responsible_person_id=1,
        purchase_date=today - timedelta(days=300),
        notes="测试",
        created_at=today,
        updated_at=today
    )
    
    result = ValidationRules.check_expired(expiring_reagent)
    assert not result.is_valid, "即将过期试剂应该校验失败"
    assert result.alert_type == AlertType.EXPIRING_SOON, "应该是即将过期预警"
    print("  ✓ 即将过期校验规则正常")
    
    # 测试库存不足
    low_stock_reagent = Reagent(
        id=3,
        bottle_number="TEST003",
        name="库存不足试剂",
        category=ChemicalCategory.ORGANIC,
        purity="分析纯",
        specification="500ml",
        manufacturer="测试厂家",
        production_date=today - timedelta(days=100),
        expiration_date=today + timedelta(days=600),
        cabinet_id=1,
        quantity=0.5,
        unit="瓶",
        min_quantity=2.0,
        responsible_person_id=1,
        purchase_date=today - timedelta(days=90),
        notes="测试",
        created_at=today,
        updated_at=today
    )
    
    result = ValidationRules.check_low_stock(low_stock_reagent)
    assert not result.is_valid, "库存不足应该校验失败"
    assert result.alert_type == AlertType.LOW_STOCK, "应该是库存不足预警"
    print("  ✓ 库存不足校验规则正常")
    
    # 测试禁配规则
    acid_reagent = Reagent(
        id=4,
        bottle_number="TEST004",
        name="盐酸",
        category=ChemicalCategory.ACID,
        purity="分析纯",
        specification="500ml",
        manufacturer="测试厂家",
        production_date=today - timedelta(days=180),
        expiration_date=today + timedelta(days=545),
        cabinet_id=1,
        quantity=5.0,
        unit="瓶",
        min_quantity=2.0,
        responsible_person_id=1,
        purchase_date=today - timedelta(days=170),
        notes="测试",
        created_at=today,
        updated_at=today
    )
    
    base_reagent = Reagent(
        id=5,
        bottle_number="TEST005",
        name="氢氧化钠",
        category=ChemicalCategory.BASE,
        purity="分析纯",
        specification="500g",
        manufacturer="测试厂家",
        production_date=today - timedelta(days=180),
        expiration_date=today + timedelta(days=545),
        cabinet_id=1,
        quantity=3.0,
        unit="瓶",
        min_quantity=1.0,
        responsible_person_id=1,
        purchase_date=today - timedelta(days=170),
        notes="测试",
        created_at=today,
        updated_at=today
    )
    
    cabinet_reagents = [acid_reagent, base_reagent]
    results = ValidationRules.check_incompatible(acid_reagent, cabinet_reagents)
    assert len(results) > 0, "酸碱应该禁配"
    print("  ✓ 禁配校验规则正常")
    
    # 获取禁配对列表
    incompatible_pairs = ValidationRules.get_incompatible_pairs()
    print(f"  - 禁配规则对数: {len(incompatible_pairs)}")
    
except Exception as e:
    print(f"  ✗ 校验规则测试失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 测试 4: 导入导出
print("\n[测试 4] 导入导出功能...")
try:
    from logic.import_export import ImportExportManager
    
    # 创建测试试剂
    test_reagents = [
        Reagent(
            id=1,
            bottle_number="EXP001",
            name="盐酸 (HCl)",
            category=ChemicalCategory.ACID,
            purity="分析纯",
            specification="500ml",
            manufacturer="国药集团",
            production_date=today - timedelta(days=180),
            expiration_date=today + timedelta(days=545),
            cabinet_id=1,
            quantity=5.0,
            unit="瓶",
            min_quantity=2.0,
            responsible_person_id=1,
            purchase_date=today - timedelta(days=170),
            notes="36% 浓盐酸",
            created_at=today,
            updated_at=today
        )
    ]
    
    # 测试导出
    export_path = str(Path(__file__).parent / "data" / "test_export.csv")
    success = ImportExportManager.export_reagents_to_csv(test_reagents, export_path)
    assert success, "导出应该成功"
    print(f"  ✓ 导出功能正常 (文件: {export_path})")
    
    # 测试导入
    imported = ImportExportManager.import_reagents_from_csv(export_path)
    assert len(imported) > 0, "导入应该有数据"
    print(f"  ✓ 导入功能正常 (导入 {len(imported)} 条记录)")
    
except Exception as e:
    print(f"  ✗ 导入导出测试失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 测试 5: 示例数据
print("\n[测试 5] 示例数据...")
try:
    from sample_data import add_sample_data
    
    # 清空测试数据库后添加示例数据
    if test_db.exists():
        test_db.unlink()
    
    db_manager = DatabaseManager(test_db_path)
    add_sample_data(db_manager)
    
    # 验证数据
    persons = db_manager.get_all_responsible_persons()
    assert len(persons) >= 3, "应该有至少3个责任人"
    print(f"  ✓ 责任人数据: {len(persons)} 条")
    
    cabinets = db_manager.get_all_cabinets()
    assert len(cabinets) >= 4, "应该有至少4个柜位"
    print(f"  ✓ 柜位数据: {len(cabinets)} 条")
    
    reagents = db_manager.get_all_reagents()
    assert len(reagents) >= 6, "应该有至少6个试剂"
    print(f"  ✓ 试剂数据: {len(reagents)} 条")
    
    usage_records = db_manager.get_all_usage_records()
    assert len(usage_records) >= 3, "应该有至少3条领用记录"
    print(f"  ✓ 领用记录: {len(usage_records)} 条")
    
    # 验证超期未归还
    overdue = db_manager.get_overdue_usage_records()
    print(f"  ✓ 超期未归还: {len(overdue)} 条")
    
except Exception as e:
    print(f"  ✗ 示例数据测试失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 测试 6: 报告生成器
print("\n[测试 6] 报告生成器...")
try:
    from logic.report_generator import ReportGenerator
    
    # 获取测试数据
    inspector = persons[0]
    reagents = db_manager.get_all_reagents()
    cabinets = db_manager.get_all_cabinets()
    usage_records = db_manager.get_all_usage_records()
    
    # 执行校验
    from logic.validation_rules import ValidationRules
    validation_results = ValidationRules.validate_all_reagents(reagents, cabinets)
    overdue_results = ValidationRules.validate_usage_records(usage_records)
    
    print(f"  - 试剂校验结果: {len(validation_results)} 个柜位有问题")
    print(f"  - 超期未归还: {len(overdue_results)} 条")
    
    # 生成报告
    output_dir = str(Path(__file__).parent / "data")
    report_paths = ReportGenerator.generate_inspection_report(
        inspection_date=today,
        inspector=inspector,
        reagents=reagents,
        cabinets=cabinets,
        usage_records=usage_records,
        validation_results=validation_results,
        overdue_results=overdue_results,
        output_dir=output_dir
    )
    
    assert 'markdown' in report_paths, "应该有 Markdown 报告"
    assert 'csv' in report_paths, "应该有 CSV 清单"
    
    print(f"  ✓ Markdown 报告: {report_paths['markdown']}")
    print(f"  ✓ CSV 异常清单: {report_paths['csv']}")
    
except Exception as e:
    print(f"  ✗ 报告生成测试失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 清理测试文件
print("\n[清理] 测试文件...")
try:
    if test_db.exists():
        test_db.unlink()
        print(f"  ✓ 已删除测试数据库: {test_db_path}")
except Exception as e:
    print(f"  ⚠ 清理测试文件时出错: {e}")

print("\n" + "=" * 60)
print("所有测试通过！✓")
print("=" * 60)
print("\n应用功能验证完成，核心模块正常工作。")
print("可以运行 'python3 main.py' 启动 GUI 应用。")
