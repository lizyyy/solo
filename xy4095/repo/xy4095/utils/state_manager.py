from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Optional, Dict, Any
import json
import os
import uuid
from pathlib import Path

from models import (
    AnalysisResult, AnomalyEvent,
    OverThresholdWindow, SuddenPeak,
    SensorOfflinePeriod, ComplaintEvidence,
    AnomalyType, SeverityLevel,
    ComplaintRecord
)


@dataclass
class ReviewState:
    """复核状态"""
    
    state_id: str
    created_at: datetime
    updated_at: datetime
    
    noise_data_sites: List[str] = field(default_factory=list)
    weather_data_sites: List[str] = field(default_factory=list)
    
    complaint_reviews: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    anomaly_verifications: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    
    analysis_result_id: Optional[str] = None
    analysis_config: Dict[str, Any] = field(default_factory=dict)
    
    reviewer_name: Optional[str] = None
    review_notes: str = ''
    
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'state_id': self.state_id,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'noise_data_sites': self.noise_data_sites,
            'weather_data_sites': self.weather_data_sites,
            'complaint_reviews': self.complaint_reviews,
            'anomaly_verifications': self.anomaly_verifications,
            'analysis_result_id': self.analysis_result_id,
            'analysis_config': self.analysis_config,
            'reviewer_name': self.reviewer_name,
            'review_notes': self.review_notes,
            'metadata': self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ReviewState':
        return cls(
            state_id=data.get('state_id', str(uuid.uuid4())[:8]),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else datetime.now(),
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else datetime.now(),
            noise_data_sites=data.get('noise_data_sites', []),
            weather_data_sites=data.get('weather_data_sites', []),
            complaint_reviews=data.get('complaint_reviews', {}),
            anomaly_verifications=data.get('anomaly_verifications', {}),
            analysis_result_id=data.get('analysis_result_id'),
            analysis_config=data.get('analysis_config', {}),
            reviewer_name=data.get('reviewer_name'),
            review_notes=data.get('review_notes', ''),
            metadata=data.get('metadata', {})
        )
    
    def update_complaint_review(self, 
                                  complaint_id: str,
                                  status: str,
                                  notes: str = '',
                                  reviewer_name: Optional[str] = None,
                                  is_verified: Optional[bool] = None,
                                  evidence_summary: str = ''):
        """更新投诉复核状态"""
        if complaint_id not in self.complaint_reviews:
            self.complaint_reviews[complaint_id] = {}
        
        self.complaint_reviews[complaint_id].update({
            'status': status,
            'notes': notes,
            'reviewer_name': reviewer_name or self.reviewer_name,
            'reviewed_at': datetime.now().isoformat(),
            'is_verified': is_verified if is_verified is not None else self.complaint_reviews[complaint_id].get('is_verified', False),
            'evidence_summary': evidence_summary or self.complaint_reviews[complaint_id].get('evidence_summary', '')
        })
        
        self.updated_at = datetime.now()
    
    def update_anomaly_verification(self,
                                      anomaly_id: str,
                                      is_verified: bool,
                                      verification_notes: str = '',
                                      reviewer_name: Optional[str] = None):
        """更新异常事件验证状态"""
        if anomaly_id not in self.anomaly_verifications:
            self.anomaly_verifications[anomaly_id] = {}
        
        self.anomaly_verifications[anomaly_id].update({
            'is_verified': is_verified,
            'verification_notes': verification_notes,
            'reviewer_name': reviewer_name or self.reviewer_name,
            'verified_at': datetime.now().isoformat()
        })
        
        self.updated_at = datetime.now()
    
    def get_complaint_review(self, complaint_id: str) -> Optional[Dict[str, Any]]:
        """获取投诉复核状态"""
        return self.complaint_reviews.get(complaint_id)
    
    def get_anomaly_verification(self, anomaly_id: str) -> Optional[Dict[str, Any]]:
        """获取异常事件验证状态"""
        return self.anomaly_verifications.get(anomaly_id)
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取复核统计"""
        status_counts = {}
        verified_count = 0
        unverified_count = 0
        
        for complaint_id, review in self.complaint_reviews.items():
            status = review.get('status', 'pending')
            if status not in status_counts:
                status_counts[status] = 0
            status_counts[status] += 1
            
            if review.get('is_verified'):
                verified_count += 1
            else:
                unverified_count += 1
        
        anomaly_verified = sum(1 for v in self.anomaly_verifications.values() if v.get('is_verified'))
        anomaly_total = len(self.anomaly_verifications)
        
        return {
            'total_complaints_reviewed': len(self.complaint_reviews),
            'complaint_status_counts': status_counts,
            'complaints_verified': verified_count,
            'complaints_unverified': unverified_count,
            'total_anomalies_verified': anomaly_verified,
            'total_anomalies': anomaly_total
        }


class StateManager:
    """状态管理器"""
    
    def __init__(self, storage_dir: Optional[str] = None):
        if storage_dir is None:
            storage_dir = os.path.join(os.path.expanduser('~'), '.noise_review', 'states')
        
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        self.current_state: Optional[ReviewState] = None
    
    def create_new_state(self,
                         noise_data_sites: List[str],
                         weather_data_sites: List[str],
                         analysis_config: Optional[Dict[str, Any]] = None,
                         reviewer_name: Optional[str] = None) -> ReviewState:
        """创建新的复核状态"""
        state_id = str(uuid.uuid4())[:8]
        now = datetime.now()
        
        self.current_state = ReviewState(
            state_id=state_id,
            created_at=now,
            updated_at=now,
            noise_data_sites=noise_data_sites,
            weather_data_sites=weather_data_sites,
            analysis_config=analysis_config or {},
            reviewer_name=reviewer_name
        )
        
        return self.current_state
    
    def save_state(self, state: Optional[ReviewState] = None) -> str:
        """保存状态到文件"""
        if state is None:
            state = self.current_state
        
        if state is None:
            raise ValueError("没有可保存的状态")
        
        state.updated_at = datetime.now()
        
        file_path = self.storage_dir / f"state_{state.state_id}.json"
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(state.to_dict(), f, ensure_ascii=False, indent=2)
        
        return str(file_path)
    
    def load_state(self, state_id: str) -> Optional[ReviewState]:
        """从文件加载状态"""
        file_path = self.storage_dir / f"state_{state_id}.json"
        
        if not file_path.exists():
            return None
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        state = ReviewState.from_dict(data)
        self.current_state = state
        
        return state
    
    def list_saved_states(self) -> List[Dict[str, Any]]:
        """列出所有保存的状态"""
        states = []
        
        for file_path in self.storage_dir.glob("state_*.json"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                states.append({
                    'state_id': data.get('state_id'),
                    'file_path': str(file_path),
                    'created_at': data.get('created_at'),
                    'updated_at': data.get('updated_at'),
                    'noise_sites': data.get('noise_data_sites', []),
                    'weather_sites': data.get('weather_data_sites', []),
                    'complaints_reviewed': len(data.get('complaint_reviews', {})),
                    'reviewer_name': data.get('reviewer_name')
                })
            except Exception:
                continue
        
        states.sort(key=lambda x: x['updated_at'] if x['updated_at'] else '', reverse=True)
        
        return states
    
    def delete_state(self, state_id: str) -> bool:
        """删除状态文件"""
        file_path = self.storage_dir / f"state_{state_id}.json"
        
        if file_path.exists():
            file_path.unlink()
            return True
        
        return False
    
    def export_state_for_audit(self, state: Optional[ReviewState] = None) -> Dict[str, Any]:
        """导出状态用于审计"""
        if state is None:
            state = self.current_state
        
        if state is None:
            return {}
        
        audit_data = {
            'audit_export_time': datetime.now().isoformat(),
            'state_id': state.state_id,
            'created_at': state.created_at.isoformat(),
            'updated_at': state.updated_at.isoformat(),
            'reviewer_name': state.reviewer_name,
            'review_notes': state.review_notes,
            'statistics': state.get_statistics(),
            'complaint_reviews': state.complaint_reviews,
            'anomaly_verifications': state.anomaly_verifications,
            'metadata': state.metadata
        }
        
        return audit_data


class SessionState:
    """会话状态（用于Streamlit应用）"""
    
    def __init__(self):
        self.noise_data_dict: Dict[str, Any] = {}
        self.weather_data_dict: Dict[str, Any] = {}
        self.complaint_data: Optional[Any] = None
        
        self.analysis_result: Optional[AnalysisResult] = None
        self.review_state: Optional[ReviewState] = None
        
        self.validation_results: Dict[str, Any] = {}
        
        self.selected_site: Optional[str] = None
        self.selected_complaint: Optional[str] = None
        self.selected_anomaly: Optional[str] = None
        
        self.time_range_start: Optional[datetime] = None
        self.time_range_end: Optional[datetime] = None
        
        self.analysis_config: Dict[str, Any] = {
            'noise_threshold_daytime': 60.0,
            'noise_threshold_nighttime': 50.0,
            'nighttime_start_hour': 22,
            'nighttime_end_hour': 6,
            'peak_threshold_increase': 15.0,
            'offline_threshold_seconds': 60.0,
            'complaint_analysis_window_before': 10,
            'complaint_analysis_window_after': 5
        }
        
        self.ui_state: Dict[str, Any] = {
            'active_tab': 'import',
            'show_advanced_settings': False,
            'auto_analyze': True
        }
    
    def clear(self):
        """清除所有会话状态"""
        self.noise_data_dict = {}
        self.weather_data_dict = {}
        self.complaint_data = None
        self.analysis_result = None
        self.review_state = None
        self.validation_results = {}
        self.selected_site = None
        self.selected_complaint = None
        self.selected_anomaly = None
        self.time_range_start = None
        self.time_range_end = None
    
    def has_data(self) -> bool:
        """检查是否有数据"""
        return bool(self.noise_data_dict or self.weather_data_dict or self.complaint_data)
    
    def has_analysis(self) -> bool:
        """检查是否有分析结果"""
        return self.analysis_result is not None
    
    def get_available_sites(self) -> List[str]:
        """获取可用的站点列表"""
        noise_sites = set(self.noise_data_dict.keys())
        weather_sites = set(self.weather_data_dict.keys())
        return list(noise_sites | weather_sites)
    
    def get_common_sites(self) -> List[str]:
        """获取同时有噪声和天气数据的站点"""
        noise_sites = set(self.noise_data_dict.keys())
        weather_sites = set(self.weather_data_dict.keys())
        return list(noise_sites & weather_sites)
