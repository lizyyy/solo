from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .pipeline import run_pipeline
from .models import FlagStatus


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="dj-energy",
        description="DJ歌单能量曲线CLI - 分析歌单能量起伏，检测BPM误判、调性冲突和能量骤降",
    )
    parser.add_argument(
        "-i", "--input-dir",
        required=True,
        help="输入目录，包含CSV/JSON格式的曲目列表",
    )
    parser.add_argument(
        "-o", "--output-dir",
        required=True,
        help="输出目录，分析结果按run_id分目录存放",
    )
    parser.add_argument(
        "--run-id",
        default=None,
        help="指定运行ID，不指定则自动生成时间戳。重复运行使用不同ID不会覆盖旧结果",
    )
    parser.add_argument(
        "--steps",
        nargs="+",
        choices=["bpm_normalize", "key_compat", "energy_curve", "section_label", "report_export"],
        default=None,
        help="只运行指定步骤（默认全部运行）",
    )
    parser.add_argument(
        "--show-review",
        action="store_true",
        help="在终端显示待复核曲目列表",
    )
    parser.add_argument(
        "--show-curve",
        action="store_true",
        help="在终端显示能量曲线图",
    )
    return parser


def _print_curve(tracks) -> None:
    print("\n  能量曲线:")
    print("  " + "-" * 50)
    for t in tracks:
        if t.energy is not None:
            bars = int(t.energy)
            bar_str = "█" * bars + "░" * (10 - bars)
            bpm_str = f"BPM={t.bpm_normalized:.0f}" if t.bpm_normalized else "BPM=?"
            key_str = t.key_normalized or "?"
            review_flag = " ⚠REVIEW" if t.status == FlagStatus.REVIEW else ""
            print(f"  {t.position:3d} | {bar_str} E={t.energy:.1f} | {bpm_str} key={key_str} | {t.title[:25]}{review_flag}")
        else:
            print(f"  {t.position:3d} | ?????????? E=??? | {t.title[:25]} ⚠REVIEW")
    print("  " + "-" * 50)


def _print_review(tracks) -> None:
    review = [t for t in tracks if t.status == FlagStatus.REVIEW]
    if not review:
        print("\n  ✅ 无待复核曲目")
        return
    print(f"\n  ⚠ 待复核曲目 ({len(review)} 首):")
    for t in review:
        print(f"    pos {t.position:3d} | {t.track_id} | {t.title[:30]} | flags: {', '.join(t.flags)}")


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)

    if not input_dir.is_dir():
        print(f"Error: Input directory not found: {input_dir}", file=sys.stderr)
        return 1

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"📂 Input:  {input_dir}")
    print(f"📂 Output: {output_dir}")
    if args.run_id:
        print(f"🏷  Run ID: {args.run_id}")
    print()

    result = run_pipeline(
        input_dir=input_dir,
        output_dir=output_dir,
        run_id=args.run_id,
        steps=args.steps,
    )

    if not result.tracks:
        print("⚠ No tracks found. Check input directory.", file=sys.stderr)
        return 1

    review_count = len(result.review_tracks())
    print(f"🎵 分析完成: {len(result.tracks)} 首曲目")
    print(f"   段落: {len(result.sections)} | 过渡: {len(result.transitions)}")
    print(f"   待复核: {review_count}")

    for sr in result.step_results:
        status = "✅" if not sr.issues else f"⚠ ({len(sr.issues)} issues)"
        print(f"   [{sr.step_name}] {status} modified={sr.tracks_modified}")

    if result.meta and "output_files" in result.meta:
        print(f"\n📁 输出文件:")
        for name, path in result.meta['output_files'].items():
            print(f"   {name}: {path}")

    if args.show_curve:
        _print_curve(result.tracks)

    if args.show_review:
        _print_review(result.tracks)

    if review_count > 0 and not args.show_review:
        print(f"\n  提示: 使用 --show-review 查看待复核曲目")

    return 0


if __name__ == "__main__":
    sys.exit(main())
