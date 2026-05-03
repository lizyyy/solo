"""
画像/推荐模块：构建孩子的兴趣画像，实现简单可解释的推荐算法
"""
from typing import Dict, List, Any, Optional, Set, Tuple
from dataclasses import dataclass, field
from collections import defaultdict, Counter
import math

from .parser_validator import (
    Book, BorrowRecord, ActivityRegistration, ParentFeedback, DataValidator
)
from .rules_engine import RulesEngine, ChildContext


@dataclass
class InterestScore:
    """兴趣分数"""
    theme: str
    score: float
    sources: List[str] = field(default_factory=list)


@dataclass
class ChildProfile:
    """孩子的兴趣画像"""
    child_id: str
    name: str = ""
    age: int = 0
    age_group: str = ""
    interests: Dict[str, float] = field(default_factory=dict)
    liked_themes: Set[str] = field(default_factory=set)
    disliked_themes: Set[str] = field(default_factory=set)
    borrowed_categories: Dict[str, int] = field(default_factory=dict)
    borrowed_themes: Dict[str, int] = field(default_factory=dict)
    activity_interests: Set[str] = field(default_factory=set)
    is_cold_start: bool = True
    borrow_count: int = 0
    activity_count: int = 0
    feedback_count: int = 0
    top_interests: List[Tuple[str, float]] = field(default_factory=list)


@dataclass
class Recommendation:
    """单个推荐结果"""
    book_id: str
    title: str
    author: str
    category: str
    age_group: str
    themes: List[str]
    score: float
    reasons: List[str]
    rank: int = 0


class ProfileBuilder:
    """兴趣画像构建器"""
    
    def __init__(
        self,
        books: Dict[str, Book],
        borrow_records: List[BorrowRecord] = None,
        activity_registrations: List[ActivityRegistration] = None,
        feedbacks: List[ParentFeedback] = None
    ):
        self.books = books
        self.borrow_records = borrow_records or []
        self.activity_registrations = activity_registrations or []
        self.feedbacks = feedbacks or []
        self.validator = DataValidator()
        self.profiles: Dict[str, ChildProfile] = {}
        
        self._build_profiles()
    
    def _build_profiles(self):
        """构建所有孩子的画像"""
        child_data: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            'name': '',
            'age': 0,
            'borrowed_books': [],
            'activities': [],
            'feedbacks': [],
        })
        
        for record in self.borrow_records:
            child_data[record.child_id]['borrowed_books'].append(record)
        
        for reg in self.activity_registrations:
            child_data[reg.child_id]['name'] = reg.child_name or child_data[reg.child_id]['name']
            child_data[reg.child_id]['age'] = reg.age if reg.age > 0 else child_data[reg.child_id]['age']
            child_data[reg.child_id]['activities'].append(reg)
        
        for feedback in self.feedbacks:
            child_data[feedback.child_id]['feedbacks'].append(feedback)
        
        for child_id, data in child_data.items():
            profile = self._build_single_profile(child_id, data)
            self.profiles[child_id] = profile
    
    def _build_single_profile(self, child_id: str, data: Dict[str, Any]) -> ChildProfile:
        """构建单个孩子的画像"""
        profile = ChildProfile(child_id=child_id)
        
        profile.name = data['name']
        profile.age = data['age']
        
        if data['age'] > 0:
            age_group = self.validator.get_age_group_by_age(data['age'])
            if age_group:
                profile.age_group = age_group
        
        borrowed_books = data['borrowed_books']
        profile.borrow_count = len(borrowed_books)
        
        for record in borrowed_books:
            book = self.books.get(record.book_id)
            if book:
                if book.category:
                    profile.borrowed_categories[book.category] = profile.borrowed_categories.get(book.category, 0) + 1
                for theme in book.themes:
                    profile.borrowed_themes[theme] = profile.borrowed_themes.get(theme, 0) + 1
        
        activities = data['activities']
        profile.activity_count = len(activities)
        
        for reg in activities:
            for interest in reg.interests:
                profile.activity_interests.add(interest)
        
        feedback_list = data['feedbacks']
        profile.feedback_count = len(feedback_list)
        
        for feedback in feedback_list:
            for theme in feedback.liked_themes:
                profile.liked_themes.add(theme)
            for theme in feedback.disliked_themes:
                profile.disliked_themes.add(theme)
        
        profile.is_cold_start = (
            profile.borrow_count == 0 and 
            profile.activity_count == 0 and 
            profile.feedback_count == 0
        )
        
        self._calculate_interest_scores(profile)
        
        return profile
    
    def _calculate_interest_scores(self, profile: ChildProfile):
        """计算兴趣分数"""
        scores: Dict[str, float] = defaultdict(float)
        sources: Dict[str, List[str]] = defaultdict(list)
        
        total_borrows = max(profile.borrow_count, 1)
        for theme, count in profile.borrowed_themes.items():
            score = (count / total_borrows) * 0.5
            scores[theme] += score
            sources[theme].append(f"借阅历史({count}次)")
        
        for category, count in profile.borrowed_categories.items():
            score = (count / total_borrows) * 0.3
            scores[category] += score
            sources[category].append(f"分类偏好({count}本)")
        
        for interest in profile.activity_interests:
            score = 0.4
            scores[interest] += score
            sources[interest].append("活动报名兴趣")
        
        for theme in profile.liked_themes:
            score = 0.6
            scores[theme] += score
            sources[theme].append("家长反馈喜欢")
        
        profile.interests = dict(scores)
        
        sorted_interests = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        profile.top_interests = sorted_interests[:10]
    
    def get_profile(self, child_id: str) -> Optional[ChildProfile]:
        """获取孩子的画像"""
        return self.profiles.get(child_id)
    
    def get_all_profiles(self) -> Dict[str, ChildProfile]:
        """获取所有孩子的画像"""
        return self.profiles
    
    def get_cold_start_children(self) -> List[str]:
        """获取冷启动孩子ID列表"""
        return [cid for cid, p in self.profiles.items() if p.is_cold_start]


class SimpleRecommender:
    """简单可解释的推荐算法"""
    
    def __init__(
        self,
        books: Dict[str, Book],
        profile_builder: ProfileBuilder,
        rules_engine: RulesEngine
    ):
        self.books = books
        self.profile_builder = profile_builder
        self.rules_engine = rules_engine
        self.validator = DataValidator()
    
    def recommend_for_child(
        self,
        child_id: str,
        n: int = 5,
        use_rules_filter: bool = True
    ) -> List[Recommendation]:
        """
        为单个孩子推荐图书
        
        Args:
            child_id: 孩子ID
            n: 推荐数量
            use_rules_filter: 是否使用规则引擎过滤
            
        Returns:
            推荐列表
        """
        profile = self.profile_builder.get_profile(child_id)
        
        if profile is None:
            profile = ChildProfile(child_id=child_id, is_cold_start=True)
        
        candidate_books = self._get_candidate_books(profile)
        
        if use_rules_filter:
            eligible_ids = self.rules_engine.filter_eligible_books(
                [b.book_id for b in candidate_books],
                child_id
            )
            candidate_books = [b for b in candidate_books if b.book_id in eligible_ids]
        
        scored_books = []
        for book in candidate_books:
            score, reasons = self._calculate_recommendation_score(book, profile)
            if score > 0 or profile.is_cold_start:
                scored_books.append((book, score, reasons))
        
        scored_books.sort(key=lambda x: x[1], reverse=True)
        
        recommendations = []
        for rank, (book, score, reasons) in enumerate(scored_books[:n], start=1):
            rec = Recommendation(
                book_id=book.book_id,
                title=book.title,
                author=book.author,
                category=book.category,
                age_group=book.age_group,
                themes=book.themes,
                score=round(score, 3),
                reasons=reasons,
                rank=rank
            )
            recommendations.append(rec)
        
        return recommendations
    
    def _get_candidate_books(self, profile: ChildProfile) -> List[Book]:
        """获取候选图书"""
        candidates = []
        
        for book_id, book in self.books.items():
            if profile.age_group:
                if book.age_group != profile.age_group:
                    continue
            elif profile.age > 0:
                if not self.validator.is_age_in_group(profile.age, book.age_group):
                    continue
            
            if book.stock <= 0:
                continue
            
            candidates.append(book)
        
        if not candidates:
            candidates = list(self.books.values())
        
        return candidates
    
    def _calculate_recommendation_score(
        self,
        book: Book,
        profile: ChildProfile
    ) -> Tuple[float, List[str]]:
        """
        计算推荐分数和理由
        
        使用可解释的规则评分：
        1. 主题匹配：基于借阅历史、活动兴趣、家长反馈
        2. 分类匹配：基于借阅历史的分类偏好
        3. 冷启动处理：基于年龄段和热门图书
        """
        score = 0.0
        reasons = []
        
        if profile.is_cold_start:
            score = 0.3
            reasons.append("冷启动推荐：基于年龄段匹配")
            
            if book.stock > 5:
                score += 0.2
                reasons.append("库存充足")
            
            return score, reasons
        
        book_themes = set(book.themes)
        book_category = book.category
        
        for theme in book_themes:
            if theme in profile.interests:
                theme_score = profile.interests[theme] * 2
                score += theme_score
                if theme in profile.liked_themes:
                    reasons.append(f"主题匹配：喜欢'{theme}'")
                elif theme in profile.borrowed_themes:
                    reasons.append(f"主题匹配：曾借阅'{theme}'相关图书")
                elif theme in profile.activity_interests:
                    reasons.append(f"主题匹配：活动兴趣'{theme}'")
        
        if book_category and book_category in profile.interests:
            cat_score = profile.interests[book_category] * 1.5
            score += cat_score
            reasons.append(f"分类匹配：偏好{book_category}类图书")
        
        if book_category in profile.borrowed_categories:
            count = profile.borrowed_categories[book_category]
            score += min(count * 0.1, 0.5)
            reasons.append(f"历史偏好：曾借阅{count}本{book_category}类图书")
        
        for theme in book_themes:
            if theme in profile.disliked_themes:
                score -= 0.5
                reasons.append(f"注意：包含不喜欢的主题'{theme}'")
        
        if book.stock > 3:
            score += 0.1
        
        score = max(0, min(score, 1.0))
        
        return score, reasons
    
    def recommend_for_all_children(
        self,
        child_ids: List[str] = None,
        n: int = 5,
        use_rules_filter: bool = True
    ) -> Dict[str, List[Recommendation]]:
        """
        为所有孩子推荐图书
        
        Args:
            child_ids: 孩子ID列表，为 None 则使用所有有画像的孩子
            n: 每个孩子的推荐数量
            use_rules_filter: 是否使用规则引擎过滤
            
        Returns:
            字典，key 为 child_id，value 为推荐列表
        """
        if child_ids is None:
            child_ids = list(self.profile_builder.get_all_profiles().keys())
        
        all_recommendations = {}
        
        for child_id in child_ids:
            recs = self.recommend_for_child(child_id, n, use_rules_filter)
            all_recommendations[child_id] = recs
        
        return all_recommendations
    
    def get_popular_books(self, top_n: int = 10) -> List[Tuple[Book, int]]:
        """
        获取热门图书（基于借阅统计）
        
        Args:
            top_n: 返回前 N 本
            
        Returns:
            列表，每个元素为 (图书, 借阅次数)
        """
        borrow_counts: Dict[str, int] = defaultdict(int)
        
        for record in self.profile_builder.borrow_records:
            borrow_counts[record.book_id] += 1
        
        sorted_books = sorted(
            [(self.books.get(bid), cnt) for bid, cnt in borrow_counts.items() if self.books.get(bid)],
            key=lambda x: x[1],
            reverse=True
        )
        
        return sorted_books[:top_n]
    
    def get_age_group_books(self, age_group: str) -> List[Book]:
        """
        获取指定年龄段的图书
        
        Args:
            age_group: 年龄段，如 "3-6岁"
            
        Returns:
            图书列表
        """
        return [
            book for book in self.books.values()
            if book.age_group == age_group and book.stock > 0
        ]
