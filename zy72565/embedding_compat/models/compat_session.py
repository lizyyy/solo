from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any
import uuid

from .feature_record import FeatureComparisonRecord
from .status import ProcessingStatus, AnomalyType


@dataclass
class EmbeddingCompatSession:
    """整个 Embedding 版本兼容检查会话

    管理一批次的所有记录都存在这里
    统一数据出口也从这里走
    """

    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    session_name: str = ""
    version_a: str = ""
    version_b: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    created_by: str = ""

    records: List[FeatureComparisonRecord] = field(default_factory=list)

    def add_record(self, record: FeatureComparisonRecord) -> None:
        self.records.append(record)

    def get_records_by_status(self, status: ProcessingStatus) -> List[FeatureComparisonRecord]:
        return [r for r in self.records if r.status == status]

    def get_records_by_anomaly(self, anomaly_type: AnomalyType) -> List[FeatureComparisonRecord]:
        return [r for r in self.records if r.anomaly_type == anomaly_type]

    def get_pending_lead_review(self) -> List[FeatureComparisonRecord]:
        """获取所有待推荐负责人复核的记录"""
        return self.get_records_by_status(ProcessingStatus.PENDING_LEAD_REVIEW)

    def has_default_score_missing_feature(self) -> List[FeatureComparisonRecord]:
        """获取所有"线上特征缺失却给了默认分"的记录"""
        return self.get_records_by_anomaly(AnomalyType.DEFAULT_SCORE_MISSING_FEATURE)

    def get_summary_stats(self) -> Dict[str, Any]:
        """汇总统计（页面和接口都用这个"""
        total = len(self.records)
        status_counts = {}
        anomaly_counts = {}

        for r in self.records:
            status_counts[r.status.value] = status_counts.get(r.status.value, 0) + 1
            anomaly_counts[r.anomaly_type.value] = anomaly_counts.get(r.anomaly_type.value, 0) + 1

        return {
            "session_id": self.session_id,
            "session_name": self.session_name,
            "version_a": self.version_a,
            "version_b": self.version_b,
            "total_records": total,
            "status_counts": status_counts,
            "anomaly_counts": anomaly_counts,
            "pending_lead_count": len(self.get_pending_lead_review()),
            "default_score_missing_count": len(self.has_default_score_missing_feature()),
            "created_at": self.created_at.isoformat(),
            "created_by": self.created_by,
        }

    def to_dict(self, include_records: bool = True) -> Dict[str, Any]:
        """统一序列化"""
        result = self.get_summary_stats()
        if include_records:
            result["records"] = [r.to_dict() for r in self.records]
        return result

    def export_details(self) -> List[Dict[str, Any]]:
        """导出明细——和页面、接口用同一份数据"""
        return [r.to_dict() for r in self.records]
