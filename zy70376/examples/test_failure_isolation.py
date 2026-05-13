#!/usr/bin/env python3
"""
测试失败隔离路径
"""

import subprocess
import sys
from pathlib import Path

def run_cmd(cmd, cwd):
    print(f"\n{'='*60}")
    print(f"$ {cmd}")
    print('='*60)
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
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
    print("测试失败隔离路径")
    print("="*60)

    # 初始化
    print("\n【1/6】初始化调度器")
    run_cmd(f"{python_path} {python_cmd} -m mt_scheduler.cli reset", project_root)
    run_cmd(f"{python_path} {python_cmd} -m mt_scheduler.cli init", project_root)

    # 提交会失败的任务
    print("\n【2/6】提交会失败的任务（retries=1，即总共2次机会）")
    run_cmd(
        f"{python_path} {python_cmd} -m mt_scheduler.cli submit "
        f"failtest-c-001 tenant-c '失败测试-1' realtime_query "
        f"--priority normal --weight 1 --retries 1",
        project_root
    )
    
    # 提交另一个会失败的任务
    run_cmd(
        f"{python_path} {python_cmd} -m mt_scheduler.cli submit "
        f"failtest-c-002 tenant-c '失败测试-2' realtime_query "
        f"--priority normal --weight 1 --retries 1",
        project_root
    )

    # 同时提交大租户的任务
    print("\n【3/6】同时提交大租户 A 的任务（验证失败隔离）")
    run_cmd(
        f"{python_path} {python_cmd} -m mt_scheduler.cli submit "
        f"other-a-001 tenant-a '其他租户任务' export "
        f"--priority normal --weight 2",
        project_root
    )
    run_cmd(
        f"{python_path} {python_cmd} -m mt_scheduler.cli submit "
        f"other-a-002 tenant-a '其他租户任务' export "
        f"--priority normal --weight 2",
        project_root
    )

    # 查看初始状态
    print("\n【4/6】查看初始状态")
    run_cmd(f"{python_path} {python_cmd} -m mt_scheduler.cli status", project_root)

    # 第一次执行 - 让租户 C 的任务失败并重试
    print("\n【5/6】第一次执行 - 让租户 C 的任务失败（会重试）")
    run_cmd(
        f"{python_path} {python_cmd} -m mt_scheduler.cli run "
        f"--max-tasks 4 --simulate 10 --tenant-fail tenant-c",
        project_root
    )

    # 查看状态
    print("\n查看状态 - 任务应仍在 PENDING，retry_count=1")
    run_cmd(f"{python_path} {python_cmd} -m mt_scheduler.cli status", project_root)

    # 第二次执行 - 耗尽重试次数
    print("\n【6/6】第二次执行 - 耗尽重试次数，触发失败惩罚")
    run_cmd(
        f"{python_path} {python_cmd} -m mt_scheduler.cli run "
        f"--max-tasks 4 --simulate 10 --tenant-fail tenant-c",
        project_root
    )

    # 查看最终状态
    print("\n查看最终状态 - 租户 C 配额应减少 30%")
    run_cmd(f"{python_path} {python_cmd} -m mt_scheduler.cli status", project_root)

    # 查看失败任务
    print("\n查看失败任务列表")
    run_cmd(f"{python_path} {python_cmd} -m mt_scheduler.cli failures", project_root)

    # 验证大租户不受影响
    print("\n验证失败隔离 - 执行大租户任务")
    run_cmd(
        f"{python_path} {python_cmd} -m mt_scheduler.cli run "
        f"--max-tasks 2 --simulate 20",
        project_root
    )

    print("\n查看大租户执行结果（应正常完成）")
    run_cmd(f"{python_path} {python_cmd} -m mt_scheduler.cli status", project_root)

    # 生成报告
    print("\n" + "="*60)
    print("生成调度报告")
    print("="*60)
    run_cmd(f"{python_path} {python_cmd} -m mt_scheduler.cli report", project_root)

    print("\n" + "="*60)
    print("失败隔离测试完成！")
    print("="*60)
    print("\n验证要点：")
    print("1. 租户 C 的任务失败后，quota_reduction_percent 变为 30%")
    print("2. 租户 C 的有效配额从 2 变为 1 (2 * (1-30%) = 1.4 → 取整1)")
    print("3. 大租户 A 的任务正常执行，不受租户 C 失败影响")
    print("4. 失败隔离生效：只惩罚失败的租户")

if __name__ == "__main__":
    main()
