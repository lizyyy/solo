from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


class PotteryState(Enum):
    PENDING = 'pending'
    UNDER_REVIEW = 'under_review'
    APPROVED = 'approved'
    REJECTED = 'rejected'
    ARCHIVED = 'archived'


class GroupState(Enum):
    DRAFT = 'draft'
    SUBMITTED = 'submitted'
    UNDER_REVIEW = 'under_review'
    APPROVED = 'approved'
    REJECTED = 'rejected'
    WITHDRAWN = 'withdrawn'
    ARCHIVED = 'archived'


class ReviewResult(Enum):
    APPROVE = 'approve'
    REJECT = 'reject'
    NEED_MORE_INFO = 'need_more_info'


@dataclass
class TransitionResult:
    success: bool
    new_state: Optional[str] = None
    message: str = ''
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            'success': self.success,
            'new_state': self.new_state,
            'message': self.message,
            'errors': self.errors,
            'warnings': self.warnings,
            'metadata': self.metadata
        }


@dataclass
class Transition:
    from_state: str
    to_state: str
    action: str
    description: str = ''
    guards: List[Callable] = field(default_factory=list)
    on_enter: Optional[Callable] = None
    on_exit: Optional[Callable] = None


class StateMachine:
    def __init__(self):
        self.pottery_transitions: Dict[str, List[Transition]] = {}
        self.group_transitions: Dict[str, List[Transition]] = {}
        self._init_pottery_transitions()
        self._init_group_transitions()
    
    def _init_pottery_transitions(self):
        pottery_transitions = [
            Transition(
                from_state=PotteryState.PENDING.value,
                to_state=PotteryState.UNDER_REVIEW.value,
                action='submit_for_review',
                description='提交陶片进行复核'
            ),
            Transition(
                from_state=PotteryState.UNDER_REVIEW.value,
                to_state=PotteryState.APPROVED.value,
                action='approve',
                description='审核通过陶片'
            ),
            Transition(
                from_state=PotteryState.UNDER_REVIEW.value,
                to_state=PotteryState.REJECTED.value,
                action='reject',
                description='审核驳回陶片'
            ),
            Transition(
                from_state=PotteryState.UNDER_REVIEW.value,
                to_state=PotteryState.PENDING.value,
                action='send_back',
                description='退回陶片待修改'
            ),
            Transition(
                from_state=PotteryState.REJECTED.value,
                to_state=PotteryState.PENDING.value,
                action='revise',
                description='修改后重新提交'
            ),
            Transition(
                from_state=PotteryState.APPROVED.value,
                to_state=PotteryState.ARCHIVED.value,
                action='archive',
                description='归档陶片'
            ),
            Transition(
                from_state=PotteryState.REJECTED.value,
                to_state=PotteryState.ARCHIVED.value,
                action='archive',
                description='归档陶片'
            ),
            Transition(
                from_state=PotteryState.ARCHIVED.value,
                to_state=PotteryState.PENDING.value,
                action='unarchive',
                description='取消归档'
            )
        ]
        
        for transition in pottery_transitions:
            if transition.from_state not in self.pottery_transitions:
                self.pottery_transitions[transition.from_state] = []
            self.pottery_transitions[transition.from_state].append(transition)
    
    def _init_group_transitions(self):
        group_transitions = [
            Transition(
                from_state=GroupState.DRAFT.value,
                to_state=GroupState.SUBMITTED.value,
                action='submit',
                description='提交拼接组'
            ),
            Transition(
                from_state=GroupState.SUBMITTED.value,
                to_state=GroupState.UNDER_REVIEW.value,
                action='start_review',
                description='开始复核'
            ),
            Transition(
                from_state=GroupState.UNDER_REVIEW.value,
                to_state=GroupState.APPROVED.value,
                action='approve',
                description='审核通过'
            ),
            Transition(
                from_state=GroupState.UNDER_REVIEW.value,
                to_state=GroupState.REJECTED.value,
                action='reject',
                description='审核驳回'
            ),
            Transition(
                from_state=GroupState.UNDER_REVIEW.value,
                to_state=GroupState.DRAFT.value,
                action='send_back',
                description='退回修改'
            ),
            Transition(
                from_state=GroupState.SUBMITTED.value,
                to_state=GroupState.WITHDRAWN.value,
                action='withdraw',
                description='撤回提交'
            ),
            Transition(
                from_state=GroupState.WITHDRAWN.value,
                to_state=GroupState.DRAFT.value,
                action='revise',
                description='修改后重新编辑'
            ),
            Transition(
                from_state=GroupState.REJECTED.value,
                to_state=GroupState.DRAFT.value,
                action='revise',
                description='修改后重新编辑'
            ),
            Transition(
                from_state=GroupState.APPROVED.value,
                to_state=GroupState.ARCHIVED.value,
                action='archive',
                description='归档'
            ),
            Transition(
                from_state=GroupState.REJECTED.value,
                to_state=GroupState.ARCHIVED.value,
                action='archive',
                description='归档'
            ),
            Transition(
                from_state=GroupState.WITHDRAWN.value,
                to_state=GroupState.ARCHIVED.value,
                action='archive',
                description='归档'
            ),
            Transition(
                from_state=GroupState.ARCHIVED.value,
                to_state=GroupState.DRAFT.value,
                action='unarchive',
                description='取消归档'
            )
        ]
        
        for transition in group_transitions:
            if transition.from_state not in self.group_transitions:
                self.group_transitions[transition.from_state] = []
            self.group_transitions[transition.from_state].append(transition)
    
    def can_transition_pottery(self, current_state: str, action: str) -> bool:
        if current_state not in self.pottery_transitions:
            return False
        for transition in self.pottery_transitions[current_state]:
            if transition.action == action:
                return True
        return False
    
    def can_transition_group(self, current_state: str, action: str) -> bool:
        if current_state not in self.group_transitions:
            return False
        for transition in self.group_transitions[current_state]:
            if transition.action == action:
                return True
        return False
    
    def get_available_pottery_actions(self, current_state: str) -> List[Dict[str, Any]]:
        if current_state not in self.pottery_transitions:
            return []
        return [
            {
                'action': t.action,
                'to_state': t.to_state,
                'description': t.description
            }
            for t in self.pottery_transitions[current_state]
        ]
    
    def get_available_group_actions(self, current_state: str) -> List[Dict[str, Any]]:
        if current_state not in self.group_transitions:
            return []
        return [
            {
                'action': t.action,
                'to_state': t.to_state,
                'description': t.description
            }
            for t in self.group_transitions[current_state]
        ]
    
    def transition_pottery(self, current_state: str, action: str, 
                           context: Optional[Dict] = None) -> TransitionResult:
        if current_state not in self.pottery_transitions:
            return TransitionResult(
                success=False,
                message=f'无效的陶片状态: {current_state}',
                errors=[f'状态 {current_state} 不存在于状态机中']
            )
        
        for transition in self.pottery_transitions[current_state]:
            if transition.action == action:
                for guard in transition.guards:
                    guard_result = guard(context)
                    if not guard_result.get('allowed', True):
                        return TransitionResult(
                            success=False,
                            message=f'状态转换被阻止: {guard_result.get("reason", "未知原因")}',
                            errors=[guard_result.get('reason', '状态转换条件不满足')]
                        )
                
                return TransitionResult(
                    success=True,
                    new_state=transition.to_state,
                    message=f'成功从 {current_state} 转换到 {transition.to_state}',
                    metadata={
                        'action': action,
                        'from_state': current_state,
                        'to_state': transition.to_state,
                        'timestamp': datetime.utcnow().isoformat()
                    }
                )
        
        return TransitionResult(
            success=False,
            message=f'无法从状态 {current_state} 执行动作 {action}',
            errors=[f'动作 {action} 在状态 {current_state} 下不可用']
        )
    
    def transition_group(self, current_state: str, action: str,
                        context: Optional[Dict] = None) -> TransitionResult:
        if current_state not in self.group_transitions:
            return TransitionResult(
                success=False,
                message=f'无效的拼接组状态: {current_state}',
                errors=[f'状态 {current_state} 不存在于状态机中']
            )
        
        for transition in self.group_transitions[current_state]:
            if transition.action == action:
                for guard in transition.guards:
                    guard_result = guard(context)
                    if not guard_result.get('allowed', True):
                        return TransitionResult(
                            success=False,
                            message=f'状态转换被阻止: {guard_result.get("reason", "未知原因")}',
                            errors=[guard_result.get('reason', '状态转换条件不满足')]
                        )
                
                return TransitionResult(
                    success=True,
                    new_state=transition.to_state,
                    message=f'成功从 {current_state} 转换到 {transition.to_state}',
                    metadata={
                        'action': action,
                        'from_state': current_state,
                        'to_state': transition.to_state,
                        'timestamp': datetime.utcnow().isoformat()
                    }
                )
        
        return TransitionResult(
            success=False,
            message=f'无法从状态 {current_state} 执行动作 {action}',
            errors=[f'动作 {action} 在状态 {current_state} 下不可用']
        )
    
    def get_pottery_state_flow(self) -> Dict[str, List[Dict]]:
        return {
            state: [
                {
                    'action': t.action,
                    'to_state': t.to_state,
                    'description': t.description
                }
                for t in transitions
            ]
            for state, transitions in self.pottery_transitions.items()
        }
    
    def get_group_state_flow(self) -> Dict[str, List[Dict]]:
        return {
            state: [
                {
                    'action': t.action,
                    'to_state': t.to_state,
                    'description': t.description
                }
                for t in transitions
            ]
            for state, transitions in self.group_transitions.items()
        }
    
    @staticmethod
    def get_all_pottery_states() -> List[str]:
        return [state.value for state in PotteryState]
    
    @staticmethod
    def get_all_group_states() -> List[str]:
        return [state.value for state in GroupState]
