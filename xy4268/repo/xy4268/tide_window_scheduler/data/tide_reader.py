"""
潮汐表 CSV 读取器
"""
import csv
from datetime import datetime
from typing import List

from ..models import TidalRecord


class TideReader:
    """潮汐表读取器"""
    
    @staticmethod
    def read_csv(file_path: str) -> List[TidalRecord]:
        """
        读取潮汐表 CSV 文件
        
        CSV 格式要求：
        - 第一行：表头，包含 'time' 和 'height' 列
        - time 格式：YYYY-MM-DD HH:MM 或 YYYY/MM/DD HH:MM
        - height 格式：数字，单位为米
        
        Args:
            file_path: CSV 文件路径
            
        Returns:
            潮汐记录列表，按时间排序
        """
        records = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                # 尝试多种时间格式
                time_str = row.get('time', row.get('Time', row.get('TIME', '')))
                height_str = row.get('height', row.get('Height', row.get('HEIGHT', '0')))
                
                # 解析时间
                try:
                    # 尝试 YYYY-MM-DD HH:MM 格式
                    time_val = datetime.strptime(time_str, '%Y-%m-%d %H:%M')
                except ValueError:
                    try:
                        # 尝试 YYYY/MM/DD HH:MM 格式
                        time_val = datetime.strptime(time_str, '%Y/%m/%d %H:%M')
                    except ValueError:
                        # 尝试 YYYY-MM-DD HH:MM:SS 格式
                        try:
                            time_val = datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S')
                        except ValueError:
                            # 尝试 YYYY/MM/DD HH:MM:SS 格式
                            try:
                                time_val = datetime.strptime(time_str, '%Y/%m/%d %H:%M:%S')
                            except ValueError:
                                raise ValueError(f"无法解析时间格式: {time_str}")
                
                # 解析潮高
                try:
                    height_val = float(height_str)
                except ValueError:
                    raise ValueError(f"无法解析潮高值: {height_str}")
                
                records.append(TidalRecord(time=time_val, height=height_val))
        
        # 按时间排序
        records.sort(key=lambda r: r.time)
        
        return records
