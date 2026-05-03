#!/usr/bin/env python3
"""
轨检车数据复核 CLI 工具

用于铁路工务班组在维修计划前复核轨检车数据。
读取 track_sections.csv、geometry_points.jsonl 和 rules.yaml，
按 K 里程归一采样点，计算轨距、水平、高低、轨向的超限扣分，
将连续超限合并成病害段并给出维修优先级。

输出:
- issues.csv: 病害段列表
- track_report.md: 详细分析报告
- track_chart.html: 可打开的 HTML 里程图
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from track_inspection import (
    read_track_sections,
    read_geometry_points,
    read_rules,
    normalize_sampling,
    calculate_violations,
    merge_defects,
    export_issues_csv,
    export_report_md,
    generate_track_chart
)


def main():
    parser = argparse.ArgumentParser(
        description='轨检车数据复核工具 - 用于铁路工务班组复核轨检车数据',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python track_inspect.py --sections sample_data/track_sections.csv \
                           --points sample_data/geometry_points.jsonl \
                           --rules sample_data/rules.yaml \
                           --output ./output

  python track_inspect.py -i 5 -o ./output  # 使用当前目录默认文件，5米采样间隔
        """
    )
    
    parser.add_argument(
        '--sections', '-s',
        default='track_sections.csv',
        help='轨道区间定义 CSV 文件路径 (默认: track_sections.csv)'
    )
    
    parser.add_argument(
        '--points', '-p',
        default='geometry_points.jsonl',
        help='几何检测点 JSONL 文件路径 (默认: geometry_points.jsonl)'
    )
    
    parser.add_argument(
        '--rules', '-r',
        default='rules.yaml',
        help='超限规则 YAML 文件路径 (默认: rules.yaml)'
    )
    
    parser.add_argument(
        '--output', '-o',
        default='./',
        help='输出目录路径 (默认: 当前目录)'
    )
    
    parser.add_argument(
        '--interval', '-i',
        type=float,
        default=2.0,
        help='采样间隔（米）(默认: 2.0米)'
    )
    
    parser.add_argument(
        '--merge-gap', '-g',
        type=float,
        default=10.0,
        help='病害合并间隔（米），超过此间隔则认为是新病害段 (默认: 10.0米)'
    )
    
    args = parser.parse_args()
    
    sample_interval_km = args.interval / 1000.0
    merge_gap_km = args.merge_gap / 1000.0
    
    sections_path = Path(args.sections)
    points_path = Path(args.points)
    rules_path = Path(args.rules)
    output_dir = Path(args.output)
    
    for f in [sections_path, points_path, rules_path]:
        if not f.exists():
            print(f"错误: 文件不存在: {f}")
            sys.exit(1)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("轨检车数据复核工具")
    print("=" * 60)
    print(f"分析时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"采样间隔: {args.interval} 米")
    print(f"合并间隔: {args.merge_gap} 米")
    print()
    
    print("[1/5] 读取轨道区间定义...")
    sections = read_track_sections(str(sections_path))
    print(f"      共读取 {len(sections)} 个区间定义")
    for i, sec in enumerate(sections, 1):
        type_str = f"{sec.section_type}"
        if sec.section_type == 'curve' and sec.curve_radius:
            type_str += f" (R={sec.curve_radius}m)"
        print(f"        区间 {i}: {sec.start_km:.3f}km - {sec.end_km:.3f}km, {type_str}")
    print()
    
    print("[2/5] 读取几何检测点数据...")
    points = read_geometry_points(str(points_path))
    print(f"      共读取 {len(points)} 个检测点")
    print(f"      里程范围: {points[0].mileage:.3f}km - {points[-1].mileage:.3f}km")
    print()
    
    print("[3/5] 读取超限规则配置...")
    rules = read_rules(str(rules_path))
    print(f"      已加载规则版本: {rules.get('version', 'unknown')}")
    print()
    
    print("[4/5] 按 K 里程归一化采样...")
    sampled_points = normalize_sampling(
        points,
        sections,
        sample_interval=sample_interval_km
    )
    print(f"      归一化采样点: {len(sampled_points)} 个")
    print()
    
    print("[5/5] 计算超限和病害段...")
    violations = calculate_violations(sampled_points, rules)
    print(f"      超限点数量: {len(violations)} 个")
    
    defects = merge_defects(
        violations,
        sample_interval=sample_interval_km,
        merge_gap=merge_gap_km
    )
    print(f"      病害段数量: {len(defects)} 个")
    
    priority_counts = {}
    for d in defects:
        priority_counts[d.priority] = priority_counts.get(d.priority, 0) + 1
    print(f"      优先级分布: {dict(priority_counts)}")
    print()
    
    print("=" * 60)
    print("导出结果...")
    
    issues_path = output_dir / 'issues.csv'
    export_issues_csv(defects, str(issues_path))
    print(f"  ✓ 病害段列表: {issues_path}")
    
    report_path = output_dir / 'track_report.md'
    export_report_md(
        defects,
        violations,
        sampled_points,
        sections,
        str(report_path)
    )
    print(f"  ✓ 详细报告: {report_path}")
    
    chart_path = output_dir / 'track_chart.html'
    generate_track_chart(
        sampled_points,
        defects,
        sections,
        str(chart_path)
    )
    print(f"  ✓ 里程图: {chart_path}")
    
    print()
    print("=" * 60)
    print("分析完成!")
    print()
    
    if defects:
        print("病害段摘要:")
        for i, defect in enumerate(defects, 1):
            print(f"  #{i} [{defect.priority}] {defect.start_mileage:.3f}km - {defect.end_mileage:.3f}km")
            print(f"      长度: {defect.length * 1000:.1f}m, 扣分: {defect.total_score}, 等级: {defect.level}")
    else:
        print("无超限病害段。")


if __name__ == '__main__':
    main()
