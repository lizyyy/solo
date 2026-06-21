"""稳定的 CLI 接口。

复核人会把"港湾淤积异常预警"放进日常脚本里跑，所以：
  - 参数名长名稳定；
  - 返回码稳定；
  - 失败提示文案带稳定 CODE 前缀。
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

from .engine import HarborWarningEngine
from .models import WarningLevel
from .storage import HarborStorage
from .timeline import build_timeline, format_timeline_for_handover


EXIT_OK = 0
EXIT_USAGE = 2
EXIT_DATA = 3
EXIT_RUNTIME = 4


# 稳定业务错误码 —— 日常脚本按这些 CODE 前缀判断失败类型。
# 命名规则：<命令>_<错误类别>，值保持不变。
ERR_IMPORT_FILE_NOT_FOUND = "IMPORT_FILE_NOT_FOUND"
ERR_IMPORT_PARSE = "IMPORT_FILE_PARSE_ERROR"
ERR_IMPORT_FORMAT = "IMPORT_FORMAT_ERROR"
ERR_REVISE_LEVEL_INVALID = "REVISE_LEVEL_INVALID"
ERR_TIMELINE_ARG = "TIMELINE_ARG_ERROR"
ERR_RUNTIME = "RUNTIME_ERROR"

ALLOWED_WARNING_LEVELS = [l.value for l in WarningLevel]


def _err(code: str, reason: str) -> str:
    return f"[{code}] {reason}"


def _json_dump(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2)


def cmd_import(args: argparse.Namespace) -> int:
    storage = HarborStorage(args.data_dir)
    engine = HarborWarningEngine(storage)
    try:
        with open(args.input, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(
            _err(ERR_IMPORT_FILE_NOT_FOUND, f"输入文件不存在: {args.input}"),
            file=sys.stderr,
        )
        return EXIT_DATA
    except json.JSONDecodeError as exc:
        print(
            _err(
                ERR_IMPORT_PARSE,
                f"输入文件不是合法 JSON: {args.input}（第 {exc.lineno} 行 {exc.colno} 列: {exc.msg}）",
            ),
            file=sys.stderr,
        )
        return EXIT_DATA
    if not isinstance(data, list):
        print(
            _err(ERR_IMPORT_FORMAT, f"输入文件 {args.input} 必须是 JSON 数组"),
            file=sys.stderr,
        )
        return EXIT_DATA
    result = engine.import_raw_records(data)
    print(_json_dump(result))
    return EXIT_OK if result["map_failed"] == 0 else EXIT_DATA


def cmd_pipeline(args: argparse.Namespace) -> int:
    storage = HarborStorage(args.data_dir)
    engine = HarborWarningEngine(storage)
    result = engine.run_pipeline(
        window_seconds=args.window_seconds,
        drift_threshold=args.drift_threshold,
        min_window=args.min_window,
        sediment_warning_cm=args.sediment_warning_cm,
        sediment_critical_cm=args.sediment_critical_cm,
    )
    print(_json_dump(result))
    return EXIT_OK


def cmd_summary(args: argparse.Namespace) -> int:
    storage = HarborStorage(args.data_dir)
    engine = HarborWarningEngine(storage)
    print(_json_dump(engine.summary()))
    return EXIT_OK


def cmd_revise(args: argparse.Namespace) -> int:
    storage = HarborStorage(args.data_dir)
    engine = HarborWarningEngine(storage)
    try:
        level = WarningLevel(args.new_level)
    except ValueError:
        print(
            _err(
                ERR_REVISE_LEVEL_INVALID,
                f"非法人工判断值 --new-level={args.new_level!r}，"
                f"合法值: {ALLOWED_WARNING_LEVELS}",
            ),
            file=sys.stderr,
        )
        return EXIT_DATA
    ok, msg = engine.revise_warning_level(
        warning_id=args.warning_id,
        new_level=level,
        reason=args.reason,
        operator=args.operator or "",
    )
    print(_json_dump({"ok": ok, "message": msg}))
    return EXIT_OK if ok else EXIT_DATA


def cmd_confirm(args: argparse.Namespace) -> int:
    storage = HarborStorage(args.data_dir)
    engine = HarborWarningEngine(storage)
    ok, msg = engine.confirm_warning(
        warning_id=args.warning_id,
        reason=args.reason or "人工确认",
        operator=args.operator or "",
    )
    print(_json_dump({"ok": ok, "message": msg}))
    return EXIT_OK if ok else EXIT_DATA


def cmd_note(args: argparse.Namespace) -> int:
    storage = HarborStorage(args.data_dir)
    engine = HarborWarningEngine(storage)
    note_id, written = engine.add_note(
        target_type=args.target_type,
        target_id=args.target_id,
        content=args.content,
        author=args.author or "",
    )
    print(_json_dump({"note_id": note_id, "written": written}))
    return EXIT_OK


def cmd_timeline(args: argparse.Namespace) -> int:
    storage = HarborStorage(args.data_dir)
    try:
        events = build_timeline(
            storage,
            buoy_id=args.buoy_id,
            warning_id=args.warning_id,
            log_id=args.log_id,
        )
    except ValueError as exc:
        print(f"[TIMELINE_ARG_ERROR] {exc}", file=sys.stderr)
        return EXIT_USAGE
    if args.format == "json":
        print(_json_dump(events))
    else:
        print(format_timeline_for_handover(events))
    return EXIT_OK


def cmd_list(args: argparse.Namespace) -> int:
    storage = HarborStorage(args.data_dir)
    out: dict[str, Any] = {}
    if args.kind in ("warnings", "all"):
        out["warnings"] = [w.to_dict() for w in storage.list_warnings()]
    if args.kind in ("drifts", "all"):
        out["drift_marks"] = [d.to_dict() for d in storage.list_drift_marks()]
    if args.kind in ("logs", "all"):
        out["buoy_logs"] = [l.to_dict() for l in storage.list_buoy_logs()]
    if args.kind in ("aligned", "all"):
        out["aligned_pairs"] = [p.to_dict() for p in storage.list_aligned_pairs()]
    if args.kind in ("notes", "all"):
        out["notes"] = [n.to_dict() for n in storage.list_notes()]
    if args.kind in ("changes", "all"):
        out["changes"] = [c.to_dict() for c in storage.list_changes()]
    print(_json_dump(out))
    return EXIT_OK


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="harbor-warning",
        description="港湾淤积异常预警处理链（参数名/提示文案稳定）",
    )
    parser.add_argument(
        "--data-dir",
        default=os.environ.get("HARBOR_DATA_DIR", "./harbor_data"),
        help="数据存储目录，环境变量 HARBOR_DATA_DIR 可覆盖",
    )

    sub = parser.add_subparsers(dest="command", required=True)

    # import
    p_imp = sub.add_parser("import", help="导入原始浮标日志（JSON 数组）")
    p_imp.add_argument("--input", required=True, help="输入 JSON 文件路径")
    p_imp.set_defaults(func=cmd_import)

    # pipeline
    p_pipe = sub.add_parser("pipeline", help="运行完整处理链")
    p_pipe.add_argument("--window-seconds", type=int, default=3600)
    p_pipe.add_argument("--drift-threshold", type=float, default=3.0)
    p_pipe.add_argument("--min-window", type=int, default=5)
    p_pipe.add_argument("--sediment-warning-cm", type=float, default=30.0)
    p_pipe.add_argument("--sediment-critical-cm", type=float, default=60.0)
    p_pipe.set_defaults(func=cmd_pipeline)

    # summary
    p_sum = sub.add_parser("summary", help="输出数据摘要")
    p_sum.set_defaults(func=cmd_summary)

    # list
    p_ls = sub.add_parser("list", help="列表查询")
    p_ls.add_argument(
        "--kind",
        choices=["warnings", "drifts", "logs", "aligned", "notes", "changes", "all"],
        default="all",
    )
    p_ls.set_defaults(func=cmd_list)

    # revise
    p_rev = sub.add_parser("revise", help="人工改预警口径（记旧值/新判断/原因）")
    p_rev.add_argument("--warning-id", required=True)
    # 不使用 argparse choices：非法值由程序返回稳定错误码 REVISE_LEVEL_INVALID，
    # 避免日常脚本解析到 argparse 的英文 'invalid choice' 提示。
    p_rev.add_argument(
        "--new-level",
        required=True,
        help=f"人工判断值，合法值: {ALLOWED_WARNING_LEVELS}",
    )
    p_rev.add_argument("--reason", required=True, help="改口径原因（必填）")
    p_rev.add_argument("--operator", default="")
    p_rev.set_defaults(func=cmd_revise)

    # confirm
    p_conf = sub.add_parser("confirm", help="人工确认预警")
    p_conf.add_argument("--warning-id", required=True)
    p_conf.add_argument("--reason", default="人工确认")
    p_conf.add_argument("--operator", default="")
    p_conf.set_defaults(func=cmd_confirm)

    # note
    p_note = sub.add_parser("note", help="新增受保护人工备注（幂等不覆盖）")
    p_note.add_argument("--target-type", required=True, choices=["warning", "buoy_log", "drift"])
    p_note.add_argument("--target-id", required=True)
    p_note.add_argument("--content", required=True)
    p_note.add_argument("--author", default="")
    p_note.set_defaults(func=cmd_note)

    # timeline
    p_tl = sub.add_parser("timeline", help="历史时间线追溯（老何接班流程）")
    p_tl.add_argument("--buoy-id")
    p_tl.add_argument("--warning-id")
    p_tl.add_argument("--log-id")
    p_tl.add_argument(
        "--format",
        choices=["text", "json"],
        default="text",
        help="text 给老何照着念，json 给脚本",
    )
    p_tl.set_defaults(func=cmd_timeline)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except Exception as exc:  # noqa: BLE001
        print(_err(ERR_RUNTIME, f"{type(exc).__name__}: {exc}"), file=sys.stderr)
        return EXIT_RUNTIME


if __name__ == "__main__":
    raise SystemExit(main())
