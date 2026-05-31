#!/usr/bin/env python3
"""
验证安装和数据生成的脚本
直接通过Python API执行，不依赖终端
"""

import os
import sys
import subprocess
import importlib.util

def check_python_version():
    print(f"Python版本: {sys.version}")
    assert sys.version_info >= (3, 8), "需要Python 3.8+"
    print("✓ Python版本符合要求")

def check_dependencies():
    required = ['flask', 'flask_cors', 'pandas', 'openpyxl', 'PIL']
    missing = []
    
    for pkg in required:
        try:
            importlib.import_module(pkg)
            print(f"✓ {pkg} 已安装")
        except ImportError:
            missing.append(pkg)
            print(f"✗ {pkg} 未安装")
    
    if missing:
        print(f"\n缺少依赖: {missing}")
        print("请运行: pip install -r requirements.txt")
        return False
    return True

def run_seed_data():
    print("\n" + "="*60)
    print("开始生成测试数据...")
    print("="*60)
    
    sys.path.insert(0, os.path.dirname(__file__))
    
    from seed_test_data import seed_data
    seed_data()
    
    print("\n" + "="*60)
    print("测试数据生成完成！")
    print("="*60)

def verify_database():
    print("\n验证数据库内容...")
    sys.path.insert(0, os.path.dirname(__file__))
    
    from database import get_db
    conn = get_db()
    c = conn.cursor()
    
    tables = ['lectures', 'commentary_records', 'tangent_checks', 'audit_logs', 'duplicate_records']
    for table in tables:
        c.execute(f'SELECT COUNT(*) FROM {table}')
        count = c.fetchone()[0]
        print(f"  {table}: {count} 条记录")
    
    print("\n讲义列表:")
    c.execute('SELECT id, title, difficulty_tag, status, version FROM lectures ORDER BY created_at')
    for row in c.fetchall():
        diff = row[2] or '（未设置）'
        print(f"  - [{row[3]}] {row[1][:30]}... | 难度: {diff} | 版本: v{row[4]}")
    
    print("\n检查结果统计:")
    c.execute('SELECT result, COUNT(*) FROM tangent_checks GROUP BY result')
    for row in c.fetchall():
        print(f"  {row[0]}: {row[1]} 条")
    
    print("\n重复记录:")
    c.execute('SELECT duplicate_type, COUNT(*) FROM duplicate_records GROUP BY duplicate_type')
    for row in c.fetchall():
        print(f"  {row[0]}: {row[1]} 条")
    
    conn.close()
    print("\n✓ 数据库验证完成")

def test_filter_and_export():
    print("\n" + "="*60)
    print("测试筛选和导出功能...")
    print("="*60)
    
    sys.path.insert(0, os.path.dirname(__file__))
    from core_logic import query_lectures, export_data
    
    print("\n1. 查询所有讲义:")
    all_lectures = query_lectures()
    print(f"   共 {len(all_lectures)} 条")
    
    print("\n2. 筛选缺少难度标签的讲义:")
    missing_diff = query_lectures({'missing_difficulty': 'yes'})
    print(f"   共 {len(missing_diff)} 条")
    for l in missing_diff:
        print(f"   - {l['title']}")
    
    print("\n3. 筛选检查未通过的讲义:")
    failed = query_lectures({'has_check_result': 'failed'})
    print(f"   共 {len(failed)} 条")
    for l in failed:
        print(f"   - {l['title']}")
    
    print("\n4. 筛选有重复记录的讲义:")
    duplicates = query_lectures({'has_duplicate': 'yes'})
    print(f"   共 {len(duplicates)} 条")
    for l in duplicates:
        print(f"   - {l['title']}")
    
    print("\n5. 测试导出功能:")
    result = export_data(filters={'missing_difficulty': 'yes'}, format='excel')
    print(f"   导出文件: {result['filename']}")
    print(f"   记录数: {result['record_count']}")
    
    print("\n✓ 筛选和导出功能测试通过")

def test_timeline():
    print("\n" + "="*60)
    print("测试时间线功能...")
    print("="*60)
    
    sys.path.insert(0, os.path.dirname(__file__))
    from core_logic import query_lectures, get_lecture_timeline
    
    lectures = query_lectures()
    if lectures:
        lecture_id = lectures[0]['id']
        print(f"\n查看讲义 [{lectures[0]['title']}] 的时间线:")
        
        timeline = get_lecture_timeline(lecture_id)
        print(f"  事件总数: {len(timeline['timeline'])}")
        
        for event in timeline['timeline']:
            print(f"  [{event['time']}] {event['icon']} {event['title']}")
        
        print("\n✓ 时间线功能测试通过")

def main():
    print("="*60)
    print("教研工具 - 安装验证脚本")
    print("="*60)
    
    try:
        check_python_version()
        print()
        
        if not check_dependencies():
            print("\n请先安装依赖，然后重新运行此脚本")
            return 1
        
        run_seed_data()
        verify_database()
        test_filter_and_export()
        test_timeline()
        
        print("\n" + "="*60)
        print("🎉 所有验证通过！")
        print("="*60)
        print("\n下一步：")
        print("1. 运行: python3 app.py")
        print("2. 打开浏览器访问: http://localhost:5000")
        
        return 0
        
    except Exception as e:
        print(f"\n✗ 错误: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())
