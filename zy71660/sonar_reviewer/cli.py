"""
声呐测距误差复盘 CLI 主程序

使用方式：
  python -m sonar_reviewer review <数据文件> [选项]
  python -m sonar_reviewer formulas                          # 显示公式与单位说明
  python -m sonar_reviewer check <数据文件>                  # 仅检查不计算
"""

import argparse
import sys
import os
from pathlib import Path

from .core import PhysicsBounds
from .importer import DataImporter
from .cleaner import DataCleaner
from .analyzer import ErrorAnalyzer
from .exporter import ReportExporter


def print_formulas():
    """打印公式与单位说明"""
    print("=" * 60)
    print("  声呐测距 —— 公式与单位说明")
    print("=" * 60)
    print()
    print("【核心公式】")
    print(f"  声速修正: c(T) = 1449.2 + 4.6T - 0.055T² + 0.00029T³")
    print(f"             T 为水温 (℃), c 为声速 (m/s)")
    print(f"             来源: UNESCO 淡水/海水常压经验公式")
    print()
    print(f"  测距计算: d = c × t / 2")
    print(f"             c 为声速 (m/s), t 为回波时间 (s)")
    print(f"             d 为目标距离 (m)")
    print(f"             除以 2: 声波往返传播")
    print()
    print(f"  反算回波: t = 2d / c")
    print()
    print("【单位约定】")
    print(f"  水温   : ℃  (摄氏度)")
    print(f"  声速   : m/s (米/秒)")
    print(f"  回波时间: s   (秒)")
    print(f"  距离   : m   (米)")
    print()
    print("【物理边界】")
    print(f"  水温合理范围:   [{PhysicsBounds.TEMP_MIN}, {PhysicsBounds.TEMP_MAX}] ℃")
    print(f"  回波时间范围:   [{PhysicsBounds.TIME_MIN}, {PhysicsBounds.TIME_MAX}] s")
    print(f"  声速理论范围:   [{PhysicsBounds.VELOCITY_MIN}, {PhysicsBounds.VELOCITY_MAX}] m/s")
    print(f"  目标距离:       ≥ {PhysicsBounds.DISTANCE_MIN} m")
    print()
    print("【常见错误类型】")
    print(f"  E001 缺少必填字段")
    print(f"  E002 目标距离为负")
    print(f"  E003 回波时间无效")
    print(f"  E004 水温超出范围")
    print(f"  E005 疑似声速单位错误（km/h vs m/s）")
    print(f"  E006 回波重复")
    print(f"  E007 疑似字段填反")
    print(f"  E008 交叉验证不一致")
    print(f"  E009 计算声速超出理论范围")
    print()


def cmd_review(args):
    """执行完整复盘流程"""
    data_files = args.files
    output_dir = args.output
    source_name = args.source
    check_only = args.check_only
    
    if not data_files:
        print("错误: 请指定至少一个数据文件", file=sys.stderr)
        sys.exit(1)
    
    print("=" * 60)
    print("  声呐测距误差复盘")
    print("=" * 60)
    print()
    
    # Step 1: 导入数据
    print("▶ Step 1: 导入数据")
    importer = DataImporter()
    total_imported = 0
    for file_path in data_files:
        if not os.path.exists(file_path):
            print(f"  ⚠ 文件不存在: {file_path}")
            continue
        try:
            records = importer.auto_import(file_path, source_name)
            print(f"  ✓ {file_path}: 导入 {len(records)} 条记录")
            total_imported += len(records)
        except Exception as e:
            print(f"  ✗ {file_path}: 导入失败 - {e}")
    print(f"  合计导入: {total_imported} 条记录")
    print()
    
    if total_imported == 0:
        print("没有导入任何记录，退出。")
        return
    
    import_stats = importer.get_import_stats()
    
    if check_only:
        # 仅检查模式
        print("▶ Step 2: 数据检查（仅检查，不计算）")
        cleaner = DataCleaner()
        for record in importer.get_all_records():
            cleaner.check_missing_fields(record)
            cleaner.check_negative_distance(record)
            cleaner.check_echo_time_bounds(record)
            cleaner.check_temperature_bounds(record)
            cleaner.check_velocity_unit(record)
            cleaner.check_field_swap(record)
        
        valid = [r for r in importer.get_all_records() if r.is_valid]
        invalid = [r for r in importer.get_all_records() if not r.is_valid]
        
        print(f"  有效: {len(valid)} 条  无效: {len(invalid)} 条")
        for r in invalid:
            print(f"  ✗ [{r.record_id}] {'; '.join(r.errors)}")
        for r in valid:
            if r.warnings:
                print(f"  ⚠ [{r.record_id}] {'; '.join(r.warnings)}")
        return
    
    # Step 2: 清洗与计算
    print("▶ Step 2: 数据清洗与异常过滤")
    cleaner = DataCleaner()
    all_records = importer.get_all_records()
    valid, invalid = cleaner.process_all(all_records)
    error_summary = cleaner.get_error_summary()
    print(f"  有效: {len(valid)} 条  无效: {len(invalid)} 条")
    print()
    
    # Step 3: 错因分析
    print("▶ Step 3: 错因分析")
    analyzer = ErrorAnalyzer()
    analysis_result = analyzer.analyze_all(all_records)
    summary = analysis_result['summary']
    print(f"  有效率: {summary['valid_rate']}%")
    if summary.get('top_error'):
        top = summary['top_error']
        print(f"  最常见错误: [{top['code']}] {top['name']} ({top['count']} 次)")
    print()
    
    # Step 4: 结果预览
    print("▶ Step 4: 结果预览")
    print()
    
    if valid:
        print("  【有效记录】")
        for r in valid[:10]:
            dev_str = ""
            if r.measured_distance and r.calculated_distance:
                dev = abs(r.measured_distance - r.calculated_distance)
                pct = dev / r.measured_distance * 100 if r.measured_distance > 0 else 0
                dev_str = f"  偏差={dev:.2f}m ({pct:.1f}%)"
            print(f"  ✓ [{r.record_id}] "
                  f"T={r.temperature}℃ c={r.calculated_velocity or '?'}m/s "
                  f"t={r.echo_time}s d={r.measured_distance}m "
                  f"d_calc={r.calculated_distance or '?'}m{dev_str}")
        if len(valid) > 10:
            print(f"  ... 还有 {len(valid)-10} 条有效记录")
        print()
    
    if invalid:
        print("  【无效记录】")
        for r in invalid[:10]:
            print(f"  ✗ [{r.record_id}] {'; '.join(r.errors[:3])}")
        if len(invalid) > 10:
            print(f"  ... 还有 {len(invalid)-10} 条无效记录")
        print()
    
    # Step 5: 导出报告
    print("▶ Step 5: 导出报告")
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    exporter = ReportExporter(analyzer)
    
    json_path = exporter.export_json(
        valid, invalid, import_stats, error_summary,
        str(output_path / "sonar_review_report.json"))
    print(f"  ✓ JSON报告: {json_path}")
    
    text_path = exporter.export_text(
        valid, invalid, import_stats, error_summary,
        str(output_path / "sonar_review_report.txt"))
    print(f"  ✓ 文本报告: {text_path}")
    print()
    
    print("=" * 60)
    print("  复盘完成")
    print("=" * 60)


def cmd_formulas(args):
    """显示公式与单位说明"""
    print_formulas()


def main():
    parser = argparse.ArgumentParser(
        prog="sonar_reviewer",
        description="声呐测距误差复盘工具 — 声速修正、测距计算、异常过滤、错因说明、报告导出",
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")
    
    # review 子命令
    review_parser = subparsers.add_parser(
        "review",
        help="执行完整复盘流程（导入→清洗→计算→分析→导出）")
    review_parser.add_argument(
        "files", nargs="*",
        help="数据文件路径（支持 CSV/JSON/Excel/文本，可指定多个）")
    review_parser.add_argument(
        "-o", "--output", default="./output",
        help="输出目录 (默认: ./output)")
    review_parser.add_argument(
        "-s", "--source", default=None,
        help="数据来源标注（如 '邮件', '群消息', '实验记录表'）")
    review_parser.add_argument(
        "--check-only", action="store_true",
        help="仅执行数据检查，不进行计算")
    
    # formulas 子命令
    formulas_parser = subparsers.add_parser(
        "formulas",
        help="显示公式与单位说明")
    
    args = parser.parse_args()
    
    if args.command == "review":
        cmd_review(args)
    elif args.command == "formulas":
        cmd_formulas(args)
    else:
        parser.print_help()
        print()
        print_formulas()


if __name__ == "__main__":
    main()
