from datetime import datetime
from typing import Optional, Tuple, List
from sla_models import SLAStatus, Ticket, PauseRecord, CustomerReply, PauseType


class StateTransitionError(Exception):
    def __init__(self, from_status: SLAStatus, to_status: SLAStatus, reason: str):
        self.from_status = from_status
        self.to_status = to_status
        self.reason = reason
        super().__init__(f"无法从 {from_status} 转换到 {to_status}: {reason}")


class SLAStateMachine:
    def __init__(self):
        self.valid_transitions = {
            SLAStatus.PENDING: {
                SLAStatus.RUNNING: "开始处理工单",
                SLAStatus.COMPLETED: "直接完成工单",
            },
            SLAStatus.RUNNING: {
                SLAStatus.PAUSED: "暂停SLA计时",
                SLAStatus.WAITING_CUSTOMER: "等待客户补充材料",
                SLAStatus.COMPLETED: "完成工单处理",
                SLAStatus.BREACHED: "SLA超时",
            },
            SLAStatus.PAUSED: {
                SLAStatus.RUNNING: "恢复SLA计时",
                SLAStatus.COMPLETED: "暂停中完成工单",
            },
            SLAStatus.WAITING_CUSTOMER: {
                SLAStatus.RUNNING: "客户已回复，恢复处理",
                SLAStatus.PAUSED: "等待中暂停",
                SLAStatus.COMPLETED: "等待中完成工单",
                SLAStatus.BREACHED: "等待中SLA超时",
            },
            SLAStatus.BREACHED: {
                SLAStatus.RUNNING: "超时后继续处理",
                SLAStatus.COMPLETED: "超时后完成工单",
            },
            SLAStatus.COMPLETED: {},
        }

    def can_transition(self, from_status: SLAStatus, to_status: SLAStatus) -> Tuple[bool, Optional[str]]:
        if to_status in self.valid_transitions.get(from_status, {}):
            return True, self.valid_transitions[from_status][to_status]
        return False, f"不允许从 {from_status} 转换到 {to_status}"

    def transition(self, ticket: Ticket, new_status: SLAStatus,
                   transition_time: Optional[datetime] = None,
                   reason: Optional[str] = None) -> Tuple[Ticket, Optional[PauseRecord]]:
        can_do, default_reason = self.can_transition(ticket.status, new_status)
        if not can_do:
            raise StateTransitionError(ticket.status, new_status, default_reason)

        transition_time = transition_time or datetime.now()
        transition_reason = reason or default_reason

        old_status = ticket.status
        ticket.status = new_status

        pause_record = None

        if new_status == SLAStatus.RUNNING and old_status == SLAStatus.PENDING:
            if ticket.started_at is None:
                ticket.started_at = transition_time

        elif new_status == SLAStatus.PAUSED:
            ticket.paused_at = transition_time
            pause_record = PauseRecord(
                ticket_id=ticket.id,
                pause_type=PauseType.MANUAL_PAUSE,
                start_time=transition_time,
                reason=transition_reason,
            )

        elif new_status == SLAStatus.WAITING_CUSTOMER:
            ticket.paused_at = transition_time
            pause_record = PauseRecord(
                ticket_id=ticket.id,
                pause_type=PauseType.CUSTOMER_PENDING,
                start_time=transition_time,
                reason=transition_reason or "等待客户补充材料",
            )

        elif new_status == SLAStatus.COMPLETED:
            ticket.completed_at = transition_time
            ticket.paused_at = None

        elif old_status in [SLAStatus.PAUSED, SLAStatus.WAITING_CUSTOMER] and new_status == SLAStatus.RUNNING:
            ticket.paused_at = None

        return ticket, pause_record

    def get_valid_next_states(self, current_status: SLAStatus) -> List[Tuple[SLAStatus, str]]:
        transitions = self.valid_transitions.get(current_status, {})
        return [(status, reason) for status, reason in transitions.items()]

    def describe_state(self, status: SLAStatus) -> str:
        descriptions = {
            SLAStatus.PENDING: "工单已创建，等待开始处理",
            SLAStatus.RUNNING: "SLA计时中，处理进行中",
            SLAStatus.PAUSED: "SLA已暂停，扣除不计入超时",
            SLAStatus.WAITING_CUSTOMER: "等待客户补充材料，SLA暂停",
            SLAStatus.COMPLETED: "工单已完成，SLA结束",
            SLAStatus.BREACHED: "SLA已超时",
        }
        return descriptions.get(status, "未知状态")

    def is_ticket_active(self, status: SLAStatus) -> bool:
        return status in [SLAStatus.RUNNING, SLAStatus.PAUSED, SLAStatus.WAITING_CUSTOMER]

    def is_sla_ticking(self, status: SLAStatus) -> bool:
        return status == SLAStatus.RUNNING

    def handle_customer_reply(self, ticket: Ticket, reply: CustomerReply) -> Ticket:
        if ticket.status == SLAStatus.WAITING_CUSTOMER and reply.auto_resume_sla:
            ticket, _ = self.transition(
                ticket,
                SLAStatus.RUNNING,
                transition_time=reply.reply_time,
                reason=f"客户已回复: {reply.content[:50]}..."
            )
        return ticket
