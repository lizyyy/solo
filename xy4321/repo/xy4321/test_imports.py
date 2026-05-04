#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
模块导入测试脚本
用于验证所有模块是否可以正确导入
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def test_imports():
    print("=" * 50)
    print("模块导入测试")
    print("=" * 50)
    
    errors = []
    
    print("\n1. 测试配置模块...")
    try:
        from config.settings import settings_manager, AppSettings, StorageLocation
        print("   ✓ config.settings 导入成功")
    except Exception as e:
        print(f"   ✗ config.settings 导入失败: {e}")
        errors.append(f"config.settings: {e}")
    
    print("\n2. 测试数据库模块...")
    try:
        from db.models import Base, Project, Episode, AudioFile, ValidationIssue, TaskQueue, TaskHistory
        print("   ✓ db.models 导入成功")
    except Exception as e:
        print(f"   ✗ db.models 导入失败: {e}")
        errors.append(f"db.models: {e}")
    
    try:
        from db.database import db_manager, DatabaseManager
        print("   ✓ db.database 导入成功")
    except Exception as e:
        print(f"   ✗ db.database 导入失败: {e}")
        errors.append(f"db.database: {e}")
    
    print("\n3. 测试工具模块...")
    try:
        from utils.audio_utils import (
            get_file_hash, check_ffprobe_available, run_ffprobe,
            parse_ffprobe_output, format_duration, format_file_size
        )
        print("   ✓ utils.audio_utils 导入成功")
    except Exception as e:
        print(f"   ✗ utils.audio_utils 导入失败: {e}")
        errors.append(f"utils.audio_utils: {e}")
    
    print("\n4. 测试核心模块...")
    try:
        from core.metadata_parser import metadata_parser, MetadataParser
        print("   ✓ core.metadata_parser 导入成功")
    except Exception as e:
        print(f"   ✗ core.metadata_parser 导入失败: {e}")
        errors.append(f"core.metadata_parser: {e}")
    
    try:
        from core.audio_scanner import audio_scanner, AudioScanner, ScanStatus
        print("   ✓ core.audio_scanner 导入成功")
    except Exception as e:
        print(f"   ✗ core.audio_scanner 导入失败: {e}")
        errors.append(f"core.audio_scanner: {e}")
    
    try:
        from core.validator import validation_engine, ValidationEngine, IssueType, IssueSeverity
        print("   ✓ core.validator 导入成功")
    except Exception as e:
        print(f"   ✗ core.validator 导入失败: {e}")
        errors.append(f"core.validator: {e}")
    
    try:
        from core.task_queue import task_manager, TaskManager, TaskType, TaskStatus
        print("   ✓ core.task_queue 导入成功")
    except Exception as e:
        print(f"   ✗ core.task_queue 导入失败: {e}")
        errors.append(f"core.task_queue: {e}")
    
    try:
        from core.exporter import exporter, Exporter
        print("   ✓ core.exporter 导入成功")
    except Exception as e:
        print(f"   ✗ core.exporter 导入失败: {e}")
        errors.append(f"core.exporter: {e}")
    
    print("\n5. 测试可用的外部库...")
    try:
        import PyQt6
        print("   ✓ PyQt6 可用")
    except ImportError:
        print("   ✗ PyQt6 不可用 (需要安装: pip install PyQt6)")
        errors.append("PyQt6 不可用")
    
    try:
        import mutagen
        print("   ✓ mutagen 可用")
    except ImportError:
        print("   ✗ mutagen 不可用 (需要安装: pip install mutagen)")
        errors.append("mutagen 不可用")
    
    try:
        import pydub
        print("   ✓ pydub 可用 (用于静音检测)")
    except ImportError:
        print("   - pydub 不可用 (可选，用于静音检测)")
    
    try:
        import sqlalchemy
        print("   ✓ SQLAlchemy 可用")
    except ImportError:
        print("   ✗ SQLAlchemy 不可用 (需要安装: pip install sqlalchemy)")
        errors.append("SQLAlchemy 不可用")
    
    print("\n6. 测试 ffprobe 可用性...")
    try:
        from utils.audio_utils import check_ffprobe_available
        if check_ffprobe_available():
            print("   ✓ ffprobe 可用 (音频元数据解析更准确)")
        else:
            print("   - ffprobe 不可用 (将使用 mutagen 作为后备)")
    except Exception as e:
        print(f"   ✗ 检查 ffprobe 失败: {e}")
    
    print("\n" + "=" * 50)
    if errors:
        print(f"测试完成，发现 {len(errors)} 个问题:")
        for i, error in enumerate(errors, 1):
            print(f"  {i}. {error}")
        print("\n请运行: pip install -r requirements.txt")
        return False
    else:
        print("所有核心模块导入测试通过!")
        print("")
        print("可选功能状态:")
        print("  - PyQt6: 必需 (GUI 框架)")
        print("  - mutagen: 必需 (音频元数据解析)")
        print("  - pydub: 可选 (静音检测)")
        print("  - ffprobe: 可选 (更准确的元数据解析和转码)")
        print("  - SQLAlchemy: 必需 (数据库 ORM)")
        return True


if __name__ == "__main__":
    success = test_imports()
    sys.exit(0 if success else 1)
