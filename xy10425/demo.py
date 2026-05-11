#!/usr/bin/env python3
"""
食堂菜品留样管理系统 - 演示脚本

运行方式:
    python demo.py

这个脚本将演示系统的所有主要功能:
1. 导入菜单
2. 登记留样 (包含一些故意制造的问题用于演示)
3. 标记漏留
4. 确认销毁
5. 查看合规情况
6. 查看提醒
7. 查看责任人统计
8. 导出报告
"""

import os
import shutil
import subprocess
import sys
from datetime import datetime, timedelta


def run_command(cmd):
    """运行命令并打印输出"""
    print(f"\n{'='*80}")
    print(f"执行命令: {cmd}")
    print('='*80)
    result = subprocess.run(
        cmd,
        shell=True,
        capture_output=True,
        text=True,
        cwd=os.path.dirname(os.path.abspath(__file__))
    )
    print(result.stdout)
    if result.stderr:
        print("错误:", result.stderr)
    return result


def main():
    # 清理旧数据
    print("\n=== 清理旧数据 ===")
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
    reports_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reports')

    if os.path.exists(data_dir):
        shutil.rmtree(data_dir)
    if os.path.exists(reports_dir):
        shutil.rmtree(reports_dir)

    today = datetime.now().strftime("%Y-%m-%d")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

    print(f"\n=== 食堂菜品留样管理系统演示 ===")
    print(f"当前日期: {today}")

    # 1. 查看帮助信息
    run_command("python3 cli.py --help")

    # 2. 导入今天的菜单
    print("\n" + "#"*80)
    print("## 1. 导入今天的菜单")
    print("#"*80)
    run_command("python3 cli.py import-menu sample_menu.json")

    # 3. 列出今天的菜单
    print("\n" + "#"*80)
    print("## 2. 列出今天的菜单")
    print("#"*80)
    run_command("python3 cli.py list-menu")

    # 4. 登记一些留样
    print("\n" + "#"*80)
    print("## 3. 登记留样 (DISH001 红烧肉 - 合规)")
    print("#"*80)
    run_command(
        "python3 cli.py register "
        "--menu-item-id DISH001 "
        "--weight 150 "
        "--container-id C001 "
        "--fridge-location 冰箱1-第2层 "
        "--operator 张厨师 "
        "--destruction-hours 48"
    )

    print("\n" + "#"*80)
    print("## 4. 登记留样 (DISH002 清炒时蔬 - 重量不足)")
    print("#"*80)
    run_command(
        "python3 cli.py register "
        "--menu-item-id DISH002 "
        "--weight 50 "
        "--container-id C002 "
        "--fridge-location 冰箱1-第2层 "
        "--operator 李厨师 "
        "--destruction-hours 48"
    )

    print("\n" + "#"*80)
    print("## 5. 登记留样 (DISH004 宫保鸡丁 - 合规)")
    print("#"*80)
    run_command(
        "python3 cli.py register "
        "--menu-item-id DISH004 "
        "--weight 180 "
        "--container-id C004 "
        "--fridge-location 冰箱2-第1层 "
        "--operator 王厨师 "
        "--destruction-hours 48"
    )

    # 5. 查看所有留样记录
    print("\n" + "#"*80)
    print("## 6. 查看所有留样记录")
    print("#"*80)
    run_command("python3 cli.py list-reservations")

    # 6. 查看今日合规情况
    print("\n" + "#"*80)
    print("## 7. 查看今日合规情况 (应该会有问题)")
    print("#"*80)
    run_command("python3 cli.py status")

    # 7. 标记一个漏留菜品
    print("\n" + "#"*80)
    print("## 8. 标记漏留菜品 (DISH003 番茄炒蛋)")
    print("#"*80)
    run_command(
        "python3 cli.py mark-missed "
        "--menu-item-id DISH003 "
        "--reason 临时更换菜品，未留样 "
        "--operator 张厨师"
    )

    # 8. 再次查看合规情况
    print("\n" + "#"*80)
    print("## 9. 再次查看今日合规情况")
    print("#"*80)
    run_command("python3 cli.py status")

    # 9. 查看责任人统计
    print("\n" + "#"*80)
    print("## 10. 查看责任人统计")
    print("#"*80)
    run_command("python3 cli.py statistics")

    # 10. 查看待销毁提醒
    print("\n" + "#"*80)
    print("## 11. 查看未来48小时内的待销毁提醒")
    print("#"*80)
    run_command("python3 cli.py reminders --hours 48")

    # 11. 导出报告
    print("\n" + "#"*80)
    print("## 12. 导出检查报告")
    print("#"*80)
    run_command("python3 cli.py export-report")

    # 12. 演示重复导入菜单不会覆盖已确认的留样
    print("\n" + "#"*80)
    print("## 13. 演示: 重复导入菜单不会覆盖已确认的留样")
    print("#"*80)

    # 首先标记一个留样为已销毁
    print("  - 先将DISH001的留样标记为已销毁")
    result = subprocess.run(
        "python3 cli.py list-reservations",
        shell=True,
        capture_output=True,
        text=True,
        cwd=os.path.dirname(os.path.abspath(__file__))
    )

    # 从输出中提取DISH001的留样ID
    reservation_id = None
    lines = result.stdout.split('\n')
    for i, line in enumerate(lines):
        if '红烧肉' in line:
            # 往前找ID行
            for j in range(i, max(0, i-10), -1):
                if 'ID: RES-' in lines[j]:
                    reservation_id = lines[j].split('ID: ')[1].strip()
                    break
            break

    if reservation_id:
        run_command(
            f"python3 cli.py destroy "
            f"--reservation-id {reservation_id} "
            f"--operator 张厨师"
        )

    print("\n  - 再次导入菜单")
    run_command("python3 cli.py import-menu sample_menu.json")

    print("\n  - 查看留样记录，已销毁的应该还在")
    run_command("python3 cli.py list-reservations --status destroyed")

    print("\n" + "="*80)
    print("演示完成！")
    print("="*80)
    print("\n系统已创建以下文件:")
    print(f"  - 数据文件: {data_dir}/{today}.json")
    print(f"  - 报告文件: {reports_dir}/{today}_report.csv")
    print("\n您可以使用以下命令继续探索:")
    print("  python3 cli.py --help          查看所有命令")
    print("  python3 cli.py list-menu       查看今天的菜单")
    print("  python3 cli.py status          查看今日合规情况")
    print("  python3 cli.py reminders       查看待销毁提醒")
    print("  python3 cli.py statistics      查看责任人统计")


if __name__ == '__main__':
    main()
