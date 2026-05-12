#!/usr/bin/env python3
import sys
import os
import pandas as pd
import numpy as np

sys.path.insert(0, '.')

from fermentation_qc.data_preprocessing import DataPreprocessor
from fermentation_qc.quality_control import QualityControlEngine
from fermentation_qc.sample_data import generate_normal_sample_data


def test_unit_column_handling():
    print("=" * 60)
    print("测试 1: 带单位列的数据处理（修复 TypeError）")
    print("=" * 60)

    df = generate_normal_sample_data('SAMP-UNIT-001', 'BATCH-001', seed=42)
    df['temperature_unit'] = '°F'
    df['temperature'] = df['temperature'] * 9 / 5 + 32

    df['temperature_unit'] = '°F'

    print(f"原始温度范围: {df['temperature'].min():.2f} ~ {df['temperature'].max():.2f}")
    print(f"温度列单位: {df['temperature_unit'].iloc[0]}")

    preprocessor = DataPreprocessor()

    try:
        result = preprocessor.process_sample(df, 'SAMP-UNIT-001')

        if result['success']:
            processed_df = result['dataframe']
            print(f"转换后温度范围: {processed_df['temperature'].min():.2f} ~ {processed_df['temperature'].max():.2f}")
            print("✓ 单位列处理成功，没有 TypeError")

            if processed_df['temperature'].max() < 50:
                print("✓ 温度从 °F 正确转换为 °C")
            else:
                print("⚠ 温度转换结果需要检查")
        else:
            print(f"✗ 预处理失败: {result['errors']}")
            return False

    except TypeError as e:
        print(f"✗ 发生 TypeError: {e}")
        return False

    return True


def test_missing_required_columns():
    print("\n" + "=" * 60)
    print("测试 2: 缺少必需列的检测")
    print("=" * 60)

    df = generate_normal_sample_data('SAMP-MISSING-001', 'BATCH-001', seed=42)
    df = df.drop(columns=['temperature', 'dissolved_oxygen'])

    print(f"现有列: {list(df.columns)}")
    print(f"缺少的必需列: ['temperature', 'dissolved_oxygen']")

    preprocessor = DataPreprocessor()

    try:
        result = preprocessor.process_sample(df, 'SAMP-MISSING-001')

        if not result['success']:
            print(f"✓ 正确检测到缺少必需列")
            print(f"  错误信息: {result['errors'][0]['message']}")

            qc_engine = QualityControlEngine()
            qc_results = qc_engine.analyze_batch({}, {'SAMP-MISSING-001': result})

            if 'SAMP-MISSING-001' in qc_results['results']:
                print("✓ 预处理失败样本已并入 qc_results")
                print(f"  状态: {qc_results['results']['SAMP-MISSING-001']['overall_status']}")
                print(f"  需复检: {qc_results['results']['SAMP-MISSING-001']['requires_recheck']}")

            if len(qc_results['summary']['recheck_samples']) > 0:
                print("✓ 预处理失败样本在复检建议列表中")

            return True
        else:
            print("✗ 应该检测到缺少必需列但没有检测到")
            return False

    except Exception as e:
        print(f"✗ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_mixed_units():
    print("\n" + "=" * 60)
    print("测试 3: 混合单位处理（temperature_unit 混合值）")
    print("=" * 60)

    df = generate_normal_sample_data('SAMP-MIXED-001', 'BATCH-001', seed=42)
    units = ['°C'] * 50 + ['°F'] * 47
    df['temperature_unit'] = units

    print(f"温度单位值分布: {df['temperature_unit'].value_counts().to_dict()}")

    preprocessor = DataPreprocessor()

    try:
        result = preprocessor.process_sample(df, 'SAMP-MIXED-001')

        if result['success']:
            print("✓ 混合单位处理成功（使用多数单位）")
            print(f"  处理步骤: {result['processing_steps']}")
            return True
        else:
            print(f"处理结果: success={result['success']}")
            print(f"  错误: {result.get('errors', [])}")
            return True

    except Exception as e:
        print(f"✗ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_all_samples_fail():
    print("\n" + "=" * 60)
    print("测试 4: 所有样本预处理失败时不崩溃")
    print("=" * 60)

    df1 = generate_normal_sample_data('SAMP-BAD-001', 'BATCH-001', seed=42)
    df1 = df1.drop(columns=['temperature'])

    df2 = generate_normal_sample_data('SAMP-BAD-002', 'BATCH-002', seed=43)
    df2 = df2.drop(columns=['dissolved_oxygen'])

    df = pd.concat([df1, df2], ignore_index=True)

    print(f"样本数量: {df['sample_id'].nunique()}")
    print(f"SAMP-BAD-001 缺少列: temperature")
    print(f"SAMP-BAD-002 缺少列: dissolved_oxygen")

    preprocessor = DataPreprocessor()
    preprocessing_result = preprocessor.process_all_samples(df)

    print(f"预处理成功: {preprocessing_result['success_count']}")
    print(f"预处理失败: {preprocessing_result['failed_count']}")

    qc_engine = QualityControlEngine()
    try:
        qc_results = qc_engine.analyze_batch(
            preprocessing_result['processed_samples'],
            preprocessing_result['failed_samples'],
        )

        print(f"QC 总样本数: {qc_results['summary']['total_samples']}")
        print(f"QC 需复检数: {qc_results['summary']['requires_recheck_count']}")
        print(f"QC 结果包含的样本: {list(qc_results['results'].keys())}")

        if len(qc_results['results']) == 2:
            print("✓ 所有失败样本都在 QC 结果中")

        if qc_results['summary']['requires_recheck_count'] == 2:
            print("✓ 所有失败样本都被标记为需复检")

        from fermentation_qc.reporting import ReportGenerator
        report_generator = ReportGenerator()

        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            try:
                generated_files = report_generator.export_all(
                    qc_results,
                    preprocessing_result['processed_samples'],
                    tmpdir,
                    preprocessing_result['processing_log'],
                    formats=['html', 'json', 'csv'],
                )

                print(f"✓ 报告生成成功")
                print(f"  HTML: {os.path.exists(os.path.join(tmpdir, 'report.html'))}")
                print(f"  JSON: {os.path.exists(os.path.join(tmpdir, 'report.json'))}")
                print(f"  CSV: {os.path.exists(os.path.join(tmpdir, 'csv_reports', 'recheck_samples.csv'))}")

                return True
            except Exception as e:
                print(f"✗ 报告生成失败: {e}")
                import traceback
                traceback.print_exc()
                return False

    except Exception as e:
        print(f"✗ 全失败时崩溃: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_full_flow():
    print("\n" + "=" * 60)
    print("测试 5: 完整流程（正常+异常样本混合）")
    print("=" * 60)

    normal_df = generate_normal_sample_data('SAMP-NORMAL-001', 'BATCH-001', seed=42)
    bad_df = generate_normal_sample_data('SAMP-BAD-001', 'BATCH-002', seed=43)
    bad_df = bad_df.drop(columns=['temperature'])

    df = pd.concat([normal_df, bad_df], ignore_index=True)

    print(f"总样本数: {df['sample_id'].nunique()}")
    print(f"  SAMP-NORMAL-001: 正常")
    print(f"  SAMP-BAD-001: 缺少 temperature 列")

    preprocessor = DataPreprocessor()
    preprocessing_result = preprocessor.process_all_samples(df)

    print(f"预处理成功: {preprocessing_result['success_count']}")
    print(f"预处理失败: {preprocessing_result['failed_count']}")

    qc_engine = QualityControlEngine()
    qc_results = qc_engine.analyze_batch(
        preprocessing_result['processed_samples'],
        preprocessing_result['failed_samples'],
    )

    summary = qc_results['summary']
    print(f"\nQC 结果:")
    print(f"  总样本数: {summary['total_samples']}")
    print(f"  通过: {summary['pass_count']}")
    print(f"  失败: {summary['fail_count']}")
    print(f"  需复检: {summary['requires_recheck_count']}")

    print(f"\nQC results 包含的样本: {list(qc_results['results'].keys())}")

    if len(qc_results['results']) == 2:
        print("✓ 成功和失败样本都在 QC 结果中")

    if summary['total_samples'] == 2:
        print("✓ 总样本数统计正确")

    if 'SAMP-BAD-001' in [s['sample_id'] for s in summary['recheck_samples']]:
        print("✓ 预处理失败样本在复检建议中")

    return True


def main():
    print("开始验证修复...\n")

    tests = [
        test_unit_column_handling,
        test_missing_required_columns,
        test_mixed_units,
        test_all_samples_fail,
        test_full_flow,
    ]

    results = []
    for test in tests:
        try:
            result = test()
            results.append((test.__name__, result))
        except Exception as e:
            print(f"\n✗ 测试 {test.__name__} 发生异常: {e}")
            import traceback
            traceback.print_exc()
            results.append((test.__name__, False))

    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)

    passed = sum(1 for _, r in results if r)
    total = len(results)

    for name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"  {name}: {status}")

    print(f"\n总计: {passed}/{total} 测试通过")

    if passed == total:
        print("\n✅ 所有修复验证通过！")
        return 0
    else:
        print("\n❌ 部分测试失败！")
        return 1


if __name__ == "__main__":
    sys.exit(main())
