import unittest
import json
from flask import Flask


def create_test_app():
    from models import SampleStatus, TimeoutCategory
    from core import TimeoutProfiler
    from storage import InMemoryStorage
    from app import register_routes
    
    app = Flask(__name__)
    storage = InMemoryStorage()
    profiler = TimeoutProfiler(storage)
    register_routes(app, storage, profiler)
    
    return app


class TestTimeoutProfileFixes(unittest.TestCase):
    
    def setUp(self):
        self.app = create_test_app()
        self.client = self.app.test_client()
        self.client.testing = True
    
    def test_full_flow_all_fixes(self):
        """完整流程测试所有修复"""
        print("=" * 60)
        print("开始完整流程测试")
        print("=" * 60)
        
        # 1. 创建样本
        print("\n测试1: 创建样本")
        response = self.client.post('/api/samples', 
            json={
                'request_id': 'qc-idx',
                'api_name': 'test_api',
                'total_time_ms': 1500,
                'segments': [
                    {
                        'name': 'db_query',
                        'start_time': 0,
                        'end_time': 1500,
                        'duration_ms': 1500
                    }
                ]
            }
        )
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'analyzed')
        print("✓ 创建样本成功")
        
        # 2. 状态推进时 old_status 显示正确
        print("\n测试2: old_status 正确性")
        response = self.client.post('/api/samples/qc-idx/advance',
            json={'status': 'troubleshooting'}
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['old_status'], 'analyzed', 
                        f"old_status 应该是 'analyzed' 但得到 '{data['old_status']}'")
        self.assertEqual(data['new_status'], 'troubleshooting')
        print("✓ old_status 显示正确")
        
        # 3. 状态筛选一致性
        print("\n测试3: 状态筛选一致性")
        response = self.client.get('/api/samples?status=analyzed')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['count'], 0, 
                        f"status=analyzed 应该返回0个样本，但得到 {data['count']} 个")
        
        response = self.client.get('/api/samples?status=troubleshooting')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['count'], 1,
                        f"status=troubleshooting 应该返回1个样本，但得到 {data['count']} 个")
        print("✓ 状态筛选结果一致")
        
        # 4. 统计信息一致性
        print("\n测试4: 统计信息一致性")
        response = self.client.get('/api/stats')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        self.assertEqual(data['total_samples'], 1, 
                        f"total_samples 应该是1，但得到 {data['total_samples']}")
        
        by_status = data['by_status']
        analyzed_count = by_status.get('analyzed', 0)
        troubleshooting_count = by_status.get('troubleshooting', 0)
        
        self.assertEqual(analyzed_count, 0,
                        f"by_status.analyzed 应该是0，但得到 {analyzed_count}")
        self.assertEqual(troubleshooting_count, 1,
                        f"by_status.troubleshooting 应该是1，但得到 {troubleshooting_count}")
        print("✓ 统计信息一致")
        
        # 5. 非法状态筛选返回400
        print("\n测试5: 非法状态筛选错误处理")
        response = self.client.get('/api/samples?status=invalid_status')
        self.assertEqual(response.status_code, 400,
                        f"非法状态应该返回400，但得到 {response.status_code}")
        data = json.loads(response.data)
        self.assertEqual(data['code'], 'INVALID_STATUS')
        self.assertIn('error', data)
        print("✓ 非法状态筛选返回400且可解释")
        
        # 6. 非法timeout_type返回400
        print("\n测试6: 非法timeout_type筛选错误处理")
        response = self.client.get('/api/samples?timeout_type=invalid_type')
        self.assertEqual(response.status_code, 400,
                        f"非法timeout_type应该返回400，但得到 {response.status_code}")
        data = json.loads(response.data)
        self.assertEqual(data['code'], 'INVALID_TIMEOUT_TYPE')
        print("✓ 非法timeout_type筛选返回400且可解释")
        
        # 7. 重复提交返回409
        print("\n测试7: 重复提交处理")
        response = self.client.post('/api/samples',
            json={
                'request_id': 'qc-idx',
                'api_name': 'test_api',
                'total_time_ms': 100,
                'segments': []
            }
        )
        self.assertEqual(response.status_code, 409,
                        f"重复提交应该返回409，但得到 {response.status_code}")
        data = json.loads(response.data)
        self.assertEqual(data['code'], 'DUPLICATE_SAMPLE')
        print("✓ 重复提交返回409")
        
        # 8. 推进到相同状态不产生变化
        print("\n测试8: 相同状态推进处理")
        response = self.client.post('/api/samples/qc-idx/advance',
            json={'status': 'troubleshooting'}
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('already in target status', data['message'])
        print("✓ 推进到相同状态不产生变化")
        
        print("\n" + "=" * 60)
        print("✅ 所有测试通过！")
        print("=" * 60)


def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestTimeoutProfileFixes)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return result.wasSuccessful()


if __name__ == '__main__':
    run_tests()
