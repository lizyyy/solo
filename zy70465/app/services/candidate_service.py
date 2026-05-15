from datetime import datetime, timedelta
from typing import List, Dict
from sqlalchemy.orm import Session
from app.models.ticket import Ticket, TicketStatus
from app.services.ticket_service import TicketService


class CandidateService:
    def __init__(self, db: Session):
        self.db = db
        self.ticket_service = TicketService(db)

    def generate_rollback_candidates(self) -> Dict:
        candidates = []
        
        tickets = self.db.query(Ticket).filter(
            Ticket.status.in_([
                TicketStatus.APPROVED,
                TicketStatus.REJECTED,
                TicketStatus.REVIEW_REQUIRED
            ])
        ).all()
        
        for ticket in tickets:
            reason, impact = self._assess_rollback_eligibility(ticket)
            if reason:
                candidates.append({
                    "ticket_id": ticket.id,
                    "ticket_no": ticket.ticket_no,
                    "title": ticket.title,
                    "current_status": ticket.status,
                    "reason": reason,
                    "estimated_impact": impact
                })
        
        return {
            "candidates": candidates,
            "total_count": len(candidates),
            "generated_at": datetime.utcnow()
        }

    def _assess_rollback_eligibility(self, ticket: Ticket) -> tuple:
        if ticket.has_version_conflict:
            return (
                "存在版本冲突标记，可能是错误的扫描结果",
                "回滚后需重新扫描，影响工单审批流程"
            )
        
        if len(ticket.manual_notes) > 0:
            return (
                "经过人工修正，原始系统判断可能有误",
                "回滚将丢失人工修正记录，需重新审核"
            )
        
        if ticket.status == TicketStatus.REJECTED:
            status_logs = sorted(ticket.status_logs, key=lambda x: x.created_at)
            if len(status_logs) >= 3:
                return (
                    "经过多次状态变更，可能是误判导致驳回",
                    "回滚后状态变为待审核，需重新处理"
                )
        
        return None, None

    def generate_cleanup_candidates(self, retention_days: int = 90) -> Dict:
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        candidates = []
        
        tickets = self.db.query(Ticket).filter(
            Ticket.updated_at < cutoff_date,
            Ticket.status.in_([
                TicketStatus.APPROVED,
                TicketStatus.REJECTED,
                TicketStatus.ROLLED_BACK
            ])
        ).all()
        
        for ticket in tickets:
            risk = self._assess_cleanup_risk(ticket)
            candidates.append({
                "ticket_id": ticket.id,
                "ticket_no": ticket.ticket_no,
                "title": ticket.title,
                "status": ticket.status,
                "last_updated": ticket.updated_at,
                "retention_days": retention_days,
                "risk_assessment": risk
            })
        
        return {
            "candidates": candidates,
            "total_count": len(candidates),
            "generated_at": datetime.utcnow()
        }

    def _assess_cleanup_risk(self, ticket: Ticket) -> str:
        risk_factors = []
        
        if ticket.application_type == "过期数据擦除申请":
            risk_factors.append("数据擦除类工单，涉及生产数据")
        
        if ticket.has_version_conflict:
            risk_factors.append("存在版本冲突历史")
        
        if len(ticket.status_logs) > 5:
            risk_factors.append("状态变更频繁，审计价值高")
        
        if not risk_factors:
            return "低风险：普通工单，可安全清理"
        elif len(risk_factors) == 1:
            return f"中风险：{risk_factors[0]}"
        else:
            return f"高风险：{', '.join(risk_factors)}"

    def execute_rollback(self, ticket_id: int, operator: str) -> bool:
        ticket = self.ticket_service.get_ticket_by_id(ticket_id)
        if not ticket:
            return False
        
        self.ticket_service.update_ticket_status(
            ticket_id=ticket.id,
            new_status=TicketStatus.ROLLBACK_PENDING,
            operator=operator,
            reason="执行回滚操作",
            duty_record=f"研发人员{operator}执行回滚，将状态从{ticket.status}改为rollback_pending"
        )
        
        self.ticket_service.update_ticket_status(
            ticket_id=ticket.id,
            new_status=TicketStatus.ROLLED_BACK,
            operator=operator,
            reason="回滚完成",
            duty_record="回滚操作完成，工单已恢复至可重新扫描状态"
        )
        
        return True

    def execute_cleanup(self, ticket_ids: List[int], operator: str) -> Dict:
        success_count = 0
        failed_ids = []
        
        for ticket_id in ticket_ids:
            ticket = self.ticket_service.get_ticket_by_id(ticket_id)
            if ticket and ticket.status in [
                TicketStatus.APPROVED,
                TicketStatus.REJECTED,
                TicketStatus.ROLLED_BACK
            ]:
                self.ticket_service.update_ticket_status(
                    ticket_id=ticket.id,
                    new_status=TicketStatus.CLEANED,
                    operator=operator,
                    reason="执行清理操作",
                    duty_record=f"工单清理完成，由{operator}执行"
                )
                success_count += 1
            else:
                failed_ids.append(ticket_id)
        
        return {
            "success_count": success_count,
            "failed_ids": failed_ids,
            "total_processed": len(ticket_ids)
        }
