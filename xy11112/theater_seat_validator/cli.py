import argparse
import sys
from pathlib import Path
from typing import List

from .parser import SeatDataParser
from .reporter import ReportGenerator
from .validator import SeatValidator, ValidationLevel


class ValidationCLI:
    def __init__(self):
        self.parser = SeatDataParser()
        self.validator = SeatValidator()
        self.reporter = ReportGenerator()

    def run(self, argv: List[str] = None):
        if argv is None:
            argv = sys.argv[1:]

        parser = argparse.ArgumentParser(
            description="小剧场票务 - 剧场座位校验工具",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
样例:
  python -m theater_seat_validator validate samples/normal.csv
  python -m theater_seat_validator validate samples/*.csv --continue-on-error
  python -m theater_seat_validator validate samples/normal.csv --format json
            """
        )
        
        subparsers = parser.add_subparsers(dest='command', help='可用命令')
        
        validate_parser = subparsers.add_parser('validate', help='校验座位数据文件')
        validate_parser.add_argument('files', nargs='+', help='要校验的文件路径')
        validate_parser.add_argument('--continue-on-error', action='store_true', 
                                      help='遇到错误时继续处理剩余文件')
        validate_parser.add_argument('--format', choices=['text', 'json', 'both'], 
                                      default='both', help='报告输出格式')
        validate_parser.add_argument('--output-dir', default='reports', 
                                      help='报告输出目录')
        
        list_parser = subparsers.add_parser('list', help='列出支持的校验规则')
        
        args = parser.parse_args(argv)
        
        if args.command == 'validate':
            self._validate_files(args)
        elif args.command == 'list':
            self._list_rules()
        else:
            parser.print_help()

    def _validate_files(self, args):
        files = []
        for file_pattern in args.files:
            if '*' in file_pattern or '?' in file_pattern:
                files.extend(Path('.').glob(file_pattern))
            else:
                path = Path(file_pattern)
                if path.exists():
                    files.append(path)
                else:
                    print(f"错误: 文件不存在 - {file_pattern}", file=sys.stderr)
                    if not args.continue_on_error:
                        sys.exit(1)

        if not files:
            print("错误: 没有找到要处理的文件", file=sys.stderr)
            sys.exit(1)

        self.reporter.output_dir = Path(args.output_dir)
        
        all_results = []
        failed_files = []
        
        print(f"开始校验 {len(files)} 个文件...")
        print("-" * 60)
        
        for idx, file_path in enumerate(files, 1):
            print(f"[{idx}/{len(files)}] 处理: {file_path.name}")
            
            try:
                result = self._validate_single_file(file_path, args.format)
                all_results.append(result)
                print(f"  ✓ 完成 - 错误: {result['errors']}, 警告: {result['warnings']}")
                
            except Exception as e:
                error_msg = str(e)
                failed_files.append({
                    'file': str(file_path),
                    'error': error_msg
                })
                print(f"  ✗ 失败: {error_msg}")
                
                if not args.continue_on_error:
                    print("\n处理终止。使用 --continue-on-error 可继续处理剩余文件。", file=sys.stderr)
                    sys.exit(1)
                else:
                    print(f"  记录原因后继续处理...")

        print("-" * 60)
        self._print_final_summary(all_results, failed_files)
        
        if failed_files and not args.continue_on_error:
            sys.exit(1)

    def _validate_single_file(self, file_path: Path, output_format: str) -> dict:
        parsed_data = self.parser.parse(str(file_path))
        issues = self.validator.validate(parsed_data)
        
        run_id = file_path.stem
        report = self.reporter.generate(parsed_data, issues, run_id=run_id)
        
        text_path = None
        json_path = None
        
        if output_format in ['text', 'both']:
            text_path = self.reporter.save_text_report(report)
        if output_format in ['json', 'both']:
            json_path = self.reporter.save_json_report(report)
        
        errors = sum(1 for i in issues if i.level == ValidationLevel.ERROR)
        warnings = sum(1 for i in issues if i.level == ValidationLevel.WARNING)
        
        return {
            'file': str(file_path),
            'errors': errors,
            'warnings': warnings,
            'text_report': text_path,
            'json_report': json_path
        }

    def _print_final_summary(self, results: list, failed_files: list):
        print("校验完成!")
        print()
        
        success_count = len(results)
        fail_count = len(failed_files)
        
        print(f"成功: {success_count} 个文件")
        if fail_count > 0:
            print(f"失败: {fail_count} 个文件")
            for fail in failed_files:
                print(f"  - {fail['file']}: {fail['error']}")
        
        print()
        
        total_errors = sum(r['errors'] for r in results)
        total_warnings = sum(r['warnings'] for r in results)
        
        print(f"总计错误: {total_errors}")
        print(f"总计警告: {total_warnings}")
        
        if results:
            print()
            print("报告文件:")
            for r in results:
                if r['text_report']:
                    print(f"  文本: {r['text_report']}")
                if r['json_report']:
                    print(f"  JSON: {r['json_report']}")

    def _list_rules(self):
        from .validator import ValidationCode
        
        print("小剧场座位校验规则:")
        print("=" * 60)
        print()
        
        print("错误类 (E001-E010):")
        print("-" * 40)
        error_rules = [
            ("E001", "重复座位编号"),
            ("E002", "无效座号（非正整数）"),
            ("E003", "无效排号"),
            ("E004", "区域重叠"),
            ("E005", "轮椅位通道问题"),
            ("E006", "套票座位冲突"),
            ("E007", "加座缺少父座位"),
            ("E008", "超出容量限制"),
            ("E009", "缺少必填字段"),
            ("E010", "无效座位类型"),
        ]
        for code, desc in error_rules:
            print(f"  {code} - {desc}")
        
        print()
        print("警告类 (W001-W003):")
        print("-" * 40)
        warning_rules = [
            ("W001", "价格异常"),
            ("W002", "孤立座位"),
            ("W003", "空排"),
        ]
        for code, desc in warning_rules:
            print(f"  {code} - {desc}")
        
        print()
        print("提示类 (I001):")
        print("-" * 40)
        print("  I001 - 跳过座位")
        print()


def main():
    cli = ValidationCLI()
    cli.run()


if __name__ == '__main__':
    main()
