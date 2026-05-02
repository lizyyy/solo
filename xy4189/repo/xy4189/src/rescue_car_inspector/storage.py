"""复核存储模块

用于存储和管理检查结果的复核意见。
"""

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from .rules import CheckResult, CheckCategory, Severity


@dataclass
class ReviewRecord:
    """复核记录类"""
    
    rid: str
    result_id: str
    category: str
    severity: str
    description: str
    status: str = "pending"
    comment: Optional[str] = None
    reviewer: Optional[str] = None
    reviewed_time: Optional[datetime] = None
    created_time: datetime = field(default_factory=datetime.now)
    details: Dict[str, Any] = field(default_factory=dict)
    
    STATUS_OPTIONS = ["pending", "confirmed", "resolved", "dismissed"]
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.rid,
            "result_id": self.result_id,
            "category": self.category,
            "severity": self.severity,
            "description": self.description,
            "status": self.status,
            "comment": self.comment,
            "reviewer": self.reviewer,
            "reviewed_time": self.reviewed_time.isoformat() if self.reviewed_time else None,
            "created_time": self.created_time.isoformat(),
            "details": self.details,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ReviewRecord":
        """从字典创建实例"""
        reviewed_time = None
        if data.get("reviewed_time"):
            try:
                reviewed_time = datetime.fromisoformat(data["reviewed_time"])
            except (ValueError, TypeError):
                pass
        
        created_time = datetime.now()
        if data.get("created_time"):
            try:
                created_time = datetime.fromisoformat(data["created_time"])
            except (ValueError, TypeError):
                pass
        
        return cls(
            rid=data.get("id", data.get("rid", "")),
            result_id=data.get("result_id", ""),
            category=data.get("category", ""),
            severity=data.get("severity", ""),
            description=data.get("description", ""),
            status=data.get("status", "pending"),
            comment=data.get("comment"),
            reviewer=data.get("reviewer"),
            reviewed_time=reviewed_time,
            created_time=created_time,
            details=data.get("details", {}),
        )
    
    @classmethod
    def from_check_result(cls, result: CheckResult) -> "ReviewRecord":
        """从 CheckResult 创建复核记录"""
        return cls(
            rid=result.rid,
            result_id=result.rid,
            category=result.category.value,
            severity=result.severity.value,
            description=result.description,
            details={
                "check_result_details": result.details,
                "affected_items": result.affected_items,
                "suggestion": result.suggestion,
                "check_time": result.check_time.isoformat() if result.check_time else None,
            },
        )


class ReviewStorage:
    """复核存储类"""
    
    def __init__(self):
        self._reviews: Dict[str, ReviewRecord] = {}
        self._created_time = datetime.now()
    
    def add_review(self, result: CheckResult) -> ReviewRecord:
        """添加检查结果到复核存储
        
        Args:
            result: 检查结果
        
        Returns:
            创建的复核记录
        """
        if result.rid in self._reviews:
            return self._reviews[result.rid]
        
        record = ReviewRecord.from_check_result(result)
        self._reviews[record.rid] = record
        return record
    
    def has_review(self, rid: str) -> bool:
        """检查是否存在指定的复核记录
        
        Args:
            rid: 记录ID
        
        Returns:
            是否存在
        """
        return rid in self._reviews
    
    def get_review(self, rid: str) -> Optional[Dict[str, Any]]:
        """获取指定的复核记录
        
        Args:
            rid: 记录ID
        
        Returns:
            复核记录字典，不存在返回 None
        """
        record = self._reviews.get(rid)
        if record:
            return record.to_dict()
        return None
    
    def get_all_reviews(self) -> List[Dict[str, Any]]:
        """获取所有复核记录
        
        Returns:
            复核记录列表
        """
        return [r.to_dict() for r in self._reviews.values()]
    
    def get_reviews_by_status(self, status: str) -> List[Dict[str, Any]]:
        """按状态获取复核记录
        
        Args:
            status: 状态
        
        Returns:
            复核记录列表
        """
        return [
            r.to_dict() for r in self._reviews.values()
            if r.status == status
        ]
    
    def get_reviews_by_severity(self, severity: str) -> List[Dict[str, Any]]:
        """按严重程度获取复核记录
        
        Args:
            severity: 严重程度
        
        Returns:
            复核记录列表
        """
        return [
            r.to_dict() for r in self._reviews.values()
            if r.severity == severity
        ]
    
    def update_review(
        self,
        rid: str,
        status: Optional[str] = None,
        comment: Optional[str] = None,
        reviewer: Optional[str] = None,
        **kwargs,
    ) -> bool:
        """更新复核记录
        
        Args:
            rid: 记录ID
            status: 新状态
            comment: 处理意见
            reviewer: 复核人
            **kwargs: 其他参数
        
        Returns:
            是否更新成功
        """
        if rid not in self._reviews:
            return False
        
        record = self._reviews[rid]
        
        if status and status in ReviewRecord.STATUS_OPTIONS:
            record.status = status
        
        if comment is not None:
            record.comment = comment
        
        if reviewer is not None:
            record.reviewer = reviewer
        
        record.reviewed_time = datetime.now()
        
        return True
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息
        
        Returns:
            统计信息字典
        """
        total = len(self._reviews)
        
        status_counts: Dict[str, int] = {
            "pending": 0,
            "confirmed": 0,
            "resolved": 0,
            "dismissed": 0,
        }
        
        severity_counts: Dict[str, int] = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0,
        }
        
        category_counts: Dict[str, int] = {}
        
        for record in self._reviews.values():
            if record.status in status_counts:
                status_counts[record.status] += 1
            
            if record.severity in severity_counts:
                severity_counts[record.severity] += 1
            
            if record.category not in category_counts:
                category_counts[record.category] = 0
            category_counts[record.category] += 1
        
        return {
            "total": total,
            "by_status": status_counts,
            "by_severity": severity_counts,
            "by_category": category_counts,
            "created_time": self._created_time.isoformat(),
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "reviews": [r.to_dict() for r in self._reviews.values()],
            "statistics": self.get_statistics(),
            "created_time": self._created_time.isoformat(),
        }
    
    def save(self, output_path: Path) -> None:
        """保存到 JSON 文件
        
        Args:
            output_path: 输出文件路径
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2, default=str)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ReviewStorage":
        """从字典创建实例"""
        storage = cls()
        
        if data.get("created_time"):
            try:
                storage._created_time = datetime.fromisoformat(data["created_time"])
            except (ValueError, TypeError):
                pass
        
        for review_data in data.get("reviews", []):
            record = ReviewRecord.from_dict(review_data)
            storage._reviews[record.rid] = record
        
        return storage
    
    @classmethod
    def load(cls, input_path: Path) -> "ReviewStorage":
        """从 JSON 文件加载
        
        Args:
            input_path: 输入文件路径
        
        Returns:
            ReviewStorage 实例
        """
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls.from_dict(data)
