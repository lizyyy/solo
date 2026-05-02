"""状态机测试"""

import pytest
from specimen_tracker.models import Specimen, SpecimenStatus, SpecimenEvent, EventType
from specimen_tracker.state_machine import StateMachine, StateTransitionError, SimpleStateMachine


class TestStateMachine:
    """状态机测试"""
    
    def setup_method(self):
        self.state_machine = StateMachine()
        self.specimen = Specimen(
            specimen_no="BD001",
            patient_name="张三",
            status=SpecimenStatus.REGISTERED,
        )
    
    def test_valid_transition(self):
        """测试合法状态转换"""
        assert self.state_machine.can_transition(
            SpecimenStatus.REGISTERED, SpecimenStatus.IN_PROCESS
        ) == True
        
        event = self.state_machine.transition(
            self.specimen, SpecimenStatus.IN_PROCESS,
            operator="值班员",
            description="开始处理"
        )
        
        assert self.specimen.status == SpecimenStatus.IN_PROCESS
        assert event.operator == "值班员"
    
    def test_invalid_transition_raises_error(self):
        """测试非法状态转换抛出异常"""
        with pytest.raises(StateTransitionError):
            self.state_machine.transition(
                self.specimen, SpecimenStatus.RELEASED,
                operator="值班员"
            )
    
    def test_released_cannot_transition(self):
        """测试已放行状态不能再转换"""
        self.specimen.status = SpecimenStatus.RELEASED
        
        assert self.state_machine.can_transition(
            SpecimenStatus.RELEASED, SpecimenStatus.IN_PROCESS
        ) == False
    
    def test_delayed_can_transition_to_many_states(self):
        """测试延迟状态可以转换到多个状态"""
        self.specimen.status = SpecimenStatus.DELAYED
        
        assert self.state_machine.can_transition(
            SpecimenStatus.DELAYED, SpecimenStatus.IN_PROCESS
        ) == True
        assert self.state_machine.can_transition(
            SpecimenStatus.DELAYED, SpecimenStatus.RELEASED
        ) == True


class TestSimpleStateMachine:
    """简化状态机测试"""
    
    def setup_method(self):
        self.simple_sm = SimpleStateMachine()
    
    def test_get_next_suggested_status_registered(self):
        """测试已登记状态的建议下一个状态"""
        specimen = Specimen(status=SpecimenStatus.REGISTERED)
        next_status = self.simple_sm.get_next_suggested_status(specimen)
        
        assert next_status == SpecimenStatus.IN_PROCESS
    
    def test_get_next_suggested_status_with_photos(self):
        """测试待拍照状态有照片后的建议"""
        specimen = Specimen(
            status=SpecimenStatus.PENDING_PHOTO,
            photo_count=3,
        )
        next_status = self.simple_sm.get_next_suggested_status(specimen)
        
        assert next_status == SpecimenStatus.PHOTO_COMPLETE
    
    def test_get_allowed_actions_for_registered(self):
        """测试已登记状态的允许操作"""
        specimen = Specimen(status=SpecimenStatus.REGISTERED)
        actions = self.simple_sm.get_allowed_actions(specimen)
        
        assert "拍照" in actions
        assert "添加备注" in actions
        assert "标记延迟" in actions
    
    def test_get_allowed_actions_for_released(self):
        """测试已放行状态的允许操作"""
        specimen = Specimen(status=SpecimenStatus.RELEASED)
        actions = self.simple_sm.get_allowed_actions(specimen)
        
        assert "标记延迟" not in actions
        assert "放行" not in actions
