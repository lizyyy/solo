from typing import Dict, List, Set, Optional, Tuple
from enum import Enum


class RepairStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class RepairAction(str, Enum):
    ASSIGN = "assign"
    START_PROCESS = "start_process"
    COMPLETE = "complete"
    ACCEPT = "accept"
    REJECT = "reject"
    CANCEL = "cancel"


STATUS_DISPLAY = {
    RepairStatus.PENDING: "待派单",
    RepairStatus.ASSIGNED: "已派单",
    RepairStatus.PROCESSING: "维修中",
    RepairStatus.COMPLETED: "待验收",
    RepairStatus.ACCEPTED: "已验收通过",
    RepairStatus.REJECTED: "验收不通过",
    RepairStatus.CANCELLED: "已取消",
}

ACTION_DISPLAY = {
    RepairAction.ASSIGN: "派单",
    RepairAction.START_PROCESS: "开始维修",
    RepairAction.COMPLETE: "完成维修",
    RepairAction.ACCEPT: "验收通过",
    RepairAction.REJECT: "验收不通过",
    RepairAction.CANCEL: "取消报修",
}

FAULT_LEVEL_DISPLAY = {
    "critical": "紧急",
    "urgent": "高",
    "normal": "普通",
    "low": "低",
}


class StatusTransitionError(Exception):
    def __init__(self, from_status: str, action: str, reason: str):
        self.from_status = from_status
        self.action = action
        self.reason = reason
        super().__init__(self.get_user_message())

    def get_user_message(self) -> str:
        from_display = STATUS_DISPLAY.get(self.from_status, self.from_status)
        action_display = ACTION_DISPLAY.get(self.action, self.action)
        return (
            f"操作被拒绝：当前状态为「{from_display}」，不能执行「{action_display}」。"
            f"原因：{self.reason}"
        )


class DuplicateOperationError(Exception):
    def __init__(self, action: str, last_time: str, advice: str = ""):
        self.action = action
        self.last_time = last_time
        self.advice = advice
        super().__init__(self.get_user_message())

    def get_user_message(self) -> str:
        action_display = ACTION_DISPLAY.get(self.action, self.action)
        msg = f"重复操作：「{action_display}」已在 {self.last_time} 执行过，无需再次操作。"
        if self.advice:
            msg += f" 建议：{self.advice}"
        return msg


class StateMachine:
    _transitions: Dict[str, Dict[str, str]] = {
        RepairStatus.PENDING: {
            RepairAction.ASSIGN: RepairStatus.ASSIGNED,
            RepairAction.CANCEL: RepairStatus.CANCELLED,
        },
        RepairStatus.ASSIGNED: {
            RepairAction.START_PROCESS: RepairStatus.PROCESSING,
            RepairAction.CANCEL: RepairStatus.CANCELLED,
        },
        RepairStatus.PROCESSING: {
            RepairAction.COMPLETE: RepairStatus.COMPLETED,
        },
        RepairStatus.COMPLETED: {
            RepairAction.ACCEPT: RepairStatus.ACCEPTED,
            RepairAction.REJECT: RepairStatus.PROCESSING,
        },
        RepairStatus.REJECTED: {
            RepairAction.START_PROCESS: RepairStatus.PROCESSING,
        },
        RepairStatus.ACCEPTED: {},
        RepairStatus.CANCELLED: {},
    }

    _reasons: Dict[Tuple[str, str], str] = {
        (RepairStatus.PENDING, RepairAction.START_PROCESS): "报修单尚未派给维修人员",
        (RepairStatus.PENDING, RepairAction.COMPLETE): "报修单尚未派给维修人员",
        (RepairStatus.PENDING, RepairAction.ACCEPT): "报修单还未开始维修",
        (RepairStatus.PENDING, RepairAction.REJECT): "报修单还未开始维修",
        (RepairStatus.ASSIGNED, RepairAction.COMPLETE): "维修还未开始",
        (RepairStatus.ASSIGNED, RepairAction.ACCEPT): "维修还未开始",
        (RepairStatus.ASSIGNED, RepairAction.REJECT): "维修还未开始",
        (RepairStatus.PROCESSING, RepairAction.ASSIGN): "维修人员已在维修中，不能重复派单",
        (RepairStatus.PROCESSING, RepairAction.CANCEL): "维修已开始，如需取消请联系管理员",
        (RepairStatus.PROCESSING, RepairAction.ACCEPT): "维修尚未完成",
        (RepairStatus.PROCESSING, RepairAction.REJECT): "维修尚未完成",
        (RepairStatus.COMPLETED, RepairAction.ASSIGN): "报修单已完成维修，待验收中",
        (RepairStatus.COMPLETED, RepairAction.START_PROCESS): "报修单已完成维修，待验收中",
        (RepairStatus.COMPLETED, RepairAction.COMPLETE): "维修已完成，请勿重复提交",
        (RepairStatus.COMPLETED, RepairAction.CANCEL): "维修已完成，不能取消",
        (RepairStatus.ACCEPTED, RepairAction.ASSIGN): "报修单已验收通过，流程已结束",
        (RepairStatus.ACCEPTED, RepairAction.START_PROCESS): "报修单已验收通过，流程已结束",
        (RepairStatus.ACCEPTED, RepairAction.COMPLETE): "报修单已验收通过，流程已结束",
        (RepairStatus.ACCEPTED, RepairAction.ACCEPT): "报修单已验收通过，请勿重复提交",
        (RepairStatus.ACCEPTED, RepairAction.REJECT): "报修单已验收通过，不能再拒绝",
        (RepairStatus.ACCEPTED, RepairAction.CANCEL): "报修单已验收通过，流程已结束",
        (RepairStatus.CANCELLED, RepairAction.ASSIGN): "报修单已取消",
        (RepairStatus.CANCELLED, RepairAction.START_PROCESS): "报修单已取消",
        (RepairStatus.CANCELLED, RepairAction.COMPLETE): "报修单已取消",
        (RepairStatus.CANCELLED, RepairAction.ACCEPT): "报修单已取消",
        (RepairStatus.CANCELLED, RepairAction.REJECT): "报修单已取消",
        (RepairStatus.CANCELLED, RepairAction.CANCEL): "报修单已取消，请勿重复操作",
    }

    @classmethod
    def can_transition(cls, from_status: str, action: str) -> Tuple[bool, Optional[str]]:
        if from_status not in cls._transitions:
            return False, f"未知状态「{from_status}」"

        if action in cls._transitions[from_status]:
            return True, None

        reason = cls._reasons.get((from_status, action), f"「{ACTION_DISPLAY.get(action, action)}」操作不适用于当前状态")
        return False, reason

    @classmethod
    def get_next_status(cls, from_status: str, action: str) -> str:
        can, reason = cls.can_transition(from_status, action)
        if not can:
            raise StatusTransitionError(from_status, action, reason)
        return cls._transitions[from_status][action]

    @classmethod
    def get_available_actions(cls, status: str) -> List[str]:
        if status not in cls._transitions:
            return []
        return list(cls._transitions[status].keys())

    @classmethod
    def get_terminal_statuses(cls) -> Set[str]:
        return {RepairStatus.ACCEPTED, RepairStatus.CANCELLED}

    @classmethod
    def is_terminal(cls, status: str) -> bool:
        return status in cls.get_terminal_statuses()

    @classmethod
    def get_status_hierarchy(cls) -> Dict[str, int]:
        return {
            RepairStatus.PENDING: 0,
            RepairStatus.ASSIGNED: 1,
            RepairStatus.PROCESSING: 2,
            RepairStatus.COMPLETED: 3,
            RepairStatus.ACCEPTED: 4,
            RepairStatus.REJECTED: 2,
            RepairStatus.CANCELLED: 99,
        }

    @classmethod
    def compare_status(cls, status_a: str, status_b: str) -> int:
        hierarchy = cls.get_status_hierarchy()
        level_a = hierarchy.get(status_a, -1)
        level_b = hierarchy.get(status_b, -1)
        if level_a > level_b:
            return 1
        elif level_a < level_b:
            return -1
        return 0


class IdempotencyGuard:
    @staticmethod
    def check_duplicate(
        current_status: str,
        target_status: str,
        action: str,
        last_logs: List[dict],
    ) -> Tuple[bool, Optional[DuplicateOperationError]]:
        if StateMachine.is_terminal(current_status):
            matching_logs = [
                log for log in last_logs
                if log.get("to_status") == current_status
            ]
            if matching_logs:
                last_log = matching_logs[-1]
                last_time = last_log.get("created_at", "先前")
                if hasattr(last_time, "strftime"):
                    last_time_str = last_time.strftime("%Y-%m-%d %H:%M")
                else:
                    last_time_str = str(last_time)
                advice = "该报修单流程已结束，如需再次维修请新建报修单"
                return True, DuplicateOperationError(action, last_time_str, advice)

        for log in reversed(last_logs):
            if log.get("operation_key") == action:
                last_time = log.get("created_at", "先前")
                if hasattr(last_time, "strftime"):
                    last_time_str = last_time.strftime("%Y-%m-%d %H:%M")
                else:
                    last_time_str = str(last_time)

                log_status = log.get("to_status")
                if log_status == target_status or log_status == current_status:
                    next_actions = StateMachine.get_available_actions(current_status)
                    next_action_names = [
                        ACTION_DISPLAY.get(na, na) for na in next_actions
                    ]
                    advice = ""
                    if next_action_names:
                        advice = f"当前可执行操作：{'、'.join(next_action_names)}"
                    return True, DuplicateOperationError(action, last_time_str, advice)

        return False, None
