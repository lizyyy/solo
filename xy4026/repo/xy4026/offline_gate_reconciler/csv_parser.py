"""CSV 解析模块"""
import csv
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, Generic, List, Optional, Tuple, TypeVar
from pydantic import BaseModel, Field, ValidationError

T = TypeVar("T")


class ScanAction(str, Enum):
    """扫码动作类型"""
    ENTRY = "entry"
    EXIT = "exit"
    REENTRY = "reentry"


class TicketRosterEntry(BaseModel):
    """票务名单条目"""
    ticket_number: str = Field(..., description="票号")
    name: str = Field(..., description="姓名")
    phone_last_four: str = Field(..., description="手机号后四位")
    ticket_type: str = Field(..., description="票种")
    allowed_entries: List[str] = Field(default_factory=list, description="允许入口列表")
    is_blacklisted: bool = Field(default=False, description="是否为黑名单")
    
    @classmethod
    def from_csv_row(cls, row: Dict[str, str], line_number: int) -> Tuple[Optional["TicketRosterEntry"], Optional[str]]:
        """
        从 CSV 行创建票务条目
        
        Args:
            row: CSV 行字典
            line_number: 行号（用于错误报告）
            
        Returns:
            (条目, 错误信息)，如果解析成功则错误信息为 None
        """
        try:
            # 处理字段映射（支持常见的列名变体）
            ticket_number = cls._get_field(row, ["票号", "ticket_number", "ticketNo", "ticket_no"])
            name = cls._get_field(row, ["姓名", "name", "customer_name"])
            phone_last_four = cls._get_field(row, ["手机号后四位", "phone_last_four", "phone", "mobile"])
            ticket_type = cls._get_field(row, ["票种", "ticket_type", "type", "ticketType"])
            
            # 允许入口（可能是逗号分隔的字符串）
            allowed_entries_str = cls._get_field(row, ["允许入口", "allowed_entries", "entries", "gates"], default="")
            allowed_entries = [e.strip() for e in allowed_entries_str.split(",") if e.strip()] if allowed_entries_str else []
            
            # 黑名单标志
            is_blacklisted_str = cls._get_field(row, ["是否黑名单", "is_blacklisted", "blacklisted", "黑名单"], default="")
            is_blacklisted = cls._parse_boolean(is_blacklisted_str)
            
            # 验证必填字段
            if not ticket_number:
                return None, f"第 {line_number} 行：缺少票号"
            if not name:
                return None, f"第 {line_number} 行：缺少姓名"
            if not phone_last_four:
                return None, f"第 {line_number} 行：缺少手机号后四位"
            if not ticket_type:
                return None, f"第 {line_number} 行：缺少票种"
            
            # 确保手机号后四位是4位数字
            if len(phone_last_four) != 4 or not phone_last_four.isdigit():
                return None, f"第 {line_number} 行：手机号后四位格式错误，应为4位数字"
            
            return cls(
                ticket_number=ticket_number.strip(),
                name=name.strip(),
                phone_last_four=phone_last_four.strip(),
                ticket_type=ticket_type.strip(),
                allowed_entries=allowed_entries,
                is_blacklisted=is_blacklisted,
            ), None
            
        except Exception as e:
            return None, f"第 {line_number} 行：解析错误 - {str(e)}"
    
    @staticmethod
    def _get_field(row: Dict[str, str], possible_keys: List[str], default: str = "") -> str:
        """从多种可能的列名中获取字段值"""
        for key in possible_keys:
            if key in row:
                value = row[key].strip()
                if value:
                    return value
            # 尝试不区分大小写的匹配
            for row_key in row.keys():
                if row_key.lower() == key.lower():
                    value = row[row_key].strip()
                    if value:
                        return value
        return default
    
    @staticmethod
    def _parse_boolean(value: str) -> bool:
        """解析布尔值"""
        if not value:
            return False
        value_lower = value.lower().strip()
        return value_lower in ["是", "yes", "true", "1", "y", "黑名单"]


class ScanLogEntry(BaseModel):
    """扫码日志条目"""
    device_id: str = Field(..., description="设备号")
    entry: str = Field(..., description="入口")
    timestamp: datetime = Field(..., description="时间戳")
    ticket_number: str = Field(..., description="票号")
    action: ScanAction = Field(..., description="动作类型")
    operator: str = Field(..., description="操作员")
    
    # 原始行数据（用于隔离区）
    raw_data: Optional[Dict] = Field(default=None, description="原始行数据")
    line_number: Optional[int] = Field(default=None, description="原始行号")
    source_file: Optional[str] = Field(default=None, description="源文件名")
    
    @classmethod
    def from_csv_row(
        cls, 
        row: Dict[str, str], 
        line_number: int, 
        source_file: str
    ) -> Tuple[Optional["ScanLogEntry"], Optional[str]]:
        """
        从 CSV 行创建扫码日志条目
        
        Args:
            row: CSV 行字典
            line_number: 行号
            source_file: 源文件名
            
        Returns:
            (条目, 错误信息)
        """
        try:
            # 保存原始数据
            raw_data = row.copy()
            
            # 解析设备号
            device_id = cls._get_field(row, ["设备号", "device_id", "deviceId", "device"])
            if not device_id:
                return None, f"第 {line_number} 行：缺少设备号"
            
            # 解析入口
            entry = cls._get_field(row, ["入口", "entry", "gate", "入口号"])
            if not entry:
                return None, f"第 {line_number} 行：缺少入口"
            
            # 解析时间戳
            timestamp_str = cls._get_field(row, ["时间戳", "timestamp", "时间", "datetime", "scan_time"])
            if not timestamp_str:
                return None, f"第 {line_number} 行：缺少时间戳"
            
            timestamp = cls._parse_timestamp(timestamp_str)
            if timestamp is None:
                return None, f"第 {line_number} 行：时间戳格式错误 - {timestamp_str}"
            
            # 解析票号
            ticket_number = cls._get_field(row, ["票号", "ticket_number", "ticketNo", "ticket"])
            if not ticket_number:
                return None, f"第 {line_number} 行：缺少票号"
            
            # 解析动作
            action_str = cls._get_field(row, ["动作", "action", "类型", "type"])
            if not action_str:
                return None, f"第 {line_number} 行：缺少动作类型"
            
            action = cls._parse_action(action_str)
            if action is None:
                return None, f"第 {line_number} 行：未知动作类型 - {action_str}"
            
            # 解析操作员
            operator = cls._get_field(row, ["操作员", "operator", "staff", "操作人"], default="未知")
            
            return cls(
                device_id=device_id.strip(),
                entry=entry.strip(),
                timestamp=timestamp,
                ticket_number=ticket_number.strip(),
                action=action,
                operator=operator.strip(),
                raw_data=raw_data,
                line_number=line_number,
                source_file=source_file,
            ), None
            
        except Exception as e:
            return None, f"第 {line_number} 行：解析错误 - {str(e)}"
    
    @staticmethod
    def _get_field(row: Dict[str, str], possible_keys: List[str], default: str = "") -> str:
        """从多种可能的列名中获取字段值"""
        for key in possible_keys:
            if key in row:
                value = row[key].strip()
                if value:
                    return value
            # 尝试不区分大小写的匹配
            for row_key in row.keys():
                if row_key.lower() == key.lower():
                    value = row[row_key].strip()
                    if value:
                        return value
        return default
    
    @staticmethod
    def _parse_timestamp(value: str) -> Optional[datetime]:
        """解析时间戳，支持多种格式"""
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%d-%m-%Y %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%Y%m%d%H%M%S",
            "%Y%m%d %H%M%S",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value.strip(), fmt)
            except ValueError:
                continue
        
        # 尝试 Unix 时间戳
        try:
            ts = float(value)
            if ts > 1e12:  # 毫秒级
                return datetime.fromtimestamp(ts / 1000)
            return datetime.fromtimestamp(ts)
        except (ValueError, OSError):
            pass
        
        return None
    
    @staticmethod
    def _parse_action(value: str) -> Optional[ScanAction]:
        """解析动作类型"""
        value_lower = value.lower().strip()
        
        action_map = {
            "entry": ScanAction.ENTRY,
            "入场": ScanAction.ENTRY,
            "进场": ScanAction.ENTRY,
            "进入": ScanAction.ENTRY,
            "exit": ScanAction.EXIT,
            "退场": ScanAction.EXIT,
            "离场": ScanAction.EXIT,
            "离开": ScanAction.EXIT,
            "reentry": ScanAction.REENTRY,
            "二次入场": ScanAction.REENTRY,
            "再次入场": ScanAction.REENTRY,
            "二次进入": ScanAction.REENTRY,
        }
        
        return action_map.get(value_lower)


@dataclass
class ParseResult(Generic[T]):
    """解析结果"""
    success_entries: List[T]
    failed_rows: List[Tuple[int, str, Dict]]  # (行号, 错误信息, 原始数据)
    total_rows: int
    
    @property
    def success_count(self) -> int:
        return len(self.success_entries)
    
    @property
    def failed_count(self) -> int:
        return len(self.failed_rows)


class CSVParser:
    """CSV 解析器"""
    
    def parse_roster(self, file_path: Path) -> ParseResult[TicketRosterEntry]:
        """
        解析票务名单 CSV
        
        Args:
            file_path: CSV 文件路径
            
        Returns:
            解析结果
        """
        success_entries: List[TicketRosterEntry] = []
        failed_rows: List[Tuple[int, str, Dict]] = []
        total_rows = 0
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            
            for line_number, row in enumerate(reader, start=2):  # 从第2行开始（跳过表头）
                total_rows += 1
                
                entry, error = TicketRosterEntry.from_csv_row(row, line_number)
                
                if entry:
                    success_entries.append(entry)
                else:
                    failed_rows.append((line_number, error or "未知错误", row))
        
        return ParseResult(
            success_entries=success_entries,
            failed_rows=failed_rows,
            total_rows=total_rows,
        )
    
    def parse_scan_log(self, file_path: Path) -> ParseResult[ScanLogEntry]:
        """
        解析扫码日志 CSV
        
        Args:
            file_path: CSV 文件路径
            
        Returns:
            解析结果
        """
        success_entries: List[ScanLogEntry] = []
        failed_rows: List[Tuple[int, str, Dict]] = []
        total_rows = 0
        
        source_file = file_path.name
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            
            for line_number, row in enumerate(reader, start=2):  # 从第2行开始
                total_rows += 1
                
                entry, error = ScanLogEntry.from_csv_row(row, line_number, source_file)
                
                if entry:
                    success_entries.append(entry)
                else:
                    failed_rows.append((line_number, error or "未知错误", row))
        
        return ParseResult(
            success_entries=success_entries,
            failed_rows=failed_rows,
            total_rows=total_rows,
        )
    
    def parse_multiple_scan_logs(self, file_paths: List[Path]) -> ParseResult[ScanLogEntry]:
        """
        解析多个扫码日志文件
        
        Args:
            file_paths: CSV 文件路径列表
            
        Returns:
            合并后的解析结果
        """
        all_success: List[ScanLogEntry] = []
        all_failed: List[Tuple[int, str, Dict]] = []
        total_rows = 0
        
        for file_path in file_paths:
            result = self.parse_scan_log(file_path)
            all_success.extend(result.success_entries)
            all_failed.extend(result.failed_rows)
            total_rows += result.total_rows
        
        return ParseResult(
            success_entries=all_success,
            failed_rows=all_failed,
            total_rows=total_rows,
        )
