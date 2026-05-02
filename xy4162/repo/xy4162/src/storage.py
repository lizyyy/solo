import pandas as pd
import json
import os
from datetime import datetime
from typing import Dict, List, Optional
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
from .utils import parse_datetime, format_datetime


class ReviewStorage:
    def __init__(self, storage_dir: str = None):
        self.storage_dir = storage_dir or config.STORAGE_DIR
        self.reviews_file = os.path.join(self.storage_dir, "reviews.json")
        self.sessions_file = os.path.join(self.storage_dir, "sessions.json")
        self._ensure_storage()
    
    def _ensure_storage(self):
        os.makedirs(self.storage_dir, exist_ok=True)
        if not os.path.exists(self.reviews_file):
            with open(self.reviews_file, 'w', encoding='utf-8') as f:
                json.dump([], f, ensure_ascii=False, indent=2)
        if not os.path.exists(self.sessions_file):
            with open(self.sessions_file, 'w', encoding='utf-8') as f:
                json.dump([], f, ensure_ascii=False, indent=2)
    
    def _load_reviews(self) -> List[Dict]:
        try:
            with open(self.reviews_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return []
    
    def _save_reviews(self, reviews: List[Dict]):
        with open(self.reviews_file, 'w', encoding='utf-8') as f:
            json.dump(reviews, f, ensure_ascii=False, indent=2, default=str)
    
    def save_review(self, risk_id: str, review_status: str, review_comment: str = "",
                    reviewer: str = "", additional_data: Dict = None) -> Dict:
        reviews = self._load_reviews()
        
        existing = None
        for i, r in enumerate(reviews):
            if r.get("risk_id") == risk_id:
                existing = i
                break
        
        review_data = {
            "risk_id": risk_id,
            "review_status": review_status,
            "review_comment": review_comment,
            "reviewer": reviewer,
            "review_time": format_datetime(datetime.now()),
            "additional_data": additional_data or {}
        }
        
        if existing is not None:
            reviews[existing].update(review_data)
        else:
            reviews.append(review_data)
        
        self._save_reviews(reviews)
        return review_data
    
    def get_review(self, risk_id: str) -> Optional[Dict]:
        reviews = self._load_reviews()
        for r in reviews:
            if r.get("risk_id") == risk_id:
                return r
        return None
    
    def get_all_reviews(self) -> List[Dict]:
        return self._load_reviews()
    
    def get_reviews_by_status(self, status: str) -> List[Dict]:
        reviews = self._load_reviews()
        return [r for r in reviews if r.get("review_status") == status]
    
    def create_session(self, session_name: str = "", stores: List[str] = None,
                       machines: List[str] = None) -> str:
        sessions = self._load_sessions()
        
        session_id = str(uuid.uuid4())[:8]
        session_data = {
            "session_id": session_id,
            "session_name": session_name or f"复盘会话_{session_id}",
            "created_time": format_datetime(datetime.now()),
            "stores": stores or [],
            "machines": machines or [],
            "risk_ids": [],
            "status": "active"
        }
        
        sessions.append(session_data)
        self._save_sessions(sessions)
        
        return session_id
    
    def _load_sessions(self) -> List[Dict]:
        try:
            with open(self.sessions_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return []
    
    def _save_sessions(self, sessions: List[Dict]):
        with open(self.sessions_file, 'w', encoding='utf-8') as f:
            json.dump(sessions, f, ensure_ascii=False, indent=2, default=str)
    
    def get_session(self, session_id: str) -> Optional[Dict]:
        sessions = self._load_sessions()
        for s in sessions:
            if s.get("session_id") == session_id:
                return s
        return None
    
    def update_session(self, session_id: str, risk_ids: List[str] = None,
                       status: str = None) -> bool:
        sessions = self._load_sessions()
        
        for i, s in enumerate(sessions):
            if s.get("session_id") == session_id:
                if risk_ids is not None:
                    s["risk_ids"] = risk_ids
                if status is not None:
                    s["status"] = status
                s["updated_time"] = format_datetime(datetime.now())
                self._save_sessions(sessions)
                return True
        
        return False
    
    def close_session(self, session_id: str) -> bool:
        return self.update_session(session_id, status="closed")
    
    def export_reviews_to_dataframe(self) -> pd.DataFrame:
        reviews = self._load_reviews()
        if not reviews:
            return pd.DataFrame()
        return pd.DataFrame(reviews)
    
    def merge_risks_with_reviews(self, risks: List[Dict]) -> List[Dict]:
        reviews = self._load_reviews()
        review_map = {r["risk_id"]: r for r in reviews}
        
        merged = []
        for risk in risks:
            risk_id = risk.get("risk_id")
            if risk_id in review_map:
                review = review_map[risk_id]
                merged_risk = risk.copy()
                merged_risk.update({
                    "review_status": review.get("review_status", "pending"),
                    "review_comment": review.get("review_comment", ""),
                    "reviewer": review.get("reviewer", ""),
                    "review_time": review.get("review_time", "")
                })
                merged.append(merged_risk)
            else:
                merged.append(risk)
        
        return merged
