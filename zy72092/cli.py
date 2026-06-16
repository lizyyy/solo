#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from fractal_generator import FractalGenerator, RecordStorage
from fractal_generator.core import FractalStatus
from fractal_generator.storage import StorageError
from fractal_generator.sample_data import SAMPLE_INPUTS, MANUAL_OVERRIDES
from fractal_generator.validator import FractalValidator


class FractalCLI:
    def __init__(self):
        try:
            self.generator = FractalGenerator()
            self.storage = RecordStorage()
        except StorageError as e:
            print(f"❌ 初始化存储失败: {e}", file=sys.stderr)
            sys.exit(1)

    def run_samples(self, case_filter=None):
        FractalValidator.reset_duplicate_tracker()

        print("=" * 80)
        print("分形纹样参数生成 - 样例运行")
        print("=" * 80)

        results = []
        error_count = 0

        for sample in SAMPLE_INPUTS:
            case_id = sample.get('case', '')

            if case_filter and case_id != case_filter:
                continue

            print(f"\n{'-' * 60}")
            print(f"处理: {case_id} - {sample.get('description', '无描述')}")
            print(f"来源: {sample.get('source', '未知')}")
            print(f"{'-' * 60}")

            try:
                override = self.storage.get_override(case_id)
                if not override:
                    override = MANUAL_OVERRIDES.get(case_id)

                raw_input = sample.get('raw_input', {})
                if raw_input is None:
                    raw_input = {}

                record = self.generator.generate_pattern(
                    raw_input=raw_input,
                    source=sample.get('source', 'unknown'),
                    existing_override=override
                )

                if sample.get('is_legacy', False):
                    record.status = FractalStatus.LEGACY
                    legacy_note = sample.get('legacy_notes', '')
                    record.notes = legacy_note if legacy_note else '旧口径记录'

                self.storage.save_record(record)
                results.append(record)

                self._print_record(record, raw_input)

            except StorageError as e:
                error_count += 1
                print(f"\n❌ 存储错误: {e}", file=sys.stderr)
                print(f"   案例 {case_id} 已处理但未持久化")
            except Exception as e:
                error_count += 1
                print(f"\n❌ 处理案例 {case_id} 时出错: {e}", file=sys.stderr)

        print(f"\n{'=' * 80}")
        print(f"处理完成: {len(results)} 条成功, {error_count} 条失败")
        if results:
            self._print_summary()
        print(f"{'=' * 80}")

        return results

    def _print_record(self, record, raw_input):
        status_emoji = {
            'success': '✅',
            'needs_review': '⚠️',
            'legacy': '📜',
            'error': '❌'
        }.get(record.status.value, '❓')

        print(f"\n状态: {status_emoji} {record.status.value.upper()}")
        print(f"记录ID: {record.record_id}")
        print(f"处理时间: {record.processed_at.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"人工覆盖: {'是' if record.manual_override else '否'}")

        if record.manual_override:
            print(f"  - 覆盖原因: {record.override_reason}")
            print(f"  - 操作人: {record.override_by}")
            if record.override_at:
                print(f"  - 覆盖时间: {record.override_at}")

        print(f"\n原始输入:")
        for k, v in (raw_input.items() if isinstance(raw_input, dict) else []):
            print(f"  {k}: {v}")

        print(f"\n解析后参数:")
        pattern = record.pattern
        print(f"  分形维度: {pattern.fractal_dimension}")
        print(f"  迭代次数: {pattern.iterations}")
        print(f"  缩放因子: {pattern.scale_factor}")
        print(f"  旋转角度: {pattern.rotation_angle}")
        print(f"  基础形状: {pattern.base_shape}")
        print(f"  单位: {pattern.unit.value if pattern.unit else None}")
        print(f"  配色方案: {pattern.color_palette}")
        print(f"  复杂度评分: {pattern.complexity_score}")

        if record.validation_issues:
            print(f"\n验证问题 ({len(record.validation_issues)} 条):")
            for issue in record.validation_issues:
                severity_mark = {'error': '❌', 'warning': '⚠️', 'info': 'ℹ️'}.get(issue.severity, '•')
                print(f"  {severity_mark} [{issue.severity.upper()}] {issue.field}: {issue.message}")
                if issue.suggestion:
                    print(f"     建议: {issue.suggestion}")

        if record.notes:
            print(f"\n备注: {record.notes}")

    def _print_summary(self):
        try:
            summary = self.storage.get_summary()
        except Exception:
            print(f"\n  (汇总统计读取失败)")
            return

        print(f"\n汇总统计:")
        print(f"  总记录数: {summary['total_records']}")
        print(f"  例外记录数: {summary['total_exceptions']}")
        print(f"  人工覆盖数: {summary['manual_overrides']}")

        high_risk = summary.get('high_risk_metrics', {})
        if high_risk and any(v > 0 for v in high_risk.values()):
            print(f"\n  高风险指标:")
            if high_risk.get('high_complexity', 0) > 0:
                print(f"    ⚠️  高复杂度 (>85): {high_risk['high_complexity']} 条")
            if high_risk.get('high_dimension', 0) > 0:
                print(f"    ⚠️  高维度 (>2.5): {high_risk['high_dimension']} 条")
            if high_risk.get('duplicates', 0) > 0:
                print(f"    ⚠️  重复参数: {high_risk['duplicates']} 条")

        print(f"\n  按状态分布:")
        for status, count in summary['by_status'].items():
            mark = "⚠️ " if status != 'success' else "  "
            print(f"    {mark}{status}: {count}")

        print(f"\n  按来源分布:")
        for source, count in summary['by_source'].items():
            print(f"      {source}: {count}")

        exception_ids = summary.get('exception_ids', [])
        if exception_ids:
            print(f"\n  例外记录ID: {', '.join(exception_ids)}")

    def show_formulas(self):
        print("\n计算公式说明:")
        print("=" * 60)
        formulas = self.generator.get_formula_explanation()
        for name, desc in formulas.items():
            print(f"\n{name}:")
            print(f"  {desc}")

    def export(self, filepath, status_filter=None):
        try:
            path = self.storage.export_records(filepath, status_filter)
            print(f"\n✅ 已导出至: {path}")
            if status_filter:
                print(f"   筛选条件: status = {status_filter}")
        except StorageError as e:
            print(f"\n❌ 导出失败: {e}", file=sys.stderr)
            sys.exit(1)

    def list_records(self, status_filter=None):
        try:
            records = self.storage.get_all_records(status_filter)
        except Exception as e:
            print(f"\n❌ 读取记录失败: {e}", file=sys.stderr)
            return

        print(f"\n记录列表 ({len(records)} 条):")
        print("-" * 60)
        if not records:
            print("  (无记录)")
            return
        for r in records:
            status_mark = {'success': '✅', 'needs_review': '⚠️', 'legacy': '📜', 'error': '❌'}.get(r.status.value, '❓')
            try:
                print(f"  {status_mark} {r.record_id} | {r.status.value:12} | {r.source:20} | {r.processed_at.strftime('%m-%d %H:%M')}")
                if r.manual_override:
                    print(f"     人工覆盖: {r.override_reason}")
            except Exception:
                print(f"  ❓ (记录显示异常)")


def main():
    parser = argparse.ArgumentParser(
        description='分形纹样参数生成工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  python cli.py run                    # 运行所有样例
  python cli.py run --case case_002    # 运行指定案例
  python cli.py formulas               # 查看计算公式
  python cli.py list                   # 查看所有记录
  python cli.py list --status needs_review  # 筛选待复核记录
  python cli.py export output.json     # 导出所有记录
  python cli.py export filtered.json --status success  # 按状态筛选导出
        '''
    )

    subparsers = parser.add_subparsers(dest='command', help='可用命令')

    run_parser = subparsers.add_parser('run', help='运行样例数据')
    run_parser.add_argument('--case', help='指定案例ID', default=None)

    subparsers.add_parser('formulas', help='显示计算公式说明')

    list_parser = subparsers.add_parser('list', help='列出记录')
    list_parser.add_argument('--status', help='按状态筛选', default=None,
                             choices=['success', 'needs_review', 'legacy', 'error'])

    export_parser = subparsers.add_parser('export', help='导出记录')
    export_parser.add_argument('filepath', help='导出文件路径')
    export_parser.add_argument('--status', help='按状态筛选', default=None,
                               choices=['success', 'needs_review', 'legacy', 'error'])

    args = parser.parse_args()

    try:
        cli = FractalCLI()
    except SystemExit:
        raise
    except Exception as e:
        print(f"❌ 启动失败: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        if args.command == 'run':
            cli.run_samples(args.case)
        elif args.command == 'formulas':
            cli.show_formulas()
        elif args.command == 'list':
            cli.list_records(args.status)
        elif args.command == 'export':
            cli.export(args.filepath, args.status)
        else:
            parser.print_help()
    except KeyboardInterrupt:
        print("\n已中断", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ 运行出错: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
