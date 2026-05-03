"""
解析校验模块测试
"""
import pytest
import tempfile
import os
from pathlib import Path
import csv
import json
import yaml

from reading_recommender.parser_validator import (
    Parser, DataValidator, Book, BorrowRecord, ActivityRegistration, ParentFeedback, ForbiddenTheme
)


class TestDataValidator:
    """数据校验器测试"""
    
    def test_validate_age_valid(self):
        """测试有效年龄"""
        is_valid, msg = DataValidator.validate_age(5)
        assert is_valid is True
        assert msg == ""
    
    def test_validate_age_invalid(self):
        """测试无效年龄"""
        is_valid, msg = DataValidator.validate_age(2)
        assert is_valid is False
        assert "超出合理范围" in msg
        
        is_valid, msg = DataValidator.validate_age(16)
        assert is_valid is False
    
    def test_validate_age_group_valid(self):
        """测试有效年龄段"""
        is_valid, msg = DataValidator.validate_age_group("3-6岁")
        assert is_valid is True
        
        is_valid, msg = DataValidator.validate_age_group("12-15岁")
        assert is_valid is True
    
    def test_validate_age_group_invalid(self):
        """测试无效年龄段"""
        is_valid, msg = DataValidator.validate_age_group("2-5岁")
        assert is_valid is False
    
    def test_validate_stock(self):
        """测试库存校验"""
        is_valid, msg = DataValidator.validate_stock(5)
        assert is_valid is True
        
        is_valid, msg = DataValidator.validate_stock(-1)
        assert is_valid is False
    
    def test_validate_date(self):
        """测试日期校验"""
        is_valid, msg = DataValidator.validate_date("2024-05-01")
        assert is_valid is True
        
        is_valid, msg = DataValidator.validate_date("20240501")
        assert is_valid is True
        
        is_valid, msg = DataValidator.validate_date("invalid")
        assert is_valid is False
    
    def test_validate_rating(self):
        """测试评分校验"""
        is_valid, msg = DataValidator.validate_rating(3)
        assert is_valid is True
        
        is_valid, msg = DataValidator.validate_rating(0)
        assert is_valid is False
        
        is_valid, msg = DataValidator.validate_rating(6)
        assert is_valid is False
    
    def test_get_age_group_by_age(self):
        """测试根据年龄获取年龄段"""
        assert DataValidator.get_age_group_by_age(4) == "3-6岁"
        assert DataValidator.get_age_group_by_age(7) == "6-9岁"
        assert DataValidator.get_age_group_by_age(10) == "9-12岁"
        assert DataValidator.get_age_group_by_age(13) == "12-15岁"
        assert DataValidator.get_age_group_by_age(2) is None
    
    def test_is_age_in_group(self):
        """测试年龄是否属于某个年龄段"""
        assert DataValidator.is_age_in_group(5, "3-6岁") is True
        assert DataValidator.is_age_in_group(3, "3-6岁") is True
        assert DataValidator.is_age_in_group(6, "3-6岁") is True
        assert DataValidator.is_age_in_group(7, "3-6岁") is False


class TestParser:
    """解析器测试"""
    
    def setup_method(self):
        """每个测试前创建临时目录"""
        self.temp_dir = tempfile.mkdtemp()
        self.parser = Parser()
    
    def teardown_method(self):
        """每个测试后清理临时目录"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_parse_books_csv(self):
        """测试解析图书CSV"""
        books_file = Path(self.temp_dir) / "books.csv"
        
        with open(books_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                "book_id", "title", "author", "category", "age_group", "stock", "themes"
            ])
            writer.writeheader()
            writer.writerow({
                "book_id": "B001",
                "title": "测试图书",
                "author": "测试作者",
                "category": "绘本",
                "age_group": "3-6岁",
                "stock": "5",
                "themes": "动物,友谊"
            })
        
        books = self.parser.parse_books_csv(books_file)
        
        assert len(books) == 1
        assert "B001" in books
        
        book = books["B001"]
        assert book.title == "测试图书"
        assert book.age_group == "3-6岁"
        assert book.stock == 5
        assert "动物" in book.themes
        assert "友谊" in book.themes
    
    def test_parse_borrow_csv(self):
        """测试解析借阅CSV"""
        borrow_file = Path(self.temp_dir) / "borrow.csv"
        
        with open(borrow_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                "child_id", "book_id", "borrow_date", "return_date"
            ])
            writer.writeheader()
            writer.writerow({
                "child_id": "C001",
                "book_id": "B001",
                "borrow_date": "2024-01-01",
                "return_date": "2024-01-15"
            })
        
        records = self.parser.parse_borrow_csv(borrow_file)
        
        assert len(records) == 1
        assert records[0].child_id == "C001"
        assert records[0].book_id == "B001"
    
    def test_parse_activity_jsonl(self):
        """测试解析活动报名JSONL"""
        activity_file = Path(self.temp_dir) / "activity.jsonl"
        
        with open(activity_file, 'w', encoding='utf-8') as f:
            f.write(json.dumps({
                "child_id": "C001",
                "child_name": "小明",
                "age": 5,
                "activity_name": "绘本故事会",
                "activity_date": "2024-01-01",
                "parent_phone": "13800138000",
                "interests": ["绘本", "动物"]
            }, ensure_ascii=False) + '\n')
        
        registrations = self.parser.parse_activity_jsonl(activity_file)
        
        assert len(registrations) == 1
        assert registrations[0].child_id == "C001"
        assert registrations[0].child_name == "小明"
        assert registrations[0].age == 5
        assert "绘本" in registrations[0].interests
    
    def test_parse_feedback_csv(self):
        """测试解析家长反馈CSV"""
        feedback_file = Path(self.temp_dir) / "feedback.csv"
        
        with open(feedback_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                "child_id", "feedback_date", "content", "rating", "liked_themes", "disliked_themes"
            ])
            writer.writeheader()
            writer.writerow({
                "child_id": "C001",
                "feedback_date": "2024-01-01",
                "content": "孩子很喜欢",
                "rating": "5",
                "liked_themes": "动物,友谊",
                "disliked_themes": "恐怖"
            })
        
        feedbacks = self.parser.parse_feedback_csv(feedback_file)
        
        assert len(feedbacks) == 1
        assert feedbacks[0].child_id == "C001"
        assert feedbacks[0].rating == 5
        assert "动物" in feedbacks[0].liked_themes
        assert "恐怖" in feedbacks[0].disliked_themes
    
    def test_parse_forbidden_yaml(self):
        """测试解析禁推主题YAML"""
        forbidden_file = Path(self.temp_dir) / "forbidden.yaml"
        
        data = {
            "forbidden_themes": [
                {
                    "theme": "暴力",
                    "reason": "少儿不宜",
                    "effective_date": "2024-01-01",
                    "age_groups": []
                },
                {
                    "theme": "恐怖",
                    "reason": "心理阴影",
                    "effective_date": "2024-01-01",
                    "age_groups": ["3-6岁", "6-9岁"]
                }
            ]
        }
        
        with open(forbidden_file, 'w', encoding='utf-8') as f:
            yaml.dump(data, f, allow_unicode=True)
        
        forbidden = self.parser.parse_forbidden_yaml(forbidden_file)
        
        assert len(forbidden) == 2
        assert forbidden[0].theme == "暴力"
        assert forbidden[1].theme == "恐怖"
        assert "3-6岁" in forbidden[1].age_groups
    
    def test_parse_nonexistent_file(self):
        """测试解析不存在的文件"""
        books = self.parser.parse_books_csv(Path("/nonexistent/path"))
        
        assert len(books) == 0
        assert len(self.parser.get_errors()) > 0
