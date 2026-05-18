import csv
import json
import os
from datetime import datetime
from typing import List, Dict, Any
from parser import DataRow
from validator import ValidationIssue, ValidationRule
from calculator import PointsCalculation
from tracker import SourceTracker


class ReportGenerator:
    def __init__(self, output_dir: str = 'reports'):
        self.output_dir = output_dir
        self._ensure_output_dir()

    def _ensure_output_dir(self) -> None:
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def generate_all_reports(
        self,
        invalid_rows: List[DataRow],
        issues: List[ValidationIssue],
        calculations: List[PointsCalculation],
        summary: Dict[str, Any],
        tracker: SourceTracker
    ) -> Dict[str, str]:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        reports = {}
        
        reports['issues'] = self.generate_issues_report(issues, timestamp)
        reports['calculations'] = self.generate_calculations_report(calculations, timestamp)
        reports['summary'] = self.generate_summary_report(summary, timestamp)
        reports['invalid_rows'] = self.generate_invalid_rows_report(invalid_rows, timestamp)
        reports['full'] = self.generate_full_report(invalid_rows, issues, calculations, summary, tracker, timestamp)
        
        return reports

    def generate_issues_report(self, issues: List[ValidationIssue], timestamp: str) -> str:
        file_path = os.path.join(self.output_dir, f'issues_report_{timestamp}.csv')
        
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                '规则类型', '严重程度', '问题描述', '关联租借单', 
                '关联渔具', '缺少物品', '来源文件', '来源行号'
            ])
            
            for issue in issues:
                source_files = '; '.join(sorted(set(r.file_path for r in issue.source_rows)))
                source_lines = '; '.join(str(r.line_number) for r in issue.source_rows)
                
                writer.writerow([
                    issue.rule.value,
                    issue.severity,
                    issue.message,
                    issue.related_ids.get('rental_id', ''),
                    issue.related_ids.get('equipment_id', ''),
                    ', '.join(issue.missing_items),
                    source_files,
                    source_lines
                ])
        
        return file_path

    def generate_calculations_report(self, calculations: List[PointsCalculation], timestamp: str) -> str:
        file_path = os.path.join(self.output_dir, f'calculations_report_{timestamp}.csv')
        
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                '租借单号', '会员ID', '会员姓名', '原始积分', 
                '扣减金额', '应补偿积分', '最终积分', '扣减明细'
            ])
            
            for calc in calculations:
                details = '; '.join(
                    f"{d.equipment_name}-{d.item_type}({d.unit_price}元)"
                    for d in calc.deduction_details
                )
                
                writer.writerow([
                    calc.rental_id,
                    calc.member_id,
                    calc.member_name,
                    calc.base_points,
                    calc.deduction_amount,
                    calc.points_compensation,
                    calc.final_points,
                    details
                ])
        
        return file_path

    def generate_summary_report(self, summary: Dict[str, Any], timestamp: str) -> str:
        file_path = os.path.join(self.output_dir, f'summary_report_{timestamp}.json')
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        
        return file_path

    def generate_invalid_rows_report(self, invalid_rows: List[DataRow], timestamp: str) -> str:
        file_path = os.path.join(self.output_dir, f'invalid_rows_report_{timestamp}.csv')
        
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(['文件路径', '行号', '数据类型', '错误信息', '原始数据'])
            
            for row in sorted(invalid_rows, key=lambda r: (r.file_path, r.line_number)):
                writer.writerow([
                    row.file_path,
                    row.line_number,
                    row.source_type.value,
                    row.error_message or '',
                    str(row.raw_data)
                ])
        
        return file_path

    def generate_full_report(
        self,
        invalid_rows: List[DataRow],
        issues: List[ValidationIssue],
        calculations: List[PointsCalculation],
        summary: Dict[str, Any],
        tracker: SourceTracker,
        timestamp: str
    ) -> str:
        file_path = os.path.join(self.output_dir, f'full_report_{timestamp}.txt')
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write("渔具归还押金扣减积分补偿排查完整报告\n")
            f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 80 + "\n\n")
            
            f.write("一、汇总统计\n")
            f.write("-" * 80 + "\n")
            f.write(f"租借单总数: {summary['total_rentals']}\n")
            f.write(f"有扣减的租借单: {summary['rentals_with_deduction']}\n")
            f.write(f"总扣减金额: {summary['total_deduction_amount']} 元\n")
            f.write(f"总补偿积分: {summary['total_points_compensation']}\n")
            f.write(f"单均补偿积分: {summary['average_points_per_rental']}\n")
            f.write(f"数据问题行数: {len(invalid_rows)}\n")
            f.write(f"验证问题数: {len(issues)}\n\n")
            
            f.write("二、验证问题详情\n")
            f.write("-" * 80 + "\n")
            issues_by_severity: Dict[str, List[ValidationIssue]] = {'high': [], 'medium': [], 'low': []}
            for issue in issues:
                issues_by_severity[issue.severity].append(issue)
            
            for severity in ['high', 'medium', 'low']:
                sev_issues = issues_by_severity[severity]
                if sev_issues:
                    sev_label = '严重' if severity == 'high' else '中等' if severity == 'medium' else '轻微'
                    f.write(f"\n【{sev_label}问题 ({len(sev_issues)}个)】\n")
                    for i, issue in enumerate(sev_issues, 1):
                        f.write(f"  {i}. {issue.message}\n")
                        for source in issue.source_rows:
                            f.write(f"     来源: {os.path.basename(source.file_path)} 第{source.line_number}行\n")
            
            f.write("\n\n三、押金与积分计算\n")
            f.write("-" * 80 + "\n")
            for calc in calculations:
                if calc.deduction_amount > 0:
                    f.write(f"\n租借单 {calc.rental_id}:\n")
                    f.write(f"  会员: {calc.member_name} ({calc.member_id})\n")
                    f.write(f"  扣减金额: {calc.deduction_amount:.2f} 元\n")
                    f.write(f"  补偿积分: +{calc.points_compensation}\n")
                    f.write(f"  积分变化: {calc.base_points} -> {calc.final_points}\n")
                    if calc.deduction_details:
                        f.write(f"  扣减明细:\n")
                        for detail in calc.deduction_details:
                            f.write(f"    - {detail.equipment_name} {detail.item_type}: {detail.unit_price}元\n")
            
            f.write("\n\n四、坏行来源追踪\n")
            f.write("-" * 80 + "\n")
            if invalid_rows:
                grouped: Dict[str, List[DataRow]] = {}
                for row in sorted(invalid_rows, key=lambda r: (r.file_path, r.line_number)):
                    if row.file_path not in grouped:
                        grouped[row.file_path] = []
                    grouped[row.file_path].append(row)
                
                for file_path in sorted(grouped.keys()):
                    f.write(f"\n文件: {os.path.basename(file_path)}\n")
                    for row in grouped[file_path]:
                        f.write(f"  第{row.line_number}行: {row.error_message}\n")
            else:
                f.write("没有发现坏行。\n")
            
            f.write("\n" + "=" * 80 + "\n")
            f.write("报告结束\n")
            f.write("=" * 80 + "\n")
        
        return file_path

    def print_console_summary(
        self,
        invalid_rows: List[DataRow],
        issues: List[ValidationIssue],
        calculations: List[PointsCalculation],
        summary: Dict[str, Any]
    ) -> None:
        print("\n" + "=" * 80)
        print("渔具归还押金扣减积分补偿排查 - 控制台摘要")
        print("=" * 80)
        
        print(f"\n📊 汇总统计:")
        print(f"  租借单总数: {summary['total_rentals']}")
        print(f"  有扣减的租借单: {summary['rentals_with_deduction']}")
        print(f"  总扣减金额: {summary['total_deduction_amount']} 元")
        print(f"  总补偿积分: {summary['total_points_compensation']}")
        
        high_count = sum(1 for i in issues if i.severity == 'high')
        medium_count = sum(1 for i in issues if i.severity == 'medium')
        
        print(f"\n⚠️  验证问题:")
        print(f"  严重问题: {high_count} 个")
        print(f"  中等问题: {medium_count} 个")
        print(f"  坏行记录: {len(invalid_rows)} 行")
        
        if high_count > 0:
            print(f"\n🔴 严重问题列表:")
            for i, issue in enumerate([i for i in issues if i.severity == 'high'][:5], 1):
                print(f"  {i}. {issue.message}")
            if high_count > 5:
                print(f"  ... 还有 {high_count - 5} 个严重问题")
        
        print(f"\n📁 报告已生成到: {self.output_dir}/")
        print("=" * 80 + "\n")
