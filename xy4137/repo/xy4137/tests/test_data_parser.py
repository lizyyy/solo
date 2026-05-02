import unittest
import tempfile
import os
from pathlib import Path
from datetime import datetime

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from data_parser import DataParser, TranscriptRecord, RiskTagRecord, CallbackRecord


class TestDataParser(unittest.TestCase):
    
    def setUp(self):
        self.parser = DataParser()
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_parse_transcript_basic(self):
        transcript_content = """通话ID: CALL_20240501_001
时间: 2024-05-01 19:30:00
来电人: 测试用户
志愿者: 测试志愿者
时长: 10分30秒

----------------------------------------

来电人: 我最近心情有点低落。

志愿者: 您好，我在听您说。
"""
        
        temp_file = Path(self.temp_dir) / "test_transcript.txt"
        temp_file.write_text(transcript_content, encoding='utf-8')
        
        record = self.parser.parse_transcript(temp_file)
        
        self.assertIsInstance(record, TranscriptRecord)
        self.assertEqual(record.call_id, "CALL_20240501_001")
        self.assertIsNotNone(record.timestamp)
        self.assertEqual(record.caller_id, "测试用户")
        self.assertEqual(record.volunteer_id, "测试志愿者")
        self.assertEqual(record.duration_seconds, 630)
        self.assertIn("我最近心情有点低落", record.content)
    
    def test_parse_transcript_without_metadata(self):
        transcript_content = """我最近心情有点低落，想找人聊聊。
工作压力很大，经常加班。
"""
        
        temp_file = Path(self.temp_dir) / "simple_transcript.txt"
        temp_file.write_text(transcript_content, encoding='utf-8')
        
        record = self.parser.parse_transcript(temp_file)
        
        self.assertEqual(record.call_id, "simple_transcript")
        self.assertIn("工作压力很大", record.content)
    
    def test_parse_risk_tags(self):
        csv_content = """call_id,risk_level,tags,confidence,notes,tagged_by,tagged_at
CALL_001,高风险,自杀倾向,0.9,高危案例,张志愿者,2024-05-01 10:00:00
CALL_002,低风险,情绪倾诉,0.7,普通案例,李志愿者,2024-05-01 11:00:00
"""
        
        temp_file = Path(self.temp_dir) / "risk_tags.csv"
        temp_file.write_text(csv_content, encoding='utf-8')
        
        records = self.parser.parse_risk_tags(temp_file)
        
        self.assertEqual(len(records), 2)
        
        record1 = self.parser.risk_tags.get("CALL_001")
        self.assertIsInstance(record1, RiskTagRecord)
        self.assertEqual(record1.risk_level, "高风险")
        self.assertEqual(record1.tags, ["自杀倾向"])
        self.assertEqual(record1.confidence, 0.9)
        self.assertEqual(record1.tagged_by, "张志愿者")
        
        record2 = self.parser.risk_tags.get("CALL_002")
        self.assertEqual(record2.risk_level, "低风险")
    
    def test_parse_risk_tags_chinese_headers(self):
        csv_content = """通话ID,风险等级,标签,置信度,备注,标注人,标注时间
CALL_003,中风险,家庭问题,0.8,需要跟进,王志愿者,2024-05-01 12:00:00
"""
        
        temp_file = Path(self.temp_dir) / "risk_tags_cn.csv"
        temp_file.write_text(csv_content, encoding='utf-8')
        
        records = self.parser.parse_risk_tags(temp_file)
        
        self.assertEqual(len(records), 1)
        record = records[0]
        self.assertEqual(record.call_id, "CALL_003")
        self.assertEqual(record.risk_level, "中风险")
    
    def test_parse_callback_schedule(self):
        csv_content = """call_id,caller_name,callback_time,assigned_volunteer,priority,status,notes
CALL_001,张先生,2024-05-02 10:00:00,张志愿者,紧急,待回访,高危案例
CALL_002,李女士,2024-05-02 14:00:00,李志愿者,正常,待回访,跟进情况
"""
        
        temp_file = Path(self.temp_dir) / "callback.csv"
        temp_file.write_text(csv_content, encoding='utf-8')
        
        records = self.parser.parse_callback_schedule(temp_file)
        
        self.assertEqual(len(records), 2)
        
        record1 = self.parser.callbacks.get("CALL_001")
        self.assertIsInstance(record1, CallbackRecord)
        self.assertEqual(record1.caller_name, "张先生")
        self.assertIsNotNone(record1.callback_time)
        self.assertEqual(record1.assigned_volunteer, "张志愿者")
        self.assertEqual(record1.priority, "紧急")
        self.assertEqual(record1.status, "待回访")
    
    def test_parse_callback_schedule_chinese_headers(self):
        csv_content = """通话ID,来电人姓名,回访时间,分配志愿者,优先级,状态,备注
CALL_003,王先生,2024-05-03 09:00:00,王志愿者,高,已回访,已完成
"""
        
        temp_file = Path(self.temp_dir) / "callback_cn.csv"
        temp_file.write_text(csv_content, encoding='utf-8')
        
        records = self.parser.parse_callback_schedule(temp_file)
        
        self.assertEqual(len(records), 1)
        record = records[0]
        self.assertEqual(record.call_id, "CALL_003")
        self.assertEqual(record.caller_name, "王先生")
    
    def test_get_call_ids(self):
        self.parser.transcripts["CALL_001"] = None
        self.parser.risk_tags["CALL_002"] = None
        self.parser.callbacks["CALL_003"] = None
        
        call_ids = self.parser.get_call_ids()
        
        self.assertEqual(len(call_ids), 3)
        self.assertIn("CALL_001", call_ids)
        self.assertIn("CALL_002", call_ids)
        self.assertIn("CALL_003", call_ids)
    
    def test_get_call_data(self):
        class MockTranscript:
            pass
        
        class MockRiskTag:
            pass
        
        class MockCallback:
            pass
        
        self.parser.transcripts["CALL_001"] = MockTranscript()
        self.parser.risk_tags["CALL_001"] = MockRiskTag()
        self.parser.callbacks["CALL_001"] = MockCallback()
        
        data = self.parser.get_call_data("CALL_001")
        
        self.assertEqual(data["call_id"], "CALL_001")
        self.assertIsNotNone(data["transcript"])
        self.assertIsNotNone(data["risk_tag"])
        self.assertIsNotNone(data["callback"])
    
    def test_parse_datetime_various_formats(self):
        test_cases = [
            ("2024-05-01 10:30:00", True),
            ("2024-05-01 10:30", True),
            ("2024/05/01 10:30:00", True),
            ("2024年05月01日 10:30:00", True),
            ("2024-05-01", True),
            ("2024/05/01", True),
            ("2024年05月01日", True),
            ("invalid", False),
        ]
        
        for dt_str, should_parse in test_cases:
            result = self.parser._parse_datetime(dt_str)
            if should_parse:
                self.assertIsNotNone(result, f"应该能解析: {dt_str}")
            else:
                self.assertIsNone(result, f"不应该解析: {dt_str}")


if __name__ == "__main__":
    unittest.main()
