#!/usr/bin/env python3
import sys
import os
import json
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from basketball_arc.physics import ShotParams, compute_trajectory, format_result_detail
from basketball_arc.validation import validate_shot_record, apply_corrections, format_validation_report
from basketball_arc.hitwindow import compute_hit_window, format_hit_window
from basketball_arc.compare import compare_shots
from basketball_arc.trajectory import (
    export_trajectory_csv,
    export_trajectory_plot,
    export_comparison_plot,
    export_hit_window_plot,
)
from basketball_arc.history import (
    save_session,
    list_sessions,
    get_session,
    format_session_summary,
    format_session_detail,
)


def cmd_calc(args):
    params = ShotParams(
        angle_deg=args.angle,
        velocity_ms=args.velocity,
        release_height=args.release_height,
        rim_height=args.rim_height,
        rim_distance=args.rim_distance,
    )
    record = {
        "angle_deg": args.angle,
        "velocity_ms": args.velocity,
        "release_height": args.release_height,
        "rim_height": args.rim_height,
        "rim_distance": args.rim_distance,
    }

    issues = validate_shot_record(record)
    corrected = apply_corrections(record, issues)

    if corrected.get("_corrections"):
        print("\n[数据修正]")
        for c in corrected["_corrections"]:
            print(f"  → {c}")

    if issues:
        print("\n" + format_validation_report(issues))

    params = ShotParams(
        angle_deg=corrected.get("angle_deg", args.angle),
        velocity_ms=corrected.get("velocity_ms", args.velocity),
        release_height=corrected.get("release_height", args.release_height),
        rim_height=corrected.get("rim_height", args.rim_height),
        rim_distance=corrected.get("rim_distance", args.rim_distance),
    )

    result = compute_trajectory(params)
    result.correction_log = corrected.get("_corrections", [])

    print("\n" + format_result_detail(result))

    result_summary = {
        "hit": result.hit,
        "y_deviation": result.y_deviation,
        "entry_angle_deg": result.entry_angle_deg,
        "apex_height": result.apex_height,
        "rim_y_at_distance": result.rim_y_at_distance,
    }

    save_session(
        action="calc",
        params=record,
        result=result_summary,
        issues=[{"field_name": i.field_name, "severity": i.severity,
                 "original_value": i.original_value, "corrected_value": i.corrected_value,
                 "explanation": i.explanation} for i in issues],
        corrections=corrected.get("_corrections", []),
        notes=args.note or "",
    )

    if args.export_csv:
        path = export_trajectory_csv(result, args.export_csv)
        print(f"\n轨迹CSV已导出: {path}")

    if args.export_plot:
        path = export_trajectory_plot(result, args.export_plot)
        print(f"轨迹图已导出: {path}")


def cmd_window(args):
    base_params = ShotParams(
        angle_deg=args.angle,
        velocity_ms=args.velocity,
        release_height=args.release_height,
        rim_height=args.rim_height,
        rim_distance=args.rim_distance,
    )

    hw = compute_hit_window(
        base_params,
        angle_range=(args.angle_min, args.angle_max),
        velocity_range=(args.vel_min, args.vel_max),
        resolution=args.resolution,
    )

    print(format_hit_window(hw))

    save_session(
        action="window",
        params={
            "angle_deg": args.angle, "velocity_ms": args.velocity,
            "release_height": args.release_height, "rim_height": args.rim_height,
            "rim_distance": args.rim_distance,
        },
        result={
            "angle_range": [hw.angle_min_deg, hw.angle_max_deg],
            "velocity_range": [hw.velocity_min_ms, hw.velocity_max_ms],
            "center": [hw.center_angle_deg, hw.center_velocity_ms],
        },
        notes=args.note or "",
    )

    if args.export_plot:
        path = export_hit_window_plot(hw, args.export_plot, highlight_params=base_params)
        print(f"\n命中窗口图已导出: {path}")


def cmd_compare(args):
    if not os.path.exists(args.data_file):
        print(f"文件不存在: {args.data_file}")
        sys.exit(1)

    with open(args.data_file, "r", encoding="utf-8") as f:
        records = json.load(f)

    print(compare_shots(records))

    save_session(
        action="compare",
        params={"data_file": args.data_file, "record_count": len(records)},
        notes=args.note or "",
    )

    if args.export_plot:
        shot_results = []
        labels = []
        for rec in records:
            issues = validate_shot_record(rec)
            corrected = apply_corrections(rec, issues)
            angle = corrected.get("angle_deg")
            velocity = corrected.get("velocity_ms")
            if angle is None or velocity is None:
                continue
            params = ShotParams(
                angle_deg=angle, velocity_ms=velocity,
                release_height=corrected.get("release_height", 1.95),
                rim_height=corrected.get("rim_height", 3.048),
                rim_distance=corrected.get("rim_distance", 4.225),
            )
            shot_results.append(compute_trajectory(params))
            labels.append(rec.get("player_name", "?"))

        if shot_results:
            path = export_comparison_plot(shot_results, labels, args.export_plot)
            print(f"\n对比图已导出: {path}")


def cmd_history(args):
    sessions = list_sessions(limit=args.limit)
    print(format_session_summary(sessions))

    if args.detail:
        detail_session = None
        for s in sessions:
            if s.get("_file") == args.detail:
                detail_session = s
                break
        if detail_session:
            print("\n" + format_session_detail(detail_session))
        else:
            full = get_session(args.detail)
            if full:
                print("\n" + format_session_detail(full))
            else:
                print(f"未找到: {args.detail}")


def cmd_validate(args):
    if not os.path.exists(args.data_file):
        print(f"文件不存在: {args.data_file}")
        sys.exit(1)

    with open(args.data_file, "r", encoding="utf-8") as f:
        records = json.load(f)

    for idx, rec in enumerate(records):
        name = rec.get("player_name", f"记录{idx + 1}")
        print(f"\n{'=' * 50}")
        print(f"#{idx + 1} {name}")
        print(f"{'=' * 50}")
        issues = validate_shot_record(rec)
        print(format_validation_report(issues))
        corrected = apply_corrections(rec, issues)
        if corrected.get("_corrections"):
            print("自动修正:")
            for c in corrected["_corrections"]:
                print(f"  → {c}")

    save_session(
        action="validate",
        params={"data_file": args.data_file, "record_count": len(records)},
        notes=args.note or "",
    )


def cmd_export(args):
    params = ShotParams(
        angle_deg=args.angle,
        velocity_ms=args.velocity,
        release_height=args.release_height,
        rim_height=args.rim_height,
        rim_distance=args.rim_distance,
    )
    result = compute_trajectory(params)

    if args.format == "csv":
        path = export_trajectory_csv(result, args.output)
    elif args.format == "png":
        path = export_trajectory_plot(result, args.output, title=args.title)
    else:
        print(f"不支持的格式: {args.format}")
        sys.exit(1)

    print(f"已导出: {path}")

    save_session(
        action="export",
        params={"angle_deg": args.angle, "velocity_ms": args.velocity},
        result={"format": args.format, "output": args.output, "hit": result.hit},
        notes=args.note or "",
    )


def main():
    parser = argparse.ArgumentParser(
        prog="basketball_arc",
        description="篮球投篮弧线教具 —— 出手角度·初速度·命中窗口关系分析",
    )
    sub = parser.add_subparsers(dest="command")

    p_calc = sub.add_parser("calc", help="单次投篮轨迹计算")
    p_calc.add_argument("--angle", type=float, required=True, help="出手角度 (°)")
    p_calc.add_argument("--velocity", type=float, required=True, help="出手速度 (m/s)")
    p_calc.add_argument("--release-height", type=float, default=1.95, help="出手高度 (m), 默认1.95")
    p_calc.add_argument("--rim-height", type=float, default=3.048, help="篮筐高度 (m), 默认3.048")
    p_calc.add_argument("--rim-distance", type=float, default=4.225, help="篮筐距离 (m), 默认4.225(罚球线)")
    p_calc.add_argument("--export-csv", type=str, default="", help="导出轨迹CSV路径")
    p_calc.add_argument("--export-plot", type=str, default="", help="导出轨迹图路径")
    p_calc.add_argument("--note", type=str, default="", help="备注")
    p_calc.set_defaults(func=cmd_calc)

    p_window = sub.add_parser("window", help="命中窗口计算")
    p_window.add_argument("--angle", type=float, default=52, help="参考角度 (°)")
    p_window.add_argument("--velocity", type=float, default=7.2, help="参考速度 (m/s)")
    p_window.add_argument("--release-height", type=float, default=1.95)
    p_window.add_argument("--rim-height", type=float, default=3.048)
    p_window.add_argument("--rim-distance", type=float, default=4.225)
    p_window.add_argument("--angle-min", type=float, default=30, help="搜索角度下限 (°)")
    p_window.add_argument("--angle-max", type=float, default=80, help="搜索角度上限 (°)")
    p_window.add_argument("--vel-min", type=float, default=4, help="搜索速度下限 (m/s)")
    p_window.add_argument("--vel-max", type=float, default=12, help="搜索速度上限 (m/s)")
    p_window.add_argument("--resolution", type=int, default=50, help="网格分辨率")
    p_window.add_argument("--export-plot", type=str, default="", help="导出命中窗口图路径")
    p_window.add_argument("--note", type=str, default="")
    p_window.set_defaults(func=cmd_window)

    p_compare = sub.add_parser("compare", help="批量参数对比")
    p_compare.add_argument("data_file", type=str, help="JSON数据文件路径")
    p_compare.add_argument("--export-plot", type=str, default="", help="导出对比图路径")
    p_compare.add_argument("--note", type=str, default="")
    p_compare.set_defaults(func=cmd_compare)

    p_validate = sub.add_parser("validate", help="数据校验（检测缺项/单位错/异常值）")
    p_validate.add_argument("data_file", type=str, help="JSON数据文件路径")
    p_validate.add_argument("--note", type=str, default="")
    p_validate.set_defaults(func=cmd_validate)

    p_history = sub.add_parser("history", help="查看历史记录")
    p_history.add_argument("--limit", type=int, default=20, help="显示条数")
    p_history.add_argument("--detail", type=str, default="", help="查看指定记录详情（文件名）")
    p_history.set_defaults(func=cmd_history)

    p_export = sub.add_parser("export", help="导出轨迹数据/图片")
    p_export.add_argument("--angle", type=float, required=True)
    p_export.add_argument("--velocity", type=float, required=True)
    p_export.add_argument("--release-height", type=float, default=1.95)
    p_export.add_argument("--rim-height", type=float, default=3.048)
    p_export.add_argument("--rim-distance", type=float, default=4.225)
    p_export.add_argument("--format", choices=["csv", "png"], default="png", help="导出格式")
    p_export.add_argument("--output", type=str, required=True, help="输出文件路径")
    p_export.add_argument("--title", type=str, default="")
    p_export.add_argument("--note", type=str, default="")
    p_export.set_defaults(func=cmd_export)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(0)

    args.func(args)


if __name__ == "__main__":
    main()
