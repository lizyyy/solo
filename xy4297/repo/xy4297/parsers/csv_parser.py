"""
温度CSV文件解析器
"""

import csv
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Iterator
from collections import defaultdict

from config import Config


class TemperatureReading:
    """
    温度读数数据类
    """
    def __init__(
        self,
        timestamp: datetime,
        temperature: float,
        sensor_id: Optional[str] = None,
        raw_value: Optional[str] = None,
    ):
        self.timestamp = timestamp
        self.temperature = temperature
        self.sensor_id = sensor_id
        self.raw_value = raw_value

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "temperature": self.temperature,
            "sensor_id": self.sensor_id,
            "temperature_str": f"{self.temperature:.2f}",
        }

    def is_over_threshold(self, max_temp: float = None) -> bool:
        max_temp = max_temp or Config.TEMP_THRESHOLD_MAX
        return self.temperature > max_temp

    def is_under_threshold(self, min_temp: float = None) -> bool:
        min_temp = min_temp or Config.TEMP_THRESHOLD_MIN
        return self.temperature < min_temp

    def is_out_of_bounds(
        self, min_temp: float = None, max_temp: float = None
    ) -> bool:
        return self.is_over_threshold(max_temp) or self.is_under_threshold(min_temp)


class TemperatureCSVParser:
    """
    温度CSV文件解析器
    """

    TEMPERATURE_COLUMNS = [
        "温度",
        "Temperature",
        "温度(°C)",
        "Temp",
        "Value",
        "读数",
    ]
    
    TIME_COLUMNS = [
        "时间",
        "Time",
        "日期时间",
        "DateTime",
        "Timestamp",
        "记录时间",
    ]
    
    SENSOR_COLUMNS = [
        "传感器",
        "Sensor",
        "设备",
        "Device",
        "ID",
        "编号",
    ]

    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.parsed_files: List[Dict[str, Any]] = []
        self.all_readings: List[TemperatureReading] = []
        self.sensor_readings: Dict[str, List[TemperatureReading]] = defaultdict(list)

    def parse_file(self, file_path: Path) -> List[TemperatureReading]:
        """
        解析单个温度CSV文件
        """
        readings = []
        file_meta = {
            "file_name": file_path.name,
            "file_path": str(file_path),
            "total_rows": 0,
            "valid_rows": 0,
            "start_time": None,
            "end_time": None,
            "sensors": set(),
        }

        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                content = f.read()
                
            dialect = csv.Sniffer().sniff(content[:1024]) if content else csv.excel
            reader = csv.DictReader(content.splitlines(), dialect=dialect)
            
            if not reader.fieldnames:
                return readings
            
            temp_col = self._find_column(reader.fieldnames, self.TEMPERATURE_COLUMNS)
            time_col = self._find_column(reader.fieldnames, self.TIME_COLUMNS)
            sensor_col = self._find_column(reader.fieldnames, self.SENSOR_COLUMNS)
            
            if not temp_col or not time_col:
                temp_col, time_col = self._guess_columns(reader.fieldnames)
                if not temp_col or not time_col:
                    return readings
            
            for row in reader:
                file_meta["total_rows"] += 1
                
                try:
                    temp_value = self._parse_temperature(row[temp_col])
                    if temp_value is None:
                        continue
                        
                    timestamp = self._parse_timestamp(row[time_col])
                    if timestamp is None:
                        continue
                        
                    sensor_id = row[sensor_col] if sensor_col and sensor_col in row else None
                    
                    reading = TemperatureReading(
                        timestamp=timestamp,
                        temperature=temp_value,
                        sensor_id=sensor_id,
                        raw_value=row.get(temp_col),
                    )
                    
                    readings.append(reading)
                    self.all_readings.append(reading)
                    
                    if sensor_id:
                        self.sensor_readings[sensor_id].append(reading)
                        file_meta["sensors"].add(sensor_id)
                        
                    file_meta["valid_rows"] += 1
                    
                    if file_meta["start_time"] is None or timestamp < file_meta["start_time"]:
                        file_meta["start_time"] = timestamp
                    if file_meta["end_time"] is None or timestamp > file_meta["end_time"]:
                        file_meta["end_time"] = timestamp
                        
                except (ValueError, KeyError):
                    continue
                    
        except Exception as e:
            print(f"解析文件 {file_path} 时出错: {e}")
            return readings
            
        file_meta["sensors"] = list(file_meta["sensors"])
        self.parsed_files.append(file_meta)
        
        return readings

    def parse_directory(self, directory: Path) -> List[TemperatureReading]:
        """
        解析目录下所有温度CSV文件
        """
        all_readings = []
        
        csv_files = []
        for ext in self.config.TEMP_CSV_EXTENSIONS:
            csv_files.extend(directory.glob(f"**/*{ext}"))
            
        for file_path in sorted(csv_files):
            readings = self.parse_file(file_path)
            all_readings.extend(readings)
            
        return all_readings

    def _find_column(self, fieldnames: List[str], candidates: List[str]) -> Optional[str]:
        """
        在字段名中查找匹配的列
        """
        fieldnames_lower = [fn.lower().strip() for fn in fieldnames]
        
        for candidate in candidates:
            candidate_lower = candidate.lower()
            for i, fn in enumerate(fieldnames_lower):
                if candidate_lower in fn or fn in candidate_lower:
                    return fieldnames[i]
        return None

    def _guess_columns(self, fieldnames: List[str]) -> tuple:
        """
        猜测温度和时间列
        """
        time_col = None
        temp_col = None
        
        for fn in fieldnames:
            fn_lower = fn.lower()
            if any(kw in fn_lower for kw in ["time", "date", "时间", "日期"]):
                time_col = fn
            elif any(kw in fn_lower for kw in ["temp", "温度", "value", "读数"]):
                temp_col = fn
                
        return temp_col, time_col

    def _parse_temperature(self, value: str) -> Optional[float]:
        """
        解析温度值
        """
        if not value or value.strip() == "":
            return None
            
        value = str(value).strip()
        value = value.replace("°C", "").replace("℃", "").replace("°", "")
        value = value.replace(",", ".").strip()
        
        try:
            return float(value)
        except ValueError:
            return None

    def _parse_timestamp(self, value: str) -> Optional[datetime]:
        """
        解析时间戳
        """
        if not value or value.strip() == "":
            return None
            
        value = str(value).strip()
        
        for fmt in self.config.CSV_DATE_FORMATS:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
                
        try:
            import dateutil.parser
            return dateutil.parser.parse(value)
        except (ImportError, ValueError):
            pass
            
        return None

    def get_readings_by_date(self, date: datetime.date) -> List[TemperatureReading]:
        """
        获取指定日期的所有读数
        """
        return [
            r for r in self.all_readings 
            if r.timestamp.date() == date
        ]

    def get_readings_by_hour(self, date: datetime.date, hour: int) -> List[TemperatureReading]:
        """
        获取指定日期指定小时的读数
        """
        return [
            r for r in self.all_readings
            if r.timestamp.date() == date and r.timestamp.hour == hour
        ]

    def get_date_range(self) -> Optional[tuple]:
        """
        获取数据日期范围
        """
        if not self.all_readings:
            return None
            
        sorted_readings = sorted(self.all_readings, key=lambda r: r.timestamp)
        return sorted_readings[0].timestamp, sorted_readings[-1].timestamp

    def get_stats(self) -> Dict[str, Any]:
        """
        获取解析统计信息
        """
        if not self.all_readings:
            return {
                "total_readings": 0,
                "files_parsed": len(self.parsed_files),
                "date_range": None,
                "sensors": [],
            }
            
        temps = [r.temperature for r in self.all_readings]
        
        return {
            "total_readings": len(self.all_readings),
            "files_parsed": len(self.parsed_files),
            "date_range": self.get_date_range(),
            "min_temp": min(temps),
            "max_temp": max(temps),
            "avg_temp": sum(temps) / len(temps),
            "sensors": list(self.sensor_readings.keys()),
            "files": self.parsed_files,
        }
