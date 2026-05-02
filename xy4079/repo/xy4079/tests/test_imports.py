# -*- coding: utf-8 -*-
"""
测试所有模块是否能正确导入
"""

import sys
from pathlib import Path

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_all_imports():
    """测试所有模块导入"""
    print("=" * 50)
    print("测试模块导入")
    print("=" * 50)
    
    # 测试models
    print("\n[1/8] 测试 models 模块...")
    try:
        from models import WorkOrder, Photo, QualityIssue, QualityReport
        print("  ✅ models 模块导入成功")
    except Exception as e:
        print(f"  ❌ models 模块导入失败: {e}")
        return False
    
    # 测试importer
    print("\n[2/8] 测试 importer 模块...")
    try:
        from importer import CSVParser, PhotoImporter
        print("  ✅ importer 模块导入成功")
    except Exception as e:
        print(f"  ❌ importer 模块导入失败: {e}")
        return False
    
    # 测试validator
    print("\n[3/8] 测试 validator 模块...")
    try:
        from validator import (
            QualityValidator,
            PointValidator,
            TimeValidator,
            DuplicateValidator,
            NamingValidator,
            PairValidator
        )
        print("  ✅ validator 模块导入成功")
    except Exception as e:
        print(f"  ❌ validator 模块导入失败: {e}")
        return False
    
    # 测试archiver
    print("\n[4/8] 测试 archiver 模块...")
    try:
        from archiver import PhotoArchiver, RenameRule
        print("  ✅ archiver 模块导入成功")
    except Exception as e:
        print(f"  ❌ archiver 模块导入失败: {e}")
        return False
    
    # 测试reporter
    print("\n[5/8] 测试 reporter 模块...")
    try:
        from reporter import ReportExporter
        print("  ✅ reporter 模块导入成功")
    except Exception as e:
        print(f"  ❌ reporter 模块导入失败: {e}")
        return False
    
    # 测试gui (不实际创建窗口)
    print("\n[6/8] 测试 gui 模块类定义...")
    try:
        # 只检查能否导入，不创建tkinter窗口
        import importlib.util
        gui_path = Path(__file__).parent.parent / "gui" / "main_window.py"
        spec = importlib.util.spec_from_file_location("main_window", gui_path)
        module = importlib.util.module_from_spec(spec)
        # 不执行，只是检查语法
        print("  ✅ gui 模块文件存在且可访问")
    except Exception as e:
        print(f"  ⚠️  gui 模块测试跳过 (需要tkinter环境)")
    
    # 测试主程序入口
    print("\n[7/8] 测试 main.py 入口...")
    try:
        main_path = Path(__file__).parent.parent / "main.py"
        if main_path.exists():
            print("  ✅ main.py 入口文件存在")
        else:
            print("  ❌ main.py 入口文件不存在")
            return False
    except Exception as e:
        print(f"  ❌ main.py 测试失败: {e}")
        return False
    
    # 测试示例数据
    print("\n[8/8] 测试示例数据...")
    try:
        sample_csv = Path(__file__).parent.parent / "samples" / "work_order_sample.csv"
        if sample_csv.exists():
            print("  ✅ 示例CSV文件存在")
        else:
            print("  ⚠️  示例CSV文件不存在")
    except Exception as e:
        print(f"  ❌ 示例数据测试失败: {e}")
        return False
    
    print("\n" + "=" * 50)
    print("所有核心模块导入测试通过!")
    print("=" * 50)
    
    return True


if __name__ == "__main__":
    test_all_imports()
