"""
水表数据解析器
处理用户表和分区表数据
"""

from dataclasses import dataclass, field
from datetime import datetime, time
from typing import Dict, List, Optional
import csv


@dataclass
class MeterReading:
    """水表读数记录"""
    meter_id: str
    timestamp: datetime
    reading: float
    cumulative: float
    is_valid: bool = True
    gap_detected: bool = False


@dataclass
class Meter:
    """水表信息"""
    id: str
    name: str
    meter_type: str
    zone_id: Optional[str] = None
    is_inflow: bool = False
    readings: List[MeterReading] = field(default_factory=list)


class MetersParser:
    """水表数据解析器"""
    
    def __init__(self):
        self.meters: Dict[str, Meter] = {}
        self._date_format = "%Y-%m-%d %H:%M:%S"
    
    def parse(self, file_path: str) -> 'MetersParser':
        """解析CSV文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                self._process_row(row)
        
        self._sort_readings()
        return self
    
    def _process_row(self, row: Dict):
        """处理单行数据"""
        meter_id = str(row['meter_id'])
        
        if meter_id not in self.meters:
            self.meters[meter_id] = Meter(
                id=meter_id,
                name=row.get('meter_name', ''),
                meter_type=row.get('meter_type', 'user'),
                zone_id=row.get('zone_id'),
                is_inflow=row.get('is_inflow', 'false').lower() == 'true'
            )
        
        timestamp = datetime.strptime(row['timestamp'], self._date_format)
        reading = float(row['reading'])
        cumulative = float(row.get('cumulative', reading))
        
        meter_reading = MeterReading(
            meter_id=meter_id,
            timestamp=timestamp,
            reading=reading,
            cumulative=cumulative
        )
        
        self.meters[meter_id].readings.append(meter_reading)
    
    def _sort_readings(self):
        """按时间排序读数"""
        for meter in self.meters.values():
            meter.readings.sort(key=lambda x: x.timestamp)
    
    def validate(self) -> List[str]:
        """验证数据完整性"""
        errors = []
        
        for meter_id, meter in self.meters.items():
            if not meter.readings:
                errors.append(f"水表 {meter_id}: 没有读数记录")
                continue
            
            prev_reading = None
            for i, reading in enumerate(meter.readings):
                if reading.reading < 0:
                    errors.append(f"水表 {meter_id} 在 {reading.timestamp}: 读数为负数")
                
                if reading.cumulative < 0:
                    errors.append(f"水表 {meter_id} 在 {reading.timestamp}: 累计值为负数")
                
                if prev_reading:
                    if reading.timestamp < prev_reading.timestamp:
                        errors.append(f"水表 {meter_id}: 时间戳顺序异常")
                    
                    time_diff = (reading.timestamp - prev_reading.timestamp).total_seconds() / 3600
                    
                    if reading.cumulative < prev_reading.cumulative:
                        if self._is_midnight_rollover(reading.timestamp, prev_reading.timestamp):
                            pass
                        else:
                            errors.append(f"水表 {meter_id} 在 {reading.timestamp}: 累计值递减（非跨午夜情况）")
                    
                    consumption = reading.cumulative - prev_reading.cumulative
                    if consumption < 0 and not self._is_midnight_rollover(reading.timestamp, prev_reading.timestamp):
                        errors.append(f"水表 {meter_id} 在 {reading.timestamp}: 异常负用水量")
                
                prev_reading = reading
        
        return errors
    
    def _is_midnight_rollover(self, current: datetime, previous: datetime) -> bool:
        """检测是否为跨午夜读数"""
        prev_time = previous.time()
        curr_time = current.time()
        
        is_prev_late_night = time(23, 0) <= prev_time <= time(23, 59, 59)
        is_curr_early_morning = time(0, 0) <= curr_time <= time(5, 0)
        
        if is_prev_late_night and is_curr_early_morning:
            days_diff = (current.date() - previous.date()).days
            return days_diff == 1
        
        return False
    
    def get_zone_meters(self, zone_id: str) -> List[Meter]:
        """获取指定分区的所有水表"""
        return [m for m in self.meters.values() if m.zone_id == zone_id]
    
    def get_inflow_meters(self) -> List[Meter]:
        """获取所有入流表"""
        return [m for m in self.meters.values() if m.is_inflow]
    
    def get_user_meters(self) -> List[Meter]:
        """获取所有用户表"""
        return [m for m in self.meters.values() if m.meter_type == 'user' and not m.is_inflow]
