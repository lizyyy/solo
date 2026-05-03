"""传感器分钟数据解析器"""
from pathlib import Path
from typing import Dict, List, Optional
import csv
from datetime import datetime, timedelta
import logging
from collections import defaultdict

import pandas as pd

from .base import BaseParser
from ..models import SensorReading, SensorData

logger = logging.getLogger(__name__)


class SensorParser(BaseParser):
    """传感器分钟数据CSV解析器"""
    
    REQUIRED_FIELDS = ['pool_id', 'timestamp', 'free_chlorine', 'ph', 'orp']
    
    def __init__(self, file_path: Path, pools: Dict[str, 'Pool'] = None):
        super().__init__(file_path)
        self.pools = pools or {}
        self.sensor_data: Dict[str, SensorData] = {}
    
    def parse(self) -> Dict[str, SensorData]:
        """解析sensor_minutes.csv文件"""
        logger.info(f"解析传感器数据文件: {self.file_path}")
        
        if not self.file_path.exists():
            self.add_error(f"文件不存在: {self.file_path}")
            return {}
        
        try:
            df = pd.read_csv(self.file_path, parse_dates=['timestamp'])
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df = df.sort_values(['pool_id', 'timestamp'])
            
            readings_by_pool = defaultdict(list)
            
            for _, row in df.iterrows():
                try:
                    reading = self._parse_row(row)
                    if reading:
                        readings_by_pool[reading.pool_id].append(reading)
                except Exception as e:
                    self.add_warning(f"行解析失败: {str(e)}")
            
            for pool_id, readings in readings_by_pool.items():
                self.sensor_data[pool_id] = SensorData(
                    pool_id=pool_id,
                    readings=readings
                )
        
        except Exception as e:
            self.add_error(f"文件解析失败: {str(e)}")
        
        return self.sensor_data
    
    def _parse_row(self, row: pd.Series) -> Optional[SensorReading]:
        """解析单行数据"""
        pool_id = str(row.get('pool_id', '')).strip()
        if not pool_id:
            return None
        
        try:
            timestamp = pd.Timestamp(row['timestamp']).to_pydatetime()
            if timestamp.tzinfo is not None:
                timestamp = timestamp.replace(tzinfo=None)
        except (ValueError, TypeError):
            return None
        
        try:
            free_chlorine = float(row.get('free_chlorine')) if pd.notna(row.get('free_chlorine')) else None
        except (ValueError, TypeError):
            free_chlorine = None
        
        try:
            ph = float(row.get('ph')) if pd.notna(row.get('ph')) else None
        except (ValueError, TypeError):
            ph = None
        
        try:
            orp = float(row.get('orp')) if pd.notna(row.get('orp')) else None
        except (ValueError, TypeError):
            orp = None
        
        return SensorReading(
            pool_id=pool_id,
            timestamp=timestamp,
            free_chlorine=free_chlorine,
            ph=ph,
            orp=orp
        )
    
    def validate(self) -> bool:
        """验证传感器数据"""
        if not self.sensor_data:
            self.add_error("没有有效的传感器数据")
            return False
        
        for pool_id, data in self.sensor_data.items():
            if self.pools and pool_id not in self.pools:
                self.add_warning(f"传感器数据中的泳池 {pool_id} 不在泳池配置中")
            
            if not data.readings:
                self.add_warning(f"泳池 {pool_id} 没有传感器读数")
            else:
                self._check_data_gaps(data)
        
        return not self.has_errors()
    
    def _check_data_gaps(self, data: SensorData):
        """检查数据断采情况"""
        readings = sorted(data.readings, key=lambda x: x.timestamp)
        
        if len(readings) < 2:
            return
        
        gaps = []
        prev_time = readings[0].timestamp
        
        for reading in readings[1:]:
            gap = reading.timestamp - prev_time
            if gap > timedelta(minutes=5):
                gaps.append({
                    'start': prev_time,
                    'end': reading.timestamp,
                    'duration': gap
                })
            prev_time = reading.timestamp
        
        if gaps:
            for gap in gaps:
                self.add_warning(
                    f"泳池 {data.pool_id} 数据断采: "
                    f"{gap['start']} 至 {gap['end']}, "
                    f"时长 {gap['duration']}"
                )
    
    def get_sensor_data(self) -> Dict[str, SensorData]:
        """获取解析后的传感器数据"""
        return self.sensor_data.copy()
