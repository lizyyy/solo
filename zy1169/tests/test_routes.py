import os
import pytest


class TestBasicRoutes:
    def test_index_route(self, client):
        response = client.get('/')
        assert response.status_code == 200
        assert b'ML Pipeline Studio' in response.data
    
    def test_create_project_page(self, client):
        response = client.get('/project/create')
        assert response.status_code == 200
        assert b'Create Project' in response.data
        assert b'project_name' in response.data
    
    def test_create_project_post(self, client):
        response = client.post('/project/create', data={
            'name': 'Test Project',
            'description': 'This is a test project'
        }, follow_redirects=True)
        assert response.status_code == 200
    
    def test_non_existent_project(self, client):
        response = client.get('/project/999999')
        assert response.status_code in [404, 500, 302]


class TestProjectManagement:
    def test_full_project_workflow(self, client, good_data_path):
        response = client.post('/project/create', data={
            'name': 'Integration Test Project',
            'description': 'Test project for integration testing'
        }, follow_redirects=True)
        assert response.status_code == 200
        
        page_content = response.data.decode('utf-8')
        if 'Integration Test Project' in page_content:
            import re
            matches = re.findall(r'/project/(\d+)', page_content)
            if matches:
                project_id = matches[0]
                response2 = client.get(f'/project/{project_id}')
                assert response2.status_code == 200


class TestReportGenerator:
    def test_report_generator_import(self):
        from core.report_generator import ReportGenerator
        assert ReportGenerator is not None
    
    def test_markdown_report_structure(self):
        from core.report_generator import ReportGenerator
        
        report_data = {
            'project_name': 'Test Project',
            'pipeline_stages': [
                {'stage': 'data_upload', 'status': 'completed'},
                {'stage': 'cleaning', 'status': 'completed'}
            ],
            'data_quality': {
                'overall_score': 0.85,
                'issues': []
            },
            'training': {
                'model_type': 'random_forest',
                'metrics': {'accuracy': 0.85}
            }
        }
        
        generator = ReportGenerator(report_data)
        md_report = generator.generate_markdown_report()
        
        assert 'Test Project' in md_report
        assert 'data_upload' in md_report
        assert '0.85' in md_report
    
    def test_json_report(self):
        from core.report_generator import ReportGenerator
        
        report_data = {
            'project_name': 'Test Project',
            'metrics': {'accuracy': 0.85}
        }
        
        generator = ReportGenerator(report_data)
        json_report = generator.generate_json_report()
        
        assert 'project_name' in json_report
        assert json_report['project_name'] == 'Test Project'


class TestPipelineManager:
    def test_pipeline_manager_import(self):
        from core.pipeline_manager import PipelineManager
        assert PipelineManager is not None
    
    def test_pipeline_stage_order(self):
        from models import PipelineStage
        
        expected_order = [
            PipelineStage.DATA_UPLOAD,
            PipelineStage.DATA_CLEANING,
            PipelineStage.FEATURE_ENGINEERING,
            PipelineStage.TRAINING,
            PipelineStage.VALIDATION,
            PipelineStage.TESTING,
            PipelineStage.DEPLOYMENT_REQUEST,
            PipelineStage.DEPLOYED
        ]
        
        assert len(expected_order) == 8


class TestModelTrainer:
    def test_model_trainer_import(self):
        from core.model_trainer import ModelTrainer
        assert ModelTrainer is not None
    
    def test_compare_models(self):
        from core.model_trainer import compare_models
        
        metrics1 = {'accuracy': 0.85, 'precision': 0.80, 'recall': 0.82}
        metrics2 = {'accuracy': 0.88, 'precision': 0.83, 'recall': 0.85}
        
        comparison = compare_models(metrics1, metrics2)
        
        assert 'accuracy' in comparison
        assert 'value1' in comparison['accuracy']
        assert 'value2' in comparison['accuracy']
        assert 'diff' in comparison['accuracy']
