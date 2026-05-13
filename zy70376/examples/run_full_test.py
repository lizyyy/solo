#!/usr/bin/env python3
"""
多租户任务隔离 CLI - 完整测试脚本
这个脚本会演示并验证所有核心功能
"""

import subprocess
import sys
import os
from pathlib import Path

def run_cmd(cmd, cwd):
    """运行命令并输出"""
    print(f"\n{'='*60}")
    print(f"$ {cmd}")
    print('='*60)
    result = subprocess.run(
        cmd,
        shell=True,
        capture_output=True,
        text=True,
        cwd=cwd
    )
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    return result.returncode == 0

def main():
    project_root = Path(__file__).parent.parent
    python_path = f"PYTHONPATH={project_root}/src"
    python_cmd = "python3"
    
    print("\n" + "="*60)
    print("多租户任务隔离 CLI - 完整功能测试")
    print("="*60)

    # 初始化
    print("\n【1/10】初始化调度器")
    run_cmd(f"{python_path} {python_cmd} -m mt_scheduler.cli reset", project_root)
    run_cmd(f"{python_path} {python_cmd} -m mt_scheduler.cli init", project_root)

    # 大租户批量提交
    print("\n【2/10】大租户 A 提交 10 个批量导出任务（低优先级）")
    for i in range(1, 11):
        task_id = f"export-a-{i:03d}"
        run_cmd(
            f"{python_path} {python_cmd} -m mt_scheduler.cli submit "
            f"{task_id} tenant-a '月度导出-{i}' export_batch "
            f"--priority low --weight 2 --retries 2",
            project_root
        )

    # 小租户提交高优先级任务
    print("\n【3/10】小租户 C 提交 4 个实时任务（高优先级）")
    for i in range(1, 5):
        task_id = f"realtime-c-{i:03d}"
        run_cmd(
            f"{python_path} {python_cmd} -m mt_scheduler.cli submit "
            f"{task_id} tenant-c '实时查询-{i}' realtime_query "
            f"--priority high --weight 1 --retries 3",
            project_root
        )

    # 中租户提交普通任务
    print("\n【4/10】中租户 B 提交 3 个普通任务")
    for i in range(1, 4):
        task_id = f"normal-b-{i:03d}"
        run_cmd(
            f"{python_path} {python_cmd} -m mt_scheduler.cli submit "
            f"{task_id} tenant-b '数据同步-{i}' sync "
            f"--priority normal --weight 1 --retries 2",
            project_root
        )

    # 查看状态
    print("\n【5/10】查看提交后的状态（验证队列和配额）")
    run_cmd(f"{python_path} {python_cmd} -m mt_scheduler.cli status", project_root)

    # 第一次调度
    print("\n【6/10】第一次调度（执行 8 个任务）- 观察轮询调度和优先级")
    run_cmd(
        f"{python_path} {python_cmd} -m mt_scheduler.cli run "
        f"--max-tasks 8 --simulate 30",
        project_root
    )

    # 查看调度后状态
    print("\n【7/10】查看调度后状态")
    run_cmd(f"{python_path} {python_cmd} -m mt_scheduler.cli status", project_root)

    # 幂等性测试
    print("\n【8/10】幂等性测试 - 重复提交已存在的任务")
    run_cmd(
        f"{python_path} {python_cmd} -m mt_scheduler.cli submit "
        f"export-a-001 tenant-a '重复提交测试' export_batch "
        f"--priority low",
        project_root
    )

    # 第二次调度
    print("\n【9/10】第二次调度（执行 6 个任务）")
    run_cmd(
        f"{python_path} {python_cmd} -m mt_scheduler.cli run "
        f"--max-tasks 6 --simulate 30",
        project_root
    )

    # 查看最终状态
    print("\n【10/10】查看最终状态")
    run_cmd(f"{python_path} {python_cmd} -m mt_scheduler.cli status", project_root)

    # 生成报告
    print("\n" + "="*60)
    print("生成调度报告")
    print("="*60)
    run_cmd(f"{python_path} {python_cmd} -m mt_scheduler.cli report", project_root)

    print("\n" + "="*60)
    print("测试完成！")
    print("="*60)
    print("\n验证要点：")
    print("1. 调度顺序表中，高优先级任务排在前面")
    print("2. 各租户的任务轮询执行，不会被某一个租户独占")
    print("3. 每个租户的运行任务数不超过配额")
    print("4. 重复提交同一 task_id 显示幂等保证")
    print("5. 调度报告显示公平调度指标")

if __name__ == "__main__":
    main()
