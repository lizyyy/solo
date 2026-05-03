import unittest
import os
import tempfile
import csv
import json
from datetime import datetime

from backend.modules.parser import DataParser


class TestDataParser(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.parser = DataParser(self.temp_dir)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_parse_complaints_csv(self):
        csv_content = """投诉编号,来电时间,居民姓名,联系电话,所属街道,投诉摘要,紧急程度
CP001,2024-05-01 09:30:00,张三,13800138001,朝阳区,小区夜间施工噪音,紧急
CP002,2024-05-02 10:00:00,李四,13800138002,海淀区,停车位不足,普通"""

        csv_path = os.path.join(self.temp_dir, 'test_complaints.csv')
        with open(csv_path, 'w', encoding='utf-8') as f:
            f.write(csv_content)

        complaints = self.parser.parse_complaints_csv(csv_path)

        self.assertEqual(len(complaints), 2)
        self.assertEqual(complaints[0]['id'], 'CP001')
        self.assertEqual(complaints[0]['district'], '朝阳区')
        self.assertEqual(complaints[0]['urgency'], '紧急')
        self.assertEqual(complaints[1]['resident_name'], '李四')

    def test_parse_work_orders_json(self):
        json_content = [
            {
                "工单编号": "WO001",
                "关联投诉编号": "CP001",
                "创建时间": "2024-05-01 10:00:00",
                "派单部门": "城管部门",
                "处理人": "王队长",
                "处理结果": "已联系施工单位",
                "工单状态": "处理中"
            }
        ]

        json_path = os.path.join(self.temp_dir, 'test_workorders.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(json_content, f)

        work_orders = self.parser.parse_work_orders_json(json_path)

        self.assertEqual(len(work_orders), 1)
        self.assertEqual(work_orders[0]['id'], 'WO001')
        self.assertEqual(work_orders[0]['complaint_id'], 'CP001')
        self.assertEqual(work_orders[0]['assigned_department'], '城管部门')

    def test_parse_keywords_csv(self):
        csv_content = """街道,关键词1,关键词2,关键词3
朝阳区,施工噪音,物业收费,电梯故障
海淀区,停车位,消防通道,物业"""

        csv_path = os.path.join(self.temp_dir, 'test_keywords.csv')
        with open(csv_path, 'w', encoding='utf-8') as f:
            f.write(csv_content)

        keywords = self.parser.parse_keywords_csv(csv_path)

        self.assertIn('朝阳区', keywords)
        self.assertIn('海淀区', keywords)
        self.assertIn('施工噪音', keywords['朝阳区'])
        self.assertIn('停车位', keywords['海淀区'])
        self.assertEqual(len(keywords['朝阳区']), 3)

    def test_parse_datetime_various_formats(self):
        test_cases = [
            ('2024-05-01 09:30:00', True),
            ('2024/05/01 09:30:00', True),
            ('2024-05-01', True),
            ('2024/05/01', True),
            ('2024年05月01日', True),
            ('', False),
            (None, False),
        ]

        for dt_str, should_parse in test_cases:
            result = self.parser._parse_datetime(dt_str)
            if should_parse:
                self.assertIsInstance(result, datetime)
            else:
                self.assertIsNone(result)

    def test_save_uploaded_file(self):
        test_data = b'Test file content'
        filename = 'test.csv'

        saved_path = self.parser.save_uploaded_file(test_data, filename)

        self.assertTrue(os.path.exists(saved_path))
        with open(saved_path, 'rb') as f:
            self.assertEqual(f.read(), test_data)

    def test_missing_columns_complaints(self):
        csv_content = """投诉编号,来电时间,居民姓名
CP001,2024-05-01 09:30:00,张三"""

        csv_path = os.path.join(self.temp_dir, 'invalid.csv')
        with open(csv_path, 'w', encoding='utf-8') as f:
            f.write(csv_content)

        with self.assertRaises(ValueError):
            self.parser.parse_complaints_csv(csv_path)


if __name__ == '__main__':
    unittest.main()
