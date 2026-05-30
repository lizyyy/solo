import argparse
import os
import sys
import glob
from typing import List, Optional
from pathlib import Path

from .analyzer import BeatAnalyzer
from .report import ReportGenerator
from .models import AnalysisResult


def parse_args():
    parser = argparse.ArgumentParser(
        description="🥁 鼓手节拍偏差分析 - 分析架子鼓练习录音的节拍稳定性",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 分析单个音频文件
  drum-analyzer --input ./audio/song.wav --output ./results

  # 分析整个目录下的所有音频
  drum-analyzer --input ./audio/ --output ./results/

  # 指定参考节拍点文件
  drum-analyzer --input ./audio/song.wav --reference ./beats/song.txt --output ./results

  # 与上次分析结果比较进步
  drum-analyzer --input ./audio/song.wav --previous ./results/last_week.json --output ./results

  # 自定义拍号和BPM
  drum-analyzer --input ./audio/song.wav --time-signature 6 8 --bpm 120 --output ./results

  # 自定义拖拍抢拍阈值
  drum-analyzer --input ./audio/song.wav --lag-threshold 40 --lead-threshold 40 --output ./results
        """,
    )

    parser.add_argument(
        "--input",
        "-i",
        required=True,
        help="输入音频文件或目录（支持 .wav, .mp3, .flac 等格式）",
    )
    parser.add_argument(
        "--output",
        "-o",
        required=True,
        help="输出目录，用于存放分析结果和详细报告",
    )
    parser.add_argument(
        "--reference",
        "-r",
        help="参考节拍点文件（.txt 或 .json 格式）",
    )
    parser.add_argument(
        "--previous",
        "-p",
        help="上次分析结果的 JSON 文件，用于比较进步情况",
    )
    parser.add_argument(
        "--time-signature",
        nargs=2,
        type=int,
        default=[4, 4],
        metavar=("BEATS", "NOTE_VALUE"),
        help="拍号，默认为 4 4",
    )
    parser.add_argument(
        "--bpm",
        type=float,
        help="参考 BPM，如果不指定则自动检测",
    )
    parser.add_argument(
        "--lag-threshold",
        type=int,
        default=30,
        help="拖拍判定阈值（毫秒），默认 30ms",
    )
    parser.add_argument(
        "--lead-threshold",
        type=int,
        default=30,
        help="抢拍判定阈值（毫秒，正数），默认 30ms",
    )
    parser.add_argument(
        "--format",
        choices=["text", "json", "html", "all"],
        default="all",
        help="输出格式，默认全部生成",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="显示详细分析过程",
    )
    parser.add_argument(
        "--batch",
        action="store_true",
        help="批量处理目录下的所有音频文件",
    )

    return parser.parse_args()


def get_audio_files(input_path: str) -> List[str]:
    if os.path.isfile(input_path):
        return [input_path]

    audio_extensions = [".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"]
    audio_files = []
    for ext in audio_extensions:
        audio_files.extend(glob.glob(os.path.join(input_path, f"*{ext}")))
        audio_files.extend(glob.glob(os.path.join(input_path, f"*{ext.upper()}")))

    return sorted(audio_files)


def find_reference_file(
    audio_file: str, reference_arg: Optional[str]
) -> Optional[str]:
    if reference_arg and os.path.exists(reference_arg):
        return reference_arg

    base_name = os.path.splitext(os.path.basename(audio_file))[0]
    audio_dir = os.path.dirname(audio_file)

    for ext in [".txt", ".json"]:
        candidate = os.path.join(audio_dir, f"{base_name}_beats{ext}")
        if os.path.exists(candidate):
            return candidate
        candidate = os.path.join(audio_dir, f"{base_name}{ext}")
        if os.path.exists(candidate):
            return candidate

    return None


def find_previous_result(
    audio_file: str, previous_arg: Optional[str], output_dir: str
) -> Optional[str]:
    if previous_arg and os.path.exists(previous_arg):
        return previous_arg

    base_name = os.path.splitext(os.path.basename(audio_file))[0]

    candidate = os.path.join(output_dir, f"{base_name}_analysis_result.json")
    if os.path.exists(candidate):
        return candidate

    return None


def process_file(
    audio_file: str,
    reference_file: Optional[str],
    previous_file: Optional[str],
    output_dir: str,
    time_signature: tuple,
    reference_bpm: Optional[float],
    lag_threshold_ms: int,
    lead_threshold_ms: int,
    output_format: str,
    verbose: bool,
) -> Optional[AnalysisResult]:
    print(f"\n{'=' * 70}")
    print(f"🎵 正在分析: {os.path.basename(audio_file)}")
    print(f"{'=' * 70}")

    if verbose:
        print(f"  参考节拍点: {reference_file or '未提供'}")
        print(f"  上次结果: {previous_file or '未提供'}")
        print(f"  拍号: {time_signature[0]}/{time_signature[1]}")
        print(f"  参考 BPM: {reference_bpm or '自动检测'}")
        print(f"  拖拍阈值: {lag_threshold_ms}ms")
        print(f"  抢拍阈值: {lead_threshold_ms}ms")
        print()

    try:
        analyzer = BeatAnalyzer(
            time_signature=time_signature,
            reference_bpm=reference_bpm,
            lag_threshold_ms=lag_threshold_ms,
            lead_threshold_ms=-lead_threshold_ms,
        )

        result = analyzer.analyze(
            audio_file=audio_file,
            reference_beats_file=reference_file,
            previous_result_file=previous_file,
        )

        if output_format in ["text", "all"]:
            summary = ReportGenerator.generate_terminal_summary(result)
            print("\n" + summary)

        if output_format in ["json", "all"]:
            json_path = ReportGenerator.generate_json_result(result, output_dir)
            print(f"\n📄 JSON 结果已保存: {json_path}")

        if output_format in ["html", "all"]:
            report_path = ReportGenerator.generate_detailed_report(result, output_dir)
            print(f"📊 详细报告已保存: {report_path}")

        return result

    except Exception as e:
        print(f"\n❌ 分析失败: {str(e)}", file=sys.stderr)
        if verbose:
            import traceback

            traceback.print_exc()
        return None


def main():
    args = parse_args()

    input_path = args.input
    output_dir = args.output
    time_signature = tuple(args.time_signature)
    reference_bpm = args.bpm
    lag_threshold_ms = args.lag_threshold
    lead_threshold_ms = args.lead_threshold
    output_format = args.format
    verbose = args.verbose

    os.makedirs(output_dir, exist_ok=True)

    audio_files = get_audio_files(input_path)

    if not audio_files:
        print(f"❌ 未找到音频文件: {input_path}", file=sys.stderr)
        sys.exit(1)

    is_batch = len(audio_files) > 1 or args.batch

    print(f"🥁 鼓手节拍偏差分析工具")
    print(f"📁 输入: {input_path}")
    print(f"📤 输出: {output_dir}")
    print(f"🎵 找到 {len(audio_files)} 个音频文件")

    results = []
    for i, audio_file in enumerate(audio_files, 1):
        if is_batch:
            print(f"\n[{i}/{len(audio_files)}]", end=" ")

        reference_file = find_reference_file(audio_file, args.reference)
        previous_file = find_previous_result(audio_file, args.previous, output_dir)

        result = process_file(
            audio_file=audio_file,
            reference_file=reference_file,
            previous_file=previous_file,
            output_dir=output_dir,
            time_signature=time_signature,
            reference_bpm=reference_bpm,
            lag_threshold_ms=lag_threshold_ms,
            lead_threshold_ms=lead_threshold_ms,
            output_format=output_format,
            verbose=verbose,
        )

        if result:
            results.append(result)

    if is_batch and len(results) > 1:
        print(f"\n{'=' * 70}")
        print("📊 批量分析汇总")
        print(f"{'=' * 70}")
        print(f"  成功分析: {len(results)} / {len(audio_files)} 个文件")

        avg_deviations = [r.overall_avg_deviation_ms for r in results]
        print(f"  平均偏差范围: {min(avg_deviations):.1f}ms - {max(avg_deviations):.1f}ms")

        total_lag = sum(len(r.lag_measures) for r in results)
        total_lead = sum(len(r.lead_measures) for r in results)
        total_missed = sum(len(r.missed_beat_measures) for r in results)
        print(f"  拖拍小节总数: {total_lag}")
        print(f"  抢拍小节总数: {total_lead}")
        print(f"  漏拍小节总数: {total_missed}")

        best_result = min(results, key=lambda r: r.overall_avg_deviation_ms)
        worst_result = max(results, key=lambda r: r.overall_avg_deviation_ms)
        print(
            f"  表现最好: {os.path.basename(best_result.audio_file)} ({best_result.overall_avg_deviation_ms:.1f}ms)"
        )
        print(
            f"  表现最差: {os.path.basename(worst_result.audio_file)} ({worst_result.overall_avg_deviation_ms:.1f}ms)"
        )
        print(f"{'=' * 70}")

    print(f"\n✅ 分析完成！所有结果已保存到: {output_dir}")


if __name__ == "__main__":
    main()
