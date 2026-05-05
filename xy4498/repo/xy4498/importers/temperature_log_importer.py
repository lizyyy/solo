import pandas as pd
import numpy as np
from typing import List, Optional, Dict, Any
import uuid
import json

from models import TemperatureLog


class TemperatureLogImporter:
    """温度日志导入器"""
    
    SUPPORTED_FORMATS = ['csv', 'json', 'excel']
    
    def __init__(self):
        self.logs: List[TemperatureLog] = []
        self.errors: List[str] = []
    
    def import_from_file(self, file_path: str, format_type: Optional[str] = None, 
                         time_column: str = 'time', 
                         temp_column: str = 'temperature',
                         zone_column: Optional[str] = None) -> List[TemperatureLog]:
        """
        从文件导入温度日志
        
        Args:
            file_path: 文件路径
            format_type: 文件格式，默认自动检测
            time_column: 时间列名
            temp_column: 温度列名
            zone_column: 测温区域列名（可选）
        
        Returns:
            温度日志列表
        """
        self.logs = []
        self.errors = []
        
        if format_type is None:
            format_type = self._detect_format(file_path)
        
        if format_type not in self.SUPPORTED_FORMATS:
            raise ValueError(f"不支持的文件格式: {format_type}")
        
        try:
            if format_type == 'csv':
                df = pd.read_csv(file_path)
            elif format_type == 'json':
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if isinstance(data, list):
                    df = pd.DataFrame(data)
                elif isinstance(data, dict) and 'logs' in data:
                    df = pd.DataFrame(data['logs'])
                else:
                    raise ValueError("JSON格式不正确")
            elif format_type == 'excel':
                df = pd.read_excel(file_path)
            
            self._parse_dataframe(df, time_column, temp_column, zone_column)
            
        except Exception as e:
            self.errors.append(f"导入文件失败: {str(e)}")
            raise
        
        return self.logs
    
    def _detect_format(self, file_path: str) -> str:
        """检测文件格式"""
        if file_path.endswith('.csv'):
            return 'csv'
        elif file_path.endswith('.json'):
            return 'json'
        elif file_path.endswith(('.xlsx', '.xls')):
            return 'excel'
        else:
            raise ValueError(f"无法检测文件格式: {file_path}")
    
    def _parse_dataframe(self, df: pd.DataFrame, time_column: str, 
                         temp_column: str, zone_column: Optional[str]):
        """解析DataFrame为温度日志"""
        required_columns = [time_column, temp_column]
        for col in required_columns:
            if col not in df.columns:
                raise ValueError(f"缺少必要列 '{col}' 不存在于数据中")
        
        for idx, row in df.iterrows():
            try:
                time_val = row[time_column]
                temp_val = row[temp_column]
                
                if pd.isna(time_val) or pd.isna(temp_val):
                    self.errors.append(f"跳过第 {idx+1} 行: 时间或温度值为空")
                    continue
                
                time_val = float(time_val)
                temp_val = float(temp_val)
                
                zone = None
                if zone_column and zone_column in df.columns:
                    zone = str(row[zone_column]) if not pd.isna(row[zone_column]) else None
                
                log = TemperatureLog(
                    id=str(uuid.uuid4()),
                    time=time_val,
                    temperature=temp_val,
                    zone=zone
                )
                self.logs.append(log)
                
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 行失败: {str(e)}")
        
        self.logs.sort(key=lambda x: x.time)
    
    def import_from_list(self, data: List[Dict[str, Any]], 
                       time_key: str = 'time', 
                       temp_key: str = 'temperature',
                       zone_key: Optional[str] = None) -> List[TemperatureLog]:
        """从字典列表导入温度日志"""
        self.logs = []
        self.errors = []
        
        for idx, item in enumerate(data):
            try:
                if time_key not in item or temp_key not in item:
                    self.errors.append(f"跳过第 {idx+1} 项: 缺少时间或温度")
                    continue
                
                time_val = float(item[time_key])
                temp_val = float(item[temp_key])
                
                zone = None
                if zone_key and zone_key in item:
                    zone = str(item[zone_key]) if item[zone_key] else None
                
                log = TemperatureLog(
                    id=str(uuid.uuid4()),
                    time=time_val,
                    temperature=temp_val,
                    zone=zone
                )
                self.logs.append(log)
                
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 项失败: {str(e)}")
        
        self.logs.sort(key=lambda x: x.time)
        return self.logs
    
    def get_errors(self) -> List[str]:
        """获取导入错误"""
        return self.errors
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取温度日志统计信息"""
        if not self.logs:
            return {
                'count': 0,
                'min_temp': None,
                'max_temp': None,
                'min_time': None,
                'max_time': None,
                'zones': []
            }
        
        temps = [log.temperature for log in self.logs]
        times = [log.time for log in self.logs]
        zones = list(set(log.zone for log in self.logs if log.zone))
        
        return {
            'count': len(self.logs),
            'min_temp': min(temps),
            'max_temp': max(temps),
            'avg_temp': sum(temps) / len(temps),
            'min_time': min(times),
            'max_time': max(times),
            'total_duration': max(times) - min(times),
            'zones': zones
        }
