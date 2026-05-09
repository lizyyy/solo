#!/usr/bin/env python3
import subprocess
import sys
import os

def run(cmd, description=""):
    if description:
        print(f"\n{'='*60}")
        print(f"  {description}")
        print(f"{'='*60}")
    print(f"$ {cmd}")
    result = subprocess.run(cmd, shell=True, text=True, capture_output=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    return result.returncode

def main():
    demo_path = os.path.dirname(os.path.abspath(__file__))
    os.chdir(demo_path)
    
    db_path = os.path.join(demo_path, "avsec.db")
    if os.path.exists(db_path):
        os.remove(db_path)
    
    run("python3 -m avsec_cli init", "初始化数据库")
    
    run(f"python3 -m avsec_cli rules import -f {os.path.join(demo_path, 'demo_data/aircraft_rules.json')}",
        "导入机型规则")
    
    run(f"python3 -m avsec_cli flights import -f {os.path.join(demo_path, 'demo_data/flight_plans.json')}",
        "导入航班计划 CA1234 (B737-800), MU5678 (A320)")
    
    run(f"python3 -m avsec_cli loading import -f {os.path.join(demo_path, 'demo_data/loading_records_abnormal.json')}",
        "【异常路径】导入有问题的装载记录：")
    
    print("""
装载记录异常点分析：
  1. 航班 CA1234 计划机型: B737-800
  2. 实际装载机型: A320 ← 机型不匹配！
  3. 经济舱餐食需 150, 实装 120 ← 缺 30 份
  4. 特殊餐 VLML 需 3, 实装 1 ← 缺 2 份
  5. 特殊餐 GFML 需 1, 实装 0 ← 完全漏装
  6. 零食需 180, 实装 150 ← 缺 30
  7. 饮品需 300, 实装 200 ← 缺 100
""")
    
    run("python3 -m avsec_cli check run", "运行核验 - 应该检测到全部异常")
    
    run("python3 -m avsec_cli check anomalies", "只看异常记录")
    
    run("python3 -m avsec_cli history show", "查看完整操作历史")
    
    run("python3 -m avsec_cli report -o abnormal_report.html", "生成异常报告")
    
    print("\n报告已生成: abnormal_report.html")

if __name__ == "__main__":
    main()
