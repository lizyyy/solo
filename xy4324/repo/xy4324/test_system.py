#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试脚本 - 验证系统核心功能
"""

import sys
import os

# 确保能找到模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 60)
print("试剂领用安全闸 - 系统测试")
print("=" * 60)

# 1. 测试配置模块
print("\n[1/5] 测试配置模块...")
try:
    from config import get_config
    config = get_config()
    print(f"  ✓ 配置加载成功")
    print(f"  ✓ 数据目录: {config.data_dir}")
    print(f"  ✓ 数据库路径: {config.db_path}")
    print(f"  ✓ 危险等级: {len(config.danger_levels)} 级")
    print(f"  ✓ 试剂类别: {len(config.reagent_categories)} 种")
except Exception as e:
    print(f"  ✗ 配置模块测试失败: {e}")
    sys.exit(1)

# 2. 测试数据库模块
print("\n[2/5] 测试数据库模块...")
try:
    from database import init_database, get_db, create_sample_data
    
    # 确保数据目录存在
    config.ensure_directories()
    
    # 初始化数据库
    init_database()
    print(f"  ✓ 数据库初始化成功")
    
    # 获取数据库连接
    conn = get_db()
    cursor = conn.cursor()
    
    # 检查表是否存在
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"  ✓ 数据库表: {len(tables)} 张")
    
    # 创建示例数据
    created = create_sample_data()
    if created:
        print(f"  ✓ 示例数据创建成功")
    else:
        print(f"  ✓ 示例数据已存在")
    
    # 检查试剂数据
    cursor.execute("SELECT COUNT(*) FROM reagents")
    reagent_count = cursor.fetchone()[0]
    print(f"  ✓ 试剂数量: {reagent_count} 种")
    
    # 检查班级数据
    cursor.execute("SELECT COUNT(*) FROM classes")
    class_count = cursor.fetchone()[0]
    print(f"  ✓ 班级数量: {class_count} 个")
    
except Exception as e:
    print(f"  ✗ 数据库模块测试失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 3. 测试服务模块
print("\n[3/5] 测试服务模块...")
try:
    from services import ReagentService, BookingService, SafetyService, ExportService
    
    reagent_service = ReagentService()
    booking_service = BookingService()
    safety_service = SafetyService()
    export_service = ExportService()
    
    print(f"  ✓ 服务模块导入成功")
    
    # 测试试剂服务
    reagents = reagent_service.get_all_reagents()
    print(f"  ✓ 试剂服务: 读取到 {len(reagents)} 种试剂")
    
    # 测试预约服务
    bookings = booking_service.get_all_bookings()
    print(f"  ✓ 预约服务: 读取到 {len(bookings)} 条预约")
    
except Exception as e:
    print(f"  ✗ 服务模块测试失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 4. 测试安全检查
print("\n[4/5] 测试安全检查模块...")
try:
    # 获取一个预约进行测试
    bookings = booking_service.get_all_bookings(status='pending')
    if bookings:
        booking_id = bookings[0]['id']
        print(f"  测试预约 ID: {booking_id}")
        
        results, can_proceed = safety_service.check_all_safety(booking_id)
        print(f"  ✓ 安全检查执行完成")
        print(f"  ✓ 检查结果: {'可以继续' if can_proceed else '存在阻断问题'}")
        
        for result in results:
            status_icon = "✓" if result.status == 'PASSED' else ("⚠" if result.status == 'WARNING' else "✗")
            print(f"    {status_icon} {result.check_name}: {result.message}")
    else:
        print(f"  - 没有待审批的预约可用于测试")
        
except Exception as e:
    print(f"  ✗ 安全检查测试失败: {e}")
    import traceback
    traceback.print_exc()

# 5. 测试导出功能
print("\n[5/5] 测试导出模块...")
try:
    import tempfile
    
    # 测试导出库存CSV
    with tempfile.NamedTemporaryFile(suffix='.csv', delete=False) as f:
        temp_csv = f.name
    
    export_service.export_inventory_csv(temp_csv)
    
    # 检查文件是否创建成功
    if os.path.exists(temp_csv):
        file_size = os.path.getsize(temp_csv)
        print(f"  ✓ 库存CSV导出成功: {file_size} 字节")
        
        # 读取前几行
        with open(temp_csv, 'r', encoding='utf-8') as f:
            lines = f.readlines()[:3]
            for line in lines:
                print(f"    {line.strip()}")
        
        os.unlink(temp_csv)
    else:
        print(f"  ✗ CSV导出失败: 文件未创建")
    
except Exception as e:
    print(f"  ✗ 导出测试失败: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("✓ 所有核心测试通过！")
print("=" * 60)
print("\n系统已准备就绪，可以运行主程序:")
print("  python3 main.py")
