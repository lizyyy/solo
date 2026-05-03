import os
import csv
from datetime import datetime
from typing import List, Dict, Any

from src.models import Conflict, ValidationError


class CSVConflictExporter:
    def __init__(self):
        pass

    def export_conflicts(self, conflicts: List[Conflict], output_path: str) -> str:
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        rows = []
        for idx, conflict in enumerate(conflicts, 1):
            row = self._conflict_to_row(conflict, idx)
            rows.append(row)
        
        fieldnames = [
            '序号', '冲突类型', '严重程度', '涉及事件数',
            '事件标题', '事件来源文件', '事件时间', '事件地点',
            '冲突描述', '建议处理方式'
        ]
        
        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        return output_path

    def export_validation_errors(self, errors: List[ValidationError], output_path: str) -> str:
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        rows = []
        for idx, error in enumerate(errors, 1):
            row = self._error_to_row(error, idx)
            rows.append(row)
        
        fieldnames = [
            '序号', '错误类型', '严重程度',
            '源文件', '行号', '事件标题',
            '错误信息'
        ]
        
        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        return output_path

    def _conflict_to_row(self, conflict: Conflict, index: int) -> Dict[str, Any]:
        event_titles = []
        event_sources = []
        event_times = []
        event_locations = []
        
        for event in conflict.events:
            event_titles.append(event.title or "未命名")
            event_sources.append(event.source_file or "未知")
            if event.start and event.end:
                time_str = f"{event.start.strftime('%m-%d %H:%M')} - {event.end.strftime('%H:%M')}"
            elif event.start:
                time_str = event.start.strftime('%m-%d %H:%M')
            else:
                time_str = "未知时间"
            event_times.append(time_str)
            event_locations.append(event.location or "未知地点")
        
        severity_map = {
            'error': '错误',
            'warning': '警告',
            'info': '提示',
        }
        
        conflict_type_map = {
            'time_overlap': '时间重叠',
            'commute_buffer_insufficient': '通勤缓冲不足',
            'location_mutually_exclusive': '地点互斥',
            'missing_title': '缺少标题',
            'missing_location': '缺少地点',
            'invalid_end_time': '结束时间无效',
            'cross_day_event': '跨天事件',
            'unexpanded_recurrence': '未展开重复事件',
            'zero_or_negative_duration': '持续时间无效',
        }
        
        return {
            '序号': index,
            '冲突类型': conflict_type_map.get(conflict.conflict_type, conflict.conflict_type),
            '严重程度': severity_map.get(conflict.severity, conflict.severity),
            '涉及事件数': len(conflict.events),
            '事件标题': '; '.join(event_titles),
            '事件来源文件': '; '.join(event_sources),
            '事件时间': '; '.join(event_times),
            '事件地点': '; '.join(event_locations),
            '冲突描述': conflict.description,
            '建议处理方式': conflict.suggestion or '请手动检查',
        }

    def _error_to_row(self, error: ValidationError, index: int) -> Dict[str, Any]:
        severity_map = {
            'error': '错误',
            'warning': '警告',
            'info': '提示',
        }
        
        error_type_map = {
            'file_not_found': '文件不存在',
            'read_error': '读取错误',
            'parse_error': '解析错误',
            'missing_title': '缺少标题',
            'missing_start': '缺少开始时间',
            'missing_end': '缺少结束时间',
            'naive_datetime': '无时区信息',
            'timezone_convert_error': '时区转换错误',
            'invalid_timezone': '无效时区',
            'rrule_parse_error': '重复规则解析错误',
            'recurrence_limit': '重复事件限制',
            'normalization_error': '规范化错误',
            'row_parse_error': '行解析错误',
            'empty_file': '空文件',
            'event_parse_error': '事件解析错误',
        }
        
        return {
            '序号': index,
            '错误类型': error_type_map.get(error.error_type, error.error_type),
            '严重程度': severity_map.get(error.severity, error.severity),
            '源文件': error.source_file or "未知",
            '行号': error.line_number or "-",
            '事件标题': error.event_title or "-",
            '错误信息': error.message,
        }
