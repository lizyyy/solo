#!/usr/bin/env python3
import os
import sys
import argparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from src.state import load_state, save_state, STATUS_LABELS
from src.engine import ReviewEngine
from src.exporter import export_detail_csv, export_history_csv, export_summary_csv
MATERIALS_DIR = os.path.join(BASE_DIR, "materials")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
STATE_FILE = os.path.join(OUTPUT_DIR, "review_state.json")
DETAIL_CSV = os.path.join(OUTPUT_DIR, "复核明细.csv")
HISTORY_CSV = os.path.join(OUTPUT_DIR, "历史轨迹.csv")
SUMMARY_CSV = os.path.join(OUTPUT_DIR, "汇总信息.csv")


def cmd_run(args):
    state = load_state(STATE_FILE)
    engine = ReviewEngine(MATERIALS_DIR, state, OUTPUT_DIR)

    batch_no = args.batch
    if batch_no is None:
        batch_no = state.current_batch + 1 if state.current_batch > 0 else 1

    result = engine.run_batch(batch_no)
    save_state(state, STATE_FILE)

    export_detail_csv(state, DETAIL_CSV)
    export_history_csv(state, HISTORY_CSV)
    export_summary_csv(state, SUMMARY_CSV)
    save_state(state, STATE_FILE)

    print(f"=== 第 {batch_no} 批材料复核完成 ===")
    print(f"  加载材料: {result['loaded']} 份")
    print(f"  新增材料: {result.get('newly_added', 0)} 份")
    print(f"  变更材料: {result['changed']} 份")
    print(f"  整体状态: {STATUS_LABELS.get(state.overall_status, state.overall_status)}")

    if result.get("suspended"):
        print(f"\n  ⚠️  复核已挂起，原因:")
        for r in result.get("suspension_reasons", []):
            print(f"     - {r}")

    print(f"\nCSV 明细已导出:")
    print(f"  - {DETAIL_CSV}")
    print(f"  - {HISTORY_CSV}")
    print(f"  - {SUMMARY_CSV}")


def cmd_status(args):
    state = load_state(STATE_FILE)
    summary = {
        "项目名称": state.project_name,
        "整体状态": STATUS_LABELS.get(state.overall_status, state.overall_status),
        "当前批次": state.current_batch,
        "材料总数": len(state.materials),
        "运行次数": state.run_count,
        "最后运行": state.last_run_time,
    }

    print("=== 施工变更图纸复核 状态 ===")
    for k, v in summary.items():
        print(f"  {k}: {v}")

    if state.suspension_reasons:
        print(f"\n挂起原因:")
        for r in state.suspension_reasons:
            print(f"  - {r}")

    print(f"\n材料明细:")
    for key in sorted(state.materials.keys()):
        ms = state.materials[key]
        status = STATUS_LABELS.get(ms.status, ms.status)
        changed = " (有变更)" if len(ms.history) > 1 else ""
        print(f"  [{status}] {ms.material_id} - {ms.title}{changed}")


def cmd_confirm(args):
    state = load_state(STATE_FILE)

    if args.all:
        for key in state.materials:
            state.materials[key].status = "confirmed"
        state.overall_status = "completed"
        state.suspension_reasons = []
        save_state(state, STATE_FILE)
        export_detail_csv(state, DETAIL_CSV)
        export_history_csv(state, HISTORY_CSV)
        export_summary_csv(state, SUMMARY_CSV)
        save_state(state, STATE_FILE)
        print("已确认全部材料")
        return

    if args.material:
        engine = ReviewEngine(MATERIALS_DIR, state, OUTPUT_DIR)
        ok = engine.confirm_material(args.material)
        if ok:
            save_state(state, STATE_FILE)
            export_detail_csv(state, DETAIL_CSV)
            save_state(state, STATE_FILE)
            print(f"已确认: {args.material}")
        else:
            print(f"未找到材料: {args.material}")
        return

    if args.suspension:
        engine = ReviewEngine(MATERIALS_DIR, state, OUTPUT_DIR)
        engine.confirm_suspension()
        save_state(state, STATE_FILE)
        export_detail_csv(state, DETAIL_CSV)
        save_state(state, STATE_FILE)
        print("已解除挂起，继续复核")
        return


def cmd_export(args):
    state = load_state(STATE_FILE)
    export_detail_csv(state, DETAIL_CSV)
    export_history_csv(state, HISTORY_CSV)
    export_summary_csv(state, SUMMARY_CSV)
    save_state(state, STATE_FILE)
    print("CSV 已重新导出:")
    print(f"  - 复核明细: {DETAIL_CSV}")
    print(f"  - 历史轨迹: {HISTORY_CSV}")
    print(f"  - 汇总信息: {SUMMARY_CSV}")


def cmd_reset(args):
    if os.path.isfile(STATE_FILE):
        os.remove(STATE_FILE)
    for f in [DETAIL_CSV, HISTORY_CSV, SUMMARY_CSV]:
        if os.path.isfile(f):
            os.remove(f)
    print("已重置复核状态（材料文件保留）")


def main():
    parser = argparse.ArgumentParser(description="施工变更图纸复核")
    subparsers = parser.add_subparsers(dest="command")

    p_run = subparsers.add_parser("run", help="运行一批材料的复核")
    p_run.add_argument("--batch", type=int, default=None, help="批次号，默认下一批")
    p_run.set_defaults(func=cmd_run)

    p_status = subparsers.add_parser("status", help="查看当前复核状态")
    p_status.set_defaults(func=cmd_status)

    p_confirm = subparsers.add_parser("confirm", help="确认操作")
    p_confirm.add_argument("--all", action="store_true", help="确认全部")
    p_confirm.add_argument("--material", type=str, help="确认指定材料")
    p_confirm.add_argument("--suspension", action="store_true", help="解除挂起")
    p_confirm.set_defaults(func=cmd_confirm)

    p_export = subparsers.add_parser("export", help="重新导出 CSV")
    p_export.set_defaults(func=cmd_export)

    p_reset = subparsers.add_parser("reset", help="重置复核状态")
    p_reset.set_defaults(func=cmd_reset)

    args = parser.parse_args()
    if args.command is None:
        parser.print_help()
        return

    args.func(args)


if __name__ == "__main__":
    main()
