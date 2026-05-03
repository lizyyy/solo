"""
规则引擎模块测试
"""
import pytest
from typing import Dict, List

from reading_recommender.parser_validator import Book, BorrowRecord, ActivityRegistration, ParentFeedback, ForbiddenTheme
from reading_recommender.rules_engine import RulesEngine, CheckResult, RiskLevel, ChildContext


class TestRulesEngine:
    """规则引擎测试"""
    
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
                title="科普1",
                author="作者2",
                category="科普",
                age_group="6-9岁",
                stock=0,
                themes=["科学", "探索"]
            ),
            "B003": Book(
                book_id="B003",
                title="小说1",
                author="作者3",
                category="小说",
                age_group="9-12岁",
                stock=10,
                themes=["暴力", "冒险"]
            ),
            "B004": Book(
                book_id="B004",
                title="童话1",
                author="作者4",
                category="童话",
                age_group="6-9岁",
                stock=3,
                themes=["恐怖", "魔法"]
            ),
        }
        
        self.forbidden_themes: List[ForbiddenTheme] = [
            ForbiddenTheme(
                theme="暴力",
                reason="少儿不宜",
                effective_date="2024-01-01",
                age_groups=[]
            ),
            ForbiddenTheme(
                theme="恐怖",
                reason="心理阴影",
                effective_date="2024-01-01",
                age_groups=["3-6岁", "6-9岁"]
            ),
        ]
        
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
                interests=["绘本", "动物"]
            ),
            ActivityRegistration(
                child_id="C002",
                child_name="小红",
                age=10,
                activity_name="科普小课堂",
                activity_date="2024-01-01",
                parent_phone="13800138001",
                interests=["科学", "探索"]
            ),
        ]
        
        self.feedbacks: List[ParentFeedback] = [
            ParentFeedback(
                child_id="C001",
                feedback_date="2024-01-15",
                content="孩子很喜欢",
                rating=5,
                liked_themes=["动物"],
                disliked_themes=["恐怖"]
            ),
        ]
        
        self.rules_engine = RulesEngine(
            books=self.books,
            forbidden_themes=self.forbidden_themes,
            borrow_records=self.borrow_records,
            activity_registrations=self.activity_registrations,
            feedbacks=self.feedbacks
        )
    
    def test_age_eligibility_match(self):
        """测试年龄段匹配"""
        book = self.books["B001"]
        context = self.rules_engine.get_child_context("C001")
        
        is_match, msg = self.rules_engine.check_age_eligibility(book, context)
        
        assert is_match is True
        assert msg == ""
    
    def test_age_eligibility_mismatch(self):
        """测试年龄段不匹配"""
        book = self.books["B003"]
        context = self.rules_engine.get_child_context("C001")
        
        is_match, msg = self.rules_engine.check_age_eligibility(book, context)
        
        assert is_match is False
        assert "年龄段不匹配" in msg
    
    def test_stock_check_available(self):
        """测试库存充足"""
        book = self.books["B001"]
        
        has_stock, msg = self.rules_engine.check_stock(book)
        
        assert has_stock is True
    
    def test_stock_check_unavailable(self):
        """测试库存不足"""
        book = self.books["B002"]
        
        has_stock, msg = self.rules_engine.check_stock(book)
        
        assert has_stock is False
        assert "库存不足" in msg
    
    def test_duplicate_borrow_check(self):
        """测试重复借阅检测"""
        book = self.books["B001"]
        context = self.rules_engine.get_child_context("C001")
        
        is_unique, msg = self.rules_engine.check_duplicate_borrow(book, context)
        
        assert is_unique is False
        assert "已借阅过" in msg
    
    def test_duplicate_borrow_check_unique(self):
        """测试非重复借阅"""
        book = self.books["B002"]
        context = self.rules_engine.get_child_context("C001")
        
        is_unique, msg = self.rules_engine.check_duplicate_borrow(book, context)
        
        assert is_unique is True
    
    def test_forbidden_themes_global(self):
        """测试全局禁推主题"""
        book = self.books["B003"]
        context = self.rules_engine.get_child_context("C001")
        
        is_safe, issues = self.rules_engine.check_forbidden_themes(book, context)
        
        assert is_safe is False
        assert len(issues) > 0
        assert "暴力" in issues[0]
    
    def test_forbidden_themes_age_specific(self):
        """测试特定年龄段禁推主题"""
        book = self.books["B004"]
        context = self.rules_engine.get_child_context("C001")
        
        is_safe, issues = self.rules_engine.check_forbidden_themes(book, context)
        
        assert is_safe is False
        assert len(issues) > 0
        assert "恐怖" in issues[0]
    
    def test_forbidden_themes_older_age_ok(self):
        """测试大孩子可以看禁推主题"""
        book = self.books["B004"]
        context = self.rules_engine.get_child_context("C002")
        
        is_safe, issues = self.rules_engine.check_forbidden_themes(book, context)
        
        assert is_safe is True
        assert len(issues) == 0
    
    def test_disliked_themes(self):
        """测试不喜欢的主题"""
        book = self.books["B004"]
        context = self.rules_engine.get_child_context("C001")
        
        is_ok, warnings = self.rules_engine.check_disliked_themes(book, context)
        
        assert is_ok is False
        assert len(warnings) > 0
        assert "恐怖" in warnings[0]
    
    def test_cold_start_detection(self):
        """测试冷启动检测"""
        context_with_data = self.rules_engine.get_child_context("C001")
        is_cold, msg = self.rules_engine.check_cold_start(context_with_data)
        assert is_cold is False
        
        context_cold = ChildContext(child_id="C999", is_cold_start=True)
        is_cold, msg = self.rules_engine.check_cold_start(context_cold)
        assert is_cold is True
        assert "冷启动风险" in msg
    
    def test_check_book_all_issues(self):
        """测试单本图书完整检查"""
        result = self.rules_engine.check_book("B001", "C001")
        
        assert result.book_id == "B001"
        assert result.child_id == "C001"
        
        assert len(result.issues) == 1
        assert "重复推荐" in result.issues[0]
    
    def test_check_book_with_forbidden(self):
        """测试包含禁推主题的图书检查"""
        result = self.rules_engine.check_book("B003", "C001")
        
        assert result.is_eligible is False
        assert result.risk_level == RiskLevel.CRITICAL
        
        has_forbidden = any("禁推主题" in issue for issue in result.issues)
        assert has_forbidden is True
    
    def test_check_book_with_zero_stock(self):
        """测试库存为0的图书检查"""
        result = self.rules_engine.check_book("B002", "C001")
        
        assert result.is_eligible is False
        
        has_stock_issue = any("库存不足" in issue for issue in result.issues)
        assert has_stock_issue is True
    
    def test_filter_eligible_books(self):
        """测试过滤不符合规则的图书"""
        eligible = self.rules_engine.filter_eligible_books(
            ["B001", "B002", "B003", "B004"],
            "C001"
        )
        
        assert "B001" not in eligible
        assert "B002" not in eligible
        assert "B003" not in eligible
        assert "B004" not in eligible
    
    def test_get_statistics(self):
        """测试获取统计信息"""
        stats = self.rules_engine.get_statistics()
        
        assert stats["total_children"] == 2
        assert stats["total_books"] == 4
        assert stats["total_forbidden_themes"] == 2
        assert stats["total_borrow_records"] == 1
