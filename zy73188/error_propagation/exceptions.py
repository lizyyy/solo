"""异常类定义"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum


class AnomalyType(Enum):
    """异常类型枚举"""
    EMPTY_INPUT = "empty_input"
    DUPLICATE_SAMPLE = "duplicate_sample"
    BOUNDARY_SAMPLE = "boundary_sample"
    INVALID_DATA = "invalid_data"
    MISSING_EVIDENCE = "missing_evidence"
    CALCULATION_ERROR = "calculation_error"


class SeverityLevel(Enum):
    """严重程度枚举"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class AnomalyRecord:
    """异常记录"""
    anomaly_type: AnomalyType
    severity: SeverityLevel
    message: str
    sample_id: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)
    resolution_hint: Optional[str] = None
    timestamp: float = field(default_factory=lambda: __import__('time').time())


class AnomalyQueue:
    """异常队列 - 独立于终端摘要"""
    
    def __init__(self):
        self._records: List[AnomalyRecord] = []
        self._suspended_samples: set = set()
    
    def add(self, record: AnomalyRecord) -> None:
        self._records.append(record)
        if record.anomaly_type == AnomalyType.DUPLICATE_SAMPLE:
            if record.sample_id:
                self._suspended_samples.add(record.sample_id)
    
    def get_all(self) -> List[AnomalyRecord]:
        return list(self._records)
    
    def get_by_type(self, anomaly_type: AnomalyType) -> List[AnomalyRecord]:
        return [r for r in self._records if r.anomaly_type == anomaly_type]
    
    def get_suspended_samples(self) -> set:
        return self._suspended_samples.copy()
    
    def clear(self) -> None:
        self._records.clear()
        self._suspended_samples.clear()
    
    def __len__(self) -> int:
        return len(self._records)
    
    def __iter__(self):
        return iter(self._records)


class ErrorPropagationError(Exception):
    """基础异常类"""
    def __init__(self, message: str, record: Optional[AnomalyRecord] = None):
        super().__init__(message)
        self.record = record


class EmptyInputError(ErrorPropagationError):
    """空输入异常"""
    pass


class DuplicateSampleError(ErrorPropagationError):
    """重复样本异常"""
    pass
