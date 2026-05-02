"""
CSV 文件解析器
"""

import csv
from typing import List, Dict, Any
from pathlib import Path

from ..models import CallSheetEntry


class CSVParser:
    """解析通告单等CSV文件"""
    
    def parse_call_sheet(self, file_path: str) -> List[CallSheetEntry]:
        """
        解析通告单 CSV 文件
        
        预期格式:
        - scene_id: 场次号 (如 1-01, 2-03)
        - shot_number: 镜号 (如 1, 2A, 3B)
        - description: 镜头描述
        - characters: 出场角色 (逗号分隔)
        - props: 道具 (逗号分隔)
        - scheduled_time: 预计时间
        - location: 场景地点
        - page_count: 页数
        """
        entries = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                characters = self._parse_list(row.get('characters', ''))
                props = self._parse_list(row.get('props', ''))
                
                page_count = 0.0
                try:
                    page_count = float(row.get('page_count', '0'))
                except (ValueError, TypeError):
                    pass
                
                entry = CallSheetEntry(
                    scene_id=row.get('scene_id', '').strip(),
                    shot_number=row.get('shot_number', '').strip(),
                    description=row.get('description', '').strip(),
                    characters=characters,
                    props=props,
                    scheduled_time=row.get('scheduled_time', '').strip() or None,
                    location=row.get('location', '').strip(),
                    page_count=page_count
                )
                entries.append(entry)
        
        return entries
    
    def parse_simple_list(self, file_path: str) -> List[Dict[str, Any]]:
        """解析简单的列表CSV"""
        items = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                items.append(dict(row))
        
        return items
    
    def _parse_list(self, value: str) -> List[str]:
        """解析逗号分隔的列表"""
        if not value:
            return []
        return [item.strip() for item in value.split(',') if item.strip()]
