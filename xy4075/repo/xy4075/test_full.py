#!/usr/bin/env python3
"""临时目录验证脚本 - 完整测试串口协议回放诊断台的所有CLI命令"""

import os
import sys
import tempfile
import shutil
import subprocess
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))


def run_command(cmd, cwd=None):
    """运行命令并返回结果"""
    print(f"运行: {cmd}")
    result = subprocess.run(
        cmd,
        shell=True,
        cwd=cwd,
        capture_output=True,
        text=True,
        env={**os.environ, 'PYTHONPATH': os.path.join(os.path.dirname(__file__), 'src')}
    )
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(f"STDERR: {result.stderr}")
    print(f"返回码: {result.returncode}")
    print("-" * 60)
    return result


def main():
    """主函数"""
    print("=" * 70)
    print("串口协议回放诊断台 - 临时目录完整验证流程")
    print("=" * 70)
    print()
    
    # 创建临时目录
    temp_dir = tempfile.mkdtemp(prefix="serial_diag_test_")
    print(f"临时目录: {temp_dir}")
    print()
    
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        examples_dir = os.path.join(script_dir, 'examples')
        
        # 步骤1: 初始化配置
        print("步骤1: 初始化协议配置")
        print("-" * 60)
        config_path = os.path.join(temp_dir, 'my_config.yaml')
        cmd = f"python3 -m serial_diagnostic.cli init {config_path} --protocol modbus_rtu --baud-rate 19200 --timeout 500"
        result = run_command(cmd)
        if result.returncode != 0:
            print("命令失败!")
            return 1
        
        # 检查配置文件是否创建
        if os.path.exists(config_path):
            print(f"配置文件已创建: {config_path}")
            with open(config_path, 'r') as f:
                content = f.read()
                print(f"配置文件内容预览:\n{content[:500]}")
        else:
            print("错误: 配置文件未创建")
            return 1
        print()
        
        # 步骤2: 复制示例日志
        print("步骤2: 准备测试数据")
        print("-" * 60)
        test_log = os.path.join(temp_dir, 'test_log.txt')
        example_log = os.path.join(examples_dir, 'normal_log.txt')
        if os.path.exists(example_log):
            shutil.copy(example_log, test_log)
            print(f"已复制示例日志到: {test_log}")
        else:
            # 创建测试日志
            print("创建测试日志...")
            log_content = """2026-05-02 10:00:00.100 T 01 03 00 00 00 02 C4 0B
2026-05-02 10:00:00.150 R 01 03 04 00 01 00 02 79 79
2026-05-02 10:00:00.200 T 01 03 00 0A 00 01 A4 08
2026-05-02 10:00:00.230 R 01 03 02 00 01 79 79
2026-05-02 10:00:00.300 T 02 03 00 64 00 02 E5 EC
2026-05-02 10:00:00.350 R 02 03 04 01 90 02 58 65 4F
"""
            with open(test_log, 'w') as f:
                f.write(log_content)
        print()
        
        # 步骤3: 导入日志
        print("步骤3: 导入并解析日志")
        print("-" * 60)
        cmd = f"python3 -m serial_diagnostic.cli import-log {test_log} --config {config_path} -v"
        result = run_command(cmd)
        if result.returncode != 0:
            print("命令失败!")
            return 1
        print()
        
        # 步骤4: 分析日志
        print("步骤4: 分析日志异常")
        print("-" * 60)
        analysis_output = os.path.join(temp_dir, 'analysis_result')
        cmd = f"python3 -m serial_diagnostic.cli analyze --log {test_log} --config {config_path} --output {analysis_output} -v"
        result = run_command(cmd)
        if result.returncode != 0:
            print("命令失败!")
            return 1
        
        # 检查输出文件
        expected_files = [
            f"{analysis_output}.json",
            f"{analysis_output}.csv",
            f"{analysis_output}.md"
        ]
        for f in expected_files:
            if os.path.exists(f):
                print(f"输出文件已创建: {f}")
            else:
                print(f"警告: 输出文件未找到: {f}")
        print()
        
        # 步骤5: 测试带错误的日志分析
        print("步骤5: 测试错误日志分析")
        print("-" * 60)
        error_log = os.path.join(temp_dir, 'error_log.txt')
        example_error_log = os.path.join(examples_dir, 'error_log.txt')
        if os.path.exists(example_error_log):
            shutil.copy(example_error_log, error_log)
        else:
            # 创建包含错误的日志
            error_content = """2026-05-02 10:00:00.100 T 01 03 00 00 00 02 C4 0B
2026-05-02 10:00:03.000 R 01 03 04 00 01 00 02 79 79
2026-05-02 10:00:03.100 T 01 03 00 0A 00 01 A4 08
2026-05-02 10:00:03.130 R 01 03 02 00 01 79 79
2026-05-02 10:00:03.130 R 01 03 02 00 01 79 79
"""
            with open(error_log, 'w') as f:
                f.write(error_content)
        
        error_analysis = os.path.join(temp_dir, 'error_analysis')
        cmd = f"python3 -m serial_diagnostic.cli analyze --log {error_log} --config {config_path} --output {error_analysis} -v --timeout 1000"
        result = run_command(cmd)
        if result.returncode != 0:
            print("命令失败!")
            return 1
        print()
        
        # 步骤6: 导出报告
        print("步骤6: 导出报告")
        print("-" * 60)
        report_output = os.path.join(temp_dir, 'final_report')
        
        # 使用之前的分析结果导出
        json_analysis = f"{error_analysis}.json"
        if os.path.exists(json_analysis):
            cmd = f"python3 -m serial_diagnostic.cli export {report_output} --analysis {json_analysis} --config {config_path} --format all"
            result = run_command(cmd)
            if result.returncode != 0:
                print("命令失败!")
                return 1
        
        # 检查输出
        for ext in ['.md', '.csv', '.json']:
            path = report_output + ext
            if os.path.exists(path):
                print(f"导出文件: {path}")
                if ext == '.md':
                    with open(path, 'r') as f:
                        content = f.read()
                        print(f"Markdown报告预览 (前200字符):")
                        print(content[:200])
        print()
        
        # 验证总结
        print("=" * 70)
        print("验证总结")
        print("=" * 70)
        print()
        print("临时目录内容:")
        for f in sorted(os.listdir(temp_dir)):
            fpath = os.path.join(temp_dir, f)
            size = os.path.getsize(fpath)
            print(f"  - {f} ({size} 字节)")
        print()
        print("所有CLI命令测试通过!")
        print()
        
        # 显示帮助信息
        print("CLI帮助信息:")
        print("-" * 60)
        cmd = "python3 -m serial_diagnostic.cli --help"
        run_command(cmd)
        
        return 0
        
    finally:
        # 清理临时目录
        print()
        print("=" * 70)
        print(f"清理临时目录: {temp_dir}")
        print("=" * 70)
        
        # 询问用户是否删除
        try:
            response = input("是否删除临时目录? (y/n): ").strip().lower()
            if response == 'y':
                shutil.rmtree(temp_dir)
                print("临时目录已删除")
            else:
                print(f"临时目录保留: {temp_dir}")
        except Exception:
            print(f"临时目录保留: {temp_dir}")


if __name__ == '__main__':
    sys.exit(main())
