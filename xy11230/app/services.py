import json
import uuid
from datetime import datetime
from typing import List, Optional, Tuple
from io import BytesIO
import pandas as pd
from sqlalchemy.orm import Session

from app.models import (
    Ticket,
    TicketStatus,
    Dispatch,
    DispatchStatus,
    TicketLog,
    Cabinet,
    ImportBatch,
    ReviewResult,
    RuleAction,
    FaultType,
)
from app.schemas import (
    TicketCreate,
    DispatchCreate,
    DispatchUpdate,
    BatchResult,
    ExportFilter,
)
from app.rules import create_default_rule_engine


def generate_ticket_no() -> str:
    return f"T{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}"


def generate_dispatch_no() -> str:
    return f"D{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}"


def generate_batch_no() -> str:
    return f"B{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}"


class TicketService:
    def __init__(self, db: Session):
        self.db = db
        self.rule_engine = create_default_rule_engine()

    def _log_action(
        self,
        ticket_id: int,
        action: str,
        old_status: Optional[str] = None,
        new_status: Optional[str] = None,
        operator: Optional[str] = None,
        reason: Optional[str] = None,
        extra_data: Optional[dict] = None,
    ):
        log = TicketLog(
            ticket_id=ticket_id,
            action=action,
            old_status=old_status,
            new_status=new_status,
            operator=operator,
            reason=reason,
            extra_data=json.dumps(extra_data) if extra_data else None,
        )
        self.db.add(log)

    def create_ticket(self, ticket_data: TicketCreate, operator: Optional[str] = None) -> Ticket:
        existing = self.db.query(Ticket).filter(Ticket.ticket_no == ticket_data.ticket_no).first()
        if existing:
            return existing

        db_ticket = Ticket(
            ticket_no=ticket_data.ticket_no,
            cabinet_code=ticket_data.cabinet_code,
            fault_type=ticket_data.fault_type,
            fault_description=ticket_data.fault_description,
            bin_number=ticket_data.bin_number,
            customer_phone=ticket_data.customer_phone,
            customer_name=ticket_data.customer_name,
            source=ticket_data.source,
            status=TicketStatus.PENDING,
        )
        self.db.add(db_ticket)
        self.db.flush()

        self._log_action(
            ticket_id=db_ticket.id,
            action="create",
            new_status=TicketStatus.PENDING.value,
            operator=operator,
            reason="工单创建",
        )

        return db_ticket

    def receive_ticket(self, ticket_id: int, operator: Optional[str] = None) -> Tuple[Ticket, List[str]]:
        ticket = self.db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise ValueError(f"工单 {ticket_id} 不存在")

        if ticket.status != TicketStatus.PENDING:
            return ticket, [f"工单 {ticket.ticket_no} 已处于 {ticket.status.value} 状态，无需重复接单"]

        rule_results = self.rule_engine.apply_rules(self.db, ticket, stage="receive")
        final_action = self.rule_engine.get_final_action(rule_results)

        reasons = [f"{r.rule_name}: {r.reason}" for r in rule_results]

        if final_action == RuleAction.BLOCK:
            ticket.status = TicketStatus.REJECTED
            ticket.rule_action = RuleAction.BLOCK
            ticket.rule_reason = " | ".join(reasons)
            self._log_action(
                ticket_id=ticket.id,
                action="block",
                old_status=TicketStatus.PENDING.value,
                new_status=TicketStatus.REJECTED.value,
                operator=operator,
                reason=ticket.rule_reason,
            )
            self.db.commit()
            return ticket, reasons

        if final_action == RuleAction.MERGE:
            merge_result = next((r for r in rule_results if r.action == RuleAction.MERGE), None)
            if merge_result and merge_result.target_ticket_id:
                ticket.merged_to_ticket_id = merge_result.target_ticket_id
                ticket.rule_action = RuleAction.MERGE
                ticket.rule_reason = merge_result.reason
                ticket.status = TicketStatus.REJECTED
                self._log_action(
                    ticket_id=ticket.id,
                    action="merge",
                    old_status=TicketStatus.PENDING.value,
                    new_status=TicketStatus.REJECTED.value,
                    operator=operator,
                    reason=merge_result.reason,
                    extra_data={"target_ticket_id": merge_result.target_ticket_id},
                )
                self.db.commit()
                return ticket, reasons

        old_status = ticket.status.value
        ticket.status = TicketStatus.RECEIVED
        ticket.rule_applied = ",".join([r.rule_name for r in rule_results])
        ticket.rule_action = RuleAction.ALLOW
        ticket.rule_reason = " | ".join(reasons)

        self._log_action(
            ticket_id=ticket.id,
            action="receive",
            old_status=old_status,
            new_status=TicketStatus.RECEIVED.value,
            operator=operator,
            reason="接单成功",
        )

        self.db.commit()
        return ticket, reasons

    def attribute_ticket(
        self,
        ticket_id: int,
        fault_type: FaultType,
        reason: str,
        operator: Optional[str] = None,
    ) -> Ticket:
        ticket = self.db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise ValueError(f"工单 {ticket_id} 不存在")

        if ticket.status not in [TicketStatus.RECEIVED, TicketStatus.ATTRIBUTED]:
            raise ValueError(f"工单 {ticket.ticket_no} 当前状态 {ticket.status.value} 不能归因")

        old_status = ticket.status.value
        ticket.fault_type = fault_type
        ticket.attributed_reason = reason
        ticket.attributed_by = operator
        ticket.attributed_at = datetime.utcnow()
        ticket.status = TicketStatus.ATTRIBUTED

        self._log_action(
            ticket_id=ticket.id,
            action="attribute",
            old_status=old_status,
            new_status=TicketStatus.ATTRIBUTED.value,
            operator=operator,
            reason=reason,
            extra_data={"fault_type": fault_type.value},
        )

        self.db.commit()
        return ticket

    def batch_receive_tickets(self, ticket_ids: List[int], operator: Optional[str] = None) -> BatchResult:
        success = []
        failed = []

        for ticket_id in ticket_ids:
            try:
                ticket, reasons = self.receive_ticket(ticket_id, operator)
                success.append(
                    {
                        "ticket_id": ticket.id,
                        "ticket_no": ticket.ticket_no,
                        "status": ticket.status.value,
                        "reasons": reasons,
                    }
                )
            except Exception as e:
                failed.append({"ticket_id": ticket_id, "error": str(e)})

        return BatchResult(
            success=success,
            failed=failed,
            total=len(ticket_ids),
            success_count=len(success),
            fail_count=len(failed),
        )

    def batch_attribute_tickets(
        self,
        ticket_ids: List[int],
        fault_type: FaultType,
        reason: str,
        operator: Optional[str] = None,
    ) -> BatchResult:
        success = []
        failed = []

        for ticket_id in ticket_ids:
            try:
                ticket = self.attribute_ticket(ticket_id, fault_type, reason, operator)
                success.append(
                    {
                        "ticket_id": ticket.id,
                        "ticket_no": ticket.ticket_no,
                        "fault_type": ticket.fault_type.value,
                        "status": ticket.status.value,
                    }
                )
            except Exception as e:
                failed.append({"ticket_id": ticket_id, "error": str(e)})

        return BatchResult(
            success=success,
            failed=failed,
            total=len(ticket_ids),
            success_count=len(success),
            fail_count=len(failed),
        )


class DispatchService:
    def __init__(self, db: Session):
        self.db = db
        self.rule_engine = create_default_rule_engine()

    def create_dispatch(self, dispatch_data: DispatchCreate, operator: Optional[str] = None) -> Dispatch:
        ticket = self.db.query(Ticket).filter(Ticket.id == dispatch_data.ticket_id).first()
        if not ticket:
            raise ValueError(f"工单 {dispatch_data.ticket_id} 不存在")

        if ticket.status != TicketStatus.ATTRIBUTED:
            raise ValueError(f"工单 {ticket.ticket_no} 状态 {ticket.status.value}，需先归因后派修")

        rule_results = self.rule_engine.apply_rules(self.db, ticket, stage="dispatch")
        final_action = self.rule_engine.get_final_action(rule_results)

        if final_action == RuleAction.BLOCK:
            raise ValueError(" | ".join([r.reason for r in rule_results if r.action == RuleAction.BLOCK]))

        dispatch_no = generate_dispatch_no()
        db_dispatch = Dispatch(
            dispatch_no=dispatch_no,
            ticket_id=dispatch_data.ticket_id,
            technician_id=dispatch_data.technician_id,
            technician_name=dispatch_data.technician_name,
            scheduled_at=dispatch_data.scheduled_at,
            status=DispatchStatus.ASSIGNED,
            created_by=operator,
        )
        self.db.add(db_dispatch)

        ticket.status = TicketStatus.DISPATCHED

        log = TicketLog(
            ticket_id=ticket.id,
            action="dispatch",
            old_status=TicketStatus.ATTRIBUTED.value,
            new_status=TicketStatus.DISPATCHED.value,
            operator=operator,
            reason=f"派修给 {dispatch_data.technician_name}",
            extra_data=json.dumps({"dispatch_no": dispatch_no}),
        )
        self.db.add(log)

        self.db.commit()
        return db_dispatch

    def update_dispatch(self, dispatch_id: int, update_data: DispatchUpdate, operator: Optional[str] = None) -> Dispatch:
        dispatch = self.db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
        if not dispatch:
            raise ValueError(f"派修单 {dispatch_id} 不存在")

        ticket = self.db.query(Ticket).filter(Ticket.id == dispatch.ticket_id).first()

        if update_data.status is not None:
            dispatch.status = update_data.status

            if update_data.status == DispatchStatus.IN_PROGRESS and not dispatch.started_at:
                dispatch.started_at = datetime.utcnow()
                if ticket:
                    log = TicketLog(
                        ticket_id=ticket.id,
                        action="start_repair",
                        operator=operator,
                        reason="维修开始",
                    )
                    self.db.add(log)

            if update_data.status == DispatchStatus.COMPLETED and not dispatch.completed_at:
                dispatch.completed_at = datetime.utcnow()
                if ticket:
                    ticket.status = TicketStatus.REPAIRED

                    rule_results = self.rule_engine.apply_rules(self.db, ticket, stage="review")
                    reasons = [f"{r.rule_name}: {r.reason}" for r in rule_results]

                    log = TicketLog(
                        ticket_id=ticket.id,
                        action="complete_repair",
                        old_status=TicketStatus.DISPATCHED.value,
                        new_status=TicketStatus.REPAIRED.value,
                        operator=operator,
                        reason="维修完成，等待复核",
                        extra_data={"rule_reasons": reasons},
                    )
                    self.db.add(log)

        if update_data.repair_description is not None:
            dispatch.repair_description = update_data.repair_description
        if update_data.before_status is not None:
            dispatch.before_status = update_data.before_status
        if update_data.after_status is not None:
            dispatch.after_status = update_data.after_status

        self.db.commit()
        return dispatch

    def batch_create_dispatches(
        self,
        ticket_ids: List[int],
        technician_id: str,
        technician_name: str,
        operator: Optional[str] = None,
    ) -> BatchResult:
        success = []
        failed = []

        for ticket_id in ticket_ids:
            try:
                dispatch_data = DispatchCreate(
                    ticket_id=ticket_id,
                    technician_id=technician_id,
                    technician_name=technician_name,
                )
                dispatch = self.create_dispatch(dispatch_data, operator)
                success.append(
                    {
                        "ticket_id": ticket_id,
                        "dispatch_id": dispatch.id,
                        "dispatch_no": dispatch.dispatch_no,
                        "technician_name": technician_name,
                    }
                )
            except Exception as e:
                failed.append({"ticket_id": ticket_id, "error": str(e)})

        return BatchResult(
            success=success,
            failed=failed,
            total=len(ticket_ids),
            success_count=len(success),
            fail_count=len(failed),
        )


class ReviewService:
    def __init__(self, db: Session):
        self.db = db

    def review_ticket(
        self,
        ticket_id: int,
        result: ReviewResult,
        comment: Optional[str] = None,
        operator: Optional[str] = None,
    ) -> Ticket:
        ticket = self.db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise ValueError(f"工单 {ticket_id} 不存在")

        if ticket.status != TicketStatus.REPAIRED:
            raise ValueError(f"工单 {ticket.ticket_no} 状态 {ticket.status.value}，需维修完成后复核")

        old_status = ticket.status.value
        ticket.reviewed_result = result
        ticket.reviewed_comment = comment
        ticket.reviewed_by = operator
        ticket.reviewed_at = datetime.utcnow()

        if result == ReviewResult.PASSED:
            ticket.status = TicketStatus.REVIEWED
        elif result == ReviewResult.FAILED:
            ticket.status = TicketStatus.REJECTED
        elif result == ReviewResult.NEED_REPAIR:
            ticket.status = TicketStatus.ATTRIBUTED

        log = TicketLog(
            ticket_id=ticket.id,
            action="review",
            old_status=old_status,
            new_status=ticket.status.value,
            operator=operator,
            reason=comment or f"复核结果: {result.value}",
            extra_data={"review_result": result.value},
        )
        self.db.add(log)

        self.db.commit()
        return ticket

    def batch_review_tickets(
        self,
        ticket_ids: List[int],
        result: ReviewResult,
        comment: Optional[str] = None,
        operator: Optional[str] = None,
    ) -> BatchResult:
        success = []
        failed = []

        for ticket_id in ticket_ids:
            try:
                ticket = self.review_ticket(ticket_id, result, comment, operator)
                success.append(
                    {
                        "ticket_id": ticket.id,
                        "ticket_no": ticket.ticket_no,
                        "review_result": ticket.reviewed_result.value,
                        "status": ticket.status.value,
                    }
                )
            except Exception as e:
                failed.append({"ticket_id": ticket_id, "error": str(e)})

        return BatchResult(
            success=success,
            failed=failed,
            total=len(ticket_ids),
            success_count=len(success),
            fail_count=len(failed),
        )


class ImportService:
    def __init__(self, db: Session):
        self.db = db

    def import_tickets_from_excel(
        self,
        file_content: bytes,
        file_name: str,
        operator: Optional[str] = None,
    ) -> Tuple[ImportBatch, List[Ticket]]:
        batch_no = generate_batch_no()
        df = pd.read_excel(BytesIO(file_content))

        success_count = 0
        fail_count = 0
        fail_details = []
        created_tickets = []

        for idx, row in df.iterrows():
            try:
                ticket_no = str(row.get("工单编号", generate_ticket_no()))
                cabinet_code = str(row.get("柜号", ""))

                if not cabinet_code:
                    raise ValueError("缺少柜号")

                fault_type_str = str(row.get("故障类型", "")).lower()
                fault_type = None
                if "门" in fault_type_str or "door" in fault_type_str:
                    fault_type = FaultType.DOOR_FAIL
                elif "扫码" in fault_type_str or "scan" in fault_type_str:
                    fault_type = FaultType.SCAN_FAIL
                elif "空仓" in fault_type_str or "empty" in fault_type_str:
                    fault_type = FaultType.EMPTY_BIN_FALSE

                ticket_data = TicketCreate(
                    ticket_no=ticket_no,
                    cabinet_code=cabinet_code,
                    fault_type=fault_type,
                    fault_description=str(row.get("故障描述", "")),
                    bin_number=str(row.get("仓号", "")),
                    customer_phone=str(row.get("客户电话", "")),
                    customer_name=str(row.get("客户姓名", "")),
                    source=str(row.get("来源", "import")),
                )

                ticket_service = TicketService(self.db)
                ticket = ticket_service.create_ticket(ticket_data, operator)
                ticket.import_batch_no = batch_no
                created_tickets.append(ticket)
                success_count += 1

            except Exception as e:
                fail_count += 1
                fail_details.append({"row": idx + 2, "error": str(e)})

        batch = ImportBatch(
            batch_no=batch_no,
            file_name=file_name,
            total_count=len(df),
            success_count=success_count,
            fail_count=fail_count,
            fail_details=json.dumps(fail_details, ensure_ascii=False),
            imported_by=operator,
        )
        self.db.add(batch)
        self.db.commit()

        return batch, created_tickets


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def export_tickets(self, filter_params: ExportFilter) -> bytes:
        query = self.db.query(Ticket)

        if filter_params.status:
            query = query.filter(Ticket.status.in_(filter_params.status))
        if filter_params.fault_type:
            query = query.filter(Ticket.fault_type.in_(filter_params.fault_type))
        if filter_params.start_date:
            query = query.filter(Ticket.created_at >= filter_params.start_date)
        if filter_params.end_date:
            query = query.filter(Ticket.created_at <= filter_params.end_date)
        if filter_params.cabinet_code:
            query = query.filter(Ticket.cabinet_code.contains(filter_params.cabinet_code))

        tickets = query.all()

        data = []
        for ticket in tickets:
            data.append(
                {
                    "工单编号": ticket.ticket_no,
                    "柜号": ticket.cabinet_code,
                    "故障类型": ticket.fault_type.value if ticket.fault_type else "",
                    "故障描述": ticket.fault_description or "",
                    "仓号": ticket.bin_number or "",
                    "客户姓名": ticket.customer_name or "",
                    "客户电话": ticket.customer_phone or "",
                    "来源": ticket.source or "",
                    "状态": ticket.status.value,
                    "归因原因": ticket.attributed_reason or "",
                    "归因时间": ticket.attributed_at.strftime("%Y-%m-%d %H:%M:%S") if ticket.attributed_at else "",
                    "复核结果": ticket.reviewed_result.value if ticket.reviewed_result else "",
                    "规则执行结果": ticket.rule_reason or "",
                    "创建时间": ticket.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                }
            )

        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="工单数据")

        return output.getvalue()
