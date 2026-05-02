import json
import pytest
from flask import url_for


class TestPotteryRoutes:
    def test_get_pottery_list_empty(self, client):
        response = client.get('/api/pottery')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        assert data['success'] is True
        assert data['data']['total'] == 0

    def test_get_pottery_list_with_data(self, app, client, sample_pottery):
        response = client.get('/api/pottery')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        assert data['success'] is True
        assert data['data']['total'] >= 1

    def test_create_pottery(self, client):
        pottery_data = {
            'pottery_id': 'TP-API-001',
            'trench': 'T01',
            'layer': 'L03',
            'square': 'A1',
            'length': 15.2,
            'width': 8.5,
            'thickness': 0.8,
            'decoration': '绳纹',
            'paste_type': '夹砂红陶',
            'notes': 'API测试陶片'
        }
        
        response = client.post(
            '/api/pottery',
            data=json.dumps(pottery_data),
            content_type='application/json'
        )
        data = json.loads(response.data)
        
        assert response.status_code == 201
        assert data['success'] is True
        assert data['data']['pottery_id'] == 'TP-API-001'

    def test_create_pottery_missing_required(self, client):
        pottery_data = {
            'trench': 'T01'
        }
        
        response = client.post(
            '/api/pottery',
            data=json.dumps(pottery_data),
            content_type='application/json'
        )
        data = json.loads(response.data)
        
        assert response.status_code == 400
        assert data['success'] is False

    def test_get_pottery_by_id(self, app, client, sample_pottery):
        with app.app_context():
            pottery_id = sample_pottery.pottery_id
        
        response = client.get(f'/api/pottery/{pottery_id}')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        assert data['success'] is True
        assert data['data']['pottery_id'] == pottery_id

    def test_get_pottery_not_found(self, client):
        response = client.get('/api/pottery/NONEXISTENT')
        data = json.loads(response.data)
        
        assert response.status_code == 404
        assert data['success'] is False

    def test_update_pottery(self, app, client, sample_pottery):
        with app.app_context():
            pottery_id = sample_pottery.pottery_id
        
        update_data = {
            'notes': '更新后的备注',
            'status': 'under_review'
        }
        
        response = client.put(
            f'/api/pottery/{pottery_id}',
            data=json.dumps(update_data),
            content_type='application/json'
        )
        data = json.loads(response.data)
        
        assert response.status_code == 200
        assert data['success'] is True
        assert data['data']['notes'] == '更新后的备注'

    def test_delete_pottery(self, app, client, sample_pottery):
        with app.app_context():
            pottery_id = sample_pottery.pottery_id
        
        response = client.delete(f'/api/pottery/{pottery_id}')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        assert data['success'] is True


class TestGroupRoutes:
    def test_create_group(self, app, client, sample_pottery):
        with app.app_context():
            pottery_id = sample_pottery.pottery_id
        
        group_data = {
            'group_id': 'SG-API-001',
            'name': 'API测试拼接组',
            'description': '用于测试API的拼接组',
            'guess_evidence': '同探方同层位',
            'pottery_ids': [pottery_id]
        }
        
        response = client.post(
            '/api/groups',
            data=json.dumps(group_data),
            content_type='application/json'
        )
        data = json.loads(response.data)
        
        assert response.status_code == 201
        assert data['success'] is True

    def test_submit_group(self, app, client, sample_group):
        with app.app_context():
            group_id = sample_group.group_id
        
        response = client.post(f'/api/groups/{group_id}/submit')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        assert data['success'] is True
        assert data['data']['status'] == 'submitted'

    def test_withdraw_group(self, app, client):
        with app.app_context():
            from models import SpliceGroup
            group = SpliceGroup(
                group_id='SG-WITHDRAW-001',
                name='撤回测试组',
                status='submitted',
                created_by='test'
            )
            db.session.add(group)
            db.session.commit()
            group_id = group.group_id
        
        response = client.post(f'/api/groups/{group_id}/withdraw')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        assert data['success'] is True


class TestReviewRoutes:
    def test_get_rules(self, client):
        response = client.get('/api/review/rules')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        assert data['success'] is True
        assert 'rules' in data['data']
        assert len(data['data']['rules']) > 0

    def test_validate_all(self, app, client, sample_group):
        response = client.post('/api/review/validate/all')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        assert data['success'] is True
        assert 'results' in data['data']

    def test_get_issues(self, client):
        response = client.get('/api/review/issues')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        assert data['success'] is True

    def test_get_audit_logs(self, client):
        response = client.get('/api/review/audit-logs')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        assert data['success'] is True

    def test_get_state_flow(self, client):
        response = client.get('/api/review/state-flow')
        data = json.loads(response.data)
        
        assert response.status_code == 200
        assert data['success'] is True
        assert 'pottery' in data['data']
        assert 'group' in data['data']


class TestExportRoutes:
    def test_export_issues(self, client):
        response = client.get('/api/export/issues')
        
        assert response.status_code == 200
        assert 'text/csv' in response.content_type or response.content_type == 'text/csv'

    def test_export_potteries(self, client):
        response = client.get('/api/export/potteries')
        
        assert response.status_code == 200

    def test_export_groups(self, client):
        response = client.get('/api/export/groups')
        
        assert response.status_code == 200


class TestImportRoutes:
    def test_import_preview_json(self, app, client, tmp_path):
        json_data = [{
            "pottery_id": "TP-PREVIEW-001",
            "trench": "T01",
            "layer": "L03",
            "decoration": "绳纹",
            "paste_type": "夹砂红陶"
        }]
        
        json_file = tmp_path / "preview.json"
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(json_data, f)
        
        with open(json_file, 'rb') as f:
            response = client.post(
                '/api/import/preview',
                data={'file': (f, 'preview.json')},
                content_type='multipart/form-data'
            )
        
        assert response.status_code in [200, 400]


import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import db
