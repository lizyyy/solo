#!/usr/bin/env python3
"""呼叫中心质检抽样 CLI 演示脚本"""

import subprocess
import sys
import os
import random

DB_FILE = "demo_qc.db"
os.environ["QC_DB_PATH"] = DB_FILE

SAMPLE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_data")

random.seed(42)


def run_cmd(cmd, capture=False):
    full_cmd = f"{sys.executable} -m quality_sampling.cli {cmd}"
    print(f"\n>>> 执行: qc-sampling {cmd}")
    print("-" * 60)
    if capture:
        result = subprocess.run(full_cmd, shell=True, capture_output=True, text=True)
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        return result
    else:
        subprocess.run(full_cmd, shell=True)
        return None


def main():
    if os.path.exists(DB_FILE):
        os.remove(DB_FILE)

    print("=" * 70)
    print("呼叫中心质检抽样 CLI - 完整演示")
    print("=" * 70)

    print("\n" + "=" * 70)
    print("步骤 1: 导入基础数据")
    print("=" * 70)

    run_cmd(f'import-data agents {os.path.join(SAMPLE_DIR, "agents.csv")}')
    run_cmd(f'import-data inspectors {os.path.join(SAMPLE_DIR, "inspectors.csv")}')
    run_cmd(f'import-data calls {os.path.join(SAMPLE_DIR, "calls_batch1.csv")}')

    print("\n" + "=" * 70)
    print("步骤 2: 查看统计概览")
    print("=" * 70)
    run_cmd("stats")

    print("\n" + "=" * 70)
    print("步骤 3: 查看坐席列表（按风险分排序）")
    print("=" * 70)
    run_cmd("agents --sort-by-risk")

    print("\n" + "=" * 70)
    print("步骤 4: 第 1 轮抽样 - 5 条（展示风险加权效果）")
    print("说明：投诉通话(权重x5)、高风险坐席(权重x3)、低分坐席(权重x2.5)")
    print("=" * 70)
    run_cmd("sample --count 5")

    print("\n" + "=" * 70)
    print("步骤 5: 查看抽样任务列表")
    print("=" * 70)
    result = run_cmd("view-tasks", capture=True)
    lines = result.stdout.strip().split("\n")
    task_ids = []
    for line in lines:
        for part in line.split():
            if part.startswith("QC-"):
                task_ids.append(part)
                break
    print(result.stdout)

    task_ids = list(dict.fromkeys([t for t in task_ids if t.startswith("QC-")]))
    print(f"\n捕获到任务ID: {task_ids}")

    if task_ids:
        print("\n" + "=" * 70)
        print(f"步骤 6: 查看任务 {task_ids[0]} 的抽样原因详情")
        print("=" * 70)
        run_cmd(f"view-tasks --task-id {task_ids[0]}")

    print("\n" + "=" * 70)
    print("步骤 7: 录入质检结果（模拟质检过程）")
    print("=" * 70)
    if len(task_ids) >= 3:
        print(f"\n>>> 录入任务 {task_ids[0]}: 85分，通过")
        run_cmd(f'record-result {task_ids[0]} --score 85 --result pass --notes "服务规范，沟通顺畅"')

        print(f"\n>>> 录入任务 {task_ids[1]}: 45分，不通过（模拟低分）")
        run_cmd(f'record-result {task_ids[1]} --score 45 --result fail --notes "态度生硬，未按流程处理客户投诉"')

        print(f"\n>>> 录入任务 {task_ids[2]}: 92分，通过")
        run_cmd(f'record-result {task_ids[2]} --score 92 --result pass --notes "专业热情，问题解决彻底"')

    print("\n" + "=" * 70)
    print("步骤 8: 重新计算坐席风险分")
    print("说明：根据最新质检结果更新风险分，低分不通过会提高风险")
    print("=" * 70)
    run_cmd("recalculate-risk")

    print("\n" + "=" * 70)
    print("步骤 9: 再次查看坐席列表（对比风险变化）")
    print("=" * 70)
    run_cmd("agents --sort-by-risk")

    print("\n" + "=" * 70)
    print("步骤 10: 导入第 2 批通话（含重复 ID C001，展示去重效果）")
    print("=" * 70)
    run_cmd(f'import-data calls {os.path.join(SAMPLE_DIR, "calls_batch2.csv")}')

    run_cmd("stats")

    print("\n" + "=" * 70)
    print("步骤 11: 第 2 轮抽样（展示已质检通话不重复分配）")
    print("=" * 70)
    run_cmd("sample --count 4")

    print("\n" + "=" * 70)
    print("步骤 12: 导出质检任务报告")
    print("=" * 70)
    run_cmd("export demo_tasks_report.csv --type tasks")

    print("\n" + "=" * 70)
    print("步骤 13: 导出坐席风险报告")
    print("=" * 70)
    run_cmd("export demo_agents_report.csv --type agents")

    print("\n" + "=" * 70)
    print("步骤 14: 最终统计概览")
    print("=" * 70)
    run_cmd("stats")

    print("\n" + "=" * 70)
    print("演示完成！")
    print("=" * 70)
    print("""
生成的文件：
  - demo_qc.db: SQLite 数据库
  - demo_tasks_report.csv: 质检任务报告
  - demo_agents_report.csv: 坐席风险报告

主要功能展示：
  1. 数据导入：坐席、通话、质检员（支持中英文表头）
  2. 重复导入去重：同一条通话 ID 不会被重复导入
  3. 风险加权抽样：
     - 投诉通话: 权重 x5
     - 高风险坐席(>=70): 权重 x3
     - 历史低分坐席(<60): 权重 x2.5
     - 中风险坐席(50-70): 权重 x1.5
     - 高风险业务(售后/投诉处理/理赔): x1.5
  4. 质检均衡分配：任务均衡分给任务量最少的质检员
  5. 已质检不重复分配：已通过/不通过的通话不会再被抽样
  6. 查看抽样原因：为什么这通通话被选中
  7. 录入质检结果：分数 + pass/fail
  8. 重新计算风险：根据质检历史自动更新坐席风险分
  9. 导出报告：任务、坐席、通话三种类型
""")


if __name__ == "__main__":
    main()
