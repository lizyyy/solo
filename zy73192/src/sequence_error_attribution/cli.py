import argparse
import sys
import os
from typing import List

from .config import DEFAULT_CONFIG, STABLE_MESSAGES, AttributionConfig
from .pipeline import AttributionPipeline


def build_parser() -> argparse.ArgumentParser:
    """
    构建命令行参数解析器
    参数名保持稳定，便于日常脚本调用
    """
    parser = argparse.ArgumentParser(
        prog="sequence-error-attribution",
        description="数列递推错题归因分析系统 - 自动分析学生错题原因",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  基本分析:
    sequence-error-attribution --input-file 错题清单.csv --output-dir ./output

  自定义输出文件名:
    sequence-error-attribution --input-file 月考错题.xlsx --output-dir ./output --base-filename 月考分析

  调整参数:
    sequence-error-attribution --input-file 题目清单.csv --output-dir ./output --min-sample-size 5

  日常脚本调用（参数名稳定）:
    sequence-error-attribution --input-file $INPUT --output-dir $OUTPUT --base-filename $PREFIX
        """,
    )

    parser.add_argument(
        "--input-file",
        type=str,
        required=True,
        help="题目清单文件路径 (支持CSV和Excel格式) - 参数名保持稳定",
        metavar="FILE_PATH",
    )

    parser.add_argument(
        "--output-dir",
        type=str,
        required=True,
        help="输出目录路径 - 参数名保持稳定",
        metavar="DIR_PATH",
    )

    parser.add_argument(
        "--base-filename",
        type=str,
        default="sequence_error_attribution",
        help="输出文件的基础名称 (默认: sequence_error_attribution) - 参数名保持稳定",
        metavar="NAME",
    )

    parser.add_argument(
        "--min-sample-size",
        type=int,
        default=DEFAULT_CONFIG.min_sample_size,
        help=f"边界样本最小量，低于此值需人工复核 (默认: {DEFAULT_CONFIG.min_sample_size})",
        metavar="N",
    )

    parser.add_argument(
        "--jump-threshold-ratio",
        type=float,
        default=DEFAULT_CONFIG.jump_threshold_ratio,
        help=f"跳变检测阈值倍数 (默认: {DEFAULT_CONFIG.jump_threshold_ratio})",
        metavar="RATIO",
    )

    parser.add_argument(
        "--unit-magnitude-threshold",
        type=int,
        default=DEFAULT_CONFIG.unit_magnitude_threshold,
        help=f"单位异常数量级阈值 (默认: {DEFAULT_CONFIG.unit_magnitude_threshold})",
        metavar="N",
    )

    parser.add_argument(
        "--zero-tolerance",
        type=float,
        default=DEFAULT_CONFIG.zero_tolerance,
        help=f"零值容差 (默认: {DEFAULT_CONFIG.zero_tolerance})",
        metavar="EPSILON",
    )

    parser.add_argument(
        "--version",
        action="version",
        version="%(prog)s 1.0.0",
        help="显示版本信息",
    )

    return parser


def main(args: List[str] = None) -> int:
    """
    主入口函数
    参数名和错误提示保持稳定，便于日常脚本调用
    """
    parser = build_parser()

    try:
        parsed_args = parser.parse_args(args)
    except SystemExit as e:
        return e.code

    try:
        config = AttributionConfig(
            min_sample_size=parsed_args.min_sample_size,
            jump_threshold_ratio=parsed_args.jump_threshold_ratio,
            unit_magnitude_threshold=parsed_args.unit_magnitude_threshold,
            zero_tolerance=parsed_args.zero_tolerance,
        )
    except Exception as e:
        print(f"[错误] 配置参数无效: {str(e)}", file=sys.stderr)
        return 2

    if not os.path.exists(parsed_args.input_file):
        print(
            f"[错误] {STABLE_MESSAGES.ERROR_FILE_NOT_FOUND.format(file_path=parsed_args.input_file)}",
            file=sys.stderr,
        )
        return 3

    input_ext = os.path.splitext(parsed_args.input_file)[1].lower()
    if input_ext not in ['.csv', '.xlsx', '.xls']:
        print(
            f"[错误] {STABLE_MESSAGES.ERROR_INVALID_FILE_FORMAT.format(file_path=parsed_args.input_file)}",
            file=sys.stderr,
        )
        return 4

    try:
        pipeline = AttributionPipeline(config=config)
        result = pipeline.run(
            input_file=parsed_args.input_file,
            output_dir=parsed_args.output_dir,
            base_filename=parsed_args.base_filename,
        )

        if result.failed_count > 0:
            return 5
        return 0

    except FileNotFoundError as e:
        print(f"[错误] {str(e)}", file=sys.stderr)
        return 3

    except ValueError as e:
        error_msg = str(e)
        if STABLE_MESSAGES.ERROR_EMPTY_DATA in error_msg:
            print(f"[错误] {STABLE_MESSAGES.ERROR_EMPTY_DATA}", file=sys.stderr)
        else:
            print(f"[错误] {error_msg}", file=sys.stderr)
        return 4

    except Exception as e:
        print(f"[错误] 处理过程中发生未知错误: {str(e)}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
