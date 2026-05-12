"""极端只读环境测试 - 验证导入阶段不会崩溃。

模拟无可写临时目录的场景。
"""

import sys
import tempfile
import os


def test_import_without_tempdir():
    """测试在无可用临时目录时导入是否会崩溃。"""
    print("=" * 70)
    print("极端只读环境测试")
    print("=" * 70)
    
    original_gettempdir = tempfile.gettempdir
    
    def fail_gettempdir():
        raise FileNotFoundError("No usable temporary directory found")
    
    tempfile.gettempdir = fail_gettempdir
    
    try:
        print("\n[测试 1] 模拟无可用临时目录...")
        import battery_analysis
        print("  ✓ battery_analysis 模块导入成功（无崩溃）")
        print(f"  版本: {getattr(battery_analysis, '__version__', 'N/A')}")
        
        print("\n[测试 2] 检查 ReportGenerator 是否可用...")
        from battery_analysis import ReportGenerator
        print("  ✓ ReportGenerator 类可访问")
        
        print("\n[测试 3] 尝试实例化 BatteryConsistencyAnalyzer...")
        from battery_analysis import AnalysisConfig, BatteryConsistencyAnalyzer
        config = AnalysisConfig(log_to_file=False)
        analyzer = BatteryConsistencyAnalyzer(config)
        print("  ✓ BatteryConsistencyAnalyzer 实例化成功")
        
        print("\n[测试 4] 尝试实例化 ReportGenerator...")
        report_gen = ReportGenerator(config, analyzer.logger)
        print(f"  ✓ ReportGenerator 实例化成功")
        print(f"    matplotlib 可用: {report_gen.matplotlib_available}")
        
        print("\n" + "=" * 70)
        print("极端只读环境测试: 通过")
        print("=" * 70)
        print("\n关键验证点:")
        print("  ✓ 无可用临时目录时导入不崩溃")
        print("  ✓ 所有核心类可正常使用")
        print("  ✓ ReportGenerator 优雅降级")
        return True
        
    except Exception as e:
        print(f"\n  ✗ 失败: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        tempfile.gettempdir = original_gettempdir


if __name__ == "__main__":
    success = test_import_without_tempdir()
    sys.exit(0 if success else 1)
