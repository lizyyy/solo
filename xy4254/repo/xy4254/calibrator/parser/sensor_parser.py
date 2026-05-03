"""
传感器数据解析器 - 解析传感器CSV数据文件
"""

import pandas as pd
from datetime import datetime
from typing import Dict, List, Optional


class SensorParser:
    """解析传感器CSV数据"""
    
    REQUIRED_COLUMNS = ['timestamp', 'tray_id', 'light_intensity', 'moisture', 'temperature', 'humidity']
    
    def __init__(self):
        self.data: Optional[pd.DataFrame] = None
        self.tray_ids: List[str] = []
    
    def parse(self, file_path: str) -> pd.DataFrame:
        """
        解析传感器CSV文件
        
        Args:
            file_path: CSV文件路径
            
        Returns:
            解析后的DataFrame
            
        Raises:
            ValueError: 如果文件格式不正确
        """
        try:
            self.data = pd.read_csv(file_path)
            self._validate_columns()
            self._convert_data_types()
            self.tray_ids = sorted(self.data['tray_id'].unique().tolist())
            return self.data
        except pd.errors.EmptyDataError:
            raise ValueError(f"传感器文件 {file_path} 为空")
        except Exception as e:
            raise ValueError(f"解析传感器文件 {file_path} 失败: {str(e)}")
    
    def _validate_columns(self):
        """验证必需的列是否存在"""
        missing = set(self.REQUIRED_COLUMNS) - set(self.data.columns)
        if missing:
            raise ValueError(f"传感器CSV缺少必需列: {', '.join(missing)}")
    
    def _convert_data_types(self):
        """转换数据类型"""
        self.data['timestamp'] = pd.to_datetime(self.data['timestamp'])
        self.data['light_intensity'] = pd.to_numeric(self.data['light_intensity'], errors='coerce')
        self.data['moisture'] = pd.to_numeric(self.data['moisture'], errors='coerce')
        self.data['temperature'] = pd.to_numeric(self.data['temperature'], errors='coerce')
        self.data['humidity'] = pd.to_numeric(self.data['humidity'], errors='coerce')
    
    def get_tray_data(self, tray_id: str) -> pd.DataFrame:
        """
        获取指定苗盘的传感器数据
        
        Args:
            tray_id: 苗盘ID
            
        Returns:
            该苗盘的所有传感器数据
        """
        if self.data is None:
            raise ValueError("尚未解析任何数据")
        return self.data[self.data['tray_id'] == tray_id].copy()
    
    def get_summary(self) -> Dict:
        """
        获取数据摘要信息
        
        Returns:
            包含统计信息的字典
        """
        if self.data is None:
            return {}
        
        return {
            'total_records': len(self.data),
            'tray_count': len(self.tray_ids),
            'tray_ids': self.tray_ids,
            'date_range': {
                'start': self.data['timestamp'].min().isoformat(),
                'end': self.data['timestamp'].max().isoformat()
            },
            'sensor_stats': {
                'light': {
                    'mean': float(self.data['light_intensity'].mean()),
                    'min': float(self.data['light_intensity'].min()),
                    'max': float(self.data['light_intensity'].max())
                },
                'moisture': {
                    'mean': float(self.data['moisture'].mean()),
                    'min': float(self.data['moisture'].min()),
                    'max': float(self.data['moisture'].max())
                },
                'temperature': {
                    'mean': float(self.data['temperature'].mean()),
                    'min': float(self.data['temperature'].min()),
                    'max': float(self.data['temperature'].max())
                }
            }
        }
