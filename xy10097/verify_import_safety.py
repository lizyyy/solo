"""验证导入安全性 - 在子进程中模拟无可用临时目录。"""

import subprocess
import sys
import tempfile


def main():
    """在子进程中运行测试代码，确保导入安全。"""
    test_code = '''
import sys
import tempfile

original_gettempdir = tempfile.gettempdir

def fail_gettempdir():
    raise FileNotFoundError('No usable temporary directory found')

tempfile.gettempdir = fail_gettempdir

try:
    print('Testing import battery_analysis...')
    import battery_analysis
    print('SUCCESS: import battery_analysis OK')
    print('Version:', getattr(battery_analysis, '__version__', 'N/A'))
    
    from battery_analysis import AnalysisConfig, BatteryConsistencyAnalyzer
    config = AnalysisConfig(log_to_file=False)
    print('SUCCESS: instantiate AnalysisConfig OK')
    
    analyzer = BatteryConsistencyAnalyzer(config)
    print('SUCCESS: instantiate BatteryConsistencyAnalyzer OK')
    
    from battery_analysis import ReportGenerator
    report_gen = ReportGenerator(config, analyzer.logger)
    print(f'SUCCESS: instantiate ReportGenerator OK')
    print(f'matplotlib_available:', report_gen.matplotlib_available)
    
    from battery_analysis import Exporter
    exporter = Exporter(config, analyzer.logger)
    print('SUCCESS: instantiate Exporter OK')
    
    print('\\nALL IMPORTS SAFE IN READONLY ENV!')
except Exception as e:
    print(f'FAILED:', type(e).__name__, str(e))
    import traceback
    traceback.print_exc()
    sys.exit(1)
'''
    
    print('=' * 70)
    print('极端只读环境安全验证 (在子进程中测试)')
    print('=' * 70)
    print()
    
    result = subprocess.run(
        [sys.executable, '-c', test_code],
        capture_output=True,
        text=True
    )
    
    print('标准输出:')
    print(result.stdout)
    if result.stderr:
        print('标准错误:')
        print(result.stderr)
    
    print()
    print('=' * 70)
    if result.returncode == 0:
        print('验证结果: 通过')
    else:
        print('验证结果: 失败')
    print('=' * 70)
    
    return result.returncode == 0


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
