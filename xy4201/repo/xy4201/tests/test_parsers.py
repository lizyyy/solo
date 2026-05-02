import unittest
import tempfile
import os
from datetime import datetime
from parsers.temperature_parser import TemperatureParser
from parsers.firing_plan_parser import FiringPlanParser
from parsers.glaze_batch_parser import GlazeBatchParser, WorkPieceParser
from parsers.observation_parser import ObservationParser


class TestTemperatureParser(unittest.TestCase):
    
    def test_parse_valid_csv(self):
        csv_content = """时间,上层,中层,下层
2024-01-15 08:00:00,25.0,24.5,24.8
2024-01-15 08:10:00,80.0,78.5,75.0
2024-01-15 08:20:00,150.0,145.0,138.0"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            parser = TemperatureParser()
            result = parser.parse(temp_path)
            
            self.assertIsNotNone(result)
            self.assertEqual(len(result), 3)
            
            first = result[0]
            self.assertEqual(first.timestamp, datetime(2024, 1, 15, 8, 0, 0))
            self.assertEqual(first.temperatures["上层"], 25.0)
            self.assertEqual(first.elapsed_minutes, 0)
            
            second = result[1]
            self.assertEqual(second.elapsed_minutes, 10)
        finally:
            os.unlink(temp_path)
    
    def test_parse_missing_file(self):
        parser = TemperatureParser()
        result = parser.parse("/nonexistent/path.csv")
        self.assertIsNone(result)
        self.assertTrue(len(parser.errors) > 0)


class TestFiringPlanParser(unittest.TestCase):
    
    def test_parse_valid_json(self):
        json_content = """{
    "plan_id": "FP-2024-001",
    "name": "测试烧成计划",
    "description": "测试用",
    "created_at": "2024-01-10T08:00:00",
    "segments": [
        {
            "segment_id": "S1",
            "name": "预热阶段",
            "start_temperature": 25,
            "end_temperature": 300,
            "rate": 150,
            "hold_time_minutes": 0,
            "description": "预热"
        },
        {
            "segment_id": "S2",
            "name": "保温阶段",
            "start_temperature": 1220,
            "end_temperature": 1220,
            "rate": 0,
            "hold_time_minutes": 30,
            "description": "保温"
        }
    ]
}"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write(json_content)
            temp_path = f.name
        
        try:
            parser = FiringPlanParser()
            result = parser.parse(temp_path)
            
            self.assertIsNotNone(result)
            self.assertEqual(result.plan_id, "FP-2024-001")
            self.assertEqual(len(result.segments), 2)
            self.assertEqual(result.segments[0].rate, 150.0)
            self.assertEqual(result.segments[1].hold_time_minutes, 30)
        finally:
            os.unlink(temp_path)


class TestGlazeBatchParser(unittest.TestCase):
    
    def test_parse_valid_csv(self):
        csv_content = """batch_id,glaze_name,formula,quantity,unit,created_date,expiration_date,notes,status
GB-2024-001,青瓷釉,长石40%,5000,g,2024-01-01,2025-01-01,新批次,可用
GB-2024-002,影青釉,长石45%,3500,g,2023-12-15,2024-12-15,已用部分,可用"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            parser = GlazeBatchParser()
            result = parser.parse(temp_path)
            
            self.assertIsNotNone(result)
            self.assertEqual(len(result), 2)
            self.assertEqual(result[0].batch_id, "GB-2024-001")
            self.assertEqual(result[0].glaze_name, "青瓷釉")
            self.assertTrue(result[0].is_available())
        finally:
            os.unlink(temp_path)


class TestWorkPieceParser(unittest.TestCase):
    
    def test_parse_valid_csv(self):
        csv_content = """work_id,title,artist,glaze_batch_id,shelf_layer,notes,status
W-001,青瓷花瓶,张三,GB-2024-001,上层,手工拉坯,待烧成
W-002,影青茶壶,李四,GB-2024-002,中层,注浆成型,待烧成"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            parser = WorkPieceParser()
            result = parser.parse(temp_path)
            
            self.assertIsNotNone(result)
            self.assertEqual(len(result), 2)
            self.assertEqual(result[0].work_id, "W-001")
            self.assertEqual(result[0].title, "青瓷花瓶")
            self.assertEqual(result[0].glaze_batch_id, "GB-2024-001")
        finally:
            os.unlink(temp_path)


class TestObservationParser(unittest.TestCase):
    
    def test_parse_valid_text(self):
        text_content = """[2024-01-15 09:30:00] 上层温度上升略快 - 张三
[2024-01-15 10:00:00] 进入氧化阶段 - 李四
无时间格式的备注"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(text_content)
            temp_path = f.name
        
        try:
            parser = ObservationParser()
            result = parser.parse(temp_path)
            
            self.assertIsNotNone(result)
            self.assertEqual(len(result), 3)
            
            first = result[0]
            self.assertEqual(first.timestamp, datetime(2024, 1, 15, 9, 30, 0))
            self.assertIn("上层温度上升略快", first.content)
            self.assertEqual(first.author, "张三")
            
            third = result[2]
            self.assertIn("无时间格式", third.content)
        finally:
            os.unlink(temp_path)


if __name__ == "__main__":
    unittest.main()
