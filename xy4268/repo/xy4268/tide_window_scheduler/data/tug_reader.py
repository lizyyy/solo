"""
拖轮数据 JSON 读取器
"""
import json
from datetime import time
from typing import List

from ..models import Tug, TimeSlot


class TugReader:
    """拖轮数据读取器"""
    
    @staticmethod
    def read_json(file_path: str) -> List[Tug]:
        """
        读取拖轮数据 JSON 文件
        
        JSON 格式要求：
        [
            {
                "id": "T1",
                "name": "拖轮1号",
                "capacity": 5000,  # 拖力（吨）
                "available_time_slots": [  # 可用时间段
                    {
                        "start": "08:00",
                        "end": "18:00"
                    }
                ]
            }
        ]
        
        Args:
            file_path: JSON 文件路径
            
        Returns:
            拖轮信息列表
        """
        tugs = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 支持列表或包含 tugs 字段的对象
        if isinstance(data, dict):
            data = data.get('tugs', [])
        
        for item in data:
            # 解析可用时间段
            available_time_slots = []
            slots = item.get('available_time_slots', [])
            
            for slot in slots:
                start_str = slot.get('start', '00:00')
                end_str = slot.get('end', '24:00')
                
                # 处理 24:00 的特殊情况
                if end_str == '24:00':
                    end_str = '23:59'
                
                try:
                    start = time.fromisoformat(start_str)
                    end = time.fromisoformat(end_str)
                    available_time_slots.append(TimeSlot(start=start, end=end))
                except ValueError:
                    # 尝试其他时间格式
                    try:
                        # 处理可能缺少前导零的情况，如 "8:00"
                        if ':' in start_str:
                            parts = start_str.split(':')
                            if len(parts) == 2:
                                hour = int(parts[0])
                                minute = int(parts[1])
                                start = time(hour=hour, minute=minute)
                        if ':' in end_str:
                            parts = end_str.split(':')
                            if len(parts) == 2:
                                hour = int(parts[0])
                                minute = int(parts[1])
                                if hour >= 24:
                                    hour = 23
                                    minute = 59
                                end = time(hour=hour, minute=minute)
                        available_time_slots.append(TimeSlot(start=start, end=end))
                    except:
                        # 如果解析失败，跳过该时间段
                        continue
            
            tug = Tug(
                id=item.get('id', ''),
                name=item.get('name', '未命名拖轮'),
                capacity=float(item.get('capacity', 0.0)),
                available_time_slots=available_time_slots
            )
            
            tugs.append(tug)
        
        return tugs
