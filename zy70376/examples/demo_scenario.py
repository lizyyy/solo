#!/usr/bin/env python3
"""
多租户任务隔离 CLI - 完整演示脚本
场景：大租户批量导出、小租户实时任务、失败重试
"""

import subprocess
import sys
import os
import time
from pathlib import Path


def run_cmd(cmd):
    """运行命令并输出"""
    print(f"\n{'='*60}")
    print(f"$ {cmd}")
    print('='*60)
    result = subprocess.run(
        cmd,
        shell=True,
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent.parent
    )
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    return result.returncode == 0


def main():
    print("\n" + "="*60)
    print("多租户任务隔离 CLI - 完整演示")
    print("="*60)

    project_root = Path(__file__).parent.parent
    python_path = f"PYTHONPATH={project_root}/src"

    print("\n【步骤 0】安装依赖")
    run_cmd("python3 -m pip install -q typer rich pydantic")

    print("\n【步骤 1】初始化调度器（重置状态）")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli reset")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli init")

    print("\n【步骤 2】查看初始租户配置")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli status")

    print("\n" + "="*60)
    print("场景一：大租户批量提交导出任务")
    print("="*60)

    print("\n【步骤 3】大租户 A 提交 15 个批量导出任务")
    for i in range(1, 16):
        task_id = f"export-a-{i:03d}"
        run_cmd(f"{python_path} python3 -m mt_scheduler.cli submit "
                f"{task_id} tenant-a "
                f"'月度数据导出-分区{i}' export_batch "
                f"--priority low --weight 2 --retries 2")

    print("\n【步骤 4】小租户 C 提交 5 个实时任务（高优先级）")
    for i in range(1, 6):
        task_id = f"realtime-c-{i:03d}"
        run_cmd(f"{python_path} python3 -m mt_scheduler.cli submit "
                f"{task_id} tenant-c "
                f"'实时报表查询-{i}' realtime_query "
                f"--priority high --weight 1 --retries 3")

    print("\n【步骤 5】中租户 B 提交 3 个普通任务")
    for i in range(1, 4):
        task_id = f"normal-b-{i:03d}"
        run_cmd(f"{python_path} python3 -m mt_scheduler.cli submit "
                f"{task_id} tenant-b "
                f"'数据同步-{i}' sync "
                f"--priority normal --weight 1 --retries 2")

    print("\n【步骤 6】查看提交后的状态")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli status")

    print("\n" + "="*60)
    print("场景二：首次执行调度 - 观察调度顺序")
    print("="*60)

    print("\n【步骤 7】第一次调度循环（执行 8 个任务）")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli run --max-tasks 8 --simulate 50")

    print("\n【步骤 8】查看调度后的状态")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli status")

    print("\n【步骤 9】第二次调度循环（继续执行 8 个任务）")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli run --max-tasks 8 --simulate 50")

    print("\n【步骤 10】查看状态")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli status")

    print("\n" + "="*60)
    print("场景三：失败隔离 - 小租户任务失败")
    print("="*60)

    print("\n【步骤 11】小租户 C 再提交 2 个任务，模拟失败")
    for i in range(6, 8):
        task_id = f"realtime-c-{i:03d}"
        run_cmd(f"{python_path} python3 -m mt_scheduler.cli submit "
                f"{task_id} tenant-c "
                f"'可能失败的查询-{i}' realtime_query "
                f"--priority normal --weight 1 --retries 1")

    print("\n【步骤 12】执行调度，让租户 C 的任务失败（重试耗尽）")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli run --max-tasks 5 --simulate 30 --tenant-fail tenant-c")

    print("\n【步骤 13】查看失败任务")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli failures")

    print("\n【步骤 14】再次执行，租户 C 的失败任务应该重试")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli run --max-tasks 5 --simulate 30")

    print("\n【步骤 15】查看租户配额变化（失败惩罚）")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli status")

    print("\n" + "="*60)
    print("场景四：紧急任务提升")
    print("="*60)

    print("\n【步骤 16】大租户 A 再提交一个重要任务")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli submit "
            f"urgent-a-001 tenant-a "
            "'CEO紧急报表' export_urgent "
            "--priority normal --weight 3 --retries 2")

    print("\n【步骤 17】将此任务提升为紧急优先级（留记录）")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli promote "
            f"urgent-a-001 'CEO需要立即查看季度报表'")

    print("\n【步骤 18】执行调度，观察紧急任务优先执行")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli run --max-tasks 6 --simulate 50")

    print("\n" + "="*60)
    print("场景五：幂等性测试 - 重复提交")
    print("="*60)

    print("\n【步骤 19】重复提交已存在的任务")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli submit "
            f"export-a-001 tenant-a "
            "'重复提交测试' export_batch "
            "--priority low")

    print("\n【步骤 20】提交新的任务继续执行")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli run --max-tasks 10 --simulate 30")

    print("\n【步骤 21】再次平衡配额（恢复失败惩罚）")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli rebalance")

    print("\n【步骤 22】最终状态")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli status")

    print("\n" + "="*60)
    print("场景六：生成调度报告")
    print("="*60)

    print("\n【步骤 23】生成完整调度报告")
    run_cmd(f"{python_path} python3 -m mt_scheduler.cli report")

    print("\n" + "="*60)
    print("演示完成！")
    print("="*60)
    print("\n关键观察点：")
    print("1. 调度顺序表中，小租户的任务会穿插在大租户之间")
    print("2. 高优先级任务会优先调度")
    print("3. 每个租户受自己的并发配额限制")
    print("4. 失败惩罚只影响失败租户的配额")
    print("5. 紧急任务提升有记录可查")
    print("6. 重复提交同一任务ID会被幂等处理")


if __name__ == "__main__":
    main()
