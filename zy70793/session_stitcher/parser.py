import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Tuple, Any


class JSONLParser:
    def __init__(
        self,
        user_field: str = "user_id",
        session_field: str = "session_id",
        time_field: str = "event_time",
        time_format: str = "iso"
    ):
        self.user_field = user_field
        self.session_field = session_field
        self.time_field = time_field
        self.time_format = time_format

    def parse_time(self, time_value: Any) -> float:
        if self.time_format == "iso":
            if isinstance(time_value, str):
                dt = datetime.fromisoformat(time_value.replace('Z', '+00:00'))
                return dt.timestamp()
            else:
                raise ValueError(f"ISO格式时间需要字符串类型: {time_value}")
        elif self.time_format == "timestamp_ms":
            return float(time_value) / 1000
        elif self.time_format == "timestamp_s":
            return float(time_value)
        else:
            raise ValueError(f"不支持的时间格式: {self.time_format}")

    def parse_file(self, file_path: str) -> Tuple[List[Dict], List[Dict]]:
        events = []
        bad_lines = []
        file_path_obj = Path(file_path)
        
        with open(file_path_obj, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    event = json.loads(line)
                    
                    if self.user_field not in event:
                        raise ValueError(f"缺少用户字段: {self.user_field}")
                    if self.session_field not in event:
                        raise ValueError(f"缺少会话字段: {self.session_field}")
                    if self.time_field not in event:
                        raise ValueError(f"缺少时间字段: {self.time_field}")
                    
                    parsed_time = self.parse_time(event[self.time_field])
                    
                    event['_source'] = {
                        'file': str(file_path_obj),
                        'line': line_num,
                        'original_line': line
                    }
                    event['_parsed_time'] = parsed_time
                    
                    events.append(event)
                    
                except Exception as e:
                    bad_lines.append({
                        'file': str(file_path_obj),
                        'line': line_num,
                        'original_line': line,
                        'error': str(e)
                    })
        
        return events, bad_lines

    def parse_files(self, file_paths: List[str]) -> Tuple[List[Dict], List[Dict]]:
        all_events = []
        all_bad_lines = []
        
        for file_path in file_paths:
            events, bad_lines = self.parse_file(file_path)
            all_events.extend(events)
            all_bad_lines.extend(bad_lines)
        
        return all_events, all_bad_lines
