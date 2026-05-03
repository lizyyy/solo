"""
示例数据模块：生成 init 命令所需的样例数据
"""
import csv
import json
import yaml
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime, timedelta


class SampleDataGenerator:
    """样例数据生成器"""
    
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self._generate_sample_data()
    
    def _generate_sample_data(self):
        """生成所有样例数据"""
        self.books = self._generate_books()
        self.borrow_records = self._generate_borrow_records()
        self.activity_registrations = self._generate_activity_registrations()
        self.feedbacks = self._generate_feedbacks()
        self.forbidden_themes = self._generate_forbidden_themes()
    
    def _generate_books(self) -> List[Dict[str, Any]]:
        """生成图书样例数据"""
        return [
            {"book_id": "B001", "title": "小猪佩奇的一天", "author": "英国广播公司", "category": "绘本", "age_group": "3-6岁", "stock": 5, "themes": "动物,日常生活,友谊"},
            {"book_id": "B002", "title": "汪汪队立大功：救援行动", "author": "斯平尼夫", "category": "动画", "age_group": "3-6岁", "stock": 3, "themes": "救援,团队合作,勇敢"},
            {"book_id": "B003", "title": "猜猜我有多爱你", "author": "山姆·麦克布雷尼", "category": "绘本", "age_group": "3-6岁", "stock": 8, "themes": "亲情,爱,温暖"},
            {"book_id": "B004", "title": "神奇校车：水的旅行", "author": "乔安娜·柯尔", "category": "科普", "age_group": "6-9岁", "stock": 4, "themes": "科学,自然,探索"},
            {"book_id": "B005", "title": "夏洛的网", "author": "E.B.怀特", "category": "童话", "age_group": "6-9岁", "stock": 6, "themes": "友谊,生命,勇气"},
            {"book_id": "B006", "title": "三毛流浪记", "author": "张乐平", "category": "漫画", "age_group": "6-9岁", "stock": 2, "themes": "成长,社会,历史"},
            {"book_id": "B007", "title": "哈利波特与魔法石", "author": "J.K.罗琳", "category": "奇幻", "age_group": "9-12岁", "stock": 10, "themes": "魔法,冒险,友谊"},
            {"book_id": "B008", "title": "小王子", "author": "安托万·德·圣-埃克苏佩里", "category": "童话", "age_group": "9-12岁", "stock": 7, "themes": "成长,责任,爱"},
            {"book_id": "B009", "title": "十万个为什么", "author": "少年儿童出版社", "category": "科普", "age_group": "9-12岁", "stock": 5, "themes": "科学,知识,探索"},
            {"book_id": "B010", "title": "老人与海", "author": "海明威", "category": "文学", "age_group": "12-15岁", "stock": 3, "themes": "勇气,坚持,人生"},
            {"book_id": "B011", "title": "西游记", "author": "吴承恩", "category": "古典", "age_group": "12-15岁", "stock": 4, "themes": "冒险,团队,坚持"},
            {"book_id": "B012", "title": "昆虫记", "author": "法布尔", "category": "科普", "age_group": "12-15岁", "stock": 6, "themes": "自然,昆虫,科学"},
        ]
    
    def _generate_borrow_records(self) -> List[Dict[str, Any]]:
        """生成借阅记录样例数据"""
        today = datetime.now()
        records = [
            {"child_id": "C001", "book_id": "B001", "borrow_date": (today - timedelta(days=10)).strftime("%Y-%m-%d"), "return_date": (today - timedelta(days=3)).strftime("%Y-%m-%d")},
            {"child_id": "C001", "book_id": "B003", "borrow_date": (today - timedelta(days=20)).strftime("%Y-%m-%d"), "return_date": (today - timedelta(days=13)).strftime("%Y-%m-%d")},
            {"child_id": "C002", "book_id": "B004", "borrow_date": (today - timedelta(days=15)).strftime("%Y-%m-%d"), "return_date": (today - timedelta(days=5)).strftime("%Y-%m-%d")},
            {"child_id": "C002", "book_id": "B005", "borrow_date": (today - timedelta(days=25)).strftime("%Y-%m-%d"), "return_date": (today - timedelta(days=18)).strftime("%Y-%m-%d")},
            {"child_id": "C002", "book_id": "B009", "borrow_date": (today - timedelta(days=8)).strftime("%Y-%m-%d"), "return_date": ""},
            {"child_id": "C003", "book_id": "B007", "borrow_date": (today - timedelta(days=12)).strftime("%Y-%m-%d"), "return_date": (today - timedelta(days=2)).strftime("%Y-%m-%d")},
            {"child_id": "C003", "book_id": "B008", "borrow_date": (today - timedelta(days=30)).strftime("%Y-%m-%d"), "return_date": (today - timedelta(days=20)).strftime("%Y-%m-%d")},
            {"child_id": "C005", "book_id": "B010", "borrow_date": (today - timedelta(days=7)).strftime("%Y-%m-%d"), "return_date": ""},
        ]
        return records
    
    def _generate_activity_registrations(self) -> List[Dict[str, Any]]:
        """生成活动报名样例数据"""
        today = datetime.now()
        return [
            {"child_id": "C001", "child_name": "小明", "age": 4, "activity_name": "绘本故事会", "activity_date": (today - timedelta(days=5)).strftime("%Y-%m-%d"), "parent_phone": "13800138001", "interests": ["绘本", "动物", "故事"]},
            {"child_id": "C002", "child_name": "小红", "age": 8, "activity_name": "科普小课堂", "activity_date": (today - timedelta(days=10)).strftime("%Y-%m-%d"), "parent_phone": "13800138002", "interests": ["科学", "自然", "探索"]},
            {"child_id": "C003", "child_name": "小华", "age": 10, "activity_name": "名著阅读分享会", "activity_date": (today - timedelta(days=3)).strftime("%Y-%m-%d"), "parent_phone": "13800138003", "interests": ["文学", "冒险", "奇幻"]},
            {"child_id": "C004", "child_name": "小丽", "age": 5, "activity_name": "亲子阅读日", "activity_date": (today - timedelta(days=7)).strftime("%Y-%m-%d"), "parent_phone": "13800138004", "interests": ["绘本", "亲子", "艺术"]},
            {"child_id": "C006", "child_name": "小强", "age": 13, "activity_name": "青少年阅读俱乐部", "activity_date": (today - timedelta(days=2)).strftime("%Y-%m-%d"), "parent_phone": "13800138006", "interests": ["历史", "文学", "哲学"]},
        ]
    
    def _generate_feedbacks(self) -> List[Dict[str, Any]]:
        """生成家长反馈样例数据"""
        today = datetime.now()
        return [
            {"child_id": "C001", "feedback_date": (today - timedelta(days=2)).strftime("%Y-%m-%d"), "content": "孩子非常喜欢《小猪佩奇》系列，每次都看得很认真。", "rating": 5, "liked_themes": "动物,日常生活", "disliked_themes": ""},
            {"child_id": "C002", "feedback_date": (today - timedelta(days=5)).strftime("%Y-%m-%d"), "content": "《神奇校车》很适合小学生，图文并茂，孩子学到了很多知识。", "rating": 4, "liked_themes": "科学,探索", "disliked_themes": ""},
            {"child_id": "C003", "feedback_date": (today - timedelta(days=3)).strftime("%Y-%m-%d"), "content": "《哈利波特》孩子已经看了三遍了，非常喜欢魔法主题。但对《小王子》兴趣不大。", "rating": 5, "liked_themes": "魔法,冒险", "disliked_themes": "哲学,成长"},
            {"child_id": "C005", "feedback_date": (today - timedelta(days=1)).strftime("%Y-%m-%d"), "content": "《老人与海》对13岁的孩子来说可能有点难理解，但整体内容很好。", "rating": 3, "liked_themes": "勇气", "disliked_themes": "人生"},
        ]
    
    def _generate_forbidden_themes(self) -> Dict[str, List[Dict[str, Any]]]:
        """生成禁推主题样例数据"""
        return {
            "forbidden_themes": [
                {"theme": "暴力", "reason": "少儿不宜", "effective_date": "2024-01-01", "age_groups": []},
                {"theme": "恐怖", "reason": "容易造成心理阴影", "effective_date": "2024-01-01", "age_groups": ["3-6岁", "6-9岁"]},
                {"theme": "爱情", "reason": "超出年龄段理解", "effective_date": "2024-01-01", "age_groups": ["3-6岁", "6-9岁"]},
                {"theme": "战争", "reason": "过于沉重", "effective_date": "2024-01-01", "age_groups": ["3-6岁"]},
            ]
        }
    
    def write_all_files(self) -> Dict[str, Path]:
        """写入所有样例数据文件"""
        files = {}
        
        books_file = self.output_dir / "books.csv"
        self._write_csv(books_file, self.books, ["book_id", "title", "author", "category", "age_group", "stock", "themes"])
        files["books"] = books_file
        
        borrow_file = self.output_dir / "borrow_records.csv"
        self._write_csv(borrow_file, self.borrow_records, ["child_id", "book_id", "borrow_date", "return_date"])
        files["borrow_records"] = borrow_file
        
        activity_file = self.output_dir / "activity_registrations.jsonl"
        self._write_jsonl(activity_file, self.activity_registrations)
        files["activity_registrations"] = activity_file
        
        feedback_file = self.output_dir / "feedbacks.csv"
        self._write_csv(feedback_file, self.feedbacks, ["child_id", "feedback_date", "content", "rating", "liked_themes", "disliked_themes"])
        files["feedbacks"] = feedback_file
        
        forbidden_file = self.output_dir / "forbidden_themes.yaml"
        self._write_yaml(forbidden_file, self.forbidden_themes)
        files["forbidden_themes"] = forbidden_file
        
        return files
    
    def _write_csv(self, filepath: Path, data: List[Dict], fieldnames: List[str]):
        """写入 CSV 文件"""
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)
    
    def _write_jsonl(self, filepath: Path, data: List[Dict]):
        """写入 JSONL 文件"""
        with open(filepath, 'w', encoding='utf-8') as f:
            for item in data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
    
    def _write_yaml(self, filepath: Path, data: Dict):
        """写入 YAML 文件"""
        with open(filepath, 'w', encoding='utf-8') as f:
            yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
