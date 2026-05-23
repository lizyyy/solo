from typing import Optional, List, Dict, Any
from datetime import datetime, date
import os
import xlsxwriter
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import (
    Batch,
    BatchStatus,
    VisitorRecord,
    StateChange,
    AuditLog,
)
from ..config import settings
from .state_machine import VisitorStateMachine
from .visitor_service import VisitorService
from .batch_service import BatchService


class ReportService:
    @staticmethod
    def generate_security_supervisor_report(
        db: Session,
        batch_id: int,
        generated_by: str,
    ) -> Dict[str, Any]:
        batch = BatchService.get_batch(db, batch_id)
        if not batch:
            raise ValueError("Batch not found")

        freeze_info = VisitorStateMachine.get_freeze_info(db, batch_id)
        stats = VisitorService.get_batch_statistics(db, batch_id)
        state_history = VisitorStateMachine.get_state_history(db, batch_id)

        review_comments = []
        records, _ = VisitorService.list_visitor_records(db, batch_id=batch_id, limit=1000)
        for record in records:
            if record.review_comment or record.reviewed_by:
                review_comments.append({
                    "record_id": record.id,
                    "visitor_name": record.visitor_name,
                    "license_plate": record.license_plate,
                    "review_comment": record.review_comment,
                    "reviewed_by": record.reviewed_by,
                    "reviewed_at": record.reviewed_at,
                })

        report = {
            "batch_id": batch.id,
            "batch_number": batch.batch_number,
            "batch_name": batch.name,
            "status_before_freeze": freeze_info["status_before_freeze"],
            "status_after_freeze": freeze_info["status_after_freeze"],
            "freeze_time": freeze_info["freeze_time"],
            "frozen_by": freeze_info["frozen_by"],
            "freeze_reason": freeze_info["freeze_reason"],
            "total_visitors": stats["total_visitors"],
            "overstay_count": stats["overstay_count"],
            "overstay_rate": round(stats["overstay_rate"], 2),
            "manual_adjustment_count": stats["manual_adjustment_count"],
            "review_comments": review_comments,
            "state_change_history": state_history,
            "generated_at": datetime.utcnow(),
            "generated_by": generated_by,
        }

        return report

    @staticmethod
    def get_daily_summary(
        db: Session,
        report_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        if report_date is None:
            report_date = date.today()

        start_of_day = datetime.combine(report_date, datetime.min.time())
        end_of_day = datetime.combine(report_date, datetime.max.time())

        query = db.query(Batch).filter(
            Batch.is_deleted == False,
            Batch.created_at >= start_of_day,
            Batch.created_at <= end_of_day,
        )

        total_batches = query.count()
        frozen_batches = query.filter(Batch.status == BatchStatus.FROZEN.value).count()
        settled_batches = query.filter(Batch.status == BatchStatus.SETTLED.value).count()

        batch_ids = [b.id for b in query.all()]
        
        total_visitors = 0
        overstay_visitors = 0
        pending_review = 0
        manual_adjustments = 0

        if batch_ids:
            records = db.query(VisitorRecord).filter(VisitorRecord.batch_id.in_(batch_ids))
            total_visitors = records.count()
            overstay_visitors = records.filter(VisitorRecord.is_overstay == True).count()
            pending_review = records.filter(VisitorRecord.reviewed_by.is_(None)).count()
            manual_adjustments = records.filter(
                VisitorRecord.price_adjustment.isnot(None)
            ).count()

        return {
            "report_date": report_date,
            "total_batches": total_batches,
            "frozen_batches": frozen_batches,
            "settled_batches": settled_batches,
            "total_visitors": total_visitors,
            "overstay_visitors": overstay_visitors,
            "pending_review_count": pending_review,
            "manual_intervention_count": manual_adjustments,
        }

    @staticmethod
    def export_to_excel(
        db: Session,
        export_request: Dict[str, Any],
    ) -> str:
        os.makedirs(settings.EXPORT_DIR, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"visitor_report_{timestamp}.xlsx"
        file_path = os.path.join(settings.EXPORT_DIR, filename)

        batch_ids = export_request.get("batch_ids")
        start_date = export_request.get("start_date")
        end_date = export_request.get("end_date")
        include_state_history = export_request.get("include_state_history", True)
        include_audit_logs = export_request.get("include_audit_logs", False)

        query = db.query(Batch).filter(Batch.is_deleted == False)
        if batch_ids:
            query = query.filter(Batch.id.in_(batch_ids))
        if start_date:
            query = query.filter(Batch.created_at >= start_date)
        if end_date:
            query = query.filter(Batch.created_at <= end_date)

        batches = query.all()

        with xlsxwriter.Workbook(file_path) as workbook:
            ReportService._write_batches_sheet(workbook, batches)
            
            all_record_ids = []
            for batch in batches:
                records, _ = VisitorService.list_visitor_records(
                    db, batch_id=batch.id, limit=10000
                )
                all_record_ids.extend([r.id for r in records])
                ReportService._write_visitors_sheet(workbook, batch, records)

            if include_state_history:
                ReportService._write_state_history_sheet(db, workbook, batches)

            if include_audit_logs and all_record_ids:
                ReportService._write_audit_logs_sheet(db, workbook, all_record_ids)

        return filename

    @staticmethod
    def _write_batches_sheet(workbook, batches):
        worksheet = workbook.add_worksheet("批次汇总")
        bold = workbook.add_format({"bold": True})

        headers = [
            "批次编号", "批次名称", "状态", "创建人", "创建时间",
            "结算时间", "归档时间", "材料数量", "访客数量"
        ]
        for col, header in enumerate(headers):
            worksheet.write(0, col, header, bold)

        for row, batch in enumerate(batches, start=1):
            worksheet.write(row, 0, batch.batch_number)
            worksheet.write(row, 1, batch.name)
            worksheet.write(row, 2, batch.status)
            worksheet.write(row, 3, batch.created_by)
            worksheet.write(row, 4, str(batch.created_at) if batch.created_at else "")
            worksheet.write(row, 5, str(batch.settled_at) if batch.settled_at else "")
            worksheet.write(row, 6, str(batch.archived_at) if batch.archived_at else "")
            worksheet.write(row, 7, len(batch.materials))
            worksheet.write(row, 8, len(batch.visitor_records))

        worksheet.autofit()

    @staticmethod
    def _write_visitors_sheet(workbook, batch, records):
        worksheet = workbook.add_worksheet(f"访客-{batch.batch_number[:20]}")
        bold = workbook.add_format({"bold": True})
        red_format = workbook.add_format({"font_color": "red"})

        headers = [
            "访客姓名", "联系电话", "身份证号", "车牌号",
            "访问日期", "预计离开", "实际离开",
            "入场时间", "出场时间", "是否超时",
            "价格调整", "审核状态", "审核意见", "审核人"
        ]
        for col, header in enumerate(headers):
            worksheet.write(0, col, header, bold)

        for row, record in enumerate(records, start=1):
            cell_format = red_format if record.is_overstay else None
            
            worksheet.write(row, 0, record.visitor_name or "", cell_format)
            worksheet.write(row, 1, record.visitor_phone or "")
            worksheet.write(row, 2, record.id_card or "")
            worksheet.write(row, 3, record.license_plate or "")
            worksheet.write(row, 4, str(record.visit_date) if record.visit_date else "")
            worksheet.write(row, 5, str(record.expected_end_date) if record.expected_end_date else "")
            worksheet.write(row, 6, str(record.actual_end_date) if record.actual_end_date else "")
            worksheet.write(row, 7, str(record.gate_in_time) if record.gate_in_time else "")
            worksheet.write(row, 8, str(record.gate_out_time) if record.gate_out_time else "")
            worksheet.write(row, 9, "是" if record.is_overstay else "否", cell_format)
            worksheet.write(row, 10, record.price_adjustment if record.price_adjustment else "")
            worksheet.write(row, 11, record.review_status or "")
            worksheet.write(row, 12, record.review_comment or "")
            worksheet.write(row, 13, record.reviewed_by or "")

        worksheet.autofit()

    @staticmethod
    def _write_state_history_sheet(db, workbook, batches):
        worksheet = workbook.add_worksheet("状态变更历史")
        bold = workbook.add_format({"bold": True})

        headers = ["批次编号", "从状态", "到状态", "操作人", "变更时间", "原因"]
        for col, header in enumerate(headers):
            worksheet.write(0, col, header, bold)

        row = 1
        for batch in batches:
            state_changes = VisitorStateMachine.get_state_history(db, batch.id)
            for sc in state_changes:
                worksheet.write(row, 0, batch.batch_number)
                worksheet.write(row, 1, sc.get("from_status", ""))
                worksheet.write(row, 2, sc.get("to_status", ""))
                worksheet.write(row, 3, sc.get("changed_by", ""))
                worksheet.write(row, 4, str(sc.get("changed_at", "")))
                worksheet.write(row, 5, sc.get("reason", ""))
                row += 1

        worksheet.autofit()

    @staticmethod
    def _write_audit_logs_sheet(db, workbook, record_ids):
        worksheet = workbook.add_worksheet("审计日志")
        bold = workbook.add_format({"bold": True})

        headers = ["记录ID", "操作", "字段", "旧值", "新值", "操作人", "时间"]
        for col, header in enumerate(headers):
            worksheet.write(0, col, header, bold)

        logs, _ = VisitorService.get_audit_logs(
            db, batch_id=None, limit=10000
        )
        logs = [log for log in logs if log.visitor_record_id in record_ids]

        for row, log in enumerate(logs, start=1):
            worksheet.write(row, 0, log.visitor_record_id or "")
            worksheet.write(row, 1, log.action or "")
            worksheet.write(row, 2, log.field_name or "")
            worksheet.write(row, 3, log.old_value or "")
            worksheet.write(row, 4, log.new_value or "")
            worksheet.write(row, 5, log.changed_by or "")
            worksheet.write(row, 6, str(log.changed_at) if log.changed_at else "")

        worksheet.autofit()
