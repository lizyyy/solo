#!/usr/bin/env python3
"""
异常交易规则蒸馏评测工具 - 演示脚本
"""
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent
CLI = f"{sys.executable} {BASE_DIR / 'cli.py'}"

def run_cmd(cmd, desc):
    print(f"\n{'='*60}")
    print(f"▶ {desc}")
    print(f"$ {cmd}")
    print('-'*60)
    result = subprocess.run(cmd, shell=True, cwd=BASE_DIR, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    return result

def main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║           异常交易规则蒸馏评测工具 - 演示流程                 ║
╚══════════════════════════════════════════════════════════════╝
""")
    
    # 1. 初始化数据库
    run_cmd(f"{CLI} init", "初始化数据库")
    
    # 2. 导入样本数据
    run_cmd(f"{CLI} import-data samples examples/samples.json", "导入样本数据")
    
    # 3. 导入阈值配置
    run_cmd(f"{CLI} import-data thresholds examples/thresholds.json", "导入阈值配置")
    
    # 4. 导入v1版本模型输出
    run_cmd(f"{CLI} import-data model-outputs examples/model_outputs_v1.json v1.0 --description '基线版本'", "导入v1.0模型输出")
    
    # 5. 蒸馏v1版本规则
    run_cmd(f"{CLI} distill v1.0", "蒸馏v1.0版本规则")
    
    # 6. 查看蒸馏规则列表
    run_cmd(f"{CLI} list-data rules --model-version v1.0", "查看v1.0蒸馏规则列表")
    
    # 7. 生成v1版本报告
    result = run_cmd(f"{CLI} report v1.0 --report-name 'v1.0版本评测报告' --created-by '小孟'", "生成v1.0版本报告")
    
    # 8. 导入v2版本模型输出
    run_cmd(f"{CLI} import-data model-outputs examples/model_outputs_v2.json v2.0 --description '优化版本'", "导入v2.0模型输出")
    
    # 9. 蒸馏v2版本规则
    run_cmd(f"{CLI} distill v2.0", "蒸馏v2.0版本规则")
    
    # 10. 版本对比
    run_cmd(f"{CLI} compare v1.0 v2.0", "对比v1.0与v2.0版本差异")
    
    # 11. 查看所有版本
    run_cmd(f"{CLI} list-data versions", "查看所有模型版本")
    
    # 12. 查看所有报告
    run_cmd(f"{CLI} list-data reports", "查看所有报告")
    
    print("""
╔══════════════════════════════════════════════════════════════╗
║                    演示流程完成！                             ║
║                                                              ║
║  接下来您可以尝试：                                          ║
║  1. python cli.py list-data rules 查看规则列表               ║
║  2. python cli.py trace <规则ID> 查看规则溯源                ║
║  3. python cli.py review <规则ID> 小孟 通过 进行复核         ║
║  4. python cli.py add-note <规则ID> "备注内容" --created-by 小孟 ║
╚══════════════════════════════════════════════════════════════╝
""")

if __name__ == '__main__':
    main()
