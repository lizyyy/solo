#!/usr/bin/env python3
import subprocess
import sys
import os

def run_cmd(cmd, description):
    print(f"\n{'='*60}")
    print(f"▶  {description}")
    print(f"命令: {cmd}")
    print('-' * 60)
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    return result.returncode

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    if os.path.exists('api_alerts.db'):
        os.remove('api_alerts.db')
    
    steps = [
        ("python3 cli.py init", "1. 初始化数据库"),
        ("python3 cli.py summary", "2. 查看初始数据概览"),
        ("python3 cli.py import test_data/permissions_normal.csv --type permission --operator test_user", 
         "3. 导入正常权限表"),
        ("python3 cli.py import test_data/migrations_missing.csv --type migration --operator test_user", 
         "4. 导入缺失的迁移清单（部分数据场景）"),
        ("python3 cli.py import test_data/alerts_with_duplicates.csv --type alert --operator test_user", 
         "5. 导入含重复记录的预警数据"),
        ("python3 cli.py sessions", "6. 查看所有导入会话"),
        ("python3 cli.py session 3", "7. 查看预警导入会话详情"),
        ("python3 cli.py audit --session-id 3", "8. 查看预警导入的审计日志（含重复跳过记录）"),
        ("python3 cli.py anomalies", "9. 异常检测（应检出无权限匹配的预警）"),
        ("python3 cli.py summary", "10. 查看导入后的数据概览"),
        ("python3 cli.py export --type alert_report --output /tmp/alert_report.csv", 
         "11. 导出关联权限+迁移的完整预警报告"),
        ("cat /tmp/alert_report.csv", "12. 查看导出的预警报告内容"),
        ("python3 cli.py history alert 1", "13. 查看单条预警记录的完整历史"),
    ]
    
    success = 0
    for cmd, desc in steps:
        rc = run_cmd(cmd, desc)
        if rc == 0:
            success += 1
    
    print(f"\n{'='*60}")
    print(f"测试完成: {success}/{len(steps)} 步骤成功")
    print("="*60)
    
    print("\n" + "="*60)
    print("▶  额外验证：撤回功能测试")
    print("="*60)
    
    print("\n>>> 撤回权限导入会话...")
    subprocess.run("python3 cli.py rollback 1 --operator admin --reason '测试撤回功能'", 
                   shell=True, capture_output=True, text=True)
    
    print("\n>>> 撤回后查看会话列表...")
    result = subprocess.run("python3 cli.py sessions", shell=True, capture_output=True, text=True)
    print(result.stdout)
    
    print("\n>>> 撤回后再次导出预警报告...")
    subprocess.run("python3 cli.py export --type alert_report --output /tmp/alert_report_after_rollback.csv", 
                   shell=True, capture_output=True, text=True)
    
    print("\n>>> 撤回后的数据概览...")
    result = subprocess.run("python3 cli.py summary", shell=True, capture_output=True, text=True)
    print(result.stdout)
    
    print("\n" + "="*60)
    print("测试全部完成！")
    print("="*60)

if __name__ == '__main__':
    main()
