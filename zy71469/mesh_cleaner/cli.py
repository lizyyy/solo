from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from .area import AreaResult, check_area_anomalies
from .audit import AuditLog
from .parser import ParsedMesh, parse_directory, parse_mesh_file
from .report import BatchReport, build_batch_report
from .topology import TopologyResult, check_topology


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="mesh-cleaner",
        description="三角网格面积清洗 — 批量检查孔洞、反法线和面积异常",
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    check_parser = subparsers.add_parser(
        "check", help="批量检查网格文件"
    )
    check_parser.add_argument(
        "input_path",
        help="网格文件或目录路径",
    )
    check_parser.add_argument(
        "-o", "--output",
        default=None,
        help="报告输出路径 (JSON格式，默认输出到stdout)",
    )
    check_parser.add_argument(
        "--z-threshold",
        type=float,
        default=3.0,
        help="面积异常Z-score阈值 (默认: 3.0)",
    )
    check_parser.add_argument(
        "--dot-threshold",
        type=float,
        default=0.0,
        help="反法线检测点积阈值 (默认: 0.0)",
    )
    check_parser.add_argument(
        "--min-area",
        type=float,
        default=1e-10,
        help="最小面积阈值，低于此值视为退化面 (默认: 1e-10)",
    )
    check_parser.add_argument(
        "--audit-dir",
        default=None,
        help="审计日志输出目录",
    )
    check_parser.add_argument(
        "--summary-only",
        action="store_true",
        help="仅输出摘要信息",
    )

    correct_parser = subparsers.add_parser(
        "correct", help="记录人工修正"
    )
    correct_parser.add_argument(
        "--audit-file",
        required=True,
        help="审计日志文件路径 (追加或新建)",
    )
    correct_parser.add_argument(
        "--file-path",
        required=True,
        help="被修正的网格文件路径",
    )
    correct_parser.add_argument(
        "--target-type",
        required=True,
        choices=["face_area", "normal", "vertex", "face"],
        help="修正对象类型",
    )
    correct_parser.add_argument(
        "--target-id",
        required=True,
        help="修正对象标识 (如面片索引)",
    )
    correct_parser.add_argument(
        "--old-value",
        required=True,
        help="修正前的旧值 (JSON格式)",
    )
    correct_parser.add_argument(
        "--new-value",
        required=True,
        help="修正后的新值 (JSON格式)",
    )
    correct_parser.add_argument(
        "--reason",
        required=True,
        help="修正理由",
    )
    correct_parser.add_argument(
        "--source-line",
        type=int,
        default=None,
        help="源文件行号",
    )
    correct_parser.add_argument(
        "--operator",
        default="manual",
        help="操作人 (默认: manual)",
    )

    review_parser = subparsers.add_parser(
        "review", help="复盘审计日志"
    )
    review_parser.add_argument(
        "audit_file",
        help="审计日志文件路径",
    )
    review_parser.add_argument(
        "--filter-file",
        default=None,
        help="按文件名筛选",
    )
    review_parser.add_argument(
        "--filter-action",
        default=None,
        choices=["correction", "auto_fix", "skip"],
        help="按操作类型筛选",
    )
    review_parser.add_argument(
        "--filter-type",
        default=None,
        choices=["face_area", "normal", "vertex", "face"],
        help="按对象类型筛选",
    )

    return parser


def cmd_check(args: argparse.Namespace) -> int:
    input_path = args.input_path
    if not os.path.exists(input_path):
        print(f"错误: 路径不存在: {input_path}", file=sys.stderr)
        return 1

    audit_log = AuditLog(log_dir=args.audit_dir)

    if os.path.isfile(input_path):
        try:
            meshes = [parse_mesh_file(input_path)]
        except ValueError as e:
            print(f"错误: {e}", file=sys.stderr)
            return 1
    elif os.path.isdir(input_path):
        meshes = parse_directory(input_path)
        if not meshes:
            print(f"警告: 目录中未找到网格文件: {input_path}", file=sys.stderr)
            return 0
    else:
        print(f"错误: 无效路径: {input_path}", file=sys.stderr)
        return 1

    topology_results: List[TopologyResult] = []
    area_results: List[AreaResult] = []

    for mesh in meshes:
        topo = check_topology(mesh, dot_threshold=args.dot_threshold)
        topology_results.append(topo)

        area = check_area_anomalies(
            mesh,
            z_threshold=args.z_threshold,
            min_area_threshold=args.min_area,
        )
        area_results.append(area)

        if topo.has_inverted_normals:
            for inv in topo.inverted_normal_issues:
                audit_log.record_auto_fix(
                    file_path=mesh.file_path,
                    file_name=mesh.file_name,
                    target_type="normal",
                    target_identifier=f"face_{inv.face_index}",
                    old_value={
                        "computed_normal": list(inv.computed_normal),
                        "file_normal": list(inv.file_normal) if inv.file_normal else None,
                        "dot_product": inv.dot_product,
                    },
                    new_value={"status": "flagged_inverted_normal"},
                    reason=inv.description,
                    source_line=inv.source_line,
                )

    report = build_batch_report(meshes, topology_results, area_results, audit_log)

    if args.summary_only:
        print(report.print_summary())
    else:
        if args.output:
            report_path = report.save(args.output)
            print(f"报告已保存: {report_path}")
        else:
            print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))

    if args.audit_dir and audit_log.entries:
        audit_path = audit_log.save()
        print(f"审计日志已保存: {audit_path}", file=sys.stderr)

    has_problems = any(f.has_any_issue for f in report.files)
    return 1 if has_problems else 0


def cmd_correct(args: argparse.Namespace) -> int:
    try:
        old_value = json.loads(args.old_value)
    except json.JSONDecodeError:
        old_value = args.old_value

    try:
        new_value = json.loads(args.new_value)
    except json.JSONDecodeError:
        new_value = args.new_value

    file_name = os.path.basename(args.file_path)

    if os.path.exists(args.audit_file):
        audit_log = AuditLog.load(args.audit_file)
    else:
        audit_log = AuditLog()

    audit_log.record_correction(
        file_path=args.file_path,
        file_name=file_name,
        target_type=args.target_type,
        target_identifier=args.target_id,
        old_value=old_value,
        new_value=new_value,
        reason=args.reason,
        operator=args.operator,
        source_line=args.source_line,
    )

    audit_log.save(args.audit_file)
    print(f"修正记录已追加: {args.audit_file}")

    entry = audit_log.entries[-1]
    print(f"  时间: {entry.timestamp}")
    print(f"  文件: {entry.file_name}")
    print(f"  对象: {entry.target_type} {entry.target_identifier}")
    print(f"  旧值: {entry.old_value}")
    print(f"  新值: {entry.new_value}")
    print(f"  理由: {entry.reason}")
    return 0


def cmd_review(args: argparse.Namespace) -> int:
    if not os.path.exists(args.audit_file):
        print(f"错误: 审计日志文件不存在: {args.audit_file}", file=sys.stderr)
        return 1

    audit_log = AuditLog.load(args.audit_file)
    entries = audit_log.entries

    if args.filter_file:
        entries = [e for e in entries if args.filter_file in e.file_name]
    if args.filter_action:
        entries = [e for e in entries if e.action == args.filter_action]
    if args.filter_type:
        entries = [e for e in entries if e.target_type == args.filter_type]

    if not entries:
        print("无匹配的审计记录")
        return 0

    print(f"审计记录共 {len(entries)} 条")
    print("=" * 60)

    for i, entry in enumerate(entries, 1):
        action_label = {
            "correction": "人工修正",
            "auto_fix": "自动标记",
            "skip": "跳过",
        }.get(entry.action, entry.action)

        type_label = {
            "face_area": "面片面积",
            "normal": "法线",
            "vertex": "顶点",
            "face": "面片",
        }.get(entry.target_type, entry.target_type)

        print(f"\n[{i}] {entry.timestamp}")
        print(f"    操作: {action_label} ({entry.operator})")
        print(f"    文件: {entry.file_name}")
        print(f"    对象: {type_label} {entry.target_identifier}")
        if entry.source_line is not None:
            print(f"    行号: {entry.source_line}")
        print(f"    旧值: {json.dumps(entry.old_value, ensure_ascii=False)}")
        print(f"    新值: {json.dumps(entry.new_value, ensure_ascii=False)}")
        print(f"    理由: {entry.reason}")

    print("\n" + "=" * 60)
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = create_parser()
    args = parser.parse_args(argv)

    if args.command is None:
        parser.print_help()
        return 1

    if args.command == "check":
        return cmd_check(args)
    elif args.command == "correct":
        return cmd_correct(args)
    elif args.command == "review":
        return cmd_review(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
