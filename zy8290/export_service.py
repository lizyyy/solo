import os
from datetime import datetime
from typing import Dict, Any, Optional
import csv
import json
from database import BatchManager, FailedRowManager, LogManager


class ExportService:
    @staticmethod
    def export_error_report(batch_id: int, output_path: str, format: str = 'csv') -> str:
        batch = BatchManager.get_batch_by_id(batch_id)
        if not batch:
            raise ValueError(f'批次不存在: {batch_id}')

        failed_rows = FailedRowManager.get_failed_rows(batch_id)

        if not failed_rows:
            raise ValueError(f'批次 {batch_id} 没有失败行')

        if format == 'csv':
            return ExportService._export_error_report_csv(failed_rows, batch, output_path)
        elif format == 'json':
            return ExportService._export_error_report_json(failed_rows, batch, output_path)
        else:
            raise ValueError(f'不支持的导出格式: {format}')

    @staticmethod
    def _export_error_report_csv(failed_rows: list, batch: dict, output_path: str) -> str:
        if not output_path.endswith('.csv'):
            output_path = f'{output_path}.csv'

        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)

            writer.writerow(['错误报告 - 批次详情'])
            writer.writerow(['批次编号', batch['batch_number']])
            writer.writerow(['文件名称', batch['file_name']])
            writer.writerow(['总记录数', batch['total_rows']])
            writer.writerow(['成功数', batch['success_count']])
            writer.writerow(['失败数', batch['failed_count']])
            writer.writerow(['状态', batch['status']])
            writer.writerow(['创建时间', batch['created_at']])
            writer.writerow([])

            writer.writerow(['错误明细'])
            writer.writerow([
                '行号', '字段名称', '原始值', '错误类型',
                '错误信息', '修复建议', '重试次数', '创建时间'
            ])

            for fr in failed_rows:
                error_type_display = ExportService._get_error_type_display(fr['error_type'])
                writer.writerow([
                    fr['row_number'],
                    fr['field_name'],
                    fr['original_value'],
                    error_type_display,
                    fr['error_message'],
                    fr['fix_suggestion'],
                    fr['retried'],
                    fr['created_at']
                ])

            writer.writerow([])
            writer.writerow(['原始数据 - 可直接编辑后重试导入'])
            writer.writerow([])

            if failed_rows:
                first_row_data = failed_rows[0]['row_data']
                headers = list(first_row_data.keys())
                writer.writerow(headers)

                for fr in failed_rows:
                    row_data = fr['row_data']
                    row_values = [str(row_data.get(h, '')) if row_data.get(h) is not None else '' for h in headers]
                    writer.writerow(row_values)

        return output_path

    @staticmethod
    def _get_error_type_display(error_type: str) -> str:
        type_mapping = {
            'required_missing': '必填字段缺失',
            'price_format_error': '价格格式错误',
            'numeric_format_error': '数字格式错误',
            'duplicate_in_file': '文件内重复',
            'duplicate_in_database': '数据库重复',
            'database_error': '数据库错误',
            'exception': '异常错误'
        }
        return type_mapping.get(error_type, error_type)

    @staticmethod
    def _export_error_report_json(failed_rows: list, batch: dict, output_path: str) -> str:
        if not output_path.endswith('.json'):
            output_path = f'{output_path}.json'

        report_data = {
            'batch_info': batch,
            'export_time': datetime.now().isoformat(),
            'failed_rows': []
        }

        for fr in failed_rows:
            report_data['failed_rows'].append({
                'row_number': fr['row_number'],
                'field_name': fr['field_name'],
                'original_value': fr['original_value'],
                'error_type': fr['error_type'],
                'error_type_display': ExportService._get_error_type_display(fr['error_type']),
                'error_message': fr['error_message'],
                'fix_suggestion': fr['fix_suggestion'],
                'row_data': fr['row_data'],
                'retried': fr['retried'],
                'resolved': fr['resolved'],
                'created_at': fr['created_at']
            })

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)

        return output_path

    @staticmethod
    def export_import_summary(batch_id: int, output_path: str, format: str = 'csv') -> str:
        batch = BatchManager.get_batch_by_id(batch_id)
        if not batch:
            raise ValueError(f'批次不存在: {batch_id}')

        failed_rows = FailedRowManager.get_failed_rows(batch_id)
        logs = LogManager.get_logs(batch_id=batch_id, limit=200)

        error_summary = {}
        for fr in failed_rows:
            error_type = fr['error_type']
            if error_type not in error_summary:
                error_summary[error_type] = {
                    'count': 0,
                    'display_name': ExportService._get_error_type_display(error_type),
                    'rows': []
                }
            error_summary[error_type]['count'] += 1
            error_summary[error_type]['rows'].append(fr['row_number'])

        if format == 'csv':
            return ExportService._export_summary_csv(batch, failed_rows, error_summary, logs, output_path)
        elif format == 'json':
            return ExportService._export_summary_json(batch, failed_rows, error_summary, logs, output_path)
        else:
            raise ValueError(f'不支持的导出格式: {format}')

    @staticmethod
    def _export_summary_csv(batch: dict, failed_rows: list, error_summary: dict, 
                           logs: list, output_path: str) -> str:
        if not output_path.endswith('.csv'):
            output_path = f'{output_path}.csv'

        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)

            writer.writerow(['导入摘要报告'])
            writer.writerow(['生成时间', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
            writer.writerow([])

            writer.writerow(['一、批次基本信息'])
            writer.writerow(['批次编号', batch['batch_number']])
            writer.writerow(['文件名称', batch['file_name']])
            writer.writerow(['文件路径', batch['file_path']])
            writer.writerow(['创建时间', batch['created_at']])
            writer.writerow(['更新时间', batch['updated_at']])
            writer.writerow([])

            writer.writerow(['二、导入统计'])
            writer.writerow(['总记录数', batch['total_rows']])
            writer.writerow(['成功导入数', batch['success_count']])
            writer.writerow(['失败数', batch['failed_count']])
            writer.writerow(['成功率', f'{(batch["success_count"] / batch["total_rows"] * 100) if batch["total_rows"] > 0 else 0:.2f}%'])
            writer.writerow(['当前状态', ExportService._get_status_display(batch['status'])])
            writer.writerow([])

            writer.writerow(['三、错误类型统计'])
            if error_summary:
                writer.writerow(['错误类型', '错误数量', '涉及行号'])
                for error_type, summary in error_summary.items():
                    rows_str = ', '.join(map(str, summary['rows'][:10]))
                    if len(summary['rows']) > 10:
                        rows_str += f' 等共 {len(summary["rows"])} 行'
                    writer.writerow([summary['display_name'], summary['count'], rows_str])
            else:
                writer.writerow(['无错误'])
            writer.writerow([])

            writer.writerow(['四、操作日志'])
            writer.writerow(['时间', '类型', '消息'])
            for log in reversed(logs):
                writer.writerow([
                    log['created_at'],
                    ExportService._get_log_type_display(log['log_type']),
                    log['message']
                ])

        return output_path

    @staticmethod
    def _export_summary_json(batch: dict, failed_rows: list, error_summary: dict,
                            logs: list, output_path: str) -> str:
        if not output_path.endswith('.json'):
            output_path = f'{output_path}.json'

        summary_data = {
            'batch_info': batch,
            'status_display': ExportService._get_status_display(batch['status']),
            'statistics': {
                'total_rows': batch['total_rows'],
                'success_count': batch['success_count'],
                'failed_count': batch['failed_count'],
                'success_rate': (batch['success_count'] / batch['total_rows'] * 100) if batch['total_rows'] > 0 else 0
            },
            'error_summary': [],
            'logs': [],
            'export_time': datetime.now().isoformat()
        }

        for error_type, summary in error_summary.items():
            summary_data['error_summary'].append({
                'error_type': error_type,
                'display_name': summary['display_name'],
                'count': summary['count'],
                'row_numbers': summary['rows']
            })

        for log in logs:
            summary_data['logs'].append({
                'created_at': log['created_at'],
                'log_type': log['log_type'],
                'log_type_display': ExportService._get_log_type_display(log['log_type']),
                'message': log['message']
            })

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(summary_data, f, ensure_ascii=False, indent=2)

        return output_path

    @staticmethod
    def _get_status_display(status: str) -> str:
        status_mapping = {
            'pending': '等待处理',
            'running': '处理中',
            'completed': '完成',
            'completed_with_errors': '完成但有错误',
            'failed': '失败'
        }
        return status_mapping.get(status, status)

    @staticmethod
    def _get_log_type_display(log_type: str) -> str:
        type_mapping = {
            'info': '信息',
            'success': '成功',
            'error': '错误',
            'warning': '警告'
        }
        return type_mapping.get(log_type, log_type)
