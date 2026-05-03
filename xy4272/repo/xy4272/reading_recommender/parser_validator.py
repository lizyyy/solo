"""
解析校验模块：负责解析 CSV、JSONL、YAML 格式的数据，并进行数据校验
"""
import csv
import json
import yaml
import os
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Book:
    """图书信息"""
    book_id: str
    title: str
    author: str
    category: str
    age_group: str
    stock: int = 1
    themes: List[str] = field(default_factory=list)


@dataclass
class BorrowRecord:
    """借阅记录（匿名）"""
    child_id: str
    book_id: str
    borrow_date: str
    return_date: Optional[str] = None


@dataclass
class ActivityRegistration:
    """活动报名记录"""
    child_id: str
    child_name: str
    age: int
    activity_name: str
    activity_date: str
    parent_phone: str
    interests: List[str] = field(default_factory=list)


@dataclass
class ParentFeedback:
    """家长反馈"""
    child_id: str
    feedback_date: str
    content: str
    rating: int
    liked_themes: List[str] = field(default_factory=list)
    disliked_themes: List[str] = field(default_factory=list)


@dataclass
class ForbiddenTheme:
    """禁推主题"""
    theme: str
    reason: str
    effective_date: str
    age_groups: List[str] = field(default_factory=list)


class DataValidator:
    """数据校验器"""
    
    AGE_GROUPS = {
        "3-6岁": (3, 6),
        "6-9岁": (6, 9),
        "9-12岁": (9, 12),
        "12-15岁": (12, 15),
    }
    
    @staticmethod
    def validate_age(age: int) -> Tuple[bool, str]:
        """校验年龄是否在合理范围内"""
        if not isinstance(age, int) or age < 3 or age > 15:
            return False, f"年龄 {age} 超出合理范围 (3-15岁)"
        return True, ""
    
    @staticmethod
    def validate_age_group(age_group: str) -> Tuple[bool, str]:
        """校验年龄段是否有效"""
        if age_group not in DataValidator.AGE_GROUPS:
            return False, f"无效的年龄段: {age_group}，有效范围: {list(DataValidator.AGE_GROUPS.keys())}"
        return True, ""
    
    @staticmethod
    def validate_stock(stock: int) -> Tuple[bool, str]:
        """校验库存是否合理"""
        if not isinstance(stock, int) or stock < 0:
            return False, f"库存 {stock} 无效，必须为非负整数"
        return True, ""
    
    @staticmethod
    def validate_date(date_str: str) -> Tuple[bool, str]:
        """校验日期格式"""
        try:
            if len(date_str) == 10:  # YYYY-MM-DD
                datetime.strptime(date_str, "%Y-%m-%d")
                return True, ""
            elif len(date_str) == 8:  # YYYYMMDD
                datetime.strptime(date_str, "%Y%m%d")
                return True, ""
            else:
                return False, f"无效的日期格式: {date_str}"
        except ValueError:
            return False, f"无效的日期格式: {date_str}"
    
    @staticmethod
    def validate_rating(rating: int) -> Tuple[bool, str]:
        """校验评分"""
        if not isinstance(rating, int) or rating < 1 or rating > 5:
            return False, f"评分 {rating} 无效，必须为 1-5 之间的整数"
        return True, ""
    
    @staticmethod
    def get_age_group_by_age(age: int) -> Optional[str]:
        """根据年龄获取对应的年龄段"""
        for group, (min_age, max_age) in DataValidator.AGE_GROUPS.items():
            if min_age <= age <= max_age:
                return group
        return None
    
    @staticmethod
    def is_age_in_group(age: int, age_group: str) -> bool:
        """判断年龄是否属于某个年龄段"""
        if age_group not in DataValidator.AGE_GROUPS:
            return False
        min_age, max_age = DataValidator.AGE_GROUPS[age_group]
        return min_age <= age <= max_age


class Parser:
    """数据解析器"""
    
    def __init__(self):
        self.validator = DataValidator()
        self.errors: List[str] = []
        self.warnings: List[str] = []
    
    def clear_errors(self):
        """清除错误记录"""
        self.errors = []
        self.warnings = []
    
    def parse_books_csv(self, filepath: Path) -> Dict[str, Book]:
        """
        解析图书 CSV 文件
        期望格式: book_id,title,author,category,age_group,stock,themes
        """
        books: Dict[str, Book] = {}
        self.clear_errors()
        
        if not filepath.exists():
            self.errors.append(f"图书文件不存在: {filepath}")
            return books
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        book_id = row.get('book_id', '').strip()
                        if not book_id:
                            self.errors.append(f"第 {row_num} 行: 缺少 book_id")
                            continue
                        
                        age_group = row.get('age_group', '').strip()
                        is_valid, msg = self.validator.validate_age_group(age_group)
                        if not is_valid:
                            self.errors.append(f"第 {row_num} 行: {msg}")
                            continue
                        
                        stock_str = row.get('stock', '1').strip()
                        stock = int(stock_str) if stock_str else 1
                        is_valid, msg = self.validator.validate_stock(stock)
                        if not is_valid:
                            self.warnings.append(f"第 {row_num} 行: {msg}，使用默认值 1")
                            stock = 1
                        
                        themes_str = row.get('themes', '').strip()
                        themes = [t.strip() for t in themes_str.split(',') if t.strip()] if themes_str else []
                        
                        book = Book(
                            book_id=book_id,
                            title=row.get('title', '').strip(),
                            author=row.get('author', '').strip(),
                            category=row.get('category', '').strip(),
                            age_group=age_group,
                            stock=stock,
                            themes=themes
                        )
                        
                        books[book_id] = book
                        
                    except Exception as e:
                        self.errors.append(f"第 {row_num} 行解析失败: {str(e)}")
                        continue
        
        except Exception as e:
            self.errors.append(f"读取图书文件失败: {str(e)}")
        
        return books
    
    def parse_borrow_csv(self, filepath: Path) -> List[BorrowRecord]:
        """
        解析借阅记录 CSV 文件（匿名）
        期望格式: child_id,book_id,borrow_date,return_date
        """
        records: List[BorrowRecord] = []
        self.clear_errors()
        
        if not filepath.exists():
            self.errors.append(f"借阅记录文件不存在: {filepath}")
            return records
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        child_id = row.get('child_id', '').strip()
                        book_id = row.get('book_id', '').strip()
                        
                        if not child_id or not book_id:
                            self.errors.append(f"第 {row_num} 行: 缺少 child_id 或 book_id")
                            continue
                        
                        borrow_date = row.get('borrow_date', '').strip()
                        if borrow_date:
                            is_valid, msg = self.validator.validate_date(borrow_date)
                            if not is_valid:
                                self.warnings.append(f"第 {row_num} 行: {msg}")
                        
                        return_date = row.get('return_date', '').strip() or None
                        if return_date:
                            is_valid, msg = self.validator.validate_date(return_date)
                            if not is_valid:
                                self.warnings.append(f"第 {row_num} 行: 还书日期 {msg}")
                        
                        record = BorrowRecord(
                            child_id=child_id,
                            book_id=book_id,
                            borrow_date=borrow_date,
                            return_date=return_date
                        )
                        records.append(record)
                        
                    except Exception as e:
                        self.errors.append(f"第 {row_num} 行解析失败: {str(e)}")
                        continue
        
        except Exception as e:
            self.errors.append(f"读取借阅记录文件失败: {str(e)}")
        
        return records
    
    def parse_activity_jsonl(self, filepath: Path) -> List[ActivityRegistration]:
        """
        解析活动报名 JSONL 文件
        每行一个 JSON 对象
        """
        registrations: List[ActivityRegistration] = []
        self.clear_errors()
        
        if not filepath.exists():
            self.errors.append(f"活动报名文件不存在: {filepath}")
            return registrations
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, start=1):
                    line = line.strip()
                    if not line:
                        continue
                    
                    try:
                        data = json.loads(line)
                        
                        child_id = data.get('child_id', '').strip()
                        if not child_id:
                            self.errors.append(f"第 {line_num} 行: 缺少 child_id")
                            continue
                        
                        age = data.get('age', 0)
                        if not isinstance(age, int):
                            try:
                                age = int(age)
                            except (ValueError, TypeError):
                                age = 0
                        
                        is_valid, msg = self.validator.validate_age(age)
                        if not is_valid:
                            self.warnings.append(f"第 {line_num} 行: {msg}")
                        
                        interests = data.get('interests', [])
                        if isinstance(interests, str):
                            interests = [i.strip() for i in interests.split(',') if i.strip()]
                        
                        registration = ActivityRegistration(
                            child_id=child_id,
                            child_name=data.get('child_name', '').strip(),
                            age=age,
                            activity_name=data.get('activity_name', '').strip(),
                            activity_date=data.get('activity_date', '').strip(),
                            parent_phone=data.get('parent_phone', '').strip(),
                            interests=interests
                        )
                        registrations.append(registration)
                        
                    except json.JSONDecodeError as e:
                        self.errors.append(f"第 {line_num} 行 JSON 解析失败: {str(e)}")
                        continue
                    except Exception as e:
                        self.errors.append(f"第 {line_num} 行解析失败: {str(e)}")
                        continue
        
        except Exception as e:
            self.errors.append(f"读取活动报名文件失败: {str(e)}")
        
        return registrations
    
    def parse_feedback_csv(self, filepath: Path) -> List[ParentFeedback]:
        """
        解析家长反馈 CSV 文件
        期望格式: child_id,feedback_date,content,rating,liked_themes,disliked_themes
        """
        feedbacks: List[ParentFeedback] = []
        self.clear_errors()
        
        if not filepath.exists():
            self.errors.append(f"家长反馈文件不存在: {filepath}")
            return feedbacks
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        child_id = row.get('child_id', '').strip()
                        if not child_id:
                            self.errors.append(f"第 {row_num} 行: 缺少 child_id")
                            continue
                        
                        rating_str = row.get('rating', '3').strip()
                        try:
                            rating = int(rating_str)
                        except (ValueError, TypeError):
                            rating = 3
                        
                        is_valid, msg = self.validator.validate_rating(rating)
                        if not is_valid:
                            self.warnings.append(f"第 {row_num} 行: {msg}，使用默认值 3")
                            rating = 3
                        
                        liked_str = row.get('liked_themes', '').strip()
                        liked_themes = [t.strip() for t in liked_str.split(',') if t.strip()] if liked_str else []
                        
                        disliked_str = row.get('disliked_themes', '').strip()
                        disliked_themes = [t.strip() for t in disliked_str.split(',') if t.strip()] if disliked_str else []
                        
                        feedback = ParentFeedback(
                            child_id=child_id,
                            feedback_date=row.get('feedback_date', '').strip(),
                            content=row.get('content', '').strip(),
                            rating=rating,
                            liked_themes=liked_themes,
                            disliked_themes=disliked_themes
                        )
                        feedbacks.append(feedback)
                        
                    except Exception as e:
                        self.errors.append(f"第 {row_num} 行解析失败: {str(e)}")
                        continue
        
        except Exception as e:
            self.errors.append(f"读取家长反馈文件失败: {str(e)}")
        
        return feedbacks
    
    def parse_forbidden_yaml(self, filepath: Path) -> List[ForbiddenTheme]:
        """
        解析禁推主题 YAML 文件
        """
        forbidden_themes: List[ForbiddenTheme] = []
        self.clear_errors()
        
        if not filepath.exists():
            self.errors.append(f"禁推主题文件不存在: {filepath}")
            return forbidden_themes
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                
                if not data:
                    return forbidden_themes
                
                themes_list = data.get('forbidden_themes', [])
                
                for item_num, item in enumerate(themes_list, start=1):
                    try:
                        theme = item.get('theme', '').strip()
                        if not theme:
                            self.errors.append(f"第 {item_num} 个禁推主题: 缺少 theme 字段")
                            continue
                        
                        age_groups = item.get('age_groups', [])
                        if isinstance(age_groups, str):
                            age_groups = [ag.strip() for ag in age_groups.split(',') if ag.strip()]
                        
                        for age_group in age_groups:
                            is_valid, msg = self.validator.validate_age_group(age_group)
                            if not is_valid:
                                self.warnings.append(f"禁推主题 '{theme}': {msg}")
                        
                        forbidden = ForbiddenTheme(
                            theme=theme,
                            reason=item.get('reason', '').strip(),
                            effective_date=item.get('effective_date', '').strip(),
                            age_groups=age_groups
                        )
                        forbidden_themes.append(forbidden)
                        
                    except Exception as e:
                        self.errors.append(f"第 {item_num} 个禁推主题解析失败: {str(e)}")
                        continue
        
        except Exception as e:
            self.errors.append(f"读取禁推主题文件失败: {str(e)}")
        
        return forbidden_themes
    
    def get_errors(self) -> List[str]:
        """获取所有错误"""
        return self.errors
    
    def get_warnings(self) -> List[str]:
        """获取所有警告"""
        return self.warnings
