import sys
from pathlib import Path
import tempfile
import csv
import json
from datetime import datetime

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import unittest
from parsers.csv_parser import CSVParser
from parsers.json_parser import JSONParser
from models import ScreeningStatus, LogEventType


class TestParsers(unittest.TestCase):
    
    def test_csv_parser_students(self):
        csv_content = """student_id,name,gender,age,grade,class_name,school
S001,张三,男,8,三年级,1班,实验小学
S002,李四,女,9,三年级,1班,实验小学
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = Path(f.name)
        
        try:
            parser = CSVParser()
            students = parser.parse_students(temp_path)
            
            self.assertEqual(len(students), 2)
            self.assertEqual(students[0].student_id, "S001")
            self.assertEqual(students[0].name, "张三")
            self.assertEqual(students[0].age, 8)
            self.assertEqual(students[1].student_id, "S002")
            self.assertEqual(students[1].gender, "女")
            
            self.assertEqual(len(parser.errors), 0)
            
        finally:
            temp_path.unlink()
    
    def test_csv_parser_with_missing_fields(self):
        csv_content = """student_id,name,age
S001,张三,8
S002,李四,9
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = Path(f.name)
        
        try:
            parser = CSVParser()
            students = parser.parse_students(temp_path)
            
            self.assertEqual(len(students), 2)
            self.assertIsNone(students[0].grade)
            self.assertIsNone(students[0].school)
            
        finally:
            temp_path.unlink()
    
    def test_csv_parser_chinese_headers(self):
        csv_content = """学号,姓名,性别,年龄,年级,班级,学校
S001,张三,男,8,三年级,1班,实验小学
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = Path(f.name)
        
        try:
            parser = CSVParser()
            students = parser.parse_students(temp_path)
            
            self.assertEqual(len(students), 1)
            self.assertEqual(students[0].student_id, "S001")
            self.assertEqual(students[0].name, "张三")
            self.assertEqual(students[0].age, 8)
            
        finally:
            temp_path.unlink()
    
    def test_json_parser_screening_results(self):
        json_data = [
            {
                "screening_id": "SR001",
                "student_id": "S001",
                "device_id": "AUD001",
                "screening_date": "2025-04-15 09:30:00",
                "status": "normal",
                "left_ear": {"500": 15, "1000": 10, "2000": 15, "4000": 20, "8000": 15},
                "right_ear": {"500": 10, "1000": 15, "2000": 10, "4000": 15, "8000": 20},
                "left_ear_status": "normal",
                "right_ear_status": "normal"
            },
            {
                "screening_id": "SR002",
                "student_id": "S002",
                "device_id": "AUD001",
                "screening_date": "2025-04-15 09:45:00",
                "status": "refer",
                "left_ear": {"500": 35, "1000": 40, "2000": 45, "4000": 50, "8000": 45},
                "right_ear": {"500": 15, "1000": 10, "2000": 15, "4000": 20, "8000": 15},
                "left_ear_status": "refer",
                "right_ear_status": "normal"
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(json_data, f)
            temp_path = Path(f.name)
        
        try:
            parser = JSONParser()
            results = parser.parse_screening_results(temp_path)
            
            self.assertEqual(len(results), 2)
            self.assertEqual(results[0].screening_id, "SR001")
            self.assertEqual(results[0].left_ear_thresholds[500], 15)
            self.assertEqual(results[0].left_ear_status, ScreeningStatus.NORMAL)
            self.assertIsInstance(results[0].screening_date, datetime)
            
            self.assertEqual(results[1].screening_id, "SR002")
            self.assertEqual(results[1].status, ScreeningStatus.REFER)
            
        finally:
            temp_path.unlink()
    
    def test_json_parser_device_logs(self):
        json_data = [
            {
                "log_id": "LOG001",
                "device_id": "AUD001",
                "timestamp": "2025-04-15 08:00:00",
                "level": "info",
                "event_type": "device_start",
                "message": "设备启动完成",
                "details": {"firmware_version": "2.1.0"}
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(json_data, f)
            temp_path = Path(f.name)
        
        try:
            parser = JSONParser()
            logs = parser.parse_device_logs(temp_path)
            
            self.assertEqual(len(logs), 1)
            self.assertEqual(logs[0].log_id, "LOG001")
            self.assertEqual(logs[0].event_type, LogEventType.DEVICE_START)
            self.assertIsInstance(logs[0].log_timestamp, datetime)
            
        finally:
            temp_path.unlink()
    
    def test_json_parser_with_alias_keys(self):
        json_data = [
            {
                "id": "SR003",
                "学号": "S003",
                "设备ID": "AUD002",
                "筛查日期": "2025-04-15",
                "结果": "通过",
                "左耳": {"500Hz": 20, "1000Hz": 15},
                "右耳": {"500Hz": 15, "1000Hz": 20},
                "左耳结果": "正常",
                "右耳结果": "正常"
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(json_data, f)
            temp_path = Path(f.name)
        
        try:
            parser = JSONParser()
            results = parser.parse_screening_results(temp_path)
            
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0].student_id, "S003")
            self.assertEqual(results[0].status, ScreeningStatus.NORMAL)
            self.assertEqual(results[0].left_ear_thresholds[500], 20)
            self.assertEqual(results[0].left_ear_thresholds[1000], 15)
            
        finally:
            temp_path.unlink()
    
    def test_json_parser_dict_wrapper(self):
        json_data = {
            "results": [
                {
                    "screening_id": "SR004",
                    "student_id": "S004",
                    "device_id": "AUD001",
                    "left_ear": {"500": 15},
                    "right_ear": {"500": 20}
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(json_data, f)
            temp_path = Path(f.name)
        
        try:
            parser = JSONParser()
            results = parser.parse_screening_results(temp_path)
            
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0].screening_id, "SR004")
            
        finally:
            temp_path.unlink()
    
    def test_json_parser_log_chinese_fields(self):
        json_data = [
            {
                "id": "LOG002",
                "设备ID": "AUD003",
                "时间": "2025-04-15 10:00:00",
                "日志级别": "error",
                "事件类型": "error_occurred",
                "消息": "通道通信错误"
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(json_data, f)
            temp_path = Path(f.name)
        
        try:
            parser = JSONParser()
            logs = parser.parse_device_logs(temp_path)
            
            self.assertEqual(len(logs), 1)
            self.assertEqual(logs[0].device_id, "AUD003")
            self.assertEqual(logs[0].message, "通道通信错误")
            
        finally:
            temp_path.unlink()


if __name__ == "__main__":
    unittest.main()
