"""复核存储模块 - 持久化人工裁决记录"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum


class ResolutionType(str, Enum):
    CONFIRMED = "确认违规"
    DISMISSED = "忽略/误报"
    PENDING = "待进一步核实"
    MANUAL_OVERRIDE = "人工更正"


@dataclass
class ReviewRecord:
    """人工复核记录"""
    review_id: str
    violation_id: str
    violation_type: str
    bib_number: Optional[str]
    chip_id: Optional[str]
    original_message: str
    resolution: ResolutionType
    reviewer: Optional[str]
    review_time: datetime
    notes: Optional[str]
    evidence: Optional[Dict[str, Any]]
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["review_time"] = self.review_time.isoformat()
        data["resolution"] = self.resolution.value
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ReviewRecord":
        return cls(
            review_id=data["review_id"],
            violation_id=data["violation_id"],
            violation_type=data["violation_type"],
            bib_number=data.get("bib_number"),
            chip_id=data.get("chip_id"),
            original_message=data["original_message"],
            resolution=ResolutionType(data["resolution"]),
            reviewer=data.get("reviewer"),
            review_time=datetime.fromisoformat(data["review_time"]),
            notes=data.get("notes"),
            evidence=data.get("evidence"),
        )


class ReviewStore:
    """复核存储管理器"""
    
    def __init__(self, store_path: Path):
        self.store_path = store_path
        self._reviews: Dict[str, ReviewRecord] = {}
        self._violation_to_review: Dict[str, str] = {}
        self._load()
    
    def _load(self) -> None:
        """从文件加载复核记录"""
        if not self.store_path.exists():
            return
        
        try:
            with open(self.store_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            reviews_data = data.get("reviews", [])
            for review_data in reviews_data:
                review = ReviewRecord.from_dict(review_data)
                self._reviews[review.review_id] = review
                self._violation_to_review[review.violation_id] = review.review_id
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            raise ValueError(f"无法加载复核存储文件: {e}")
    
    def _save(self) -> None:
        """保存复核记录到文件"""
        self.store_path.parent.mkdir(parents=True, exist_ok=True)
        
        data = {
            "version": "1.0",
            "last_updated": datetime.now().isoformat(),
            "reviews": [r.to_dict() for r in self._reviews.values()]
        }
        
        with open(self.store_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def add_review(
        self,
        violation_id: str,
        violation_type: str,
        original_message: str,
        resolution: ResolutionType,
        reviewer: Optional[str] = None,
        notes: Optional[str] = None,
        bib_number: Optional[str] = None,
        chip_id: Optional[str] = None,
        evidence: Optional[Dict[str, Any]] = None,
    ) -> ReviewRecord:
        """添加或更新复核记录
        
        如果该违规已被复核过，则更新现有记录
        """
        if violation_id in self._violation_to_review:
            review_id = self._violation_to_review[violation_id]
            existing = self._reviews[review_id]
            review = ReviewRecord(
                review_id=review_id,
                violation_id=violation_id,
                violation_type=violation_type,
                bib_number=bib_number or existing.bib_number,
                chip_id=chip_id or existing.chip_id,
                original_message=original_message,
                resolution=resolution,
                reviewer=reviewer or existing.reviewer,
                review_time=datetime.now(),
                notes=notes,
                evidence=evidence or existing.evidence,
            )
        else:
            review_id = f"R{uuid.uuid4().hex[:8].upper()}"
            review = ReviewRecord(
                review_id=review_id,
                violation_id=violation_id,
                violation_type=violation_type,
                bib_number=bib_number,
                chip_id=chip_id,
                original_message=original_message,
                resolution=resolution,
                reviewer=reviewer,
                review_time=datetime.now(),
                notes=notes,
                evidence=evidence,
            )
        
        self._reviews[review.review_id] = review
        self._violation_to_review[violation_id] = review.review_id
        self._save()
        
        return review
    
    def get_review(self, violation_id: str) -> Optional[ReviewRecord]:
        """获取指定违规的复核记录"""
        if violation_id in self._violation_to_review:
            return self._reviews[self._violation_to_review[violation_id]]
        return None
    
    def get_all_reviews(self) -> List[ReviewRecord]:
        """获取所有复核记录"""
        return list(self._reviews.values())
    
    def get_reviews_by_resolution(self, resolution: ResolutionType) -> List[ReviewRecord]:
        """按裁决类型获取复核记录"""
        return [r for r in self._reviews.values() if r.resolution == resolution]
    
    def get_reviews_by_bib(self, bib_number: str) -> List[ReviewRecord]:
        """按号码布获取复核记录"""
        return [r for r in self._reviews.values() if r.bib_number == bib_number]
    
    def remove_review(self, violation_id: str) -> bool:
        """删除指定违规的复核记录"""
        if violation_id in self._violation_to_review:
            review_id = self._violation_to_review.pop(violation_id)
            self._reviews.pop(review_id, None)
            self._save()
            return True
        return False
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取复核统计信息"""
        stats = {
            "total_reviews": len(self._reviews),
            "by_resolution": {},
            "by_violation_type": {},
        }
        
        for review in self._reviews.values():
            res_key = review.resolution.value
            if res_key not in stats["by_resolution"]:
                stats["by_resolution"][res_key] = 0
            stats["by_resolution"][res_key] += 1
            
            vt_key = review.violation_type
            if vt_key not in stats["by_violation_type"]:
                stats["by_violation_type"][vt_key] = 0
            stats["by_violation_type"][vt_key] += 1
        
        return stats
