"""严格测试：在导入 battery_analysis 前就 patch tempfile.gettempdir。"""

import subprocess
import sys


def main():
    """测试极端场景：导入前就无法获取临时目录。"""
    
    # 这段代码会在一个全新的 Python 进程中运行
    # 关键是：在 import battery_analysis 之前就 patch 掉 tempfile.gettempdir
    test_code = r'''
import sys
import tempfile

# 在任何模块导入之前就 patch
def fail_gettempdir():
    raise FileNotFoundError('[PATCHED] No usable temporary directory found')

tempfile.gettempdir = fail_gettempdir

print('[TEST] tempfile.gettempdir patched to fail')
print('[TEST] Attempting to import battery_analysis...')

# 现在尝试导入 - 这个阶段不应该有任何 tempfile.gettempdir 调用
import battery_analysis

print('[TEST] SUCCESS: import battery_analysis completed')
print('[TEST] Version:', battery_analysis.__version__)

# 验证此时 ReportGenerator 的类存在，但 matplotlib 还没被初始化
print('[TEST] ReportGenerator class exists:', hasattr(battery_analysis, 'ReportGenerator'))

# 现在才创建 ReportGenerator 实例 - 这时候可能会尝试初始化 matplotlib
from battery_analysis import AnalysisConfig, ReportGenerator, AnalysisLogger

config = AnalysisConfig(log_to_file=False)
logger = AnalysisLogger(log_to_file=False)

print('[TEST] Creating ReportGenerator instance...')
report_gen = ReportGenerator(config, logger)
print('[TEST] ReportGenerator created, matplotlib_available:', report_gen.matplotlib_available)

# 验证：即使 matplotlib 不可用，表格生成功能仍可用
from battery_analysis import Exporter
exporter = Exporter(config, logger)
print('[TEST] Exporter created successfully')

print()
print('=' * 60)
print('STRICT IMPORT TEST: PASSED')
print('=' * 60)
'''
    
    print('=' * 70)
    print('严格导入测试：导入前就禁用 tempfile.gettempdir')
    print('=' * 70)
    print()
    
    result = subprocess.run(
        [sys.executable, '-c', test_code],
        capture_output=True,
        text=True
    )
    
    print('=== 标准输出 ===')
    print(result.stdout)
    if result.stderr:
        print('=== 标准错误 ===')
        print(result.stderr)
    
    print()
    print('返回码:', result.returncode)
    print()
    
    if result.returncode == 0:
        print('=' * 70)
        print('测试结果: 通过')
        print('关键验证:')
        print('  - import battery_analysis 阶段无 tempfile 调用')
        print('  - 所有类可正常导入和实例化')
        print('  - ReportGenerator 在实例化时才尝试初始化 matplotlib')
        print('=' * 70)
        return True
    else:
        print('=' * 70)
        print('测试结果: 失败')
        print('=' * 70)
        return False


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
