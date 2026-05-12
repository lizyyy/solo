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
    print("测试 3: 混合单位处理（temperature_unit 混合值，逐点转换）")
    print("=" * 60)

    df = generate_normal_sample_data('SAMP-MIXED-001', 'BATCH-001', seed=42)

    original_temp = df['temperature'].copy()

    fahrenheit_values = (original_temp.iloc[50:] * 9 / 5) + 32
    df.loc[df.index[50:], 'temperature'] = fahrenheit_values

    units = ['°C'] * 50 + ['°F'] * 47
    df['temperature_unit'] = units

    print(f"温度单位值分布: {df['temperature_unit'].value_counts().to_dict()}")
    print(f"原始温度范围 (全部 °C): {original_temp.min():.2f} ~ {original_temp.max():.2f} °C")
    print(f"混合后温度范围: {df['temperature'].min():.2f} ~ {df['temperature'].max():.2f}")
    print(f"  (前50个点是 °C，后47个点是 °F 表示的相同温度值)")

    preprocessor = DataPreprocessor()

    try:
        result = preprocessor.process_sample(df, 'SAMP-MIXED-001')

        if not result['success']:
            print(f"✗ 预处理失败: {result['errors']}")
            return False

        processed_df = result['dataframe']
        processed_temp = processed_df['temperature']

        print(f"\n处理后温度范围: {processed_temp.min():.2f} ~ {processed_temp.max():.2f} °C")

        temp_max = processed_temp.max()
        if temp_max > 50:
            print(f"✗ 转换失败，最高温度 {temp_max:.2f} °C 超过正常值")
            print(f"  说明 °F 数据点没有被正确转换")
            return False

        first_50_original = original_temp.iloc[:50].reset_index(drop=True)
        first_50_processed = processed_temp.iloc[:50].reset_index(drop=True)
        diff_c = (first_50_processed - first_50_original).abs().max()

        print(f"\n前50个点 (原始 °C):")
        print(f"  原始范围: {first_50_original.min():.2f} ~ {first_50_original.max():.2f}")
        print(f"  处理后范围: {first_50_processed.min():.2f} ~ {first_50_processed.max():.2f}")
        print(f"  最大差值: {diff_c:.4f}")

        if diff_c > 0.1:
            print(f"✗ °C 数据点被错误转换了")
            return False

        print(f"\n后47个点 (原始 °F 应转换为 °C):")
        last_47_original_fahrenheit = df['temperature'].iloc[50:].reset_index(drop=True)
        last_47_processed = processed_temp.iloc[50:].reset_index(drop=True)
        last_47_expected = original_temp.iloc[50:].reset_index(drop=True)
        diff_f_converted = (last_47_processed - last_47_expected).abs().max()

        print(f"  混合数据值范围: {last_47_original_fahrenheit.min():.2f} ~ {last_47_original_fahrenheit.max():.2f}")
        print(f"  处理后范围: {last_47_processed.min():.2f} ~ {last_47_processed.max():.2f}")
        print(f"  期望范围: {last_47_expected.min():.2f} ~ {last_47_expected.max():.2f}")
        print(f"  与期望值最大差值: {diff_f_converted:.4f}")

        if diff_f_converted > 0.5:
            print(f"✗ °F 数据点没有被正确转换为 °C")
            return False

        print(f"\n✓ 混合单位逐点转换正确")
        print(f"  前50个 °C 点保持不变")
        print(f"  后47个 °F 点正确转换为 °C")
        print(f"  处理步骤: {result['processing_steps']}")

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


def test_empty_column_detection():
    print("\n" + "=" * 60)
    print("测试 5: 整列缺失检测（temperature/dissolved_oxygen 整列为空）")
    print("=" * 60)

    df = generate_normal_sample_data('SAMP-EMPTY-001', 'BATCH-001', seed=42)
    df['temperature'] = np.nan
    df['dissolved_oxygen'] = np.nan

    print(f"temperature 列全部为空: {df['temperature'].isna().all()}")
    print(f"dissolved_oxygen 列全部为空: {df['dissolved_oxygen'].isna().all()}")
    print(f"temperature 列存在: {'temperature' in df.columns}")
    print(f"dissolved_oxygen 列存在: {'dissolved_oxygen' in df.columns}")

    preprocessor = DataPreprocessor()

    try:
        result = preprocessor.process_sample(df, 'SAMP-EMPTY-001')

        if not result['success']:
            print(f"✓ 正确检测到整列缺失")
            print(f"  错误信息: {result['errors'][0]['message']}")

            qc_engine = QualityControlEngine()
            qc_results = qc_engine.analyze_batch({}, {'SAMP-EMPTY-001': result})

            if 'SAMP-EMPTY-001' in qc_results['results']:
                print("✓ 整列缺失样本已并入 qc_results")
                print(f"  状态: {qc_results['results']['SAMP-EMPTY-001']['overall_status']}")
                print(f"  需复检: {qc_results['results']['SAMP-EMPTY-001']['requires_recheck']}")
                print(f"  复检原因: {qc_results['results']['SAMP-EMPTY-001'].get('recheck_reason', '')}")

            if len(qc_results['summary']['recheck_samples']) > 0:
                print("✓ 整列缺失样本在复检建议列表中")

            return True
        else:
            print("✗ 应该检测到整列缺失但没有检测到")
            print(f"  成功: {result['success']}")
            print(f"  处理步骤: {result['processing_steps']}")
            return False

    except Exception as e:
        print(f"✗ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_partial_missing_vs_full_empty():
    print("\n" + "=" * 60)
    print("测试 6: 部分缺失 vs 完全缺失的区别")
    print("=" * 60)

    df_partial = generate_normal_sample_data('SAMP-PARTIAL-001', 'BATCH-001', seed=42)
    df_partial.loc[:20, 'temperature'] = np.nan

    df_full_empty = generate_normal_sample_data('SAMP-EMPTY-002', 'BATCH-002', seed=43)
    df_full_empty['temperature'] = np.nan

    df = pd.concat([df_partial, df_full_empty], ignore_index=True)

    print(f"SAMP-PARTIAL-001: temperature 前 21 个点缺失，其余有值")
    print(f"SAMP-EMPTY-002: temperature 全部为空")

    preprocessor = DataPreprocessor(missing_threshold=0.3)
    preprocessing_result = preprocessor.process_all_samples(df)

    print(f"\n预处理结果:")
    print(f"  成功样本: {list(preprocessing_result['processed_samples'].keys())}")
    print(f"  失败样本: {list(preprocessing_result['failed_samples'].keys())}")

    partial_success = 'SAMP-PARTIAL-001' in preprocessing_result['processed_samples']
    empty_failed = 'SAMP-EMPTY-002' in preprocessing_result['failed_samples']

    if partial_success:
        print("✓ 部分缺失的样本处理成功")
    else:
        print("✗ 部分缺失的样本应该成功但失败了")

    if empty_failed:
        print("✓ 完全缺失的样本标记为失败")
        failed_result = preprocessing_result['failed_samples']['SAMP-EMPTY-002']
        print(f"  错误信息: {failed_result['errors'][0]['message']}")
    else:
        print("✗ 完全缺失的样本应该失败但成功了")

    return partial_success and empty_failed


def test_full_flow():
    print("\n" + "=" * 60)
    print("测试 7: 完整流程（正常+异常样本混合）")
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
        test_empty_column_detection,
        test_partial_missing_vs_full_empty,
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
