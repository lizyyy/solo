import pytest
import json
import io
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from app import db
from app.models import Interview, InterviewVersion, InterviewSummary, Authorization, AuditLog

class TestInterviewRoutes:
    """测试访谈相关的API路由"""
    
    def test_upload_interview_success(self, client, app):
        """测试成功上传访谈"""
        # 创建模拟的JSON文件
        interview_data = {
            "interview_id": "TEST-001",
            "date": "2026-04-15",
            "researcher": "张研究员",
            "topic": "用户体验测试",
            "respondent_info": {
                "name": "测试用户",
                "phone": "13812345678"
            },
            "conversations": []
        }
        
        interview_file = io.BytesIO(json.dumps(interview_data, ensure_ascii=False).encode('utf-8'))
        
        # 使用patch来模拟Celery任务（延迟导入需要在函数内部mock）
        # 因为路由中使用的是 `from app.tasks import process_interview_anonymization`
        # 我们需要mock `app.tasks.process_interview_anonymization`
        with patch('app.tasks.process_interview_anonymization') as mock_task:
            mock_task.delay.return_value = MagicMock(id='test-task-id')
            
            # 发送POST请求
            response = client.post(
                '/api/interviews/upload',
                data={
                    'interview_file': (interview_file, 'test_interview.json'),
                    'researcher_name': '张研究员',
                    'interview_date': '2026-04-15'
                },
                content_type='multipart/form-data'
            )
            
            # 检查响应
            assert response.status_code == 202
            data = json.loads(response.data)
            assert 'message' in data
            assert 'interview_id' in data
            assert data['status'] == 'processing'
    
    def test_upload_interview_no_file(self, client):
        """测试上传访谈但没有提供文件"""
        response = client.post('/api/interviews/upload', data={})
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
    
    def test_get_interviews_empty(self, client):
        """测试获取访谈列表（空数据库）"""
        response = client.get('/api/interviews')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'interviews' in data
        assert data['total'] == 0
    
    def test_get_interviews_with_data(self, client, app):
        """测试获取访谈列表（有数据）"""
        with app.app_context():
            # 创建测试数据
            interview = Interview(
                filename='test.json',
                original_content='{"test": "data"}',
                status='completed',
                researcher_name='张研究员'
            )
            db.session.add(interview)
            db.session.commit()
        
        response = client.get('/api/interviews')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['total'] == 1
        assert len(data['interviews']) == 1
    
    def test_get_interview_by_id(self, client, app):
        """测试通过ID获取访谈详情"""
        with app.app_context():
            interview = Interview(
                filename='test.json',
                original_content='{"test": "data"}',
                status='completed'
            )
            db.session.add(interview)
            db.session.commit()
            interview_id = interview.id
        
        response = client.get(f'/api/interviews/{interview_id}')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['filename'] == 'test.json'
    
    def test_get_interview_not_found(self, client):
        """测试获取不存在的访谈"""
        response = client.get('/api/interviews/9999')
        
        assert response.status_code == 404

class TestReviewRoutes:
    """测试复核相关的API路由"""
    
    def test_get_pending_reviews_empty(self, client):
        """测试获取待复核列表（空）"""
        response = client.get('/api/review/pending')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['total'] == 0
    
    def test_get_pending_reviews_with_data(self, client, app):
        """测试获取待复核列表（有数据）"""
        with app.app_context():
            # 创建一个已完成的访谈（待复核状态）
            interview = Interview(
                filename='test.json',
                original_content='{"test": "data"}',
                status='completed'  # completed状态表示待复核
            )
            db.session.add(interview)
            
            # 创建一个已审核的访谈（不应出现在待复核列表）
            reviewed_interview = Interview(
                filename='reviewed.json',
                original_content='{"test": "data"}',
                status='reviewed'
            )
            db.session.add(reviewed_interview)
            db.session.commit()
        
        response = client.get('/api/review/pending')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        # 应该只有1个待复核的访谈
        assert data['total'] == 1
        assert data['interviews'][0]['status'] == 'completed'
    
    def test_approve_review(self, client, app):
        """测试审核通过"""
        with app.app_context():
            interview = Interview(
                filename='test.json',
                original_content='{"test": "data"}',
                status='completed'
            )
            db.session.add(interview)
            db.session.commit()
            interview_id = interview.id
        
        response = client.post(
            f'/api/review/{interview_id}/approve',
            json={
                'reviewer': '审核员',
                'comments': '数据正确，脱敏完成'
            }
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'reviewed'
    
    def test_approve_review_wrong_status(self, client, app):
        """测试审核不处于可审核状态的访谈"""
        with app.app_context():
            interview = Interview(
                filename='test.json',
                original_content='{"test": "data"}',
                status='pending'  # pending状态不能直接审核
            )
            db.session.add(interview)
            db.session.commit()
            interview_id = interview.id
        
        response = client.post(f'/api/review/{interview_id}/approve', json={})
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
    
    def test_reject_review(self, client, app):
        """测试审核不通过"""
        with app.app_context():
            interview = Interview(
                filename='test.json',
                original_content='{"test": "data"}',
                status='completed'
            )
            db.session.add(interview)
            db.session.commit()
            interview_id = interview.id
        
        response = client.post(
            f'/api/review/{interview_id}/reject',
            json={
                'reviewer': '审核员',
                'reason': '脱敏不彻底，还有敏感信息残留'
            }
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'reason' in data
    
    def test_rollback_not_enough_versions(self, client, app):
        """测试回滚但版本不足"""
        with app.app_context():
            interview = Interview(
                filename='test.json',
                original_content='{"test": "data"}',
                status='completed'
            )
            db.session.add(interview)
            db.session.commit()
            interview_id = interview.id
        
        response = client.post(f'/api/review/{interview_id}/rollback', json={})
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
    
    def test_get_versions(self, client, app):
        """测试获取版本历史"""
        with app.app_context():
            interview = Interview(
                filename='test.json',
                original_content='{"test": "data"}',
                status='completed'
            )
            db.session.add(interview)
            db.session.flush()
            
            # 添加版本
            version1 = InterviewVersion(
                interview_id=interview.id,
                version_number=1,
                content='原始内容'
            )
            version2 = InterviewVersion(
                interview_id=interview.id,
                version_number=2,
                content='脱敏内容'
            )
            db.session.add(version1)
            db.session.add(version2)
            db.session.commit()
            interview_id = interview.id
        
        response = client.get(f'/api/review/{interview_id}/versions')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['total_versions'] == 2
        assert len(data['versions']) == 2

class TestExportRoutes:
    """测试导出相关的API路由"""
    
    def test_export_review_report_default(self, client, app):
        """测试导出复核报告（默认参数）"""
        with app.app_context():
            # 创建测试数据
            interview = Interview(
                filename='test.json',
                original_content='{"test": "data"}',
                status='reviewed'
            )
            db.session.add(interview)
            db.session.commit()
        
        response = client.get('/api/export/review-report')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'statistics' in data
        assert 'interviews' in data
    
    def test_export_review_report_with_date(self, client, app):
        """测试导出指定日期的复核报告"""
        with app.app_context():
            interview = Interview(
                filename='test.json',
                original_content='{"test": "data"}',
                status='reviewed'
            )
            db.session.add(interview)
            db.session.commit()
        
        # 使用今天的日期
        today = datetime.utcnow().strftime('%Y-%m-%d')
        response = client.get(f'/api/export/review-report?date={today}')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'statistics' in data
    
    def test_export_review_report_csv(self, client, app):
        """测试导出CSV格式的复核报告"""
        with app.app_context():
            interview = Interview(
                filename='test.json',
                original_content='{"test": "data"}',
                status='reviewed'
            )
            db.session.add(interview)
            db.session.commit()
        
        response = client.get('/api/export/review-report?format=csv')
        
        assert response.status_code == 200
        assert response.headers['Content-Type'] == 'text/csv'
        assert 'attachment' in response.headers['Content-Disposition']
    
    def test_export_audit_logs(self, client, app):
        """测试导出审计日志"""
        with app.app_context():
            # 创建审计日志
            audit_log = AuditLog(
                action='upload',
                user='测试用户',
                description='测试上传'
            )
            db.session.add(audit_log)
            db.session.commit()
        
        response = client.get('/api/export/audit-logs')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'total' in data
        assert 'logs' in data
        assert data['total'] >= 1
