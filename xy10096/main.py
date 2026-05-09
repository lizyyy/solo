#!/usr/bin/env python3
import os
import sys
import argparse
import pandas as pd
from typing import Optional, Dict, Any

from fermentation_qc.data_preprocessing import DataPreprocessor
from fermentation_qc.quality_control import QualityControlEngine
from fermentation_qc.visualization import Visualizer
from fermentation_qc.reporting import ReportGenerator
from fermentation_qc.sample_data import generate_test_dataset


def run_fermentation_qc(
    input_file: Optional[str] = None,
    output_dir: str = "./output",
    unit_info: Optional[Dict[str, str]] = None,
    missing_threshold: float = 0.3,
    generate_pdf: bool = True,
    verbose: bool = True,
) -> Dict[str, Any]:
    os.makedirs(output_dir, exist_ok=True)

    if verbose:
        print("=" * 60)
        print("🔬 发酵曲线异常判读系统")
        print("=" * 60)

    if input_file is None:
        if verbose:
            print("\n📊 未指定输入文件，生成示例测试数据...")
        input_file = os.path.join(output_dir, "test_data.csv")
        df = generate_test_dataset(output_path=input_file)
        if verbose:
            print(f"   ✓ 生成测试数据: {input_file}")
            print(f"   ✓ 样本数量: {df['sample_id'].nunique()}")
            print(f"   ✓ 总数据点数: {len(df)}")
    else:
        if verbose:
            print(f"\n📂 加载数据文件: {input_file}")
        preprocessor = DataPreprocessor()
        df = preprocessor.load_data(input_file)

    if verbose:
        print("\n⚙️  步骤 1: 数据预处理")
        print("-" * 40)

    preprocessor = DataPreprocessor(
        missing_threshold=missing_threshold,
        duplicate_strategy="keep_first",
        interpolation_method="linear",
    )

    preprocessing_result = preprocessor.process_all_samples(df, unit_info)

    if verbose:
        print(f"   ✓ 总样本数: {preprocessing_result['total_samples']}")
        print(f"   ✓ 预处理成功: {preprocessing_result['success_count']}")
        print(f"   ✗ 预处理失败: {preprocessing_result['failed_count']}")

        if preprocessing_result['failed_samples']:
            print("\n   预处理失败样本:")
            for sample_id, result in preprocessing_result['failed_samples'].items():
                for error in result.get('errors', []):
                    print(f"      - {sample_id}: {error['message']}")

    if verbose:
        print("\n📐 步骤 2: 质量控制规则检查")
        print("-" * 40)

    qc_engine = QualityControlEngine()
    qc_results = qc_engine.analyze_batch(preprocessing_result['processed_samples'])
    summary = qc_results['summary']

    if verbose:
        print(f"   ✓ 通过样本: {summary['pass_count']}")
        print(f"   ⚠️  警告样本: {summary['warning_count']}")
        print(f"   ✗ 失败样本: {summary['fail_count']}")
        print(f"   🔍 需复检: {summary['requires_recheck_count']}")

        if summary['recheck_samples']:
            print("\n   需复检样本列表:")
            for sample in summary['recheck_samples']:
                print(f"      - {sample['sample_id']}: {sample['status']} - {sample['reason']}")

    if verbose:
        print("\n📈 步骤 3: 生成可视化报告")
        print("-" * 40)

    visualizer = Visualizer()

    first_sample_id = list(qc_results['results'].keys())[0]
    first_sample_data = preprocessing_result['processed_samples'][first_sample_id]['dataframe']
    first_qc_result = qc_results['results'].get(first_sample_id)
    visualizer.save_sample_plot(
        first_sample_data,
        first_sample_id,
        os.path.join(output_dir, "overview.png"),
        first_qc_result,
    )

    fig = visualizer.plot_quality_distribution(summary)
    fig.savefig(os.path.join(output_dir, "quality_distribution.png"), bbox_inches='tight')
    import matplotlib.pyplot as plt
    plt.close(fig)

    fig = visualizer.plot_parameter_statistics(preprocessing_result['processed_samples'])
    fig.savefig(os.path.join(output_dir, "parameter_statistics.png"), bbox_inches='tight')
    plt.close(fig)

    fig = visualizer.plot_recheck_recommendations(summary)
    fig.savefig(os.path.join(output_dir, "recheck_recommendations.png"), bbox_inches='tight')
    plt.close(fig)

    if generate_pdf:
        pdf_path = os.path.join(output_dir, "qc_report.pdf")
        visualizer.export_pdf_report(
            preprocessing_result['processed_samples'],
            qc_results,
            pdf_path,
        )
        if verbose:
            print(f"   ✓ PDF报告: {pdf_path}")

    if verbose:
        print("\n📄 步骤 4: 导出数据报告")
        print("-" * 40)

    report_generator = ReportGenerator()
    generated_files = report_generator.export_all(
        qc_results,
        preprocessing_result['processed_samples'],
        output_dir,
        preprocessing_result['processing_log'],
    )

    if verbose:
        for fmt, path in generated_files.items():
            if isinstance(path, dict):
                for sub_key, sub_path in path.items():
                    print(f"   ✓ {fmt}/{sub_key}: {sub_path}")
            else:
                print(f"   ✓ {fmt}: {path}")

    if verbose:
        print("\n" + "=" * 60)
        print(f"✅ 分析完成! 输出目录: {output_dir}")
        print("=" * 60)
        print("\n📋 关键结论:")
        print(f"   - 总样本数: {summary['total_samples']}")
        print(f"   - 通过率: {summary['pass_rate'] * 100:.1f}%")
        print(f"   - 需复检率: {summary['recheck_rate'] * 100:.1f}%")
        if summary['recheck_samples']:
            print(f"   - 建议优先复检: {[s['sample_id'] for s in summary['recheck_samples'][:3]]}")

    return {
        "preprocessing": preprocessing_result,
        "quality_control": qc_results,
        "output_dir": output_dir,
        "generated_files": generated_files,
    }


def main():
    parser = argparse.ArgumentParser(
        description="发酵曲线异常判读系统 - 自动化质控与复检推荐",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python main.py
  python main.py --input data.csv --output ./results
  python main.py --input fermentation.xlsx --missing-threshold 0.2
        """,
    )

    parser.add_argument(
        "--input", "-i",
        type=str,
        default=None,
        help="输入数据文件路径 (支持 .csv, .xlsx, .xls)，不指定则生成测试数据",
    )

    parser.add_argument(
        "--output", "-o",
        type=str,
        default="./output",
        help="输出目录路径 (默认: ./output)",
    )

    parser.add_argument(
        "--missing-threshold", "-m",
        type=float,
        default=0.3,
        help="缺失值容忍阈值 (0-1，默认: 0.3)",
    )

    parser.add_argument(
        "--no-pdf",
        action="store_true",
        help="跳过PDF图表生成",
    )

    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="静默模式，减少输出",
    )

    args = parser.parse_args()

    try:
        result = run_fermentation_qc(
            input_file=args.input,
            output_dir=args.output,
            missing_threshold=args.missing_threshold,
            generate_pdf=not args.no_pdf,
            verbose=not args.quiet,
        )
        return 0
    except Exception as e:
        if not args.quiet:
            print(f"\n❌ 运行错误: {e}")
            import traceback
            traceback.print_exc()

        error_dir = args.output
        os.makedirs(error_dir, exist_ok=True)
        error_log_path = os.path.join(error_dir, "error_log.txt")
        with open(error_log_path, "w", encoding="utf-8") as f:
            f.write(f"错误时间: {pd.Timestamp.now()}\n")
            f.write(f"错误信息: {e}\n")
            import traceback
            f.write(traceback.format_exc())

        if not args.quiet:
            print(f"详细错误日志已保存到: {error_log_path}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
