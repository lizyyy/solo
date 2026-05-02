"""状态机模块

管理标本的流转状态，定义状态转换规则和触发动作。
"""

from datetime import datetime
from typing import Optional, Callable, Dict, List, Any

from .models import Specimen, SpecimenStatus, SpecimenEvent, EventType


class StateTransitionError(Exception):
    """状态转换异常"""
    pass


class StateMachine:
    """标本状态机
    
    管理标本从登记到放行的完整生命周期。
    状态流转:
        已登记 → 处理中 → 待拍照 → 拍照完成 → 待复核 → 已复核 → 已放行
                                    ↘ 已延迟 ↗
    """
    
    STATE_TRANSITIONS: Dict[SpecimenStatus, List[SpecimenStatus]] = {
        SpecimenStatus.REGISTERED: [
            SpecimenStatus.IN_PROCESS,
            SpecimenStatus.DELAYED,
        ],
        SpecimenStatus.IN_PROCESS: [
            SpecimenStatus.PENDING_PHOTO,
            SpecimenStatus.DELAYED,
        ],
        SpecimenStatus.PENDING_PHOTO: [
            SpecimenStatus.PHOTO_COMPLETE,
            SpecimenStatus.DELAYED,
        ],
        SpecimenStatus.PHOTO_COMPLETE: [
            SpecimenStatus.PENDING_REVIEW,
            SpecimenStatus.DELAYED,
        ],
        SpecimenStatus.PENDING_REVIEW: [
            SpecimenStatus.REVIEWED,
            SpecimenStatus.DELAYED,
        ],
        SpecimenStatus.REVIEWED: [
            SpecimenStatus.RELEASED,
            SpecimenStatus.DELAYED,
        ],
        SpecimenStatus.DELAYED: [
            SpecimenStatus.IN_PROCESS,
            SpecimenStatus.PENDING_PHOTO,
            SpecimenStatus.PHOTO_COMPLETE,
            SpecimenStatus.PENDING_REVIEW,
            SpecimenStatus.REVIEWED,
            SpecimenStatus.RELEASED,
        ],
        SpecimenStatus.RELEASED: [],
    }
    
    def __init__(self):
        self._transition_callbacks: List[Callable] = []
    
    def can_transition(self, current_status: SpecimenStatus, 
                       target_status: SpecimenStatus) -> bool:
        """检查是否可以从当前状态转换到目标状态"""
        allowed_transitions = self.STATE_TRANSITIONS.get(current_status, [])
        return target_status in allowed_transitions
    
    def transition(self, specimen: Specimen, 
                   target_status: SpecimenStatus,
                   operator: str = "",
                   description: str = "") -> SpecimenEvent:
        """执行状态转换
        
        Args:
            specimen: 标本对象
            target_status: 目标状态
            operator: 操作人
            description: 操作描述
            
        Returns:
            SpecimenEvent: 状态转换事件
            
        Raises:
            StateTransitionError: 当状态转换不合法时抛出
        """
        if not self.can_transition(specimen.status, target_status):
            raise StateTransitionError(
                f"无法从状态 '{specimen.status.value}' 转换到 "
                f"'{target_status.value}'"
            )
        
        event = SpecimenEvent(
            specimen_id=specimen.id if specimen.id else 0,
            event_type=self._status_to_event_type(target_status),
            description=description or f"状态变更: {specimen.status.value} → {target_status.value}",
            operator=operator,
            event_time=datetime.now(),
        )
        
        specimen.status = target_status
        specimen.updated_at = datetime.now()
        
        self._notify_transition(specimen, target_status, event)
        
        return event
    
    def _status_to_event_type(self, status: SpecimenStatus) -> EventType:
        """将状态转换为对应的事件类型"""
        mapping = {
            SpecimenStatus.REGISTERED: EventType.REGISTER,
            SpecimenStatus.IN_PROCESS: EventType.RECEIVE,
            SpecimenStatus.PENDING_PHOTO: EventType.REMARK,
            SpecimenStatus.PHOTO_COMPLETE: EventType.PHOTOGRAPH,
            SpecimenStatus.PENDING_REVIEW: EventType.REMARK,
            SpecimenStatus.REVIEWED: EventType.REVIEW,
            SpecimenStatus.RELEASED: EventType.RELEASE,
            SpecimenStatus.DELAYED: EventType.DELAY,
        }
        return mapping.get(status, EventType.REMARK)
    
    def add_transition_callback(self, callback: Callable):
        """添加状态转换回调函数"""
        self._transition_callbacks.append(callback)
    
    def _notify_transition(self, specimen: Specimen, 
                           new_status: SpecimenStatus,
                           event: SpecimenEvent):
        """通知所有状态转换回调"""
        for callback in self._transition_callbacks:
            try:
                callback(specimen, new_status, event)
            except Exception:
                pass


class SimpleStateMachine:
    """简化版状态机 - 提供更灵活的状态管理"""
    
    def __init__(self):
        pass
    
    @staticmethod
    def get_next_suggested_status(specimen: Specimen) -> Optional[SpecimenStatus]:
        """根据当前标本状态，建议下一个合理的状态"""
        if specimen.status == SpecimenStatus.REGISTERED:
            return SpecimenStatus.IN_PROCESS
        
        if specimen.status == SpecimenStatus.IN_PROCESS:
            if specimen.photo_count == 0:
                return SpecimenStatus.PENDING_PHOTO
            return SpecimenStatus.PHOTO_COMPLETE
        
        if specimen.status == SpecimenStatus.PENDING_PHOTO:
            if specimen.photo_count > 0:
                return SpecimenStatus.PHOTO_COMPLETE
            return None
        
        if specimen.status == SpecimenStatus.PHOTO_COMPLETE:
            if specimen.has_csv and specimen.has_specimen_bag:
                return SpecimenStatus.PENDING_REVIEW
            return None
        
        if specimen.status == SpecimenStatus.PENDING_REVIEW:
            return SpecimenStatus.REVIEWED
        
        if specimen.status == SpecimenStatus.REVIEWED:
            return SpecimenStatus.RELEASED
        
        return None
    
    @staticmethod
    def get_allowed_actions(specimen: Specimen) -> List[str]:
        """获取当前状态下允许执行的操作列表"""
        actions = []
        
        if specimen.status in [SpecimenStatus.REGISTERED, SpecimenStatus.IN_PROCESS]:
            actions.append("拍照")
            actions.append("添加备注")
        
        if specimen.status == SpecimenStatus.PENDING_PHOTO and specimen.photo_count > 0:
            actions.append("确认拍照完成")
        
        if specimen.status == SpecimenStatus.PHOTO_COMPLETE:
            if specimen.has_csv and specimen.has_specimen_bag:
                actions.append("提交复核")
        
        if specimen.status == SpecimenStatus.PENDING_REVIEW:
            actions.append("复核签名")
        
        if specimen.status == SpecimenStatus.REVIEWED:
            actions.append("放行")
        
        if specimen.status != SpecimenStatus.RELEASED:
            actions.append("标记延迟")
        
        if specimen.status == SpecimenStatus.DELAYED:
            actions.append("恢复流程")
        
        return actions
