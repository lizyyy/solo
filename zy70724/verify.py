#!/usr/bin/env python3
"""快速验证脚本 - 检查代码语法和基本功能"""

import sys
import os

def check_imports():
    """检查所有依赖是否可导入"""
    print("=== 检查依赖导入 ===")
    try:
        import fastapi
        print(f"✓ fastapi {fastapi.__version__}")
    except ImportError as e:
        print(f"✗ fastapi 导入失败: {e}")
        return False
    
    try:
        import uvicorn
        print(f"✓ uvicorn")
    except ImportError as e:
        print(f"✗ uvicorn 导入失败: {e}")
        return False
    
    try:
        import sqlalchemy
        print(f"✓ sqlalchemy {sqlalchemy.__version__}")
    except ImportError as e:
        print(f"✗ sqlalchemy 导入失败: {e}")
        return False
    
    try:
        import pydantic
        print(f"✓ pydantic {pydantic.__version__}")
    except ImportError as e:
        print(f"✗ pydantic 导入失败: {e}")
        return False
    
    return True

def check_main_module():
    """检查main.py是否能导入并验证基本结构"""
    print("\n=== 检查 main.py 模块 ===")
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import main
        print("✓ main.py 导入成功")
        
        # 验证关键枚举
        assert hasattr(main, 'CleanupStatus'), "缺少 CleanupStatus 枚举"
        print("✓ CleanupStatus 枚举存在")
        assert len(list(main.CleanupStatus)) == 8, f"CleanupStatus 应该有8个状态，实际有{len(list(main.CleanupStatus))}"
        print(f"✓ 包含 {len(list(main.CleanupStatus))} 个清理状态")
        
        assert hasattr(main, 'PreservationTag'), "缺少 PreservationTag 枚举"
        print("✓ PreservationTag 枚举存在")
        assert len(list(main.PreservationTag)) == 4, f"PreservationTag 应该有4个标签，实际有{len(list(main.PreservationTag))}"
        print(f"✓ 包含 {len(list(main.PreservationTag))} 个保全标签")
        
        # 验证数据库模型
        assert hasattr(main, 'SandboxCleanup'), "缺少 SandboxCleanup 模型"
        print("✓ SandboxCleanup 模型存在")
        assert hasattr(main, 'AuditLog'), "缺少 AuditLog 模型"
        print("✓ AuditLog 模型存在")
        
        # 验证FastAPI应用
        assert hasattr(main, 'app'), "缺少 FastAPI 应用实例"
        print("✓ FastAPI 应用实例存在")
        
        # 检查路由数量
        routes = [r for r in main.app.routes if hasattr(r, 'path') and r.path.startswith('/api/')]
        print(f"✓ 定义了 {len(routes)} 个 API 路由")
        
        return True
    except Exception as e:
        print(f"✗ main.py 检查失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def check_test_module():
    """检查test_main.py是否存在"""
    print("\n=== 检查 test_main.py 模块 ===")
    if os.path.exists('test_main.py'):
        print("✓ test_main.py 存在")
        with open('test_main.py', 'r') as f:
            content = f.read()
            test_count = content.count('def test_')
            class_count = content.count('class Test')
            print(f"✓ 包含 {class_count} 个测试类，{test_count} 个测试方法")
        return True
    else:
        print("✗ test_main.py 不存在")
        return False

def check_readme():
    """检查README.md是否存在"""
    print("\n=== 检查 README.md 文档 ===")
    if os.path.exists('README.md'):
        print("✓ README.md 存在")
        with open('README.md', 'r') as f:
            content = f.read()
            sections = ['快速启动', '造数脚本', 'cURL 主流程示例', '冲突路径示例', '运行 pytest 测试']
            for section in sections:
                if section in content:
                    print(f"  ✓ 包含 '{section}' 章节")
                else:
                    print(f"  ✗ 缺少 '{section}' 章节")
        return True
    else:
        print("✗ README.md 不存在")
        return False

def main():
    print("=" * 50)
    print("沙箱资源清理保全拦截 API - 验证脚本")
    print("=" * 50)
    
    all_passed = True
    all_passed &= check_imports()
    all_passed &= check_main_module()
    all_passed &= check_test_module()
    all_passed &= check_readme()
    
    print("\n" + "=" * 50)
    if all_passed:
        print("✓ 所有检查通过！")
        print("\n下一步：")
        print("  1. 启动服务: python main.py")
        print("  2. 访问文档: http://localhost:8000/docs")
        print("  3. 运行测试: pytest test_main.py -v")
    else:
        print("✗ 部分检查失败，请查看上面的错误信息")
        sys.exit(1)

if __name__ == '__main__':
    main()
