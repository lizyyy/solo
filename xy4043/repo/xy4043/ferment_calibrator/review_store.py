"""
人工复核存储模块 - 保存和管理风险点的人工反馈
"""
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict, field
from enum import Enum


class ReviewStatus(Enum):
    """复核状态"""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    DISMISSED = "dismissed"


class ReviewAction(Enum):
    """复核动作"""
    CONFIRM = "confirm"
    DISMISS = "dismiss"


@dataclass
class RiskReview:
    """风险复核记录"""
    risk_id: str
    batch_id: str
    risk_type: str
    severity: str
    description: str
    original_review_status: str
    new_review_status: str
    reviewer: str
    review_comment: str
    review_time: datetime = field(default_factory=datetime.now)
    confidence_override: Optional[float] = None
    evidence: Optional[Dict[str, Any]] = None


@dataclass
class BatchReviewRecord:
    """批次复核记录"""
    batch_id: str
    strain: Optional[str] = None
    review_time: datetime = field(default_factory=datetime.now)
    risk_reviews: List[RiskReview] = field(default_factory=list)
    overall_comment: Optional[str] = None
    reviewer: Optional[str] = None


class ReviewStore:
    """复核存储管理器"""
    
    def __init__(self, storage_path: str):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.reviews_file = self.storage_path / "reviews.json"
        self._load_reviews()
    
    def _load_reviews(self) -> None:
        """从文件加载复核记录"""
        self.batch_reviews: Dict[str, BatchReviewRecord] = {}
        
        if self.reviews_file.exists():
            try:
                with open(self.reviews_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                for batch_id, batch_data in data.items():
                    reviews = []
                    for review_data in batch_data.get("risk_reviews", []):
                        review = RiskReview(
                            risk_id=review_data["risk_id"],
                            batch_id=review_data["batch_id"],
                            risk_type=review_data["risk_type"],
                            severity=review_data["severity"],
                            description=review_data["description"],
                            original_review_status=review_data["original_review_status"],
                            new_review_status=review_data["new_review_status"],
                            reviewer=review_data["reviewer"],
                            review_comment=review_data.get("review_comment", ""),
                            review_time=datetime.fromisoformat(review_data["review_time"]),
                            confidence_override=review_data.get("confidence_override"),
                            evidence=review_data.get("evidence")
                        )
                        reviews.append(review)
                    
                    batch_record = BatchReviewRecord(
                        batch_id=batch_id,
                        strain=batch_data.get("strain"),
                        review_time=datetime.fromisoformat(batch_data["review_time"])
                        if batch_data.get("review_time") else datetime.now(),
                        risk_reviews=reviews,
                        overall_comment=batch_data.get("overall_comment"),
                        reviewer=batch_data.get("reviewer")
                    )
                    self.batch_reviews[batch_id] = batch_record
            except (json.JSONDecodeError, KeyError) as e:
                print(f"加载复核记录时出错: {e}")
    
    def _save_reviews(self) -> None:
        """保存复核记录到文件"""
        data = {}
        for batch_id, record in self.batch_reviews.items():
            data[batch_id] = {
                "batch_id": record.batch_id,
                "strain": record.strain,
                "review_time": record.review_time.isoformat(),
                "risk_reviews": [
                    {
                        "risk_id": r.risk_id,
                        "batch_id": r.batch_id,
                        "risk_type": r.risk_type,
                        "severity": r.severity,
                        "description": r.description,
                        "original_review_status": r.original_review_status,
                        "new_review_status": r.new_review_status,
                        "reviewer": r.reviewer,
                        "review_comment": r.review_comment,
                        "review_time": r.review_time.isoformat(),
                        "confidence_override": r.confidence_override,
                        "evidence": r.evidence
                    }
                    for r in record.risk_reviews
                ],
                "overall_comment": record.overall_comment,
                "reviewer": record.reviewer
            }
        
        with open(self.reviews_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def review_risk(
        self,
        batch_id: str,
        risk_id: str,
        action: ReviewAction,
        reviewer: str,
        comment: str = "",
        confidence_override: Optional[float] = None,
        risk_details: Optional[Dict[str, Any]] = None
    ) -> RiskReview:
        """
        复核单个风险点
        
        Args:
            batch_id: 批次ID
            risk_id: 风险ID
            action: 复核动作（确认/驳回）
            reviewer: 复核人
            comment: 复核注释
            confidence_override: 置信度覆盖
            risk_details: 风险详情（用于创建新记录）
            
        Returns:
            RiskReview对象
        """
        if batch_id not in self.batch_reviews:
            self.batch_reviews[batch_id] = BatchReviewRecord(
                batch_id=batch_id,
                reviewer=reviewer
            )
        
        batch_record = self.batch_reviews[batch_id]
        
        existing_review = next(
            (r for r in batch_record.risk_reviews if r.risk_id == risk_id),
            None
        )
        
        original_status = "pending"
        if existing_review:
            original_status = existing_review.new_review_status
        elif risk_details:
            original_status = risk_details.get("review_status", "pending")
        
        new_status = (
            ReviewStatus.CONFIRMED.value if action == ReviewAction.CONFIRM
            else ReviewStatus.DISMISSED.value
        )
        
        review = RiskReview(
            risk_id=risk_id,
            batch_id=batch_id,
            risk_type=risk_details.get("risk_type", "unknown") if risk_details else "unknown",
            severity=risk_details.get("severity", "medium") if risk_details else "medium",
            description=risk_details.get("description", "") if risk_details else "",
            original_review_status=original_status,
            new_review_status=new_status,
            reviewer=reviewer,
            review_comment=comment,
            confidence_override=confidence_override,
            evidence=risk_details.get("evidence") if risk_details else None
        )
        
        if existing_review:
            idx = batch_record.risk_reviews.index(existing_review)
            batch_record.risk_reviews[idx] = review
        else:
            batch_record.risk_reviews.append(review)
        
        batch_record.review_time = datetime.now()
        self._save_reviews()
        
        return review
    
    def batch_review(
        self,
        batch_id: str,
        risk_ids: List[str],
        action: ReviewAction,
        reviewer: str,
        comment: str = "",
        risk_details_map: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> List[RiskReview]:
        """
        批量复核多个风险点
        
        Args:
            batch_id: 批次ID
            risk_ids: 风险ID列表
            action: 复核动作
            reviewer: 复核人
            comment: 通用注释
            risk_details_map: 风险详情映射
            
        Returns:
            复核记录列表
        """
        reviews = []
        for risk_id in risk_ids:
            risk_details = risk_details_map.get(risk_id) if risk_details_map else None
            review = self.review_risk(
                batch_id=batch_id,
                risk_id=risk_id,
                action=action,
                reviewer=reviewer,
                comment=comment,
                risk_details=risk_details
            )
            reviews.append(review)
        return reviews
    
    def get_batch_reviews(self, batch_id: str) -> Optional[BatchReviewRecord]:
        """
        获取批次的所有复核记录
        
        Args:
            batch_id: 批次ID
            
        Returns:
            BatchReviewRecord对象或None
        """
        return self.batch_reviews.get(batch_id)
    
    def get_risk_review(self, batch_id: str, risk_id: str) -> Optional[RiskReview]:
        """
        获取单个风险的复核记录
        
        Args:
            batch_id: 批次ID
            risk_id: 风险ID
            
        Returns:
            RiskReview对象或None
        """
        batch_record = self.batch_reviews.get(batch_id)
        if not batch_record:
            return None
        return next(
            (r for r in batch_record.risk_reviews if r.risk_id == risk_id),
            None
        )
    
    def get_all_reviews(self) -> Dict[str, BatchReviewRecord]:
        """
        获取所有复核记录
        
        Returns:
            批次ID到BatchReviewRecord的映射
        """
        return self.batch_reviews.copy()
    
    def update_overall_comment(
        self,
        batch_id: str,
        comment: str,
        reviewer: str
    ) -> bool:
        """
        更新批次的总体复核注释
        
        Args:
            batch_id: 批次ID
            comment: 注释内容
            reviewer: 复核人
            
        Returns:
            是否成功
        """
        if batch_id not in self.batch_reviews:
            self.batch_reviews[batch_id] = BatchReviewRecord(
                batch_id=batch_id,
                reviewer=reviewer
            )
        
        batch_record = self.batch_reviews[batch_id]
        batch_record.overall_comment = comment
        batch_record.reviewer = reviewer
        batch_record.review_time = datetime.now()
        
        self._save_reviews()
        return True
    
    def get_review_statistics(self) -> Dict[str, Any]:
        """
        获取复核统计信息
        
        Returns:
            统计信息字典
        """
        total_batches = len(self.batch_reviews)
        total_reviews = 0
        confirmed = 0
        dismissed = 0
        pending = 0
        
        risk_type_counts: Dict[str, int] = {}
        severity_counts: Dict[str, int] = {}
        
        for batch_record in self.batch_reviews.values():
            for review in batch_record.risk_reviews:
                total_reviews += 1
                
                if review.new_review_status == ReviewStatus.CONFIRMED.value:
                    confirmed += 1
                elif review.new_review_status == ReviewStatus.DISMISSED.value:
                    dismissed += 1
                else:
                    pending += 1
                
                risk_type_counts[review.risk_type] = risk_type_counts.get(review.risk_type, 0) + 1
                severity_counts[review.severity] = severity_counts.get(review.severity, 0) + 1
        
        return {
            "total_batches_reviewed": total_batches,
            "total_risk_reviews": total_reviews,
            "by_status": {
                "confirmed": confirmed,
                "dismissed": dismissed,
                "pending": pending
            },
            "by_risk_type": risk_type_counts,
            "by_severity": severity_counts
        }
    
    def apply_reviews_to_risk_results(
        self,
        batch_id: str,
        risk_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        将复核记录应用到风险检测结果
        
        Args:
            batch_id: 批次ID
            risk_results: 风险检测结果
            
        Returns:
            更新后的风险结果
        """
        batch_reviews = self.get_batch_reviews(batch_id)
        if not batch_reviews:
            return risk_results
        
        updated_results = risk_results.copy()
        risks = updated_results.get("risks", [])
        
        review_map = {
            review.risk_id: review
            for review in batch_reviews.risk_reviews
        }
        
        for risk in risks:
            risk_id = risk.get("risk_id")
            if risk_id in review_map:
                review = review_map[risk_id]
                risk["review_status"] = review.new_review_status
                risk["review_comment"] = review.review_comment
                risk["reviewer"] = review.reviewer
                risk["review_time"] = review.review_time.isoformat()
                risk["original_review_status"] = review.original_review_status
                
                if review.confidence_override is not None:
                    risk["confidence"] = review.confidence_override
        
        updated_results["risks"] = risks
        
        if batch_reviews.overall_comment:
            updated_results["overall_review"] = {
                "comment": batch_reviews.overall_comment,
                "reviewer": batch_reviews.reviewer,
                "review_time": batch_reviews.review_time.isoformat()
            }
        
        return updated_results


def create_review_store(config: Any) -> ReviewStore:
    """
    根据配置创建复核存储
    
    Args:
        config: 配置对象
        
    Returns:
        ReviewStore对象
    """
    history_dir = config.get_output_directory("history_directory")
    return ReviewStore(str(history_dir))
