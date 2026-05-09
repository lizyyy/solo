import os
import uuid
from datetime import datetime
from typing import List, Dict
import xlsxwriter
from io import BytesIO


class ReportExporter:
    @staticmethod
    def _format_risk_level(level: str) -> str:
        mapping = {
            'high': '高风险',
            'medium': '中风险',
            'low': '低风险',
            'none': '无风险'
        }
        return mapping.get(level, level)
    
    @staticmethod
    def _format_label(label: str) -> str:
        mapping = {
            'duplicate': '重复投递',
            'potential': '疑似重复',
            'not_duplicate': '非重复',
            'confirmed_duplicate': '确认重复',
        }
        return mapping.get(label, label if label else '待复核')
    
    @staticmethod
    def export_risk_report(
        detections: List[Dict],
        export_folder: str,
        batch_id: str = None
    ) -> str:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"risk_report_{timestamp}.xlsx"
        if batch_id:
            filename = f"risk_report_{batch_id}_{timestamp}.xlsx"
        
        file_path = os.path.join(export_folder, filename)
        
        workbook = xlsxwriter.Workbook(file_path)
        
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#4472C4',
            'font_color': 'white',
            'align': 'center',
            'valign': 'vcenter',
            'border': 1
        })
        
        cell_format = workbook.add_format({
            'align': 'center',
            'valign': 'vcenter',
            'border': 1,
            'text_wrap': True
        })
        
        high_risk_format = workbook.add_format({
            'bg_color': '#FFC7CE',
            'font_color': '#9C0006',
            'align': 'center',
            'valign': 'vcenter',
            'border': 1
        })
        
        medium_risk_format = workbook.add_format({
            'bg_color': '#FFEB9C',
            'font_color': '#9C5700',
            'align': 'center',
            'valign': 'vcenter',
            'border': 1
        })
        
        low_risk_format = workbook.add_format({
            'bg_color': '#C6EFCE',
            'font_color': '#006100',
            'align': 'center',
            'valign': 'vcenter',
            'border': 1
        })
        
        main_worksheet = workbook.add_worksheet('风险检测结果')
        
        main_headers = [
            '序号', '风险级别', '风险分数',
            '候选人A-姓名', '候选人A-手机号', '候选人A-邮箱', '候选人A-身份证',
            '候选人B-姓名', '候选人B-手机号', '候选人B-邮箱', '候选人B-身份证',
            '匹配字段', '风险原因',
            '自动标注', '人工标注', '复核人', '复核时间', '回滚状态',
            '版本号', '创建时间'
        ]
        
        for col, header in enumerate(main_headers):
            main_worksheet.write(0, col, header, header_format)
        
        for idx, det in enumerate(detections, 1):
            risk_level = det.get('risk_level', 'none')
            
            if risk_level == 'high':
                format_style = high_risk_format
            elif risk_level == 'medium':
                format_style = medium_risk_format
            elif risk_level == 'low':
                format_style = low_risk_format
            else:
                format_style = cell_format
            
            resume_a = det.get('resume_a', {})
            resume_b = det.get('resume_b', {})
            
            row_data = [
                idx,
                ReportExporter._format_risk_level(risk_level),
                round(det.get('risk_score', 0), 2),
                resume_a.get('name', ''),
                resume_a.get('phone', ''),
                resume_a.get('email', ''),
                resume_a.get('id_number', ''),
                resume_b.get('name', ''),
                resume_b.get('phone', ''),
                resume_b.get('email', ''),
                resume_b.get('id_number', ''),
                ', '.join(det.get('matched_fields', [])),
                det.get('risk_reason', ''),
                ReportExporter._format_label(det.get('auto_label')),
                ReportExporter._format_label(det.get('manual_label')),
                det.get('reviewed_by', ''),
                det.get('reviewed_at', ''),
                '已回滚' if det.get('is_rollback', False) else '正常',
                det.get('version', 1),
                det.get('created_at', '')
            ]
            
            for col, value in enumerate(row_data):
                main_worksheet.write(idx, col, value, format_style)
        
        column_widths = [6, 10, 10, 12, 15, 25, 20, 12, 15, 25, 20, 20, 40, 12, 12, 12, 20, 10, 8, 20]
        for col, width in enumerate(column_widths):
            main_worksheet.set_column(col, col, width)
        
        stats_worksheet = workbook.add_worksheet('统计汇总')
        
        stats_data = []
        
        total = len(detections)
        high_count = sum(1 for d in detections if d.get('risk_level') == 'high')
        medium_count = sum(1 for d in detections if d.get('risk_level') == 'medium')
        low_count = sum(1 for d in detections if d.get('risk_level') == 'low')
        
        reviewed_count = sum(1 for d in detections if d.get('manual_label'))
        duplicate_count = sum(1 for d in detections if d.get('manual_label') in ['duplicate', 'confirmed_duplicate'])
        not_duplicate_count = sum(1 for d in detections if d.get('manual_label') == 'not_duplicate')
        rollback_count = sum(1 for d in detections if d.get('is_rollback', False))
        
        stats_data.extend([
            ['风险检测统计', ''],
            ['总检测数', total],
            ['高风险', high_count],
            ['中风险', medium_count],
            ['低风险', low_count],
            ['', ''],
            ['人工复核统计', ''],
            ['已复核数', reviewed_count],
            ['确认重复数', duplicate_count],
            ['确认非重复数', not_duplicate_count],
            ['待复核数', total - reviewed_count],
            ['', ''],
            ['回滚统计', ''],
            ['已回滚数', rollback_count],
            ['导出时间', datetime.now().strftime('%Y-%m-%d %H:%M:%S')]
        ])
        
        for row, (key, value) in enumerate(stats_data):
            stats_worksheet.write(row, 0, key, header_format if row in [0, 7, 12] else cell_format)
            stats_worksheet.write(row, 1, value, cell_format)
        
        stats_worksheet.set_column(0, 0, 18)
        stats_worksheet.set_column(1, 1, 25)
        
        workbook.close()
        
        return file_path
    
    @staticmethod
    def export_history_report(
        history_records: List[Dict],
        export_folder: str
    ) -> str:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"history_report_{timestamp}.xlsx"
        file_path = os.path.join(export_folder, filename)
        
        workbook = xlsxwriter.Workbook(file_path)
        
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#70AD47',
            'font_color': 'white',
            'align': 'center',
            'valign': 'vcenter',
            'border': 1
        })
        
        cell_format = workbook.add_format({
            'align': 'center',
            'valign': 'vcenter',
            'border': 1,
            'text_wrap': True
        })
        
        worksheet = workbook.add_worksheet('操作历史')
        
        headers = [
            '序号', '检测记录ID', '版本号', '操作类型', '操作人',
            '原风险级别', '新风险级别',
            '原人工标注', '新人工标注',
            '变更原因', '操作时间'
        ]
        
        for col, header in enumerate(headers):
            worksheet.write(0, col, header, header_format)
        
        for idx, rec in enumerate(history_records, 1):
            row_data = [
                idx,
                rec.get('detection_id', ''),
                rec.get('version', ''),
                rec.get('action', ''),
                rec.get('action_by', ''),
                ReportExporter._format_risk_level(rec.get('old_risk_level', '')),
                ReportExporter._format_risk_level(rec.get('new_risk_level', '')),
                ReportExporter._format_label(rec.get('old_manual_label')),
                ReportExporter._format_label(rec.get('new_manual_label')),
                rec.get('change_reason', ''),
                rec.get('created_at', '')
            ]
            
            for col, value in enumerate(row_data):
                worksheet.write(idx, col, value, cell_format)
        
        column_widths = [6, 12, 8, 12, 12, 12, 12, 12, 12, 30, 20]
        for col, width in enumerate(column_widths):
            worksheet.set_column(col, col, width)
        
        workbook.close()
        
        return file_path
