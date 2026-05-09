import os
import sys
import argparse
import traceback
from typing import List, Optional
from config import AppConfig
from data_loader import DataLoader, LoadResult
from quality_control import QualityControl, QCResult
from efficiency_calculator import EfficiencyCalculator, CalculationResult
from report_generator import ReportGenerator
from data_exporter import DataExporter


def run_pipeline(
    input_file: str,
    output_dir: Optional[str] = None,
    export_formats: List[str] = None,
    verbose: bool = True
) -> dict:
    config = AppConfig()
    if output_dir:
        config.output_dir = output_dir

    results = {
        'load_result': None,
        'qc_result': None,
        'calc_result': None,
        'report': None,
        'export': None,
        'success': False,
        'errors': [],
        'warnings': []
    }

    try:
        if verbose:
            print("=" * 60)
            print("☀️  光伏逆变器效率复算器")
            print("=" * 60)
            print(f"\n📁 输入文件: {input_file}")

        loader = DataLoader(config)
        load_result = loader.load(input_file)
        results['load_result'] = load_result
        results['warnings'].extend(load_result.warnings)

        if verbose:
            print("\n[1/5] 数据加载与清洗...")
            for w in load_result.warnings:
                print(f"  ⚠️  {w}")

        if not load_result.success:
            print("\n❌ 数据加载失败:")
            for e in load_result.errors:
                print(f"  ❌ {e}")
            results['errors'].extend(load_result.errors)
            return results

        if verbose:
            print(f"  ✅ 加载 {len(load_result.data)} 行数据")

        qc = QualityControl(config)
        qc_result = qc.run(load_result.data)
        results['qc_result'] = qc_result

        if verbose:
            print("\n[2/5] 数据质量控制...")
            summary = qc_result.summary
            print(f"  ✅ 原始数据: {summary['total_raw_rows']} 行")
            print(f"  ✅ 清洗后数据: {summary['total_clean_rows']} 行")
            print(f"  ✅ 排除数据: {summary['rows_excluded']} 行 ({summary['exclusion_rate']*100:.1f}%)")
            if qc_result.issues:
                print(f"  📊 发现 {len(qc_result.issues)} 个质量问题")
                for issue_type, count in summary.get('issues_by_type', {}).items():
                    print(f"     - {issue_type}: {count}")

        if len(qc_result.clean_data) == 0:
            print("\n❌ 没有有效数据可用于计算")
            results['errors'].append("没有有效数据可用于计算")
            return results

        calculator = EfficiencyCalculator(config)
        calc_result = calculator.run(qc_result.clean_data, qc_result)
        results['calc_result'] = calc_result

        if verbose:
            print("\n[3/5] 效率计算...")
            overall = calc_result.overall_metrics
            print(f"  ✅ 逆变器总数: {overall.get('total_inverters', 0)}")
            print(f"  ✅ 有效排名数: {overall.get('ranked_inverters', 0)}")
            print(f"  ✅ 平均调整后效率: {overall.get('average_adjusted_efficiency', 0)*100:.2f}%")
            print(f"  ✅ 平均 PR: {overall.get('average_pr', 0):.3f}")

            ranked = calc_result.inverter_level_data[calc_result.inverter_level_data['rank'].notna()]
            if len(ranked) > 0:
                print("\n  📊 效率排名 Top 5:")
                for _, row in ranked.head(5).iterrows():
                    print(f"     #{int(row['rank'])} {row['inverter_id']}: {row['adjusted_efficiency']*100:.2f}% (QS: {row['data_quality_score']:.2f})")

            unranked = calc_result.inverter_level_data[calc_result.inverter_level_data['rank'].isna()]
            if len(unranked) > 0:
                print(f"\n  ⚠️  {len(unranked)} 台逆变器未参与排名:")
                for _, row in unranked.iterrows():
                    reason = row.get('rank_reason') or '数据质量不足'
                    print(f"     - {row['inverter_id']}: {reason}")

        reporter = ReportGenerator(config)
        report = reporter.generate(load_result, qc_result, calc_result)
        results['report'] = report

        if verbose:
            print("\n[4/5] 生成报告...")
            print(f"  ✅ HTML 报告: {report.html_path}")
            for chart in report.chart_paths:
                print(f"  ✅ 图表: {os.path.basename(chart)}")

        if export_formats:
            exporter = DataExporter(config)
            export_result = exporter.export(
                load_result, qc_result, calc_result,
                formats=export_formats
            )
            results['export'] = export_result

            if verbose:
                print("\n[5/5] 导出数据...")
                if export_result.success:
                    for f in export_result.files:
                        print(f"  ✅ {f}")
                else:
                    for e in export_result.errors:
                        print(f"  ❌ {e}")
                    results['errors'].extend(export_result.errors)

        results['success'] = len(results['errors']) == 0

        if verbose:
            print("\n" + "=" * 60)
            if results['success']:
                print("✅ 处理完成！")
            else:
                print("⚠️  处理完成，但存在错误")
                for e in results['errors']:
                    print(f"   ❌ {e}")
            print("=" * 60)

    except Exception as e:
        error_msg = f"处理过程中发生异常: {str(e)}"
        results['errors'].append(error_msg)
        results['errors'].append(traceback.format_exc())
        if verbose:
            print(f"\n❌ {error_msg}")
            print(traceback.format_exc())

    return results


def generate_sample_data(output_path: str, num_inverters: int = 5, rows_per_inv: int = 50) -> str:
    import numpy as np
    import pandas as pd

    np.random.seed(42)

    inverters = [f"INV-{i+1:03d}" for i in range(num_inverters)]
    base_date = pd.Timestamp("2024-06-15")

    data = []
    for inv_idx, inv_id in enumerate(inverters):
        capacity = 500 + np.random.randint(-100, 200)
        true_efficiency = 0.92 + inv_idx * 0.01

        for hour in range(rows_per_inv):
            timestamp = base_date + pd.Timedelta(hours=hour * 0.5)
            hour_of_day = timestamp.hour + timestamp.minute / 60

            irradiance = max(0, 1000 * np.sin(np.pi * (hour_of_day - 6) / 12))
            irradiance += np.random.normal(0, 50)
            irradiance = max(0, irradiance)

            temperature = 20 + 15 * (hour_of_day / 24) + np.random.normal(0, 3)

            temp_factor = 1 + (-0.004) * (temperature - 25)
            dc_energy = capacity * (irradiance / 1000) * temp_factor * 0.5
            actual_gen = dc_energy * true_efficiency * np.random.normal(1, 0.02)
            actual_gen = max(0, actual_gen)

            data.append({
                '逆变器编号': inv_id,
                '时间': timestamp,
                '辐照度': round(irradiance, 1),
                '温度': round(temperature, 1),
                '发电量': round(actual_gen, 3),
                '装机容量': capacity
            })

    df = pd.DataFrame(data)

    num_bad = int(len(df) * 0.1)
    bad_indices = np.random.choice(df.index, num_bad, replace=False)

    for idx in bad_indices[:5]:
        df.loc[idx, '辐照度'] = np.nan
    for idx in bad_indices[5:10]:
        df.loc[idx, '发电量'] = -100
    for idx in bad_indices[10:15]:
        df.loc[idx, '温度'] = 150
    for idx in bad_indices[15:20]:
        df.loc[idx, '辐照度'] = 5000

    df = pd.concat([df, df.iloc[:3]], ignore_index=True)

    if output_path.endswith('.csv'):
        df.to_csv(output_path, index=False, encoding='utf-8-sig')
    else:
        df.to_excel(output_path, index=False)

    return output_path


def main():
    parser = argparse.ArgumentParser(description='光伏逆变器效率复算器')
    parser.add_argument('input', nargs='?', help='输入数据文件路径 (CSV或Excel)')
    parser.add_argument('-o', '--output', help='输出目录')
    parser.add_argument('-e', '--export', nargs='+', default=['xlsx'],
                       choices=['xlsx', 'csv'], help='导出格式')
    parser.add_argument('--sample', action='store_true', help='生成示例数据')
    parser.add_argument('--sample-path', default='./sample_data.csv',
                       help='示例数据输出路径')
    parser.add_argument('-q', '--quiet', action='store_true', help='安静模式')

    args = parser.parse_args()

    if args.sample:
        print(f"生成示例数据到: {args.sample_path}")
        path = generate_sample_data(args.sample_path)
        print(f"✅ 示例数据已生成: {path}")
        print(f"\n运行以下命令进行分析:")
        print(f"  python main.py {args.sample_path}")
        return

    if not args.input:
        parser.print_help()
        print("\n示例用法:")
        print("  python main.py --sample                          # 生成示例数据")
        print("  python main.py sample_data.csv                    # 分析示例数据")
        print("  python main.py data.xlsx -e xlsx csv              # 导出多种格式")
        print("  python main.py data.csv -o ./results              # 指定输出目录")
        return

    if not os.path.exists(args.input):
        print(f"❌ 文件不存在: {args.input}")
        print("\n提示: 使用 --sample 生成示例数据")
        sys.exit(1)

    run_pipeline(
        input_file=args.input,
        output_dir=args.output,
        export_formats=args.export,
        verbose=not args.quiet
    )


if __name__ == '__main__':
    main()
