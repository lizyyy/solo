"""
测试用例 - 游戏掉落概率校准
演示完整的校准流程
"""
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from drop_calibration import (
    DataSourceType,
    CalibrationParams,
    BatchProcessor,
    BatchFile,
    ExportConfig,
)


def main():
    print("=" * 70)
    print("🎮 游戏掉落概率校准系统 - 完整测试")
    print("=" * 70)

    sample_dir = os.path.join(os.path.dirname(__file__), "sample_data")

    if not os.path.exists(sample_dir):
        print(f"\n❌ 示例数据目录不存在: {sample_dir}")
        print("请先运行: python examples/generate_sample_data.py")
        return

    print(f"\n📁 示例数据目录: {sample_dir}")

    batch_files = [
        BatchFile(
            file_path=os.path.join(sample_dir, "drop_config.csv"),
            source_type=DataSourceType.DROP_CONFIG,
            version="1.0",
            import_notes="正式版掉落配置",
        ),
        BatchFile(
            file_path=os.path.join(sample_dir, "drop_config_old_v0.9.csv"),
            source_type=DataSourceType.DROP_CONFIG,
            version="0.9",
            import_notes="旧版配置，已停用，仅保留用于对比",
            activate=False,
        ),
        BatchFile(
            file_path=os.path.join(sample_dir, "item_pool.csv"),
            source_type=DataSourceType.ITEM_POOL,
            version="1.0",
        ),
        BatchFile(
            file_path=os.path.join(sample_dir, "activity_period.csv"),
            source_type=DataSourceType.ACTIVITY_PERIOD,
            version="1.0",
        ),
        BatchFile(
            file_path=os.path.join(sample_dir, "player_logs.csv"),
            source_type=DataSourceType.PLAYER_LOG,
            version="1.0",
            import_notes="2026年5月1日-5月20日玩家掉落日志",
        ),
        BatchFile(
            file_path=os.path.join(sample_dir, "complaint_records.csv"),
            source_type=DataSourceType.COMPLAINT_RECORD,
            version="1.0",
        ),
    ]

    print("\n" + "=" * 70)
    print("⚙️  步骤1: 设置校准参数")
    print("=" * 70)

    params = CalibrationParams(
        start_time=datetime(2026, 5, 1, 0, 0, 0),
        end_time=datetime(2026, 5, 20, 23, 59, 59),
        confidence_level=0.95,
        significance_level=0.05,
        min_sample_size=30,
        deviation_warning_threshold=0.1,
        deviation_critical_threshold=0.3,
        deduplicate_enabled=True,
        activity_bonus_enabled=True,
        probability_normalization_enabled=True,
        group_by=["pool_id"],
        notes="五一活动期间掉落概率校准",
    )

    print(f"  时间范围: {params.start_time} ~ {params.end_time}")
    print(f"  置信水平: {params.confidence_level * 100:.0f}%")
    print(f"  显著性水平: {params.significance_level}")
    print(f"  最小样本量: {params.min_sample_size}")
    print(f"  警告阈值: {params.deviation_warning_threshold * 100:.0f}%")
    print(f"  严重阈值: {params.deviation_critical_threshold * 100:.0f}%")
    print(f"  去重: {'启用' if params.deduplicate_enabled else '禁用'}")
    print(f"  活动加成: {'启用' if params.activity_bonus_enabled else '禁用'}")
    print(f"  概率归一化: {'启用' if params.probability_normalization_enabled else '禁用'}")
    print(f"  筛选条件哈希: {params.get_filter_hash()}")

    export_config = ExportConfig(
        output_dir="./reports",
        report_name="drop_calibration_test",
        include_charts=True,
        include_params=True,
        include_anomalies=True,
        include_data_sources=True,
        formats=["xlsx", "json", "html"],
        chart_dpi=150,
    )

    print("\n" + "=" * 70)
    print("🚀 步骤2: 运行完整校准流程")
    print("=" * 70)

    processor = BatchProcessor(fail_fast=False)

    result = processor.run_full_pipeline(
        batch_files=batch_files,
        params=params,
        export_config=export_config,
    )

    print(f"\n✅ 批次ID: {result.batch_id}")
    print(f"   开始时间: {result.start_time}")
    print(f"   结束时间: {result.end_time}")
    print(f"   处理文件: {result.files_processed} 个")
    print(f"   失败文件: {result.files_failed} 个")
    print(f"   处理成功: {'是' if result.success else '否'}")
    print(f"   错误数量: {len(result.errors)} 个")

    if result.errors:
        print("\n⚠️  导入错误详情:")
        for i, error in enumerate(result.errors[:10], 1):
            print(f"   {i}. {error}")

    print("\n" + "=" * 70)
    print("📊 步骤3: 查看数据清洗结果")
    print("=" * 70)

    if result.cleaning_result:
        dr = result.cleaning_result.deduplicate
        print(f"\n   去重结果:")
        print(f"     总记录数: {dr.total_records:,}")
        print(f"     重复记录: {dr.duplicate_count:,}")
        print(f"     唯一记录: {dr.unique_count:,}")
        print(f"     去重键: {', '.join(dr.duplicate_keys)}")

        ab = result.cleaning_result.activity_bonus
        print(f"\n   活动加成结果:")
        print(f"     总记录数: {ab.total_records:,}")
        print(f"     应用活动: {ab.records_with_activity:,}")
        print(f"     无活动: {ab.records_without_activity:,}")
        print(f"     平均倍率: {ab.average_multiplier:.2f}x")

        print(f"\n   概率归一化结果:")
        for pool_id, norm in result.cleaning_result.normalization.items():
            status = "✅ 已归一化" if norm.is_normalized else "⚠️  未归一化"
            print(f"     池子 {pool_id}: {status} (总和={norm.original_total:.6f}, 偏差={norm.diff_from_one:.6f})")

        if result.cleaning_result.warnings:
            print(f"\n   ⚠️  数据警告:")
            for i, warning in enumerate(result.cleaning_result.warnings, 1):
                print(f"     {i}. {warning}")

    print("\n" + "=" * 70)
    print("📈 步骤4: 查看概率检验结果")
    print("=" * 70)

    if result.test_result:
        tr = result.test_result
        print(f"\n   总日志数: {tr.total_logs:,}")
        print(f"   筛选后日志: {tr.filtered_logs:,}")
        print(f"   道具池数: {tr.total_pools}")
        print(f"   道具总数: {tr.total_items}")

        print(f"\n   道具池卡方检验:")
        for pool_id, chi in tr.pool_chi_square.items():
            if chi.get("has_data", False):
                sig = "⚠️  显著偏离" if chi.get("significant", False) else "✅ 分布正常"
                print(f"     {pool_id}: χ²={chi.get('chi2_statistic', 0):.4f}, "
                      f"P={chi.get('p_value', 1):.6f}, {sig}, "
                      f"样本量={chi.get('total_trials', 0):,}")

        print(f"\n   道具统计 (按偏差排序 Top 10):")
        sorted_items = sorted(
            tr.item_stats.values(),
            key=lambda x: abs(x.deviation_percent),
            reverse=True
        )[:10]

        print(f"     {'道具名':<12} {'配置概率':>10} {'实际概率':>10} {'偏差%':>10} {'P值':>10} {'显著':>6}")
        print(f"     {'-'*12} {'-'*10} {'-'*10} {'-'*10} {'-'*10} {'-'*6}")
        for item in sorted_items:
            sig = "✅" if item.is_significant else "  "
            dev_sign = "+" if item.deviation_percent >= 0 else ""
            print(f"     {item.item_name:<12} {item.expected_probability*100:>9.4f}% "
                  f"{item.observed_probability*100:>9.4f}% "
                  f"{dev_sign}{item.deviation_percent:>9.2f}% "
                  f"{item.p_value:>10.6f} {sig:>4}")

    print("\n" + "=" * 70)
    print("⚠️  步骤5: 查看异常检测结果")
    print("=" * 70)

    if result.anomaly_report:
        ar = result.anomaly_report
        print(f"\n   异常总数: {ar.total_anomalies}")
        print(f"   严重异常: {ar.critical_count}")
        print(f"   警告异常: {ar.warning_count}")
        print(f"   信息提示: {ar.info_count}")

        critical_anomalies = [a for a in ar.anomalies if a.level == "critical"]
        warning_anomalies = [a for a in ar.anomalies if a.level == "warning"]

        if critical_anomalies:
            print(f"\n   🚨 严重异常:")
            for i, anomaly in enumerate(critical_anomalies[:5], 1):
                print(f"\n     {i}. [{anomaly.anomaly_type}] {anomaly.title}")
                print(f"        描述: {anomaly.description[:100]}...")
                if anomaly.source_file:
                    print(f"        来源: {anomaly.source_file}")
                    if anomaly.source_row:
                        print(f"        行号: {anomaly.source_row}")

        if warning_anomalies:
            print(f"\n   ⚠️  警告异常 (前5个):")
            for i, anomaly in enumerate(warning_anomalies[:5], 1):
                print(f"     {i}. [{anomaly.anomaly_type}] {anomaly.title}")

    print("\n" + "=" * 70)
    print("📋 步骤6: 查看配置对比结果")
    print("=" * 70)

    if result.comparison_result:
        cr = result.comparison_result
        summary = cr.overall_summary

        print(f"\n   总体摘要:")
        print(f"     道具池数: {summary.get('total_pools', 0)}")
        print(f"     道具总数: {summary.get('total_items', 0)}")
        print(f"     严重异常道具: {summary.get('critical_items', 0)}")
        print(f"     警告道具: {summary.get('warning_items', 0)}")
        print(f"     正常道具: {summary.get('normal_items', 0)}")
        print(f"     统计显著道具: {summary.get('significant_items', 0)}")
        print(f"     平均绝对偏差: {summary.get('average_abs_deviation_percent', 0):.2f}%")
        print(f"     总抽取次数: {summary.get('total_attempts', 0):,}")

    print("\n" + "=" * 70)
    print("📁 步骤7: 查看导出的报告文件")
    print("=" * 70)

    if result.exported_files:
        for format_name, file_path in result.exported_files.items():
            print(f"   ✅ {format_name.upper()}: {file_path}")

    print("\n" + "=" * 70)
    print("🔄 步骤8: 测试参数复现功能")
    print("=" * 70)

    params_file = os.path.join("./reports", "calibration_params.json")
    params_path = processor.exporter.export_params(params, params_file)
    print(f"\n   ✅ 参数已导出到: {params_path}")

    loaded_params = processor.exporter.load_params(params_path)
    if loaded_params:
        print(f"   ✅ 参数加载成功，筛选哈希一致: {loaded_params.get_filter_hash() == params.get_filter_hash()}")

    print("\n" + "=" * 70)
    print("🧪 步骤9: 测试错误数据处理")
    print("=" * 70)

    bad_file = BatchFile(
        file_path=os.path.join(sample_dir, "bad_data.csv"),
        source_type=DataSourceType.DROP_CONFIG,
        version="1.0",
        import_notes="测试错误数据处理",
    )

    bad_result = processor.import_files([bad_file])
    if bad_result and bad_result[0].errors:
        print(f"\n   ✅ 错误数据已被正确捕获，共 {len(bad_result[0].errors)} 个错误:")
        for i, error in enumerate(bad_result[0].errors, 1):
            print(f"     {i}. {error}")

    print("\n" + "=" * 70)
    print("🎉 测试完成！")
    print("=" * 70)

    if result.success:
        print("\n✅ 所有测试通过！")
        print(f"\n📊 关键发现:")
        if result.anomaly_report:
            if result.anomaly_report.critical_count > 0:
                print(f"   ⚠️  发现 {result.anomaly_report.critical_count} 个严重异常，需要重点关注")
            if result.anomaly_report.warning_count > 0:
                print(f"   ℹ️  发现 {result.anomaly_report.warning_count} 个警告，建议检查")
        if result.comparison_result:
            sig_count = result.comparison_result.overall_summary.get('significant_items', 0)
            if sig_count > 0:
                print(f"   📈 {sig_count} 个道具的实际掉落与配置概率存在统计显著差异")

        print(f"\n📁 报告已导出到: ./reports/ 目录")
        print("   建议打开 HTML 报告查看可视化结果")
    else:
        print("\n❌ 测试过程中出现问题，请检查错误信息")

    return result.success


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
