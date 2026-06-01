#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from fractal_generator import FractalGenerator, RecordStorage
from fractal_generator.sample_data import SAMPLE_INPUTS, MANUAL_OVERRIDES


class FractalCLI:
    def __init__(self):
        self.generator = FractalGenerator()
        self.storage = RecordStorage()
    
    def run_samples(self, case_filter=None):
        print("=" * 80)
        print("分形纹样参数生成 - 样例运行")
        print("=" * 80)
        
        results = []
        for sample in SAMPLE_INPUTS:
            case_id = sample['case']
            
            if case_filter and case_id != case_filter:
                continue
            
            print(f"\n{'-' * 60}")
            print(f"处理: {case_id} - {sample['description']}")
            print(f"来源: {sample['source']}")
            print(f"{'-' * 60}")
            
            override = self.storage.get_override(case_id)
            if not override:
                override = MANUAL_OVERRIDES.get(case_id)
            
            record = self.generator.generate_pattern(
                raw_input=sample['raw_input'],
                source=sample['source'],
                existing_override=override
            )
            
            if sample.get('is_legacy', False):
                from fractal_generator.core import FractalStatus
                record.status = FractalStatus.LEGACY
                record.notes = sample.get('legacy_notes', '')
            
            self.storage.save_record(record)
            results.append(record)
            
            self._print_record(record, sample['raw_input'])
        
        print(f"\n{'=' * 80}")
        print(f"处理完成: {len(results)} 条记录")
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
        for k, v in raw_input.items():
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
            print(f"\n验证问题 ({len(record.validation_issues)} 条:")
            for issue in record.validation_issues:
                severity_mark = {'error': '❌', 'warning': '⚠️', 'info': 'ℹ️'}.get(issue.severity, '•')
                print(f"  {severity_mark} [{issue.severity.upper()}] {issue.field}: {issue.message}")
                if issue.suggestion:
                    print(f"     💡 建议: {issue.suggestion}")
        
        if record.notes:
            print(f"\n备注: {record.notes}")
    
    def _print_summary(self):
        summary = self.storage.get_summary()
        print(f"\n📊 汇总统计:")
        print(f"  总记录数: {summary['total_records']}")
        print(f"  例外记录数: {summary['total_exceptions']}")
        print(f"  人工覆盖数: {summary['manual_overrides']}")
        print(f"\n  按状态分布:")
        for status, count in summary['by_status'].items():
            print(f"    {status}: {count}")
        print(f"\n  按来源分布:")
        for source, count in summary['by_source'].items():
            print(f"    {source}: {count}")
    
    def show_formulas(self):
        print("\n📐 计算公式说明:")
        print("=" * 60)
        formulas = self.generator.get_formula_explanation()
        for name, desc in formulas.items():
            print(f"\n{name}:")
            print(f"  {desc}")
    
    def export(self, filepath, status_filter=None):
        path = self.storage.export_records(filepath, status_filter)
        print(f"\n✅ 已导出至: {path}")
        if status_filter:
            print(f"   筛选条件: status = {status_filter}")
    
    def list_records(self, status_filter=None):
        records = self.storage.get_all_records(status_filter)
        print(f"\n📋 记录列表 ({len(records)} 条:")
        print("-" * 60)
        for r in records:
            status_mark = {'success': '✅', 'needs_review': '⚠️', 'legacy': '📜', 'error': '❌'}.get(r.status.value, '❓')
            print(f"  {status_mark} {r.record_id} | {r.status.value:12} | {r.source:20} | {r.processed_at.strftime('%m-%d %H:%M')}")
            if r.manual_override:
                print(f"     ⚙️  人工覆盖: {r.override_reason}")


def main():
    parser = argparse.ArgumentParser(
        description='分形纹样参数生成工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  python cli.py run                    # 运行所有样例
  python cli.py run --case case_002    # 运行指定案例
  python cli.py formulas               # 查看计算公式
  python cli.py list                  # 查看所有记录
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
    list_parser.add_argument('--status', help='按状态筛选', default=None)
    
    export_parser = subparsers.add_parser('export', help='导出记录')
    export_parser.add_argument('filepath', help='导出文件路径')
    export_parser.add_argument('--status', help='按状态筛选', default=None)
    
    args = parser.parse_args()
    
    cli = FractalCLI()
    
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


if __name__ == '__main__':
    main()
