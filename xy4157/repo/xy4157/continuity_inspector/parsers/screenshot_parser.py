"""
截图清单解析器
"""

import csv
import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional

from ..models import ScreenshotItem


class ScreenshotParser:
    """
    解析镜头截图清单
    
    支持两种格式:
    1. CSV 格式 (推荐): 包含 file_path, scene_id, shot_number, take, timestamp
    2. JSON 格式: 结构更灵活
    """
    
    def parse(self, file_path: str) -> List[ScreenshotItem]:
        """根据文件扩展名自动选择解析方式"""
        ext = Path(file_path).suffix.lower()
        
        if ext == '.csv':
            return self._parse_csv(file_path)
        elif ext == '.json':
            return self._parse_json(file_path)
        else:
            return self._parse_text_list(file_path)
    
    def _parse_csv(self, file_path: str) -> List[ScreenshotItem]:
        """解析CSV格式的截图清单"""
        items = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                take = None
                take_str = row.get('take', '')
                if take_str:
                    try:
                        take = int(take_str)
                    except ValueError:
                        pass
                
                item = ScreenshotItem(
                    file_path=row.get('file_path', '').strip(),
                    scene_id=row.get('scene_id', '').strip(),
                    shot_number=row.get('shot_number', '').strip(),
                    take=take,
                    timestamp=row.get('timestamp', '').strip() or None
                )
                items.append(item)
        
        return items
    
    def _parse_json(self, file_path: str) -> List[ScreenshotItem]:
        """解析JSON格式的截图清单"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        screenshots = data.get('screenshots', [])
        if not isinstance(screenshots, list):
            screenshots = [screenshots] if screenshots else []
        
        items = []
        for s in screenshots:
            take = s.get('take')
            if take is not None:
                try:
                    take = int(take)
                except (ValueError, TypeError):
                    take = None
            
            item = ScreenshotItem(
                file_path=s.get('file_path', ''),
                scene_id=s.get('scene_id', ''),
                shot_number=s.get('shot_number', ''),
                take=take,
                timestamp=s.get('timestamp')
            )
            items.append(item)
        
        return items
    
    def _parse_text_list(self, file_path: str) -> List[ScreenshotItem]:
        """
        解析简单的文本列表 (每行一个文件路径)
        尝试从文件名中提取 scene_id 和 shot_number
        
        文件名格式预期: SCENE_SHOT_TAKE.jpg 或类似
        例如: 1-01_01_03.jpg 表示场次 1-01, 镜号 1, take 3
        """
        items = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                
                scene_id, shot_number, take = self._extract_from_filename(line)
                
                item = ScreenshotItem(
                    file_path=line,
                    scene_id=scene_id,
                    shot_number=shot_number,
                    take=take
                )
                items.append(item)
        
        return items
    
    def _extract_from_filename(self, file_path: str) -> tuple:
        """
        从文件名中尝试提取场次、镜号、take信息
        
        支持格式:
        - 1-01_01.jpg → scene=1-01, shot=1
        - 1-01_01_03.jpg → scene=1-01, shot=1, take=3
        - SC101_SH05_T2.png → scene=SC101, shot=5, take=2
        """
        filename = os.path.basename(file_path)
        name, _ = os.path.splitext(filename)
        
        parts = name.split('_')
        
        scene_id = ''
        shot_number = ''
        take = None
        
        if len(parts) >= 1:
            scene_id = parts[0]
        
        if len(parts) >= 2:
            shot_part = parts[1]
            shot_number = self._normalize_shot_number(shot_part)
        
        if len(parts) >= 3:
            take_part = parts[2]
            try:
                if take_part.upper().startswith('T'):
                    take = int(take_part[1:].lstrip('0') or '0')
                else:
                    take = int(take_part.lstrip('0') or '0')
            except ValueError:
                pass
        
        return scene_id, shot_number, take
    
    def _normalize_shot_number(self, part: str) -> str:
        """标准化镜号格式"""
        part = part.upper().strip()
        if part.startswith('SH'):
            return part[2:].lstrip('0') or '1'
        if part.startswith('S'):
            return part[1:].lstrip('0') or '1'
        return part.lstrip('0') or part
