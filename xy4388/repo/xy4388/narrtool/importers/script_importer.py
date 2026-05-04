"""口述稿 JSON 导入器"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from .base import BaseImporter, parse_timecode


class ScriptImporter(BaseImporter):
    """口述稿 JSON 导入器"""
    
    def __init__(self, file_path: str | Path):
        super().__init__(file_path)
    
    def parse(self) -> List[Dict[str, Any]]:
        """解析口述稿 JSON 文件"""
        narrations = []
        
        with open(self.file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, list):
            for index, item in enumerate(data, start=1):
                narration = self._parse_item(item, index)
                if narration:
                    narrations.append(narration)
        elif isinstance(data, dict):
            segments = data.get("segments", data.get("narrations", []))
            if not segments and "segments" not in data and "narrations" not in data:
                narration = self._parse_item(data, 1)
                if narration:
                    narrations.append(narration)
            else:
                for index, item in enumerate(segments, start=1):
                    narration = self._parse_item(item, index)
                    if narration:
                        narrations.append(narration)
        
        return narrations
    
    def _parse_item(self, item: Dict[str, Any], default_index: int) -> Optional[Dict[str, Any]]:
        """解析单个口述段落"""
        try:
            index = item.get("index", item.get("id", default_index))
            
            start_time = self._get_time(item, ["start_time", "start", "begin"])
            end_time = self._get_time(item, ["end_time", "end"])
            text = item.get("text", item.get("content", "")).strip()
            
            if not text:
                return None
            
            is_critical = item.get("is_critical", item.get("critical", 0))
            if isinstance(is_critical, bool):
                is_critical = 1 if is_critical else 0
            else:
                is_critical = int(is_critical)
            
            return {
                "index": int(index),
                "start_time": start_time,
                "end_time": end_time,
                "text": text,
                "is_critical": is_critical,
            }
        except Exception as e:
            print(f"Warning: 解析口述段落失败: {e}")
            return None
    
    def _get_time(self, item: Dict[str, Any], keys: List[str]) -> float:
        """从多种键中获取时间值"""
        for key in keys:
            if key in item:
                value = item[key]
                if isinstance(value, (int, float)):
                    return float(value)
                elif isinstance(value, str):
                    return parse_timecode(value)
        
        raise ValueError(f"无法找到时间字段: {keys}")
