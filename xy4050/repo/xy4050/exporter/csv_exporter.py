import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.event import Event
from models.risk_level import RiskLevel
from config import EXPORT_CONFIG


class CSVExporter:
    def __init__(self):
        self._area_names: Dict[str, str] = {}
        self._event_type_names: Dict[str, str] = {}
        self._delimiter = EXPORT_CONFIG.get('csv_delimiter', ',')
    
    def set_area_names(self, area_names: Dict[str, str]):
        self._area_names = area_names
    
    def set_event_type_names(self, event_type_names: Dict[str, str]):
        self._event_type_names = event_type_names
    
    def _get_area_name(self, code: str) -> str:
        return self._area_names.get(code, code)
    
    def _get_event_type_name(self, code: str) -> str:
        return self._event_type_names.get(code, code)
    
    def _format_time(self, dt: Optional[datetime]) -> str:
        if dt is None:
            return ""
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    
    def export_events(
        self,
        events: List[Event],
        output_path: Optional[str] = None,
        include_invalid: bool = False,
    ) -> List[Dict[str, Any]]:
        if include_invalid:
            export_events = events
        else:
            export_events = [e for e in events if e.is_valid]
        
        export_events.sort(key=lambda e: e.unified_time or e.original_time or datetime.min)
        
        rows = []
        
        for event in export_events:
            row = {
                '序号': len(rows) + 1,
                '来源': event.source,
                '原始时间': event.original_time_str,
                '解析时间': self._format_time(event.original_time),
                '时间偏移(秒)': event.time_offset_seconds,
                '统一时间': self._format_time(event.unified_time),
                '区域代码': event.area_code,
                '区域名称': self._get_area_name(event.area_code),
                '事件类型代码': event.event_type_code,
                '事件类型名称': self._get_event_type_name(event.event_type_code),
                '风险等级': str(event.risk_level),
                '描述': event.description,
                '涉及人数': event.person_count if event.person_count else "",
                '照片编号': ", ".join(event.photo_numbers) if event.photo_numbers else "",
                '备注': event.notes,
                '复盘标签': ", ".join(event.review_tags) if event.review_tags else "",
                '合并状态': str(event.merge_status),
                '是否有效': '是' if event.is_valid else '否',
                '校验错误': " | ".join([str(e) for e in event.validation_errors]) if event.validation_errors else "",
                '事件ID': event.id,
                '导入批次ID': event.import_batch_id,
            }
            rows.append(row)
        
        if output_path and rows:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            fieldnames = list(rows[0].keys())
            
            with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=self._delimiter)
                writer.writeheader()
                writer.writerows(rows)
        
        return rows
