import os
import pandas as pd
from datetime import datetime
from .config import Config

class Exporter:
    def __init__(self):
        Config.ensure_dirs()
        self.export_time = None
    
    def export_all(self, reviewed_data, merge_report=None, review_summary=None, filename_prefix="农贸市场摊位轮换"):
        self.export_time = datetime.now()
        timestamp = Config.get_timestamp()
        
        result = {
            'files': [],
            'summary': self._generate_export_summary(reviewed_data, merge_report, review_summary)
        }
        
        main_filename = f"{filename_prefix}_汇总清单_{timestamp}.xlsx"
        main_filepath = os.path.join(Config.OUTPUT_DIR, main_filename)
        self._export_main_file(reviewed_data, main_filepath)
        result['files'].append({'name': main_filename, 'path': main_filepath, 'type': '汇总清单'})
        
        status_categories = {
            'processed': '已处理',
            'pending': '待核实',
            'onsite': '需要现场复看'
        }
        
        for status_key, status_name in status_categories.items():
            status_data = reviewed_data[reviewed_data['_status'] == status_key]
            if not status_data.empty:
                filename = f"{filename_prefix}_{status_name}_{timestamp}.xlsx"
                filepath = os.path.join(Config.OUTPUT_DIR, filename)
                self._export_by_status(status_data, filepath, status_name)
                result['files'].append({'name': filename, 'path': filepath, 'type': status_name})
        
        exceptions_filename = f"{filename_prefix}_异常情况说明_{timestamp}.txt"
        exceptions_filepath = os.path.join(Config.OUTPUT_DIR, exceptions_filename)
        self._export_exceptions_report(exceptions_filepath, merge_report, review_summary)
        result['files'].append({'name': exceptions_filename, 'path': exceptions_filepath, 'type': '异常情况说明'})
        
        if review_summary and '复核日志数' in review_summary and review_summary['复核日志数'] > 0:
            diff_filename = f"{filename_prefix}_复核差异记录_{timestamp}.xlsx"
            diff_filepath = os.path.join(Config.OUTPUT_DIR, diff_filename)
            self._export_review_diffs(reviewed_data, diff_filepath)
            result['files'].append({'name': diff_filename, 'path': diff_filepath, 'type': '复核差异记录'})
        
        return result
    
    def _export_main_file(self, data, filepath):
        display_columns = self._get_display_columns()
        export_data = self._prepare_export_data(data)
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            export_data.to_excel(writer, sheet_name='摊位清单', index=False)
            self._format_worksheet(writer.sheets['摊位清单'])
    
    def _export_by_status(self, data, filepath, status_name):
        export_data = self._prepare_export_data(data)
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            export_data.to_excel(writer, sheet_name=status_name, index=False)
            self._format_worksheet(writer.sheets[status_name])
    
    def _export_review_diffs(self, data, filepath):
        diff_data = data[data['_original_status'] != data['_status']].copy()
        
        if diff_data.empty:
            return
        
        diff_data = diff_data[[
            'stall_id', 'owner_name', 'intersection', '_original_status', '_status',
            '_status_text', '_reviewer', '_review_time', '_review_notes',
            '_source_name', '_import_time', '_record_id'
        ]].copy()
        
        diff_data.columns = [
            '摊位编号', '摊主姓名', '路口', '原始状态', '当前状态代码',
            '当前状态', '复核人', '复核时间', '复核备注',
            '数据来源', '导入时间', '记录ID'
        ]
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            diff_data.to_excel(writer, sheet_name='复核差异', index=False)
    
    def _export_exceptions_report(self, filepath, merge_report, review_summary):
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("农贸市场摊位轮换 - 异常情况说明报告\n")
            f.write(f"生成时间: {self.export_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 60 + "\n\n")
            
            if merge_report and 'exceptions' in merge_report:
                f.write("一、数据归并阶段发现的异常\n")
                f.write("-" * 60 + "\n")
                
                exceptions = merge_report['exceptions']
                if exceptions:
                    for i, exc in enumerate(exceptions, 1):
                        f.write(f"{i}. 【{self._translate_exception_type(exc.get('type', ''))}】")
                        f.write(f" (严重程度: {self._translate_severity(exc.get('severity', ''))})\n")
                        f.write(f"   {exc.get('message', '')}\n\n")
                else:
                    f.write("   未发现数据异常\n\n")
                
                f.write("二、数据归并操作日志\n")
                f.write("-" * 60 + "\n")
                merge_logs = merge_report.get('merge_log', [])
                if merge_logs:
                    for i, log in enumerate(merge_logs, 1):
                        f.write(f"{i}. 【{self._translate_merge_type(log.get('type', ''))}】\n")
                        f.write(f"   {log.get('message', '')}\n\n")
                else:
                    f.write("   无归并操作\n\n")
            
            if review_summary:
                f.write("三、人工复核情况摘要\n")
                f.write("-" * 60 + "\n")
                for key, value in review_summary.items():
                    if key != '当前状态分布':
                        f.write(f"{key}: {value}\n")
                f.write(f"状态分布: {review_summary.get('当前状态分布', {})}\n\n")
            
            f.write("=" * 60 + "\n")
            f.write("报告结束\n")
            f.write("=" * 60 + "\n")
    
    def _generate_export_summary(self, reviewed_data, merge_report, review_summary):
        total = len(reviewed_data)
        by_status = reviewed_data['_status_text'].value_counts().to_dict()
        
        summary = {
            'export_time': self.export_time.strftime('%Y-%m-%d %H:%M:%S'),
            'total_records': total,
            'status_distribution': by_status,
            'merge_exceptions': len(merge_report.get('exceptions', [])) if merge_report else 0,
            'review_changes': review_summary.get('状态变更数', 0) if review_summary else 0
        }
        return summary
    
    def _prepare_export_data(self, data):
        export_data = data.copy()
        
        column_mapping = {
            'stall_id': '摊位编号',
            'owner_name': '摊主姓名',
            'category': '经营品类',
            'intersection': '路口',
            'location': '位置',
            'longitude': '经度',
            'latitude': '纬度',
            'stall_type': '摊位类型',
            'start_time': '开始时间',
            'end_time': '结束时间',
            'complaint_count': '投诉次数',
            'remarks': '原始备注',
            '_status_text': '当前状态',
            '_review_notes': '复核备注',
            '_reviewer': '复核人',
            '_review_time': '复核时间',
            '_time_note': '时间说明',
            '_capacity_note': '容量说明',
            '_merge_note': '归并说明',
            '_coordinate_note': '坐标说明',
            '_source_name': '数据来源',
            '_import_time': '导入时间',
            '_record_id': '记录ID'
        }
        
        existing_columns = [col for col in column_mapping.keys() if col in export_data.columns]
        export_data = export_data[existing_columns].copy()
        export_data.columns = [column_mapping[col] for col in existing_columns]
        
        return export_data
    
    def _get_display_columns(self):
        return [
            'stall_id', 'owner_name', 'category', 'intersection',
            'start_time', 'end_time', 'complaint_count', '_status_text',
            '_review_notes', '_source_name', '_import_time'
        ]
    
    def _format_worksheet(self, worksheet):
        for column in worksheet.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column_letter].width = adjusted_width
    
    def _translate_exception_type(self, t):
        types = {
            'time_slot_conflict': '时间段设置错误',
            'time_overlap': '经营时间重叠',
            'capacity_exceeded': '路口容量超限',
            'duplicate_complaint': '重复投诉记录'
        }
        return types.get(t, t)
    
    def _translate_merge_type(self, t):
        types = {
            'duplicate_complaint': '重复投诉合并',
            'same_intersection': '同名路口归集',
            'coordinate_offset': '坐标偏移修正'
        }
        return types.get(t, t)
    
    def _translate_severity(self, s):
        levels = {'high': '高', 'medium': '中', 'low': '低'}
        return levels.get(s, s)
