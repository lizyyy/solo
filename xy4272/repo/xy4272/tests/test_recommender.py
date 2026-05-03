"""
推荐模块测试
"""
import pytest
import tempfile
import shutil
from pathlib import Path
from typing import Dict, List

from reading_recommender.parser_validator import Book, BorrowRecord, ActivityRegistration, ParentFeedback, ForbiddenTheme
from reading_recommender.rules_engine import RulesEngine
from reading_recommender.profile_recommender import ProfileBuilder, SimpleRecommender, ChildProfile, Recommendation


class TestProfileBuilder:
    """画像构建器测试"""
    
    def setup_method(self):
        """每个测试前准备测试数据"""
        self.books: Dict[str, Book] = {
            "B001": Book(
                book_id="B001",
                title="绘本1",
                author="作者1",
                category="绘本",
                age_group="3-6岁",
                stock=5,
                themes=["动物", "友谊"]
            ),
            "B002": Book(
                book_id="B002",
                title="绘本2",
                author="作者2",
                category="绘本",
                age_group="3-6岁",
                stock=3,
                themes=["亲情", "爱"]
            ),
            "B003": Book(
                book_id="B003",
                title="科普1",
                author="作者3",
                category="科普",
                age_group="6-9岁",
                stock=10,
                themes=["科学", "探索"]
            ),
        }
        
        self.borrow_records: List[BorrowRecord] = [
            BorrowRecord(
                child_id="C001",
                book_id="B001",
                borrow_date="2024-01-01",
                return_date="2024-01-15"
            ),
            BorrowRecord(
                child_id="C001",
                book_id="B002",
                borrow_date="2024-02-01",
                return_date="2024-02-15"
            ),
        ]
        
        self.activity_registrations: List[ActivityRegistration] = [
            ActivityRegistration(
                child_id="C001",
                child_name="小明",
                age=5,
                activity_name="绘本故事会",
                activity_date="2024-01-01",
                parent_phone="13800138000",
                interests=["绘本", "动物"]
            ),
        ]
        
        self.feedbacks: List[ParentFeedback] = [
            ParentFeedback(
                child_id="C001",
                feedback_date="2024-01-15",
                content="孩子很喜欢",
                rating=5,
                liked_themes=["动物", "友谊"],
                disliked_themes=["恐怖"]
            ),
        ]
        
        self.profile_builder = ProfileBuilder(
            books=self.books,
            borrow_records=self.borrow_records,
            activity_registrations=self.activity_registrations,
            feedbacks=self.feedbacks
        )
    
    def test_build_profile(self):
        """测试构建画像"""
        profile = self.profile_builder.get_profile("C001")
        
        assert profile is not None
        assert profile.child_id == "C001"
        assert profile.name == "小明"
        assert profile.age == 5
        assert profile.age_group == "3-6岁"
        assert profile.borrow_count == 2
        assert profile.activity_count == 1
        assert profile.feedback_count == 1
        assert profile.is_cold_start is False
    
    def test_interest_scores(self):
        """测试兴趣分数计算"""
        profile = self.profile_builder.get_profile("C001")
        
        assert "动物" in profile.interests
        assert "绘本" in profile.interests
        assert len(profile.top_interests) > 0
    
    def test_borrowed_categories(self):
        """测试借阅分类统计"""
        profile = self.profile_builder.get_profile("C001")
        
        assert "绘本" in profile.borrowed_categories
        assert profile.borrowed_categories["绘本"] == 2
    
    def test_borrowed_themes(self):
        """测试借阅主题统计"""
        profile = self.profile_builder.get_profile("C001")
        
        assert "动物" in profile.borrowed_themes
        assert "友谊" in profile.borrowed_themes
        assert "亲情" in profile.borrowed_themes
    
    def test_activity_interests(self):
        """测试活动兴趣"""
        profile = self.profile_builder.get_profile("C001")
        
        assert "绘本" in profile.activity_interests
        assert "动物" in profile.activity_interests
    
    def test_liked_disliked_themes(self):
        """测试喜欢和不喜欢的主题"""
        profile = self.profile_builder.get_profile("C001")
        
        assert "动物" in profile.liked_themes
        assert "友谊" in profile.liked_themes
        assert "恐怖" in profile.disliked_themes
    
    def test_cold_start_user(self):
        """测试冷启动用户"""
        cold_start_ids = self.profile_builder.get_cold_start_children()
        
        assert "C001" not in cold_start_ids
    
    def test_get_all_profiles(self):
        """测试获取所有画像"""
        profiles = self.profile_builder.get_all_profiles()
        
        assert len(profiles) == 1
        assert "C001" in profiles


class TestSimpleRecommender:
    """推荐器测试"""
    
    def setup_method(self):
        """每个测试前准备测试数据"""
        self.books: Dict[str, Book] = {
            "B001": Book(
                book_id="B001",
                title="绘本1",
                author="作者1",
                category="绘本",
                age_group="3-6岁",
                stock=5,
                themes=["动物", "友谊"]
            ),
            "B002": Book(
                book_id="B002",
                title="绘本2",
                author="作者2",
                category="绘本",
                age_group="3-6岁",
                stock=3,
                themes=["亲情", "爱"]
            ),
            "B003": Book(
                book_id="B003",
                title="绘本3",
                author="作者3",
                category="绘本",
                age_group="3-6岁",
                stock=10,
                themes=["动物", "冒险"]
            ),
            "B004": Book(
                book_id="B004",
                title="科普1",
                author="作者4",
                category="科普",
                age_group="6-9岁",
                stock=5,
                themes=["科学", "探索"]
            ),
        }
        
        self.forbidden_themes: List[ForbiddenTheme] = []
        
        self.borrow_records: List[BorrowRecord] = [
            BorrowRecord(
                child_id="C001",
                book_id="B001",
                borrow_date="2024-01-01",
                return_date="2024-01-15"
            ),
        ]
        
        self.activity_registrations: List[ActivityRegistration] = [
            ActivityRegistration(
                child_id="C001",
                child_name="小明",
                age=5,
                activity_name="绘本故事会",
                activity_date="2024-01-01",
                parent_phone="13800138000",
                interests=["动物"]
            ),
        ]
        
        self.feedbacks: List[ParentFeedback] = [
            ParentFeedback(
                child_id="C001",
                feedback_date="2024-01-15",
                content="孩子很喜欢",
                rating=5,
                liked_themes=["动物"],
                disliked_themes=[]
            ),
        ]
        
        self.rules_engine = RulesEngine(
            books=self.books,
            forbidden_themes=self.forbidden_themes,
            borrow_records=self.borrow_records,
            activity_registrations=self.activity_registrations,
            feedbacks=self.feedbacks
        )
        
        self.profile_builder = ProfileBuilder(
            books=self.books,
            borrow_records=self.borrow_records,
            activity_registrations=self.activity_registrations,
            feedbacks=self.feedbacks
        )
        
        self.recommender = SimpleRecommender(
            books=self.books,
            profile_builder=self.profile_builder,
            rules_engine=self.rules_engine
        )
    
    def test_recommend_for_child(self):
        """测试为孩子推荐"""
        recs = self.recommender.recommend_for_child("C001", n=3, use_rules_filter=True)
        
        assert len(recs) > 0
        
        for rec in recs:
            assert rec.book_id in self.books
            assert rec.age_group == "3-6岁"
    
    def test_recommendation_score(self):
        """测试推荐分数"""
        recs = self.recommender.recommend_for_child("C001", n=3, use_rules_filter=False)
        
        for rec in recs:
            assert rec.score >= 0
            assert rec.score <= 1
    
    def test_recommendation_reasons(self):
        """测试推荐理由"""
        recs = self.recommender.recommend_for_child("C001", n=3, use_rules_filter=False)
        
        for rec in recs:
            assert isinstance(rec.reasons, list)
    
    def test_cold_start_recommendation(self):
        """测试冷启动推荐"""
        recs = self.recommender.recommend_for_child("C999", n=3, use_rules_filter=True)
        
        assert len(recs) > 0
        
        for rec in recs:
            has_cold_start_reason = any("冷启动" in reason for reason in rec.reasons)
            assert has_cold_start_reason is True
    
    def test_recommend_for_all_children(self):
        """测试为所有孩子推荐"""
        all_recs = self.recommender.recommend_for_all_children(n=2, use_rules_filter=True)
        
        assert len(all_recs) == 1
        assert "C001" in all_recs
        assert len(all_recs["C001"]) > 0
    
    def test_get_age_group_books(self):
        """测试获取指定年龄段的图书"""
        books_3_6 = self.recommender.get_age_group_books("3-6岁")
        
        assert len(books_3_6) == 3
        for book in books_3_6:
            assert book.age_group == "3-6岁"
            assert book.stock > 0
    
    def test_duplicate_book_filtered(self):
        """测试已借阅图书被过滤"""
        recs = self.recommender.recommend_for_child("C001", n=10, use_rules_filter=True)
        
        for rec in recs:
            assert rec.book_id != "B001"
    
    def test_wrong_age_group_filtered(self):
        """测试错误年龄段图书被过滤"""
        recs = self.recommender.recommend_for_child("C001", n=10, use_rules_filter=True)
        
        for rec in recs:
            assert rec.book_id != "B004"
