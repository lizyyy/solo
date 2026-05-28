#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

from art_price_index import ArtPriceIndexPipeline


def main():
    parser = argparse.ArgumentParser(
        description="艺术品价格指数分析系统 - 按艺术家、媒介和时间构建价格指数"
    )
    parser.add_argument(
        "--input",
        "-i",
        type=str,
        default="./test_data",
        help="输入目录路径 (默认: ./test_data)",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default="./output",
        help="输出目录路径 (默认: ./output)",
    )
    parser.add_argument(
        "--currency",
        "-c",
        type=str,
        default="USD",
        help="目标币种 (默认: USD)",
    )
    parser.add_argument(
        "--period",
        "-p",
        type=str,
        default="monthly",
        choices=["yearly", "quarterly", "monthly", "weekly"],
        help="指数周期 (默认: monthly)",
    )
    parser.add_argument(
        "--outlier-method",
        type=str,
        default="robust",
        choices=["robust", "iqr", "zscore", "percentile"],
        help="异常值检测方法 (默认: robust)",
    )

    args = parser.parse_args()

    input_dir = Path(args.input)
    if not input_dir.exists():
        print(f"错误: 输入目录不存在: {input_dir}")
        sys.exit(1)

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    pipeline = ArtPriceIndexPipeline(
        input_dir=str(input_dir),
        output_dir=str(output_dir),
        target_currency=args.currency,
        period=args.period,
        outlier_method=args.outlier_method,
    )

    result = pipeline.run()

    print("\n" + "=" * 60)
    print("结果摘要")
    print("=" * 60)
    summary = result.to_summary_dict()
    for key, value in summary.items():
        if isinstance(value, dict):
            print(f"\n{key}:")
            for k, v in value.items():
                print(f"  {k}: {v}")
        else:
            print(f"{key}: {value}")

    print(f"\n报告已生成在: {output_dir}")
    print(f"  - 文本报告: {output_dir / 'report.txt'}")
    print(f"  - JSON报告: {output_dir / 'report.json'}")
    print(f"  - 记录CSV: {output_dir / 'records.csv'}")

    return 0 if result.status.value in ("completed", "partial") else 1


if __name__ == "__main__":
    sys.exit(main())
