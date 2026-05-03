"""
船舶数据 JSON 读取器
"""
import json
from datetime import datetime, timedelta
from typing import List

from ..models import Ship


class ShipReader:
    """船舶数据读取器"""
    
    @staticmethod
    def read_json(file_path: str) -> List[Ship]:
        """
        读取船舶数据 JSON 文件
        
        JSON 格式要求：
        [
            {
                "name": "船舶名称",
                "imo": "IMO编号（可选）",
                "draft": 8.5,  # 吃水深度（米）
                "cargo_weight": 50000,  # 货重（吨）
                "length": 200,  # 船长（米）
                "width": 30,  # 船宽（米）
                "required_berth_types": ["general", "container"],  # 需要的泊位类型
                "required_tug_count": 2,  # 需要的拖轮数量
                "operation_duration": 240  # 作业时长（分钟）
            }
        ]
        
        Args:
            file_path: JSON 文件路径
            
        Returns:
            船舶信息列表
        """
        ships = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 支持列表或单个对象
        if isinstance(data, dict):
            data = [data]
        
        for item in data:
            # 解析作业时长（分钟转换为 timedelta）
            operation_minutes = item.get('operation_duration', 240)  # 默认4小时
            operation_duration = timedelta(minutes=operation_minutes)
            
            # 解析到达和离开时间（如果有）
            arrival_time = None
            if item.get('arrival_time'):
                try:
                    arrival_time = datetime.strptime(item['arrival_time'], '%Y-%m-%d %H:%M')
                except ValueError:
                    pass
            
            departure_time = None
            if item.get('departure_time'):
                try:
                    departure_time = datetime.strptime(item['departure_time'], '%Y-%m-%d %H:%M')
                except ValueError:
                    pass
            
            ship = Ship(
                name=item.get('name', '未命名船舶'),
                imo=item.get('imo'),
                draft=float(item.get('draft', 0.0)),
                cargo_weight=float(item.get('cargo_weight', 0.0)),
                length=float(item.get('length', 0.0)),
                width=float(item.get('width', 0.0)),
                required_berth_types=item.get('required_berth_types', []),
                required_tug_count=int(item.get('required_tug_count', 0)),
                arrival_time=arrival_time,
                departure_time=departure_time,
                operation_duration=operation_duration
            )
            
            ships.append(ship)
        
        return ships
