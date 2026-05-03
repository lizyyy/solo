"""YAML解析器 - 用于解析关键日期备忘"""
import yaml
from typing import Any, Dict, List
from .base_parser import BaseParser


class YAMLParser(BaseParser):
    """YAML文件解析器"""
    
    def __init__(self):
        self.supported_extensions = ['.yaml', '.yml']
    
    def supports_file(self, file_path: str) -> bool:
        """检查是否支持该文件类型"""
        return any(file_path.lower().endswith(ext) for ext in self.supported_extensions)
    
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        """
        解析关键日期备忘YAML文件
        
        预期的YAML格式：
        - events: 事件列表，每个事件包含：
          - id: 事件ID（可选）
          - date: 日期
          - title: 标题
          - description: 描述
          - role: 角色（可选，用于时间线分组）
        或者是一个简单的事件列表
        """
        results = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        events = []
        if isinstance(data, list):
            events = data
        elif isinstance(data, dict):
            events = data.get('events', [data])
        
        for i, event in enumerate(events):
            event_id = event.get('id', str(i))
            
            timestamp = None
            date_str = event.get('date', event.get('timestamp', ''))
            if date_str:
                try:
                    timestamp = self._parse_timestamp(date_str)
                except Exception:
                    pass
            
            results.append({
                'id': f'memo_{event_id}',
                'type': 'memo',
                'content': f"{event.get('title', '')}: {event.get('description', '')}",
                'timestamp': timestamp,
                'metadata': {
                    'date': date_str,
                    'title': event.get('title', ''),
                    'description': event.get('description', ''),
                    'role': event.get('role', '备忘'),
                    'original_event': event
                }
            })
        
        return results
