#!/usr/bin/env python3
import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src import (
    ParamsManager,
    DataLoader,
    AnomalyDetector,
    TrajectoryDeductor,
    ConflictResolver,
    ReportGenerator
)


def print_header(text):
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70)


def print_section(text):
    print("\n" + "-" * 50)
    print(f"  {text}")
    print("-" * 50)


def run_pipeline(data_file: str, params_version: str = None, compare_versions: bool = False):
    print_header("河道漂浮物轨迹推演系统")

    print_section("步骤1: 加载参数配置")
    params_mgr = ParamsManager("config")

    if params_version:
        if params_mgr.set_active_version(params_version):
            print(f"✅ 已切换至参数版本: {params_version}")
        else:
            print(f"❌ 版本 {params_version} 不存在，使用默认版本")

    active_info = params_mgr.get_active_version_info()
    print(f"当前生效版本: {active_info['version']} - {active_info['note']}")
    print(f"创建人: {active_info['created_by']}")
    print(f"创建时间: {active_info['created_at']}")

    print("\n可用参数版本列表:")
    for v in params_mgr.list_versions():
        marker = "  * " if v['is_active'] else "    "
        print(f"{marker}{v['version']}: {v['note']} (创建人: {v['created_by']})")

    print_section("步骤2: 加载并清洗数据")
    loader = DataLoader(source="设备巡检表")
    print(f"正在加载数据文件: {data_file}")

    if data_file.endswith('.csv'):
        loader.load_csv(data_file)
    else:
        loader.load_excel(data_file)

    cleaned_data = loader.clean_data()

    quality_report = loader.get_data_quality_report()
    print(f"原始记录数: {quality_report['total_rows']}")
    print(f"清洗后记录数: {quality_report.get('cleaned_rows', 0)}")
    print(f"重复记录: {quality_report['duplicates']}")

    if quality_report.get('time_gaps'):
        print(f"\n⚠️  发现 {len(quality_report['time_gaps'])} 处采样缺口")
        for gap in quality_report['time_gaps']:
            print(f"  {gap['gap_start']} → {gap['gap_end']} (缺口 {gap['gap_duration_min']}分钟)")

    if quality_report.get('unit_conversions'):
        print(f"\n🔄 单位转换 {len(quality_report['unit_conversions'])} 处:")
        for conv in quality_report['unit_conversions'][:5]:
            print(f"  记录{conv['row_index']}: {conv['original_value']}{conv['original_unit']} → {conv['normalized_value']}{conv['target_unit']}")

    print_section("步骤3: 异常检测")
    detector = AnomalyDetector(params_mgr)
    result_data = detector.detect(cleaned_data)
    summary = detector.get_detection_summary()

    print(f"检测记录: {summary['total_records']} 条")
    print(f"异常记录: {summary['anomaly_count']} 条")
    print(f"  高风险: {summary['high_risk_count']} 条")
    print(f"  中风险: {summary['medium_risk_count']} 条")
    print(f"  低风险: {summary['low_risk_count']} 条")

    if summary['anomalies']:
        print("\n异常明细:")
        for a in summary['anomalies']:
            print(f"  [{a['timestamp']}] 记录{a['row_index']}: {';'.join(a['anomaly_type'])} (风险分: {a['risk_score']})")

    print_section("步骤4: 生成处理建议")
    suggestions = detector.generate_processing_suggestions()
    for s in suggestions:
        level_icon = {'urgent': '🚨', 'warning': '⚠️', 'info': 'ℹ️'}.get(s['level'], '📌')
        print(f"\n{level_icon} [{s['category']}] {s['action_item']}")
        print(f"   {s['description']}")
        print(f"   责任方: {s['responsible_role']}")

    print_section("步骤5: 巡检表冲突检测")
    resolver = ConflictResolver()
    inspection_notes = loader.get_inspection_notes()
    resolver.detect_conflicts(inspection_notes, result_data['anomaly_flags'], "设备巡检表")
    print(resolver.format_conflict_display())
    conflict_report = resolver.generate_conflict_report()

    print_section("步骤6: 轨迹推演")
    deductor = TrajectoryDeductor(params_mgr, "output")
    traj_results = deductor.deduce(result_data)
    print(f"推演对象数: {traj_results['objects_count']} 个")

    for obj_id, traj in traj_results['trajectories'].items():
        print(f"\n物体 {obj_id}:")
        print(f"  实际轨迹点: {traj['summary']['total_points']} 个")
        print(f"  预测轨迹点: {traj['summary']['predicted_points']} 个")
        print(f"  平均流速: {traj['summary']['avg_velocity']:.2f} m/s")

    print_section("步骤7: 生成图表")
    traj_chart = deductor.generate_trajectory_chart()
    summary_chart = deductor.generate_summary_chart(summary)
    print(f"✅ 轨迹图已生成: {traj_chart}")
    print(f"✅ 汇总图已生成: {summary_chart}")

    print_section("步骤8: 导出报告")
    reporter = ReportGenerator("output")
    report_path = reporter.generate_text_report(
        quality_report,
        summary,
        traj_results,
        suggestions,
        conflict_report
    )
    data_path = reporter.export_processed_data(result_data)
    json_path = reporter.save_json_summary({
        'data_quality': quality_report,
        'anomaly_detection': summary,
        'trajectory': traj_results,
        'processing_suggestions': suggestions,
        'conflict_report': conflict_report
    })
    print(f"✅ 分析报告: {report_path}")
    print(f"✅ 处理后数据: {data_path}")
    print(f"✅ JSON汇总: {json_path}")

    if compare_versions:
        print_section("参数版本对比 (v1 vs v2)")
        comparison = detector.compare_detection_versions(cleaned_data, 'v1', 'v2')
        comp = comparison['version_comparison']
        print(f"v1 独有异常: {comp['count_only_v1']} 条")
        print(f"v2 独有异常: {comp['count_only_v2']} 条")
        print(f"两者共有异常: {comp['count_in_both']} 条")
        print(f"\nv1参数: {comparison['version_details']['v1']['note']}")
        print(f"v2参数: {comparison['version_details']['v2']['note']}")
        if comp['anomalies_only_v2']:
            print(f"\nv2新增检出而v1未检出的记录: {comp['anomalies_only_v2']}")

    print_header("处理完成！")
    print(f"所有输出文件位于: {os.path.abspath('output')}")


def list_params():
    print_header("参数版本列表")
    params_mgr = ParamsManager("config")
    for v in params_mgr.list_versions():
        marker = "  * " if v['is_active'] else "    "
        print(f"{marker}{v['version']}: {v['note']}")
        print(f"      创建人: {v['created_by']}, 创建时间: {v['created_at']}")
        params = params_mgr.get_params(v['version'])
        print(f"      阈值: {params['thresholds']}")


def main():
    parser = argparse.ArgumentParser(description="河道漂浮物轨迹推演系统")
    parser.add_argument('action', choices=['run', 'list-params'],
                        help="执行动作: run=运行推演, list-params=列出参数版本")
    parser.add_argument('--data', default='data/sample_data.csv',
                        help="数据文件路径 (默认: data/sample_data.csv)")
    parser.add_argument('--params-version', default=None,
                        help='指定参数版本')
    parser.add_argument('--compare', action='store_true',
                        help='对比v1/v2参数版本差异')

    args = parser.parse_args()

    if args.action == 'list-params':
        list_params()
    elif args.action == 'run':
        run_pipeline(args.data, args.params_version, args.compare)


if __name__ == '__main__':
    main()
