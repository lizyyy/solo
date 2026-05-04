#!/usr/bin/env python3
import unittest
import sys
import os

def main():
    print("=" * 60)
    print("运行优化算法实验台测试")
    print("=" * 60)
    print()
    
    test_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tests')
    
    loader = unittest.TestLoader()
    suite = loader.discover(test_dir, pattern='test_*.py')
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    print()
    print("=" * 60)
    print("测试结果摘要")
    print("=" * 60)
    print(f"运行测试: {result.testsRun}")
    print(f"成功: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失败: {len(result.failures)}")
    print(f"错误: {len(result.errors)}")
    
    if result.failures:
        print()
        print("失败的测试:")
        for test, traceback in result.failures:
            print(f"  - {test}")
    
    if result.errors:
        print()
        print("错误的测试:")
        for test, traceback in result.errors:
            print(f"  - {test}")
    
    print("=" * 60)
    
    return len(result.failures) + len(result.errors)

if __name__ == '__main__':
    sys.exit(main())
