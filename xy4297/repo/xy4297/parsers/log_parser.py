"""
冰箱开门日志解析器
"""

import re
import csv
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

from config import Config


class DoorLogEntry:
    """
    开门日志条目数据类
    """
    
    DOOR_EVENT_TYPES = {
        "open": ["开门", "打开", "open", "opened", "door_open"],
        "close": ["关门", "关闭", "close", "closed", "door_close"],
        "status": ["状态", "status", "door_status"],
    }

    def __init__(
        self,
        timestamp: datetime,
        event_type: str,
        door_id: Optional[str] = None,
        duration_seconds: Optional[int] = None,
        raw_line: Optional[str] = None,
    ):
        self.timestamp = timestamp
        self.event_type = event_type
        self.door_id = door_id
        self.duration_seconds = duration_seconds
        self.raw_line = raw_line

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "date": self.timestamp.date().isoformat(),
            "event_type": self.event_type,
            "door_id": self.door_id,
            "duration_seconds": self.duration_seconds,
            "duration_minutes": round(self.duration_seconds / 60, 2) if self.duration_seconds else None,
        }

    @property
    def date(self) -> date:
        return self.timestamp.date()


class DoorSession:
    """
    开门会话（从开门到关门的完整过程）
    """

    def __init__(
        self,
        door_id: Optional[str],
        open_time: datetime,
        close_time: Optional[datetime] = None,
    ):
        self.door_id = door_id
        self.open_time = open_time
        self.close_time = close_time

    @property
    def duration(self) -> Optional[timedelta]:
        if self.close_time and self.open_time:
            return self.close_time - self.open_time
        return None

    @property
    def duration_seconds(self) -> Optional[int]:
        if self.duration:
            return int(self.duration.total_seconds())
        return None

    @property
    def is_open(self) -> bool:
        return self.close_time is None

    @property
    def date(self) -> date:
        return self.open_time.date()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "door_id": self.door_id,
            "open_time": self.open_time.isoformat(),
            "close_time": self.close_time.isoformat() if self.close_time else None,
            "duration_seconds": self.duration_seconds,
            "duration_minutes": round(self.duration_seconds / 60, 2) if self.duration_seconds else None,
            "is_open": self.is_open,
            "date": self.date.isoformat(),
        }


class DoorLogParser:
    """
    冰箱开门日志解析器
    """

    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.parsed_entries: List[DoorLogEntry] = []
        self.entries_by_date: Dict[date, List[DoorLogEntry]] = defaultdict(list)
        self.entries_by_door: Dict[str, List[DoorLogEntry]] = defaultdict(list)
        self.sessions: List[DoorSession] = []
        self._sessions_built = False

    def parse_file(self, file_path: Path) -> List[DoorLogEntry]:
        """
        解析单个开门日志文件
        """
        entries = []
        ext = file_path.suffix.lower()

        if ext == ".csv":
            entries = self._parse_csv(file_path)
        elif ext in [".txt", ".log"]:
            entries = self._parse_text(file_path)

        for entry in entries:
            self.parsed_entries.append(entry)
            self.entries_by_date[entry.date].append(entry)
            if entry.door_id:
                self.entries_by_door[entry.door_id].append(entry)

        self._sessions_built = False
        return entries

    def parse_directory(self, directory: Path) -> List[DoorLogEntry]:
        """
        解析目录下所有开门日志文件
        """
        all_entries = []
        
        log_files = []
        for ext in self.config.DOOR_LOG_EXTENSIONS:
            log_files.extend(directory.glob(f"**/*{ext}"))
            log_files.extend(directory.glob(f"**/*{ext.upper()}"))
            
        for file_path in sorted(log_files):
            entries = self.parse_file(file_path)
            all_entries.extend(entries)
            
        return all_entries

    def _parse_csv(self, file_path: Path) -> List[DoorLogEntry]:
        """
        解析CSV格式的开门日志
        """
        entries = []
        
        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                content = f.read()
                
            dialect = csv.Sniffer().sniff(content[:1024]) if content else csv.excel
            reader = csv.DictReader(content.splitlines(), dialect=dialect)
            
            if not reader.fieldnames:
                return entries
                
            time_col = self._find_time_column(reader.fieldnames)
            event_col = self._find_event_column(reader.fieldnames)
            door_col = self._find_door_column(reader.fieldnames)
            duration_col = self._find_duration_column(reader.fieldnames)
            
            for row in reader:
                try:
                    timestamp = self._parse_timestamp(row.get(time_col, ""))
                    if not timestamp:
                        continue
                        
                    event_type = self._detect_event_type(row.get(event_col, ""))
                    if not event_type:
                        event_type = "status"
                        
                    door_id = row.get(door_col) if door_col and door_col in row else None
                    
                    duration_str = row.get(duration_col) if duration_col and duration_col in row else None
                    duration_seconds = self._parse_duration(duration_str)
                    
                    entry = DoorLogEntry(
                        timestamp=timestamp,
                        event_type=event_type,
                        door_id=door_id,
                        duration_seconds=duration_seconds,
                        raw_line=str(row),
                    )
                    entries.append(entry)
                    
                except Exception:
                    continue
                    
        except Exception as e:
            print(f"解析CSV日志文件 {file_path} 时出错: {e}")
            
        return entries

    def _parse_text(self, file_path: Path) -> List[DoorLogEntry]:
        """
        解析文本格式的开门日志
        """
        entries = []
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
                
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                entry = self._parse_text_line(line)
                if entry:
                    entries.append(entry)
                    
        except Exception as e:
            print(f"解析文本日志文件 {file_path} 时出错: {e}")
            
        return entries

    def _parse_text_line(self, line: str) -> Optional[DoorLogEntry]:
        """
        解析单行文本日志
        """
        timestamp = self._extract_timestamp_from_line(line)
        if not timestamp:
            return None
            
        event_type = self._detect_event_type(line)
        if not event_type:
            return None
            
        door_id = self._extract_door_id_from_line(line)
        duration_seconds = self._extract_duration_from_line(line)
        
        return DoorLogEntry(
            timestamp=timestamp,
            event_type=event_type,
            door_id=door_id,
            duration_seconds=duration_seconds,
            raw_line=line,
        )

    def _find_time_column(self, fieldnames: List[str]) -> Optional[str]:
        """
        查找时间列
        """
        time_keywords = ["时间", "time", "date", "日期", "timestamp"]
        for fn in fieldnames:
            fn_lower = fn.lower()
            if any(kw in fn_lower for kw in time_keywords):
                return fn
        return fieldnames[0] if fieldnames else None

    def _find_event_column(self, fieldnames: List[str]) -> Optional[str]:
        """
        查找事件列
        """
        event_keywords = ["事件", "event", "类型", "type", "状态", "status", "动作", "action"]
        for fn in fieldnames:
            fn_lower = fn.lower()
            if any(kw in fn_lower for kw in event_keywords):
                return fn
        return None

    def _find_door_column(self, fieldnames: List[str]) -> Optional[str]:
        """
        查找门ID列
        """
        door_keywords = ["门", "door", "冰箱", "冰柜", "fridge", "id", "编号"]
        for fn in fieldnames:
            fn_lower = fn.lower()
            if any(kw in fn_lower for kw in door_keywords):
                return fn
        return None

    def _find_duration_column(self, fieldnames: List[str]) -> Optional[str]:
        """
        查找持续时间列
        """
        duration_keywords = ["持续", "duration", "时间", "秒", "分钟", "sec", "min"]
        for fn in fieldnames:
            fn_lower = fn.lower()
            if any(kw in fn_lower for kw in duration_keywords):
                return fn
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

    def _extract_timestamp_from_line(self, line: str) -> Optional[datetime]:
        """
        从文本行中提取时间戳
        """
        patterns = [
            r"(\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2}:\d{2})",
            r"(\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2})",
            r"(\d{4}\d{2}\d{2}\s*\d{2}\d{2}\d{2})",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                timestamp = self._parse_timestamp(match.group(1))
                if timestamp:
                    return timestamp
                    
        return None

    def _detect_event_type(self, value: str) -> Optional[str]:
        """
        检测事件类型
        """
        if not value:
            return None
            
        value_lower = str(value).lower()
        
        for event_type, keywords in DoorLogEntry.DOOR_EVENT_TYPES.items():
            for keyword in keywords:
                if keyword.lower() in value_lower:
                    return event_type
                    
        return None

    def _extract_door_id_from_line(self, line: str) -> Optional[str]:
        """
        从文本行中提取门ID
        """
        patterns = [
            r"(?:门|冰箱|冰柜|fridge|door|refrigerator)[\s_-]*([#\d]+)",
            r"([#]?\d{1,3})[#\s_-]*(?:号|门|冰箱|冰柜)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                door_id = match.group(1).replace("#", "").strip()
                if door_id.isdigit():
                    return door_id
                    
        return None

    def _extract_duration_from_line(self, line: str) -> Optional[int]:
        """
        从文本行中提取持续时间
        """
        match = re.search(r"(\d+(?:\.\d+)?)\s*(秒|sec|seconds?)", line, re.IGNORECASE)
        if match:
            return int(float(match.group(1)))
            
        match = re.search(r"(\d+(?:\.\d+)?)\s*(分|min|minutes?)", line, re.IGNORECASE)
        if match:
            return int(float(match.group(1)) * 60)
            
        return None

    def _parse_duration(self, value: str) -> Optional[int]:
        """
        解析持续时间
        """
        if not value or value.strip() == "":
            return None
            
        value = str(value).strip()
        
        if value.replace(".", "", 1).isdigit():
            return int(float(value))
            
        match = re.search(r"(\d+(?:\.\d+)?)", value)
        if match:
            return int(float(match.group(1)))
            
        return None

    def build_sessions(self) -> List[DoorSession]:
        """
        构建开门会话（配对开门和关门事件）
        """
        if self._sessions_built:
            return self.sessions
            
        self.sessions = []
        
        sorted_entries = sorted(self.parsed_entries, key=lambda e: e.timestamp)
        
        open_sessions: Dict[Optional[str], DoorSession] = {}
        
        for entry in sorted_entries:
            door_key = entry.door_id or "default"
            
            if entry.event_type == "open":
                if door_key in open_sessions:
                    open_sessions[door_key].close_time = entry.timestamp
                    self.sessions.append(open_sessions[door_key])
                    
                open_sessions[door_key] = DoorSession(
                    door_id=entry.door_id,
                    open_time=entry.timestamp,
                )
                
            elif entry.event_type == "close":
                if door_key in open_sessions:
                    open_sessions[door_key].close_time = entry.timestamp
                    self.sessions.append(open_sessions[door_key])
                    del open_sessions[door_key]
                    
        for session in open_sessions.values():
            self.sessions.append(session)
            
        self._sessions_built = True
        return self.sessions

    def get_sessions_by_date(self, target_date: date) -> List[DoorSession]:
        """
        获取指定日期的开门会话
        """
        if not self._sessions_built:
            self.build_sessions()
            
        return [s for s in self.sessions if s.date == target_date]

    def get_stats(self) -> Dict[str, Any]:
        """
        获取日志解析统计
        """
        if not self._sessions_built and self.parsed_entries:
            self.build_sessions()
            
        stats = {
            "total_entries": len(self.parsed_entries),
            "dates_with_logs": len(self.entries_by_date),
            "doors": list(self.entries_by_door.keys()),
            "total_sessions": len(self.sessions),
        }
        
        if self.sessions:
            durations = [s.duration_seconds for s in self.sessions if s.duration_seconds]
            if durations:
                stats["avg_duration_seconds"] = sum(durations) / len(durations)
                stats["max_duration_seconds"] = max(durations)
                stats["min_duration_seconds"] = min(durations)
                
        return stats
