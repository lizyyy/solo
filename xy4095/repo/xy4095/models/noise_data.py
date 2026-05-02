from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
import pandas as pd


@dataclass
class NoiseRecord:
    timestamp: datetime
    site_id: str
    laeq: float  # 等效连续声级
    lmax: Optional[float] = None  # 最大声级
    lmin: Optional[float] = None  # 最小声级
    l10: Optional[float] = None  # 累积百分声级
    l50: Optional[float] = None
    l90: Optional[float] = None
    is_missing: bool = False
    is_valid: bool = True
    validation_errors: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'timestamp': self.timestamp,
            'site_id': self.site_id,
            'laeq': self.laeq,
            'lmax': self.lmax,
            'lmin': self.lmin,
            'l10': self.l10,
            'l50': self.l50,
            'l90': self.l90,
            'is_missing': self.is_missing,
            'is_valid': self.is_valid,
            'validation_errors': self.validation_errors
        }


@dataclass
class NoiseData:
    site_id: str
    records: List[NoiseRecord]
    sampling_interval_seconds: int = 1  # 默认采样间隔1秒
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if self.records:
            self.records.sort(key=lambda x: x.timestamp)
    
    @property
    def start_time(self) -> Optional[datetime]:
        if self.records:
            return self.records[0].timestamp
        return None
    
    @property
    def end_time(self) -> Optional[datetime]:
        if self.records:
            return self.records[-1].timestamp
        return None
    
    @property
    def total_records(self) -> int:
        return len(self.records)
    
    @property
    def valid_records(self) -> int:
        return sum(1 for r in self.records if r.is_valid)
    
    @property
    def missing_records(self) -> int:
        return sum(1 for r in self.records if r.is_missing)
    
    def get_dataframe(self) -> pd.DataFrame:
        if not self.records:
            return pd.DataFrame()
        
        data = []
        for rec in self.records:
            data.append({
                'timestamp': rec.timestamp,
                'site_id': rec.site_id,
                'laeq': rec.laeq if not pd.isna(rec.laeq) else None,
                'lmax': rec.lmax if not pd.isna(rec.lmax) else None,
                'lmin': rec.lmin if not pd.isna(rec.lmin) else None,
                'l10': rec.l10 if not pd.isna(rec.l10) else None,
                'l50': rec.l50 if not pd.isna(rec.l50) else None,
                'l90': rec.l90 if not pd.isna(rec.l90) else None,
                'is_missing': rec.is_missing,
                'is_valid': rec.is_valid
            })
        
        df = pd.DataFrame(data)
        if not df.empty:
            df = df.set_index('timestamp')
        return df
    
    def filter_by_time(self, start_time: datetime, end_time: datetime) -> 'NoiseData':
        filtered = [
            r for r in self.records
            if start_time <= r.timestamp <= end_time
        ]
        return NoiseData(
            site_id=self.site_id,
            records=filtered,
            sampling_interval_seconds=self.sampling_interval_seconds,
            metadata=self.metadata.copy()
        )
    
    def get_statistics(self) -> Dict[str, Any]:
        if not self.records:
            return {}
        
        laeq_values = [r.laeq for r in self.records if r.is_valid and not r.is_missing and not pd.isna(r.laeq)]
        
        if not laeq_values:
            return {
                'site_id': self.site_id,
                'total_records': self.total_records,
                'valid_records': self.valid_records,
                'missing_records': self.missing_records,
                'start_time': self.start_time,
                'end_time': self.end_time,
            }
        
        import numpy as np
        return {
            'site_id': self.site_id,
            'total_records': self.total_records,
            'valid_records': self.valid_records,
            'missing_records': self.missing_records,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'laeq_mean': np.mean(laeq_values),
            'laeq_max': np.max(laeq_values),
            'laeq_min': np.min(laeq_values),
            'laeq_std': np.std(laeq_values),
            'laeq_median': np.median(laeq_values),
        }
