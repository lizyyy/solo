import hashlib
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.ticket import (
    Ticket, TicketStatus, ScanRecord, ScanStatus, TicketAttachment
)
from app.services.ticket_service import TicketService


class ScanService:
    def __init__(self, db: Session):
        self.db = db
        self.ticket_service = TicketService(db)

    def scan_ticket(self, ticket_no: str, operator: str) -> Optional[Ticket]:
        ticket = self.ticket_service.get_ticket_by_no(ticket_no)
        if not ticket:
            return None

        self.ticket_service.update_ticket_status(
            ticket_id=ticket.id,
            new_status=TicketStatus.SCANNING,
            operator=operator,
            reason="开始扫描工单附件",
            duty_record=f"研发值班人员{operator}启动工单附件扫描流程"
        )

        attachments = self.db.query(TicketAttachment).filter(
            TicketAttachment.ticket_id == ticket.id
        ).order_by(TicketAttachment.version.desc()).all()

        if not attachments:
            return self._handle_no_attachments(ticket, operator)

        latest_attachment = attachments[0]
        older_attachments = attachments[1:]

        scan_results = []
        has_conflict = False

        for attachment in attachments:
            result = self._scan_single_attachment(ticket, attachment, operator)
            scan_results.append(result)

            if attachment.version < ticket.current_version:
                has_conflict = True
                self._create_scan_record(
                    ticket=ticket,
                    attachment=attachment,
                    scan_type="version_check",
                    status=ScanStatus.CONFLICT,
                    version=attachment.version,
                    scan_result=f"版本冲突：附件版本{attachment.version}低于当前工单版本{ticket.current_version}",
                    risk_level="high",
                    scanner=operator
                )

        if has_conflict:
            self.ticket_service.mark_version_conflict(ticket.id)
            final_status = TicketStatus.REVIEW_REQUIRED
            conclusion = "检测到版本冲突，存在旧版本覆盖新版本的情况，需要人工审核"
        else:
            all_pass = all(r["status"] == "pass" for r in scan_results)
            if all_pass:
                final_status = TicketStatus.APPROVED
                conclusion = "所有附件扫描通过，未发现异常"
            else:
                final_status = TicketStatus.REVIEW_REQUIRED
                conclusion = "附件扫描发现可疑内容，需要人工复核"

        summary = self._generate_summary(ticket, attachments, scan_results)
        
        self.ticket_service.update_summary_and_conclusion(
            ticket_id=ticket.id,
            summary=summary,
            conclusion=conclusion
        )

        self.ticket_service.update_ticket_status(
            ticket_id=ticket.id,
            new_status=final_status,
            operator=operator,
            reason="附件扫描完成",
            duty_record=f"扫描完成，共处理{len(attachments)}个附件，最终状态: {final_status}"
        )

        return ticket

    def _scan_single_attachment(
        self,
        ticket: Ticket,
        attachment: TicketAttachment,
        operator: str
    ) -> dict:
        content = attachment.content_preview or ""
        
        risk_keywords = ["永久删除", "不可逆", "全部数据", "生产环境", "核心库"]
        found_risks = [kw for kw in risk_keywords if kw in content]
        
        if found_risks:
            status = ScanStatus.SUSPICIOUS
            scan_result = f"检测到高风险关键词: {', '.join(found_risks)}"
            risk_level = "high"
        elif len(content) < 50:
            status = ScanStatus.FAIL
            scan_result = "附件内容过短，可能未包含完整的擦除说明"
            risk_level = "medium"
        else:
            status = ScanStatus.PASS
            scan_result = "附件内容检查通过"
            risk_level = "low"

        self._create_scan_record(
            ticket=ticket,
            attachment=attachment,
            scan_type="content_scan",
            status=status,
            version=attachment.version,
            scan_result=scan_result,
            risk_level=risk_level,
            scanner=operator
        )

        return {"status": status.value, "attachment": attachment.file_name}

    def _create_scan_record(
        self,
        ticket: Ticket,
        attachment: TicketAttachment,
        scan_type: str,
        status: ScanStatus,
        version: int,
        scan_result: str,
        risk_level: str,
        scanner: str
    ):
        record = ScanRecord(
            ticket_id=ticket.id,
            attachment_id=attachment.id,
            scan_type=scan_type,
            status=status,
            version=version,
            scan_result=scan_result,
            risk_level=risk_level,
            scanner=scanner
        )
        self.db.add(record)
        self.db.commit()

    def _handle_no_attachments(self, ticket: Ticket, operator: str) -> Ticket:
        self._create_empty_scan_record(ticket, operator)
        
        self.ticket_service.update_summary_and_conclusion(
            ticket_id=ticket.id,
            summary="工单无任何附件",
            conclusion="扫描失败：未找到任何附件，需要申请人补充材料"
        )

        self.ticket_service.update_ticket_status(
            ticket_id=ticket.id,
            new_status=TicketStatus.REJECTED,
            operator=operator,
            reason="无附件可扫描",
            duty_record="扫描失败：工单缺少必要附件，状态变更为rejected"
        )

        return ticket

    def _create_empty_scan_record(self, ticket: Ticket, operator: str):
        record = ScanRecord(
            ticket_id=ticket.id,
            scan_type="content_scan",
            status=ScanStatus.FAIL,
            scan_result="未找到任何附件",
            risk_level="critical",
            scanner=operator
        )
        self.db.add(record)
        self.db.commit()

    def _generate_summary(
        self,
        ticket: Ticket,
        attachments: List[TicketAttachment],
        scan_results: List[dict]
    ) -> str:
        summary_parts = [
            f"工单编号: {ticket.ticket_no}",
            f"申请类型: {ticket.application_type}",
            f"申请人: {ticket.applicant}",
            f"附件数量: {len(attachments)}",
            f"版本信息: 共{len(set(a.version for a in attachments))}个版本"
        ]
        
        pass_count = sum(1 for r in scan_results if r["status"] == "pass")
        summary_parts.append(f"扫描结果: 通过{pass_count}项，异常{len(scan_results) - pass_count}项")
        
        return "\n".join(summary_parts)

    def add_attachment(
        self,
        ticket_id: int,
        file_name: str,
        file_type: str,
        content: str,
        uploaded_by: str
    ) -> TicketAttachment:
        file_hash = hashlib.md5(content.encode()).hexdigest()
        
        existing_attachments = self.db.query(TicketAttachment).filter(
            TicketAttachment.ticket_id == ticket_id
        ).count()
        
        attachment = TicketAttachment(
            ticket_id=ticket_id,
            file_name=file_name,
            file_type=file_type,
            file_size=len(content),
            file_hash=file_hash,
            version=existing_attachments + 1,
            uploaded_by=uploaded_by,
            content_preview=content[:500]
        )
        
        self.db.add(attachment)
        self.db.commit()
        self.db.refresh(attachment)
        return attachment
