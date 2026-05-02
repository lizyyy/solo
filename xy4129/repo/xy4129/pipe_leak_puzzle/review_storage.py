# -*- coding: utf-8 -*-
"""
复核存储模块 - 人工复核与数据持久化
"""

import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict, field
from pathlib import Path


@dataclass
class ReviewRecord:
    """复核记录"""
    status: str = "pending"  # pending, confirmed, rejected, adjusted
    notes: str = ""
    reviewer: str = ""
    reviewed_at: str = field(default_factory=lambda: datetime.now().isoformat())
    adjusted_leak_location: Optional[str] = None
    analysis_summary: Dict[str, Any] = field(default_factory=dict)
    adjustments: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict) -> "ReviewRecord":
        return cls(**data)
    
    def save(self, filepath: str):
        """保存到JSON文件"""
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2, default=str)
    
    @classmethod
    def load(cls, filepath: str) -> "ReviewRecord":
        """从JSON文件加载"""
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls.from_dict(data)


class ReviewManager:
    """复核管理器"""
    
    def __init__(self):
        self.review_history: List[ReviewRecord] = []
    
    def create_review(self,
                      analysis_result: Any,
                      isolation_result: Any,
                      status: str = "pending",
                      notes: str = "",
                      reviewer: str = "") -> ReviewRecord:
        """创建复核记录"""
        # 构建分析摘要
        analysis_summary = {}
        
        if analysis_result:
            if hasattr(analysis_result, "pressure_anomalies"):
                analysis_summary["pressure_anomalies_count"] = len(analysis_result.pressure_anomalies)
            if hasattr(analysis_result, "acoustic_anomalies"):
                analysis_summary["acoustic_anomalies_count"] = len(analysis_result.acoustic_anomalies)
            if hasattr(analysis_result, "filtered_anomalies"):
                analysis_summary["filtered_anomalies_count"] = len(analysis_result.filtered_anomalies)
        
        if isolation_result:
            if hasattr(isolation_result, "suspected_leaks"):
                analysis_summary["suspected_leaks_count"] = len(isolation_result.suspected_leaks)
            if hasattr(isolation_result, "valves_to_close"):
                analysis_summary["valves_to_close_count"] = len(isolation_result.valves_to_close)
            if hasattr(isolation_result, "affected_users"):
                analysis_summary["affected_users_count"] = len(isolation_result.affected_users)
        
        review = ReviewRecord(
            status=status,
            notes=notes,
            reviewer=reviewer,
            analysis_summary=analysis_summary
        )
        
        self.review_history.append(review)
        return review
    
    def confirm(self, review: ReviewRecord, notes: str = "", reviewer: str = ""):
        """确认分析结果"""
        review.status = "confirmed"
        review.notes = notes
        review.reviewer = reviewer
        review.reviewed_at = datetime.now().isoformat()
    
    def reject(self, review: ReviewRecord, notes: str = "", reviewer: str = ""):
        """拒绝分析结果"""
        review.status = "rejected"
        review.notes = notes
        review.reviewer = reviewer
        review.reviewed_at = datetime.now().isoformat()
    
    def adjust(self, review: ReviewRecord, 
               new_leak_location: str,
               notes: str = "",
               reviewer: str = ""):
        """调整漏点位置"""
        review.status = "adjusted"
        review.adjusted_leak_location = new_leak_location
        review.notes = notes
        review.reviewer = reviewer
        review.reviewed_at = datetime.now().isoformat()
        
        # 记录调整
        if "location_adjustments" not in review.adjustments:
            review.adjustments["location_adjustments"] = []
        review.adjustments["location_adjustments"].append({
            "old_location": review.analysis_summary.get("primary_location"),
            "new_location": new_leak_location,
            "adjusted_at": datetime.now().isoformat()
        })
    
    def save_history(self, directory: str):
        """保存复核历史到目录"""
        dir_path = Path(directory)
        dir_path.mkdir(parents=True, exist_ok=True)
        
        for i, review in enumerate(self.review_history):
            filename = f"review_{i+1:03d}_{review.status}_{review.reviewed_at[:10]}.json"
            filepath = dir_path / filename
            review.save(str(filepath))
    
    def load_history(self, directory: str):
        """从目录加载复核历史"""
        dir_path = Path(directory)
        if not dir_path.exists():
            return
        
        self.review_history = []
        
        # 查找所有复核记录文件
        for filepath in sorted(dir_path.glob("review_*.json")):
            try:
                review = ReviewRecord.load(str(filepath))
                self.review_history.append(review)
            except Exception:
                continue
    
    def get_latest_review(self) -> Optional[ReviewRecord]:
        """获取最新的复核记录"""
        if not self.review_history:
            return None
        
        # 按时间排序返回最新的
        sorted_reviews = sorted(
            self.review_history,
            key=lambda x: x.reviewed_at,
            reverse=True
        )
        return sorted_reviews[0]
