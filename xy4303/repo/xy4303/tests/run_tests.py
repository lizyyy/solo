#!/usr/bin/env python3
"""
测试运行器
运行所有单元测试
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def run_all_tests():
    """运行所有测试"""
    print("=" * 70)
    print("取模返工复核台 - 完整测试套件")
    print("=" * 70)
    
    test_passed = 0
    test_failed = 0
    
    try:
        print("\n" + "=" * 70)
        print("第1部分：数据模型层测试")
        print("=" * 70)
        from tests.test_models import main as test_models_main
        test_models_main()
        test_passed += 1
    except Exception as e:
        print(f"❌ 数据模型层测试失败: {e}")
        test_failed += 1
        import traceback
        traceback.print_exc()
    
    try:
        print("\n" + "=" * 70)
        print("第2部分：规则引擎层测试")
        print("=" * 70)
        from tests.test_rules import main as test_rules_main
        test_rules_main()
        test_passed += 1
    except Exception as e:
        print(f"❌ 规则引擎层测试失败: {e}")
        test_failed += 1
        import traceback
        traceback.print_exc()
    
    try:
        print("\n" + "=" * 70)
        print("第3部分：存储层和导出层测试")
        print("=" * 70)
        from tests.test_storage_export import main as test_storage_main
        test_storage_main()
        test_passed += 1
    except Exception as e:
        print(f"❌ 存储层和导出层测试失败: {e}")
        test_failed += 1
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 70)
    print("测试结果汇总")
    print("=" * 70)
    print(f"✅ 通过: {test_passed}")
    print(f"❌ 失败: {test_failed}")
    
    if test_failed == 0:
        print("\n🎉 所有测试通过！")
        return True
    else:
        print(f"\n⚠️ 有 {test_failed} 个测试模块失败，请检查上述错误信息")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
