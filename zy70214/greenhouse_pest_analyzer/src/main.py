"""温室虫害诱捕分析器 - 主程序入口"""

import os
import sys
import argparse
from datetime import datetime
from typing import List

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models import TrapRecord, BatchAnalysisResult, AnalysisResult
from src.data_loader import DataLoader
from src.rule_engine import RuleEngine
from src.report_generator import ReportGenerator


class PestAnalyzer:
    """温室虫害诱捕分析器主类"""

    def __init__(self, config_path: str = None, output_dir: str = None):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

        if config_path is None:
            config_path = os.path.join(base_dir, 'config', 'rules.yaml')

        if output_dir is None:
            output_dir = os.path.join(base_dir, 'reports')

        self.data_loader = DataLoader()
        self.rule_engine = RuleEngine(config_path)
        self.report_generator = ReportGenerator(output_dir)

    def analyze_records(self, records: List[TrapRecord], batch_id: str = None) -> BatchAnalysisResult:
        """分析记录列表"""
        if batch_id is None:
            batch_id = f"BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        batch_result = BatchAnalysisResult(batch_id=batch_id)
        batch_result.total_records = len(records)

        duplicate_issues = self.rule_engine.validate_duplicates(records)
        duplicate_record_ids = set()
        for issue in duplicate_issues:
            dup_record_id = issue.related_values.get('duplicate_record_id', '')
            if dup_record_id:
                duplicate_record_ids.add(dup_record_id)

        issue_summary = {}

        for record in records:
            result = self.rule_engine.analyze_single_record(record)

            if record.record_id in duplicate_record_ids:
                for issue in duplicate_issues:
                    if issue.related_values.get('duplicate_record_id') == record.record_id:
                        result.add_issue(issue)

                if result.quality_grade != "D":
                    result.quality_grade = "D"
                    result.quality_grade_name = "不合格"

            for issue in result.issues:
                rule_id = issue.rule_id
                if rule_id not in issue_summary:
                    issue_summary[rule_id] = 0
                issue_summary[rule_id] += 1

            batch_result.results.append(result)
            batch_result.grade_distribution[result.quality_grade] = \
                batch_result.grade_distribution.get(result.quality_grade, 0) + 1

            if result.has_critical_issues():
                batch_result.invalid_records += 1
            else:
                batch_result.valid_records += 1

        batch_result.issue_summary = dict(sorted(
            issue_summary.items(),
            key=lambda x: x[1],
            reverse=True
        ))

        return batch_result

    def run_with_samples(self, sample_type: str = 'all') -> BatchAnalysisResult:
        """使用样例数据运行"""
        records = self.data_loader.load_sample_data(sample_type)
        batch_id = f"SAMPLE_{sample_type.upper()}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        return self.analyze_records(records, batch_id)

    def run_with_file(self, file_path: str) -> BatchAnalysisResult:
        """从文件加载并分析数据"""
        if file_path.endswith('.json'):
            records = self.data_loader.load_from_json(file_path)
        elif file_path.endswith('.csv'):
            records = self.data_loader.load_from_csv(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {file_path}")

        filename = os.path.basename(file_path)
        batch_id = f"FILE_{os.path.splitext(filename)[0]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        return self.analyze_records(records, batch_id)


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='温室虫害诱捕分析器 - 自动校验诱捕板数据质量',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
使用示例:
  python main.py                           # 使用内置样例数据
  python main.py --sample-type normal      # 仅使用正常样例
  python main.py --sample-type abnormal    # 仅使用异常样例
  python main.py --file data/records.json  # 使用自己的JSON文件
  python main.py --file data/records.csv   # 使用自己的CSV文件
  python main.py --output reports/         # 指定输出目录
        '''
    )

    parser.add_argument(
        '--sample-type',
        type=str,
        default='all',
        choices=['all', 'normal', 'abnormal'],
        help='样例数据类型: all(全部), normal(正常), abnormal(异常)'
    )

    parser.add_argument(
        '--file',
        type=str,
        default=None,
        help='自定义数据文件路径(JSON或CSV格式)'
    )

    parser.add_argument(
        '--config',
        type=str,
        default=None,
        help='规则配置文件路径(默认: config/rules.yaml)'
    )

    parser.add_argument(
        '--output',
        type=str,
        default=None,
        help='报告输出目录(默认: reports/)'
    )

    parser.add_argument(
        '--no-print',
        action='store_true',
        help='不在控制台打印结果'
    )

    parser.add_argument(
        '--json-only',
        action='store_true',
        help='仅生成JSON报告，不生成文本报告'
    )

    args = parser.parse_args()

    print("=" * 60)
    print("         温室虫害诱捕分析器 v1.0")
    print("=" * 60)
    print()

    try:
        analyzer = PestAnalyzer(
            config_path=args.config,
            output_dir=args.output
        )

        if args.file:
            print(f"▶ 加载数据文件: {args.file}")
            batch_result = analyzer.run_with_file(args.file)
        else:
            print(f"▶ 使用内置样例数据 (类型: {args.sample_type})")
            batch_result = analyzer.run_with_samples(args.sample_type)

        print(f"▶ 分析完成: 共 {batch_result.total_records} 条记录")
        print(f"   - 有效记录: {batch_result.valid_records} 条")
        print(f"   - 无效记录: {batch_result.invalid_records} 条")
        print()

        if not args.no_print:
            print("=" * 60)
            print()
            analyzer.report_generator.print_result(batch_result)

        json_file = analyzer.report_generator.generate_json_report(batch_result)
        print(f"▶ JSON报告已保存: {json_file}")

        if not args.json_only:
            txt_file = analyzer.report_generator.generate_text_report(batch_result)
            print(f"▶ 文本报告已保存: {txt_file}")

        print()
        print("=" * 60)
        print("分析完成！请查看报告文件了解详细结果。")
        print("=" * 60)

        return 0

    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
