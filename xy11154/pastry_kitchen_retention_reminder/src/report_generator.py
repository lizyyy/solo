import csv
import json
import os
from datetime import datetime
from typing import List, Dict
from pathlib import Path
from .parser import RetentionRecord
from .validator import ValidationResult
from .holiday_manager import HolidayManager

class ReportGenerator:
    def __init__(self, config: Dict, holiday_manager: HolidayManager):
        self.config = config
        self.holiday_manager = holiday_manager
        self.retention_days = config.get('retention_period_days', 48)
        self.output_dir = config.get('output_dir', 'output')
    
    def generate_reports(self, parse_result: Dict, validation_result: ValidationResult, 
                         run_timestamp: str) -> Dict:
        records = parse_result['records']
        valid_records = validation_result.valid_records
        
        destruction_list = self._calculate_destruction_list_with_datetime(valid_records)
        today = datetime.now().date()
        
        pending_destruction = [
            item for item in destruction_list
            if item['destruction_date_obj'] >= today
        ]
        pending_destruction.sort(key=lambda x: x['destruction_date_obj'])
        
        overdue_destruction = [
            item for item in destruction_list
            if item['destruction_date_obj'] < today
        ]
        overdue_destruction.sort(key=lambda x: x['destruction_date_obj'])
        
        output_files = self._write_all_reports(
            parse_result, validation_result, destruction_list,
            pending_destruction, overdue_destruction, run_timestamp
        )
        
        return {
            'total_records': len(records),
            'valid_records': len(valid_records),
            'parse_errors': len(parse_result['parse_errors']),
            'duplicate_boxes': len(validation_result.duplicate_box_numbers),
            'pending_destruction': len(pending_destruction),
            'overdue_destruction': len(overdue_destruction),
            'output_files': output_files
        }
    
    def _calculate_destruction_list_with_datetime(self, records: List[RetentionRecord]) -> List[Dict]:
        destruction_list = []
        
        for record in records:
            if record.parsed_date:
                calc_result = self.holiday_manager.calculate_destruction_date(
                    record.parsed_date, self.retention_days
                )
                
                destruction_list.append({
                    'box_number': record.box_number,
                    'product_name': record.product_name,
                    'production_date': record.parsed_date.strftime('%Y-%m-%d'),
                    'batch_number': record.batch_number,
                    'operator': record.operator,
                    'destruction_date': calc_result['destruction_date'].strftime('%Y-%m-%d'),
                    'destruction_date_obj': calc_result['destruction_date'].date(),
                    'actual_calendar_days': calc_result['actual_calendar_days'],
                    'skipped_count': len(calc_result['skipped_dates']),
                    'skipped_dates': calc_result['skipped_dates'],
                    'remarks': record.remarks
                })
        
        return destruction_list
    
    def _write_all_reports(self, parse_result: Dict, validation_result: ValidationResult,
                           destruction_list: List[Dict], pending_destruction: List[Dict],
                           overdue_destruction: List[Dict], run_timestamp: str) -> Dict:
        base_output_dir = Path(__file__).parent.parent / self.output_dir
        base_output_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S') if not run_timestamp else run_timestamp
        
        files = {}
        
        files['pending_destruction'] = self._write_destruction_report(
            base_output_dir / f'待销毁提醒_{timestamp}.csv',
            pending_destruction,
            '待销毁留样清单'
        )
        
        files['overdue_destruction'] = self._write_destruction_report(
            base_output_dir / f'超期未销毁_{timestamp}.csv',
            overdue_destruction,
            '超期未销毁留样清单'
        )
        
        files['duplicate_boxes'] = self._write_duplicate_report(
            base_output_dir / f'盒号重复预警_{timestamp}.csv',
            validation_result.duplicate_box_numbers
        )
        
        files['parse_errors'] = self._write_parse_errors(
            base_output_dir / f'数据解析错误_{timestamp}.csv',
            parse_result['parse_errors'],
            validation_result.parse_error_records
        )
        
        files['summary'] = self._write_summary_json(
            base_output_dir / f'运行报告_{timestamp}.json',
            parse_result, validation_result, pending_destruction, overdue_destruction, timestamp
        )
        
        return files
    
    def _write_destruction_report(self, file_path: Path, data: List[Dict], title: str) -> str:
        if not data:
            return ""
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([title])
            writer.writerow(['生成时间:', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
            writer.writerow([])
            writer.writerow([
                '盒号', '产品名称', '生产日期', '批次号', '操作员',
                '应销毁日期', '实际日历天数', '跳过节假日数', '备注'
            ])
            
            for item in data:
                writer.writerow([
                    item['box_number'],
                    item['product_name'],
                    item['production_date'],
                    item['batch_number'],
                    item['operator'],
                    item['destruction_date'],
                    item['actual_calendar_days'],
                    item['skipped_count'],
                    item['remarks']
                ])
        
        return str(file_path)
    
    def _write_duplicate_report(self, file_path: Path, duplicate_boxes: Dict[str, List]) -> str:
        if not duplicate_boxes:
            return ""
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['盒号重复预警报告'])
            writer.writerow(['生成时间:', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
            writer.writerow([])
            
            for box_num, records in duplicate_boxes.items():
                writer.writerow([f'重复盒号: {box_num}', f'出现次数: {len(records)}'])
                writer.writerow([
                    '序号', '产品名称', '生产日期', '批次号', '操作员', '备注'
                ])
                
                for idx, record in enumerate(records, 1):
                    writer.writerow([
                        idx,
                        record.product_name,
                        record.production_date,
                        record.batch_number,
                        record.operator,
                        record.remarks
                    ])
                writer.writerow([])
        
        return str(file_path)
    
    def _write_parse_errors(self, file_path: Path, row_errors: List[Dict],
                            record_errors: List[RetentionRecord]) -> str:
        if not row_errors and not record_errors:
            return ""
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['数据解析错误报告'])
            writer.writerow(['生成时间:', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
            writer.writerow([])
            
            if row_errors:
                writer.writerow(['行级解析错误'])
                writer.writerow(['行号', '错误信息', '原始数据'])
                for error in row_errors:
                    writer.writerow([
                        error['row'],
                        error['error'],
                        error['data']
                    ])
                writer.writerow([])
            
            if record_errors:
                writer.writerow(['字段级校验错误'])
                writer.writerow([
                    '盒号', '产品名称', '生产日期', '批次号', '操作员', '错误详情'
                ])
                for record in record_errors:
                    writer.writerow([
                        record.box_number,
                        record.product_name,
                        record.production_date,
                        record.batch_number,
                        record.operator,
                        '; '.join(record.parse_errors)
                    ])
        
        return str(file_path)
    
    def _clean_for_json(self, item: Dict) -> Dict:
        cleaned = item.copy()
        if 'destruction_date_obj' in cleaned:
            del cleaned['destruction_date_obj']
        return cleaned
    
    def _write_summary_json(self, file_path: Path, parse_result: Dict, 
                            validation_result: ValidationResult,
                            pending_destruction: List[Dict],
                            overdue_destruction: List[Dict],
                            timestamp: str) -> str:
        pending_clean = [self._clean_for_json(item) for item in pending_destruction]
        overdue_clean = [self._clean_for_json(item) for item in overdue_destruction]
        
        summary = {
            'run_timestamp': timestamp,
            'source_file': parse_result['file_path'],
            'statistics': {
                'total_rows': parse_result['raw_rows_count'],
                'valid_records': len(validation_result.valid_records),
                'parse_errors': len(parse_result['parse_errors']) + len(validation_result.parse_error_records),
                'duplicate_box_count': len(validation_result.duplicate_box_numbers),
                'pending_destruction_count': len(pending_destruction),
                'overdue_destruction_count': len(overdue_destruction)
            },
            'pending_destruction': pending_clean,
            'overdue_destruction': overdue_clean,
            'duplicate_boxes': {
                box_num: [r.to_dict() for r in records]
                for box_num, records in validation_result.duplicate_box_numbers.items()
            }
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        
        return str(file_path)
