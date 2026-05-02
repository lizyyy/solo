"""
日志解析模块
支持JSONL和CSV格式的埋点日志解析
"""

import json
import csv
import os
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from collections import defaultdict


class LogParseError(Exception):
    """日志解析错误"""
    pass


class LogValidator:
    """日志验证器"""
    
    REQUIRED_FIELDS = ['session_id', 'user_id', 'event', 'timestamp', 'page', 'props']
    
    @classmethod
    def validate_event(cls, event: Dict[str, Any], line_number: int = 0) -> Tuple[bool, List[str]]:
        """
        验证单个事件是否包含所有必需字段
        返回 (是否有效, 缺失字段列表)
        """
        missing_fields = []
        for field in cls.REQUIRED_FIELDS:
            if field not in event:
                missing_fields.append(field)
        
        return (len(missing_fields) == 0, missing_fields)
    
    @classmethod
    def parse_timestamp(cls, timestamp_value: Any) -> datetime:
        """
        解析时间戳，支持多种格式
        """
        if isinstance(timestamp_value, (int, float)):
            # 假设是Unix时间戳
            try:
                if timestamp_value > 1e12:
                    # 毫秒级
                    return datetime.fromtimestamp(timestamp_value / 1000.0)
                else:
                    # 秒级
                    return datetime.fromtimestamp(timestamp_value)
            except (ValueError, OSError):
                pass
        
        if isinstance(timestamp_value, str):
            # 尝试多种字符串格式
            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%dT%H:%M:%S.%f",
                "%Y/%m/%d %H:%M:%S",
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(timestamp_value, fmt)
                except ValueError:
                    continue
        
        raise ValueError(f"无法解析时间戳: {timestamp_value}")


class BaseParser:
    """解析器基类"""
    
    def __init__(self):
        self.errors = []
        self.valid_events = []
    
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        """解析文件，返回有效事件列表"""
        raise NotImplementedError("子类必须实现parse方法")
    
    def _add_error(self, line_number: int, message: str, raw_content: str = ""):
        """记录解析错误"""
        self.errors.append({
            "line_number": line_number,
            "message": message,
            "raw_content": raw_content
        })
    
    def get_errors(self) -> List[Dict[str, Any]]:
        """获取解析错误列表"""
        return self.errors


class JSONLParser(BaseParser):
    """JSONL格式解析器"""
    
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        """解析JSONL文件"""
        self.errors = []
        self.valid_events = []
        
        if not os.path.exists(file_path):
            raise LogParseError(f"文件不存在: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_number, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue  # 跳过空行
                
                try:
                    event = json.loads(line)
                except json.JSONDecodeError as e:
                    self._add_error(
                        line_number=line_number,
                        message=f"JSON解析错误: {str(e)}",
                        raw_content=line
                    )
                    continue
                
                # 验证必需字段
                is_valid, missing_fields = LogValidator.validate_event(event, line_number)
                if not is_valid:
                    self._add_error(
                        line_number=line_number,
                        message=f"缺少必需字段: {', '.join(missing_fields)}",
                        raw_content=line
                    )
                    continue
                
                # 解析时间戳
                try:
                    event['_parsed_timestamp'] = LogValidator.parse_timestamp(event['timestamp'])
                    event['_line_number'] = line_number
                except ValueError as e:
                    self._add_error(
                        line_number=line_number,
                        message=f"时间戳解析错误: {str(e)}",
                        raw_content=line
                    )
                    continue
                
                self.valid_events.append(event)
        
        return self.valid_events


class CSVParser(BaseParser):
    """CSV格式解析器"""
    
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        """解析CSV文件"""
        self.errors = []
        self.valid_events = []
        
        if not os.path.exists(file_path):
            raise LogParseError(f"文件不存在: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for line_number, row in enumerate(reader, 2):  # 行号从2开始，因为第1行是表头
                # 处理props字段，如果是字符串形式的JSON
                if 'props' in row and isinstance(row['props'], str):
                    try:
                        row['props'] = json.loads(row['props'])
                    except json.JSONDecodeError:
                        # 如果解析失败，保持为字符串或设为空字典
                        row['props'] = {}
                
                # 验证必需字段
                is_valid, missing_fields = LogValidator.validate_event(row, line_number)
                if not is_valid:
                    self._add_error(
                        line_number=line_number,
                        message=f"缺少必需字段: {', '.join(missing_fields)}",
                        raw_content=str(row)
                    )
                    continue
                
                # 解析时间戳
                try:
                    row['_parsed_timestamp'] = LogValidator.parse_timestamp(row['timestamp'])
                    row['_line_number'] = line_number
                except ValueError as e:
                    self._add_error(
                        line_number=line_number,
                        message=f"时间戳解析错误: {str(e)}",
                        raw_content=str(row)
                    )
                    continue
                
                self.valid_events.append(row)
        
        return self.valid_events


class LogParser:
    """统一日志解析器"""
    
    PARSERS = {
        '.jsonl': JSONLParser,
        '.csv': CSVParser,
    }
    
    @classmethod
    def get_parser(cls, file_path: str) -> BaseParser:
        """根据文件扩展名获取解析器"""
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext in cls.PARSERS:
            return cls.PARSERS[ext]()
        
        raise LogParseError(f"不支持的文件格式: {ext}，仅支持 .jsonl 和 .csv")
    
    @classmethod
    def parse_directory(cls, directory_path: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        解析目录中的所有日志文件
        返回 (有效事件列表, 错误列表)
        """
        all_events = []
        all_errors = []
        
        if not os.path.isdir(directory_path):
            raise LogParseError(f"不是有效的目录: {directory_path}")
        
        # 遍历目录中的所有文件
        for root, dirs, files in os.walk(directory_path):
            for filename in files:
                file_path = os.path.join(root, filename)
                ext = os.path.splitext(filename)[1].lower()
                
                if ext in cls.PARSERS:
                    try:
                        parser = cls.get_parser(file_path)
                        events = parser.parse(file_path)
                        all_events.extend(events)
                        all_errors.extend(parser.get_errors())
                    except LogParseError as e:
                        all_errors.append({
                            "line_number": 0,
                            "message": f"文件解析失败: {str(e)}",
                            "raw_content": file_path
                        })
        
        # 按时间戳排序
        all_events.sort(key=lambda x: x['_parsed_timestamp'])
        
        return all_events, all_errors
    
    @classmethod
    def parse_file(cls, file_path: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        解析单个日志文件
        返回 (有效事件列表, 错误列表)
        """
        parser = cls.get_parser(file_path)
        events = parser.parse(file_path)
        
        # 按时间戳排序
        events.sort(key=lambda x: x['_parsed_timestamp'])
        
        return events, parser.get_errors()
