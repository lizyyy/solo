from datetime import datetime
from typing import Tuple, Optional
from app import db
from app.models import (
    DetectionTask,
    StatusHistory,
    TRANSITION_RULES,
    DETECTION_STATUS
)


class StateTransitionError(Exception):
    def __init__(self, message: str, from_status: str, to_status: str, next_steps: list):
        self.message = message
        self.from_status = from_status
        self.to_status = to_status
        self.next_steps = next_steps
        super().__init__(message)


class StateManager:
    
    @staticmethod
    def is_valid_transition(from_status: str, to_status: str) -> Tuple[bool, Optional[list]]:
        if from_status not in DETECTION_STATUS:
            return False, None
        if to_status not in DETECTION_STATUS:
            return False, None
        
        allowed_transitions = TRANSITION_RULES.get(from_status, [])
        return to_status in allowed_transitions, allowed_transitions
    
    @staticmethod
    def get_next_allowed_states(current_status: str) -> list:
        return TRANSITION_RULES.get(current_status, [])
    
    @staticmethod
    def get_readable_error_message(from_status: str, to_status: str) -> str:
        allowed = TRANSITION_RULES.get(from_status, [])
        
        status_descriptions = {
            'pending': '等待扫描',
            'scanning': '正在扫描中',
            'completed': '扫描完成',
            'needs_confirmation': '等待人工确认',
            'confirmed_polluted': '已确认污染',
            'confirmed_clean': '已确认干净',
            'exempted': '已豁免',
            'failed': '失败'
        }
        
        if not allowed:
            return (f"当前状态【{status_descriptions.get(from_status, from_status)}】"
                   f"不允许进行任何状态流转。该状态是终态。")
        
        allowed_desc = [status_descriptions.get(s, s) for s in allowed]
        target_desc = status_descriptions.get(to_status, to_status)
        
        return (
            f"非法状态流转：无法从【{status_descriptions.get(from_status, from_status)}】"
            f"直接切换到【{target_desc}】。\n"
            f"当前状态下允许的流转目标：{', '.join(allowed_desc)}\n"
            f"下一步建议：请先检查当前任务状态，或重新提交检测。"
        )
    
    @staticmethod
    def transition(
        task: DetectionTask,
        new_status: str,
        changed_by: str = None,
        reason: str = None,
        meta_info: dict = None
    ) -> Tuple[DetectionTask, StatusHistory]:
        
        is_valid, allowed = StateManager.is_valid_transition(task.status, new_status)
        
        if not is_valid:
            raise StateTransitionError(
                message=StateManager.get_readable_error_message(task.status, new_status),
                from_status=task.status,
                to_status=new_status,
                next_steps=allowed or []
            )
        
        old_status = task.status
        task.previous_status = old_status
        task.status = new_status
        task.last_updated_by = changed_by
        task.updated_at = datetime.utcnow()
        
        history = StatusHistory(
            task_id=task.id,
            from_status=old_status,
            to_status=new_status,
            changed_by=changed_by,
            change_reason=reason,
            meta_info=meta_info
        )
        
        db.session.add(task)
        db.session.add(history)
        
        return task, history
    
    @staticmethod
    def can_start_scanning(task: DetectionTask) -> bool:
        return task.status in ['pending', 'failed']
    
    @staticmethod
    def can_confirm(task: DetectionTask) -> bool:
        return task.status == 'needs_confirmation'
    
    @staticmethod
    def can_exempt(task: DetectionTask) -> bool:
        return task.status in [
            'completed', 
            'needs_confirmation', 
            'confirmed_polluted', 
            'confirmed_clean'
        ]
    
    @staticmethod
    def can_retry(task: DetectionTask) -> bool:
        return task.status == 'failed'
    
    @staticmethod
    def is_terminal_state(status: str) -> bool:
        return status in ['exempted', 'confirmed_polluted', 'confirmed_clean']
