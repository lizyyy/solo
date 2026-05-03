#!/usr/bin/env python3
"""
测试完整流程脚本
"""

from inspection_cli.modules.parser import DataParser
from inspection_cli.modules.validator import DataValidator
from inspection_cli.modules.merger import DefectMerger
from inspection_cli.modules.scorer import DefectScorer
from inspection_cli.modules.exporter import ReportExporter
from pathlib import Path


def test_full_flow():
    """测试完整流程"""
    
    # 步骤1: 解析数据
    print('='*60)
    print('步骤1: 解析巡检包')
    print('='*60)

    parser = DataParser()
    packages = []

    # 解析几个重叠包（这些包有重复的缺陷标注）
    overlapping_dirs = [
        Path('./test_samples/robot_100_overlapping'),
        Path('./test_samples/robot_101_overlapping'),
        Path('./test_samples/robot_102_overlapping'),
    ]

    for pkg_dir in overlapping_dirs:
        print(f'解析: {pkg_dir.name}')
        package = parser.parse_package(pkg_dir)
        packages.append(package)
        print(f'  视频片段: {len(package.video_index)}')
        print(f'  传感器记录: {len(package.sensor_data)}')
        print(f'  缺陷标注: {len(package.defect_annotations)}')
        if package.errors:
            print(f'  错误: {package.errors}')

    # 步骤2: 数据校验
    print('')
    print('='*60)
    print('步骤2: 数据校验')
    print('='*60)

    validator = DataValidator()
    validation_results = validator.validate_multiple_packages(packages)

    for pkg_name, result in validation_results.items():
        status = '有效' if result.is_valid else '无效'
        if result.issues:
            status = '有警告' if not result.is_critical else '严重错误'
        print(f'{pkg_name}: {status}')
        for issue in result.issues:
            print(f'  - {issue.severity.value}: {issue.message}')

    # 步骤3: 缺陷归并
    print('')
    print('='*60)
    print('步骤3: 缺陷归并')
    print('='*60)

    merger = DefectMerger()
    merge_result = merger.merge_packages(packages)

    print(f'原始缺陷数: {merge_result.total_defects_before}')
    print(f'去重后缺陷数: {merge_result.total_defects_after}')
    print(f'去重率: {merge_result.reduction_rate:.1f}%')
    print(f'合并缺陷组: {len(merge_result.merged_defects)}')
    print(f'唯一缺陷: {len(merge_result.unique_defects)}')

    # 显示按管段统计
    print('')
    print('按管段统计:')
    for segment, stats in merge_result.by_segment.items():
        print(f'  {segment}: {stats["total_before"]} -> {stats["total_after"]}')

    # 显示合并的缺陷详情
    print('')
    print('合并的缺陷详情:')
    for merged in merge_result.merged_defects:
        print(f'  ID: {merged.merged_id}')
        print(f'    类型: {merged.defect_type}')
        print(f'    主里程: {merged.primary_mileage:.2f}m')
        print(f'    来源数: {merged.get_source_count()}')
        print(f'    涉及包数: {merged.get_package_count()}')
        print(f'    描述: {merged.description}')

    # 步骤4: 风险评分
    print('')
    print('='*60)
    print('步骤4: 风险评分')
    print('='*60)

    scorer = DefectScorer()
    scoring_result = scorer.score_defects(merge_result)

    print('风险等级分布:')
    level_labels = {
        'critical': ('🔴', '紧急'),
        'high': ('🟠', '高风险'),
        'medium': ('🟡', '中等'),
        'low': ('🟢', '低风险'),
        'info': ('🔵', '信息')
    }
    for level, count in scoring_result.by_risk_level.items():
        icon, label = level_labels.get(level, ('⚪', level))
        print(f'  {icon} {label}: {count}')

    # 显示评分详情
    print('')
    print('评分详情（按分数降序）:')
    sorted_defects = sorted(scoring_result.scored_defects, key=lambda d: d.total_score, reverse=True)
    for defect in sorted_defects[:5]:  # 显示前5个
        icon, label = level_labels.get(defect.risk_level.value, ('⚪', defect.risk_level.value))
        print(f'  {icon} {defect.merged_id}: {defect.total_score:.0f}分 ({defect.risk_level.value})')
        print(f'    评分明细: {defect.score_breakdown}')

    # 步骤5: 导出报告
    print('')
    print('='*60)
    print('步骤5: 导出报告')
    print('='*60)

    exporter = ReportExporter()
    output_path = Path('./test_output/inspection_report')

    # 确保输出目录存在
    output_path.parent.mkdir(parents=True, exist_ok=True)

    exported_files = exporter.export_full_report(
        output_path=output_path,
        packages=packages,
        validation_results=validation_results,
        merge_result=merge_result,
        scoring_result=scoring_result,
        formats=['markdown', 'csv']
    )

    print('报告已导出:')
    for fmt, filepath in exported_files.items():
        print(f'  - {fmt}: {filepath}')

    print('')
    print('='*60)
    print('测试完成！')
    print('='*60)


if __name__ == '__main__':
    test_full_flow()
