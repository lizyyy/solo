"""
复核存储模块
- 人工复核反馈
- 本地历史数据保存
- 增量学习支持
- 历史查询和统计
"""

import os
import json
import glob
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field, asdict
from enum import Enum
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from .rule_fusion import TripRiskResult, RiskLevel
from .model_inference import AnomalyType


class ReviewStatus(Enum):
    """复核状态"""
    PENDING = "待复核"
    CONFIRMED = "已确认"
    REJECTED = "已驳回"
    MODIFIED = "已修改"


class ReviewConclusion(Enum):
    """复核结论"""
    TRUE_POSITIVE = "真阳性（确认为异常）"
    FALSE_POSITIVE = "假阳性（误报）"
    TRUE_NEGATIVE = "真阴性（确认为正常）"
    FALSE_NEGATIVE = "假阴性（漏报）"
    NEED_MORE_DATA = "需更多数据确认"


@dataclass
class FrameReview:
    """单帧复核记录"""
    frame_idx: int
    original_risk: str
    original_score: float
    
    reviewer_comment: str = ""
    review_conclusion: str = ""
    modified_risk: Optional[str] = None
    
    review_time: str = ""
    reviewer: str = ""


@dataclass
class TripReview:
    """单趟复核记录"""
    trip_id: str
    analysis_time: str
    
    original_overall_risk: str
    original_overall_score: float
    
    review_status: str = ReviewStatus.PENDING.value
    review_conclusion: str = ""
    
    frame_reviews: List[FrameReview] = field(default_factory=list)
    
    reviewer: str = ""
    review_time: str = ""
    comments: str = ""
    
    tags: List[str] = field(default_factory=list)
    
    is_used_for_training: bool = False


class ReviewStorage:
    """复核存储管理器"""
    
    STORAGE_VERSIONS = "1.0"
    
    def __init__(self,
                 storage_dir: Optional[str] = None,
                 auto_save: bool = True):
        """
        初始化复核存储
        
        参数:
            storage_dir: 存储目录，默认使用当前目录下的 .review_history
            auto_save: 是否自动保存
        """
        if storage_dir is None:
            storage_dir = os.path.join(os.getcwd(), ".review_history")
        
        self.storage_dir = Path(storage_dir)
        self.auto_save = auto_save
        
        self.trip_reviews: Dict[str, TripReview] = {}
        
        self._ensure_storage_exists()
        self._load_existing_reviews()
    
    def _ensure_storage_exists(self):
        """确保存储目录存在"""
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        data_dir = self.storage_dir / "data"
        data_dir.mkdir(exist_ok=True)
        
        index_dir = self.storage_dir / "index"
        index_dir.mkdir(exist_ok=True)
    
    def _load_existing_reviews(self):
        """加载已有的复核记录"""
        review_files = glob.glob(os.path.join(self.storage_dir, "data", "*.json"))
        
        for filepath in review_files:
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                review = self._dict_to_trip_review(data)
                self.trip_reviews[review.trip_id] = review
                
            except Exception as e:
                print(f"加载复核记录失败 {filepath}: {e}")
        
        print(f"已加载 {len(self.trip_reviews)} 条历史复核记录")
    
    def _dict_to_trip_review(self, data: Dict) -> TripReview:
        """将字典转换为 TripReview 对象"""
        frame_reviews = []
        for fr_data in data.get("frame_reviews", []):
            frame_reviews.append(FrameReview(
                frame_idx=fr_data.get("frame_idx", 0),
                original_risk=fr_data.get("original_risk", ""),
                original_score=fr_data.get("original_score", 0.0),
                reviewer_comment=fr_data.get("reviewer_comment", ""),
                review_conclusion=fr_data.get("review_conclusion", ""),
                modified_risk=fr_data.get("modified_risk"),
                review_time=fr_data.get("review_time", ""),
                reviewer=fr_data.get("reviewer", "")
            ))
        
        return TripReview(
            trip_id=data.get("trip_id", ""),
            analysis_time=data.get("analysis_time", ""),
            original_overall_risk=data.get("original_overall_risk", ""),
            original_overall_score=data.get("original_overall_score", 0.0),
            review_status=data.get("review_status", ReviewStatus.PENDING.value),
            review_conclusion=data.get("review_conclusion", ""),
            frame_reviews=frame_reviews,
            reviewer=data.get("reviewer", ""),
            review_time=data.get("review_time", ""),
            comments=data.get("comments", ""),
            tags=data.get("tags", []),
            is_used_for_training=data.get("is_used_for_training", False)
        )
    
    def create_review_from_risk(self,
                                 risk_result: TripRiskResult,
                                 trip_id: Optional[str] = None) -> TripReview:
        """
        从风险评估结果创建复核记录
        
        参数:
            risk_result: 风险评估结果
            trip_id: 可选的趟次ID
            
        返回:
            TripReview 对象
        """
        actual_trip_id = trip_id or risk_result.trip_id
        
        if actual_trip_id in self.trip_reviews:
            return self.trip_reviews[actual_trip_id]
        
        frame_reviews = []
        for fr in risk_result.frame_results:
            frame_reviews.append(FrameReview(
                frame_idx=fr.frame_idx,
                original_risk=fr.risk_level.value,
                original_score=fr.risk_score
            ))
        
        review = TripReview(
            trip_id=actual_trip_id,
            analysis_time=risk_result.analysis_time,
            original_overall_risk=risk_result.overall_risk.value,
            original_overall_score=risk_result.overall_score,
            frame_reviews=frame_reviews
        )
        
        self.trip_reviews[actual_trip_id] = review
        
        if self.auto_save:
            self._save_review(review)
        
        return review
    
    def submit_review(self,
                      trip_id: str,
                      review_status: ReviewStatus,
                      review_conclusion: ReviewConclusion,
                      reviewer: str = "",
                      comments: str = "",
                      frame_modifications: Optional[Dict[int, Dict]] = None,
                      tags: Optional[List[str]] = None) -> bool:
        """
        提交复核反馈
        
        参数:
            trip_id: 趟次ID
            review_status: 复核状态
            review_conclusion: 复核结论
            reviewer: 复核人
            comments: 总体评论
            frame_modifications: 单帧修改，格式 {frame_idx: {"conclusion": ..., "comment": ..., "modified_risk": ...}}
            tags: 标签列表
            
        返回:
            是否成功
        """
        if trip_id not in self.trip_reviews:
            print(f"未找到趟次复核记录: {trip_id}")
            return False
        
        review = self.trip_reviews[trip_id]
        
        review.review_status = review_status.value
        review.review_conclusion = review_conclusion.value
        review.reviewer = reviewer
        review.review_time = datetime.now().isoformat()
        review.comments = comments
        
        if tags:
            review.tags = tags
        
        if frame_modifications:
            for frame_idx, modifications in frame_modifications.items():
                for fr in review.frame_reviews:
                    if fr.frame_idx == frame_idx:
                        if "conclusion" in modifications:
                            fr.review_conclusion = modifications["conclusion"]
                        if "comment" in modifications:
                            fr.reviewer_comment = modifications["comment"]
                        if "modified_risk" in modifications:
                            fr.modified_risk = modifications["modified_risk"]
                        fr.review_time = datetime.now().isoformat()
                        fr.reviewer = reviewer
                        break
        
        if self.auto_save:
            self._save_review(review)
        
        return True
    
    def _save_review(self, review: TripReview):
        """保存复核记录到文件"""
        data = {
            "version": self.STORAGE_VERSIONS,
            "trip_id": review.trip_id,
            "analysis_time": review.analysis_time,
            "original_overall_risk": review.original_overall_risk,
            "original_overall_score": review.original_overall_score,
            "review_status": review.review_status,
            "review_conclusion": review.review_conclusion,
            "frame_reviews": [
                {
                    "frame_idx": fr.frame_idx,
                    "original_risk": fr.original_risk,
                    "original_score": fr.original_score,
                    "reviewer_comment": fr.reviewer_comment,
                    "review_conclusion": fr.review_conclusion,
                    "modified_risk": fr.modified_risk,
                    "review_time": fr.review_time,
                    "reviewer": fr.reviewer
                }
                for fr in review.frame_reviews
            ],
            "reviewer": review.reviewer,
            "review_time": review.review_time,
            "comments": review.comments,
            "tags": review.tags,
            "is_used_for_training": review.is_used_for_training,
            "saved_at": datetime.now().isoformat()
        }
        
        filename = f"{review.trip_id}_{review.analysis_time.replace(':', '-')}.json"
        filepath = self.storage_dir / "data" / filename
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            self._update_index(review)
            
        except Exception as e:
            print(f"保存复核记录失败: {e}")
    
    def _update_index(self, review: TripReview):
        """更新索引文件"""
        index_file = self.storage_dir / "index" / "review_index.json"
        
        index_data = {}
        if index_file.exists():
            try:
                with open(index_file, 'r', encoding='utf-8') as f:
                    index_data = json.load(f)
            except:
                index_data = {}
        
        index_data[review.trip_id] = {
            "analysis_time": review.analysis_time,
            "review_time": review.review_time,
            "review_status": review.review_status,
            "review_conclusion": review.review_conclusion,
            "original_risk": review.original_overall_risk,
            "tags": review.tags
        }
        
        with open(index_file, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, ensure_ascii=False, indent=2)
    
    def get_review(self, trip_id: str) -> Optional[TripReview]:
        """获取指定趟次的复核记录"""
        return self.trip_reviews.get(trip_id)
    
    def get_pending_reviews(self) -> List[TripReview]:
        """获取待复核的记录"""
        return [
            review for review in self.trip_reviews.values()
            if review.review_status == ReviewStatus.PENDING.value
        ]
    
    def get_reviews_by_status(self, status: ReviewStatus) -> List[TripReview]:
        """按状态获取复核记录"""
        return [
            review for review in self.trip_reviews.values()
            if review.review_status == status.value
        ]
    
    def get_training_data(self) -> Tuple[pd.DataFrame, pd.Series]:
        """
        获取用于模型训练的标签数据
        
        返回:
            (特征DataFrame, 标签Series)
        """
        features_list = []
        labels_list = []
        
        for review in self.trip_reviews.values():
            if review.review_status != ReviewStatus.CONFIRMED.value:
                continue
            
            for fr in review.frame_reviews:
                if not fr.review_conclusion:
                    continue
                
                label = self._conclusion_to_label(fr.review_conclusion)
                
                features_list.append({
                    "frame_idx": fr.frame_idx,
                    "original_score": fr.original_score,
                    "original_risk": fr.original_risk,
                    "review_conclusion": fr.review_conclusion
                })
                labels_list.append(label)
        
        if not features_list:
            return pd.DataFrame(), pd.Series()
        
        return pd.DataFrame(features_list), pd.Series(labels_list)
    
    def _conclusion_to_label(self, conclusion: str) -> int:
        """将复核结论转换为标签"""
        positive_conclusions = [
            ReviewConclusion.TRUE_POSITIVE.value,
            ReviewConclusion.FALSE_NEGATIVE.value
        ]
        negative_conclusions = [
            ReviewConclusion.TRUE_NEGATIVE.value,
            ReviewConclusion.FALSE_POSITIVE.value
        ]
        
        if conclusion in positive_conclusions:
            return 1
        elif conclusion in negative_conclusions:
            return 0
        else:
            return -1
    
    def get_statistics(self) -> Dict:
        """获取复核统计信息"""
        total = len(self.trip_reviews)
        
        status_counts = {}
        conclusion_counts = {}
        risk_distribution = {}
        
        for review in self.trip_reviews.values():
            status = review.review_status
            status_counts[status] = status_counts.get(status, 0) + 1
            
            if review.review_conclusion:
                conclusion_counts[review.review_conclusion] = \
                    conclusion_counts.get(review.review_conclusion, 0) + 1
            
            risk = review.original_overall_risk
            risk_distribution[risk] = risk_distribution.get(risk, 0) + 1
        
        confirmed = status_counts.get(ReviewStatus.CONFIRMED.value, 0)
        pending = status_counts.get(ReviewStatus.PENDING.value, 0)
        
        true_positive = conclusion_counts.get(ReviewConclusion.TRUE_POSITIVE.value, 0)
        false_positive = conclusion_counts.get(ReviewConclusion.FALSE_POSITIVE.value, 0)
        
        if true_positive + false_positive > 0:
            precision = true_positive / (true_positive + false_positive)
        else:
            precision = 0.0
        
        return {
            "total_reviews": total,
            "pending_count": pending,
            "confirmed_count": confirmed,
            "status_distribution": status_counts,
            "conclusion_distribution": conclusion_counts,
            "risk_distribution": risk_distribution,
            "model_precision_estimate": precision,
            "usable_for_training": sum(
                1 for r in self.trip_reviews.values()
                if r.review_status == ReviewStatus.CONFIRMED.value
            )
        }
    
    def query_reviews(self,
                      trip_id_pattern: Optional[str] = None,
                      status: Optional[ReviewStatus] = None,
                      conclusion: Optional[ReviewConclusion] = None,
                      tags: Optional[List[str]] = None,
                      start_time: Optional[str] = None,
                      end_time: Optional[str] = None) -> List[TripReview]:
        """
        按条件查询复核记录
        
        参数:
            trip_id_pattern: 趟次ID模式（包含匹配）
            status: 复核状态
            conclusion: 复核结论
            tags: 标签列表（需要包含所有标签）
            start_time: 开始时间
            end_time: 结束时间
            
        返回:
            匹配的复核记录列表
        """
        results = []
        
        for review in self.trip_reviews.values():
            match = True
            
            if trip_id_pattern and trip_id_pattern not in review.trip_id:
                match = False
            
            if status and review.review_status != status.value:
                match = False
            
            if conclusion and review.review_conclusion != conclusion.value:
                match = False
            
            if tags:
                review_tags = set(review.tags)
                query_tags = set(tags)
                if not query_tags.issubset(review_tags):
                    match = False
            
            if start_time and review.analysis_time < start_time:
                match = False
            
            if end_time and review.analysis_time > end_time:
                match = False
            
            if match:
                results.append(review)
        
        return results
    
    def export_reviews_csv(self, filepath: str) -> bool:
        """
        导出复核记录到CSV
        
        参数:
            filepath: 输出文件路径
            
        返回:
            是否成功
        """
        if not self.trip_reviews:
            print("没有可导出的复核记录")
            return False
        
        rows = []
        for review in self.trip_reviews.values():
            row = {
                "trip_id": review.trip_id,
                "analysis_time": review.analysis_time,
                "original_overall_risk": review.original_overall_risk,
                "original_overall_score": review.original_overall_score,
                "review_status": review.review_status,
                "review_conclusion": review.review_conclusion,
                "reviewer": review.reviewer,
                "review_time": review.review_time,
                "comments": review.comments,
                "tags": ",".join(review.tags),
                "frame_count": len(review.frame_reviews)
            }
            rows.append(row)
        
        try:
            df = pd.DataFrame(rows)
            df.to_csv(filepath, index=False, encoding='utf-8-sig')
            print(f"已导出 {len(rows)} 条复核记录到 {filepath}")
            return True
        except Exception as e:
            print(f"导出CSV失败: {e}")
            return False
    
    def import_reviews_csv(self, filepath: str) -> int:
        """
        从CSV导入复核记录（仅导入摘要信息）
        
        参数:
            filepath: CSV文件路径
            
        返回:
            导入的记录数
        """
        try:
            df = pd.read_csv(filepath)
            imported = 0
            
            for _, row in df.iterrows():
                trip_id = str(row.get("trip_id", f"imported_{imported}"))
                
                if trip_id in self.trip_reviews:
                    continue
                
                review = TripReview(
                    trip_id=trip_id,
                    analysis_time=str(row.get("analysis_time", datetime.now().isoformat())),
                    original_overall_risk=str(row.get("original_overall_risk", "")),
                    original_overall_score=float(row.get("original_overall_score", 0.0)),
                    review_status=str(row.get("review_status", ReviewStatus.PENDING.value)),
                    review_conclusion=str(row.get("review_conclusion", "")),
                    reviewer=str(row.get("reviewer", "")),
                    review_time=str(row.get("review_time", "")),
                    comments=str(row.get("comments", "")),
                    tags=str(row.get("tags", "")).split(",") if pd.notna(row.get("tags")) else []
                )
                
                self.trip_reviews[trip_id] = review
                imported += 1
                
                if self.auto_save:
                    self._save_review(review)
            
            print(f"已导入 {imported} 条复核记录")
            return imported
            
        except Exception as e:
            print(f"导入CSV失败: {e}")
            return 0
    
    def mark_for_training(self, trip_id: str, used: bool = True) -> bool:
        """
        标记复核记录是否用于训练
        
        参数:
            trip_id: 趟次ID
            used: 是否用于训练
            
        返回:
            是否成功
        """
        if trip_id not in self.trip_reviews:
            return False
        
        self.trip_reviews[trip_id].is_used_for_training = used
        
        if self.auto_save:
            self._save_review(self.trip_reviews[trip_id])
        
        return True
    
    def get_review_summary_dataframe(self) -> pd.DataFrame:
        """
        获取复核摘要 DataFrame
        
        返回:
            复核摘要 DataFrame
        """
        if not self.trip_reviews:
            return pd.DataFrame()
        
        rows = []
        for trip_id, review in self.trip_reviews.items():
            high_risk_frames = sum(
                1 for fr in review.frame_reviews
                if "红色" in fr.original_risk or "橙色" in fr.original_risk
            )
            
            reviewed_frames = sum(
                1 for fr in review.frame_reviews
                if fr.review_conclusion
            )
            
            rows.append({
                "trip_id": trip_id,
                "analysis_time": review.analysis_time,
                "original_risk": review.original_overall_risk,
                "original_score": review.original_overall_score,
                "review_status": review.review_status,
                "review_conclusion": review.review_conclusion,
                "reviewer": review.reviewer,
                "review_time": review.review_time,
                "total_frames": len(review.frame_reviews),
                "high_risk_frames": high_risk_frames,
                "reviewed_frames": reviewed_frames,
                "is_used_for_training": review.is_used_for_training,
                "tags": ",".join(review.tags)
            })
        
        return pd.DataFrame(rows)
