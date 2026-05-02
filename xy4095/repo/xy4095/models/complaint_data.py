from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
import pandas as pd


@dataclass
class ComplaintRecord:
    complaint_id: str
    timestamp: datetime
    site_id: str  # 相关监测站点ID
    complainant_name: Optional[str] = None
    complainant_phone: Optional[str] = None
    complainant_address: Optional[str] = None
    complaint_type: str = 'noise'  # noise, vibration, etc.
    complaint_content: str = ''
    expected_noise_source: Optional[str] = None  # 投诉人认为的噪声源
    review_status: str = 'pending'  # pending, reviewing, confirmed, dismissed, uncertain
    review_notes: str = ''
    reviewer_name: Optional[str] = None
    review_timestamp: Optional[datetime] = None
    severity: str = 'normal'  # normal, high, critical
    is_verified: bool = False
    evidence_summary: str = ''
    related_anomalies: List[str] = field(default_factory=list)  # 关联的异常事件ID
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'complaint_id': self.complaint_id,
            'timestamp': self.timestamp,
            'site_id': self.site_id,
            'complainant_name': self.complainant_name,
            'complainant_phone': self.complainant_phone,
            'complainant_address': self.complainant_address,
            'complaint_type': self.complaint_type,
            'complaint_content': self.complaint_content,
            'expected_noise_source': self.expected_noise_source,
            'review_status': self.review_status,
            'review_notes': self.review_notes,
            'reviewer_name': self.reviewer_name,
            'review_timestamp': self.review_timestamp,
            'severity': self.severity,
            'is_verified': self.is_verified,
            'evidence_summary': self.evidence_summary,
            'related_anomalies': self.related_anomalies,
            'metadata': self.metadata
        }


@dataclass
class ComplaintData:
    records: List[ComplaintRecord]
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
    def total_complaints(self) -> int:
        return len(self.records)
    
    @property
    def pending_count(self) -> int:
        return sum(1 for r in self.records if r.review_status == 'pending')
    
    @property
    def confirmed_count(self) -> int:
        return sum(1 for r in self.records if r.review_status == 'confirmed')
    
    @property
    def dismissed_count(self) -> int:
        return sum(1 for r in self.records if r.review_status == 'dismissed')
    
    def get_dataframe(self) -> pd.DataFrame:
        if not self.records:
            return pd.DataFrame()
        
        data = []
        for rec in self.records:
            data.append({
                'complaint_id': rec.complaint_id,
                'timestamp': rec.timestamp,
                'site_id': rec.site_id,
                'complainant_name': rec.complainant_name,
                'complaint_type': rec.complaint_type,
                'complaint_content': rec.complaint_content,
                'expected_noise_source': rec.expected_noise_source,
                'review_status': rec.review_status,
                'review_notes': rec.review_notes,
                'severity': rec.severity,
                'is_verified': rec.is_verified
            })
        
        df = pd.DataFrame(data)
        if not df.empty:
            df = df.set_index('timestamp')
        return df
    
    def filter_by_time(self, start_time: datetime, end_time: datetime) -> 'ComplaintData':
        filtered = [
            r for r in self.records
            if start_time <= r.timestamp <= end_time
        ]
        return ComplaintData(
            records=filtered,
            metadata=self.metadata.copy()
        )
    
    def filter_by_site(self, site_id: str) -> 'ComplaintData':
        filtered = [
            r for r in self.records
            if r.site_id == site_id
        ]
        return ComplaintData(
            records=filtered,
            metadata=self.metadata.copy()
        )
    
    def filter_by_status(self, status: str) -> 'ComplaintData':
        filtered = [
            r for r in self.records
            if r.review_status == status
        ]
        return ComplaintData(
            records=filtered,
            metadata=self.metadata.copy()
        )
    
    def get_statistics(self) -> Dict[str, Any]:
        if not self.records:
            return {}
        
        site_counts = {}
        status_counts = {
            'pending': 0,
            'reviewing': 0,
            'confirmed': 0,
            'dismissed': 0,
            'uncertain': 0
        }
        severity_counts = {
            'normal': 0,
            'high': 0,
            'critical': 0
        }
        
        for rec in self.records:
            if rec.site_id not in site_counts:
                site_counts[rec.site_id] = 0
            site_counts[rec.site_id] += 1
            
            if rec.review_status in status_counts:
                status_counts[rec.review_status] += 1
            
            if rec.severity in severity_counts:
                severity_counts[rec.severity] += 1
        
        return {
            'total_complaints': self.total_complaints,
            'pending_count': self.pending_count,
            'confirmed_count': self.confirmed_count,
            'dismissed_count': self.dismissed_count,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'site_distribution': site_counts,
            'status_distribution': status_counts,
            'severity_distribution': severity_counts
        }
