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
        print("已清理旧数据库")
    
    run("python3 -m avsec_cli init", "步骤 1: 初始化数据库")
    
    run(f"python3 -m avsec_cli rules import -f {os.path.join(demo_path, 'demo_data/aircraft_rules.json')}",
        "步骤 2: 导入机型装载规则")
    
    run("python3 -m avsec_cli rules list", "查看已导入的机型规则")
    
    run(f"python3 -m avsec_cli flights import -f {os.path.join(demo_path, 'demo_data/flight_plans.json')}",
        "步骤 3: 导入航班计划（含特殊餐需求）")
    
    run("python3 -m avsec_cli flights list", "查看已导入的航班计划")
    
    run(f"python3 -m avsec_cli loading import -f {os.path.join(demo_path, 'demo_data/loading_records_correct.json')}",
        "步骤 4: 导入正确的装载记录")
    
    run("python3 -m avsec_cli loading list", "查看装载记录")
    
    run("python3 -m avsec_cli check run", "步骤 5: 运行全量核验（首次检查应该全部通过）")
    
    run("python3 -m avsec_cli history show -n 10", "查看操作历史记录")
    
    run("python3 -m avsec_cli flights change-aircraft -fn CA1234 -na B787-9",
        "步骤 6: 模拟换机：CA1234 从 B737-800 换成 B787-9")
    
    run("python3 -m avsec_cli flights list", "再次查看航班计划（注意原机型字段）")
    
    run("python3 -m avsec_cli check run -fn CA1234", "步骤 7: 重新核验 CA1234（换机后应该出现大量异常）")
    
    run("python3 -m avsec_cli check anomalies", "查看所有异常记录")
    
    run("python3 -m avsec_cli report -o demo_report.html", "步骤 8: 生成给业务负责人看的HTML报告")
    
    print("\n" + "="*60)
    print("  演示完成！")
    print("="*60)
    print("\n异常路径演示（可选）:")
    print("  1. 直接运行: python3 run_abnormal_demo.py")
    print("     或手动导入异常装载数据:")
    print(f"  2. python3 -m avsec_cli loading import -f {os.path.join(demo_path, 'demo_data/loading_records_abnormal.json')}")
    print("  3. python3 -m avsec_cli check run -fn CA1234")
    print("\n报告文件位置: demo_report.html")

if __name__ == "__main__":
    main()
