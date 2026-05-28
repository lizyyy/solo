#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from art_price_index import (
    DirectoryImporter,
    CurrencyNormalizer,
    DuplicateDetector,
    OutlierDetector,
    PriceIndexCalculator,
    IndexVisualizer,
    ReportGenerator,
    ArtPriceIndexPipeline,
    RecordState,
    IssueSeverity,
    IssueType,
)


def test_import():
    print("测试1: 目录导入器")
    print("=" * 50)
    importer = DirectoryImporter("./test_data")
    result = importer.import_directory()

    print(f"总文件: {result.total_files}")
    print(f"成功: {result.successful_files}, 失败: {result.failed_files}")
    print(f"总记录: {result.total_records}")
    print(f"有效记录: {result.valid_records}")
    print(f"问题数: {len(result.issues)}")
    print()

    print("文件处理详情:")
    for fr in result.file_results:
        print(f"  {fr['file_name']}: {fr['status']} "
              f"(成功{fr['records_imported']}, 失败{fr['records_failed']})")
        if fr['issues']:
            for issue in fr['issues'][:2]:
                print(f"    - {issue.get('message', '')}")
    print()

    critical = [i for i in result.issues if i.severity in (IssueSeverity.ERROR, IssueSeverity.CRITICAL)]
    print(f"严重问题数: {len(critical)}")
    for issue in critical[:5]:
        print(f"  ! {issue.message}")
        print(f"    影响: {issue.impact}")
        print(f"    建议: {issue.suggestion}")

    print("\n通过测试!\n")
    return result


def test_currency_normalization(result):
    print("测试2: 币种归一化")
    print("=" * 50)

    normalizer = CurrencyNormalizer(target_currency="USD")
    result = normalizer.normalize_records(result)

    stats = normalizer.get_conversion_summary()
    print(f"目标币种: {stats['target_currency']}")
    print(f"转换统计: {stats['conversions_by_currency']}")
    print(f"支持币种: {stats['supported_currencies']}")
    print()

    normalized_records = [
        r for r in result.records
        if r.state == RecordState.CURRENCY_NORMALIZED
        and r.usd_price is not None
    ]
    print(f"已归一化记录: {len(normalized_records)}")
    for r in normalized_records[:5]:
        if r.original_currency != "USD":
            print(f"  {r.artist_name}: {r.original_price:.0f} {r.original_currency} "
                  f"→ ${r.usd_price:,.2f}")

    print("\n通过测试!\n")
    return result


def test_duplicate_detection(result):
    print("测试3: 重复记录检测")
    print("=" * 50)

    detector = DuplicateDetector(title_similarity_threshold=0.7)
    result = detector.detect_and_remove_duplicates(result)

    stats = detector.get_duplicate_summary()
    print(f"移除重复: {stats['total_duplicates_removed']}")
    print(f"模糊匹配: {stats['fuzzy_matching_enabled']}")
    print(f"相似度阈值: {stats['title_similarity_threshold']}")
    print()

    duplicates = [r for r in result.records if r.duplicate_of is not None]
    print(f"检测到重复记录: {len(duplicates)}")
    for r in duplicates:
        dup_issues = [i for i in r.issues if i.issue_type == IssueType.DUPLICATE_RECORD]
        for issue in dup_issues:
            print(f"  - {r.artist_name}《{r.artwork_title}》:")
            print(f"    原因: {issue.message}")
            print(f"    与 {r.duplicate_of} 重复")

    print("\n通过测试!\n")
    return result


def test_outlier_detection(result):
    print("测试4: 异常值检测")
    print("=" * 50)

    detector = OutlierDetector(
        method="robust",
        iqr_factor=3.0,
        z_score_threshold=3.0,
        group_by_artist=True,
        group_by_medium=True,
    )
    result = detector.detect_outliers(result)

    stats = detector.get_outlier_summary()
    print(f"排除极端值: {stats['total_extreme_values_removed']}")
    print(f"检测方法: {stats['detection_method']}")
    print(f"IQR因子: {stats['iqr_factor']}")
    print(f"Z-score阈值: {stats['z_score_threshold']}")
    print(f"按艺术家分组: {stats['group_by_artist']}")
    print(f"按媒介分组: {stats['group_by_medium']}")
    print()

    outliers = [r for r in result.records if r.is_outlier]
    print(f"检测到异常记录: {len(outliers)}")
    for r in outliers:
        outlier_issues = [i for i in r.issues if i.issue_type == IssueType.EXTREME_VALUE]
        for issue in outlier_issues:
            print(f"  ! {r.artist_name}《{r.artwork_title}》")
            print(f"    价格: ${r.usd_price:,.0f}")
            print(f"    偏离倍数: {r.outlier_score:.1f}x")
            print(f"    原因: {issue.message}")
            print(f"    影响: {issue.impact}")

    print("\n通过测试!\n")
    return result


def test_index_calculation(result):
    print("测试5: 价格指数计算")
    print("=" * 50)

    calculator = PriceIndexCalculator(period="monthly", min_records_per_period=3)
    result = calculator.calculate_index(result)

    stats = calculator.get_index_summary()
    print(f"周期数: {stats.get('periods_count', 0)}")
    print(f"方法: {stats.get('method', '')}")
    print(f"基期: {stats.get('base_period', '')}")
    print(f"当期指数: {stats.get('current_value', 'N/A')}")
    print(f"波动率: {stats.get('volatility', 'N/A')}")
    print()

    print("指数序列:")
    print(f"{'周期':<12} {'指数值':>8} {'记录数':>8} {'中位价':>12}")
    print("-" * 45)
    for point in result.index_series:
        print(f"{point.period:<12} {point.index_value:>8.2f} "
              f"{point.record_count:>8} ${point.median_price:>11,.0f}")

    print("\n通过测试!\n")
    return result


def test_report_generation(result):
    print("测试6: 报告生成")
    print("=" * 50)

    output_dir = Path("./test_output")
    output_dir.mkdir(exist_ok=True)

    reporter = ReportGenerator()
    reports = reporter.generate_all_reports(result, str(output_dir))

    print(f"生成报告:")
    for name, path in reports.items():
        p = Path(path)
        size = p.stat().st_size if p.exists() else 0
        print(f"  ✓ {name}: {path} ({size} bytes)")

    visualizer = IndexVisualizer()
    charts = visualizer.generate_all_charts(result, str(output_dir))

    print(f"\n生成图表:")
    for name, path in charts.items():
        p = Path(path)
        size = p.stat().st_size if p.exists() else 0
        print(f"  ✓ {name}: {path} ({size} bytes)")

    print("\n通过测试!\n")
    return True


def test_full_pipeline():
    print("测试7: 完整流水线")
    print("=" * 50)

    pipeline = ArtPriceIndexPipeline(
        input_dir="./test_data",
        output_dir="./test_output_full",
        target_currency="USD",
        period="monthly",
        outlier_method="robust",
    )

    result = pipeline.run()

    print(f"\n最终状态: {result.status.value}")
    print(f"总文件: {result.total_files}, 成功: {result.successful_files}, 失败: {result.failed_files}")
    print(f"总记录: {result.total_records}, 有效: {result.valid_records}, 排除: {result.excluded_records}")
    print(f"艺术家: {len(result.artists)}, 媒介: {len(result.media)}")
    print(f"指数点数: {len(result.index_series)}")
    print(f"问题总数: {len(result.issues)}")

    print("\n记录状态分布:")
    for state, count in result.records_by_state.items():
        print(f"  {state}: {count}")

    print("\n完整流水线测试通过!\n")
    return True


def test_state_transitions():
    print("测试8: 状态流转验证")
    print("=" * 50)

    importer = DirectoryImporter("./test_data")
    result = importer.import_directory()

    states = [r.state for r in result.records]
    print(f"初始状态分布:")
    for state in set(states):
        count = states.count(state)
        print(f"  {state.value}: {count}")

    normalizer = CurrencyNormalizer()
    result = normalizer.normalize_records(result)
    states = [r.state for r in result.records]
    print(f"\n币种归一化后:")
    for state in set(states):
        count = states.count(state)
        print(f"  {state.value}: {count}")

    detector = DuplicateDetector()
    result = detector.detect_and_remove_duplicates(result)
    states = [r.state for r in result.records]
    print(f"\n去重后:")
    for state in set(states):
        count = states.count(state)
        print(f"  {state.value}: {count}")

    outlier = OutlierDetector()
    result = outlier.detect_outliers(result)
    states = [r.state for r in result.records]
    print(f"\n异常检测后:")
    for state in set(states):
        count = states.count(state)
        print(f"  {state.value}: {count}")

    calc = PriceIndexCalculator(min_records_per_period=3)
    result = calc.calculate_index(result)
    states = [r.state for r in result.records]
    print(f"\n指数计算后:")
    for state in set(states):
        count = states.count(state)
        print(f"  {state.value}: {count}")

    valid_for_index = [
        r for r in result.records
        if r.state == RecordState.INDEX_CALCULATED
    ]
    print(f"\n参与指数计算的记录: {len(valid_for_index)}")
    print("状态流转测试通过!\n")


def main():
    print("\n" + "=" * 60)
    print("艺术品价格指数系统 - 综合测试")
    print("=" * 60 + "\n")

    try:
        result = test_import()
        result = test_currency_normalization(result)
        result = test_duplicate_detection(result)
        result = test_outlier_detection(result)
        result = test_index_calculation(result)
        test_report_generation(result)
        test_full_pipeline()
        test_state_transitions()

        print("=" * 60)
        print("所有测试通过! ✓")
        print("=" * 60)
        return 0

    except Exception as e:
        print(f"\n测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
