import argparse
import os
import sys
from typing import List, Optional, Set
from pathlib import Path

from .parser import CSVParser, ParseResult
from .rules import ValidationRules, MissingMeterDetector, RuleResult
from .reporter import ReportGenerator


def read_anomaly_list(file_path: Optional[str]) -> Set[str]:
    if not file_path or not os.path.exists(file_path):
        return set()
    
    meters = set()
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                meters.add(line)
    return meters


def read_expected_meters(file_path: Optional[str]) -> Set[str]:
    if not file_path or not os.path.exists(file_path):
        return set()
    
    meters = set()
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                meters.add(line)
    return meters


def run_check(files: List[str], 
              previous_file: Optional[str] = None,
              anomaly_list_file: Optional[str] = None,
              expected_meters_file: Optional[str] = None,
              min_usage: float = 0.0,
              max_usage: float = 10000.0,
              ratio_threshold: float = 3.0,
              output_dir: str = "output",
              output_prefix: str = "",
              encoding: str = "utf-8") -> int:
    
    parser = CSVParser(encoding=encoding)
    parse_result = parser.parse_files(files)
    
    prev_records = None
    if previous_file and os.path.exists(previous_file):
        prev_result = parser.parse_file(previous_file)
        prev_records = prev_result.records
    
    anomaly_list = read_anomaly_list(anomaly_list_file)
    expected_meters = read_expected_meters(expected_meters_file)
    
    rules = ValidationRules(
        min_usage=min_usage,
        max_usage=max_usage,
        ratio_threshold=ratio_threshold,
        manual_anomaly_list=anomaly_list,
        allow_zero_usage=True
    )
    
    rule_result = rules.apply(parse_result.all_records(), prev_records)
    
    missing_detector = MissingMeterDetector(expected_meters=expected_meters)
    missing_meters = missing_detector.detect(parse_result.all_records(), prev_records)
    
    reporter = ReportGenerator(output_dir=output_dir)
    output_files = reporter.generate_all(parse_result, rule_result, missing_meters, output_prefix)
    
    reporter.print_console_summary(rule_result, missing_meters)
    
    print(f"\n输出文件已生成:")
    for name, path in output_files.items():
        print(f"  - {name}: {path}")
    
    return 0 if (len(rule_result.anomalies) == 0 and len(missing_meters) == 0) else 1


def main():
    parser = argparse.ArgumentParser(
        description="水电抄表倍率异常用量缺表提示排查CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python -m meter_reader.cli data.csv
  python -m meter_reader.cli data.csv -p prev_month.csv
  python -m meter_reader.cli data.csv -a anomaly_list.txt -m expected_meters.txt
  python -m meter_reader.cli data.csv --max-usage 5000 --ratio 2.5
        """
    )
    
    parser.add_argument("files", nargs="+", help="要检查的CSV文件路径")
    parser.add_argument("-p", "--previous", metavar="FILE", help="上期数据文件路径，用于环比比较")
    parser.add_argument("-a", "--anomaly-list", metavar="FILE", help="异常清单文件，每行一个表号")
    parser.add_argument("-m", "--expected-meters", metavar="FILE", help="预期表号清单，用于缺表检测")
    parser.add_argument("--min-usage", type=float, default=0.0, help="用量下限阈值 (默认: 0)")
    parser.add_argument("--max-usage", type=float, default=10000.0, help="用量上限阈值 (默认: 10000)")
    parser.add_argument("--ratio", type=float, default=3.0, help="环比波动阈值倍数 (默认: 3)")
    parser.add_argument("-o", "--output-dir", default="output", help="输出目录 (默认: output)")
    parser.add_argument("--prefix", default="", help="输出文件名前缀")
    parser.add_argument("--encoding", default="utf-8", help="文件编码 (默认: utf-8)")
    parser.add_argument("-v", "--version", action="version", version="%(prog)s 1.0.0")
    
    args = parser.parse_args()
    
    for f in args.files:
        if not os.path.exists(f):
            print(f"错误: 文件不存在: {f}")
            sys.exit(1)
    
    try:
        exit_code = run_check(
            files=args.files,
            previous_file=args.previous,
            anomaly_list_file=args.anomaly_list,
            expected_meters_file=args.expected_meters,
            min_usage=args.min_usage,
            max_usage=args.max_usage,
            ratio_threshold=args.ratio,
            output_dir=args.output_dir,
            output_prefix=args.prefix,
            encoding=args.encoding
        )
        sys.exit(exit_code)
    except Exception as e:
        print(f"错误: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
