import os
import csv
from datetime import datetime
from typing import List, Dict, Any, Optional
from flask import current_app
from extensions import db
from models import (
    TemperatureRecord, SampleTransfer, AlarmRecord, 
    ReviewNote, RiskAnalysis, TodoItem, ReviewConclusion,
    ImportLog
)
from services.analysis_service import AnalysisService
from config import Config

class ReportService:
    @staticmethod
    def generate_markdown_report(batch_number: Optional[str] = None) -> str:
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        batches = FileService.get_batch_numbers() if not batch_number else [batch_number]
        
        report_lines = []
        
        report_lines.append('# 冷链实验室质检报告')
        report_lines.append(f'**生成时间**: {now}')
        report_lines.append(f'**涉及批次**: {", ".join(batches) if batches else "无"}')
        report_lines.append('')
        report_lines.append('---')
        report_lines.append('')
        
        if not batches:
            report_lines.append('## 数据摘要')
            report_lines.append('')
            report_lines.append('暂无数据，请先导入相关文件。')
            return '\n'.join(report_lines)
        
        all_temp_count = 0
        all_transfer_count = 0
        all_alarm_count = 0
        all_review_count = 0
        all_risk_count = 0
        all_critical_count = 0
        all_high_count = 0
        
        for batch in batches:
            overview = AnalysisService.get_batch_overview(batch)
            all_temp_count += overview['temperature_records']
            all_transfer_count += overview['sample_transfers']
            all_alarm_count += overview['alarm_records']
            all_review_count += overview['review_notes']
            all_risk_count += overview['risk_analysis']['total']
            all_critical_count += overview['risk_analysis']['critical']
            all_high_count += overview['risk_analysis']['high']
        
        report_lines.append('## 1. 数据摘要')
        report_lines.append('')
        report_lines.append('### 1.1 数据统计')
        report_lines.append('')
        report_lines.append('| 数据类型 | 数量 |')
        report_lines.append('|----------|------|')
        report_lines.append(f'| 温控记录 | {all_temp_count} |')
        report_lines.append(f'| 样本交接 | {all_transfer_count} |')
        report_lines.append(f'| 告警记录 | {all_alarm_count} |')
        report_lines.append(f'| 复核备注 | {all_review_count} |')
        report_lines.append('')
        
        report_lines.append('### 1.2 风险统计')
        report_lines.append('')
        report_lines.append('| 风险等级 | 数量 |')
        report_lines.append('|----------|------|')
        report_lines.append(f'| **严重 (Critical)** | {all_critical_count} |')
        report_lines.append(f'| **高 (High)** | {all_high_count} |')
        report_lines.append(f'| 中 (Medium) | {all_risk_count - all_critical_count - all_high_count} |')
        report_lines.append(f'| **总计** | {all_risk_count} |')
        report_lines.append('')
        
        report_lines.append('---')
        report_lines.append('')
        
        for batch in batches:
            report_lines.append(f'## 2. 批次详情: {batch}')
            report_lines.append('')
            
            overview = AnalysisService.get_batch_overview(batch)
            
            report_lines.append('### 2.1 批次数据概览')
            report_lines.append('')
            report_lines.append(f'- 温控记录: {overview["temperature_records"]} 条')
            report_lines.append(f'- 样本交接: {overview["sample_transfers"]} 条')
            report_lines.append(f'- 告警记录: {overview["alarm_records"]} 条')
            report_lines.append(f'- 复核备注: {overview["review_notes"]} 条')
            report_lines.append('')
            
            risks = AnalysisService.get_risk_analysis(batch)
            
            if risks:
                report_lines.append('### 2.2 风险分析详情')
                report_lines.append('')
                
                risk_type_map = {
                    'continuous_overtemperature': '连续超温',
                    'transfer_breakpoint': '交接断点',
                    'duplicate_sample_id': '重复样本ID',
                    'duplicate_in_batch': '批次内重复'
                }
                
                risk_level_map = {
                    'critical': '🔴 严重',
                    'high': '🟠 高',
                    'medium': '🟡 中',
                    'low': '🟢 低'
                }
                
                status_map = {
                    'pending': '待处理',
                    'reviewing': '复核中',
                    'resolved': '已解决',
                    'closed': '已关闭'
                }
                
                for idx, risk in enumerate(risks, 1):
                    risk_type_display = risk_type_map.get(risk['risk_type'], risk['risk_type'])
                    risk_level_display = risk_level_map.get(risk['risk_level'], risk['risk_level'])
                    status_display = status_map.get(risk['status'], risk['status'])
                    
                    report_lines.append(f'#### 2.2.{idx} {risk_type_display} - {risk_level_display}')
                    report_lines.append('')
                    report_lines.append(f'**状态**: {status_display}')
                    report_lines.append('')
                    report_lines.append(f'**描述**: {risk["description"]}')
                    report_lines.append('')
                    
                    if risk.get('location'):
                        report_lines.append(f'**位置**: {risk["location"]}')
                    if risk.get('start_time'):
                        report_lines.append(f'**开始时间**: {risk["start_time"]}')
                    if risk.get('end_time'):
                        report_lines.append(f'**结束时间**: {risk["end_time"]}')
                    if risk.get('duration_minutes'):
                        report_lines.append(f'**持续时间**: {risk["duration_minutes"]} 分钟')
                    if risk.get('temperature') is not None:
                        report_lines.append(f'**温度**: {risk["temperature"]}°C')
                    report_lines.append('')
                    
                    if risk.get('conclusions') and len(risk['conclusions']) > 0:
                        report_lines.append('**复核结论**:')
                        report_lines.append('')
                        for c_idx, conclusion in enumerate(risk['conclusions'], 1):
                            report_lines.append(f'1. **复核人**: {conclusion["reviewer"] or "未填写"}')
                            report_lines.append(f'   - **结论类型**: {conclusion["conclusion_type"] or "未填写"}')
                            report_lines.append(f'   - **根本原因**: {conclusion["root_cause"] or "未填写"}')
                            report_lines.append(f'   - **纠正措施**: {conclusion["corrective_action"] or "未填写"}')
                            report_lines.append(f'   - **预防措施**: {conclusion["preventive_action"] or "未填写"}')
                            report_lines.append(f'   - **责任部门**: {conclusion["responsibility"] or "未填写"}')
                            report_lines.append(f'   - **状态**: {conclusion["status"] or "待处理"}')
                            if conclusion.get('comments'):
                                report_lines.append(f'   - **备注**: {conclusion["comments"]}')
                            report_lines.append('')
                    
                    if risk.get('todos') and len(risk['todos']) > 0:
                        report_lines.append('**整改待办**:')
                        report_lines.append('')
                        report_lines.append('| 序号 | 标题 | 负责人 | 截止日期 | 优先级 | 状态 |')
                        report_lines.append('|------|------|--------|----------|--------|------|')
                        for t_idx, todo in enumerate(risk['todos'], 1):
                            due_date = todo.get('due_date', '') or '-'
                            priority_map = {'critical': '严重', 'high': '高', 'medium': '中', 'low': '低'}
                            priority = priority_map.get(todo.get('priority', 'medium'), '中')
                            status_todo_map = {'pending': '待处理', 'in_progress': '进行中', 'completed': '已完成'}
                            status_todo = status_todo_map.get(todo.get('status', 'pending'), '待处理')
                            report_lines.append(f'| {t_idx} | {todo["title"]} | {todo["assignee"] or "-"} | {due_date} | {priority} | {status_todo} |')
                        report_lines.append('')
                    
                    report_lines.append('---')
                    report_lines.append('')
            
            else:
                report_lines.append('### 2.2 风险分析')
                report_lines.append('')
                report_lines.append('未检测到风险。')
                report_lines.append('')
        
        report_lines.append('## 3. 附录')
        report_lines.append('')
        report_lines.append('### 3.1 检测阈值配置')
        report_lines.append('')
        report_lines.append(f'- **温度下限阈值**: {Config.TEMPERATURE_LOWER_THRESHOLD}°C')
        report_lines.append(f'- **温度上限阈值**: {Config.TEMPERATURE_UPPER_THRESHOLD}°C')
        report_lines.append(f'- **超温持续时间阈值**: {Config.OVERTEMP_DURATION_THRESHOLD} 分钟')
        report_lines.append('')
        
        report_lines.append('### 3.2 风险等级定义')
        report_lines.append('')
        report_lines.append('- **严重 (Critical)**: 超温超过30分钟或温度高于-10°C；交接断点超过2小时；样本ID出现在3个以上批次')
        report_lines.append('- **高 (High)**: 超温超过15分钟或温度高于-12°C；交接断点超过1小时；样本ID出现在2个以上批次')
        report_lines.append('- **中 (Medium)**: 超温超过5分钟；交接断点少于1小时；批次内样本ID重复')
        report_lines.append('- **低 (Low)**: 其他轻微异常')
        report_lines.append('')
        
        return '\n'.join(report_lines)
    
    @staticmethod
    def generate_csv_issues(batch_number: Optional[str] = None) -> str:
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            '风险ID', '批次号', '风险类型', '风险等级', '状态', 
            '描述', '位置', '开始时间', '结束时间', '持续时间(分钟)',
            '温度(°C)', '样本ID/探头ID', '创建时间', '更新时间'
        ])
        
        risks = AnalysisService.get_risk_analysis(batch_number)
        
        risk_type_map = {
            'continuous_overtemperature': '连续超温',
            'transfer_breakpoint': '交接断点',
            'duplicate_sample_id': '重复样本ID',
            'duplicate_in_batch': '批次内重复'
        }
        
        risk_level_map = {
            'critical': '严重',
            'high': '高',
            'medium': '中',
            'low': '低'
        }
        
        status_map = {
            'pending': '待处理',
            'reviewing': '复核中',
            'resolved': '已解决',
            'closed': '已关闭'
        }
        
        for risk in risks:
            writer.writerow([
                risk.get('id', ''),
                risk.get('batch_number', ''),
                risk_type_map.get(risk.get('risk_type', ''), risk.get('risk_type', '')),
                risk_level_map.get(risk.get('risk_level', ''), risk.get('risk_level', '')),
                status_map.get(risk.get('status', ''), risk.get('status', '')),
                risk.get('description', ''),
                risk.get('location', ''),
                risk.get('start_time', '') or '',
                risk.get('end_time', '') or '',
                risk.get('duration_minutes', '') or '',
                risk.get('temperature', '') if risk.get('temperature') is not None else '',
                risk.get('sample_ids', ''),
                risk.get('created_at', '') or '',
                risk.get('updated_at', '') or ''
            ])
        
        return output.getvalue()
    
    @staticmethod
    def save_report_to_file(report_content: str, file_type: str = 'markdown') -> str:
        export_dir = current_app.config['EXPORT_FOLDER']
        os.makedirs(export_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        if file_type == 'markdown':
            filename = f'质检报告_{timestamp}.md'
        elif file_type == 'csv':
            filename = f'问题清单_{timestamp}.csv'
        else:
            filename = f'报告_{timestamp}.txt'
        
        filepath = os.path.join(export_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        return filepath

from services.file_service import FileService
