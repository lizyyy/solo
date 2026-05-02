"""终端日志解析模块"""

import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from .utils import load_json, save_json


class LogEventType(Enum):
    """日志事件类型"""
    UNKNOWN = "unknown"
    
    # 瓦片相关
    TILE_DOWNLOAD_START = "tile_download_start"
    TILE_DOWNLOAD_SUCCESS = "tile_download_success"
    TILE_DOWNLOAD_FAILED = "tile_download_failed"
    TILE_MISSING_REPORTED = "tile_missing_reported"
    
    # 任务相关
    TASK_ASSIGNED = "task_assigned"
    TASK_STARTED = "task_started"
    TASK_COMPLETED = "task_completed"
    TASK_FAILED = "task_failed"
    TASK_DUPLICATE_RECEIVED = "task_duplicate_received"
    
    # 地块相关
    PARCEL_SYNC_START = "parcel_sync_start"
    PARCEL_SYNC_SUCCESS = "parcel_sync_success"
    PARCEL_SYNC_FAILED = "parcel_sync_failed"
    PARCEL_VERSION_MISMATCH = "parcel_version_mismatch"
    
    # 回滚相关
    ROLLBACK_INITIATED = "rollback_initiated"
    ROLLBACK_SUCCESS = "rollback_success"
    ROLLBACK_FAILED = "rollback_failed"
    ROLLBACK_PACKAGE_MISSING = "rollback_package_missing"
    
    # 系统相关
    TERMINAL_STARTUP = "terminal_startup"
    TERMINAL_SHUTDOWN = "terminal_shutdown"
    SYNC_SESSION_START = "sync_session_start"
    SYNC_SESSION_END = "sync_session_end"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class LogEvent:
    """日志事件"""
    timestamp: datetime
    terminal_id: str
    event_type: LogEventType
    message: str
    raw_line: str
    event_data: Dict[str, Any] = field(default_factory=dict)
    line_number: int = 0

    @property
    def event_key(self) -> str:
        return f"{self.terminal_id}_{self.timestamp.isoformat()}_{self.event_type.value}"


@dataclass
class TerminalStatus:
    """终端状态"""
    terminal_id: str
    last_seen: Optional[datetime] = None
    status: str = "unknown"  # online, offline, syncing, error
    assigned_tasks: List[str] = field(default_factory=list)
    completed_tasks: List[str] = field(default_factory=list)
    failed_tasks: List[str] = field(default_factory=list)
    synced_parcels: Dict[str, str] = field(default_factory=dict)  # parcel_id -> version
    missing_tiles: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    last_sync_session: Optional[datetime] = None
    has_rollback_capability: bool = False


class LogParser:
    """终端日志解析器"""

    # 时间戳格式正则
    TIMESTAMP_PATTERNS = [
        re.compile(r"^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2})?)"),
        re.compile(r"^(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})"),
        re.compile(r"^(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2})"),
    ]

    # 终端ID模式
    TERMINAL_ID_PATTERNS = [
        re.compile(r"terminal[_\-\s]?(\w+)"),
        re.compile(r"device[_\-\s]?(\w+)"),
        re.compile(r"(T\d+)"),
        re.compile(r"终端[_\-\s]?(\w+)"),
    ]

    # 事件类型关键字映射
    EVENT_KEYWORDS = {
        # 瓦片相关
        "开始下载瓦片": LogEventType.TILE_DOWNLOAD_START,
        "瓦片下载成功": LogEventType.TILE_DOWNLOAD_SUCCESS,
        "瓦片下载失败": LogEventType.TILE_DOWNLOAD_FAILED,
        "缺少瓦片": LogEventType.TILE_MISSING_REPORTED,
        "缺失瓦片": LogEventType.TILE_MISSING_REPORTED,
        "tile download start": LogEventType.TILE_DOWNLOAD_START,
        "tile download success": LogEventType.TILE_DOWNLOAD_SUCCESS,
        "tile download failed": LogEventType.TILE_DOWNLOAD_FAILED,
        "missing tile": LogEventType.TILE_MISSING_REPORTED,
        
        # 任务相关
        "任务分配": LogEventType.TASK_ASSIGNED,
        "任务开始": LogEventType.TASK_STARTED,
        "任务完成": LogEventType.TASK_COMPLETED,
        "任务失败": LogEventType.TASK_FAILED,
        "重复任务": LogEventType.TASK_DUPLICATE_RECEIVED,
        "task assigned": LogEventType.TASK_ASSIGNED,
        "task started": LogEventType.TASK_STARTED,
        "task completed": LogEventType.TASK_COMPLETED,
        "task failed": LogEventType.TASK_FAILED,
        "duplicate task": LogEventType.TASK_DUPLICATE_RECEIVED,
        
        # 地块相关
        "地块同步开始": LogEventType.PARCEL_SYNC_START,
        "地块同步成功": LogEventType.PARCEL_SYNC_SUCCESS,
        "地块同步失败": LogEventType.PARCEL_SYNC_FAILED,
        "版本不匹配": LogEventType.PARCEL_VERSION_MISMATCH,
        "parcel sync start": LogEventType.PARCEL_SYNC_START,
        "parcel sync success": LogEventType.PARCEL_SYNC_SUCCESS,
        "parcel sync failed": LogEventType.PARCEL_SYNC_FAILED,
        "version mismatch": LogEventType.PARCEL_VERSION_MISMATCH,
        
        # 回滚相关
        "开始回滚": LogEventType.ROLLBACK_INITIATED,
        "回滚成功": LogEventType.ROLLBACK_SUCCESS,
        "回滚失败": LogEventType.ROLLBACK_FAILED,
        "回滚包缺失": LogEventType.ROLLBACK_PACKAGE_MISSING,
        "rollback initiated": LogEventType.ROLLBACK_INITIATED,
        "rollback success": LogEventType.ROLLBACK_SUCCESS,
        "rollback failed": LogEventType.ROLLBACK_FAILED,
        "rollback package missing": LogEventType.ROLLBACK_PACKAGE_MISSING,
        
        # 系统相关
        "终端启动": LogEventType.TERMINAL_STARTUP,
        "终端关闭": LogEventType.TERMINAL_SHUTDOWN,
        "同步会话开始": LogEventType.SYNC_SESSION_START,
        "同步会话结束": LogEventType.SYNC_SESSION_END,
        "terminal startup": LogEventType.TERMINAL_STARTUP,
        "terminal shutdown": LogEventType.TERMINAL_SHUTDOWN,
        "sync session start": LogEventType.SYNC_SESSION_START,
        "sync session end": LogEventType.SYNC_SESSION_END,
    }

    # 级别关键字
    LEVEL_KEYWORDS = {
        "ERROR": LogEventType.ERROR,
        "error": LogEventType.ERROR,
        "错误": LogEventType.ERROR,
        "WARN": LogEventType.WARNING,
        "warning": LogEventType.WARNING,
        "警告": LogEventType.WARNING,
        "INFO": LogEventType.INFO,
        "info": LogEventType.INFO,
        "信息": LogEventType.INFO,
    }

    def __init__(self, work_dir: Path):
        self.work_dir = work_dir
        self.events: List[LogEvent] = []
        self.terminals: Dict[str, TerminalStatus] = {}
        self.logs_dir = work_dir / ".sync_index" / "logs"
        self.events_file = work_dir / ".sync_index" / "parsed_events.json"
        self.terminals_file = work_dir / ".sync_index" / "terminal_status.json"

    def parse_file(self, log_file: Path, terminal_id_override: Optional[str] = None) -> int:
        """
        解析单个日志文件
        
        Args:
            log_file: 日志文件路径
            terminal_id_override: 强制指定终端ID（如果日志中没有明确标识）
        
        Returns:
            解析出的事件数量
        """
        if not log_file.exists():
            return 0

        event_count = 0
        with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue

                event = self._parse_line(line, line_num, terminal_id_override)
                if event:
                    self.events.append(event)
                    event_count += 1

        return event_count

    def parse_directory(self, logs_dir: Path) -> int:
        """
        解析日志目录
        
        支持的目录结构：
        - logs/terminal_001/*.log
        - logs/*.log (文件名包含终端标识)
        """
        if not logs_dir.exists():
            return 0

        total_events = 0

        # 首先尝试子目录模式（每个终端一个子目录）
        for subdir in logs_dir.iterdir():
            if subdir.is_dir():
                # 从目录名提取终端ID
                terminal_id = self._extract_terminal_id(subdir.name)
                if terminal_id:
                    for log_file in subdir.glob("**/*.log"):
                        total_events += self.parse_file(log_file, terminal_id)
                    for log_file in subdir.glob("**/*.txt"):
                        total_events += self.parse_file(log_file, terminal_id)

        # 然后尝试直接目录下的日志文件
        for log_file in logs_dir.glob("*.log"):
            terminal_id = self._extract_terminal_id(log_file.stem)
            total_events += self.parse_file(log_file, terminal_id)

        for log_file in logs_dir.glob("*.txt"):
            terminal_id = self._extract_terminal_id(log_file.stem)
            total_events += self.parse_file(log_file, terminal_id)

        return total_events

    def build_terminal_status(self) -> Dict[str, TerminalStatus]:
        """从解析的事件构建终端状态"""
        terminals: Dict[str, TerminalStatus] = {}

        # 按时间排序事件
        sorted_events = sorted(self.events, key=lambda e: e.timestamp)

        for event in sorted_events:
            if event.terminal_id not in terminals:
                terminals[event.terminal_id] = TerminalStatus(
                    terminal_id=event.terminal_id
                )
            status = terminals[event.terminal_id]

            # 更新最后活动时间
            status.last_seen = event.timestamp

            # 根据事件类型更新状态
            if event.event_type == LogEventType.TERMINAL_STARTUP:
                status.status = "online"
            elif event.event_type == LogEventType.TERMINAL_SHUTDOWN:
                status.status = "offline"
            elif event.event_type == LogEventType.SYNC_SESSION_START:
                status.status = "syncing"
                status.last_sync_session = event.timestamp
            elif event.event_type == LogEventType.SYNC_SESSION_END:
                status.status = "online"

            # 任务相关
            if event.event_type == LogEventType.TASK_ASSIGNED:
                task_id = event.event_data.get("task_id", event.message)
                if task_id not in status.assigned_tasks:
                    status.assigned_tasks.append(task_id)
            elif event.event_type == LogEventType.TASK_COMPLETED:
                task_id = event.event_data.get("task_id", event.message)
                if task_id not in status.completed_tasks:
                    status.completed_tasks.append(task_id)
            elif event.event_type == LogEventType.TASK_FAILED:
                task_id = event.event_data.get("task_id", event.message)
                if task_id not in status.failed_tasks:
                    status.failed_tasks.append(task_id)
            elif event.event_type == LogEventType.TASK_DUPLICATE_RECEIVED:
                task_id = event.event_data.get("task_id", event.message)
                status.errors.append(f"重复收到任务: {task_id}")

            # 地块相关
            if event.event_type == LogEventType.PARCEL_SYNC_SUCCESS:
                parcel_id = event.event_data.get("parcel_id")
                version = event.event_data.get("version", "1.0.0")
                if parcel_id:
                    status.synced_parcels[parcel_id] = version
            elif event.event_type == LogEventType.PARCEL_VERSION_MISMATCH:
                parcel_id = event.event_data.get("parcel_id", event.message)
                status.errors.append(f"地块版本不匹配: {parcel_id}")

            # 瓦片相关
            if event.event_type == LogEventType.TILE_MISSING_REPORTED:
                tile_id = event.event_data.get("tile_id", event.message)
                if tile_id not in status.missing_tiles:
                    status.missing_tiles.append(tile_id)

            # 回滚相关
            if event.event_type == LogEventType.ROLLBACK_SUCCESS:
                status.has_rollback_capability = True
            elif event.event_type == LogEventType.ROLLBACK_PACKAGE_MISSING:
                status.errors.append("回滚包缺失")

            # 错误收集
            if event.event_type == LogEventType.ERROR:
                status.errors.append(event.message[:200])

        self.terminals = terminals
        return terminals

    def get_terminal_summary(self) -> Dict[str, Any]:
        """获取终端状态摘要"""
        summary = {
            "total_terminals": len(self.terminals),
            "online_count": 0,
            "offline_count": 0,
            "syncing_count": 0,
            "error_count": 0,
            "terminals": []
        }

        for terminal_id, status in self.terminals.items():
            term_info = {
                "terminal_id": terminal_id,
                "status": status.status,
                "last_seen": status.last_seen.isoformat() if status.last_seen else None,
                "assigned_tasks_count": len(status.assigned_tasks),
                "completed_tasks_count": len(status.completed_tasks),
                "failed_tasks_count": len(status.failed_tasks),
                "synced_parcels_count": len(status.synced_parcels),
                "missing_tiles_count": len(status.missing_tiles),
                "errors_count": len(status.errors),
                "has_rollback_capability": status.has_rollback_capability
            }
            summary["terminals"].append(term_info)

            if status.status == "online":
                summary["online_count"] += 1
            elif status.status == "offline":
                summary["offline_count"] += 1
            elif status.status == "syncing":
                summary["syncing_count"] += 1

            if status.errors:
                summary["error_count"] += 1

        return summary

    def save_parsed_data(self) -> None:
        """保存解析的数据到文件"""
        events_data = {
            "parsed_at": datetime.now().isoformat(),
            "total_events": len(self.events),
            "events": [
                {
                    "timestamp": e.timestamp.isoformat(),
                    "terminal_id": e.terminal_id,
                    "event_type": e.event_type.value,
                    "message": e.message,
                    "event_data": e.event_data,
                    "line_number": e.line_number
                }
                for e in self.events
            ]
        }
        save_json(events_data, self.events_file)

        terminals_data = {
            "generated_at": datetime.now().isoformat(),
            "terminals": {
                tid: {
                    "terminal_id": t.terminal_id,
                    "last_seen": t.last_seen.isoformat() if t.last_seen else None,
                    "status": t.status,
                    "assigned_tasks": t.assigned_tasks,
                    "completed_tasks": t.completed_tasks,
                    "failed_tasks": t.failed_tasks,
                    "synced_parcels": t.synced_parcels,
                    "missing_tiles": t.missing_tiles,
                    "errors": t.errors,
                    "last_sync_session": t.last_sync_session.isoformat() if t.last_sync_session else None,
                    "has_rollback_capability": t.has_rollback_capability
                }
                for tid, t in self.terminals.items()
            }
        }
        save_json(terminals_data, self.terminals_file)

    def load_parsed_data(self) -> bool:
        """从文件加载解析的数据"""
        if not self.events_file.exists() or not self.terminals_file.exists():
            return False

        try:
            events_data = load_json(self.events_file)
            terminals_data = load_json(self.terminals_file)

            self.events = []
            for e_data in events_data.get("events", []):
                try:
                    timestamp = datetime.fromisoformat(e_data["timestamp"])
                except ValueError:
                    continue

                event = LogEvent(
                    timestamp=timestamp,
                    terminal_id=e_data["terminal_id"],
                    event_type=LogEventType(e_data["event_type"]),
                    message=e_data["message"],
                    raw_line="",
                    event_data=e_data.get("event_data", {}),
                    line_number=e_data.get("line_number", 0)
                )
                self.events.append(event)

            self.terminals = {}
            for tid, t_data in terminals_data.get("terminals", {}).items():
                last_seen = None
                if t_data.get("last_seen"):
                    try:
                        last_seen = datetime.fromisoformat(t_data["last_seen"])
                    except ValueError:
                        pass

                last_sync_session = None
                if t_data.get("last_sync_session"):
                    try:
                        last_sync_session = datetime.fromisoformat(t_data["last_sync_session"])
                    except ValueError:
                        pass

                self.terminals[tid] = TerminalStatus(
                    terminal_id=tid,
                    last_seen=last_seen,
                    status=t_data.get("status", "unknown"),
                    assigned_tasks=t_data.get("assigned_tasks", []),
                    completed_tasks=t_data.get("completed_tasks", []),
                    failed_tasks=t_data.get("failed_tasks", []),
                    synced_parcels=t_data.get("synced_parcels", {}),
                    missing_tiles=t_data.get("missing_tiles", []),
                    errors=t_data.get("errors", []),
                    last_sync_session=last_sync_session,
                    has_rollback_capability=t_data.get("has_rollback_capability", False)
                )

            return True

        except Exception as e:
            print(f"警告: 加载日志数据时出错: {e}")
            return False

    def _parse_line(self, line: str, line_num: int, default_terminal_id: Optional[str] = None) -> Optional[LogEvent]:
        """解析单行日志"""
        timestamp = self._extract_timestamp(line)
        if not timestamp:
            timestamp = datetime.now()

        terminal_id = self._extract_terminal_id(line) or default_terminal_id or "unknown"

        event_type = self._detect_event_type(line)
        event_data = self._extract_event_data(line, event_type)

        return LogEvent(
            timestamp=timestamp,
            terminal_id=terminal_id,
            event_type=event_type,
            message=line,
            raw_line=line,
            event_data=event_data,
            line_number=line_num
        )

    def _extract_timestamp(self, line: str) -> Optional[datetime]:
        """从日志行提取时间戳"""
        for pattern in self.TIMESTAMP_PATTERNS:
            match = pattern.match(line)
            if match:
                ts_str = match.group(1)
                try:
                    # 尝试多种格式解析
                    ts_str = ts_str.replace("T", " ")
                    for fmt in [
                        "%Y-%m-%d %H:%M:%S.%f",
                        "%Y-%m-%d %H:%M:%S",
                        "%d/%m/%Y %H:%M:%S",
                        "%Y/%m/%d %H:%M:%S",
                    ]:
                        try:
                            return datetime.strptime(ts_str.split("+")[0].split("-")[0], fmt)
                        except ValueError:
                            continue
                    # 尝试使用 dateutil
                    from dateutil import parser
                    return parser.parse(ts_str)
                except (ValueError, ImportError):
                    continue
        return None

    def _extract_terminal_id(self, text: str) -> Optional[str]:
        """从文本中提取终端ID"""
        for pattern in self.TERMINAL_ID_PATTERNS:
            match = pattern.search(text)
            if match:
                return match.group(1)
        return None

    def _detect_event_type(self, line: str) -> LogEventType:
        """检测日志行的事件类型"""
        line_lower = line.lower()

        # 首先检查事件关键字
        for keyword, event_type in self.EVENT_KEYWORDS.items():
            if keyword.lower() in line_lower:
                return event_type

        # 然后检查级别关键字
        for keyword, event_type in self.LEVEL_KEYWORDS.items():
            if keyword.lower() in line_lower:
                return event_type

        return LogEventType.UNKNOWN

    def _extract_event_data(self, line: str, event_type: LogEventType) -> Dict[str, Any]:
        """从日志行提取结构化数据"""
        data: Dict[str, Any] = {}

        # 提取任务ID
        task_patterns = [
            re.compile(r"task[_\-]?id[:\s]+([\w\-]+)", re.IGNORECASE),
            re.compile(r"任务[_\-]?[IDid]*[:\s]+([\w\-]+)"),
        ]
        for pattern in task_patterns:
            match = pattern.search(line)
            if match:
                data["task_id"] = match.group(1)
                break

        # 提取地块ID
        parcel_patterns = [
            re.compile(r"parcel[_\-]?id[:\s]+([\w\-]+)", re.IGNORECASE),
            re.compile(r"地块[_\-]?[IDid]*[:\s]+([\w\-]+)"),
        ]
        for pattern in parcel_patterns:
            match = pattern.search(line)
            if match:
                data["parcel_id"] = match.group(1)
                break

        # 提取版本
        version_patterns = [
            re.compile(r"version[:\s]+([\d\.]+)", re.IGNORECASE),
            re.compile(r"版本[:\s]+([\d\.]+)"),
            re.compile(r"v(\d+\.\d+\.\d+)"),
        ]
        for pattern in version_patterns:
            match = pattern.search(line)
            if match:
                data["version"] = match.group(1)
                break

        # 提取瓦片坐标
        tile_patterns = [
            re.compile(r"tile[:\s]?(\d+)/(\d+)/(\d+)", re.IGNORECASE),
            re.compile(r"(\d+)/(\d+)/(\d+)\.png"),
            re.compile(r"瓦片[:\s]?(\d+)/(\d+)/(\d+)"),
        ]
        for pattern in tile_patterns:
            match = pattern.search(line)
            if match:
                z, x, y = match.groups()
                data["tile_id"] = f"{z}/{x}/{y}"
                data["tile_z"] = int(z)
                data["tile_x"] = int(x)
                data["tile_y"] = int(y)
                break

        return data
