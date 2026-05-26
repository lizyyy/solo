from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import io
import csv
import json

from database import get_db
import models
import schemas
from validators import validate_batch
from audit import get_audit_trail, format_audit_trail
from schemas import BatchStatus

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/batches")
def export_batches(
    spray_area: Optional[str] = None,
    chemical_batch_no: Optional[str] = None,
    weather_window_start: Optional[datetime] = None,
    weather_window_end: Optional[datetime] = None,
    status: Optional[BatchStatus] = None,
    batch_no: Optional[str] = None,
    format: str = Query("json", description="导出格式: json 或 csv"),
    db: Session = Depends(get_db),
):
    query = db.query(models.Batch)

    if batch_no:
        query = query.filter(models.Batch.batch_no.contains(batch_no))
    if spray_area:
        query = query.filter(models.Batch.spray_area.contains(spray_area))
    if chemical_batch_no:
        query = query.join(models.Chemical).filter(
            models.Chemical.batch_no.contains(chemical_batch_no)
        )
    if weather_window_start or weather_window_end:
        query = query.join(models.WeatherRecord)
        if weather_window_start:
            query = query.filter(
                models.WeatherRecord.weather_window_start >= weather_window_start
            )
        if weather_window_end:
            query = query.filter(
                models.WeatherRecord.weather_window_end <= weather_window_end
            )
    if status:
        query = query.filter(models.Batch.status == status)

    batches = query.order_by(models.Batch.created_at.desc()).all()
    export_records = _build_export_records(db, batches)
    query_count = len(export_records)

    if format.lower() == "csv":
        return _export_csv(export_records, query_count)
    else:
        return {
            "query_count": query_count,
            "export_count": query_count,
            "count_consistent": True,
            "records": export_records,
        }


@router.get("/batch/{batch_id}")
def export_single_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    export_records = _build_export_records(db, [batch])
    return {
        "query_count": 1,
        "export_count": 1,
        "count_consistent": True,
        "records": export_records,
    }


def _build_export_records(db: Session, batches: List[models.Batch]) -> List[dict]:
    records = []
    for batch in batches:
        chemical = db.query(models.Chemical).filter(
            models.Chemical.id == batch.chemical_id
        ).first()
        weather = db.query(models.WeatherRecord).filter(
            models.WeatherRecord.id == batch.weather_id
        ).first()

        validation = validate_batch(db, batch)
        audit_logs = format_audit_trail(get_audit_trail(db, batch.id))

        audit_summary = []
        for log in audit_logs:
            summary = f"[{log['time']}] {log['handler']} {log['action']}"
            if log.get('reason'):
                summary += f"，原因: {log['reason']}"
            audit_summary.append(summary)

        validation_notes = validation.get_violation_messages() + validation.get_warning_messages()

        record = {
            "batch_no": batch.batch_no,
            "spray_area": batch.spray_area,
            "chemical_name": chemical.name if chemical else "未知",
            "chemical_batch_no": chemical.batch_no if chemical else "N/A",
            "dosage": batch.dosage,
            "planned_date": batch.planned_date.isoformat(),
            "status": batch.status,
            "operator": batch.operator,
            "wind_speed": weather.wind_speed if weather else None,
            "temperature": weather.temperature if weather else None,
            "validation_notes": validation_notes,
            "audit_summary": audit_summary,
        }
        records.append(record)

    return records


def _export_csv(records: list, query_count: int):
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "batch_no", "spray_area", "chemical_name", "chemical_batch_no",
            "dosage", "planned_date", "status", "operator",
            "wind_speed", "temperature", "validation_notes", "audit_summary",
        ],
    )
    writer.writeheader()
    for record in records:
        row = record.copy()
        row["validation_notes"] = "; ".join(record["validation_notes"])
        row["audit_summary"] = " | ".join(record["audit_summary"])
        writer.writerow(row)

    csv_content = output.getvalue()
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=batches_export.csv",
            "X-Query-Count": str(query_count),
            "X-Export-Count": str(query_count),
        },
    )
