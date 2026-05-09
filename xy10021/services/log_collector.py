import re
import json
from abc import ABC, abstractmethod
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from database import LogSource, LogEntry


class LogCollector(ABC):
    
    @abstractmethod
    def collect(self, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        pass


class FileLogCollector(LogCollector):
    
    def __init__(self, db: Session):
        self.db = db
    
    def collect(self, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        file_path = config.get("file_path")
        if not file_path:
            raise ValueError("缺少 file_path 配置")
        
        log_pattern = config.get("log_pattern", r'(?P<time>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(?P<level>[A-Z]+)\s+(?P<module>[\w\.]+)\s*[-:]\s*(?P<message>.+)')
        time_format = config.get("time_format", "%Y-%m-%d %H:%M:%S")
        
        logs = []
        pattern = re.compile(log_pattern)
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    
                    match = pattern.match(line)
                    if match:
                        groups = match.groupdict()
                        log_time = datetime.strptime(groups.get('time'), time_format)
                        logs.append({
                            "log_time": log_time,
                            "log_level": groups.get('level', 'INFO'),
                            "module": groups.get('module'),
                            "message": groups.get('message'),
                            "trace_id": None,
                            "extra_data": None
                        })
        except Exception as e:
            raise Exception(f"读取日志文件失败: {str(e)}")
        
        return logs


class DatabaseLogCollector(LogCollector):
    
    def __init__(self, db: Session):
        self.db = db
    
    def collect(self, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        db_url = config.get("db_url")
        table_name = config.get("table_name")
        query = config.get("query")
        
        if not (db_url and table_name and query):
            raise ValueError("缺少数据库配置参数")
        
        try:
            from sqlalchemy import create_engine, text
            engine = create_engine(db_url)
            with engine.connect() as conn:
                result = conn.execute(text(query))
                columns = result.keys()
                
                logs = []
                for row in result.fetchall():
                    row_dict = dict(zip(columns, row))
                    
                    log_time_str = str(row_dict.get('log_time') or row_dict.get('time') or datetime.now())
                    try:
                        log_time = datetime.fromisoformat(log_time_str)
                    except:
                        log_time = datetime.now()
                    
                    logs.append({
                        "log_time": log_time,
                        "log_level": str(row_dict.get('log_level') or row_dict.get('level') or 'INFO'),
                        "module": str(row_dict.get('module') or row_dict.get('source')),
                        "message": str(row_dict.get('message') or row_dict.get('content') or ''),
                        "trace_id": str(row_dict.get('trace_id')) if row_dict.get('trace_id') else None,
                        "extra_data": {k: str(v) for k, v in row_dict.items() if k not in ['log_time', 'time', 'log_level', 'level', 'module', 'source', 'message', 'content', 'trace_id']}
                    })
                
                return logs
        except Exception as e:
            raise Exception(f"数据库日志采集失败: {str(e)}")


class APILogCollector(LogCollector):
    
    def __init__(self, db: Session):
        self.db = db
    
    def collect(self, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        return []


class LogCollectorFactory:
    
    _collectors = {
        "file": FileLogCollector,
        "database": DatabaseLogCollector,
        "api": APILogCollector
    }
    
    @classmethod
    def get_collector(cls, source_type: str, db: Session) -> LogCollector:
        collector_class = cls._collectors.get(source_type.lower())
        if not collector_class:
            raise ValueError(f"不支持的日志源类型: {source_type}")
        return collector_class(db)
