#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))

from src.parser import ReportParser
from src.validator import ReportValidator
from src.report_generator import ReportGenerator


class PetCareReportCLI:
    def __init__(self):
        self.parser = ReportParser()
        self.validator = ReportValidator()

    def run(self, input_dir: str, output_dir: str, run_id: str = None):
        input_path = Path(input_dir)
        output_path = Path(output_dir)

        if not input_path.exists():
            print(f"错误: 输入目录不存在: {input_dir}")
            sys.exit(1)

        all_records = []
        all_parse_errors = []
        unprocessed_files = []

        print("=" * 60)
        print("      宠物寄养店寄养护理日报 - 数据处理工具")
        print("=" * 60)
        print(f"\n输入目录: {input_path}")
        print(f"输出目录: {output_path}")
        print()

        files = list(input_path.glob('*.csv')) + list(input_path.glob('*.json'))
        if not files:
            print("警告: 未找到任何CSV或JSON文件")
            return

        print(f"找到 {len(files)} 个文件待处理:")
        for idx, file in enumerate(files, 1):
            print(f"  {idx}. {file.name}")
        print()

        for file_path in files:
            print(f"处理中: {file_path.name}...", end=' ')
            records, errors = self.parser.parse_file(file_path)

            if errors:
                print(f"发现 {len(errors)} 个解析错误")
                all_parse_errors.extend(errors)
                unprocessed_files.append(f"{file_path.name} - 解析失败")
            else:
                print(f"成功，解析 {len(records)} 条记录")
                all_records.extend(records)

        print(f"\n总共解析 {len(all_records)} 条有效记录")

        print("\n开始数据校验...", end=' ')
        validation_result = self.validator.validate(all_records)
        print("完成")

        print(f"  正常记录: {validation_result['summary']['normal_count']}")
        print(f"  异常记录: {validation_result['summary']['abnormal_count']}")
        print(f"  发现异常: {validation_result['summary']['total_errors']} 个")

        print("\n生成报告...", end=' ')
        generator = ReportGenerator(output_path)
        reports = generator.generate_reports(
            validation_result,
            all_parse_errors,
            unprocessed_files,
            run_id
        )
        print("完成\n")

        print("生成的报告文件:")
        for report_type, file_path in reports.items():
            print(f"  - {report_type}: {file_path.name}")

        print("\n" + "=" * 60)
        print("处理完成！")
        print("=" * 60)

        return reports


def main():
    parser = argparse.ArgumentParser(
        description='宠物寄养店寄养护理日报 - 数据处理工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python main.py --input samples/normal --output output
  python main.py --input samples/dirty --output output --run-id test_001
  python main.py --input samples/rerun --output output --run-id rerun_test
        """
    )

    parser.add_argument(
        '--input', '-i',
        required=True,
        help='输入目录路径，包含待处理的CSV/JSON文件'
    )

    parser.add_argument(
        '--output', '-o',
        default='output',
        help='输出目录路径，默认为 output'
    )

    parser.add_argument(
        '--run-id',
        help='指定运行ID（用于可复跑输出对比），默认为时间戳'
    )

    args = parser.parse_args()

    cli = PetCareReportCLI()
    cli.run(args.input, args.output, args.run_id)


if __name__ == '__main__':
    main()
