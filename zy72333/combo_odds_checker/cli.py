from __future__ import annotations

import argparse
import json
import sys

from combo_odds_checker.demo_data import run_demo, DEMO_WEIGHT_ROWS
from combo_odds_checker.models import OldFormulaScreenshot
from combo_odds_checker.workflow import WorkflowEngine


def cmd_demo(args: argparse.Namespace) -> None:
    run_demo()


def cmd_import(args: argparse.Namespace) -> None:
    engine = WorkflowEngine()
    rows = []
    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            rows = json.load(f)
    else:
        rows = DEMO_WEIGHT_ROWS

    table = engine.step1_import_table(args.table_id, rows, source=args.file or "demo")
    print(f"导入完成：表 {table.table_id}，共 {len(table.entries)} 条")
    flagged = [e for e in table.entries if e.old_table_treats_as_missing]
    if flagged:
        print(f"⚠ 负数被旧表当缺失：{len(flagged)} 条")
        for e in flagged:
            print(f"  - {e.category} (raw_value={e.raw_value})")
    print()
    print(engine.get_human_report())


def cmd_screenshot(args: argparse.Namespace) -> None:
    engine = _load_engine_from_state(args.state)
    ss = OldFormulaScreenshot(
        screenshot_id=args.screenshot_id,
        description=args.description,
        image_ref=args.image_ref,
        related_category=args.category,
        uploaded_by=args.uploaded_by or "教研负责人吴老师",
    )
    engine.step2_add_screenshot(ss)
    print(f"截图补录完成：{ss.screenshot_id}（{ss.related_category}）")
    print()
    report = engine.step3_update_report_after_screenshot()
    print(engine.get_human_report())
    _save_engine_state(engine, args.state)


def cmd_report(args: argparse.Namespace) -> None:
    engine = _load_engine_from_state(args.state)
    print(engine.get_human_report())


def cmd_correct(args: argparse.Namespace) -> None:
    engine = _load_engine_from_state(args.state)
    correction = engine.apply_manual_correction(
        sample_id=args.sample_id,
        new_value=args.new_value,
        reason=args.reason,
        corrected_by=args.corrected_by or "教研负责人吴老师",
    )
    print(f"修正完成：{correction.sample_id} {correction.old_value} → {correction.new_value}")
    print()
    rerun = engine.rerun()
    print(f"重跑完成：{rerun.rerun_id}")
    print()
    print(engine.get_human_report())
    _save_engine_state(engine, args.state)


def _load_engine_from_state(state_file: str) -> WorkflowEngine:
    engine = WorkflowEngine()
    if state_file:
        try:
            with open(state_file, "r", encoding="utf-8") as f:
                state = json.load(f)
            engine.step1_import_table(state["table_id"], state["rows"])
            for ss_data in state.get("screenshots", []):
                engine.step2_add_screenshot(OldFormulaScreenshot(**ss_data))
            print(f"（已从 {state_file} 恢复状态）")
        except FileNotFoundError:
            print(f"（状态文件 {state_file} 不存在，使用空引擎）")
    return engine


def _save_engine_state(engine: WorkflowEngine, state_file: str) -> None:
    if not state_file or not engine.table:
        return
    state = {
        "table_id": engine.table.table_id,
        "rows": [
            {
                "category": e.category,
                "weight": e.weight,
                "raw_value": e.raw_value,
                "note": e.note,
            }
            for e in engine.table.entries
        ],
        "screenshots": [
            {
                "screenshot_id": s.screenshot_id,
                "description": s.description,
                "image_ref": s.image_ref,
                "related_category": s.related_category,
                "uploaded_by": s.uploaded_by,
            }
            for s in engine.screenshots
        ],
    }
    with open(state_file, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    print(f"（状态已保存至 {state_file}）")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="combo-odds-checker",
        description="组合数抽奖赔率核对工具",
    )
    sub = parser.add_subparsers(dest="command")

    demo_p = sub.add_parser("demo", help="运行完整演示流程")
    demo_p.set_defaults(func=cmd_demo)

    import_p = sub.add_parser("import", help="导入评分权重表")
    import_p.add_argument("--table-id", default="TBL-001")
    import_p.add_argument("--file", default=None, help="JSON 数据文件路径")
    import_p.set_defaults(func=cmd_import)

    ss_p = sub.add_parser("screenshot", help="补录旧公式截图")
    ss_p.add_argument("--screenshot-id", required=True)
    ss_p.add_argument("--description", default="")
    ss_p.add_argument("--image-ref", default="")
    ss_p.add_argument("--category", required=True)
    ss_p.add_argument("--uploaded-by", default="")
    ss_p.add_argument("--state", default="state.json")
    ss_p.set_defaults(func=cmd_screenshot)

    report_p = sub.add_parser("report", help="查看边界样本报告")
    report_p.add_argument("--state", default="state.json")
    report_p.set_defaults(func=cmd_report)

    correct_p = sub.add_parser("correct", help="人工修正并重跑")
    correct_p.add_argument("--sample-id", required=True)
    correct_p.add_argument("--new-value", type=float, required=True)
    correct_p.add_argument("--reason", required=True)
    correct_p.add_argument("--corrected-by", default="")
    correct_p.add_argument("--state", default="state.json")
    correct_p.set_defaults(func=cmd_correct)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)
    args.func(args)


if __name__ == "__main__":
    main()
