import pytest
from app import create_app, db
from app.models import (
    EvaluationSet,
    EvaluationItem,
    DetectionTask,
    PollutionMatch,
    ExemptionRecord,
    DetectionReport
)
from app.services.detection_service import (
    DetectionService,
    FingerprintService,
    DuplicateSubmissionError
)
from app.services.state_manager import StateTransitionError


class TestFingerprintService:
    
    def test_compute_sha256(self):
        """测试SHA256哈希计算"""
        content = "test content"
        hash1 = FingerprintService.compute_sha256(content)
        hash2 = FingerprintService.compute_sha256(content)
        
        assert hash1 == hash2
        assert len(hash1) == 64
    
    def test_normalize_content(self):
        """测试内容规范化"""
        original = "  line1\n  line2\n  \n  line3  "
        normalized = FingerprintService.normalize_content(original)
        
        assert normalized == "line1\nline2\nline3"
        assert "\n  " not in normalized
        assert "  \n" not in normalized
    
    def test_compute_fingerprint_with_normalization(self):
        """测试规范化对指纹的影响"""
        content1 = "  question: what is 1+1?  \n  answer: 2  "
        content2 = "question: what is 1+1?\nanswer: 2"
        
        fp1 = FingerprintService.compute_fingerprint(content1, normalize=True)
        fp2 = FingerprintService.compute_fingerprint(content2, normalize=True)
        
        assert fp1 == fp2
        
        fp1_raw = FingerprintService.compute_fingerprint(content1, normalize=False)
        fp2_raw = FingerprintService.compute_fingerprint(content2, normalize=False)
        
        assert fp1_raw != fp2_raw


class TestDuplicateSubmission:
    
    @pytest.fixture
    def app(self):
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.session.remove()
            db.drop_all()
    
    def test_generate_task_key_consistent(self, app):
        """测试任务键生成的一致性"""
        with app.app_context():
            key1 = DetectionService.generate_task_key(1, "signature123")
            key2 = DetectionService.generate_task_key(1, "signature123")
            
            assert key1 == key2
    
    def test_generate_task_key_different(self, app):
        """测试不同参数生成不同的任务键"""
        with app.app_context():
            key1 = DetectionService.generate_task_key(1, "sig1")
            key2 = DetectionService.generate_task_key(1, "sig2")
            key3 = DetectionService.generate_task_key(2, "sig1")
            
            assert key1 != key2
            assert key1 != key3
    
    def test_check_duplicate_submission(self, app):
        """测试重复提交检测"""
        with app.app_context():
            eval_set = EvaluationSet(name='test', version='1.0')
            db.session.add(eval_set)
            db.session.flush()
            
            task1, is_new1 = DetectionService.create_task(
                evaluation_set_id=eval_set.id,
                training_data_signature="unique_signature",
                created_by='user1'
            )
            db.session.commit()
            
            with pytest.raises(DuplicateSubmissionError) as exc_info:
                DetectionService.create_task(
                    evaluation_set_id=eval_set.id,
                    training_data_signature="unique_signature",
                    created_by='user2'
                )
            
            assert exc_info.value.existing_task.id == task1.id
            assert '重复提交' in exc_info.value.message
    
    def test_force_create_new_task(self, app):
        """测试force参数强制创建新任务"""
        with app.app_context():
            eval_set = EvaluationSet(name='test', version='1.0')
            db.session.add(eval_set)
            db.session.flush()
            
            task1, is_new1 = DetectionService.create_task(
                evaluation_set_id=eval_set.id,
                training_data_signature="signature",
                created_by='user1'
            )
            db.session.commit()
            
            task2, is_new2 = DetectionService.create_task(
                evaluation_set_id=eval_set.id,
                training_data_signature="signature",
                created_by='user2',
                force=True
            )
            db.session.commit()
            
            assert is_new2
            assert task2.id != task1.id


class TestCompleteDetectionFlow:
    
    @pytest.fixture
    def app(self):
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.session.remove()
            db.drop_all()
    
    def test_complete_flow_with_pollution(self, app):
        """测试完整的污染检测流程 - 存在污染"""
        with app.app_context():
            eval_set = EvaluationSet(name='test_eval', version='1.0')
            db.session.add(eval_set)
            db.session.flush()
            
            polluted_content = "这是一个评测题：什么是机器学习？"
            clean_content = "这是干净的训练数据"
            
            eval_item = EvaluationItem(
                evaluation_set_id=eval_set.id,
                item_id='q1',
                content=polluted_content,
                fingerprint=FingerprintService.compute_fingerprint(polluted_content)
            )
            db.session.add(eval_item)
            db.session.commit()
            
            task, _ = DetectionService.create_task(
                evaluation_set_id=eval_set.id,
                training_data_signature="train_data_sig",
                created_by='tester'
            )
            
            DetectionService.add_training_fingerprints(task, [
                {'content': polluted_content, 'data_source': 'file1.txt'},
                {'content': clean_content, 'data_source': 'file2.txt'}
            ])
            
            matches = DetectionService.run_detection(task)
            
            assert task.status == 'needs_confirmation'
            assert len(matches) == 1
            assert matches[0].match_score == 1.0
            assert matches[0].match_type == 'exact_hash_match'
            
            assert len(task.history) >= 2
    
    def test_complete_flow_clean(self, app):
        """测试完整的检测流程 - 无污染"""
        with app.app_context():
            eval_set = EvaluationSet(name='test_eval', version='1.0')
            db.session.add(eval_set)
            db.session.flush()
            
            eval_item = EvaluationItem(
                evaluation_set_id=eval_set.id,
                item_id='q1',
                content='评测题内容',
                fingerprint=FingerprintService.compute_fingerprint('评测题内容')
            )
            db.session.add(eval_item)
            db.session.commit()
            
            task, _ = DetectionService.create_task(
                evaluation_set_id=eval_set.id,
                training_data_signature="train_sig",
                created_by='tester'
            )
            
            DetectionService.add_training_fingerprints(task, [
                {'content': '完全不同的训练数据', 'data_source': 'file1.txt'}
            ])
            
            matches = DetectionService.run_detection(task)
            
            assert task.status == 'completed'
            assert len(matches) == 0


class TestConfirmationAndExemption:
    
    @pytest.fixture
    def app(self):
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.session.remove()
            db.drop_all()
    
    def test_confirm_as_polluted(self, app):
        """测试人工确认为污染"""
        with app.app_context():
            eval_set = EvaluationSet(name='test', version='1.0')
            db.session.add(eval_set)
            db.session.flush()
            
            content = "污染内容"
            eval_item = EvaluationItem(
                evaluation_set_id=eval_set.id,
                item_id='q1',
                content=content,
                fingerprint=FingerprintService.compute_fingerprint(content)
            )
            db.session.add(eval_item)
            db.session.commit()
            
            task, _ = DetectionService.create_task(
                evaluation_set_id=eval_set.id,
                training_data_signature="sig",
                created_by='tester'
            )
            DetectionService.add_training_fingerprints(task, [{'content': content}])
            matches = DetectionService.run_detection(task)
            
            assert task.status == 'needs_confirmation'
            
            updated_task, reason = DetectionService.confirm_match(
                task=task,
                match_id=matches[0].id,
                is_polluted=True,
                confirmed_by='reviewer1'
            )
            
            assert updated_task.status == 'confirmed_polluted'
            assert '确认为污染' in reason
    
    def test_confirm_all_clean(self, app):
        """测试所有匹配都确认为非污染"""
        with app.app_context():
            eval_set = EvaluationSet(name='test', version='1.0')
            db.session.add(eval_set)
            db.session.flush()
            
            content = "测试内容"
            eval_item = EvaluationItem(
                evaluation_set_id=eval_set.id,
                item_id='q1',
                content=content,
                fingerprint=FingerprintService.compute_fingerprint(content)
            )
            db.session.add(eval_item)
            db.session.commit()
            
            task, _ = DetectionService.create_task(
                evaluation_set_id=eval_set.id,
                training_data_signature="sig",
                created_by='tester'
            )
            DetectionService.add_training_fingerprints(task, [{'content': content}])
            matches = DetectionService.run_detection(task)
            
            updated_task, reason = DetectionService.confirm_match(
                task=task,
                match_id=matches[0].id,
                is_polluted=False,
                confirmed_by='reviewer1'
            )
            
            assert updated_task.status == 'confirmed_clean'
    
    def test_exempt_task(self, app):
        """测试任务豁免"""
        with app.app_context():
            eval_set = EvaluationSet(name='test', version='1.0')
            db.session.add(eval_set)
            db.session.flush()
            
            content = "内容"
            eval_item = EvaluationItem(
                evaluation_set_id=eval_set.id,
                item_id='q1',
                content=content,
                fingerprint=FingerprintService.compute_fingerprint(content)
            )
            db.session.add(eval_item)
            db.session.commit()
            
            task, _ = DetectionService.create_task(
                evaluation_set_id=eval_set.id,
                training_data_signature="sig",
                created_by='tester'
            )
            DetectionService.add_training_fingerprints(task, [{'content': content}])
            DetectionService.run_detection(task)
            
            exemption = DetectionService.create_exemption(
                task=task,
                reason='false_positive',
                justification='这是误报，训练数据是合法使用',
                exempted_by='admin'
            )
            
            assert task.status == 'exempted'
            assert exemption.reason == 'false_positive'
            assert exemption.task_id == task.id
    
    def test_exempt_wrong_status_fails(self, app):
        """测试在错误状态下豁免会失败"""
        with app.app_context():
            eval_set = EvaluationSet(name='test', version='1.0')
            db.session.add(eval_set)
            db.session.commit()
            
            task, _ = DetectionService.create_task(
                evaluation_set_id=eval_set.id,
                training_data_signature="sig",
                created_by='tester'
            )
            db.session.commit()
            
            with pytest.raises(StateTransitionError):
                DetectionService.create_exemption(
                    task=task,
                    reason='false_positive',
                    justification='测试',
                    exempted_by='admin'
                )


class TestReportGeneration:
    
    @pytest.fixture
    def app(self):
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.session.remove()
            db.drop_all()
    
    def test_generate_report(self, app):
        """测试生成检测报告"""
        with app.app_context():
            eval_set = EvaluationSet(name='test', version='1.0')
            db.session.add(eval_set)
            db.session.flush()
            
            content = "内容"
            eval_item = EvaluationItem(
                evaluation_set_id=eval_set.id,
                item_id='q1',
                content=content,
                fingerprint=FingerprintService.compute_fingerprint(content)
            )
            db.session.add(eval_item)
            db.session.commit()
            
            task, _ = DetectionService.create_task(
                evaluation_set_id=eval_set.id,
                training_data_signature="sig",
                created_by='tester'
            )
            DetectionService.add_training_fingerprints(task, [{'content': content}])
            matches = DetectionService.run_detection(task)
            
            report = DetectionService.generate_report(
                task=task,
                report_type='summary',
                generated_by='system'
            )
            
            assert report is not None
            assert report.task_id == task.id
            assert report.findings['total_matches'] == 1
            assert report.findings['active_matches'] == 1
            assert 'history' in report.findings
            assert len(report.findings['history']) >= 2
    
    def test_get_task_summary(self, app):
        """测试获取任务摘要"""
        with app.app_context():
            eval_set = EvaluationSet(name='test', version='1.0')
            db.session.add(eval_set)
            db.session.flush()
            
            eval_item = EvaluationItem(
                evaluation_set_id=eval_set.id,
                item_id='q1',
                content='测试',
                fingerprint=FingerprintService.compute_fingerprint('测试')
            )
            db.session.add(eval_item)
            db.session.commit()
            
            task, _ = DetectionService.create_task(
                evaluation_set_id=eval_set.id,
                training_data_signature="sig",
                created_by='tester'
            )
            
            summary = DetectionService.get_task_summary(task)
            
            assert 'task' in summary
            assert 'next_allowed_states' in summary
            assert 'is_terminal' in summary
            assert summary['matches_count'] == 0
