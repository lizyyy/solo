#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""塔吊维保报告复核 —— 一键启动入口

用法:
  python3 run_review.py                    # 首次跑 / 默认跑
  python3 run_review.py --note "备注内容"  # 补备注重跑（同一批材料再跑）
  python3 run_review.py --show-history     # 只看历史运行记录
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
sys.path.insert(0, str(ROOT))

from tcrane_review.engine import (
    run_review, REPORT_PATH, BOM_PATH, SENSOR_DIR,
)
from tcrane_review.history import (
    save_run, compute_data_hash, get_previous_runs, verify_alignment,
    HISTORY_DIR, _load_index,
)
from tcrane_review.presenter import (
    print_full_report, print_exit_summary, DIV, SUB,
)


def show_history_only(report_id: str) -> int:
    runs = get_previous_runs(report_id)
    print()
    print(DIV)
    print(f"  塔吊维保报告复核 —— 历史运行记录  (report_id={report_id or '全部'})")
    print(DIV)
    if not runs:
        print("  （无历史记录）")
        return 0
    for r in runs:
        status_map = {"BLOCKED": "❌阻塞", "NEEDS_ATTENTION": "⚠️待跟进", "PASSED": "✅通过"}
        tag = status_map.get(r["status"], r["status"])
        note = f"  +备注: {r['note_append']}" if r.get("note_append") else ""
        export = r.get("export_file", "")
        print(f"  · {r['run_time']}  {r['run_id']}")
        print(f"    状态: {tag}{note}")
        print(f"    导出: {export}")
        print(f"    数据哈希: {r.get('data_hash', 'N/A')}")
    print()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="塔吊维保报告复核")
    parser.add_argument("--note", type=str, default="",
                        help="补备注后重跑，此备注会写入导出并在交接时间线中呈现")
    parser.add_argument("--show-history", action="store_true",
                        help="仅打印历史运行记录")
    parser.add_argument("--report-id", type=str, default=None,
                        help="指定报告ID（用于历史查询筛选）")
    args = parser.parse_args()

    if args.show_history:
        return show_history_only(args.report_id)

    # 输入数据哈希 —— 用于补注重跑前后对齐
    data_hash = compute_data_hash(REPORT_PATH, BOM_PATH, SENSOR_DIR)

    # 对齐校验
    alignment = verify_alignment(data_hash, args.report_id)

    # 补注信息
    notes = []
    handover_note = ""
    suffix = ""
    if args.note:
        handover_note = args.note
        notes.append(f"补注: {args.note}")
        suffix = "-with-note"

    # 执行复核
    result = run_review(notes=notes, handover_note=handover_note,
                        run_id_suffix=suffix)

    # 历史记录
    history_runs = get_previous_runs(result.report_id)

    # 完整展示
    print_full_report(result, alignment, history_runs)

    # 保存导出
    export_path = save_run(result, data_hash, extra_note=args.note)
    print(f"\n💾 本次复核结果已导出：{export_path}")
    print(f"📁 历史记录目录：{HISTORY_DIR}")

    # 退出提示（明确备件型号替换卡在哪）
    return print_exit_summary(result)


if __name__ == "__main__":
    sys.exit(main())
