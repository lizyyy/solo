import os
import sys
import json
import unittest
from datetime import date, datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from app import create_app, db
from config import config


class TestAPIFlow(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        cls.app = create_app('testing')
        cls.client = cls.app.test_client()
        cls.app_context = cls.app.app_context()
        cls.app_context.push()
        db.create_all()
    
    @classmethod
    def tearDownClass(cls):
        db.session.remove()
        db.drop_all()
        cls.app_context.pop()
    
    def test_01_health_check(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 404)
    
    def test_02_import_contracts(self):
        contracts_data = [
            {
                "contract_code": "TEST_CT001",
                "contract_name": "测试合同1",
                "advertiser_name": "测试广告主",
                "brand_name": "测试品牌A",
                "industry_category": "数码电子",
                "total_amount": 100000,
                "total_duration_seconds": 1800,
                "start_date": "2024-05-01",
                "end_date": "2024-05-31",
                "status": "active"
            }
        ]
        
        import tempfile
        import json
        
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
        json.dump(contracts_data, temp_file)
        temp_file.close()
        
        with open(temp_file.name, 'rb') as f:
            response = self.client.post(
                '/api/import/contract',
                data={'file': (f, 'test_contracts.json')},
                content_type='multipart/form-data'
            )
        
        os.unlink(temp_file.name)
        
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('total'), 1)
        self.assertEqual(data.get('success_count'), 1)
    
    def test_03_list_contracts(self):
        response = self.client.get('/api/query/contracts')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get('success'))
        self.assertGreaterEqual(data.get('count'), 1)
    
    def test_04_import_schedule_events(self):
        events_data = [
            {
                "broadcast_date": "2024-05-03",
                "broadcast_time": "09:00:00",
                "brand_name": "测试品牌A",
                "ad_name": "测试广告1",
                "duration_seconds": 15,
                "industry_category": "数码电子"
            },
            {
                "broadcast_date": "2024-05-03",
                "broadcast_time": "09:05:00",
                "brand_name": "测试品牌A",
                "ad_name": "测试广告2",
                "duration_seconds": 15,
                "industry_category": "数码电子"
            },
            {
                "broadcast_date": "2024-05-03",
                "broadcast_time": "09:10:00",
                "brand_name": "测试品牌A",
                "ad_name": "测试广告3",
                "duration_seconds": 15,
                "industry_category": "数码电子"
            }
        ]
        
        import tempfile
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=[
            '播出日期', '播出时间', '品牌', '广告名称', '时长(秒)', '行业分类', '补播'
        ])
        writer.writeheader()
        for e in events_data:
            writer.writerow({
                '播出日期': e['broadcast_date'],
                '播出时间': e['broadcast_time'],
                '品牌': e['brand_name'],
                '广告名称': e['ad_name'],
                '时长(秒)': e['duration_seconds'],
                '行业分类': e['industry_category'],
                '补播': '否'
            })
        
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
        temp_file.write(output.getvalue())
        temp_file.close()
        
        with open(temp_file.name, 'rb') as f:
            response = self.client.post(
                '/api/import/schedule',
                data={'file': (f, 'test_schedule.csv')},
                content_type='multipart/form-data'
            )
        
        os.unlink(temp_file.name)
        
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('total'), 3)
        self.assertEqual(data.get('success_count'), 3)
    
    def test_05_list_events(self):
        response = self.client.get('/api/query/events?date=2024-05-03')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get('success'))
        self.assertGreaterEqual(data.get('count'), 3)
    
    def test_06_validation_daily(self):
        response = self.client.post(
            '/api/validation/daily',
            json={'date': '2024-05-03'},
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get('success'))
        
        summary = data.get('validation_summary', {})
        self.assertIn('rule_count', summary)
        self.assertIn('error_count', summary)
        self.assertIn('warning_count', summary)
        
        details = data.get('validation_details', [])
        self.assertIsInstance(details, list)
        
        consecutive_check = None
        for r in details:
            if r.get('rule_code') == 'CONSECUTIVE_BRAND':
                consecutive_check = r
                break
        
        self.assertIsNotNone(consecutive_check)
        self.assertFalse(consecutive_check.get('passed'))
    
    def test_07_export_validation_markdown(self):
        response = self.client.get('/api/export/validation/markdown?date=2024-05-03')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get('success'))
        self.assertIn('content', data)
        self.assertIn('# 广告串播合规核查报告', data.get('content', ''))
    
    def test_08_export_problems_csv(self):
        response = self.client.get('/api/export/problems/csv?date=2024-05-03')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get('success'))
        self.assertIn('content', data)
    
    def test_09_export_audit_json(self):
        response = self.client.get('/api/export/audit/json?date=2024-05-03')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get('success'))
        self.assertIn('content', data)
        
        content = data.get('content', {})
        self.assertIn('audit_metadata', content)
        self.assertIn('validation_summary', content)
    
    def test_10_list_validation_rules(self):
        response = self.client.get('/api/validation/rules')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get('success'))
        self.assertIn('rules', data)
        self.assertGreater(len(data.get('rules', [])), 0)
    
    def test_11_add_human_opinion(self):
        events_response = self.client.get('/api/query/events?date=2024-05-03')
        events_data = events_response.get_json()
        events = events_data.get('events', [])
        
        if events:
            event_id = events[0]['id']
            response = self.client.post(
                '/api/opinion/add',
                json={
                    'event_id': event_id,
                    'opinion_type': 'comment',
                    'content': '这是一个测试备注',
                    'reviewer_name': '测试审核员'
                },
                content_type='application/json'
            )
            
            self.assertEqual(response.status_code, 200)
            data = response.get_json()
            self.assertTrue(data.get('success'))
    
    def test_12_list_import_batches(self):
        response = self.client.get('/api/import/batches')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get('success'))
        self.assertIn('batches', data)


class TestRulesEngine(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        cls.app = create_app('testing')
        cls.app_context = cls.app.app_context()
        cls.app_context.push()
        db.create_all()
    
    @classmethod
    def tearDownClass(cls):
        db.session.remove()
        db.drop_all()
        cls.app_context.pop()
    
    def test_consecutive_brand_limit(self):
        from app.services.rules_engine import RulesEngine
        
        self.assertEqual(RulesEngine.MAX_CONSECUTIVE_SAME_BRAND, 2)
        self.assertEqual(RulesEngine.MIN_INTERVAL_SAME_BRAND_SECONDS, 1800)
        self.assertEqual(RulesEngine.MAX_DAILY_FREQUENCY_PER_BRAND, 12)
    
    def test_children_restricted_categories(self):
        from app.services.rules_engine import RulesEngine
        
        self.assertIn('医药', RulesEngine.CHILDREN_PROGRAM_RESTRICTED_CATEGORIES)
        self.assertIn('烟酒', RulesEngine.CHILDREN_PROGRAM_RESTRICTED_CATEGORIES)
        self.assertIn('游戏', RulesEngine.CHILDREN_PROGRAM_RESTRICTED_CATEGORIES)
        self.assertIn('成人用品', RulesEngine.CHILDREN_PROGRAM_RESTRICTED_CATEGORIES)


if __name__ == '__main__':
    unittest.main(verbosity=2)
