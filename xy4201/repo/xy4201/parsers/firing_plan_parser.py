"""
烧成计划解析器
解析烧成计划JSON文件
"""

import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from .base_parser import BaseParser
from ..models import FiringPlan, FiringSegment


class FiringPlanParser(BaseParser):
    """烧成计划JSON解析器"""
    
    def parse(self, file_path: str) -> Optional[FiringPlan]:
        """
        解析烧成计划JSON文件
        
        期望的JSON格式：
        {
            "plan_id": "FP-2024-001",
            "name": "标准氧化烧成",
            "description": "适用于瓷泥的标准氧化烧成曲线",
            "created_at": "2024-01-01T08:00:00",
            "segments": [
                {
                    "segment_id": "S1",
                    "name": "预热阶段",
                    "start_temperature": 25,
                    "end_temperature": 300,
                    "rate": 150,
                    "hold_time_minutes": 0,
                    "description": "缓慢升温排除水分"
                },
                {
                    "segment_id": "S2",
                    "name": "快速升温",
                    "start_temperature": 300,
                    "end_temperature": 1200,
                    "rate": 200,
                    "hold_time_minutes": 0
                },
                {
                    "segment_id": "S3",
                    "name": "最高温保温",
                    "start_temperature": 1200,
                    "end_temperature": 1200,
                    "rate": 0,
                    "hold_time_minutes": 30,
                    "description": "最高温保温30分钟"
                }
            ]
        }
        """
        self.clear()
        
        if not self.validate_file(file_path):
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            self.add_error(f"JSON解析错误: {str(e)}")
            return None
        except Exception as e:
            self.add_error(f"文件读取错误: {str(e)}")
            return None
        
        return self._parse_firing_plan(data)
    
    def _parse_firing_plan(self, data: Dict[str, Any]) -> Optional[FiringPlan]:
        """解析烧成计划数据"""
        plan_id = data.get('plan_id') or data.get('id')
        if not plan_id:
            self.add_error("缺少计划ID")
            return None
        
        name = data.get('name', '未命名烧成计划')
        description = data.get('description')
        
        created_at = None
        created_at_str = data.get('created_at')
        if created_at_str:
            try:
                created_at = datetime.fromisoformat(created_at_str)
            except ValueError:
                self.add_warning(f"创建时间格式无法解析: {created_at_str}")
        
        segments_data = data.get('segments', [])
        segments: List[FiringSegment] = []
        
        for seg_data in segments_data:
            segment = self._parse_segment(seg_data)
            if segment:
                segments.append(segment)
        
        if not segments:
            self.add_warning("未解析到有效的烧成段")
        
        return FiringPlan(
            plan_id=plan_id,
            name=name,
            description=description,
            segments=segments,
            created_at=created_at
        )
    
    def _parse_segment(self, data: Dict[str, Any]) -> Optional[FiringSegment]:
        """解析单个烧成段"""
        segment_id = data.get('segment_id') or data.get('id')
        if not segment_id:
            self.add_warning("缺少段ID，跳过此段")
            return None
        
        name = data.get('name', '未命名段')
        
        start_temperature = data.get('start_temperature')
        if start_temperature is None:
            self.add_warning(f"段 {segment_id} 缺少起始温度，跳过此段")
            return None
        
        end_temperature = data.get('end_temperature')
        if end_temperature is None:
            self.add_warning(f"段 {segment_id} 缺少目标温度，跳过此段")
            return None
        
        rate = data.get('rate', 0)
        if rate < 0:
            self.add_warning(f"段 {segment_id} 升温速率为负数，设为0")
            rate = 0
        
        hold_time = None
        hold_time_minutes = data.get('hold_time_minutes')
        if hold_time_minutes is not None and hold_time_minutes > 0:
            hold_time = timedelta(minutes=hold_time_minutes)
        
        hold_time_hours = data.get('hold_time_hours')
        if hold_time_hours is not None and hold_time_hours > 0:
            hold_time = timedelta(hours=hold_time_hours)
        
        description = data.get('description')
        
        return FiringSegment(
            segment_id=segment_id,
            name=name,
            start_temperature=float(start_temperature),
            end_temperature=float(end_temperature),
            rate=float(rate),
            hold_time=hold_time,
            description=description
        )
