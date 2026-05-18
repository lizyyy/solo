#!/usr/bin/env python3
import argparse
import os
import sys
from pathlib import Path

from parser import DataParser, DataSourceType
from validator import RuleValidator
from calculator import DepositPointsCalculator
from tracker import SourceTracker
from reporter import ReportGenerator


def parse_arguments():
    parser = argparse.ArgumentParser(
        description='渔具归还押金扣减积分补偿排查CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  python main.py --members data/members.csv --rentals data/rentals.csv 
                --equipment data/equipment.csv --returns data/returns.csv 
                --deposits data/deposits.csv
        """
    )
    
    parser.add_argument('--members', '-m', required=True,
                        help='会员数据CSV文件路径')
    parser.add_argument('--rentals', '-r', required=True,
                        help='租借单数据CSV文件路径')
    parser.add_argument('--equipment', '-e', required=True,
                        help='渔具清单CSV文件路径')
    parser.add_argument('--returns', '-rt', required=True,
                        help='归还检查记录CSV文件路径')
    parser.add_argument('--deposits', '-d', required=True,
                        help='押金记录CSV文件路径')
    parser.add_argument('--output-dir', '-o', default='reports',
                        help='报告输出目录 (默认: reports)')
    parser.add_argument('--quiet', '-q', action='store_true',
                        help='静默模式，不输出控制台摘要')
    
    return parser.parse_args()


def validate_file_paths(args):
    files_to_check = [
        (args.members, '会员数据'),
        (args.rentals, '租借单数据'),
        (args.equipment, '渔具清单'),
        (args.returns, '归还检查记录'),
        (args.deposits, '押金记录')
    ]
    
    missing_files = []
    for file_path, description in files_to_check:
        if not os.path.exists(file_path):
            missing_files.append(f"{description}: {file_path}")
    
    if missing_files:
        print("错误: 以下文件不存在:")
        for missing in missing_files:
            print(f"  - {missing}")
        sys.exit(1)


def main():
    args = parse_arguments()
    validate_file_paths(args)
    
    print("正在解析数据文件...")
    
    data_parser = DataParser()
    
    data_parser.parse_csv(args.members, DataSourceType.MEMBER)
    data_parser.parse_csv(args.rentals, DataSourceType.RENTAL)
    data_parser.parse_csv(args.equipment, DataSourceType.EQUIPMENT)
    data_parser.parse_csv(args.returns, DataSourceType.RETURN_CHECK)
    data_parser.parse_csv(args.deposits, DataSourceType.DEPOSIT)
    
    invalid_rows = data_parser.get_invalid_rows()
    
    print("正在进行规则验证...")
    validator = RuleValidator()
    validator.load_data(data_parser.rows)
    issues = validator.validate_all()
    
    print("正在计算押金扣减和积分补偿...")
    calculator = DepositPointsCalculator()
    calculator.load_data(data_parser.rows)
    calculations = calculator.calculate_all()
    summary = calculator.get_calculation_summary()
    
    print("正在追踪问题来源...")
    tracker = SourceTracker()
    tracker.track_invalid_rows(invalid_rows)
    tracker.track_issue_sources(issues)
    
    print("正在生成报告...")
    reporter = ReportGenerator(output_dir=args.output_dir)
    reports = reporter.generate_all_reports(
        invalid_rows=invalid_rows,
        issues=issues,
        calculations=calculations,
        summary=summary,
        tracker=tracker
    )
    
    if not args.quiet:
        reporter.print_console_summary(
            invalid_rows=invalid_rows,
            issues=issues,
            calculations=calculations,
            summary=summary
        )
    
    print("报告文件:")
    for report_type, file_path in reports.items():
        print(f"  - {report_type}: {file_path}")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
