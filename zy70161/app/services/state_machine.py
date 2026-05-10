from typing import Dict, List, Optional
from ..models.models import RuleStatus
import logging

logger = logging.getLogger(__name__)


class StateTransitionError(Exception):
    def __init__(self, error_code: str, error_message: str, details: Optional[str] = None):
        self.error_code = error_code
        self.error_message = error_message
        self.details = details
        super().__init__(error_message)


class StateMachineService:
    def __init__(self):
        self._transitions: Dict[RuleStatus, List[RuleStatus]] = {
            RuleStatus.DRAFT: [
                RuleStatus.PENDING_REVIEW,
                RuleStatus.DEPRECATED
            ],
            RuleStatus.PENDING_REVIEW: [
                RuleStatus.PENDING_GRAY,
                RuleStatus.REVIEW_REJECTED
            ],
            RuleStatus.REVIEW_REJECTED: [
                RuleStatus.DRAFT,
                RuleStatus.DEPRECATED
            ],
            RuleStatus.PENDING_GRAY: [
                RuleStatus.IN_GRAY,
                RuleStatus.DEPRECATED
            ],
            RuleStatus.IN_GRAY: [
                RuleStatus.PRODUCTION,
                RuleStatus.GRAY_REJECTED,
                RuleStatus.ROLLED_BACK
            ],
            RuleStatus.GRAY_REJECTED: [
                RuleStatus.DRAFT,
                RuleStatus.DEPRECATED
            ],
            RuleStatus.PRODUCTION: [
                RuleStatus.ROLLED_BACK,
                RuleStatus.DEPRECATED
            ],
            RuleStatus.ROLLED_BACK: [
                RuleStatus.DRAFT,
                RuleStatus.PENDING_REVIEW,
                RuleStatus.DEPRECATED
            ],
            RuleStatus.DEPRECATED: []
        }
        
        self._transition_descriptions: Dict[tuple, str] = {
            (RuleStatus.DRAFT, RuleStatus.PENDING_REVIEW): "提交审核",
            (RuleStatus.DRAFT, RuleStatus.DEPRECATED): "废弃规则",
            (RuleStatus.PENDING_REVIEW, RuleStatus.PENDING_GRAY): "审核通过，待灰度",
            (RuleStatus.PENDING_REVIEW, RuleStatus.REVIEW_REJECTED): "审核驳回",
            (RuleStatus.REVIEW_REJECTED, RuleStatus.DRAFT): "驳回后修改，返回草稿",
            (RuleStatus.REVIEW_REJECTED, RuleStatus.DEPRECATED): "废弃规则",
            (RuleStatus.PENDING_GRAY, RuleStatus.IN_GRAY): "开始灰度发布",
            (RuleStatus.PENDING_GRAY, RuleStatus.DEPRECATED): "废弃规则",
            (RuleStatus.IN_GRAY, RuleStatus.PRODUCTION): "灰度通过，全量发布",
            (RuleStatus.IN_GRAY, RuleStatus.GRAY_REJECTED): "灰度效果不通过",
            (RuleStatus.IN_GRAY, RuleStatus.ROLLED_BACK): "灰度中回滚",
            (RuleStatus.GRAY_REJECTED, RuleStatus.DRAFT): "灰度不通过，返回草稿修改",
            (RuleStatus.GRAY_REJECTED, RuleStatus.DEPRECATED): "废弃规则",
            (RuleStatus.PRODUCTION, RuleStatus.ROLLED_BACK): "生产环境回滚",
            (RuleStatus.PRODUCTION, RuleStatus.DEPRECATED): "废弃生产规则",
            (RuleStatus.ROLLED_BACK, RuleStatus.DRAFT): "回滚后修改，返回草稿",
            (RuleStatus.ROLLED_BACK, RuleStatus.PENDING_REVIEW): "回滚后重新提交审核",
            (RuleStatus.ROLLED_BACK, RuleStatus.DEPRECATED): "废弃规则"
        }

    def can_transition(self, from_status: RuleStatus, to_status: RuleStatus) -> bool:
        if from_status not in self._transitions:
            return False
        return to_status in self._transitions[from_status]

    def validate_transition(self, from_status: RuleStatus, to_status: RuleStatus) -> None:
        if from_status == to_status:
            raise StateTransitionError(
                error_code="STATUS_ALREADY_SET",
                error_message=f"规则已经处于「{self._get_status_display(from_status)}」状态",
                details=f"当前状态: {from_status.value}，无需重复操作"
            )
        
        if not self.can_transition(from_status, to_status):
            allowed_transitions = self._transitions.get(from_status, [])
            allowed_display = [self._get_status_display(s) for s in allowed_transitions]
            if allowed_display:
                allowed_str = "、".join(allowed_display)
                error_details = f"从「{self._get_status_display(from_status)}」状态，只能流转到：{allowed_str}"
            else:
                error_details = f"「{self._get_status_display(from_status)}」状态为终态，无法继续流转"
            
            raise StateTransitionError(
                error_code="INVALID_STATE_TRANSITION",
                error_message=f"无法从「{self._get_status_display(from_status)}」状态流转到「{self._get_status_display(to_status)}」状态",
                details=error_details
            )

    def get_transition_description(self, from_status: RuleStatus, to_status: RuleStatus) -> str:
        key = (from_status, to_status)
        return self._transition_descriptions.get(key, f"状态变更: {from_status.value} -> {to_status.value}")

    def get_allowed_transitions(self, status: RuleStatus) -> List[Dict]:
        allowed = self._transitions.get(status, [])
        return [
            {
                "status": s.value,
                "display_name": self._get_status_display(s),
                "description": self.get_transition_description(status, s)
            }
            for s in allowed
        ]

    def _get_status_display(self, status: RuleStatus) -> str:
        display_names = {
            RuleStatus.DRAFT: "草稿",
            RuleStatus.PENDING_REVIEW: "待审核",
            RuleStatus.REVIEW_REJECTED: "审核驳回",
            RuleStatus.PENDING_GRAY: "待灰度",
            RuleStatus.IN_GRAY: "灰度中",
            RuleStatus.GRAY_REJECTED: "灰度不通过",
            RuleStatus.PRODUCTION: "生产生效",
            RuleStatus.ROLLED_BACK: "已回滚",
            RuleStatus.DEPRECATED: "已废弃"
        }
        return display_names.get(status, status.value)

    def get_status_workflow(self) -> Dict:
        return {
            "statuses": {s.value: self._get_status_display(s) for s in RuleStatus},
            "transitions": [
                {
                    "from": from_status.value,
                    "from_display": self._get_status_display(from_status),
                    "to": to_status.value,
                    "to_display": self._get_status_display(to_status),
                    "description": self.get_transition_description(from_status, to_status)
                }
                for from_status in self._transitions
                for to_status in self._transitions[from_status]
            ]
        }
