import argparse
import json
import sys
import os
from datetime import datetime
from typing import Dict, Any, List

from .scheduler import TemperatureRiseScheduler
from .models import ImportReport, PageSummary


EXIT_OK = 0
EXIT_USAGE = 2
EXIT_RUNTIME = 3
EXIT_BAD_DATA_PRESENT = 4
EXIT_PHOTO_MISMATCH = 5


STATE_FILE_DEFAULT = "pdg_state.json"


def _load_state(path: str, scheduler: TemperatureRiseScheduler) -> None:
    if not os.path.exists(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        bad_data = data.get("bad_data", {})
        for tid, td in bad_data.items():
            from .models import BadDataTrace
            bd = BadDataTrace(
                trace_id=td["trace_id"],
                handover_record_id=td["handover_record_id"],
                source_device_id_raw=td["source_device_id_raw"],
                error_type=td["error_type"],
                error_message=td["error_message"],
                record_time=datetime.fromisoformat(td["record_time"]),
                on_site_trace_hint=td["on_site_trace_hint"],
                raw_snippet=td.get("raw_snippet", ""),
            )
            scheduler._bad_data[tid] = bd

        results = data.get("results", {})
        for dk, rd in results.items():
            from .models import DeviceId, SchedulerResult
            sr = SchedulerResult(
                result_id=rd["result_id"],
                device_id=DeviceId(canonical=rd["device_id"]),
                scheduled_date=datetime.strptime(rd["scheduled_date"], "%Y-%m-%d"),
                spare_part_code=rd["spare_part_code"],
                spare_part_name=rd["spare_part_name"],
                quantity=rd["quantity"],
                priority=rd["priority"],
                handover_record_ids=list(rd.get("handover_record_ids", [])),
                manual_remark=rd.get("manual_remark", ""),
                is_manual_remark_protected=rd.get("is_manual_remark_protected", False),
                dedup_key=dk,
                source_dedup_count=rd.get("source_dedup_count", 1),
            )
            scheduler._results[dk] = sr
    except Exception:
        pass


def _save_state(path: str, scheduler: TemperatureRiseScheduler) -> None:
    data = {
        "saved_at": datetime.now().isoformat(),
        "results": {dk: r.to_dict() for dk, r in scheduler._results.items()},
        "bad_data": {tid: b.to_dict() for tid, b in scheduler._bad_data.items()},
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _read_records_from_input(input_path: str) -> List[Dict[str, Any]]:
    if input_path == "-":
        raw = sys.stdin.read()
    else:
        with open(input_path, "r", encoding="utf-8") as f:
            raw = f.read()
    data = json.loads(raw)
    if isinstance(data, dict) and "records" in data:
        return data["records"]
    if isinstance(data, list):
        return data
    raise ValueError(
        "输入格式错误：期望 JSON 数组或包含 records 字段的对象。"
    )


def cmd_import(args) -> int:
    scheduler = TemperatureRiseScheduler()
    _load_state(args.state, scheduler)

    try:
        records = _read_records_from_input(args.input)
    except Exception as exc:
        sys.stderr.write(
            json.dumps(
                {
                    "failure_code": "INPUT_INVALID",
                    "failure_reason": (
                        f"读取输入文件失败: {type(exc).__name__}: {str(exc)}"
                    ),
                },
                ensure_ascii=False,
            )
            + "\n"
        )
        return EXIT_USAGE

    today = None
    if args.today:
        today = datetime.fromisoformat(args.today)

    report = scheduler.import_handover_records(
        records,
        run_label=args.label or "",
        today=today,
    )

    _save_state(args.state, scheduler)

    output = {
        "schema_version": "1.0",
        "command": "import",
        "import_report": report.to_dict(),
    }

    if args.json:
        sys.stdout.write(json.dumps(output, ensure_ascii=False, indent=2) + "\n")

    if report.failure_code != "OK":
        sys.stderr.write(
            json.dumps(
                {
                    "failure_code": report.failure_code,
                    "failure_reason": report.failure_reason,
                },
                ensure_ascii=False,
            )
            + "\n"
        )
        return EXIT_RUNTIME

    exit_code = EXIT_OK
    if report.records_bad_data > 0:
        exit_code = EXIT_BAD_DATA_PRESENT
    if report.photo_mismatch_impact is not None:
        if exit_code == EXIT_OK:
            exit_code = EXIT_PHOTO_MISMATCH
        else:
            exit_code = max(exit_code, EXIT_PHOTO_MISMATCH)

    return exit_code


def cmd_summary(args) -> int:
    scheduler = TemperatureRiseScheduler()
    _load_state(args.state, scheduler)

    tonight = None
    if args.tonight:
        tonight = datetime.fromisoformat(args.tonight)

    summary = scheduler.build_page_summary(tonight=tonight)

    output = {
        "schema_version": "1.0",
        "command": "summary",
        "page_summary": summary.to_dict(),
    }

    sys.stdout.write(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    return EXIT_OK


def cmd_remark(args) -> int:
    scheduler = TemperatureRiseScheduler()
    _load_state(args.state, scheduler)

    ok, msg = scheduler.update_manual_remark(
        args.dedup_key,
        args.remark,
        operator=args.operator or "值班脚本",
    )

    _save_state(args.state, scheduler)

    output = {
        "schema_version": "1.0",
        "command": "remark",
        "success": ok,
        "message": msg,
        "dedup_key": args.dedup_key,
    }
    sys.stdout.write(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    return EXIT_OK if ok else EXIT_RUNTIME


def cmd_baddata(args) -> int:
    scheduler = TemperatureRiseScheduler()
    _load_state(args.state, scheduler)

    traces = scheduler.all_bad_data()
    output = {
        "schema_version": "1.0",
        "command": "baddata",
        "count": len(traces),
        "traces": [t.to_dict() for t in traces],
    }
    sys.stdout.write(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    return EXIT_OK if len(traces) == 0 else EXIT_BAD_DATA_PRESENT


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pdg-wsp-scheduler",
        description="配电柜温升备件排程 CLI（值班脚本稳定调用接口）",
    )
    parser.add_argument(
        "--state",
        default=STATE_FILE_DEFAULT,
        help=f"状态持久化文件路径（默认: {STATE_FILE_DEFAULT}）",
    )

    sub = parser.add_subparsers(dest="command", required=True)

    p_import = sub.add_parser("import", help="导入班组交接记录并生成排程")
    p_import.add_argument(
        "--input", "-i", required=True,
        help="输入 JSON 文件路径，或使用 - 从标准输入读取",
    )
    p_import.add_argument(
        "--label", "-l", default="",
        help="本次导入的标签（会拼入 import_run_id）",
    )
    p_import.add_argument(
        "--today", default=None,
        help="模拟今日日期（ISO 格式），用于灰度测试",
    )
    p_import.add_argument(
        "--json", action="store_true", default=True,
        help="输出完整 JSON 报告（默认开启）",
    )
    p_import.set_defaults(func=cmd_import)

    p_summary = sub.add_parser("summary", help="输出页面摘要（供值班脚本解析）")
    p_summary.add_argument(
        "--tonight", default=None,
        help="模拟今夜截止时间（ISO 格式），用于灰度测试",
    )
    p_summary.set_defaults(func=cmd_summary)

    p_remark = sub.add_parser("remark", help="写入或更新人工备注")
    p_remark.add_argument("--dedup-key", required=True, help="目标排程的 dedup_key")
    p_remark.add_argument("--remark", required=True, help="备注内容")
    p_remark.add_argument("--operator", default="值班脚本", help="操作人")
    p_remark.set_defaults(func=cmd_remark)

    p_bad = sub.add_parser("baddata", help="列出所有坏数据线索")
    p_bad.set_defaults(func=cmd_baddata)

    return parser


def main(argv=None) -> int:
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:
        return int(exc.code)

    try:
        return args.func(args)
    except Exception as exc:
        sys.stderr.write(
            json.dumps(
                {
                    "failure_code": "UNHANDLED_EXCEPTION",
                    "failure_reason": f"{type(exc).__name__}: {str(exc)}",
                },
                ensure_ascii=False,
            )
            + "\n"
        )
        return EXIT_RUNTIME


if __name__ == "__main__":
    sys.exit(main())
