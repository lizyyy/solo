from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from sla_models import (
    Ticket, SLARule, Holiday, PauseRecord, CustomerReply,
    SLAReport, SLAStatus, PauseType, TicketPriority,
    PauseRequest, ResumeRequest, TimeCalculationRequest, ApiResponse
)
from sla_state_machine import SLAStateMachine, StateTransitionError
from calendar_engine import CalendarEngine
from idempotent_handler import IdempotentHandler, IdempotentResult
from timeout_explainer import TimeoutExplainer
from report_exporter import ReportExporter


class SLAService:
    def __init__(self):
        self.state_machine = SLAStateMachine()
        self.calendar_engine = CalendarEngine()
        self.idempotent_handler = IdempotentHandler(calendar_engine=self.calendar_engine)
        self.timeout_explainer = TimeoutExplainer(self.calendar_engine, self.state_machine)
        self.report_exporter = ReportExporter()

        self._tickets: Dict[str, Ticket] = {}
        self._sla_rules: Dict[str, SLARule] = {}
        self._initialize_default_rules()

    def _initialize_default_rules(self):
        default_rules = [
            SLARule(
                name="紧急工单SLA",
                priority=TicketPriority.CRITICAL,
                response_time_hours=0.5,
                resolution_time_hours=4.0,
                description="紧急工单：30分钟响应，4小时解决"
            ),
            SLARule(
                name="高优先级工单SLA",
                priority=TicketPriority.HIGH,
                response_time_hours=1.0,
                resolution_time_hours=24.0,
                description="高优先级工单：1小时响应，24小时解决"
            ),
            SLARule(
                name="普通工单SLA",
                priority=TicketPriority.MEDIUM,
                response_time_hours=4.0,
                resolution_time_hours=72.0,
                description="普通工单：4小时响应，72小时解决"
            ),
            SLARule(
                name="低优先级工单SLA",
                priority=TicketPriority.LOW,
                response_time_hours=24.0,
                resolution_time_hours=168.0,
                description="低优先级工单：24小时响应，7天解决"
            ),
        ]
        for rule in default_rules:
            self._sla_rules[rule.id] = rule

    def create_ticket(self, title: str, description: str, priority: TicketPriority,
                       sla_rule_id: Optional[str] = None, **kwargs) -> ApiResponse:
        try:
            if sla_rule_id and sla_rule_id not in self._sla_rules:
                return ApiResponse(
                    success=False,
                    message="SLA规则不存在",
                    errors=[f"无法找到ID为 {sla_rule_id} 的SLA规则"]
                )

            if not sla_rule_id:
                matching_rules = [r for r in self._sla_rules.values() if r.priority == priority]
                if matching_rules:
                    sla_rule_id = matching_rules[0].id
                else:
                    sla_rule_id = list(self._sla_rules.keys())[0]

            ticket = Ticket(
                title=title,
                description=description,
                priority=priority,
                sla_rule_id=sla_rule_id,
                **kwargs
            )

            self._tickets[ticket.id] = ticket
            return ApiResponse(
                success=True,
                message="工单创建成功",
                data={"ticket_id": ticket.id, "ticket": ticket}
            )
        except Exception as e:
            return ApiResponse(
                success=False,
                message="工单创建失败",
                errors=[str(e)]
            )

    def start_ticket(self, ticket_id: str) -> ApiResponse:
        ticket = self._tickets.get(ticket_id)
        if not ticket:
            return ApiResponse(
                success=False,
                message="工单不存在",
                errors=[f"无法找到ID为 {ticket_id} 的工单"]
            )

        try:
            ticket, _ = self.state_machine.transition(ticket, SLAStatus.RUNNING)
            return ApiResponse(
                success=True,
                message="工单已开始处理",
                data={"ticket_id": ticket.id, "status": ticket.status}
            )
        except StateTransitionError as e:
            return ApiResponse(
                success=False,
                message="状态转换失败",
                errors=[str(e)]
            )

    def pause_ticket(self, request: PauseRequest, force: bool = False) -> ApiResponse:
        ticket = self._tickets.get(request.ticket_id)
        if not ticket:
            return ApiResponse(
                success=False,
                message="工单不存在",
                errors=[f"无法找到ID为 {request.ticket_id} 的工单"]
            )

        if force:
            result = self.idempotent_handler.force_pause(request, ticket)
        else:
            result = self.idempotent_handler.check_and_prepare_pause(request, ticket)

        if result.is_duplicate:
            return ApiResponse(
                success=True,
                message=result.message,
                data={
                    "is_duplicate": True,
                    "existing_record": result.existing_record,
                    "pause_record": result.existing_record,
                    "ticket_status": ticket.status
                }
            )

        if result.conflicts and not force:
            return ApiResponse(
                success=False,
                message=result.message,
                errors=result.conflicts,
                data={"conflicts": result.conflicts}
            )

        if result.new_record:
            try:
                target_status = (SLAStatus.WAITING_CUSTOMER
                               if request.pause_type == PauseType.CUSTOMER_PENDING
                               else SLAStatus.PAUSED)
                
                if force and ticket.status == target_status:
                    auto_pause = None
                else:
                    ticket, auto_pause = self.state_machine.transition(
                        ticket, target_status,
                        transition_time=result.new_record.start_time,
                        reason=request.reason
                    )

                self.idempotent_handler.commit_pause(result.new_record)

                return ApiResponse(
                    success=True,
                    message="工单暂停成功",
                    data={
                        "is_duplicate": False,
                        "pause_record": result.new_record,
                        "ticket_status": ticket.status,
                        "conflicts": result.conflicts
                    }
                )
            except StateTransitionError as e:
                return ApiResponse(
                    success=False,
                    message="状态转换失败",
                    errors=[str(e)]
                )

        return ApiResponse(
            success=False,
            message="暂停处理失败",
            errors=result.conflicts or ["未知错误"],
            data={"conflicts": result.conflicts}
        )

    def resume_ticket(self, request: ResumeRequest) -> ApiResponse:
        ticket = self._tickets.get(request.ticket_id)
        if not ticket:
            return ApiResponse(
                success=False,
                message="工单不存在",
                errors=[f"无法找到ID为 {request.ticket_id} 的工单"]
            )

        resumed_record, errors = self.idempotent_handler.resume_pause(request, ticket)

        if errors and not resumed_record:
            return ApiResponse(
                success=False,
                message="恢复暂停失败",
                errors=errors
            )

        try:
            ticket, _ = self.state_machine.transition(
                ticket, SLAStatus.RUNNING,
                transition_time=request.resume_time or datetime.now(),
                reason=request.reason or "恢复SLA计时"
            )

            return ApiResponse(
                success=True,
                message="工单已恢复处理",
                data={
                    "ticket_id": ticket.id,
                    "status": ticket.status,
                    "resumed_record": resumed_record,
                    "warnings": errors
                }
            )
        except StateTransitionError as e:
            return ApiResponse(
                success=False,
                message="状态转换失败",
                errors=[str(e)] + errors
            )

    def complete_ticket(self, ticket_id: str) -> ApiResponse:
        ticket = self._tickets.get(ticket_id)
        if not ticket:
            return ApiResponse(
                success=False,
                message="工单不存在",
                errors=[f"无法找到ID为 {ticket_id} 的工单"]
            )

        try:
            ticket, _ = self.state_machine.transition(ticket, SLAStatus.COMPLETED)

            active_pauses = self.idempotent_handler.get_active_pauses(ticket_id)
            for pause in active_pauses:
                pause.end_time = ticket.completed_at
                pause.is_active = False

            return ApiResponse(
                success=True,
                message="工单已完成",
                data={"ticket_id": ticket.id, "completed_at": ticket.completed_at}
            )
        except StateTransitionError as e:
            return ApiResponse(
                success=False,
                message="状态转换失败",
                errors=[str(e)]
            )

    def add_customer_reply(self, reply: CustomerReply) -> ApiResponse:
        ticket = self._tickets.get(reply.ticket_id)
        if not ticket:
            return ApiResponse(
                success=False,
                message="工单不存在",
                errors=[f"无法找到ID为 {reply.ticket_id} 的工单"]
            )

        self.calendar_engine.add_customer_reply(reply)

        if reply.auto_resume_sla:
            ticket = self.state_machine.handle_customer_reply(ticket, reply)

            active_pauses = self.idempotent_handler.get_active_pauses(reply.ticket_id)
            for pause in active_pauses:
                if pause.pause_type == PauseType.CUSTOMER_PENDING:
                    pause.end_time = reply.reply_time
                    pause.is_active = False
                    self.calendar_engine.add_pause_record(pause)

        return ApiResponse(
            success=True,
            message="客户回复已记录",
            data={
                "reply_id": reply.id,
                "ticket_status": ticket.status,
                "auto_resumed": reply.auto_resume_sla
            }
        )

    def add_holiday(self, holiday: Holiday) -> ApiResponse:
        try:
            self.calendar_engine.add_holiday(holiday)
            return ApiResponse(
                success=True,
                message="节假日已添加",
                data={"holiday_id": holiday.id}
            )
        except Exception as e:
            return ApiResponse(
                success=False,
                message="添加节假日失败",
                errors=[str(e)]
            )

    def calculate_time(self, request: TimeCalculationRequest) -> ApiResponse:
        ticket = self._tickets.get(request.ticket_id)
        if not ticket:
            return ApiResponse(
                success=False,
                message="工单不存在",
                errors=[f"无法找到ID为 {request.ticket_id} 的工单"]
            )

        rule = self._sla_rules.get(ticket.sla_rule_id)
        if not rule:
            return ApiResponse(
                success=False,
                message="SLA规则不存在",
                errors=[f"无法找到ID为 {ticket.sla_rule_id} 的SLA规则"]
            )

        start_time = ticket.started_at or ticket.created_at
        end_time = request.target_time or datetime.now()

        time_detail, segments = self.calendar_engine.calculate_effective_seconds(
            ticket.id, start_time, end_time, rule,
            include_segments=request.include_segments
        )

        remaining, deadline = self.timeout_explainer.calculate_remaining_time(
            ticket, rule, end_time
        )
        time_detail.remaining_seconds = max(0, remaining)

        return ApiResponse(
            success=True,
            message="时间计算完成",
            data={
                "time_detail": time_detail,
                "time_segments": segments,
                "deadline": deadline
            }
        )

    def generate_report(self, ticket_id: str,
                         current_time: Optional[datetime] = None,
                         include_segments: bool = True) -> ApiResponse:
        ticket = self._tickets.get(ticket_id)
        if not ticket:
            return ApiResponse(
                success=False,
                message="工单不存在",
                errors=[f"无法找到ID为 {ticket_id} 的工单"]
            )

        rule = self._sla_rules.get(ticket.sla_rule_id)
        if not rule:
            return ApiResponse(
                success=False,
                message="SLA规则不存在",
                errors=[f"无法找到ID为 {ticket.sla_rule_id} 的SLA规则"]
            )

        report = self.timeout_explainer.generate_report(
            ticket, rule, current_time, include_segments
        )

        return ApiResponse(
            success=True,
            message="报告生成成功",
            data={
                "report": report,
                "json": self.report_exporter.to_json(report),
                "markdown": self.report_exporter.to_markdown(report),
                "summary": self.report_exporter.export_human_readable_summary(report),
                "structured": self.report_exporter.export_structured_data(report)
            }
        )

    def get_ticket(self, ticket_id: str) -> ApiResponse:
        ticket = self._tickets.get(ticket_id)
        if not ticket:
            return ApiResponse(
                success=False,
                message="工单不存在",
                errors=[f"无法找到ID为 {ticket_id} 的工单"]
            )
        return ApiResponse(success=True, message="查询成功", data=ticket)

    def get_all_tickets(self) -> ApiResponse:
        return ApiResponse(
            success=True,
            message="查询成功",
            data=list(self._tickets.values())
        )

    def get_sla_rules(self) -> ApiResponse:
        return ApiResponse(
            success=True,
            message="查询成功",
            data=list(self._sla_rules.values())
        )

    def add_sla_rule(self, rule: SLARule) -> ApiResponse:
        self._sla_rules[rule.id] = rule
        return ApiResponse(
            success=True,
            message="SLA规则已添加",
            data={"rule_id": rule.id}
        )

    def get_pause_history(self, ticket_id: str) -> ApiResponse:
        history = self.idempotent_handler.get_pause_history(ticket_id)
        return ApiResponse(
            success=True,
            message="查询成功",
            data=history
        )

    def update_pause_record(self, pause_record: PauseRecord) -> ApiResponse:
        for i, p in enumerate(self.idempotent_handler._pause_records):
            if p.id == pause_record.id:
                self.idempotent_handler._pause_records[i] = pause_record
                break

        for i, p in enumerate(self.calendar_engine.pause_records):
            if p.id == pause_record.id:
                self.calendar_engine.pause_records[i] = pause_record
                break

        return ApiResponse(
            success=True,
            message="暂停记录已更新",
            data={"pause_record": pause_record}
        )

    def update_ticket(self, ticket: Ticket) -> ApiResponse:
        if ticket.id in self._tickets:
            self._tickets[ticket.id] = ticket
            return ApiResponse(
                success=True,
                message="工单已更新",
                data={"ticket": ticket}
            )
        return ApiResponse(
            success=False,
            message="工单不存在",
            errors=[f"无法找到ID为 {ticket.id} 的工单"]
        )

    def get_customer_replies(self, ticket_id: str) -> ApiResponse:
        replies = [r for r in self.calendar_engine.customer_replies if r.ticket_id == ticket_id]
        return ApiResponse(
            success=True,
            message="查询成功",
            data=replies
        )
