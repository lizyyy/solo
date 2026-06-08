#!/usr/bin/env python3
"""
犬只疫苗排程对账 - 命令行重跑脚本
用法：
    python scripts/rerun_reconcile.py            # 当月对账，输出到 data/
    python scripts/rerun_reconcile.py 2026-05    # 指定月份
    python scripts/rerun_reconcile.py --print    # 打印异常队列摘要到终端
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.sample_data import build_sample_registers, build_sample_schedules
from app.reconcile import run_reconcile
from app.exporter import export_reconcile_csv, export_abnormal_queue_csv
from app.models import ReconcileStatus


def main():
    parser = argparse.ArgumentParser(description="犬只疫苗排程对账 - 重跑")
    parser.add_argument("month", nargs="?", default=None, help="对账月份 YYYY-MM，默认当月")
    parser.add_argument("--print", action="store_true", dest="print_summary", help="在终端打印摘要")
    parser.add_argument("--data-dir", default=None, help="CSV输出目录，默认 data/")
    args = parser.parse_args()

    from datetime import date
    month = args.month or date.today().strftime("%Y-%m")
    data_dir = args.data_dir or os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data"
    )
    os.makedirs(data_dir, exist_ok=True)

    registers = build_sample_registers()
    schedules = build_sample_schedules(registers)
    items, queue = run_reconcile(registers, schedules, month)

    csv_paths = export_reconcile_csv(items, data_dir, month)
    queue_path = export_abnormal_queue_csv(queue, data_dir, month)

    print("=" * 60)
    print(f"犬只疫苗排程对账 完成 | 月份：{month}")
    print("-" * 60)
    print(f"寄养登记表记录数：{len(registers)}")
    print(f"对账明细条数：    {len(items)}")
    print(f"异常队列条数：    {len(queue)}")
    status_count = {s.value: 0 for s in ReconcileStatus}
    for it in items:
        status_count[it.status.value] += 1
    print("状态分布：")
    for s, c in status_count.items():
        if c:
            print(f"  · {s}：{c} 条")
    print("-" * 60)
    print("导出文件：")
    for k, p in csv_paths.items():
        print(f"  [对账明细-{k}] {p}")
    print(f"  [异常队列] {queue_path}")
    print("=" * 60)

    if args.print_summary and queue:
        print("\n【异常队列摘要】")
        for q in queue:
            print(f"- {q.queue_id} | {q.dog_name} | {q.status.value} | {q.summary}")
            print(f"    来源：{q.source_register_ref} | 影响：{q.impact_scope[:60]}")
            if q.owner_supplement_raw:
                print(f"    主人原话：「{q.owner_supplement_raw}」")
            print()


if __name__ == "__main__":
    main()
