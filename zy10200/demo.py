#!/usr/bin/env python3
"""演示脚本：夜市摊位燃气瓶巡检 CLI 完整使用流程"""

import subprocess
import sys
import os

def run_cmd(cmd, env=None):
    """运行命令并打印输出"""
    print(f"\n{'='*60}")
    print(f"执行命令: {cmd}")
    print(f"{'='*60}\n")
    
    full_env = os.environ.copy()
    if env:
        full_env.update(env)
    
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding='utf-8', env=full_env)
    
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr)
    
    return result.returncode

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    cli_script = os.path.join(script_dir, 'gas_checker.py')
    demo_data = os.path.join(script_dir, 'demo_records.json')
    data_dir = os.path.join(script_dir, 'data')
    
    env = {'GAS_CHECKER_DATA_DIR': data_dir}
    
    print("""
╔══════════════════════════════════════════════════════════════╗
║         夜市摊位燃气瓶巡检 CLI 演示流程                       ║
║                从导入到日报导出                              ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    # 1. 初始化
    run_cmd(f'python3 {cli_script} init', env)
    
    # 2. 导入数据
    run_cmd(f'python3 {cli_script} import --file {demo_data}', env)
    
    # 3. 再次导入相同数据（演示去重）
    print("\n" + "="*60)
    print("再次导入相同数据（演示去重功能）")
    print("="*60)
    run_cmd(f'python3 {cli_script} import --file {demo_data}', env)
    
    # 4. 校验记录状态
    run_cmd(f'python3 {cli_script} validate', env)
    
    # 5. 查询待整改记录
    run_cmd(f'python3 {cli_script} history --status 待整改', env)
    
    # 6. 查询指定摊位的历史记录（演示同一摊位重复巡检）
    run_cmd(f'python3 {cli_script} history --stall A01', env)
    
    # 7. 导出日报
    report_path = os.path.join(script_dir, 'daily_report.md')
    run_cmd(f'python3 {cli_script} export --date 2026-05-11 --output {report_path}', env)
    
    print("\n" + "="*60)
    print("✅ 演示流程完成！")
    print(f"📄 日报已生成: {report_path}")
    print("="*60)
    
    # 显示日报内容
    print("\n📋 日报内容预览:\n")
    with open(report_path, 'r', encoding='utf-8') as f:
        print(f.read())

if __name__ == "__main__":
    main()
