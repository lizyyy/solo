import csv
import json
from datetime import datetime
from typing import List, Dict
from models import MatrixRow, ValidationIssue, ValidationResult


class ReportExporter:
    def __init__(self):
        pass

    def export_matrix_csv(self, matrix: List[MatrixRow], filepath: str,
                          filters: Dict = None) -> str:
        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)

            writer.writerow(['音乐版权分成矩阵导出报告'])
            writer.writerow([f'导出时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}'])
            if filters:
                filter_str = ', '.join([f"{k}={v}" for k, v in filters.items() if v])
                writer.writerow([f'筛选条件: {filter_str if filter_str else "无"}'])
            writer.writerow([])

            headers = [
                '曲目名称', '曲目ID', '权利类型', '权利人', '平台',
                '原始比例', '归一化比例', '合同版本', '来源参考'
            ]
            writer.writerow(headers)

            for row in matrix:
                writer.writerow([
                    row.track_title,
                    row.track_id,
                    row.right_type,
                    row.rights_holder,
                    row.platform,
                    f"{row.split_ratio:.2%}",
                    f"{row.normalized_ratio:.2%}" if row.normalized_ratio else '-',
                    row.contract_version,
                    row.source_ref
                ])

        return filepath

    def export_issues_csv(self, issues: List[ValidationIssue], filepath: str,
                          filters: Dict = None) -> str:
        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)

            writer.writerow(['校验问题导出报告'])
            writer.writerow([f'导出时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}'])
            if filters:
                filter_str = ', '.join([f"{k}={v}" for k, v in filters.items() if v])
                writer.writerow([f'筛选条件: {filter_str if filter_str else "无"}'])
            writer.writerow([])

            headers = ['级别', '类别', '问题描述', '判断依据', '曲目ID', '合同ID']
            writer.writerow(headers)

            for issue in issues:
                evidence_str = '; '.join([
                    f"{k}:{v}" for ev in issue.evidence for k, v in ev.items()
                ])
                writer.writerow([
                    issue.level,
                    issue.category,
                    issue.message,
                    evidence_str,
                    issue.track_id or '-',
                    issue.contract_id or '-'
                ])

        return filepath

    def export_full_report(self, result: ValidationResult, filepath: str,
                          filters: Dict = None) -> str:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write("音乐版权分成矩阵 - 完整校验报告\n")
            f.write("=" * 80 + "\n\n")
            f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

            if filters:
                filter_str = ', '.join([f"{k}={v}" for k, v in filters.items() if v])
                f.write(f"筛选条件: {filter_str if filter_str else '无'}\n")

            f.write("\n" + "-" * 80 + "\n")
            f.write("一、数据概览\n")
            f.write("-" * 80 + "\n")
            for key, value in result.summary.items():
                f.write(f"  {key}: {value}\n")

            f.write("\n" + "-" * 80 + "\n")
            f.write(f"二、校验结果 {'✓ 通过' if result.is_valid else '✗ 存在错误'}\n")
            f.write("-" * 80 + "\n")

            if not result.issues:
                f.write("  未发现任何问题\n")
            else:
                for idx, issue in enumerate(result.issues, 1):
                    f.write(f"\n  {idx}. [{issue.level.upper()}] {issue.category}\n")
                    f.write(f"     {issue.message}\n")
                    f.write(f"     判断依据:\n")
                    for ev in issue.evidence:
                        ev_str = ', '.join([f"{k}: {v}" for k, v in ev.items()])
                        f.write(f"       - {ev_str}\n")

            f.write("\n" + "-" * 80 + "\n")
            f.write("三、分成矩阵明细\n")
            f.write("-" * 80 + "\n")

            for idx, row in enumerate(result.matrix, 1):
                normalized = f"{row.normalized_ratio:.2%}" if row.normalized_ratio else "-"
                f.write(f"\n  {idx}. {row.track_title} ({row.track_id})\n")
                f.write(f"     权利类型: {row.right_type} | 平台: {row.platform}\n")
                f.write(f"     权利人: {row.rights_holder}\n")
                f.write(f"     原始比例: {row.split_ratio:.2%} | 归一化比例: {normalized}\n")
                f.write(f"     合同版本: {row.contract_version} | 来源: {row.source_ref}\n")

            f.write("\n" + "=" * 80 + "\n")
            f.write("报告结束\n")
            f.write("=" * 80 + "\n")

        return filepath

    def export_json(self, result: ValidationResult, filepath: str,
                   filters: Dict = None) -> str:
        data = {
            'export_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'filters': filters or {},
            'summary': result.summary,
            'is_valid': result.is_valid,
            'issues': [
                {
                    'level': i.level,
                    'category': i.category,
                    'message': i.message,
                    'evidence': i.evidence,
                    'track_id': i.track_id,
                    'contract_id': i.contract_id
                }
                for i in result.issues
            ],
            'matrix': [
                {
                    'track_title': r.track_title,
                    'track_id': r.track_id,
                    'right_type': r.right_type,
                    'rights_holder': r.rights_holder,
                    'platform': r.platform,
                    'split_ratio': r.split_ratio,
                    'normalized_ratio': r.normalized_ratio,
                    'contract_version': r.contract_version,
                    'source_ref': r.source_ref
                }
                for r in result.matrix
            ]
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return filepath
