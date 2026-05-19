import json
import csv
from pathlib import Path
from typing import List, Dict, Any, Optional
from collections import defaultdict
from .rule_engine import PasswordResult


class Reporter:
    def __init__(self, results: List[PasswordResult]):
        self.results = results

    def group_by_test_group(self) -> Dict[str, List[PasswordResult]]:
        groups = defaultdict(list)
        for result in self.results:
            groups[result.test_group].append(result)
        return dict(sorted(groups.items()))

    def group_by_failure_reason(self) -> Dict[str, List[PasswordResult]]:
        groups = defaultdict(list)
        for result in self.results:
            if not result.is_valid:
                for fr in result.failure_reasons:
                    groups[fr.rule_id].append(result)
        return dict(sorted(groups.items()))

    def group_by_validity(self) -> Dict[str, List[PasswordResult]]:
        valid = []
        invalid = []
        for result in self.results:
            if result.is_valid:
                valid.append(result)
            else:
                invalid.append(result)
        return {'valid': valid, 'invalid': invalid}

    def get_statistics(self) -> Dict[str, Any]:
        total = len(self.results)
        valid_count = sum(1 for r in self.results if r.is_valid)
        invalid_count = total - valid_count

        failure_counts = defaultdict(int)
        for result in self.results:
            for fr in result.failure_reasons:
                failure_counts[fr.rule_id] += 1

        group_stats = {}
        for group_name, group_results in self.group_by_test_group().items():
            group_total = len(group_results)
            group_valid = sum(1 for r in group_results if r.is_valid)
            group_stats[group_name] = {
                'total': group_total,
                'valid': group_valid,
                'invalid': group_total - group_valid,
                'valid_rate': group_valid / group_total if group_total > 0 else 0
            }

        return {
            'total': total,
            'valid': valid_count,
            'invalid': invalid_count,
            'valid_rate': valid_count / total if total > 0 else 0,
            'failure_counts': dict(sorted(failure_counts.items())),
            'group_stats': group_stats
        }

    def generate_json_report(self, file_path: str, indent: int = 2) -> None:
        report = {
            'statistics': self.get_statistics(),
            'results': [r.to_dict() for r in self.results]
        }
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=indent, sort_keys=True)

    def generate_csv_report(self, file_path: str) -> None:
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                'password', 'is_valid', 'test_group', 'description',
                'source_file', 'line_number', 'failure_reason_count',
                'failure_reasons'
            ])

            for result in self.results:
                failure_messages = ' | '.join([fr.message for fr in result.failure_reasons])
                writer.writerow([
                    result.password,
                    '1' if result.is_valid else '0',
                    result.test_group,
                    result.description,
                    result.source_file or '',
                    result.line_number or '',
                    len(result.failure_reasons),
                    failure_messages
                ])

    def generate_group_reports(self, output_dir: str, format: str = 'json') -> None:
        groups = self.group_by_test_group()
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        for group_name, group_results in groups.items():
            safe_name = group_name.replace('/', '_').replace('\\', '_')
            file_path = output_path / f'{safe_name}.{format}'
            group_reporter = Reporter(group_results)

            if format == 'json':
                group_reporter.generate_json_report(str(file_path))
            elif format == 'csv':
                group_reporter.generate_csv_report(str(file_path))

    def generate_text_summary(self) -> str:
        stats = self.get_statistics()
        lines = []

        lines.append('=' * 60)
        lines.append('密码策略边界测试报告')
        lines.append('=' * 60)
        lines.append('')

        lines.append(f'总测试数: {stats["total"]}')
        lines.append(f'通过数: {stats["valid"]}')
        lines.append(f'失败数: {stats["invalid"]}')
        lines.append(f'通过率: {stats["valid_rate"]:.2%}')
        lines.append('')

        lines.append('按测试分组统计:')
        lines.append('-' * 40)
        for group_name, group_stat in stats['group_stats'].items():
            lines.append(
                f'  {group_name}: {group_stat["valid"]}/{group_stat["total"]} '
                f'({group_stat["valid_rate"]:.2%})'
            )
        lines.append('')

        if stats['failure_counts']:
            lines.append('失败原因统计:')
            lines.append('-' * 40)
            for rule_id, count in stats['failure_counts'].items():
                lines.append(f'  {rule_id}: {count} 次')
            lines.append('')

        invalid_results = [r for r in self.results if not r.is_valid]
        if invalid_results:
            lines.append('失败详情:')
            lines.append('-' * 40)
            for result in invalid_results:
                lines.append(f'密码: {result.password}')
                lines.append(f'  分组: {result.test_group}')
                lines.append(f'  描述: {result.description}')
                if result.source_file:
                    lines.append(f'  来源: {result.source_file}:{result.line_number}')
                for fr in result.failure_reasons:
                    lines.append(f'  - {fr.message}')
                lines.append('')

        return '\n'.join(lines)

    def print_summary(self) -> None:
        print(self.generate_text_summary())

    def get_exit_code(self) -> int:
        invalid_count = sum(1 for r in self.results if not r.is_valid)
        return 1 if invalid_count > 0 else 0
