"""
观察备注解析器
解析观察备注文件（CSV或文本）
"""

import csv
from datetime import datetime
from typing import List, Dict, Optional
from .base_parser import BaseParser
from ..models import Observation


class ObservationParser(BaseParser):
    """观察备注解析器"""
    
    def __init__(self):
        super().__init__()
        self.obs_id_counter = 1
    
    def parse(self, file_path: str) -> List[Observation]:
        """
        解析观察备注文件
        
        支持两种格式：
        1. CSV格式（推荐）
        2. 纯文本格式
        
        CSV格式：
        observation_id,timestamp,content,author,category,related_work_ids
        O-001,2024-01-01 10:00:00,上层温度上升略快,张三,升温,W-001,W-002
        
        纯文本格式：
        [2024-01-01 10:00:00] 上层温度上升略快 - 张三
        [2024-01-01 12:00:00] 进入保温阶段 - 李四
        """
        self.clear()
        
        if not self.validate_file(file_path):
            return []
        
        if file_path.lower().endswith('.csv'):
            return self._parse_csv(file_path)
        else:
            return self._parse_text(file_path)
    
    def _parse_csv(self, file_path: str) -> List[Observation]:
        """解析CSV格式"""
        observations: List[Observation] = []
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    obs = self._parse_csv_row(row, row_num)
                    if obs:
                        observations.append(obs)
        
        except csv.Error as e:
            self.add_error(f"CSV解析错误: {str(e)}")
            return []
        
        return observations
    
    def _parse_csv_row(self, row: Dict[str, str], row_num: int) -> Optional[Observation]:
        """解析CSV单行"""
        observation_id = row.get('observation_id') or row.get('id')
        if not observation_id:
            observation_id = f"AUTO-O-{self.obs_id_counter:03d}"
            self.obs_id_counter += 1
        
        timestamp_str = row.get('timestamp') or row.get('time')
        if not timestamp_str:
            self.add_warning(f"第{row_num}行缺少时间戳，跳过")
            return None
        
        timestamp = self._parse_timestamp(timestamp_str)
        if timestamp is None:
            self.add_warning(f"第{row_num}行时间格式无法解析: {timestamp_str}，跳过")
            return None
        
        content = row.get('content') or row.get('note') or row.get('text')
        if not content:
            self.add_warning(f"第{row_num}行缺少内容，跳过")
            return None
        
        author = row.get('author')
        category = row.get('category')
        
        related_work_ids = []
        related_str = row.get('related_work_ids') or row.get('work_ids')
        if related_str:
            related_work_ids = [w.strip() for w in related_str.split(',') if w.strip()]
        
        return Observation(
            observation_id=observation_id,
            timestamp=timestamp,
            content=content,
            author=author,
            category=category,
            related_work_ids=related_work_ids
        )
    
    def _parse_text(self, file_path: str) -> List[Observation]:
        """解析纯文本格式"""
        observations: List[Observation] = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            for line_num, line in enumerate(lines, start=1):
                line = line.strip()
                if not line:
                    continue
                
                obs = self._parse_text_line(line, line_num)
                if obs:
                    observations.append(obs)
        
        except Exception as e:
            self.add_error(f"文件读取错误: {str(e)}")
            return []
        
        return observations
    
    def _parse_text_line(self, line: str, line_num: int) -> Optional[Observation]:
        """解析单行文本"""
        import re
        
        timestamp_pattern = r'\[([^\]]+)\]|\(([^)]+)\)|^([\d\-/]+ [\d:]+)'
        match = re.search(timestamp_pattern, line)
        
        if not match:
            self.add_warning(f"第{line_num}行未找到时间戳，跳过")
            return None
        
        timestamp_str = match.group(1) or match.group(2) or match.group(3)
        timestamp = self._parse_timestamp(timestamp_str.strip())
        
        if timestamp is None:
            self.add_warning(f"第{line_num}行时间格式无法解析: {timestamp_str}，跳过")
            return None
        
        content = line[match.end():].strip()
        
        author = None
        if ' - ' in content:
            parts = content.rsplit(' - ', 1)
            if len(parts) == 2:
                content = parts[0].strip()
                author = parts[1].strip()
        
        if not content:
            self.add_warning(f"第{line_num}行缺少内容，跳过")
            return None
        
        observation_id = f"AUTO-O-{self.obs_id_counter:03d}"
        self.obs_id_counter += 1
        
        return Observation(
            observation_id=observation_id,
            timestamp=timestamp,
            content=content,
            author=author,
            category=None,
            related_work_ids=[]
        )
    
    def _parse_timestamp(self, timestamp_str: str) -> Optional[datetime]:
        """解析时间戳"""
        timestamp_str = timestamp_str.strip()
        
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%m/%d/%Y %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%Y-%m-%d",
            "%Y/%m/%d",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(timestamp_str, fmt)
            except ValueError:
                continue
        
        try:
            return datetime.fromisoformat(timestamp_str)
        except ValueError:
            pass
        
        return None
