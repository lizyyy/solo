import pytest
import json
from app import create_app, db
from app.models import EvaluationSet, EvaluationItem
from app.services.detection_service import FingerprintService


class TestAPIRoutes:
    
    @pytest.fixture
    def app(self):
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.session.remove()
            db.drop_all()
    
    @pytest.fixture
    def client(self, app):
        return app.test_client()
    
    def test_health_check(self, client):
        """测试健康检查"""
        response = client.get('/api/health')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        assert data['success']
        assert data['data']['status'] == 'ok'
    
    def test_create_evaluation_set(self, client):
        """测试创建评测集"""
        payload = {
            'name': 'test_eval_set',
            'version': '1.0.0',
            'description': 'Test evaluation set',
            'created_by': 'tester',
            'items': [
                {
                    'item_id': 'q1',
                    'content': 'What is 1+1?'
                },
                {
                    'item_id': 'q2',
                    'content': 'What is 2+2?'
                }
            ]
        }
        
        response = client.post('/api/evaluation-sets', json=payload)
        data = json.loads(response.data)
        
        assert response.status_code == 201
        assert data['success']
        assert data['data']['name'] == 'test_eval_set'
        assert data['data']['version'] == '1.0.0'
        assert data['data']['item_count'] == 2
    
    def test_create_duplicate_evaluation_set(self, client):
        """测试创建重复评测集"""
        payload = {
            'name': 'duplicate_test',
            'version': '1.0.0',
            'items': [{'item_id': 'q1', 'content': 'test'}]
        }
        
        client.post('/api/evaluation-sets', json=payload)
        response = client.post('/api/evaluation-sets', json=payload)
        data = json.loads(response.data)
        
        assert response.status_code == 409
        assert not data['success']
    
    def test_complete_detection_workflow(self, client):
        """测试完整的检测工作流通过API"""
        content1 = "这是评测题1：什么是机器学习？"
        content2 = "这是干净的训练数据"
        
        eval_set_payload = {
            'name': 'ml_benchmark',
            'version': '1.0',
            'items': [
                {'item_id': 'q1', 'content': content1}
            ]
        }
        
        response = client.post('/api/evaluation-sets', json=eval_set_payload)
        eval_set_data = json.loads(response.data)
        eval_set_id = eval_set_data['data']['id']
        
        task_payload = {
            'evaluation_set_id': eval_set_id,
            'training_data_signature': 'training_dataset_v1',
            'training_data_description': 'Test training data',
            'created_by': 'tester',
            'training_data': [
                {'content': content1, 'data_source': 'train_file_1.txt'},
                {'content': content2, 'data_source': 'train_file_2.txt'}
            ]
        }
        
        response = client.post('/api/detection-tasks', json=task_payload)
        task_data = json.loads(response.data)
        task_id = task_data['data']['id']
        
        assert response.status_code == 201
        assert task_data['data']['status'] == 'pending'
        
        response = client.post(f'/api/detection-tasks/{task_id}/run')
        run_data = json.loads(response.data)
        
        assert response.status_code == 200
        assert run_data['data']['task']['status'] == 'needs_confirmation'
        assert run_data['data']['matches_count'] == 1
        
        match_id = run_data['data']['matches'][0]['id']
        
        confirm_payload = {
            'match_id': match_id,
            'is_polluted': True,
            'confirmed_by': 'reviewer',
            'comment': '确认为污染'
        }
        
        response = client.post(f'/api/detection-tasks/{task_id}/confirm', json=confirm_payload)
        confirm_data = json.loads(response.data)
        
        assert response.status_code == 200
        assert confirm_data['data']['task']['status'] == 'confirmed_polluted'
        
        response = client.post(f'/api/detection-tasks/{task_id}/report', json={
            'report_type': 'summary',
            'generated_by': 'system'
        })
        report_data = json.loads(response.data)
        
        assert response.status_code == 201
        assert report_data['data']['findings']['total_matches'] == 1
        assert report_data['data']['findings']['active_matches'] == 1
        
        response = client.get(f'/api/detection-tasks/{task_id}')
        summary_data = json.loads(response.data)
        
        assert response.status_code == 200
        assert summary_data['data']['task']['status'] == 'confirmed_polluted'
        assert summary_data['data']['is_terminal']
    
    def test_duplicate_submission_api(self, client):
        """测试API层面的重复提交检测"""
        eval_set_payload = {
            'name': 'dup_test',
            'version': '1.0',
            'items': [{'item_id': 'q1', 'content': 'test'}]
        }
        
        response = client.post('/api/evaluation-sets', json=eval_set_payload)
        eval_set_id = json.loads(response.data)['data']['id']
        
        task_payload = {
            'evaluation_set_id': eval_set_id,
            'training_data_signature': 'same_signature'
        }
        
        response1 = client.post('/api/detection-tasks', json=task_payload)
        response2 = client.post('/api/detection-tasks', json=task_payload)
        
        data1 = json.loads(response1.data)
        data2 = json.loads(response2.data)
        
        assert response1.status_code == 201
        assert response2.status_code == 409
        assert '重复提交' in data2['message']
        assert data2['data']['existing_task_id'] == data1['data']['id']
    
    def test_invalid_status_transition_api(self, client):
        """测试API层面的非法状态流转"""
        eval_set_payload = {
            'name': 'transition_test',
            'version': '1.0',
            'items': [{'item_id': 'q1', 'content': 'content'}]
        }
        
        response = client.post('/api/evaluation-sets', json=eval_set_payload)
        eval_set_id = json.loads(response.data)['data']['id']
        
        task_payload = {
            'evaluation_set_id': eval_set_id,
            'training_data_signature': 'sig1'
        }
        
        response = client.post('/api/detection-tasks', json=task_payload)
        task_id = json.loads(response.data)['data']['id']
        
        exempt_payload = {
            'reason': 'false_positive',
            'justification': '测试豁免',
            'exempted_by': 'admin'
        }
        
        response = client.post(f'/api/detection-tasks/{task_id}/exempt', json=exempt_payload)
        data = json.loads(response.data)
        
        assert response.status_code == 400
        assert not data['success']
        assert '无法从' in data['message']
        assert 'next_allowed_states' in data['details']
    
    def test_exemption_flow(self, client):
        """测试豁免流程"""
        content = "测试内容"
        eval_set_payload = {
            'name': 'exempt_test',
            'version': '1.0',
            'items': [{'item_id': 'q1', 'content': content}]
        }
        
        response = client.post('/api/evaluation-sets', json=eval_set_payload)
        eval_set_id = json.loads(response.data)['data']['id']
        
        task_payload = {
            'evaluation_set_id': eval_set_id,
            'training_data_signature': 'train_sig',
            'training_data': [{'content': content}]
        }
        
        response = client.post('/api/detection-tasks', json=task_payload)
        task_id = json.loads(response.data)['data']['id']
        
        client.post(f'/api/detection-tasks/{task_id}/run')
        
        exempt_payload = {
            'reason': 'false_positive',
            'justification': '这是误报，经核查是合法数据',
            'exempted_by': 'admin_user'
        }
        
        response = client.post(f'/api/detection-tasks/{task_id}/exempt', json=exempt_payload)
        data = json.loads(response.data)
        
        assert response.status_code == 201
        assert data['data']['task']['status'] == 'exempted'
        assert data['data']['exemption']['reason'] == 'false_positive'
    
    def test_list_tasks_with_filter(self, client):
        """测试按状态筛选任务列表"""
        eval_set_payload = {
            'name': 'list_test',
            'version': '1.0',
            'items': [{'item_id': 'q1', 'content': 'c'}]
        }
        
        response = client.post('/api/evaluation-sets', json=eval_set_payload)
        eval_set_id = json.loads(response.data)['data']['id']
        
        for i in range(3):
            client.post('/api/detection-tasks', json={
                'evaluation_set_id': eval_set_id,
                'training_data_signature': f'sig_{i}'
            })
        
        response = client.get('/api/detection-tasks')
        all_tasks = json.loads(response.data)
        assert len(all_tasks['data']) == 3
        
        response = client.get('/api/detection-tasks?status=pending')
        pending_tasks = json.loads(response.data)
        assert len(pending_tasks['data']) == 3
        
        response = client.get('/api/detection-tasks?status=completed')
        completed_tasks = json.loads(response.data)
        assert len(completed_tasks['data']) == 0
    
    def test_get_history(self, client):
        """测试获取状态历史"""
        content = "历史测试"
        eval_set_payload = {
            'name': 'history_test',
            'version': '1.0',
            'items': [{'item_id': 'q1', 'content': content}]
        }
        
        response = client.post('/api/evaluation-sets', json=eval_set_payload)
        eval_set_id = json.loads(response.data)['data']['id']
        
        task_payload = {
            'evaluation_set_id': eval_set_id,
            'training_data_signature': 'history_sig',
            'training_data': [{'content': content}]
        }
        
        response = client.post('/api/detection-tasks', json=task_payload)
        task_id = json.loads(response.data)['data']['id']
        
        client.post(f'/api/detection-tasks/{task_id}/run')
        
        response = client.get(f'/api/detection-tasks/{task_id}/history')
        history = json.loads(response.data)
        
        assert response.status_code == 200
        assert len(history['data']) >= 2
        
        states = [h['to_status'] for h in history['data']]
        assert 'pending' not in states
        assert 'scanning' in states
        assert 'needs_confirmation' in states
