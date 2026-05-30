from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path

from .aligner import align_timestamps
from .merger import merge_channels
from .reporter import export_detail_report, print_summary
from .scanner import load_channel_table, load_part_assignment, scan_directory


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="live-track-organizer",
        description="现场多轨命名整理 — 扫描、通道归并、时间对齐、重命名",
    )
    parser.add_argument("input_dir", help="多轨文件输入目录")
    parser.add_argument("output_dir", help="整理后文件输出目录")
    parser.add_argument(
        "--channel-table", "-c", default=None, help="通道表文件 (轨道号 通道名)"
    )
    parser.add_argument(
        "--part-assignment", "-p", default=None, help="声部分配文件 (通道名 声部)"
    )
    parser.add_argument(
        "--tolerance", "-t", type=float, default=2.0, help="时间戳对齐容差(秒), 默认2.0"
    )
    parser.add_argument(
        "--copy", action="store_true", default=True, help="复制文件到输出目录(默认)"
    )
    parser.add_argument(
        "--move", action="store_true", default=False, help="移动文件到输出目录(替代复制)"
    )
    parser.add_argument(
        "--dry-run", "-n", action="store_true", default=False, help="仅预览，不实际操作文件"
    )
    parser.add_argument(
        "--no-report", action="store_true", default=False, help="不导出明细报告文件"
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    input_dir = os.path.abspath(args.input_dir)
    output_dir = os.path.abspath(args.output_dir)

    if not os.path.isdir(input_dir):
        print(f"错误: 输入目录不存在 — {input_dir}", file=sys.stderr)
        return 1

    print(f"[1/4] 扫描输入目录: {input_dir}")
    tracks = scan_directory(input_dir)
    if not tracks:
        print("未发现音频文件，退出。", file=sys.stderr)
        return 1
    print(f"      发现 {len(tracks)} 条轨道")

    ch_table = None
    if args.channel_table:
        print(f"[2/4] 加载通道表: {args.channel_table}")
        ch_table = load_channel_table(args.channel_table)
        print(f"      通道表条目: {len(ch_table)}")
    else:
        print("[2/4] 未指定通道表，跳过")

    part_assign = None
    if args.part_assignment:
        print(f"      加载声部分配: {args.part_assignment}")
        part_assign = load_part_assignment(args.part_assignment)
        print(f"      声部分配条目: {len(part_assign)}")
    else:
        print("      未指定声部分配，跳过")

    print("[3/4] 通道归并 + 时间对齐")
    result = merge_channels(tracks, ch_table, part_assign)
    result = align_timestamps(result, tolerance_seconds=args.tolerance)

    print_summary(result)

    if not args.no_report:
        report_path = export_detail_report(result, output_dir)
        print(f"明细报告已导出: {report_path}")

    if args.dry_run:
        print("\n(dry-run 模式，未实际操作文件)")
        return 0

    print(f"[4/4] {'移动' if args.move else '复制'}文件到: {output_dir}")
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    success_count = 0
    for track in result.tracks:
        src = track.file_path
        dst = os.path.join(output_dir, track.new_name)
        try:
            if args.move:
                shutil.move(src, dst)
            else:
                shutil.copy2(src, dst)
            success_count += 1
        except OSError as e:
            print(f"  ✗ {track.original_name} → 失败: {e}", file=sys.stderr)

    print(f"      完成: {success_count}/{len(result.tracks)} 个文件")
    return 0


if __name__ == "__main__":
    sys.exit(main())
