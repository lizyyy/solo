import pytest
from app import create_app, db
from app.models import DetectionTask, TRANSITION_RULES, DETECTION_STATUS
from app.services.state_manager import StateManager, StateTransitionError


class TestStateManager:
    
    def test_valid_transitions(self):
        """测试所有定义的状态转换规则都能被正确识别"""
        for from_status, allowed_to in TRANSITION_RULES.items():
            for to_status in allowed_to:
                is_valid, transitions = StateManager.is_valid_transition(from_status, to_status)
                assert is_valid, f"应该允许从 {from_status} 到 {to_status} 的转换"
                assert to_status in transitions
    
    def test_invalid_transitions(self):
        """测试非法状态转换能被正确拒绝"""
        test_cases = [
            ('pending', 'confirmed_polluted'),
            ('completed', 'scanning'),
            ('exempted', 'pending'),
            ('confirmed_clean', 'pending'),
            ('needs_confirmation', 'scanning'),
        ]
        
        for from_status, to_status in test_cases:
            is_valid, _ = StateManager.is_valid_transition(from_status, to_status)
            assert not is_valid, f"应该拒绝从 {from_status} 到 {to_status} 的转换"
    
    def test_invalid_status_values(self):
        """测试无效的状态值处理"""
        is_valid, _ = StateManager.is_valid_transition('invalid_status', 'pending')
        assert not is_valid
        
        is_valid, _ = StateManager.is_valid_transition('pending', 'invalid_status')
        assert not is_valid
    
    def test_get_next_allowed_states(self):
        """测试获取当前状态允许的下一状态"""
        assert StateManager.get_next_allowed_states('pending') == ['scanning', 'failed']
        assert StateManager.get_next_allowed_states('exempted') == []
    
    def test_readable_error_message(self):
        """测试错误消息的可读性"""
        msg = StateManager.get_readable_error_message('pending', 'confirmed_polluted')
        assert '无法从' in msg
        assert '允许的流转目标' in msg
        assert '下一步建议' in msg
    
    def test_terminal_states(self):
        """测试终态识别"""
        assert StateManager.is_terminal_state('exempted')
        assert StateManager.is_terminal_state('confirmed_polluted')
        assert StateManager.is_terminal_state('confirmed_clean')
        
        assert not StateManager.is_terminal_state('pending')
        assert not StateManager.is_terminal_state('scanning')
        assert not StateManager.is_terminal_state('needs_confirmation')
    
    def test_can_start_scanning(self):
        """测试是否允许开始扫描"""
        class MockTask:
            def __init__(self, status):
                self.status = status
        
        assert StateManager.can_start_scanning(MockTask('pending'))
        assert StateManager.can_start_scanning(MockTask('failed'))
        assert not StateManager.can_start_scanning(MockTask('scanning'))
        assert not StateManager.can_start_scanning(MockTask('completed'))
    
    def test_can_confirm(self):
        """测试是否允许人工确认"""
        class MockTask:
            def __init__(self, status):
                self.status = status
        
        assert StateManager.can_confirm(MockTask('needs_confirmation'))
        assert not StateManager.can_confirm(MockTask('pending'))
        assert not StateManager.can_confirm(MockTask('completed'))
    
    def test_can_exempt(self):
        """测试是否允许豁免"""
        class MockTask:
            def __init__(self, status):
                self.status = status
        
        assert StateManager.can_exempt(MockTask('completed'))
        assert StateManager.can_exempt(MockTask('needs_confirmation'))
        assert StateManager.can_exempt(MockTask('confirmed_polluted'))
        assert StateManager.can_exempt(MockTask('confirmed_clean'))
        
        assert not StateManager.can_exempt(MockTask('pending'))
        assert not StateManager.can_exempt(MockTask('exempted'))


class TestStateTransitionIntegration:
    
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
    
    def test_transition_records_history(self, app):
        """测试状态转换会记录历史"""
        with app.app_context():
            task = DetectionTask(
                task_key='test_key',
                evaluation_set_id=1,
                status='pending'
            )
            db.session.add(task)
            db.session.commit()
            
            assert len(task.history) == 0
            
            StateManager.transition(
                task,
                'scanning',
                changed_by='test_user',
                reason='开始检测'
            )
            
            db.session.commit()
            
            assert task.status == 'scanning'
            assert task.previous_status == 'pending'
            assert task.last_updated_by == 'test_user'
            assert len(task.history) == 1
            
            history = task.history[0]
            assert history.from_status == 'pending'
            assert history.to_status == 'scanning'
            assert history.changed_by == 'test_user'
            assert history.change_reason == '开始检测'
    
    def test_transition_invalid_raises_error(self, app):
        """测试非法状态转换会抛出异常"""
        with app.app_context():
            task = DetectionTask(
                task_key='test_key',
                evaluation_set_id=1,
                status='exempted'
            )
            db.session.add(task)
            db.session.commit()
            
            with pytest.raises(StateTransitionError) as exc_info:
                StateManager.transition(task, 'pending', changed_by='test')
            
            assert '已豁免' in exc_info.value.message
            assert exc_info.value.from_status == 'exempted'
            assert exc_info.value.to_status == 'pending'
