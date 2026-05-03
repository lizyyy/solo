"""数据解析器"""

import json
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from pathlib import Path

from .models import Booking, FaultRecord


class DataParser:
    """数据解析器"""
    
    DATETIME_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
    ]
    
    @staticmethod
    def parse_datetime(value: str) -> datetime:
        """解析日期时间字符串"""
        for fmt in DataParser.DATETIME_FORMATS:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        raise ValueError(f"无法解析日期时间格式: {value}")
    
    @staticmethod
    def parse_bookings(data: List[Dict[str, Any]]) -> List[Booking]:
        """解析预约数据"""
        bookings = []
        errors = []
        
        for idx, item in enumerate(data):
            try:
                booking = Booking(
                    id=str(item.get("id", f"booking_{idx}")),
                    instrument_id=str(item["instrument_id"]),
                    instrument_name=str(item.get("instrument_name", item["instrument_id"])),
                    user_id=str(item["user_id"]),
                    user_name=str(item.get("user_name", item["user_id"])),
                    start_time=DataParser.parse_datetime(item["start_time"]),
                    end_time=DataParser.parse_datetime(item["end_time"]),
                    purpose=str(item.get("purpose", "")),
                    notes=str(item.get("notes", ""))
                )
                
                if booking.start_time >= booking.end_time:
                    raise ValueError(f"开始时间 ({booking.start_time}) 必须早于结束时间 ({booking.end_time})")
                
                bookings.append(booking)
            except KeyError as e:
                errors.append(f"预约数据第 {idx+1} 条缺少必要字段: {e}")
            except ValueError as e:
                errors.append(f"预约数据第 {idx+1} 条格式错误: {e}")
        
        if errors:
            raise ValueError("\n".join(errors))
        
        return bookings
    
    @staticmethod
    def parse_faults(data: List[Dict[str, Any]]) -> List[FaultRecord]:
        """解析故障记录"""
        faults = []
        errors = []
        
        for idx, item in enumerate(data):
            try:
                fault = FaultRecord(
                    id=str(item.get("id", f"fault_{idx}")),
                    instrument_id=str(item["instrument_id"]),
                    instrument_name=str(item.get("instrument_name", item["instrument_id"])),
                    start_time=DataParser.parse_datetime(item["start_time"]),
                    end_time=DataParser.parse_datetime(item["end_time"]),
                    description=str(item["description"]),
                    reported_by=str(item.get("reported_by", "")),
                    severity=str(item.get("severity", "中"))
                )
                
                if fault.start_time >= fault.end_time:
                    raise ValueError(f"故障开始时间 ({fault.start_time}) 必须早于结束时间 ({fault.end_time})")
                
                faults.append(fault)
            except KeyError as e:
                errors.append(f"故障记录第 {idx+1} 条缺少必要字段: {e}")
            except ValueError as e:
                errors.append(f"故障记录第 {idx+1} 条格式错误: {e}")
        
        if errors:
            raise ValueError("\n".join(errors))
        
        return faults
    
    @staticmethod
    def load_json_file(file_path: str) -> Dict[str, Any]:
        """加载JSON文件"""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON格式错误: {e}")
    
    @classmethod
    def load_bookings_from_file(cls, file_path: str) -> List[Booking]:
        """从文件加载预约数据"""
        data = cls.load_json_file(file_path)
        
        if isinstance(data, list):
            bookings_list = data
        elif isinstance(data, dict) and "bookings" in data:
            bookings_list = data["bookings"]
        else:
            raise ValueError("无法识别的预约数据格式，应为数组或包含 'bookings' 字段的对象")
        
        return cls.parse_bookings(bookings_list)
    
    @classmethod
    def load_faults_from_file(cls, file_path: str) -> List[FaultRecord]:
        """从文件加载故障记录"""
        data = cls.load_json_file(file_path)
        
        if isinstance(data, list):
            faults_list = data
        elif isinstance(data, dict) and "faults" in data:
            faults_list = data["faults"]
        else:
            raise ValueError("无法识别的故障数据格式，应为数组或包含 'faults' 字段的对象")
        
        return cls.parse_faults(faults_list)
