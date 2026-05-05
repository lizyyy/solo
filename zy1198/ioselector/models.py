"""
数据模型定义
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any
from datetime import datetime


class IOSelectorType(Enum):
    """IO 多路复用类型"""
    SELECT = "select"
    POLL = "poll"
    EPOLL = "epoll"


class TriggerMode(Enum):
    """触发模式"""
    LEVEL_TRIGGERED = "lt"  # 水平触发
    EDGE_TRIGGERED = "et"   # 边缘触发


class EventType(Enum):
    """事件类型"""
    READ = "read"
    WRITE = "write"
    ERROR = "error"


@dataclass
class Connection:
    """连接配置"""
    id: str
    fd: int  # 文件描述符
    name: str = ""
    
    # 内核缓冲区配置
    read_buffer_size: int = 4096  # 读缓冲区大小
    write_buffer_size: int = 4096  # 写缓冲区大小
    
    # 读写节奏配置 (时间点，单位毫秒)
    read_events: List[int] = field(default_factory=list)  # 数据到达时间点
    write_events: List[int] = field(default_factory=list)   # 可写时间点
    
    # 每次读写的数据量
    read_data_size: int = 1024  # 每次到达的数据量
    write_available_size: int = 1024  # 每次可写的数据量


@dataclass
class Worker:
    """工作线程/进程配置"""
    id: int
    name: str = ""
    
    # 读取行为
    read_chunk_size: int = 512  # 每次读取的数据量
    read_delay_ms: int = 0      # 读取处理延迟
    
    # 是否使用 EPOLLEXCLUSIVE (仅 epoll)
    epollexclusive: bool = False


@dataclass
class CaseConfig:
    """测试用例完整配置"""
    name: str
    selector_type: IOSelectorType
    description: str = ""
    
    # 触发模式
    trigger_mode: TriggerMode = TriggerMode.LEVEL_TRIGGERED
    
    # 连接配置
    connections: List[Connection] = field(default_factory=list)
    
    # Worker 配置
    workers: List[Worker] = field(default_factory=list)
    
    # 模拟时间线长度 (毫秒)
    simulation_duration_ms: int = 1000
    
    # 是否启用 EPOLLEXCLUSIVE (全局设置，也可以在 worker 中单独设置)
    epollexclusive: bool = False
    
    # 其他元数据
    tags: List[str] = field(default_factory=list)
    is_good_example: bool = True  # 是否为正面示例


@dataclass
class EventTimeline:
    """事件时间线记录"""
    timestamp_ms: int
    event_type: EventType
    fd: int
    worker_id: Optional[int] = None
    details: str = ""


@dataclass
class SimulationResult:
    """模拟结果"""
    case_name: str
    selector_type: IOSelectorType
    trigger_mode: TriggerMode
    
    # 事件时间线
    events: List[EventTimeline] = field(default_factory=list)
    
    # 统计数据
    total_wakeups: int = 0
    unnecessary_wakeups: int = 0  # 不必要的唤醒（惊群中的无效唤醒）
    cpu_spins: int = 0             # CPU 空转次数
    fd_scan_count: int = 0         # fd 扫描次数
    missed_reads: int = 0          # 漏读次数
    duplicate_wakeups: int = 0     # 重复唤醒次数
    thundering_herd_count: int = 0 # 惊群事件次数
    
    # 详细统计
    worker_stats: Dict[int, Dict[str, Any]] = field(default_factory=dict)
    fd_stats: Dict[int, Dict[str, Any]] = field(default_factory=dict)
    
    # 元数据
    start_time: datetime = field(default_factory=datetime.now)
    end_time: Optional[datetime] = None
    duration_ms: int = 0


@dataclass
class AnalysisResult:
    """分析结果"""
    case_name: str
    selector_type: str
    trigger_mode: str
    
    # CPU 效率分析
    cpu_efficiency_score: float  # 0-100
    cpu_spin_analysis: str
    unnecessary_wakeup_analysis: str
    
    # 漏读风险分析
    missed_read_risk: str
    missed_read_suggestions: List[str]
    
    # 惊群分析
    thundering_herd_analysis: str
    thundering_herd_suggestions: List[str]
    
    # 对比分析
    comparison_notes: str
    
    # 总体评价
    overall_rating: str  # "good", "warning", "danger"
    summary: str


class ISelectorError(Exception):
    """基础错误类"""
    pass


class ConfigError(ISelectorError):
    """配置错误"""
    pass


class SimulationError(ISelectorError):
    """模拟错误"""
    pass


class AnalysisError(ISelectorError):
    """分析错误"""
    pass
