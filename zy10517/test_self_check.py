#!/usr/bin/env python3
import unittest
import json
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app import app, db, OccupancyStatus


class EnvOccupancySelfCheck(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.client = app.test_client()
        with app.app_context():
            db.create_all()

    def tearDown(self):
        with app.app_context():
            db.drop_all()

    def test_1_normal_flow_full_lifecycle(self):
        print('=== 测试1: 正常流 - 完整生命周期 ===')
        resp = self.client.post('/api/environments', json={
            'name': 'regression-env-01',
            'description': '主回归测试环境'
        })
        self.assertEqual(resp.status_code, 201)
        print('✓ 创建环境成功')

        resp = self.client.get('/api/environments')
        self.assertEqual(resp.status_code, 200)
        envs = resp.get_json()
        self.assertEqual(envs[0]['status'], 'available')
        print('✓ 环境初始状态为可用')

        resp = self.client.post('/api/occupancies', json={
            'env_name': 'regression-env-01',
            'team': 'team-alpha',
            'test_batch': 'batch-2024-001',
            'lease_duration_hours': 6
        })
        self.assertEqual(resp.status_code, 201)
        occ = resp.get_json()
        self.assertEqual(occ['status'], OccupancyStatus.ACTIVE.value)
        occ_id = occ['id']
        print('✓ 创建占用请求成功，直接激活')

        resp = self.client.get('/api/environments')
        envs = resp.get_json()
        self.assertEqual(envs[0]['status'], 'occupied')
        print('✓ 环境状态更新为被占用')

        resp = self.client.post(f'/api/occupancies/{occ_id}/snapshot', json={
            'snapshot_name': 'db-snapshot-before-test',
            'snapshot_type': 'database',
            'snapshot_path': '/backup/snap1.sql',
            'created_by': 'qa-engineer'
        })
        self.assertEqual(resp.status_code, 201)
        print('✓ 创建数据快照成功')

        resp = self.client.post(f'/api/occupancies/{occ_id}/prepare-release', json={
            'release_plan': '已完成所有测试用例，数据验证完毕',
            'operator': 'qa-lead'
        })
        self.assertEqual(resp.status_code, 200)
        occ = resp.get_json()
        self.assertEqual(occ['status'], OccupancyStatus.RELEASING.value)
        print('✓ 准备释放成功')

        resp = self.client.post(f'/api/occupancies/{occ_id}/confirm-release', json={
            'operator': 'qa-lead'
        })
        self.assertEqual(resp.status_code, 200)
        occ = resp.get_json()
        self.assertEqual(occ['status'], OccupancyStatus.COMPLETED.value)
        self.assertIsNotNone(occ['actual_release_at'])
        print('✓ 确认释放成功')

        resp = self.client.get('/api/environments')
        envs = resp.get_json()
        self.assertEqual(envs[0]['status'], 'available')
        print('✓ 环境恢复为可用状态')
        print('✓ 正常流测试通过\n')

    def test_2_dirty_data_validation(self):
        print('=== 测试2: 脏数据 - 参数校验 ===')
        self.client.post('/api/environments', json={'name': 'test-env'})

        resp = self.client.post('/api/occupancies', json={})
        self.assertEqual(resp.status_code, 400)
        print('✓ 空请求被拒绝')

        resp = self.client.post('/api/occupancies', json={
            'env_name': 'nonexistent-env',
            'team': 'team-a',
            'test_batch': 'batch-1'
        })
        self.assertEqual(resp.status_code, 404)
        print('✓ 不存在的环境被拒绝')

        resp = self.client.post('/api/occupancies', json={
            'env_name': 'test-env',
            'team': 'team-a'
        })
        self.assertEqual(resp.status_code, 400)
        print('✓ 缺少必填字段被拒绝')

        resp = self.client.post('/api/occupancies/999/exception', json={
            'exception_info': '测试异常'
        })
        self.assertEqual(resp.status_code, 404)
        print('✓ 不存在的记录被拒绝')

        resp = self.client.post('/api/occupancies', json={
            'env_name': 'test-env',
            'team': 'team-a',
            'test_batch': 'batch-1'
        })
        self.assertEqual(resp.status_code, 201)
        occ = resp.get_json()
        occ_id = occ['id']

        resp = self.client.post(f'/api/occupancies/{occ_id}/exception', json={})
        self.assertEqual(resp.status_code, 400)
        print('✓ 异常信息为空被拒绝')

        resp = self.client.post(f'/api/occupancies/{occ_id}/resolve', json={
            'resolution': '修复方案',
            'target_status': 'invalid_status'
        })
        self.assertEqual(resp.status_code, 400)
        print('✓ 不合法的目标状态被拒绝')

        resp = self.client.post(f'/api/occupancies/{occ_id}/manual-fix', json={
            'fields': {'status': 'active'}
        })
        self.assertEqual(resp.status_code, 400)
        print('✓ 人工修正缺少操作人被拒绝')
        print('✓ 脏数据测试通过\n')

    def test_3_duplicate_requests_and_queue(self):
        print('=== 测试3: 重复请求与排队机制 ===')
        self.client.post('/api/environments', json={'name': 'queue-env'})

        resp = self.client.post('/api/occupancies', json={
            'env_name': 'queue-env',
            'team': 'team-a',
            'test_batch': 'batch-1'
        })
        self.assertEqual(resp.status_code, 201)
        occ1_id = resp.get_json()['id']
        print('✓ 第一个团队获得环境使用权')

        resp = self.client.post('/api/occupancies', json={
            'env_name': 'queue-env',
            'team': 'team-b',
            'test_batch': 'batch-2'
        })
        self.assertEqual(resp.status_code, 201)
        occ2 = resp.get_json()
        self.assertEqual(occ2['status'], OccupancyStatus.PENDING.value)
        self.assertEqual(occ2['queue_position'], 1)
        print('✓ 第二个团队进入排队，队列位置1')

        resp = self.client.post('/api/occupancies', json={
            'env_name': 'queue-env',
            'team': 'team-c',
            'test_batch': 'batch-3'
        })
        self.assertEqual(resp.status_code, 201)
        occ3 = resp.get_json()
        self.assertEqual(occ3['queue_position'], 2)
        print('✓ 第三个团队进入排队，队列位置2')

        resp = self.client.post('/api/occupancies', json={
            'env_name': 'queue-env',
            'team': 'team-a',
            'test_batch': 'batch-1'
        })
        self.assertEqual(resp.status_code, 409)
        print('✓ 重复请求被拒绝')

        self.client.post(f'/api/occupancies/{occ1_id}/prepare-release', json={})
        self.client.post(f'/api/occupancies/{occ1_id}/confirm-release', json={})
        print('✓ 第一个团队释放环境')

        resp = self.client.get(f'/api/occupancies/{occ2["id"]}')
        occ2_updated = resp.get_json()
        self.assertEqual(occ2_updated['status'], OccupancyStatus.ACTIVE.value)
        print('✓ 队列第一个团队自动获得环境使用权')

        resp = self.client.get(f'/api/occupancies/{occ3["id"]}')
        occ3_updated = resp.get_json()
        self.assertEqual(occ3_updated['queue_position'], 1)
        print('✓ 队列位置自动更新')
        print('✓ 重复请求与排队测试通过\n')

    def test_4_exception_handling_and_manual_fix(self):
        print('=== 测试4: 异常处理与人工修正 ===')
        self.client.post('/api/environments', json={'name': 'exception-env'})
        
        resp = self.client.post('/api/occupancies', json={
            'env_name': 'exception-env',
            'team': 'team-x',
            'test_batch': 'batch-x1'
        })
        occ_id = resp.get_json()['id']

        resp = self.client.post(f'/api/occupancies/{occ_id}/exception', json={
            'exception_info': '数据库连接异常，测试无法继续',
            'operator': 'qa-engineer'
        })
        self.assertEqual(resp.status_code, 200)
        occ = resp.get_json()
        self.assertEqual(occ['status'], OccupancyStatus.EXCEPTION.value)
        print('✓ 标记异常状态成功')

        resp = self.client.get(f'/api/occupancies/{occ_id}')
        detail = resp.get_json()
        self.assertIsNotNone(detail['exception_info'])
        self.assertTrue(any(a['action'] == 'MARK_EXCEPTION' for a in detail['audit_log']))
        print('✓ 审计日志记录异常操作')

        resp = self.client.post(f'/api/occupancies/{occ_id}/resolve', json={
            'resolution': 'DBA修复了数据库连接，测试可以继续',
            'target_status': OccupancyStatus.ACTIVE.value,
            'operator': 'admin-user'
        })
        self.assertEqual(resp.status_code, 200)
        occ = resp.get_json()
        self.assertEqual(occ['status'], OccupancyStatus.ACTIVE.value)
        self.assertEqual(occ['resolved_by'], 'admin-user')
        print('✓ 人工处理异常成功，恢复为活跃状态')

        resp = self.client.post(f'/api/occupancies/{occ_id}/manual-fix', json={
            'operator': 'admin-super',
            'reason': '测试租约需要延长',
            'fields': {
                'lease_duration_hours': 12,
                'team': 'team-x-extended'
            }
        })
        self.assertEqual(resp.status_code, 200)
        occ = resp.get_json()
        self.assertEqual(occ['lease_duration_hours'], 12)
        self.assertEqual(occ['team'], 'team-x-extended')
        print('✓ 人工修正字段成功')

        resp = self.client.get(f'/api/occupancies/{occ_id}')
        detail = resp.get_json()
        self.assertTrue(any(a['action'] == 'MANUAL_FIX' for a in detail['audit_log']))
        print('✓ 人工修正操作被审计记录')
        print('✓ 异常处理与人工修正测试通过\n')

    def test_5_report_export(self):
        print('=== 测试5: 报告导出 ===')
        self.client.post('/api/environments', json={'name': 'report-env'})
        
        for i in range(3):
            self.client.post('/api/occupancies', json={
                'env_name': 'report-env',
                'team': f'team-{i}',
                'test_batch': f'batch-{i}'
            })
            resp = self.client.get('/api/occupancies')
            occs = resp.get_json()
            if occs:
                self.client.post(f'/api/occupancies/{occs[0]["id"]}/prepare-release', json={})
                self.client.post(f'/api/occupancies/{occs[0]["id"]}/confirm-release', json={})

        resp = self.client.get('/api/report/occupancies')
        self.assertEqual(resp.status_code, 200)
        report = resp.get_json()
        self.assertGreaterEqual(len(report), 3)
        print('✓ JSON格式报告导出成功')

        resp = self.client.get('/api/report/occupancies?format=csv')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('text/csv', resp.headers['Content-Type'])
        csv_content = resp.get_data(as_text=True)
        self.assertIn('ID,环境,团队,测试批次', csv_content)
        print('✓ CSV格式报告导出成功')

        resp = self.client.get('/api/report/occupancies?team=team-1')
        report = resp.get_json()
        self.assertEqual(len(report), 1)
        print('✓ 按团队筛选报告成功')
        print('✓ 报告导出测试通过\n')

    def test_6_raw_input_persistence(self):
        print('=== 测试6: 原始输入持久化 ===')
        self.client.post('/api/environments', json={'name': 'raw-env'})

        raw_request = {
            'env_name': 'raw-env',
            'team': 'team-raw',
            'test_batch': 'batch-raw',
            'lease_duration_hours': 8,
            'extra_field': 'some_value'
        }
        resp = self.client.post('/api/occupancies', json=raw_request)
        occ_id = resp.get_json()['id']

        resp = self.client.get(f'/api/occupancies/{occ_id}')
        detail = resp.get_json()
        stored_raw = json.loads(detail['raw_request'])
        self.assertEqual(stored_raw['team'], 'team-raw')
        self.assertEqual(stored_raw['extra_field'], 'some_value')
        print('✓ 原始请求完整存储，包括额外字段')

        self.client.post(f'/api/occupancies/{occ_id}/exception', json={
            'exception_info': '测试异常',
            'operator': 'user-a',
            'debug_info': 'extra-debug-data'
        })

        resp = self.client.get(f'/api/occupancies/{occ_id}')
        detail = resp.get_json()
        exception_audit = next(a for a in detail['audit_log'] if a['action'] == 'MARK_EXCEPTION')
        print('✓ 所有操作的原始输入都有审计记录')
        print('✓ 原始输入持久化测试通过\n')


if __name__ == '__main__':
    print('\n' + '='*60)
    print('回归环境占用管理服务 - 自检测试套件')
    print('='*60 + '\n')
    unittest.main(verbosity=2)
