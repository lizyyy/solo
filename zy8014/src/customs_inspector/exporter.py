import csv
import os
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional

from .models import (
    InspectionResult, CorrectionTask, ValidationError,
    RiskLevel, ValidationErrorType, ContainerReconciliation
)


class Exporter:
    
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def export_all(self, result: InspectionResult) -> Dict[str, str]:
        exported_files: Dict[str, str] = {}
        
        tasks_path = self.export_correction_tasks(result.correction_tasks)
        exported_files['correction_tasks'] = tasks_path
        
        report_path = self.export_markdown_report(result)
        exported_files['markdown_report'] = report_path
        
        summary_path = self.export_risk_summary(result)
        exported_files['risk_summary'] = summary_path
        
        return exported_files
    
    def export_correction_tasks(self, tasks: List[CorrectionTask]) -> str:
        filepath = os.path.join(self.output_dir, 'correction_tasks.csv')
        
        sorted_tasks = sorted(tasks, key=lambda t: (t.priority, t.risk_level))
        
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '任务ID', '优先级', '风险等级', '任务类型',
                '提单号', '箱号', '描述', '所需证件', '状态'
            ])
            
            for task in sorted_tasks:
                writer.writerow([
                    task.task_id,
                    self._priority_to_str(task.priority),
                    task.risk_level,
                    task.task_type,
                    task.ticket_no,
                    task.container_no or '',
                    task.description,
                    '; '.join(task.required_documents),
                    task.status
                ])
        
        return filepath
    
    def export_risk_summary(self, result: InspectionResult) -> str:
        filepath = os.path.join(self.output_dir, 'risk_summary.csv')
        
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow(['=== 整体风险评估 ==='])
            writer.writerow(['整体风险等级', result.overall_risk_level])
            writer.writerow(['检验时间', result.inspection_time.strftime('%Y-%m-%d %H:%M:%S')])
            writer.writerow([])
            
            writer.writerow(['=== 风险分布统计 ==='])
            writer.writerow(['风险等级', '数量'])
            for level in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]:
                count = result.risk_summary.get(level, 0)
                writer.writerow([level.value, count])
            writer.writerow([])
            
            writer.writerow(['=== 错误类型统计 ==='])
            error_type_counts: Dict[ValidationErrorType, int] = defaultdict(int)
            for error in result.validation_errors:
                error_type_counts[error.error_type] += 1
            
            writer.writerow(['错误类型', '数量', '说明'])
            for error_type, count in sorted(error_type_counts.items(), key=lambda x: -x[1]):
                writer.writerow([error_type.value, count, self._error_type_desc(error_type)])
            writer.writerow([])
            
            if result.container_reconciliations:
                writer.writerow(['=== 集装箱核对摘要 ==='])
                writer.writerow(['箱号', '涉及提单数', '是否多票合箱', '重量差异(KG)', '体积差异(CBM)', '问题数量'])
                for rec in result.container_reconciliations:
                    writer.writerow([
                        rec.container_no,
                        len(rec.ticket_numbers),
                        '是' if rec.is_multi_ticket else '否',
                        f"{rec.weight_discrepancy:+.2f}",
                        f"{rec.volume_discrepancy:+.4f}",
                        len(rec.issues)
                    ])
        
        return filepath
    
    def export_markdown_report(self, result: InspectionResult) -> str:
        filepath = os.path.join(self.output_dir, 'inspection_report.md')
        
        lines = []
        
        lines.append('# 跨境报关资料预检报告')
        lines.append('')
        lines.append(f'**检验时间**: {result.inspection_time.strftime("%Y-%m-%d %H:%M:%S")}')
        lines.append(f'**整体风险等级**: <span style="color: {self._risk_color(result.overall_risk_level)}">**{result.overall_risk_level.value}**</span>')
        lines.append('')
        
        lines.append('## 风险分布统计')
        lines.append('')
        lines.append('| 风险等级 | 数量 | 说明 |')
        lines.append('|---------|------|------|')
        for level in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]:
            count = result.risk_summary.get(level, 0)
            lines.append(f'| <span style="color: {self._risk_color(level)}">{level.value}</span> | {count} | {self._risk_desc(level)} |')
        lines.append('')
        
        lines.append('## 问题详情')
        lines.append('')
        
        errors_by_risk: Dict[RiskLevel, List[ValidationError]] = defaultdict(list)
        for error in result.validation_errors:
            errors_by_risk[error.risk_level].append(error)
        
        for level in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]:
            errors = errors_by_risk.get(level, [])
            if errors:
                lines.append(f'### <span style="color: {self._risk_color(level)}">{level.value} 级问题</span>')
                lines.append('')
                lines.append(f'共 **{len(errors)}** 个问题')
                lines.append('')
                lines.append('| 序号 | 错误类型 | 提单号 | 箱号 | 描述 |')
                lines.append('|-----|---------|--------|------|------|')
                for i, error in enumerate(errors, 1):
                    lines.append(f'| {i} | {error.error_type.value} | {error.ticket_no or "-"} | {error.container_no or "-"} | {error.message} |')
                lines.append('')
        
        lines.append('## 集装箱核对情况')
        lines.append('')
        
        if result.container_reconciliations:
            lines.append('| 箱号 | 涉及提单数 | 多票合箱 | 重量差异 | 体积差异 | 问题数 |')
            lines.append('|------|-----------|---------|---------|---------|--------|')
            for rec in result.container_reconciliations:
                multi_ticket = '是 ⚠️' if rec.is_multi_ticket else '否'
                weight_color = 'color: red' if abs(rec.weight_discrepancy) > 100 else ''
                volume_color = 'color: red' if abs(rec.volume_discrepancy) > 1 else ''
                lines.append(
                    f'| {rec.container_no} | {len(rec.ticket_numbers)} | {multi_ticket} | '
                    f'<span style="{weight_color}">{rec.weight_discrepancy:+.2f} KG</span> | '
                    f'<span style="{volume_color}">{rec.volume_discrepancy:+.4f} CBM</span> | '
                    f'{len(rec.issues)} |'
                )
            lines.append('')
        else:
            lines.append('*无集装箱核对数据*')
            lines.append('')
        
        lines.append('## 补证任务清单')
        lines.append('')
        
        if result.correction_tasks:
            lines.append('| 任务ID | 优先级 | 风险等级 | 任务类型 | 提单号 | 箱号 | 描述 | 所需证件 |')
            lines.append('|--------|--------|---------|---------|--------|------|------|---------|')
            for task in result.correction_tasks:
                priority_str = self._priority_to_str(task.priority)
                docs = '; '.join(task.required_documents) if task.required_documents else '-'
                lines.append(
                    f'| {task.task_id} | {priority_str} | '
                    f'<span style="color: {self._risk_color(task.risk_level)}">{task.risk_level.value}</span> | '
                    f'{task.task_type} | {task.ticket_no} | {task.container_no or "-"} | '
                    f'{task.description} | {docs} |'
                )
        else:
            lines.append('*无补证任务*')
        lines.append('')
        
        lines.append('## 统计摘要')
        lines.append('')
        lines.append('- 总检验项数: ' + (str(len(result.manifest.items)) if result.manifest else '0'))
        lines.append('- 涉及装箱单数: ' + str(len(result.packing_lists)))
        lines.append('- 应用规则数: ' + str(len(result.rules)))
        lines.append('- 发现问题数: ' + str(len(result.validation_errors)))
        lines.append('- 生成任务数: ' + str(len(result.correction_tasks)))
        lines.append('')
        
        lines.append('---')
        lines.append('')
        lines.append(f'*报告生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}*')
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return filepath
    
    def _risk_color(self, level: RiskLevel) -> str:
        color_map = {
            RiskLevel.CRITICAL: '#dc2626',
            RiskLevel.HIGH: '#ea580c',
            RiskLevel.MEDIUM: '#ca8a04',
            RiskLevel.LOW: '#16a34a',
        }
        return color_map.get(level, '#6b7280')
    
    def _risk_desc(self, level: RiskLevel) -> str:
        desc_map = {
            RiskLevel.CRITICAL: '极其严重，必须立即处理',
            RiskLevel.HIGH: '严重，需要优先处理',
            RiskLevel.MEDIUM: '中等，应尽快处理',
            RiskLevel.LOW: '轻微，建议检查',
        }
        return desc_map.get(level, '')
    
    def _priority_to_str(self, priority: int) -> str:
        priority_map = {
            1: '最高 P1',
            2: '高 P2',
            3: '中 P3',
            4: '低 P4',
        }
        return priority_map.get(priority, f'P{priority}')
    
    def _error_type_desc(self, error_type: ValidationErrorType) -> str:
        desc_map = {
            ValidationErrorType.MISSING_HS_CODE: 'HS编码缺失',
            ValidationErrorType.INVALID_HS_CODE: 'HS编码格式无效',
            ValidationErrorType.MISSING_WEIGHT: '重量数据缺失',
            ValidationErrorType.MISSING_VOLUME: '体积数据缺失',
            ValidationErrorType.WEIGHT_VOLUME_MISMATCH: '重量/体积不一致',
            ValidationErrorType.MISSING_CONTAINER_NO: '箱号缺失或无效',
            ValidationErrorType.DUPLICATE_CONTAINER: '重复箱号或提单',
            ValidationErrorType.MULTI_TICKET_CONTAINER: '多票合箱',
            ValidationErrorType.PROHIBITED_ITEM: '禁运商品',
            ValidationErrorType.RESTRICTED_ITEM: '限制商品',
            ValidationErrorType.DUPLICATE_DECLARATION: '重复申报',
            ValidationErrorType.CANCELLED_DECLARATION: '撤单报文',
            ValidationErrorType.MISSING_CERTIFICATE: '缺少必要证件',
            ValidationErrorType.INVALID_NAME: '品名描述无效',
        }
        return desc_map.get(error_type, error_type.value)
