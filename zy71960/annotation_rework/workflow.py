"""复核修正工作流与状态管理"""

import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from enum import Enum

from .models import (
    AnnotationSample, SampleStatus, ReviewLog,
    AnomalyType
)
from .storage import AnnotationStore


class ReviewAction(str, Enum):
    """复核动作"""
    CONFIRM = "confirm"
    REJECT = "reject"
    CORRECT = "correct"
    MARK_REVIEWING = "mark_reviewing"
    CLEAR_ANOMALY = "clear_anomaly"


class AnnotationWorkflow:
    """标注工作流管理器"""
    
    def __init__(self, store: AnnotationStore):
        self.store = store
    
    def get_samples_for_review(self, version_id: str,
                               status: Optional[SampleStatus] = None,
                               anomaly_type: Optional[AnomalyType] = None,
                               limit: int = 100) -> List[AnnotationSample]:
        """获取待复核的样本"""
        samples = self.store.get_all_samples(version_id)
        
        if status:
            samples = [s for s in samples if s.status == status]
        
        if anomaly_type:
            samples = [s for s in samples if anomaly_type in s.anomalies]
        
        return samples[:limit]
    
    def review_sample(self, version_id: str, sample_id: str,
                      action: ReviewAction,
                      new_labels: Optional[List[str]] = None,
                      reviewer: Optional[str] = None,
                      comment: Optional[str] = None,
                      anomaly_to_clear: Optional[AnomalyType] = None) -> Optional[AnnotationSample]:
        """复核样本"""
        sample = self.store.get_sample(sample_id, version_id)
        if not sample:
            return None
        
        old_status = sample.status
        old_labels = sample.labels.copy()
        
        if action == ReviewAction.CONFIRM:
            sample.status = SampleStatus.CONFIRMED
        
        elif action == ReviewAction.REJECT:
            sample.status = SampleStatus.REJECTED
        
        elif action == ReviewAction.CORRECT:
            if new_labels is not None:
                sample.labels = new_labels
            sample.status = SampleStatus.CONFIRMED
        
        elif action == ReviewAction.MARK_REVIEWING:
            sample.status = SampleStatus.REVIEWING
        
        elif action == ReviewAction.CLEAR_ANOMALY:
            if anomaly_to_clear and anomaly_to_clear in sample.anomalies:
                sample.anomalies.remove(anomaly_to_clear)
                sample.anomaly_details.pop(anomaly_to_clear.value, None)
            if not sample.anomalies and sample.status == SampleStatus.NEEDS_CONFIRMATION:
                sample.status = SampleStatus.CONFIRMED
        
        log_id = str(uuid.uuid4())
        log = ReviewLog(
            log_id=log_id,
            sample_id=sample_id,
            reviewer=reviewer,
            old_status=old_status,
            new_status=sample.status,
            old_labels=old_labels,
            new_labels=sample.labels,
            comment=comment
        )
        self.store.add_review_log(log)
        
        self.store.save_sample(sample, version_id)
        return sample
    
    def batch_review(self, version_id: str, sample_ids: List[str],
                     action: ReviewAction,
                     reviewer: Optional[str] = None,
                     comment: Optional[str] = None) -> Dict[str, int]:
        """批量复核样本"""
        results = {"success": 0, "failed": 0}
        
        for sample_id in sample_ids:
            result = self.review_sample(
                version_id=version_id,
                sample_id=sample_id,
                action=action,
                reviewer=reviewer,
                comment=comment
            )
            if result:
                results["success"] += 1
            else:
                results["failed"] += 1
        
        return results
    
    def get_sample_review_history(self, sample_id: str) -> List[Dict[str, Any]]:
        """获取样本的复核历史"""
        history = self.store.get_sample_history(sample_id)
        return [
            {
                "log_id": log_id,
                "reviewer": log.reviewer,
                "old_status": log.old_status.value,
                "new_status": log.new_status.value,
                "old_labels": log.old_labels,
                "new_labels": log.new_labels,
                "comment": log.comment,
                "created_at": log.created_at.isoformat()
            }
            for log_id, log in history
        ]
    
    def get_workflow_summary(self, version_id: str) -> Dict[str, Any]:
        """获取工作流统计摘要"""
        samples = self.store.get_all_samples(version_id)
        
        status_counts = {}
        for status in SampleStatus:
            status_counts[status.value] = len([s for s in samples if s.status == status])
        
        anomaly_counts = {}
        for anomaly in AnomalyType:
            anomaly_counts[anomaly.value] = len([
                s for s in samples if anomaly in s.anomalies
            ])
        
        review_count = 0
        for sample in samples:
            history = self.store.get_sample_history(sample.sample_id)
            review_count += len(history)
        
        confirmed_rate = (
            status_counts.get(SampleStatus.CONFIRMED.value, 0) / len(samples) * 100
            if samples else 0
        )
        
        return {
            "version_id": version_id,
            "total_samples": len(samples),
            "status_counts": status_counts,
            "anomaly_counts": anomaly_counts,
            "review_count": review_count,
            "confirmed_rate": round(confirmed_rate, 2),
            "needs_confirmation": status_counts.get(SampleStatus.NEEDS_CONFIRMATION.value, 0)
        }
    
    def resolve_anomaly(self, version_id: str, sample_id: str,
                        anomaly_type: AnomalyType,
                        resolution: str,
                        reviewer: Optional[str] = None) -> Optional[AnnotationSample]:
        """解决特定异常"""
        sample = self.store.get_sample(sample_id, version_id)
        if not sample:
            return None
        
        if anomaly_type in sample.anomalies:
            sample.anomalies.remove(anomaly_type)
            sample.anomaly_details.pop(anomaly_type.value, None)
        
        if "resolutions" not in sample.anomaly_details:
            sample.anomaly_details["resolutions"] = []
        
        sample.anomaly_details["resolutions"].append({
            "anomaly_type": anomaly_type.value,
            "resolution": resolution,
            "reviewer": reviewer,
            "resolved_at": datetime.now().isoformat()
        })
        
        if not sample.anomalies and sample.status == SampleStatus.NEEDS_CONFIRMATION:
            sample.status = SampleStatus.CONFIRMED
        
        self.store.save_sample(sample, version_id)
        return sample
