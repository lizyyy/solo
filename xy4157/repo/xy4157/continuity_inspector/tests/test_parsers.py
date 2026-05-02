"""
数据解析器测试
"""

import tempfile
import csv
import json
from pathlib import Path
import unittest

from continuity_inspector.parsers.csv_parser import CSVParser
from continuity_inspector.parsers.json_parser import JSONParser
from continuity_inspector.parsers.screenshot_parser import ScreenshotParser
from continuity_inspector.models import (
    CallSheetEntry, ScriptNote, CostumeRule, PropRule,
    ProjectData, ShotStatus, IssueCategory, IssueSeverity
)


class TestCSVParser(unittest.TestCase):
    """CSV解析器测试"""
    
    def setUp(self):
        self.parser = CSVParser()
    
    def test_parse_call_sheet(self):
        """测试解析通告单"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'scene_id', 'shot_number', 'description', 'characters',
                'props', 'scheduled_time', 'location', 'page_count'
            ])
            writer.writeheader()
            writer.writerow({
                'scene_id': '1-01',
                'shot_number': '1',
                'description': '测试镜头',
                'characters': '李雷,韩梅梅',
                'props': '照片,咖啡杯',
                'scheduled_time': '09:00',
                'location': '老街区',
                'page_count': '1.5'
            })
            temp_path = f.name
        
        try:
            entries = self.parser.parse_call_sheet(temp_path)
            
            self.assertEqual(len(entries), 1)
            entry = entries[0]
            self.assertIsInstance(entry, CallSheetEntry)
            self.assertEqual(entry.scene_id, '1-01')
            self.assertEqual(entry.shot_number, '1')
            self.assertEqual(entry.description, '测试镜头')
            self.assertEqual(entry.characters, ['李雷', '韩梅梅'])
            self.assertEqual(entry.props, ['照片', '咖啡杯'])
            self.assertEqual(entry.scheduled_time, '09:00')
            self.assertEqual(entry.location, '老街区')
            self.assertEqual(entry.page_count, 1.5)
        finally:
            Path(temp_path).unlink()
    
    def test_parse_list(self):
        """测试列表解析"""
        result = self.parser._parse_list('李雷, 韩梅梅, 王大爷')
        self.assertEqual(result, ['李雷', '韩梅梅', '王大爷'])
        
        result = self.parser._parse_list('')
        self.assertEqual(result, [])
        
        result = self.parser._parse_list('李雷')
        self.assertEqual(result, ['李雷'])


class TestJSONParser(unittest.TestCase):
    """JSON解析器测试"""
    
    def setUp(self):
        self.parser = JSONParser()
    
    def test_parse_script_notes(self):
        """测试解析场记"""
        data = {
            "script_notes": [
                {
                    "scene_id": "1-01",
                    "shot_number": "1",
                    "take": 1,
                    "status": "已拍摄",
                    "characters": ["李雷"],
                    "costumes": {"李雷": "蓝色西装"},
                    "props": ["旧照片"],
                    "notes": "测试",
                    "shot_date": "2026-05-01",
                    "camera_angle": "中景",
                    "lens": "50mm",
                    "duration": "00:01:00"
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
            temp_path = f.name
        
        try:
            notes = self.parser.parse_script_notes(temp_path)
            
            self.assertEqual(len(notes), 1)
            note = notes[0]
            self.assertIsInstance(note, ScriptNote)
            self.assertEqual(note.scene_id, '1-01')
            self.assertEqual(note.shot_number, '1')
            self.assertEqual(note.take, 1)
            self.assertEqual(note.status, ShotStatus.SHOT)
            self.assertEqual(note.characters, ["李雷"])
            self.assertEqual(note.costumes, {"李雷": "蓝色西装"})
        finally:
            Path(temp_path).unlink()
    
    def test_parse_costume_rules(self):
        """测试解析服装规则"""
        data = {
            "costume_rules": [
                {
                    "character": "李雷",
                    "scene_id": "1-*",
                    "description": "蓝色西装",
                    "accessories": ["手表"],
                    "notes": "测试规则"
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
            temp_path = f.name
        
        try:
            rules = self.parser.parse_costume_rules(temp_path)
            
            self.assertEqual(len(rules), 1)
            rule = rules[0]
            self.assertIsInstance(rule, CostumeRule)
            self.assertEqual(rule.character, '李雷')
            self.assertEqual(rule.scene_id, '1-*')
        finally:
            Path(temp_path).unlink()
    
    def test_parse_prop_rules(self):
        """测试解析道具规则"""
        data = {
            "prop_rules": [
                {
                    "prop_name": "旧照片",
                    "scene_id": "1-01",
                    "required": True,
                    "state": "泛黄",
                    "notes": "关键道具"
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
            temp_path = f.name
        
        try:
            rules = self.parser.parse_prop_rules(temp_path)
            
            self.assertEqual(len(rules), 1)
            rule = rules[0]
            self.assertIsInstance(rule, PropRule)
            self.assertEqual(rule.prop_name, '旧照片')
            self.assertTrue(rule.required)
        finally:
            Path(temp_path).unlink()


class TestScreenshotParser(unittest.TestCase):
    """截图解析器测试"""
    
    def setUp(self):
        self.parser = ScreenshotParser()
    
    def test_extract_from_filename(self):
        """测试从文件名提取信息
        
        命名约定:
        - 下划线 _ 分隔字段: 场景号_镜号_take
        - 连字符 - 是场景号的一部分: 1-01 表示第一幕第一场
        - 镜号可以有 SH 前缀: SH05 → 5
        - take 可以有 T 前缀: T2 → 2
        """
        scene, shot, take = self.parser._extract_from_filename("1-01_01_03.jpg")
        self.assertEqual(scene, '1-01')
        self.assertEqual(shot, '1')
        self.assertEqual(take, 3)
        
        scene, shot, take = self.parser._extract_from_filename("SC101_SH05_T2.png")
        self.assertEqual(scene, 'SC101')
        self.assertEqual(shot, '5')
        self.assertEqual(take, 2)
        
        scene, shot, take = self.parser._extract_from_filename("1-02_008_005.jpg")
        self.assertEqual(scene, '1-02')
        self.assertEqual(shot, '8')
        self.assertEqual(take, 5)
    
    def test_parse_csv(self):
        """测试解析CSV截图清单"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'file_path', 'scene_id', 'shot_number', 'take', 'timestamp'
            ])
            writer.writeheader()
            writer.writerow({
                'file_path': '/test/1-01_01.jpg',
                'scene_id': '1-01',
                'shot_number': '1',
                'take': '1',
                'timestamp': '2026-05-01 10:00:00'
            })
            temp_path = f.name
        
        try:
            screenshots = self.parser._parse_csv(temp_path)
            
            self.assertEqual(len(screenshots), 1)
            screenshot = screenshots[0]
            self.assertEqual(screenshot.file_path, '/test/1-01_01.jpg')
            self.assertEqual(screenshot.scene_id, '1-01')
            self.assertEqual(screenshot.shot_number, '1')
            self.assertEqual(screenshot.take, 1)
        finally:
            Path(temp_path).unlink()


if __name__ == '__main__':
    unittest.main()
