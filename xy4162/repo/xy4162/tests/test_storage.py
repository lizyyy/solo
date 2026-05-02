import pytest
import pandas as pd
import os
import sys
import json
import tempfile
import shutil
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.storage import ReviewStorage
import config


class TestReviewStorage:
    def setup_method(self):
        self.test_dir = tempfile.mkdtemp()
        self.storage = ReviewStorage(storage_dir=self.test_dir)
    
    def teardown_method(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
    
    def test_init_creates_directories(self):
        assert os.path.exists(self.test_dir)
        assert os.path.exists(os.path.join(self.test_dir, "reviews.json"))
        assert os.path.exists(os.path.join(self.test_dir, "sessions.json"))
    
    def test_save_review(self):
        risk_id = "test_001"
        review_status = "confirmed"
        review_comment = "已核实该风险，需要跟进"
        
        result = self.storage.save_review(
            risk_id=risk_id,
            review_status=review_status,
            review_comment=review_comment,
            reviewer="测试督导"
        )
        
        assert result["risk_id"] == risk_id
        assert result["review_status"] == review_status
        assert result["review_comment"] == review_comment
        assert "review_time" in result
    
    def test_get_review(self):
        risk_id = "test_002"
        self.storage.save_review(
            risk_id=risk_id,
            review_status="dismissed",
            review_comment="该风险已排除"
        )
        
        review = self.storage.get_review(risk_id)
        assert review is not None
        assert review["risk_id"] == risk_id
        
        non_existent = self.storage.get_review("non_existent")
        assert non_existent is None
    
    def test_get_all_reviews(self):
        self.storage.save_review("risk1", "pending", "")
        self.storage.save_review("risk2", "confirmed", "已确认")
        self.storage.save_review("risk3", "dismissed", "已排除")
        
        reviews = self.storage.get_all_reviews()
        assert len(reviews) == 3
    
    def test_get_reviews_by_status(self):
        self.storage.save_review("risk1", "pending", "")
        self.storage.save_review("risk2", "confirmed", "已确认")
        self.storage.save_review("risk3", "confirmed", "已确认2")
        self.storage.save_review("risk4", "dismissed", "已排除")
        
        pending = self.storage.get_reviews_by_status("pending")
        assert len(pending) == 1
        
        confirmed = self.storage.get_reviews_by_status("confirmed")
        assert len(confirmed) == 2
    
    def test_create_session(self):
        session_id = self.storage.create_session(
            session_name="测试复盘会话",
            stores=["中关村店", "国贸店"],
            machines=["M001"]
        )
        
        assert session_id is not None
        assert len(session_id) == 8
        
        session = self.storage.get_session(session_id)
        assert session is not None
        assert session["session_name"] == "测试复盘会话"
        assert "中关村店" in session["stores"]
        assert session["status"] == "active"
    
    def test_update_session(self):
        session_id = self.storage.create_session(session_name="测试会话")
        
        result = self.storage.update_session(
            session_id=session_id,
            risk_ids=["risk1", "risk2"],
            status="closed"
        )
        
        assert result is True
        
        session = self.storage.get_session(session_id)
        assert session["risk_ids"] == ["risk1", "risk2"]
        assert session["status"] == "closed"
    
    def test_close_session(self):
        session_id = self.storage.create_session(session_name="待关闭会话")
        
        result = self.storage.close_session(session_id)
        assert result is True
        
        session = self.storage.get_session(session_id)
        assert session["status"] == "closed"
    
    def test_export_reviews_to_dataframe(self):
        self.storage.save_review("risk1", "confirmed", "意见1")
        self.storage.save_review("risk2", "dismissed", "意见2")
        
        df = self.storage.export_reviews_to_dataframe()
        
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 2
        assert "risk_id" in df.columns
        assert "review_status" in df.columns
    
    def test_merge_risks_with_reviews(self):
        self.storage.save_review("risk1", "confirmed", "已复核的风险")
        
        risks = [
            {"risk_id": "risk1", "description": "测试风险1"},
            {"risk_id": "risk2", "description": "测试风险2"}
        ]
        
        merged = self.storage.merge_risks_with_reviews(risks)
        
        assert len(merged) == 2
        
        risk1 = [r for r in merged if r["risk_id"] == "risk1"][0]
        assert risk1["review_status"] == "confirmed"
        assert risk1["review_comment"] == "已复核的风险"
        
        risk2 = [r for r in merged if r["risk_id"] == "risk2"][0]
        assert risk2["review_status"] == "pending"
