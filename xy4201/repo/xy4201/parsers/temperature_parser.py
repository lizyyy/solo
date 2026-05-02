"""
温度数据解析器
解析窑炉温度CSV文件
"""

import csv
from datetime import datetime
from typing import List, Dict, Optional
from .base_parser import BaseParser
from ..models import TemperaturePoint


class TemperatureParser(BaseParser):
    """温度数据CSV解析器"""
    
    def __init__(self):
        super().__init__()
        self.timestamp_formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%m/%d/%Y %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
        ]
    
    def parse(self, file_path: str) -> List[TemperaturePoint]:
        """
        解析温度CSV文件
        
        期望的CSV格式：
        - 第一行为表头
        - 第一列为时间戳
        - 其他列为各层温度（列名为层名）
        
        示例：
        时间,上层,中层,下层
        2024-01-01 08:00:00,25.0,24.5,24.8
        2024-01-01 08:10:00,50.0,49.8,49.5
        """
        self.clear()
        
        if not self.validate_file(file_path):
            return []
        
        points: List[TemperaturePoint] = []
        layer_names: List[str] = []
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.reader(f)
                headers = next(reader, None)
                
                if not headers:
                    self.add_error("CSV文件为空")
                    return []
                
                if len(headers) < 2:
                    self.add_error("CSV文件需要至少两列：时间和温度数据")
                    return []
                
                layer_names = headers[1:]
                if not layer_names:
                    self.add_error("未找到温度数据列")
                    return []
                
                for row_num, row in enumerate(reader, start=2):
                    if not row or all(cell.strip() == '' for cell in row):
                        continue
                    
                    if len(row) != len(headers):
                        self.add_warning(f"第{row_num}行列数不匹配，跳过")
                        continue
                    
                    timestamp_str = row[0].strip()
                    if not timestamp_str:
                        self.add_warning(f"第{row_num}行时间为空，跳过")
                        continue
                    
                    timestamp = self._parse_timestamp(timestamp_str)
                    if timestamp is None:
                        self.add_warning(f"第{row_num}行时间格式无法解析: {timestamp_str}，跳过")
                        continue
                    
                    temperatures: Dict[str, float] = {}
                    valid_temperature = False
                    
                    for i, layer_name in enumerate(layer_names):
                        temp_str = row[i + 1].strip()
                        if not temp_str:
                            continue
                        
                        try:
                            temp = float(temp_str)
                            temperatures[layer_name] = temp
                            valid_temperature = True
                        except ValueError:
                            self.add_warning(f"第{row_num}行{layer_name}温度值无效: {temp_str}")
                            continue
                    
                    if valid_temperature:
                        point = TemperaturePoint(
                            timestamp=timestamp,
                            temperatures=temperatures
                        )
                        points.append(point)
        
        except csv.Error as e:
            self.add_error(f"CSV解析错误: {str(e)}")
            return []
        except Exception as e:
            self.add_error(f"文件读取错误: {str(e)}")
            return []
        
        if not points:
            self.add_warning("未解析到有效的温度数据点")
        
        return points
    
    def _parse_timestamp(self, timestamp_str: str) -> Optional[datetime]:
        """
        解析时间戳字符串，尝试多种格式
        
        Args:
            timestamp_str: 时间戳字符串
            
        Returns:
            解析成功的datetime对象，失败返回None
        """
        timestamp_str = timestamp_str.strip()
        
        for fmt in self.timestamp_formats:
            try:
                return datetime.strptime(timestamp_str, fmt)
            except ValueError:
                continue
        
        try:
            return datetime.fromisoformat(timestamp_str)
        except ValueError:
            pass
        
        return None
