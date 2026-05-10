#!/usr/bin/env python3
import sys
import os
import json
import unittest
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests

BASE_URL = 'http://localhost:5000/api/v1'


class TestPatrolAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print('\n' + '='*60)
        print('开始运行 API 测试套件')
        print('='*60)
        
        try:
            requests.get(f'{BASE_URL}/routes/points', timeout=5)
        except:
            print('\n错误：后端服务未启动！')
            print('请先运行: python run.py')
            sys.exit(1)
    
    def test_1_basic_data_exists(self):
        print('\n--- 测试1: 检查基础数据是否存在 ---')
        
        resp = requests.get(f'{BASE_URL}/routes/caregivers')
        self.assertEqual(resp.status_code, 200)
        caregivers = resp.json()['data']
        print(f'  护理员数量: {len(caregivers)}')
        self.assertTrue(len(caregivers) >= 4)
        
        resp = requests.get(f'{BASE_URL}/routes/points')
        self.assertEqual(resp.status_code, 200)
        points = resp.json()['data']
        print(f'  巡更点数量: {len(points)}')
        self.assertTrue(len(points) >= 8)
        
        resp = requests.get(f'{BASE_URL}/routes')
        self.assertEqual(resp.status_code, 200)
        routes = resp.json()['data']
        print(f'  巡更路线数量: {len(routes)}')
        self.assertTrue(len(routes) >= 2)
    
    def test_2_checkin_flow(self):
        print('\n--- 测试2: 打卡流程 ---')
        
        caregivers = requests.get(f'{BASE_URL}/routes/caregivers').json()['data']
        points = requests.get(f'{BASE_URL}/routes/points').json()['data']
        routes = requests.get(f'{BASE_URL}/routes').json()['data']
        
        caregiver_id = next((c['id'] for c in caregivers if c['employee_id'] == 'CG003'), None)
        point_id = points[0]['id']
        route_id = routes[0]['id']
        
        today = datetime.now().strftime('%Y-%m-%d')
        checkin_time = f'{today} 22:30:00'
        
        checkin_data = {
            'route_id': route_id,
            'point_id': point_id,
            'caregiver_id': caregiver_id,
            'checkin_time': checkin_time,
            'checkin_type': 'normal'
        }
        
        resp = requests.post(f'{BASE_URL}/checkins', json=checkin_data)
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.json()['success'])
        print(f'  打卡成功: {resp.json()["data"]["id"]}')
        
        checkin_id = resp.json()['data']['id']
        
        resp2 = requests.get(f'{BASE_URL}/checkins/{checkin_id}')
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.json()['data']['id'], checkin_id)
        print(f'  查询打卡记录成功')
    
    def test_3_supplement_flow(self):
        print('\n--- 测试3: 补录审核流程 ---')
        
        caregivers = requests.get(f'{BASE_URL}/routes/caregivers').json()['data']
        points = requests.get(f'{BASE_URL}/routes/points').json()['data']
        routes = requests.get(f'{BASE_URL}/routes').json()['data']
        
        caregiver_id = next((c['id'] for c in caregivers if c['employee_id'] == 'CG003'), None)
        reviewer_id = next((c['id'] for c in caregivers if c['employee_id'] == 'CG004'), None)
        point_id = points[1]['id']
        route_id = routes[0]['id']
        
        today = datetime.now().strftime('%Y-%m-%d')
        checkin_time = f'{today} 22:45:00'
        
        checkin_data = {
            'route_id': route_id,
            'point_id': point_id,
            'caregiver_id': caregiver_id,
            'checkin_time': checkin_time,
            'checkin_type': 'supplement'
        }
        
        resp = requests.post(f'{BASE_URL}/checkins', json=checkin_data)
        self.assertEqual(resp.status_code, 201)
        checkin_id = resp.json()['data']['id']
        print(f'  补录打卡成功: {checkin_id}')
        
        supplement_data = {
            'checkin_id': checkin_id,
            'requester_id': caregiver_id,
            'reason': '测试补录申请',
            'evidence': '测试证据'
        }
        
        resp2 = requests.post(f'{BASE_URL}/supplements', json=supplement_data)
        self.assertEqual(resp2.status_code, 201)
        supplement_id = resp2.json()['data']['id']
        self.assertEqual(resp2.json()['data']['status'], 'pending')
        print(f'  提交补录申请成功: {supplement_id}')
        
        approval_data = {
            'reviewer_id': reviewer_id,
            'review_comment': '测试批准'
        }
        
        resp3 = requests.post(f'{BASE_URL}/supplements/{supplement_id}/approve', json=approval_data)
        self.assertEqual(resp3.status_code, 200)
        self.assertEqual(resp3.json()['data']['status'], 'approved')
        print(f'  批准补录申请成功')
    
    def test_4_detection_and_report(self):
        print('\n--- 测试4: 漏巡检测和报表生成 ---')
        
        caregivers = requests.get(f'{BASE_URL}/routes/caregivers').json()['data']
        routes = requests.get(f'{BASE_URL}/routes').json()['data']
        
        caregiver_id = next((c['id'] for c in caregivers if c['employee_id'] == 'CG003'), None)
        route_id = routes[0]['id']
        
        today = datetime.now().strftime('%Y-%m-%d')
        
        detection_data = {
            'route_id': route_id,
            'caregiver_id': caregiver_id,
            'shift_date': today
        }
        
        resp = requests.post(f'{BASE_URL}/detections/detect', json=detection_data)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()['success'])
        print(f'  漏巡检测完成，发现 {resp.json()["count"]} 条漏巡')
        
        report_data = {
            'report_date': today,
            'route_id': route_id,
            'caregiver_id': caregiver_id
        }
        
        resp2 = requests.post(f'{BASE_URL}/reports/generate', json=report_data)
        self.assertEqual(resp2.status_code, 201)
        report = resp2.json()['data']
        print(f'  报表生成成功: 完成率 {report["completion_rate"]}%')
        
        self.assertGreater(report['total_points'], 0)
        self.assertIsNotNone(report['completion_rate'])
    
    def test_5_error_handling(self):
        print('\n--- 测试5: 错误处理 ---')
        
        invalid_route = {
            'name': '',
            'shift_type': 'night',
            'start_time': '22:00',
            'end_time': '06:00'
        }
        resp = requests.post(f'{BASE_URL}/routes', json=invalid_route)
        self.assertEqual(resp.status_code, 400)
        print(f'  空名称路线被正确拦截: {resp.json()["error"]["code"]}')
        
        invalid_checkin = {
            'route_id': 99999,
            'point_id': 99999,
            'caregiver_id': 99999
        }
        resp2 = requests.post(f'{BASE_URL}/checkins', json=invalid_checkin)
        self.assertEqual(resp2.status_code, 400)
        print(f'  无效打卡被正确拦截: {resp2.json()["error"]["code"]}')
    
    def test_6_state_transition(self):
        print('\n--- 测试6: 状态流转 ---')
        
        caregivers = requests.get(f'{BASE_URL}/routes/caregivers').json()['data']
        points = requests.get(f'{BASE_URL}/routes/points').json()['data']
        routes = requests.get(f'{BASE_URL}/routes').json()['data']
        
        caregiver_id = next((c['id'] for c in caregivers if c['employee_id'] == 'CG003'), None)
        reviewer_id = next((c['id'] for c in caregivers if c['employee_id'] == 'CG004'), None)
        point_id = points[2]['id']
        route_id = routes[0]['id']
        
        today = datetime.now().strftime('%Y-%m-%d')
        checkin_time = f'{today} 23:00:00'
        
        checkin_data = {
            'route_id': route_id,
            'point_id': point_id,
            'caregiver_id': caregiver_id,
            'checkin_time': checkin_time,
            'checkin_type': 'supplement'
        }
        resp = requests.post(f'{BASE_URL}/checkins', json=checkin_data)
        checkin_id = resp.json()['data']['id']
        
        supplement_data = {
            'checkin_id': checkin_id,
            'requester_id': caregiver_id,
            'reason': '状态流转测试',
            'evidence': '测试'
        }
        resp2 = requests.post(f'{BASE_URL}/supplements', json=supplement_data)
        supplement_id = resp2.json()['data']['id']
        
        rejection_data = {
            'reviewer_id': reviewer_id,
            'review_comment': '测试拒绝'
        }
        resp3 = requests.post(f'{BASE_URL}/supplements/{supplement_id}/reject', json=rejection_data)
        self.assertEqual(resp3.status_code, 200)
        self.assertEqual(resp3.json()['data']['status'], 'rejected')
        print(f'  补录申请状态正确流转: pending -> rejected')
        
        approval_data = {
            'reviewer_id': reviewer_id,
            'review_comment': '尝试再次批准'
        }
        resp4 = requests.post(f'{BASE_URL}/supplements/{supplement_id}/approve', json=approval_data)
        self.assertEqual(resp4.status_code, 400)
        print(f'  已拒绝的申请无法再次批准，状态流转正确拦截')


def run_tests():
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestPatrolAPI)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    print('\n' + '='*60)
    if result.wasSuccessful():
        print('所有测试通过！')
    else:
        print(f'测试失败: {len(result.failures) + len(result.errors)}')
    print('='*60)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
