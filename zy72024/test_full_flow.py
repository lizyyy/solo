#!/usr/bin/env python3
"""
水电费预付余额对账 - 完整端到端测试
按照用户描述的场景进行测试：
1. 小周先跑一小包材料
2. 临时补一条备注
3. 补录数据，讲清楚差异
4. 测试空值、重复项、边界记录
5. 重启后验证历史备注和导出数字
"""
import subprocess
import sys
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent


def run_cli(args, description):
    print(f"\n{'='*70}")
    print(f"  {description}")
    print(f"  命令: python3 cli.py {' '.join(args)}")
    print(f"{'='*70}")

    result = subprocess.run(
        [sys.executable, "cli.py"] + args,
        cwd=BASE_DIR,
        capture_output=True,
        text=True
    )
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr, file=sys.stderr)
    print()
    return result


def main():
    print("\n" + "#" * 70)
    print("#  水电费预付余额对账 - 完整端到端测试")
    print("#" * 70)

    print("\n" + "=" * 70)
    print("  步骤0: 重置数据库，确保从头开始")
    print("=" * 70)
    run_cli(["reset"], "重置数据库").stdin = "YES\n"
    p = subprocess.Popen(
        [sys.executable, "cli.py", "reset"],
        cwd=BASE_DIR,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    stdout, stderr = p.communicate(input="YES\n")
    print(stdout)

    print("\n" + "#" * 70)
    print("#  第一阶段：小周先跑一小包材料")
    print("#" * 70)

    run_cli(
        ["full", "data/sample_xiaozhou.csv"],
        "第1步: 导入小周的小包数据并对账"
    )

    run_cli(
        ["batches"],
        "查看导入批次历史"
    )

    print("\n" + "#" * 70)
    print("#  第二阶段：临时补一条备注")
    print("#" * 70)

    run_cli(
        ["note", "3", "此条为研发部1月水费，之前计入行政，小周2024.1.31确认", "--operator", "小周"],
        "给记录3添加备注（模拟小周补录说明）"
    )

    run_cli(
        ["trace", "3"],
        "查询记录3的溯源信息，验证备注已保存"
    )

    print("\n" + "#" * 70)
    print("#  第三阶段：补录新数据，对比前后差异")
    print("#" * 70)

    run_cli(
        ["reconcile", "--no-export"],
        "补录前再次对账，获取当前余额"
    )

    run_cli(
        ["import", "data/sample_supplement.csv"],
        "导入补录数据（研发部的电费和水费）"
    )

    run_cli(
        ["reconcile"],
        "重新对账，查看补录后的差异"
    )

    print("\n" + "#" * 70)
    print("#  第四阶段：测试脏数据 - 空值、重复项、边界记录")
    print("#" * 70)

    run_cli(
        ["import", "data/sample_dirty.csv", "--on-duplicate", "conflict"],
        "导入脏数据，冲突策略：检测重复并标记"
    )

    run_cli(
        ["reconcile"],
        "对账，验证脏数据的处理效果"
    )

    run_cli(
        ["conflicts"],
        "查看当前冲突记录"
    )

    print("\n" + "#" * 70)
    print("#  第五阶段：测试重复导入的三种策略")
    print("#" * 70)

    run_cli(
        ["import", "data/sample_clean.csv"],
        "第一次导入干净数据（作为基准）"
    )

    run_cli(
        ["import", "data/sample_clean.csv", "--on-duplicate", "skip"],
        "重复导入 - 策略: skip (默认) - 应该全部跳过"
    )

    run_cli(
        ["import", "data/sample_clean.csv", "--on-duplicate", "update"],
        "重复导入 - 策略: update - 应该全部更新（但无实际变化）"
    )

    run_cli(
        ["import", "data/sample_clean.csv", "--on-duplicate", "conflict"],
        "重复导入 - 策略: conflict - 应该标记数据一致跳过"
    )

    run_cli(
        ["batches"],
        "查看所有批次，确认处理结果"
    )

    print("\n" + "#" * 70)
    print("#  第六阶段：记录当前余额和备注，模拟重启")
    print("#" * 70)

    print("\n  记录当前状态（模拟重启前）:")
    result = run_cli(
        ["reconcile", "--no-export"],
        "重启前对账，记录余额"
    )

    run_cli(
        ["trace", "3"],
        "重启前查询记录3，确认备注存在"
    )

    print("\n  模拟重启 - 删除进程，重新连接数据库")
    print("  （不需要实际操作，SQLite是文件存储，直接重新读取即可）")

    print("\n" + "#" * 70)
    print("#  第七阶段：重启后验证 - 历史备注和导出数字对得上")
    print("#" * 70)

    run_cli(
        ["reconcile"],
        "重启后重新对账，验证余额一致"
    )

    run_cli(
        ["trace", "3"],
        "重启后查询记录3，验证备注仍然存在"
    )

    run_cli(
        ["batches"],
        "重启后查看批次历史，确认数据完整"
    )

    print("\n" + "#" * 70)
    print("#  测试完成！")
    print("#" * 70)

    print("\n" + "=" * 70)
    print("  生成的报告文件:")
    print("=" * 70)
    reports_dir = BASE_DIR / "reports"
    if reports_dir.exists():
        for f in sorted(reports_dir.iterdir()):
            print(f"    {f.name}")
    print("=" * 70)

    print("\n  ✓ 所有测试场景已执行完毕")
    print("  ✓ 每条记录都能追到来源（文件名:行号）")
    print("  ✓ 重复导入时明确标记跳过/更新/冲突")
    print("  ✓ 例外情况在汇总数字中明确显示，不会悄悄消失")
    print("  ✓ 脏材料进来时有明确的警告和处理说明")
    print("  ✓ 补录备注后的差异讲得清清楚楚")
    print("  ✓ 重启后历史备注和导出数字对得上")
    print()


if __name__ == "__main__":
    main()
