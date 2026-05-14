from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import tempfile
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from models import Ticket
from services.report_exporter import ReportExporter

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/columns")
def get_export_columns():
    exporter = ReportExporter(None)
    return {
        "main_columns": [
            {"field": col["field"], "display_name": col["display_name"], "description": col["description"]}
            for col in exporter.EXPORT_COLUMNS
        ],
        "timeline_columns": [
            {"field": col["field"], "display_name": col["display_name"], "description": col["description"]}
            for col in exporter.TIMELINE_COLUMNS
        ],
        "pause_columns": [
            {"field": col["field"], "display_name": col["display_name"], "description": col["description"]}
            for col in exporter.PAUSE_RECORD_COLUMNS
        ],
        "escalation_columns": [
            {"field": col["field"], "display_name": col["display_name"], "description": col["description"]}
            for col in exporter.ESCALATION_COLUMNS
        ],
        "approval_columns": [
            {"field": col["field"], "display_name": col["display_name"], "description": col["description"]}
            for col in exporter.APPROVAL_COLUMNS
        ]
    }


@router.get("/ticket/{ticket_id}")
def export_single_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")

    exporter = ReportExporter(db)

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        exporter.export_single_ticket_report(ticket, tmp_path)

        filename = f"SLA工单详情_{ticket.ticket_no}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"

        return FileResponse(
            path=tmp_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename
        )
    except Exception as e:
        os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@router.get("/tickets")
def export_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Ticket)

    if status:
        query = query.filter(Ticket.status == status)
    if priority:
        query = query.filter(Ticket.priority == priority)
    if start_date:
        query = query.filter(Ticket.created_at >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        query = query.filter(Ticket.created_at <= datetime.strptime(end_date, "%Y-%m-%d"))

    tickets = query.all()

    if not tickets:
        raise HTTPException(status_code=404, detail="没有符合条件的工单")

    exporter = ReportExporter(db)

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        exporter.export_tickets_to_excel(tickets, tmp_path)

        filename = f"SLA汇总报表_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"

        return FileResponse(
            path=tmp_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename
        )
    except Exception as e:
        os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@router.post("/selected")
def export_selected_tickets(ticket_ids: List[int], db: Session = Depends(get_db)):
    tickets = db.query(Ticket).filter(Ticket.id.in_(ticket_ids)).all()

    if not tickets:
        raise HTTPException(status_code=404, detail="没有找到指定的工单")

    exporter = ReportExporter(db)

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        exporter.export_tickets_to_excel(tickets, tmp_path)

        filename = f"SLA选中工单报表_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"

        return FileResponse(
            path=tmp_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename
        )
    except Exception as e:
        os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")
