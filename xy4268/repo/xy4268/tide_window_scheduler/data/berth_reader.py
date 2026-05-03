"""
泊位限制 YAML 读取器
"""
import yaml
from datetime import time
from typing import List

from ..models import Berth, TimeSlot


class BerthReader:
    """泊位数据读取器"""
    
    @staticmethod
    def read_yaml(file_path: str) -> List[Berth]:
        """
        读取泊位限制 YAML 文件
        
        YAML 格式要求：
        berths:
          - id: "B1"
            name: "1号泊位"
            type: "general"
            max_draft: 10.5  # 最大允许吃水（米）
            max_length: 250  # 最大允许船长（米）
            max_width: 35  # 最大允许船宽（米）
            available_time_slots:  # 可用时间段
              - start: "00:00"
                end: "24:00"
            restrictions: []  # 限制条件
        
        Args:
            file_path: YAML 文件路径
            
        Returns:
            泊位信息列表
        """
        berths = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        # 支持直接列表或包含 berths 字段的对象
        berth_list = data if isinstance(data, list) else data.get('berths', [])
        
        for item in berth_list:
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
            
            berth = Berth(
                id=item.get('id', ''),
                name=item.get('name', '未命名泊位'),
                type=item.get('type', 'general'),
                max_draft=float(item.get('max_draft', 0.0)),
                max_length=float(item.get('max_length', 0.0)),
                max_width=float(item.get('max_width', 0.0)),
                available_time_slots=available_time_slots,
                restrictions=item.get('restrictions', [])
            )
            
            berths.append(berth)
        
        return berths
