#!/usr/bin/env python3
import argparse
import sys
import os
from datetime import datetime
from pathlib import Path
from typing import Dict

sys.path.insert(0, str(Path(__file__).parent))

from src.config import load_config
from src.parser import RetentionParser
from src.validator import RetentionValidator
from src.holiday_manager import HolidayManager
from src.report_generator import ReportGenerator

def print_banner():
    banner = """
╔══════════════════════════════════════════════════════════════╗
║                    糕点中央厨房留样销毁提醒工具                 ║
║               Pastry Kitchen Retention Destruction            ║
╚══════════════════════════════════════════════════════════════╝
"""
    print(banner)

def print_summary(result: Dict):
    print("\n" + "="*60)
    print("【运行摘要】")
    print("="*60)
    print(f"  总记录数:     {result['total_records']}")
    print(f"  有效记录:     {result['valid_records']}")
    print(f"  解析错误:     {result['parse_errors']}")
    print(f"  重复盒号:     {result['duplicate_boxes']} 组")
    print(f"  待销毁提醒:   {result['pending_destruction']} 条")
    print(f"  超期未销毁:   {result['overdue_destruction']} 条")
    print("="*60)
    
    print("\n【输出文件】")
    for key, filepath in result['output_files'].items():
        if filepath:
            print(f"  ✓ {filepath}")
    print()

def run_retention_check(input_file: str, config_path: str = None, 
                        run_timestamp: str = None) -> Dict:
    config = load_config(config_path)
    
    parser = RetentionParser(config)
    parse_result = parser.parse_file(input_file)
    
    validator = RetentionValidator(config)
    validation_result = validator.validate(parse_result['records'])
    
    holiday_manager = HolidayManager(config)
    report_generator = ReportGenerator(config, holiday_manager)
    
    if not run_timestamp:
        run_timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    report_result = report_generator.generate_reports(
        parse_result, validation_result, run_timestamp
    )
    
    return report_result

def main():
    parser = argparse.ArgumentParser(
        description='糕点中央厨房留样销毁提醒 CLI 工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python main.py samples/正常数据.csv
  python main.py samples/脏数据.csv --config config/default.yaml
  python main.py samples/重跑对照.csv --timestamp 20250101_120000
        """
    )
    
    parser.add_argument(
        'input_file',
        help='输入的留样记录CSV文件路径'
    )
    
    parser.add_argument(
        '--config', '-c',
        help='配置文件路径 (默认: config/default.yaml)'
    )
    
    parser.add_argument(
        '--timestamp', '-t',
        help='指定运行时间戳 (用于可复跑输出，格式: YYYYMMDD_HHMMSS)'
    )
    
    parser.add_argument(
        '--quiet', '-q',
        action='store_true',
        help='静默模式，不打印Banner'
    )
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input_file):
        print(f"错误: 输入文件不存在: {args.input_file}")
        sys.exit(1)
    
    if not args.quiet:
        print_banner()
    
    print(f"处理文件: {args.input_file}")
    if args.timestamp:
        print(f"使用时间戳: {args.timestamp}")
    
    try:
        result = run_retention_check(
            args.input_file,
            args.config,
            args.timestamp
        )
        print_summary(result)
        print("处理完成!")
        return 0
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())
