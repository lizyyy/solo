"""数据模型定义"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional


class TransferMethod(str, Enum):
    """传输方法类型"""
    READ_WRITE = "read_write"
    MMAP_WRITE = "mmap_write"
    SENDFILE = "sendfile"


class BottleneckType(str, Enum):
    """瓶颈类型"""
    CPU = "cpu"
    IO = "io"
    NETWORK = "network"
    MEMORY = "memory"
    NONE = "none"


@dataclass
class HardwareConfig:
    """硬件配置"""
    disk_bandwidth_mbps: float = 100.0
    network_bandwidth_mbps: float = 100.0
    cpu_cores: int = 4
    memory_gb: int = 16
    page_cache_size_mb: int = 1024


@dataclass
class TransferConfig:
    """传输配置"""
    file_size_mb: float
    method: TransferMethod
    page_cache_hit: bool = False
    use_mmap: bool = False
    use_sendfile: bool = False
    use_dma_sg: bool = False
    use_tls: bool = False
    use_compression: bool = False
    compression_ratio: float = 2.0
    chunk_size_kb: int = 64
    hardware: HardwareConfig = field(default_factory=HardwareConfig)


@dataclass
class SimulationResult:
    """模拟结果"""
    case_name: str
    file_size_mb: float
    method: TransferMethod
    
    user_space_copies: int
    kernel_space_copies: int
    total_copies: int
    
    context_switches: int
    system_calls: int
    
    estimated_cpu_usage_pct: float
    estimated_time_ms: float
    estimated_throughput_mbps: float
    
    bottleneck: BottleneckType
    bottleneck_reason: str
    
    copy_details: Dict[str, Dict] = field(default_factory=dict)
    config_snapshot: Dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    
    id: Optional[int] = None


@dataclass
class CaseDefinition:
    """用例定义"""
    name: str
    description: str
    config: TransferConfig
    category: str = "custom"
    tags: List[str] = field(default_factory=list)
